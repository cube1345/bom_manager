import { NextResponse } from "next/server";
import { nowIso, readDb, writeDb } from "@/lib/db";

export const runtime = "nodejs";

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await req.json()) as { name?: string; primaryName?: string; secondaryName?: string };
  const fallbackName = body.name?.trim() ?? "";
  const fallbackPrimary = fallbackName.includes("/") ? fallbackName.split("/")[0]?.trim() ?? "" : fallbackName;
  const fallbackSecondary = fallbackName.includes("/") ? fallbackName.split("/")[1]?.trim() ?? "" : "";
  const primaryName = body.primaryName?.trim() || fallbackPrimary;
  const secondaryName = body.secondaryName?.trim() || fallbackSecondary;
  const name = secondaryName ? `${primaryName}/${secondaryName}` : primaryName;

  if (!primaryName) {
    return NextResponse.json({ message: "一级类型不能为空" }, { status: 400 });
  }

  const db = await readDb();
  const type = db.types.find((item) => item.id === id);

  if (!type) {
    return NextResponse.json({ message: "类型不存在" }, { status: 404 });
  }

  const duplicate = db.types.some(
    (item) =>
      item.id !== id &&
      item.primaryName.toLowerCase() === primaryName.toLowerCase() &&
      (item.secondaryName ?? "").toLowerCase() === secondaryName.toLowerCase(),
  );
  if (duplicate) {
    return NextResponse.json({ message: "该类型组合已存在" }, { status: 400 });
  }

  type.name = name;
  type.primaryName = primaryName;
  type.secondaryName = secondaryName;
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
