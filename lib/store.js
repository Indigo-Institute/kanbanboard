import { randomUUID } from "crypto";

// Supports either the Vercel KV env var names or plain Upstash Redis names,
// since both show up depending on how the Redis integration was connected.
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_KV = !!REDIS_URL && !!REDIS_TOKEN;
const KEY = "backlog:items";
const LOCAL_PATH = process.cwd() + "/data/db.json";
const LOCAL_IMAGES_DIR = process.cwd() + "/data/images";

let kvClient;
async function getKv() {
  if (!kvClient) {
    const { Redis } = await import("@upstash/redis");
    kvClient = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
  }
  return kvClient;
}

async function readLocal() {
  const fs = await import("fs/promises");
  try {
    const raw = await fs.readFile(LOCAL_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeLocal(items) {
  const fs = await import("fs/promises");
  await fs.mkdir(process.cwd() + "/data", { recursive: true });
  await fs.writeFile(LOCAL_PATH, JSON.stringify(items, null, 2));
}

export async function getItems() {
  if (USE_KV) {
    const kv = await getKv();
    const items = await kv.get(KEY);
    return items || [];
  }
  return readLocal();
}

async function saveItems(items) {
  if (USE_KV) {
    const kv = await getKv();
    await kv.set(KEY, items);
    return;
  }
  return writeLocal(items);
}

export async function createItem(data) {
  const items = await getItems();
  const now = new Date().toISOString();
  const item = {
    id: randomUUID(),
    title: data.title.trim(),
    description: (data.description || "").trim(),
    assignee: (data.assignee || "Unassigned").trim() || "Unassigned",
    priority: data.priority || "medium",
    link: (data.link || "").trim(),
    status: data.status || "proposed",
    hasScreenshot: false,
    createdAt: now,
    updatedAt: now,
  };
  items.unshift(item);
  await saveItems(items);
  return item;
}

export async function updateItem(id, patch) {
  const items = await getItems();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...patch, updatedAt: new Date().toISOString() };
  await saveItems(items);
  return items[idx];
}

export async function deleteItem(id) {
  const items = await getItems();
  const next = items.filter((i) => i.id !== id);
  const changed = next.length !== items.length;
  if (changed) {
    await saveItems(next);
    await deleteImage(id);
  }
  return changed;
}

// Screenshots are stored separately per item (not inside the items list)
// so the shared board stays fast to load no matter how many tickets have
// images attached.
function imageKey(id) {
  return `backlog:image:${id}`;
}

export async function getImage(id) {
  if (USE_KV) {
    const kv = await getKv();
    return (await kv.get(imageKey(id))) || null;
  }
  const fs = await import("fs/promises");
  try {
    return await fs.readFile(`${LOCAL_IMAGES_DIR}/${id}.txt`, "utf-8");
  } catch {
    return null;
  }
}

export async function setImage(id, dataUrl) {
  if (USE_KV) {
    const kv = await getKv();
    await kv.set(imageKey(id), dataUrl);
    return;
  }
  const fs = await import("fs/promises");
  await fs.mkdir(LOCAL_IMAGES_DIR, { recursive: true });
  await fs.writeFile(`${LOCAL_IMAGES_DIR}/${id}.txt`, dataUrl);
}

export async function deleteImage(id) {
  if (USE_KV) {
    const kv = await getKv();
    await kv.del(imageKey(id));
    return;
  }
  const fs = await import("fs/promises");
  try {
    await fs.unlink(`${LOCAL_IMAGES_DIR}/${id}.txt`);
  } catch {
    // nothing to remove
  }
}
