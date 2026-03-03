import { NextResponse } from "next/server";
import { nowIso, readDb, writeDb } from "@/lib/db";

export const runtime = "nodejs";

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await req.json()) as { name?: string; note?: string };
  const name = body.name?.trim() ?? "";
  const note = body.note?.trim() ?? "";

  if (!name) {
    return NextResponse.json({ message: "项目名称不能为空" }, { status: 400 });
  }

  const db = await readDb();
  const project = db.projects.find((item) => item.id === id);
  if (!project) {
    return NextResponse.json({ message: "项目不存在" }, { status: 404 });
  }

  const duplicate = db.projects.some((item) => item.id !== id && item.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    return NextResponse.json({ message: "项目名称已存在" }, { status: 400 });
  }

  project.name = name;
  project.note = note;
  project.updatedAt = nowIso();
  await writeDb(db);
  return NextResponse.json(project);
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const db = await readDb();
  const index = db.projects.findIndex((item) => item.id === id);
  if (index === -1) {
    return NextResponse.json({ message: "项目不存在" }, { status: 404 });
  }

  const used = db.pcbs.some((item) => item.projectId === id);
  if (used) {
    return NextResponse.json({ message: "该项目下还有 PCB，无法删除" }, { status: 400 });
  }

  const [removed] = db.projects.splice(index, 1);
  await writeDb(db);
  return NextResponse.json(removed);
}
