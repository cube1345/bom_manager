import { NextResponse } from "next/server";
import { createId, nowIso, readDb, writeDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await req.json()) as {
    componentId?: string;
    quantityPerBoard?: number;
  };

  const componentId = body.componentId?.trim() ?? "";
  const quantityPerBoard = Number(body.quantityPerBoard ?? 0);

  if (!componentId || !Number.isFinite(quantityPerBoard) || quantityPerBoard <= 0) {
    return NextResponse.json({ message: "BOM 明细参数不合法" }, { status: 400 });
  }

  const db = await readDb();
  const pcb = db.pcbs.find((item) => item.id === id);
  if (!pcb) {
    return NextResponse.json({ message: "PCB 不存在" }, { status: 404 });
  }

  const componentExists = db.components.some((item) => item.id === componentId);
  if (!componentExists) {
    return NextResponse.json({ message: "元器件不存在" }, { status: 400 });
  }

  const duplicate = pcb.items.some((item) => item.componentId === componentId);
  if (duplicate) {
    return NextResponse.json({ message: "该 PCB 中该元器件已存在，请编辑数量" }, { status: 400 });
  }

  const now = nowIso();
  const created = {
    id: createId(),
    componentId,
    quantityPerBoard,
    createdAt: now,
    updatedAt: now,
  };

  pcb.items.push(created);
  pcb.updatedAt = now;
  await writeDb(db);
  return NextResponse.json(created, { status: 201 });
}
