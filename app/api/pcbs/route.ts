import { NextResponse } from "next/server";
import { createId, nowIso, readDb, writeDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const db = await readDb();
  return NextResponse.json(db.pcbs);
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    projectName?: string;
    name?: string;
    version?: string;
    boardQuantity?: number;
    note?: string;
  };

  const projectName = body.projectName?.trim() ?? "";
  const name = body.name?.trim() ?? "";
  const version = body.version?.trim() ?? "";
  const boardQuantity = Number(body.boardQuantity ?? 1);
  const note = body.note?.trim() ?? "";

  if (!projectName || !name) {
    return NextResponse.json({ message: "项目名称和 PCB 名称不能为空" }, { status: 400 });
  }

  if (!Number.isFinite(boardQuantity) || boardQuantity <= 0) {
    return NextResponse.json({ message: "项目使用 PCB 数量必须大于 0" }, { status: 400 });
  }

  const db = await readDb();
  const duplicate = db.pcbs.some(
    (item) =>
      item.projectName.toLowerCase() === projectName.toLowerCase() &&
      item.name.toLowerCase() === name.toLowerCase() &&
      item.version.toLowerCase() === version.toLowerCase(),
  );
  if (duplicate) {
    return NextResponse.json({ message: "该项目下同名同版本 PCB 已存在" }, { status: 400 });
  }

  const now = nowIso();
  const created = {
    id: createId(),
    projectName,
    name,
    version,
    boardQuantity,
    note,
    items: [],
    createdAt: now,
    updatedAt: now,
  };

  db.pcbs.push(created);
  await writeDb(db);
  return NextResponse.json(created, { status: 201 });
}
