"use client";

import { ChangeEvent, FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";
import type { ComponentItem, ComponentType, PurchaseRecord } from "@/lib/types";
import { formatTime, requestJson } from "@/lib/http-client";

type ComponentForm = {
  typeId: string;
  model: string;
  auxInfo: string;
  note: string;
  warningThreshold: string;
};

type RecordForm = {
  platform: string;
  link: string;
  quantity: string;
  pricePerUnit: string;
};

type ImportRecord = {
  platform: string;
  link: string;
  quantity: number;
  pricePerUnit: number;
};

type ImportItem = {
  typeName: string;
  model: string;
  auxInfo?: string;
  note?: string;
  warningThreshold?: number;
  records?: ImportRecord[];
};

type ImportField =
  | "typeName"
  | "model"
  | "auxInfo"
  | "note"
  | "warningThreshold"
  | "platform"
  | "link"
  | "quantity"
  | "pricePerUnit";

type ColumnMapping = Record<ImportField, string>;

type ImportMode = "none" | "json" | "table";

const initialComponentForm: ComponentForm = {
  typeId: "",
  model: "",
  auxInfo: "",
  note: "",
  warningThreshold: "0",
};

const initialRecordForm: RecordForm = {
  platform: "",
  link: "",
  quantity: "",
  pricePerUnit: "",
};

const emptyMapping: ColumnMapping = {
  typeName: "",
  model: "",
  auxInfo: "",
  note: "",
  warningThreshold: "",
  platform: "",
  link: "",
  quantity: "",
  pricePerUnit: "",
};

const importFieldOptions: Array<{ key: ImportField; label: string; required?: boolean }> = [
  { key: "typeName", label: "类型", required: true },
  { key: "model", label: "型号", required: true },
  { key: "auxInfo", label: "辅助信息" },
  { key: "note", label: "备注" },
  { key: "warningThreshold", label: "预警阈值" },
  { key: "platform", label: "采购平台" },
  { key: "link", label: "采购链接" },
  { key: "quantity", label: "采购数量" },
  { key: "pricePerUnit", label: "单价" },
];

const fieldAliasMap: Record<ImportField, string[]> = {
  typeName: ["typename", "type", "类别", "类型", "元器件类型"],
  model: ["model", "型号", "料号", "partnumber", "pn"],
  auxInfo: ["auxinfo", "辅助信息", "参数", "规格"],
  note: ["note", "备注", "说明", "comment"],
  warningThreshold: ["warningthreshold", "预警", "阈值", "库存预警"],
  platform: ["platform", "平台", "采购平台", "vendor"],
  link: ["link", "url", "链接", "采购链接"],
  quantity: ["quantity", "qty", "数量", "数目", "采购数量"],
  pricePerUnit: ["priceperunit", "price", "单价", "价格", "price/unit"],
};

function csvSplitLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function normalizeHeaderKey(input: string) {
  return input.trim().toLowerCase().replace(/[\s_\-\/()\[\]]+/g, "");
}

function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { ...emptyMapping };
  const used = new Set<string>();

  for (const field of importFieldOptions) {
    const aliases = fieldAliasMap[field.key].map((item) => normalizeHeaderKey(item));
    const found = headers.find((header) => {
      if (used.has(header)) {
        return false;
      }
      const normalized = normalizeHeaderKey(header);
      return aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized));
    });

    if (found) {
      mapping[field.key] = found;
      used.add(found);
    }
  }

  return mapping;
}

function parseCsvRows(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { headers: [] as string[], rows: [] as Array<Record<string, string>> };
  }

  const headers = csvSplitLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = csvSplitLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });

  return { headers, rows };
}

async function parseExcelRows(file: File) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { headers: [] as string[], rows: [] as Array<Record<string, string>> };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  if (!matrix.length) {
    return { headers: [] as string[], rows: [] as Array<Record<string, string>> };
  }

  const headers = (matrix[0] ?? []).map((item) => String(item ?? "").trim()).filter(Boolean);
  const rows = matrix.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = String(cells[index] ?? "").trim();
    });
    return row;
  });

  return { headers, rows };
}

