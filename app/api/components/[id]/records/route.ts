import { NextResponse } from "next/server";
import {
  createId,
  normalizeRecord,
  nowIso,
  readDb,
  recomputeComponent,
  writeDb,
} from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await req.json()) as {
    platform?: string;
    link?: string;
    quantity?: number;
    pricePerUnit?: number;
  };

  const platform = body.platform?.trim() ?? "";
  const link = body.link?.trim() ?? "";
  const quantity = Number(body.quantity ?? 0);
  const pricePerUnit = Number(body.pricePerUnit ?? -1);

  if (!platform || !link || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(pricePerUnit) || pricePerUnit < 0) {
    return NextResponse.json({ message: "记录参数不合法" }, { status: 400 });
  }

  const db = await readDb();
  const index = db.components.findIndex((item) => item.id === id);

  if (index === -1) {
    return NextResponse.json({ message: "元器件不存在" }, { status: 404 });
  }

  const now = nowIso();
  const record = normalizeRecord({
    id: createId(),
    platform,
    link,
    quantity,
    pricePerUnit,
    purchasedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  db.components[index].records.push(record);
  db.components[index] = recomputeComponent(db.components[index]);
  await writeDb(db);

  return NextResponse.json(record, { status: 201 });
}
