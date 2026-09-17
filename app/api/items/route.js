import { NextResponse } from "next/server";
import { getItems, createItem, updateItem, setImage } from "../../../lib/store";

export async function GET() {
  const items = await getItems();
  return NextResponse.json(items);
}

export async function POST(request) {
  const data = await request.json();
  if (!data.title || !data.title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  const { image, ...rest } = data;
  let item = await createItem(rest);
  if (image) {
    await setImage(item.id, image);
    item = await updateItem(item.id, { hasScreenshot: true });
  }
  return NextResponse.json(item, { status: 201 });
}
