import { NextResponse } from "next/server";
import { createId, nowIso, readDb, writeDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const db = await readDb();
  return NextResponse.json(db.types);
}

export async function POST(req: Request) {
  const body = (await req.json()) as { name?: string };
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ message: "类型名称不能为空" }, { status: 400 });
  }

  const db = await readDb();
  const exists = db.types.some((item) => item.name === name);
  if (exists) {
    return NextResponse.json({ message: "类型名称已存在" }, { status: 400 });
  }

  const now = nowIso();
  const created = {
    id: createId(),
    name,
    createdAt: now,
    updatedAt: now,
  };

  db.types.push(created);
  await writeDb(db);

  return NextResponse.json(created, { status: 201 });
}
