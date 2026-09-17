import { NextResponse } from "next/server";
import { getImage } from "../../../../../lib/store";

export async function GET(_request, { params }) {
  const { id } = await params;
  const image = await getImage(id);
  if (!image) return new NextResponse(null, { status: 404 });

  return new NextResponse(image.buffer, {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
