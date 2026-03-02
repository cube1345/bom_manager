import { NextResponse } from "next/server";
import { nowIso, readDb, writeDb } from "@/lib/db";

export const runtime = "nodejs";

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await req.json()) as { name?: string };
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ message: "类型名称不能为空" }, { status: 400 });
  }

  const db = await readDb();
  const type = db.types.find((item) => item.id === id);

  if (!type) {
    return NextResponse.json({ message: "类型不存在" }, { status: 404 });
  }

  const duplicate = db.types.some((item) => item.id !== id && item.name === name);
  if (duplicate) {
    return NextResponse.json({ message: "类型名称已存在" }, { status: 400 });
  }

  type.name = name;
  type.updatedAt = nowIso();
  await writeDb(db);

  return NextResponse.json(type);
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const db = await readDb();

  const index = db.types.findIndex((item) => item.id === id);
  if (index === -1) {
    return NextResponse.json({ message: "类型不存在" }, { status: 404 });
  }

  const inUse = db.components.some((item) => item.typeId === id);
  if (inUse) {
    return NextResponse.json({ message: "该类型已被元器件使用，无法删除" }, { status: 400 });
  }

  const [removed] = db.types.splice(index, 1);
  await writeDb(db);

  return NextResponse.json(removed);
}
