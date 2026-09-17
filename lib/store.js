import { randomUUID } from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USE_SUPABASE = !!SUPABASE_URL && !!SUPABASE_KEY;

const LOCAL_PATH = process.cwd() + "/data/db.json";
const LOCAL_IMAGES_DIR = process.cwd() + "/data/images";
const BUCKET = "screenshots";

let supabaseClient;
async function getSupabase() {
  if (!supabaseClient) {
    const { createClient } = await import("@supabase/supabase-js");
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });
  }
  return supabaseClient;
}

function rowToItem(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    assignee: row.assignee,
    priority: row.priority,
    link: row.link || "",
    status: row.status,
    hasScreenshot: row.has_screenshot,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
  if (USE_SUPABASE) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Supabase getItems failed: ${error.message}`);
    return data.map(rowToItem);
  }
  return readLocal();
}

export async function createItem(data) {
  const base = {
    id: randomUUID(),
    title: data.title.trim(),
    description: (data.description || "").trim(),
    assignee: (data.assignee || "Unassigned").trim() || "Unassigned",
    priority: data.priority || "medium",
    link: (data.link || "").trim(),
    status: data.status || "proposed",
  };

  if (USE_SUPABASE) {
    const supabase = await getSupabase();
    const { data: row, error } = await supabase
      .from("items")
      .insert({ ...base, has_screenshot: false })
      .select()
      .single();
    if (error) throw new Error(`Supabase createItem failed: ${error.message}`);
    return rowToItem(row);
  }

  const now = new Date().toISOString();
  const item = { ...base, hasScreenshot: false, createdAt: now, updatedAt: now };
  const items = await readLocal();
  items.unshift(item);
  await writeLocal(items);
  return item;
}

export async function updateItem(id, patch) {
  if (USE_SUPABASE) {
    const supabase = await getSupabase();
    const row = { updated_at: new Date().toISOString() };
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.assignee !== undefined) row.assignee = patch.assignee;
    if (patch.priority !== undefined) row.priority = patch.priority;
    if (patch.link !== undefined) row.link = patch.link;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.hasScreenshot !== undefined) row.has_screenshot = patch.hasScreenshot;

    const { data, error } = await supabase
      .from("items")
      .update(row)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw new Error(`Supabase updateItem failed: ${error.message}`);
    return data ? rowToItem(data) : null;
  }

  const items = await readLocal();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...patch, updatedAt: new Date().toISOString() };
  await writeLocal(items);
  return items[idx];
}

export async function deleteItem(id) {
  if (USE_SUPABASE) {
    const supabase = await getSupabase();
    const { error, count } = await supabase
      .from("items")
      .delete({ count: "exact" })
      .eq("id", id);
    if (error) throw new Error(`Supabase deleteItem failed: ${error.message}`);
    const changed = (count || 0) > 0;
    if (changed) await deleteImage(id);
    return changed;
  }

  const items = await readLocal();
  const next = items.filter((i) => i.id !== id);
  const changed = next.length !== items.length;
  if (changed) {
    await writeLocal(next);
    await deleteImage(id);
  }
  return changed;
}

// Screenshots are stored separately from the items list (Supabase Storage in
// production, a local file in dev) so the board stays fast to load no
// matter how many tickets have images attached.
function parseDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data URL");
  const [, mime, base64] = match;
  return { contentType: mime, buffer: Buffer.from(base64, "base64") };
}

export async function setImage(id, dataUrl) {
  const { contentType, buffer } = parseDataUrl(dataUrl);

  if (USE_SUPABASE) {
    const supabase = await getSupabase();
    const upload = () =>
      supabase.storage.from(BUCKET).upload(id, buffer, { contentType, upsert: true });

    let { error } = await upload();
    if (error && /bucket not found/i.test(error.message)) {
      // First screenshot ever uploaded: create the bucket on the fly so
      // there's no manual "create a storage bucket" setup step.
      await supabase.storage.createBucket(BUCKET, { public: false });
      ({ error } = await upload());
    }
    if (error) throw new Error(`Supabase setImage failed: ${error.message}`);
    return;
  }

  const fs = await import("fs/promises");
  await fs.mkdir(LOCAL_IMAGES_DIR, { recursive: true });
  await fs.writeFile(`${LOCAL_IMAGES_DIR}/${id}.txt`, dataUrl);
}

export async function getImage(id) {
  if (USE_SUPABASE) {
    const supabase = await getSupabase();
    const { data, error } = await supabase.storage.from(BUCKET).download(id);
    if (error || !data) return null;
    const buffer = Buffer.from(await data.arrayBuffer());
    return { buffer, contentType: data.type || "image/jpeg" };
  }

  const fs = await import("fs/promises");
  try {
    const dataUrl = await fs.readFile(`${LOCAL_IMAGES_DIR}/${id}.txt`, "utf-8");
    return parseDataUrl(dataUrl);
  } catch {
    return null;
  }
}

export async function deleteImage(id) {
  if (USE_SUPABASE) {
    const supabase = await getSupabase();
    await supabase.storage.from(BUCKET).remove([id]);
    return;
  }
  const fs = await import("fs/promises");
  try {
    await fs.unlink(`${LOCAL_IMAGES_DIR}/${id}.txt`);
  } catch {
    // nothing to remove
  }
}
