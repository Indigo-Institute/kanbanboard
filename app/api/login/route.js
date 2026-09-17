import { NextResponse } from "next/server";

export async function POST(request) {
  const { password } = await request.json();
  const expected = process.env.BACKLOG_PASSWORD;

  if (!expected || password !== expected) {
    return NextResponse.json({ error: "Incorrect passphrase" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("backlog_auth", expected, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
