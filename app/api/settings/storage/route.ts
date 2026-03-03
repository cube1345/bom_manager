import { NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/db";
import { getStorageConfig, setStorageDir } from "@/lib/storage-config";

export const runtime = "nodejs";

export async function GET() {
  const config = await getStorageConfig();
  return NextResponse.json(config);
}

export async function POST(req: Request) {
  const body = (await req.json()) as { dataDir?: string };
  const dataDir = body.dataDir?.trim() ?? "";
  if (!dataDir) {
    return NextResponse.json({ message: "存储路径不能为空" }, { status: 400 });
  }

  // Capture current data from existing location, then switch path and persist.
  const db = await readDb();
  const changedTo = await setStorageDir(dataDir);
  await writeDb(db);

  return NextResponse.json({
    message: "存储路径已更新，后续将自动保存到新目录",
    dataDir: changedTo,
  });
}
