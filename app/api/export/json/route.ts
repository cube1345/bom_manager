import { NextResponse } from "next/server";
import { readDb } from "@/lib/db";
import { serializeDbJson } from "@/lib/exporters";

export const runtime = "nodejs";

export async function GET() {
  const db = await readDb();
  const payload = serializeDbJson(db);

  return new NextResponse(payload, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bom-data.json"',
    },
  });
}
