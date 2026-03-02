import { NextResponse } from "next/server";
import { createId, nowIso, readDb, recomputeComponent, writeDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const db = await readDb();
  return NextResponse.json(db.components);
}

export async function POST(req: Request) {
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
  const typeExists = db.types.some((item) => item.id === typeId);
  if (!typeExists) {
    return NextResponse.json({ message: "类型不存在" }, { status: 400 });
  }

  const now = nowIso();
  const created = recomputeComponent({
    id: createId(),
    typeId,
    model,
    auxInfo: body.auxInfo?.trim() ?? "",
    note: body.note?.trim() ?? "",
    warningThreshold,
    records: [],
    totalQuantity: 0,
    lowestPrice: null,
    createdAt: now,
    updatedAt: now,
  });

  db.components.push(created);
  await writeDb(db);

  return NextResponse.json(created, { status: 201 });
}
