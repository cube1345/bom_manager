import { NextResponse } from "next/server";
import { nowIso, readDb, writeDb } from "@/lib/db";

export const runtime = "nodejs";

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await req.json()) as {
    projectId?: string;
    name?: string;
    version?: string;
    boardQuantity?: number;
    note?: string;
  };

  const projectId = body.projectId?.trim() ?? "";
  const name = body.name?.trim() ?? "";
  const version = body.version?.trim() ?? "";
  const boardQuantity = Number(body.boardQuantity ?? 1);
  const note = body.note?.trim() ?? "";

  if (!projectId || !name) {
    return NextResponse.json({ message: "项目和 PCB 名称不能为空" }, { status: 400 });
  }

  if (!Number.isFinite(boardQuantity) || boardQuantity <= 0) {
    return NextResponse.json({ message: "项目使用 PCB 数量必须大于 0" }, { status: 400 });
  }

  const db = await readDb();
  const pcb = db.pcbs.find((item) => item.id === id);
  if (!pcb) {
    return NextResponse.json({ message: "PCB 不存在" }, { status: 404 });
  }

  const projectExists = db.projects.some((item) => item.id === projectId);
  if (!projectExists) {
    return NextResponse.json({ message: "项目不存在" }, { status: 400 });
  }

  const duplicate = db.pcbs.some(
    (item) =>
      item.id !== id &&
      item.projectId === projectId &&
      item.name.toLowerCase() === name.toLowerCase() &&
      item.version.toLowerCase() === version.toLowerCase(),
  );
  if (duplicate) {
    return NextResponse.json({ message: "该项目下同名同版本 PCB 已存在" }, { status: 400 });
  }

  pcb.projectId = projectId;
  pcb.name = name;
  pcb.version = version;
  pcb.boardQuantity = boardQuantity;
  pcb.note = note;
  pcb.updatedAt = nowIso();

  await writeDb(db);
  return NextResponse.json(pcb);
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const db = await readDb();
  const index = db.pcbs.findIndex((item) => item.id === id);
  if (index === -1) {
    return NextResponse.json({ message: "PCB 不存在" }, { status: 404 });
  }

  const [removed] = db.pcbs.splice(index, 1);
  await writeDb(db);
  return NextResponse.json(removed);
}