function buildImportItemsFromRows(rows: Array<Record<string, string>>, mapping: ColumnMapping): ImportItem[] {
  const typeHeader = mapping.typeName;
  const modelHeader = mapping.model;

  if (!typeHeader || !modelHeader) {
    throw new Error("请至少映射“类型”和“型号”列");
  }

  const grouped = new Map<string, ImportItem>();

  for (const row of rows) {
    const pick = (field: ImportField) => {
      const header = mapping[field];
      if (!header) {
        return "";
      }
      return (row[header] ?? "").trim();
    };

    const typeName = pick("typeName");
    const model = pick("model");
    if (!typeName || !model) {
      continue;
    }

    const key = `${typeName}::${model}`;
    const warningThresholdRaw = pick("warningThreshold");
    const warningThreshold = Number(warningThresholdRaw || 0);

    if (!grouped.has(key)) {
      grouped.set(key, {
        typeName,
        model,
        auxInfo: pick("auxInfo"),
        note: pick("note"),
        warningThreshold: Number.isFinite(warningThreshold) ? warningThreshold : 0,
        records: [],
      });
    }

    const platform = pick("platform");
    const link = pick("link");
    const quantity = Number(pick("quantity") || 0);
    const pricePerUnit = Number(pick("pricePerUnit") || -1);

    if (platform && link && quantity > 0 && pricePerUnit >= 0) {
      grouped.get(key)?.records?.push({
        platform,
        link,
        quantity,
        pricePerUnit,
      });
    }
  }

  return Array.from(grouped.values());
}

