"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ComponentItem, ComponentType, PcbBomItem, PcbItem } from "@/lib/types";
import { formatTime, requestJson } from "@/lib/http-client";

type PcbForm = {
  projectName: string;
  name: string;
  version: string;
  boardQuantity: string;
  note: string;
};

type PcbBomForm = {
  componentId: string;
  quantityPerBoard: string;
};

const initialPcbForm: PcbForm = {
  projectName: "",
  name: "",
  version: "",
  boardQuantity: "1",
  note: "",
};

const initialBomForm: PcbBomForm = {
  componentId: "",
  quantityPerBoard: "1",
};

export default function PcbsPage() {
  const [types, setTypes] = useState<ComponentType[]>([]);
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [pcbs, setPcbs] = useState<PcbItem[]>([]);
  const [pcbForm, setPcbForm] = useState<PcbForm>(initialPcbForm);
  const [bomForm, setBomForm] = useState<PcbBomForm>(initialBomForm);
  const [editingPcbId, setEditingPcbId] = useState<string | null>(null);
  const [activePcb, setActivePcb] = useState<PcbItem | null>(null);
  const [editingBomId, setEditingBomId] = useState<string | null>(null);
  const [bomModalOpen, setBomModalOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState("all");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function loadData() {
    setError("");
    const [typesData, componentsData, pcbsData] = await Promise.all([
      requestJson<ComponentType[]>("/api/types"),
      requestJson<ComponentItem[]>("/api/components"),
      requestJson<PcbItem[]>("/api/pcbs"),
    ]);
    setTypes(typesData);
    setComponents(componentsData);
    setPcbs(pcbsData);
  }

  useEffect(() => {
    void Promise.all([
      requestJson<ComponentType[]>("/api/types"),
      requestJson<ComponentItem[]>("/api/components"),
      requestJson<PcbItem[]>("/api/pcbs"),
    ])
      .then(([typesData, componentsData, pcbsData]) => {
        setTypes(typesData);
        setComponents(componentsData);
        setPcbs(pcbsData);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "加载失败");
      });
  }, []);

  const typeMap = useMemo(() => new Map(types.map((item) => [item.id, item.name])), [types]);
  const componentMap = useMemo(() => new Map(components.map((item) => [item.id, item])), [components]);

  const projectOptions = useMemo(() => {
    const names = new Set(pcbs.map((item) => item.projectName).filter(Boolean));
    return Array.from(names).sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [pcbs]);

  const filteredPcbs = useMemo(() => {
    if (projectFilter === "all") {
      return pcbs;
    }
    return pcbs.filter((item) => item.projectName === projectFilter);
  }, [pcbs, projectFilter]);

  const requirementSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        componentId: string;
        totalRequired: number;
        pcbCount: number;
        pcbNames: Set<string>;
      }
    >();

    for (const pcb of filteredPcbs) {
      for (const item of pcb.items) {
        const required = item.quantityPerBoard * pcb.boardQuantity;
        const key = item.componentId;
        if (!map.has(key)) {
          map.set(key, {
            componentId: key,
            totalRequired: 0,
            pcbCount: 0,
            pcbNames: new Set<string>(),
          });
        }
        const row = map.get(key)!;
        row.totalRequired += required;
        if (!row.pcbNames.has(pcb.id)) {
          row.pcbNames.add(pcb.id);
          row.pcbCount += 1;
        }
      }
    }

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        pcbNames: Array.from(item.pcbNames)
          .map((id) => filteredPcbs.find((pcb) => pcb.id === id))
          .filter((item): item is PcbItem => Boolean(item))
          .map((pcb) => `${pcb.projectName}/${pcb.name}${pcb.version ? `(${pcb.version})` : ""}`),
      }))
      .sort((a, b) => b.totalRequired - a.totalRequired);
  }, [filteredPcbs]);

  async function submitPcb(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInfo("");

    try {
      const payload = {
        ...pcbForm,
        boardQuantity: Number(pcbForm.boardQuantity),
      };

      if (editingPcbId) {
        await requestJson(`/api/pcbs/${editingPcbId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await requestJson("/api/pcbs", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setEditingPcbId(null);
      setPcbForm(initialPcbForm);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存 PCB 失败");
    }
  }

  function startEditPcb(item: PcbItem) {
    setEditingPcbId(item.id);
    setPcbForm({
      projectName: item.projectName,
      name: item.name,
      version: item.version,
      boardQuantity: String(item.boardQuantity),
      note: item.note,
    });
  }

  async function removePcb(id: string) {
    if (!window.confirm("确认删除该 PCB 及其所有 BOM 明细？")) {
      return;
    }
    try {
      await requestJson(`/api/pcbs/${id}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除 PCB 失败");
    }
  }

  function openNewBom(pcb: PcbItem) {
    setActivePcb(pcb);
    setEditingBomId(null);
    setBomForm({
      componentId: components[0]?.id ?? "",
      quantityPerBoard: "1",
    });
    setBomModalOpen(true);
  }

  function openEditBom(pcb: PcbItem, item: PcbBomItem) {
    setActivePcb(pcb);
    setEditingBomId(item.id);
    setBomForm({
      componentId: item.componentId,
      quantityPerBoard: String(item.quantityPerBoard),
    });
    setBomModalOpen(true);
  }

  async function submitBom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activePcb) {
      return;
    }

    setError("");
    setInfo("");

    try {
      const payload = {
        componentId: bomForm.componentId,
        quantityPerBoard: Number(bomForm.quantityPerBoard),
      };

      if (editingBomId) {
        await requestJson(`/api/pcbs/${activePcb.id}/items/${editingBomId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await requestJson(`/api/pcbs/${activePcb.id}/items`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setBomModalOpen(false);
      setActivePcb(null);
      setEditingBomId(null);
      setBomForm(initialBomForm);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存 BOM 明细失败");
    }
  }

  async function removeBom(pcbId: string, itemId: string) {
    if (!window.confirm("确认删除该 BOM 明细？")) {
      return;
    }
    try {
      await requestJson(`/api/pcbs/${pcbId}/items/${itemId}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除 BOM 明细失败");
    }
  }

  return (
    <>
      <section className="hero-card">
        <div>
          <h1>PCB 管理</h1>
          <p>维护每个项目使用的 PCB，管理 BOM 明细并统计项目元器件需求。</p>
        </div>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}
      {info ? <p className="info-banner">{info}</p> : null}

      <section className="grid-two">
        <article className="panel">
          <h2>{editingPcbId ? "编辑 PCB" : "新增 PCB"}</h2>
          <form className="stack-form" onSubmit={submitPcb}>
            <input
              value={pcbForm.projectName}
              onChange={(event) => setPcbForm((prev) => ({ ...prev, projectName: event.target.value }))}
              placeholder="项目名称"
              required
            />
            <input
              value={pcbForm.name}
              onChange={(event) => setPcbForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="PCB 名称"
              required
            />
            <input
              value={pcbForm.version}
              onChange={(event) => setPcbForm((prev) => ({ ...prev, version: event.target.value }))}
              placeholder="版本号（可选）"
            />
            <input
              type="number"
              min="1"
              step="1"
              value={pcbForm.boardQuantity}
              onChange={(event) => setPcbForm((prev) => ({ ...prev, boardQuantity: event.target.value }))}
              placeholder="项目使用 PCB 数量"
              required
            />
            <textarea
              value={pcbForm.note}
              onChange={(event) => setPcbForm((prev) => ({ ...prev, note: event.target.value }))}
              placeholder="备注"
              rows={2}
            />
            <div className="inline-actions">
              <button type="submit" className="btn-primary">
                {editingPcbId ? "更新" : "创建"}
              </button>
              {editingPcbId ? (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setEditingPcbId(null);
                    setPcbForm(initialPcbForm);
                  }}
                >
                  取消
                </button>
              ) : null}
            </div>
          </form>
        </article>

        <article className="panel">
          <h2>项目元器件需求统计</h2>
          <div className="inline-actions">
            <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
              <option value="all">全部项目</option>
              {projectOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="record-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>类型</th>
                  <th>型号</th>
                  <th>总需求</th>
                  <th>涉及 PCB 数</th>
                  <th>PCB 列表</th>
                </tr>
              </thead>
              <tbody>
                {requirementSummary.map((item) => {
                  const component = componentMap.get(item.componentId);
                  return (
                    <tr key={item.componentId}>
                      <td>{component ? (typeMap.get(component.typeId) ?? "未知类型") : "未知类型"}</td>
                      <td>{component?.model ?? "未知元器件"}</td>
                      <td>{item.totalRequired}</td>
                      <td>{item.pcbCount}</td>
                      <td>{item.pcbNames.join("，") || "-"}</td>
                    </tr>
                  );
                })}
                {!requirementSummary.length ? (
                  <tr>
                    <td className="muted text-center" colSpan={5}>
                      暂无统计数据
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>PCB 列表</h2>
          <span>{filteredPcbs.length} 块 PCB</span>
        </div>

        <div className="component-list">
          {filteredPcbs.map((pcb) => {
            const requiredTotal = pcb.items.reduce(
              (sum, item) => sum + item.quantityPerBoard * pcb.boardQuantity,
              0,
            );
            return (
              <article className="component-card" key={pcb.id}>
                <header>
                  <div>
                    <h3>{pcb.name}</h3>
                    <p>
                      项目：{pcb.projectName}
                      {pcb.version ? ` / 版本：${pcb.version}` : ""}
                    </p>
                  </div>
                  <div className="inline-actions">
                    <button type="button" className="btn-ghost" onClick={() => startEditPcb(pcb)}>
                      编辑
                    </button>
                    <button type="button" className="btn-danger" onClick={() => void removePcb(pcb.id)}>
                      删除
                    </button>
                  </div>
                </header>

                <div className="meta-grid">
                  <div>
                    <span>项目 PCB 数量</span>
                    <p>{pcb.boardQuantity}</p>
                  </div>
                  <div>
                    <span>BOM 项数</span>
                    <p>{pcb.items.length}</p>
                  </div>
                  <div>
                    <span>总元器件需求</span>
                    <p>{requiredTotal}</p>
                  </div>
                  <div>
                    <span>备注</span>
                    <p>{pcb.note || "-"}</p>
                  </div>
                  <div>
                    <span>更新时间</span>
                    <p>{formatTime(pcb.updatedAt)}</p>
                  </div>
                </div>

                <div className="record-head">
                  <h4>PCB BOM 明细 ({pcb.items.length})</h4>
                  <button type="button" className="btn-primary" onClick={() => openNewBom(pcb)}>
                    新增明细
                  </button>
                </div>

                <div className="record-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>类型</th>
                        <th>型号</th>
                        <th>单板需求</th>
                        <th>项目总需求</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pcb.items.map((item) => {
                        const component = componentMap.get(item.componentId);
                        return (
                          <tr key={item.id}>
                            <td>{component ? (typeMap.get(component.typeId) ?? "未知类型") : "未知类型"}</td>
                            <td>{component?.model ?? "未知元器件"}</td>
                            <td>{item.quantityPerBoard}</td>
                            <td>{item.quantityPerBoard * pcb.boardQuantity}</td>
                            <td>
                              <div className="inline-actions">
                                <button type="button" className="btn-ghost" onClick={() => openEditBom(pcb, item)}>
                                  编辑
                                </button>
                                <button
                                  type="button"
                                  className="btn-danger"
                                  onClick={() => void removeBom(pcb.id, item.id)}
                                >
                                  删除
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {!pcb.items.length ? (
                        <tr>
                          <td className="muted text-center" colSpan={5}>
                            暂无 BOM 明细
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </article>
            );
          })}

          {!filteredPcbs.length ? <p className="muted">暂无 PCB 数据。</p> : null}
        </div>
      </section>

      {bomModalOpen && activePcb ? (
        <div className="modal-overlay" role="presentation" onClick={() => setBomModalOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3>{editingBomId ? "编辑 BOM 明细" : `新增 BOM 明细 - ${activePcb.name}`}</h3>
            <form className="stack-form" onSubmit={submitBom}>
              <select
                value={bomForm.componentId}
                onChange={(event) => setBomForm((prev) => ({ ...prev, componentId: event.target.value }))}
                required
              >
                <option value="">请选择元器件</option>
                {components.map((item) => (
                  <option key={item.id} value={item.id}>
                    {typeMap.get(item.typeId) ?? "未知类型"} / {item.model}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                step="1"
                value={bomForm.quantityPerBoard}
                onChange={(event) => setBomForm((prev) => ({ ...prev, quantityPerBoard: event.target.value }))}
                placeholder="单板需求数量"
                required
              />
              <p className="muted">项目总需求 = 单板需求数量 x 项目 PCB 数量。</p>
              <div className="inline-actions">
                <button type="submit" className="btn-primary">
                  {editingBomId ? "保存" : "新增"}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setBomModalOpen(false)}>
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
