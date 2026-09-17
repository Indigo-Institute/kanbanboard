import { NextResponse } from "next/server";
import { getImage } from "../../../../../lib/store";

export async function GET(_request, { params }) {
  const { id } = await params;
  const dataUrl = await getImage(id);
  if (!dataUrl) return new NextResponse(null, { status: 404 });

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return new NextResponse(null, { status: 404 });

  const [, mime, base64] = match;
  const buffer = Buffer.from(base64, "base64");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
