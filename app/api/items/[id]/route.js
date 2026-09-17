import { NextResponse } from "next/server";
import { updateItem, deleteItem, setImage, deleteImage } from "../../../../lib/store";

export async function PATCH(request, { params }) {
  const { id } = await params;
  const patch = await request.json();
  const { image, removeImage, ...rest } = patch;

  if (image) {
    await setImage(id, image);
    rest.hasScreenshot = true;
  } else if (removeImage) {
    await deleteImage(id);
    rest.hasScreenshot = false;
  }

  const item = await updateItem(id, rest);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function DELETE(_request, { params }) {
  const { id } = await params;
  const ok = await deleteItem(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
