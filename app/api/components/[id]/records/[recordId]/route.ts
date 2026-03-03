import { NextResponse } from "next/server";
import {
  normalizeRecord,
  nowIso,
  readDb,
  recomputeComponent,
  writeDb,
} from "@/lib/db";

export const runtime = "nodejs";

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string; recordId: string }> },
) {
  const { id, recordId } = await context.params;
  const body = (await req.json()) as {
    storeId?: string;
    platform?: string;
    link?: string;
    quantity?: number;
    pricePerUnit?: number;
  };

  const storeId = body.storeId?.trim() || undefined;
  const platform = body.platform?.trim() ?? "";
  const link = body.link?.trim() ?? "";
  const quantity = Number(body.quantity ?? 0);
  const pricePerUnit = Number(body.pricePerUnit ?? -1);

  if (!platform || !link || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(pricePerUnit) || pricePerUnit < 0) {
    return NextResponse.json({ message: "记录参数不合法" }, { status: 400 });
  }

  const db = await readDb();
  if (storeId && !db.stores.some((item) => item.id === storeId)) {
    return NextResponse.json({ message: "所选店铺不存在" }, { status: 400 });
  }
  const componentIndex = db.components.findIndex((item) => item.id === id);

  if (componentIndex === -1) {
    return NextResponse.json({ message: "元器件不存在" }, { status: 404 });
  }

  const recordIndex = db.components[componentIndex].records.findIndex((item) => item.id === recordId);
  if (recordIndex === -1) {
    return NextResponse.json({ message: "记录不存在" }, { status: 404 });
  }

  const oldRecord = db.components[componentIndex].records[recordIndex];
  db.components[componentIndex].records[recordIndex] = normalizeRecord({
    ...oldRecord,
    storeId,
    platform,
    link,
    quantity,
    pricePerUnit,
    updatedAt: nowIso(),
  });

  db.components[componentIndex] = recomputeComponent(db.components[componentIndex]);
  await writeDb(db);

  return NextResponse.json(db.components[componentIndex].records[recordIndex]);
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string; recordId: string }> },
) {
  const { id, recordId } = await context.params;
  const db = await readDb();

  const componentIndex = db.components.findIndex((item) => item.id === id);
  if (componentIndex === -1) {
    return NextResponse.json({ message: "元器件不存在" }, { status: 404 });
  }

  const recordIndex = db.components[componentIndex].records.findIndex((item) => item.id === recordId);
  if (recordIndex === -1) {
    return NextResponse.json({ message: "记录不存在" }, { status: 404 });
  }

  const [removed] = db.components[componentIndex].records.splice(recordIndex, 1);
  db.components[componentIndex] = recomputeComponent(db.components[componentIndex]);
  await writeDb(db);

  return NextResponse.json(removed);
}
