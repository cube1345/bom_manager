import { NextResponse } from "next/server";
import { createId, nowIso, readDb, writeDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const db = await readDb();
  return NextResponse.json(db.projects);
}

export async function POST(req: Request) {
  const body = (await req.json()) as { name?: string; note?: string };
  const name = body.name?.trim() ?? "";
  const note = body.note?.trim() ?? "";

  if (!name) {
    return NextResponse.json({ message: "项目名称不能为空" }, { status: 400 });
  }

  const db = await readDb();
  const duplicate = db.projects.some((item) => item.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    return NextResponse.json({ message: "项目名称已存在" }, { status: 400 });
  }

  const now = nowIso();
  const created = {
    id: createId(),
    name,
    note,
    createdAt: now,
    updatedAt: now,
  };

  db.projects.push(created);
  await writeDb(db);
  return NextResponse.json(created, { status: 201 });
}
