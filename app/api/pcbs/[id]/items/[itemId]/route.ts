import { NextResponse } from "next/server";
import { nowIso, readDb, writeDb } from "@/lib/db";

export const runtime = "nodejs";

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await context.params;
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

  const index = pcb.items.findIndex((item) => item.id === itemId);
  if (index === -1) {
    return NextResponse.json({ message: "BOM 明细不存在" }, { status: 404 });
  }

  const duplicate = pcb.items.some((item) => item.id !== itemId && item.componentId === componentId);
  if (duplicate) {
    return NextResponse.json({ message: "该 PCB 中该元器件已存在，请编辑数量" }, { status: 400 });
  }

  const oldItem = pcb.items[index];
  const now = nowIso();
  pcb.items[index] = {
    ...oldItem,
    componentId,
    quantityPerBoard,
    updatedAt: now,
  };
  pcb.updatedAt = now;

  await writeDb(db);
  return NextResponse.json(pcb.items[index]);
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await context.params;
  const db = await readDb();
  const pcb = db.pcbs.find((item) => item.id === id);
  if (!pcb) {
    return NextResponse.json({ message: "PCB 不存在" }, { status: 404 });
  }

  const index = pcb.items.findIndex((item) => item.id === itemId);
  if (index === -1) {
    return NextResponse.json({ message: "BOM 明细不存在" }, { status: 404 });
  }

  const [removed] = pcb.items.splice(index, 1);
  pcb.updatedAt = nowIso();
  await writeDb(db);
  return NextResponse.json(removed);
}
