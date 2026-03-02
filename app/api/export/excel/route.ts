import { NextResponse } from "next/server";
import { readDb } from "@/lib/db";

export const runtime = "nodejs";

function escapeHtml(value: string | number | null) {
  if (value === null) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderTable(title: string, headers: string[], rows: Array<Array<string | number | null>>) {
  const header = headers.map((item) => `<th>${escapeHtml(item)}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");

  return `
    <h2>${escapeHtml(title)}</h2>
    <table>
      <thead><tr>${header}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

export async function GET() {
  const db = await readDb();
  const typeMap = new Map(db.types.map((item) => [item.id, item.name]));

  const typesTable = renderTable(
    "类型",
    ["id", "类型名称", "创建时间", "更新时间"],
    db.types.map((item) => [item.id, item.name, item.createdAt, item.updatedAt]),
  );

  const componentsTable = renderTable(
    "元器件",
    ["id", "类型", "型号", "辅助信息", "备注", "总数目", "预警阈值", "库存预警", "最低价格(元/个)", "创建时间", "更新时间"],
    db.components.map((item) => [
      item.id,
      typeMap.get(item.typeId) ?? "未知类型",
      item.model,
      item.auxInfo,
      item.note,
      item.totalQuantity,
      item.warningThreshold,
      item.warningThreshold > 0 && item.totalQuantity <= item.warningThreshold ? "是" : "否",
      item.lowestPrice,
      item.createdAt,
      item.updatedAt,
    ]),
  );

  const recordsTable = renderTable(
    "采购记录",
    ["记录id", "元器件id", "型号", "类型", "购买平台", "购买链接", "数目", "价格(元/个)", "购买时间"],
    db.components.flatMap((component) =>
      component.records.map((record) => [
        record.id,
        component.id,
        component.model,
        typeMap.get(component.typeId) ?? "未知类型",
        record.platform,
        record.link,
        record.quantity,
        record.pricePerUnit,
        record.purchasedAt,
      ]),
    ),
  );

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: "Microsoft YaHei", sans-serif; }
          h2 { margin-top: 20px; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 14px; }
          th, td { border: 1px solid #ccd4e4; padding: 6px 8px; font-size: 12px; }
          th { background: #edf2ff; }
        </style>
      </head>
      <body>
        ${typesTable}
        ${componentsTable}
        ${recordsTable}
      </body>
    </html>
  `;

  const content = `\uFEFF${html}`;

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bom-data.xls"',
    },
  });
}
