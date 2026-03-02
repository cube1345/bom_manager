"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
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

function parseCsvToImportItems(text: string): ImportItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = csvSplitLine(lines[0]);
  const required = ["typeName", "model"];
  for (const key of required) {
    if (!headers.includes(key)) {
      throw new Error(`CSV 缺少必填列: ${key}`);
    }
  }

  const getIndex = (name: string) => headers.findIndex((item) => item === name);
  const grouped = new Map<string, ImportItem>();

  for (let i = 1; i < lines.length; i += 1) {
    const values = csvSplitLine(lines[i]);
    const pick = (name: string) => {
      const index = getIndex(name);
      return index >= 0 ? values[index] ?? "" : "";
    };

    const typeName = pick("typeName");
    const model = pick("model");
    if (!typeName || !model) {
      continue;
    }

    const key = `${typeName}::${model}`;
    const warningThreshold = Number(pick("warningThreshold") || 0);

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

export default function ManageComponentsPage() {
  const [types, setTypes] = useState<ComponentType[]>([]);
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [componentForm, setComponentForm] = useState<ComponentForm>(initialComponentForm);
  const [recordForm, setRecordForm] = useState<RecordForm>(initialRecordForm);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [activeComponent, setActiveComponent] = useState<ComponentItem | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

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
      const content = await file.text();
      let items: ImportItem[] = [];

      if (file.name.endsWith(".json")) {
        const parsed = JSON.parse(content) as { items?: ImportItem[] } | ImportItem[];
        items = Array.isArray(parsed) ? parsed : parsed.items ?? [];
      } else if (file.name.endsWith(".csv")) {
        items = parseCsvToImportItems(content);
      } else {
        throw new Error("仅支持 .json 或 .csv 文件");
      }

      if (!items.length) {
        throw new Error("导入文件中没有有效数据");
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

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入失败");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <>
      <section className="hero-card">
        <div>
          <h1>元器件管理</h1>
          <p>执行元器件/采购记录 CRUD，并支持 JSON/CSV 批量导入。</p>
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
        </article>

        <article className="panel">
          <h2>批量导入</h2>
          <p className="muted">支持 `.json` 或 `.csv` 文件。CSV 头部示例：</p>
          <code className="code-block">
            typeName,model,auxInfo,note,warningThreshold,platform,link,quantity,pricePerUnit
          </code>
          <input type="file" accept=".json,.csv" onChange={handleImportFile} />
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