function ManageComponentsPageInner() {
  const searchParams = useSearchParams();
  const [types, setTypes] = useState<ComponentType[]>([]);
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [componentForm, setComponentForm] = useState<ComponentForm>(initialComponentForm);
  const [recordForm, setRecordForm] = useState<RecordForm>(initialRecordForm);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [activeComponent, setActiveComponent] = useState<ComponentItem | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [appliedRouteKey, setAppliedRouteKey] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [importMode, setImportMode] = useState<ImportMode>("none");
  const [importFileName, setImportFileName] = useState("");
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<Array<Record<string, string>>>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({ ...emptyMapping });
  const [pendingJsonItems, setPendingJsonItems] = useState<ImportItem[]>([]);

  const typeMap = useMemo(() => new Map(types.map((item) => [item.id, item.name])), [types]);

  async function loadData() {
    setError("");
    const [typesData, componentsData] = await Promise.all([
      requestJson<ComponentType[]>("/api/types"),
      requestJson<ComponentItem[]>("/api/components"),
    ]);

    setTypes(typesData);
    setComponents(componentsData);
    setComponentForm((prev) => ({
      ...prev,
      typeId: prev.typeId || typesData[0]?.id || "",
    }));
    setLoaded(true);
  }

  useEffect(() => {
    void loadData().catch((err) => {
      setError(err instanceof Error ? err.message : "加载失败");
    });
  }, []);

  async function submitComponent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInfo("");

    try {
      const payload = {
        ...componentForm,
        warningThreshold: Number(componentForm.warningThreshold || 0),
      };

      if (editingComponentId) {
        await requestJson(`/api/components/${editingComponentId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await requestJson("/api/components", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setEditingComponentId(null);
      setComponentForm({ ...initialComponentForm, typeId: types[0]?.id ?? "", warningThreshold: "0" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存元器件失败");
    }
  }

  function startEditComponent(item: ComponentItem) {
    setEditingComponentId(item.id);
    setComponentForm({
      typeId: item.typeId,
      model: item.model,
      auxInfo: item.auxInfo,
      note: item.note,
      warningThreshold: String(item.warningThreshold ?? 0),
    });
  }

  useEffect(() => {
    if (!loaded) {
      return;
    }

    const mode = searchParams.get("mode");
    const componentId = searchParams.get("componentId");
    const routeKey = `${mode ?? ""}:${componentId ?? ""}`;

    if (!routeKey || routeKey === ":" || routeKey === appliedRouteKey) {
      return;
    }

    if (mode === "new") {
      setEditingComponentId(null);
      setComponentForm({
        ...initialComponentForm,
        typeId: types[0]?.id ?? "",
        warningThreshold: "0",
      });
      setAppliedRouteKey(routeKey);
      return;
    }

    if (mode === "edit" && componentId) {
      const target = components.find((item) => item.id === componentId);
      if (target) {
        startEditComponent(target);
      } else {
        setError("要编辑的元器件不存在");
      }
      setAppliedRouteKey(routeKey);
    }
  }, [appliedRouteKey, components, loaded, searchParams, types]);

  async function createTypeInline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newTypeName.trim();
    if (!name) {
      return;
    }

    setError("");
    setInfo("");

    try {
      const created = await requestJson<ComponentType>("/api/types", {
        method: "POST",
        body: JSON.stringify({ name }),
      });

      setNewTypeName("");
      await loadData();
      setComponentForm((prev) => ({ ...prev, typeId: created.id }));
      setInfo(`类型 "${created.name}" 已创建并写入 JSON`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增类型失败");
    }
  }

  async function removeComponent(id: string) {
    if (!window.confirm("确认删除该元器件及其所有采购记录？")) {
      return;
    }

    try {
      await requestJson(`/api/components/${id}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  function openNewRecord(component: ComponentItem) {
    setActiveComponent(component);
    setEditingRecordId(null);
    setRecordForm(initialRecordForm);
    setRecordModalOpen(true);
  }

  function openEditRecord(component: ComponentItem, record: PurchaseRecord) {
    setActiveComponent(component);
    setEditingRecordId(record.id);
    setRecordForm({
      platform: record.platform,
      link: record.link,
      quantity: String(record.quantity),
      pricePerUnit: String(record.pricePerUnit),
    });
    setRecordModalOpen(true);
  }

  async function submitRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeComponent) {
      return;
    }

    setError("");
    setInfo("");

    try {
      const payload = {
        platform: recordForm.platform,
        link: recordForm.link,
        quantity: Number(recordForm.quantity),
        pricePerUnit: Number(recordForm.pricePerUnit),
      };

      if (editingRecordId) {
        await requestJson(`/api/components/${activeComponent.id}/records/${editingRecordId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await requestJson(`/api/components/${activeComponent.id}/records`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setRecordModalOpen(false);
      setActiveComponent(null);
      setEditingRecordId(null);
      setRecordForm(initialRecordForm);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存采购记录失败");
    }
  }

  async function removeRecord(componentId: string, recordId: string) {
    if (!window.confirm("确认删除这条采购记录？")) {
      return;
    }

    try {
      await requestJson(`/api/components/${componentId}/records/${recordId}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除记录失败");
    }
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError("");
    setInfo("");

    try {
      const lower = file.name.toLowerCase();
      setImportFileName(file.name);

      if (lower.endsWith(".json")) {
        const content = await file.text();
        const parsed = JSON.parse(content) as { items?: ImportItem[] } | ImportItem[];
        const items = Array.isArray(parsed) ? parsed : parsed.items ?? [];
        if (!items.length) {
          throw new Error("导入文件中没有有效数据");
        }

        setImportMode("json");
        setPendingJsonItems(items);
        setImportHeaders([]);
        setImportRows([]);
        setColumnMapping({ ...emptyMapping });
        setInfo(`已读取 JSON：${items.length} 条数据，点击“执行导入”即可入库`);
        return;
      }

      if (lower.endsWith(".csv") || lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        const parsed = lower.endsWith(".csv") ? parseCsvRows(await file.text()) : await parseExcelRows(file);
        if (!parsed.headers.length || !parsed.rows.length) {
          throw new Error("导入文件中没有可识别的数据行");
        }

        const detected = detectColumnMapping(parsed.headers);
        setImportMode("table");
        setPendingJsonItems([]);
        setImportHeaders(parsed.headers);
        setImportRows(parsed.rows);
        setColumnMapping(detected);
        setInfo(`已读取 ${file.name}：${parsed.rows.length} 行，已自动识别列名，可手动调整映射后导入`);
        return;
      }

      throw new Error("仅支持 .json / .csv / .xlsx / .xls 文件");
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取导入文件失败");
      setImportMode("none");
    } finally {
      event.target.value = "";
    }
  }

  async function submitMappedImport() {
    setError("");
    setInfo("");

    try {
      let items: ImportItem[] = [];
      if (importMode === "json") {
        items = pendingJsonItems;
      } else if (importMode === "table") {
        items = buildImportItemsFromRows(importRows, columnMapping);
      }

      if (!items.length) {
        throw new Error("没有可导入的数据，请检查列映射和内容");
      }

      const result = await requestJson<{
        summary: {
          typesCreated: number;
          componentsCreated: number;
          componentsUpdated: number;
          recordsAdded: number;
        };
      }>("/api/import/components", {
        method: "POST",
        body: JSON.stringify({ items }),
      });

      setInfo(
        `导入完成：新增类型 ${result.summary.typesCreated}，新增元器件 ${result.summary.componentsCreated}，更新元器件 ${result.summary.componentsUpdated}，新增记录 ${result.summary.recordsAdded}`,
      );

      setImportMode("none");
      setImportFileName("");
      setPendingJsonItems([]);
      setImportHeaders([]);
      setImportRows([]);
      setColumnMapping({ ...emptyMapping });

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入失败");
    }
  }

  return (
    <>
      <section className="hero-card">
        <div>
          <h1>元器件管理</h1>
          <p>执行元器件/采购记录 CRUD，并支持 JSON/CSV/Excel 批量导入。</p>
        </div>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}
      {info ? <p className="info-banner">{info}</p> : null}

      <section className="grid-two">
        <article className="panel">
          <h2>{editingComponentId ? "编辑元器件" : "新增元器件"}</h2>
          <form className="stack-form" onSubmit={submitComponent}>
            <select
              value={componentForm.typeId}
              onChange={(event) => setComponentForm((prev) => ({ ...prev, typeId: event.target.value }))}
              required
            >
              <option value="">请选择类型</option>
              {types.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <input
              value={componentForm.model}
              onChange={(event) => setComponentForm((prev) => ({ ...prev, model: event.target.value }))}
              placeholder="型号"
              required
            />
            <input
              type="number"
              min="0"
              step="1"
              value={componentForm.warningThreshold}
              onChange={(event) =>
                setComponentForm((prev) => ({ ...prev, warningThreshold: event.target.value }))
              }
              placeholder="库存预警阈值"
              required
            />
            <textarea
              value={componentForm.auxInfo}
              onChange={(event) => setComponentForm((prev) => ({ ...prev, auxInfo: event.target.value }))}
              placeholder="辅助信息"
              rows={2}
            />
            <textarea
              value={componentForm.note}
              onChange={(event) => setComponentForm((prev) => ({ ...prev, note: event.target.value }))}
              placeholder="备注"
              rows={2}
            />
            <div className="inline-actions">
              <button type="submit" className="btn-primary">
                {editingComponentId ? "更新" : "创建"}
              </button>
              {editingComponentId ? (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setEditingComponentId(null);
                    setComponentForm({ ...initialComponentForm, typeId: types[0]?.id ?? "" });
                  }}
                >
                  取消
                </button>
              ) : null}
            </div>
          </form>

          <hr className="split-line" />
          <h3>快速新增类型</h3>
          <form className="inline-create-form" onSubmit={createTypeInline}>
            <input
              value={newTypeName}
              onChange={(event) => setNewTypeName(event.target.value)}
              placeholder="输入新类型名称，例如：连接器"
              required
            />
            <button type="submit" className="btn-secondary">
              新增类型
            </button>
          </form>
        </article>

        <article className="panel">
          <h2>批量导入</h2>
          <p className="muted">支持 `.json` / `.csv` / `.xlsx` / `.xls`，可自动识别并手动映射列名。</p>
          <input type="file" accept=".json,.csv,.xlsx,.xls" onChange={handleImportFile} />

          {importMode !== "none" ? (
            <div className="stack-form" style={{ marginTop: 10 }}>
              <p className="muted">当前文件：{importFileName}</p>

              {importMode === "table" ? (
                <>
                  <h3>列映射设置</h3>
                  <div className="record-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>导入字段</th>
                          <th>映射列名</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importFieldOptions.map((field) => (
                          <tr key={field.key}>
                            <td>
                              {field.label}
                              {field.required ? " *" : ""}
                            </td>
                            <td>
                              <select
                                value={columnMapping[field.key]}
                                onChange={(event) =>
                                  setColumnMapping((prev) => ({
                                    ...prev,
                                    [field.key]: event.target.value,
                                  }))
                                }
                              >
                                <option value="">不映射</option>
                                {importHeaders.map((header) => (
                                  <option key={`${field.key}-${header}`} value={header}>
                                    {header}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="muted">预览：共 {importRows.length} 行（仅显示前 5 行）</p>
                  <code className="code-block">
                    {JSON.stringify(importRows.slice(0, 5), null, 2)}
                  </code>
                </>
              ) : null}

              {importMode === "json" ? (
                <p className="muted">JSON 待导入条数：{pendingJsonItems.length}</p>
              ) : null}

              <div className="inline-actions">
                <button type="button" className="btn-primary" onClick={() => void submitMappedImport()}>
                  执行导入
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setImportMode("none");
                    setImportFileName("");
                    setPendingJsonItems([]);
                    setImportHeaders([]);
                    setImportRows([]);
                    setColumnMapping({ ...emptyMapping });
                  }}
                >
                  取消
                </button>
              </div>
            </div>
          ) : null}
        </article>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>元器件与记录</h2>
          <span>{components.length} 个元器件</span>
        </div>

        <div className="component-list">
          {components.map((item) => (
            <article className="component-card" key={item.id}>
              <header>
                <div>
                  <h3>{item.model}</h3>
                  <p>{typeMap.get(item.typeId) ?? "未知类型"}</p>
                </div>
                <div className="inline-actions">
                  <button type="button" className="btn-ghost" onClick={() => startEditComponent(item)}>
                    编辑
                  </button>
                  <button type="button" className="btn-danger" onClick={() => void removeComponent(item.id)}>
                    删除
                  </button>
                </div>
              </header>

              <div className="meta-grid">
                <div>
                  <span>总数目</span>
                  <p>{item.totalQuantity}</p>
                </div>
                <div>
                  <span>预警阈值</span>
                  <p>{item.warningThreshold}</p>
                </div>
                <div>
                  <span>最低价格</span>
                  <p>{item.lowestPrice === null ? "-" : `¥${item.lowestPrice.toFixed(2)}/个`}</p>
                </div>
                <div>
                  <span>更新时间</span>
                  <p>{formatTime(item.updatedAt)}</p>
                </div>
              </div>

              <div className="record-head">
                <h4>采购记录 ({item.records.length})</h4>
                <button type="button" className="btn-primary" onClick={() => openNewRecord(item)}>
                  新增记录
                </button>
              </div>

              <div className="record-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>平台</th>
                      <th>链接</th>
                      <th>数目</th>
                      <th>价格（元/个）</th>
                      <th>购买时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.records.map((record) => (
                      <tr key={record.id}>
                        <td>{record.platform}</td>
                        <td>
                          <a href={record.link} target="_blank" rel="noreferrer">
                            查看
                          </a>
                        </td>
                        <td>{record.quantity}</td>
                        <td>{record.pricePerUnit.toFixed(2)}</td>
                        <td>{formatTime(record.purchasedAt)}</td>
                        <td>
                          <div className="inline-actions">
                            <button
                              type="button"
                              className="btn-ghost"
                              onClick={() => openEditRecord(item, record)}
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              className="btn-danger"
                              onClick={() => void removeRecord(item.id, record.id)}
                            >
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!item.records.length ? (
                      <tr>
                        <td className="muted text-center" colSpan={6}>
                          暂无采购记录
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </article>
          ))}

          {!components.length ? <p className="muted">暂无元器件数据。</p> : null}
        </div>
      </section>

      {recordModalOpen && activeComponent ? (
        <div className="modal-overlay" role="presentation" onClick={() => setRecordModalOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3>{editingRecordId ? "编辑采购记录" : `新增采购记录 - ${activeComponent.model}`}</h3>
            <form className="stack-form" onSubmit={submitRecord}>
              <input
                value={recordForm.platform}
                onChange={(event) => setRecordForm((prev) => ({ ...prev, platform: event.target.value }))}
                placeholder="购买平台"
                required
              />
              <input
                value={recordForm.link}
                onChange={(event) => setRecordForm((prev) => ({ ...prev, link: event.target.value }))}
                placeholder="购买链接"
                required
              />
              <input
                type="number"
                min="1"
                step="1"
                value={recordForm.quantity}
                onChange={(event) => setRecordForm((prev) => ({ ...prev, quantity: event.target.value }))}
                placeholder="数目"
                required
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={recordForm.pricePerUnit}
                onChange={(event) => setRecordForm((prev) => ({ ...prev, pricePerUnit: event.target.value }))}
                placeholder="价格（元/个）"
                required
              />
              <p className="muted">购买时间按提交记录时自动生成。</p>
              <div className="inline-actions">
                <button type="submit" className="btn-primary">
                  {editingRecordId ? "保存" : "新增"}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setRecordModalOpen(false)}>
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function ManageComponentsPage() {
  return (
    <Suspense fallback={<section className="panel muted">加载中...</section>}>
      <ManageComponentsPageInner />
    </Suspense>
  );
}
