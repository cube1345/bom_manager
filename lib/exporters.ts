import type { BomDatabase } from "./types";

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

export function serializeDbJson(db: BomDatabase) {
  return `${JSON.stringify(db, null, 2)}\n`;
}

export function renderExcelHtml(db: BomDatabase) {
  const typeMap = new Map(db.types.map((item) => [item.id, item.name]));
  const projectMap = new Map(db.projects.map((item) => [item.id, item.name]));

  const projectsTable = renderTable(
    "项目",
    ["项目 id", "项目名称", "备注", "创建时间", "更新时间"],
    db.projects.map((item) => [item.id, item.name, item.note, item.createdAt, item.updatedAt]),
  );

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

  const pcbTable = renderTable(
    "PCB",
    ["PCB id", "项目", "PCB 名称", "版本", "项目使用 PCB 数量", "备注", "创建时间", "更新时间"],
    db.pcbs.map((item) => [
      item.id,
      projectMap.get(item.projectId) ?? "未知项目",
      item.name,
      item.version,
      item.boardQuantity,
      item.note,
      item.createdAt,
      item.updatedAt,
    ]),
  );

  const pcbItemsTable = renderTable(
    "PCB BOM 明细",
    [
      "明细 id",
      "PCB id",
      "项目",
      "PCB 名称",
      "版本",
      "元器件 id",
      "元器件类型",
      "元器件型号",
      "单板需求",
      "项目总需求",
    ],
    db.pcbs.flatMap((pcb) =>
      pcb.items.map((item) => {
        const component = db.components.find((entry) => entry.id === item.componentId);
        return [
          item.id,
          pcb.id,
          projectMap.get(pcb.projectId) ?? "未知项目",
          pcb.name,
          pcb.version,
          item.componentId,
          component ? (typeMap.get(component.typeId) ?? "未知类型") : "未知类型",
          component?.model ?? "未知元器件",
          item.quantityPerBoard,
          item.quantityPerBoard * pcb.boardQuantity,
        ];
      }),
    ),
  );

  return `
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
        ${projectsTable}
        ${componentsTable}
        ${recordsTable}
        ${pcbTable}
        ${pcbItemsTable}
      </body>
    </html>
  `;
}

export function serializeDbExcel(db: BomDatabase) {
  return `\uFEFF${renderExcelHtml(db)}`;
}
