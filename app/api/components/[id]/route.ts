import { NextResponse } from "next/server";
import { nowIso, readDb, recomputeComponent, writeDb } from "@/lib/db";

export const runtime = "nodejs";

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await req.json()) as {
    typeId?: string;
    model?: string;
    auxInfo?: string;
    note?: string;
    warningThreshold?: number;
  };

  const typeId = body.typeId?.trim();
  const model = body.model?.trim();
  const warningThreshold = Number(body.warningThreshold ?? 0);

  if (!typeId || !model) {
    return NextResponse.json({ message: "类型和型号为必填项" }, { status: 400 });
  }

  if (!Number.isFinite(warningThreshold) || warningThreshold < 0) {
    return NextResponse.json({ message: "预警阈值必须是大于等于 0 的数字" }, { status: 400 });
  }

  const db = await readDb();
  const component = db.components.find((item) => item.id === id);

  if (!component) {
    return NextResponse.json({ message: "元器件不存在" }, { status: 404 });
  }

  const typeExists = db.types.some((item) => item.id === typeId);
  if (!typeExists) {
    return NextResponse.json({ message: "类型不存在" }, { status: 400 });
  }

  component.typeId = typeId;
  component.model = model;
  component.auxInfo = body.auxInfo?.trim() ?? "";
  component.note = body.note?.trim() ?? "";
  component.warningThreshold = warningThreshold;
  component.updatedAt = nowIso();

  const normalized = recomputeComponent(component);
  const index = db.components.findIndex((item) => item.id === id);
  db.components[index] = normalized;
  await writeDb(db);

  return NextResponse.json(normalized);
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const db = await readDb();

  const index = db.components.findIndex((item) => item.id === id);
  if (index === -1) {
    return NextResponse.json({ message: "元器件不存在" }, { status: 404 });
  }

  const [removed] = db.components.splice(index, 1);
  await writeDb(db);

  return NextResponse.json(removed);
}
