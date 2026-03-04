"use client";

import { ChangeEvent, FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";
import type { ComponentItem, ComponentType, PurchaseRecord, StoreReview } from "@/lib/types";
import { formatTime, requestJson } from "@/lib/http-client";
import { tr, useUiLang } from "@/lib/ui-language";

type ComponentForm = {
  typeId: string;
  model: string;
  auxInfo: string;
  note: string;
  warningThreshold: string;
};

type RecordForm = {
  storeId: string;
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
  storeId: "",
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

const importFieldKeys: ImportField[] = [
  "typeName",
  "model",
  "auxInfo",
  "note",
  "warningThreshold",
  "platform",
  "link",
  "quantity",
  "pricePerUnit",
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

  for (const key of importFieldKeys) {
    const aliases = fieldAliasMap[key].map((item) => normalizeHeaderKey(item));
    const found = headers.find((header) => {
      if (used.has(header)) {
        return false;
      }
      const normalized = normalizeHeaderKey(header);
      return aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized));
    });

    if (found) {
      mapping[key] = found;
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
    throw new Error("Please map at least the Type and Model columns");
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
  const lang = useUiLang();
  const t = (zh: string, en: string) => tr(lang, zh, en);
  const searchParams = useSearchParams();
  const [types, setTypes] = useState<ComponentType[]>([]);
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [stores, setStores] = useState<StoreReview[]>([]);
  const [componentForm, setComponentForm] = useState<ComponentForm>(initialComponentForm);
  const [recordForm, setRecordForm] = useState<RecordForm>(initialRecordForm);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [activeComponent, setActiveComponent] = useState<ComponentItem | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [newTypePrimaryName, setNewTypePrimaryName] = useState("");
  const [newTypeSecondaryName, setNewTypeSecondaryName] = useState("");
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
  const importFieldOptions = useMemo<Array<{ key: ImportField; label: string; required?: boolean }>>(
    () => [
      { key: "typeName", label: tr(lang, "类型", "Type"), required: true },
      { key: "model", label: tr(lang, "型号", "Model"), required: true },
      { key: "auxInfo", label: tr(lang, "辅助信息", "Aux Info") },
      { key: "note", label: tr(lang, "备注", "Note") },
      { key: "warningThreshold", label: tr(lang, "预警阈值", "Warning Threshold") },
      { key: "platform", label: tr(lang, "采购平台", "Platform") },
      { key: "link", label: tr(lang, "采购链接", "Link") },
      { key: "quantity", label: tr(lang, "采购数量", "Quantity") },
      { key: "pricePerUnit", label: tr(lang, "单价", "Unit Price") },
    ],
    [lang],
  );

  const typeMap = useMemo(() => new Map(types.map((item) => [item.id, item.name])), [types]);
  const storeMap = useMemo(() => new Map(stores.map((item) => [item.id, item])), [stores]);

  async function loadData() {
    setError("");
    const [typesData, componentsData, storesData] = await Promise.all([
      requestJson<ComponentType[]>("/api/types"),
      requestJson<ComponentItem[]>("/api/components"),
      requestJson<StoreReview[]>("/api/stores"),
    ]);

    setTypes(typesData);
    setComponents(componentsData);
    setStores(storesData);
    setComponentForm((prev) => ({
      ...prev,
      typeId: prev.typeId || typesData[0]?.id || "",
    }));
    setLoaded(true);
  }

  useEffect(() => {
    void loadData().catch((err) => {
      setError(err instanceof Error ? err.message : tr(lang, "加载失败", "Failed to load data"));
    });
  }, [lang]);

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
      setError(err instanceof Error ? err.message : t("保存元器件失败", "Failed to save component"));
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
        setError(tr(lang, "要编辑的元器件不存在", "The component to edit does not exist"));
      }
      setAppliedRouteKey(routeKey);
    }
  }, [appliedRouteKey, components, lang, loaded, searchParams, types]);

  async function createTypeInline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const primaryName = newTypePrimaryName.trim();
    const secondaryName = newTypeSecondaryName.trim();
    if (!primaryName) {
      return;
    }

    setError("");
    setInfo("");

    try {
      const created = await requestJson<ComponentType>("/api/types", {
        method: "POST",
        body: JSON.stringify({ primaryName, secondaryName }),
      });

      setNewTypePrimaryName("");
      setNewTypeSecondaryName("");
      await loadData();
      setComponentForm((prev) => ({ ...prev, typeId: created.id }));
      setInfo(t(`类型 "${created.name}" 已创建并写入 JSON`, `Type "${created.name}" created and written into JSON`));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("新增类型失败", "Failed to create type"));
    }
  }

  async function removeComponent(id: string) {
    if (!window.confirm(t("确认删除该元器件及其所有采购记录？", "Delete this component and all its purchase records?"))) {
      return;
    }

    try {
      await requestJson(`/api/components/${id}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("删除失败", "Failed to delete"));
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
      storeId: record.storeId ?? "",
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
        storeId: recordForm.storeId || undefined,
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
      setError(err instanceof Error ? err.message : t("保存采购记录失败", "Failed to save purchase record"));
    }
  }

  async function removeRecord(componentId: string, recordId: string) {
    if (!window.confirm(t("确认删除这条采购记录？", "Delete this purchase record?"))) {
      return;
    }

    try {
      await requestJson(`/api/components/${componentId}/records/${recordId}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("删除记录失败", "Failed to delete record"));
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
          throw new Error(t("导入文件中没有有效数据", "No valid data found in import file"));
        }

        setImportMode("json");
        setPendingJsonItems(items);
        setImportHeaders([]);
        setImportRows([]);
        setColumnMapping({ ...emptyMapping });
        setInfo(t(`已读取 JSON：${items.length} 条数据，点击“执行导入”即可入库`, `JSON loaded: ${items.length} rows. Click "Run Import" to proceed.`));
        return;
      }

      if (lower.endsWith(".csv") || lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        const parsed = lower.endsWith(".csv") ? parseCsvRows(await file.text()) : await parseExcelRows(file);
        if (!parsed.headers.length || !parsed.rows.length) {
          throw new Error(t("导入文件中没有可识别的数据行", "No recognizable rows found in import file"));
        }

        const detected = detectColumnMapping(parsed.headers);
        setImportMode("table");
        setPendingJsonItems([]);
        setImportHeaders(parsed.headers);
        setImportRows(parsed.rows);
        setColumnMapping(detected);
        setInfo(t(`已读取 ${file.name}：${parsed.rows.length} 行，已自动识别列名，可手动调整映射后导入`, `${file.name} loaded: ${parsed.rows.length} rows. Columns detected automatically; adjust mapping if needed.`));
        return;
      }

      throw new Error(t("仅支持 .json / .csv / .xlsx / .xls 文件", "Only .json / .csv / .xlsx / .xls files are supported"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("读取导入文件失败", "Failed to read import file"));
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
        throw new Error(t("没有可导入的数据，请检查列映射和内容", "No importable data found. Please check column mapping and content."));
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
        t(
          `导入完成：新增类型 ${result.summary.typesCreated}，新增元器件 ${result.summary.componentsCreated}，更新元器件 ${result.summary.componentsUpdated}，新增记录 ${result.summary.recordsAdded}`,
          `Import completed: +${result.summary.typesCreated} types, +${result.summary.componentsCreated} components, ${result.summary.componentsUpdated} components updated, +${result.summary.recordsAdded} records.`,
        ),
      );

      setImportMode("none");
      setImportFileName("");
      setPendingJsonItems([]);
      setImportHeaders([]);
      setImportRows([]);
      setColumnMapping({ ...emptyMapping });

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("导入失败", "Import failed"));
    }
  }

  return (
    <>
      <section className="hero-card">
        <div>
          <h1>{t("元器件管理", "Component Management")}</h1>
          <p>{t("执行元器件/采购记录 CRUD，并支持 JSON/CSV/Excel 批量导入。", "Manage components and purchase records with full CRUD and bulk import from JSON/CSV/Excel.")}</p>
        </div>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}
      {info ? <p className="info-banner">{info}</p> : null}

      <section className="grid-two">
        <article className="panel">
          <h2>{editingComponentId ? t("编辑元器件", "Edit Component") : t("新增元器件", "New Component")}</h2>
          <form className="stack-form" onSubmit={submitComponent}>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="component-type-id">
                  {t("类型：", "Type:")}
                </label>
                <span className="field-required" aria-hidden="true">
                  *
                </span>
              </div>
              <select
                id="component-type-id"
                value={componentForm.typeId}
                onChange={(event) => setComponentForm((prev) => ({ ...prev, typeId: event.target.value }))}
                required
              >
                <option value="">{t("请选择类型", "Select type")}</option>
                {types.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="component-model">
                  {t("型号：", "Model:")}
                </label>
                <span className="field-required" aria-hidden="true">
                  *
                </span>
              </div>
              <input
                id="component-model"
                value={componentForm.model}
                onChange={(event) => setComponentForm((prev) => ({ ...prev, model: event.target.value }))}
                placeholder={t("请输入型号", "Enter model")}
                required
              />
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="component-warning-threshold">
                  {t("库存预警阈值：", "Stock Warning Threshold:")}
                </label>
                <span className="field-required" aria-hidden="true">
                  *
                </span>
              </div>
              <input
                id="component-warning-threshold"
                type="number"
                min="0"
                step="1"
                value={componentForm.warningThreshold}
                onChange={(event) =>
                  setComponentForm((prev) => ({ ...prev, warningThreshold: event.target.value }))
                }
                placeholder={t("例如：50", "e.g. 50")}
                required
              />
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="component-aux-info">
                  {t("辅助信息：", "Aux Info:")}
                </label>
              </div>
              <textarea
                id="component-aux-info"
                value={componentForm.auxInfo}
                onChange={(event) => setComponentForm((prev) => ({ ...prev, auxInfo: event.target.value }))}
                placeholder={t("可填写规格参数", "Optional spec details")}
                rows={2}
              />
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="component-note">
                  {t("备注：", "Note:")}
                </label>
              </div>
              <textarea
                id="component-note"
                value={componentForm.note}
                onChange={(event) => setComponentForm((prev) => ({ ...prev, note: event.target.value }))}
                placeholder={t("可填写补充信息", "Optional additional notes")}
                rows={2}
              />
            </div>
            <div className="inline-actions">
              <button type="submit" className="btn-primary">
                {editingComponentId ? t("更新", "Update") : t("创建", "Create")}
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
                  {t("取消", "Cancel")}
                </button>
              ) : null}
            </div>
          </form>

          <hr className="split-line" />
          <h3>{t("快速新增类型", "Quick Create Type")}</h3>
          <form className="inline-create-form" onSubmit={createTypeInline}>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="quick-type-primary">
                  {t("一级类型：", "Primary Type:")}
                </label>
                <span className="field-required" aria-hidden="true">
                  *
                </span>
              </div>
              <input
                id="quick-type-primary"
                value={newTypePrimaryName}
                onChange={(event) => setNewTypePrimaryName(event.target.value)}
                placeholder={t("例如：连接器", "e.g. Connector")}
                required
              />
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="quick-type-secondary">
                  {t("二级类型：", "Secondary Type:")}
                </label>
              </div>
              <input
                id="quick-type-secondary"
                value={newTypeSecondaryName}
                onChange={(event) => setNewTypeSecondaryName(event.target.value)}
                placeholder={t("可选，例如：排针排母", "Optional, e.g. Header")}
              />
            </div>
            <button type="submit" className="btn-secondary">
              {t("新增类型", "Add Type")}
            </button>
          </form>
        </article>

        <article className="panel">
          <h2>{t("批量导入", "Bulk Import")}</h2>
          <p className="muted">{t("支持 `.json` / `.csv` / `.xlsx` / `.xls`，可自动识别并手动映射列名。", "Supports `.json` / `.csv` / `.xlsx` / `.xls` with automatic column detection and manual mapping.")}</p>
          <input type="file" accept=".json,.csv,.xlsx,.xls" onChange={handleImportFile} />

          {importMode !== "none" ? (
            <div className="stack-form" style={{ marginTop: 10 }}>
              <p className="muted">{t("当前文件：", "Current file: ")}{importFileName}</p>

              {importMode === "table" ? (
                <>
                  <h3>{t("列映射设置", "Column Mapping")}</h3>
                  <div className="record-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{t("导入字段", "Import Field")}</th>
                          <th>{t("映射列名", "Mapped Column")}</th>
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
                                <option value="">{t("不映射", "Do not map")}</option>
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
                  <p className="muted">{t(`预览：共 ${importRows.length} 行（仅显示前 5 行）`, `Preview: ${importRows.length} rows (first 5 shown)`)} </p>
                  <code className="code-block">
                    {JSON.stringify(importRows.slice(0, 5), null, 2)}
                  </code>
                </>
              ) : null}

              {importMode === "json" ? (
                <p className="muted">{t("JSON 待导入条数：", "JSON items pending: ")}{pendingJsonItems.length}</p>
              ) : null}

              <div className="inline-actions">
                <button type="button" className="btn-primary" onClick={() => void submitMappedImport()}>
                  {t("执行导入", "Run Import")}
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
                  {t("取消", "Cancel")}
                </button>
              </div>
            </div>
          ) : null}
        </article>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>{t("元器件与记录", "Components & Records")}</h2>
          <span>{lang === "en" ? `${components.length} components` : `${components.length} 个元器件`}</span>
        </div>

        <div className="component-list">
          {components.map((item) => (
            <article className="component-card" key={item.id}>
              <header>
                <div>
                  <h3>{item.model}</h3>
                  <p>{typeMap.get(item.typeId) ?? t("未知类型", "Unknown Type")}</p>
                </div>
                <div className="inline-actions">
                  <button type="button" className="btn-ghost" onClick={() => startEditComponent(item)}>
                    {t("编辑", "Edit")}
                  </button>
                  <button type="button" className="btn-danger" onClick={() => void removeComponent(item.id)}>
                    {t("删除", "Delete")}
                  </button>
                </div>
              </header>

              <div className="meta-grid">
                <div>
                  <span>{t("总数目", "Total Quantity")}</span>
                  <p>{item.totalQuantity}</p>
                </div>
                <div>
                  <span>{t("预警阈值", "Warning Threshold")}</span>
                  <p>{item.warningThreshold}</p>
                </div>
                <div>
                  <span>{t("最低价格", "Lowest Price")}</span>
                  <p>{item.lowestPrice === null ? "-" : `¥${item.lowestPrice.toFixed(2)}${lang === "en" ? "/unit" : "/个"}`}</p>
                </div>
                <div>
                  <span>{t("更新时间", "Updated At")}</span>
                  <p>{formatTime(item.updatedAt)}</p>
                </div>
              </div>

              <div className="record-head">
                <h4>{t("采购记录", "Purchase Records")} ({item.records.length})</h4>
                <button type="button" className="btn-primary" onClick={() => openNewRecord(item)}>
                  {t("新增记录", "Add Record")}
                </button>
              </div>

              <div className="record-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t("店铺", "Store")}</th>
                      <th>{t("平台", "Platform")}</th>
                      <th>{t("链接", "Link")}</th>
                      <th>{t("数目", "Quantity")}</th>
                      <th>{t("价格（元/个）", "Price (CNY/unit)")}</th>
                      <th>{t("购买时间", "Purchased At")}</th>
                      <th>{t("操作", "Action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.records.map((record) => (
                      <tr key={record.id}>
                        <td>
                          {record.storeId
                            ? `${storeMap.get(record.storeId)?.platform ?? t("未知平台", "Unknown Platform")}/${storeMap.get(record.storeId)?.shopName ?? t("未知店铺", "Unknown Store")}`
                            : "-"}
                        </td>
                        <td>{record.platform}</td>
                        <td>
                          <a href={record.link} target="_blank" rel="noreferrer">
                            {t("查看", "Open")}
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
                              {t("编辑", "Edit")}
                            </button>
                            <button
                              type="button"
                              className="btn-danger"
                              onClick={() => void removeRecord(item.id, record.id)}
                            >
                              {t("删除", "Delete")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!item.records.length ? (
                      <tr>
                        <td className="muted text-center" colSpan={7}>
                          {t("暂无采购记录", "No purchase records")}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </article>
          ))}

          {!components.length ? <p className="muted">{t("暂无元器件数据。", "No component data yet.")}</p> : null}
        </div>
      </section>

      {recordModalOpen && activeComponent ? (
        <div className="modal-overlay" role="presentation" onClick={() => setRecordModalOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3>{editingRecordId ? t("编辑采购记录", "Edit Purchase Record") : `${t("新增采购记录", "New Purchase Record")} - ${activeComponent.model}`}</h3>
            <form className="stack-form" onSubmit={submitRecord}>
              <div className="form-field">
                <div className="field-head">
                  <label className="field-label" htmlFor="record-store-id">
                    {t("关联店铺：", "Linked Store:")}
                  </label>
                </div>
                <select
                  id="record-store-id"
                  value={recordForm.storeId}
                  onChange={(event) => {
                    const selectedStoreId = event.target.value;
                    const selectedStore = selectedStoreId ? storeMap.get(selectedStoreId) : undefined;
                    setRecordForm((prev) => ({
                      ...prev,
                      storeId: selectedStoreId,
                      platform: selectedStore?.platform ?? prev.platform,
                      pricePerUnit: selectedStore ? String(selectedStore.referencePrice) : prev.pricePerUnit,
                    }));
                  }}
                >
                  <option value="">{t("不关联店铺", "No linked store")}</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.platform} / {store.shopName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <div className="field-head">
                  <label className="field-label" htmlFor="record-platform">
                    {t("购买平台：", "Purchase Platform:")}
                  </label>
                  <span className="field-required" aria-hidden="true">
                    *
                  </span>
                </div>
                <input
                  id="record-platform"
                  value={recordForm.platform}
                  onChange={(event) => setRecordForm((prev) => ({ ...prev, platform: event.target.value }))}
                  placeholder={t("例如：淘宝", "e.g. Taobao")}
                  required
                />
              </div>
              <div className="form-field">
                <div className="field-head">
                  <label className="field-label" htmlFor="record-link">
                    {t("购买链接：", "Purchase Link:")}
                  </label>
                  <span className="field-required" aria-hidden="true">
                    *
                  </span>
                </div>
                <input
                  id="record-link"
                  value={recordForm.link}
                  onChange={(event) => setRecordForm((prev) => ({ ...prev, link: event.target.value }))}
                  placeholder={t("请输入采购链接", "Enter purchase link")}
                  required
                />
              </div>
              <div className="form-field">
                <div className="field-head">
                  <label className="field-label" htmlFor="record-quantity">
                    {t("采购数量：", "Purchase Quantity:")}
                  </label>
                  <span className="field-required" aria-hidden="true">
                    *
                  </span>
                </div>
                <input
                  id="record-quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={recordForm.quantity}
                  onChange={(event) => setRecordForm((prev) => ({ ...prev, quantity: event.target.value }))}
                  placeholder={t("例如：100", "e.g. 100")}
                  required
                />
              </div>
              <div className="form-field">
                <div className="field-head">
                  <label className="field-label" htmlFor="record-price-per-unit">
                    {t("价格（元/个）：", "Price (CNY/unit):")}
                  </label>
                  <span className="field-required" aria-hidden="true">
                    *
                  </span>
                </div>
                <input
                  id="record-price-per-unit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={recordForm.pricePerUnit}
                  onChange={(event) => setRecordForm((prev) => ({ ...prev, pricePerUnit: event.target.value }))}
                  placeholder={t("例如：0.25", "e.g. 0.25")}
                  required
                />
              </div>
              {recordForm.storeId ? (
                <p className="muted">
                  {t("已根据店铺自动回填平台与参考价格，可手动调整。", "Platform and reference price have been auto-filled from the store and can be adjusted manually.")}
                </p>
              ) : null}
              <p className="muted">{t("购买时间按提交记录时自动生成。", "Purchase time is generated automatically on submit.")}</p>
              <div className="inline-actions">
                <button type="submit" className="btn-primary">
                  {editingRecordId ? t("保存", "Save") : t("新增", "Add")}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setRecordModalOpen(false)}>
                  {t("取消", "Cancel")}
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
  const lang = useUiLang();
  return (
    <Suspense fallback={<section className="panel muted">{tr(lang, "加载中...", "Loading...")}</section>}>
      <ManageComponentsPageInner />
    </Suspense>
  );
}
