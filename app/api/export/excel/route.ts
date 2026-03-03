import { NextResponse } from "next/server";
import { readDb } from "@/lib/db";
import { serializeDbExcel } from "@/lib/exporters";

export const runtime = "nodejs";

export async function GET() {
  const db = await readDb();
  const content = serializeDbExcel(db);

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bom-data.xls"',
    },
  });
}
