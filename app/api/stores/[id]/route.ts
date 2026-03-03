import { NextResponse } from "next/server";
import { normalizeStore, nowIso, readDb, writeDb } from "@/lib/db";

export const runtime = "nodejs";

type StorePayload = {
  platform?: string;
  shopName?: string;
  qualityScore?: number;
  shippingFee?: number;
  priceScore?: number;
  mainProducts?: string;
  note?: string;
};

function parsePayload(body: StorePayload) {
  const platform = body.platform?.trim() ?? "";
  const shopName = body.shopName?.trim() ?? "";
  const qualityScore = Number(body.qualityScore ?? 0);
  const shippingFee = Number(body.shippingFee ?? 0);
  const priceScore = Number(body.priceScore ?? 0);
  const mainProducts = body.mainProducts?.trim() ?? "";
  const note = body.note?.trim() ?? "";

  if (!platform || !shopName) {
    return { error: "平台和店铺名称为必填项" };
  }
  if (!Number.isFinite(qualityScore) || qualityScore < 0 || qualityScore > 5) {
    return { error: "质量评分范围应为 0 到 5" };
  }
  if (!Number.isFinite(priceScore) || priceScore < 0 || priceScore > 5) {
    return { error: "价格评分范围应为 0 到 5" };
  }
  if (!Number.isFinite(shippingFee) || shippingFee < 0) {
    return { error: "邮费必须是大于等于 0 的数字" };
  }

  return {
    platform,
    shopName,
    qualityScore,
    shippingFee,
    priceScore,
    mainProducts,
    note,
  };
}

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await req.json()) as StorePayload;
  const parsed = parsePayload(body);
  if ("error" in parsed) {
    return NextResponse.json({ message: parsed.error }, { status: 400 });
  }

  const db = await readDb();
  const store = db.stores.find((item) => item.id === id);
  if (!store) {
    return NextResponse.json({ message: "店铺不存在" }, { status: 404 });
  }

  const duplicate = db.stores.some(
    (item) =>
      item.id !== id &&
      item.platform.toLowerCase() === parsed.platform.toLowerCase() &&
      item.shopName.toLowerCase() === parsed.shopName.toLowerCase(),
  );
  if (duplicate) {
    return NextResponse.json({ message: "该平台下店铺已存在" }, { status: 400 });
  }

  const updated = normalizeStore({
    ...store,
    ...parsed,
    updatedAt: nowIso(),
  });
  const index = db.stores.findIndex((item) => item.id === id);
  db.stores[index] = updated;
  await writeDb(db);

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const db = await readDb();
  const index = db.stores.findIndex((item) => item.id === id);
  if (index === -1) {
    return NextResponse.json({ message: "店铺不存在" }, { status: 404 });
  }

  const [removed] = db.stores.splice(index, 1);
  await writeDb(db);
  return NextResponse.json(removed);
}
