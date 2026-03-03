import { NextResponse } from "next/server";
import { createId, nowIso, readDb, writeDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const db = await readDb();
  return NextResponse.json(db.types);
}

export async function POST(req: Request) {
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
  const exists = db.types.some(
    (item) =>
      item.primaryName.toLowerCase() === primaryName.toLowerCase() &&
      (item.secondaryName ?? "").toLowerCase() === secondaryName.toLowerCase(),
  );
  if (exists) {
    return NextResponse.json({ message: "该类型组合已存在" }, { status: 400 });
  }

  const now = nowIso();
  const created = {
    id: createId(),
    name,
    primaryName,
    secondaryName,
    createdAt: now,
    updatedAt: now,
  };

  db.types.push(created);
  await writeDb(db);

  return NextResponse.json(created, { status: 201 });
}
