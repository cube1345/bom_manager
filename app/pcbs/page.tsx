"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ComponentItem, ComponentType, PcbBomItem, PcbItem, ProjectItem } from "@/lib/types";
import { formatTime, requestJson } from "@/lib/http-client";

type ProjectForm = {
  name: string;
  note: string;
};

type PcbForm = {
  projectId: string;
  name: string;
  version: string;
  boardQuantity: string;
  note: string;
};

type PcbBomForm = {
  componentId: string;
  quantityPerBoard: string;
};

const initialProjectForm: ProjectForm = { name: "", note: "" };
const initialPcbForm: PcbForm = { projectId: "", name: "", version: "", boardQuantity: "1", note: "" };
const initialBomForm: PcbBomForm = { componentId: "", quantityPerBoard: "1" };

export default function PcbsPage() {
  const [types, setTypes] = useState<ComponentType[]>([]);
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [pcbs, setPcbs] = useState<PcbItem[]>([]);
  const [projectForm, setProjectForm] = useState<ProjectForm>(initialProjectForm);
  const [pcbForm, setPcbForm] = useState<PcbForm>(initialPcbForm);
  const [bomForm, setBomForm] = useState<PcbBomForm>(initialBomForm);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingPcbId, setEditingPcbId] = useState<string | null>(null);
  const [activePcb, setActivePcb] = useState<PcbItem | null>(null);
  const [editingBomId, setEditingBomId] = useState<string | null>(null);
  const [bomModalOpen, setBomModalOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState("all");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function loadData() {
    const [typesData, componentsData, projectsData, pcbsData] = await Promise.all([
      requestJson<ComponentType[]>("/api/types"),
      requestJson<ComponentItem[]>("/api/components"),
      requestJson<ProjectItem[]>("/api/projects"),
      requestJson<PcbItem[]>("/api/pcbs"),
    ]);
    setTypes(typesData);
    setComponents(componentsData);
    setProjects(projectsData);
    setPcbs(pcbsData);
    setPcbForm((prev) => ({ ...prev, projectId: prev.projectId || projectsData[0]?.id || "" }));
  }

  useEffect(() => {
    void Promise.all([
      requestJson<ComponentType[]>("/api/types"),
      requestJson<ComponentItem[]>("/api/components"),
      requestJson<ProjectItem[]>("/api/projects"),
      requestJson<PcbItem[]>("/api/pcbs"),
    ])
      .then(([typesData, componentsData, projectsData, pcbsData]) => {
        setTypes(typesData);
        setComponents(componentsData);
        setProjects(projectsData);
        setPcbs(pcbsData);
        setPcbForm((prev) => ({ ...prev, projectId: prev.projectId || projectsData[0]?.id || "" }));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "加载失败"));
  }, []);

  const typeMap = useMemo(() => new Map(types.map((item) => [item.id, item.name])), [types]);
  const componentMap = useMemo(() => new Map(components.map((item) => [item.id, item])), [components]);
  const projectMap = useMemo(() => new Map(projects.map((item) => [item.id, item])), [projects]);

  const filteredPcbs = useMemo(() => {
    if (projectFilter === "all") {
      return pcbs;
    }
    return pcbs.filter((item) => item.projectId === projectFilter);
  }, [pcbs, projectFilter]);

  const groupedByProject = useMemo(() => {
    return projects
      .map((project) => ({
        project,
        pcbs: filteredPcbs.filter((pcb) => pcb.projectId === project.id),
      }))
      .filter((entry) => entry.pcbs.length || projectFilter === "all" || entry.project.id === projectFilter);
  }, [filteredPcbs, projectFilter, projects]);

  const requirementSummary = useMemo(() => {
    const map = new Map<string, { componentId: string; totalRequired: number; pcbNames: Set<string> }>();
    for (const pcb of filteredPcbs) {
      const projectName = projectMap.get(pcb.projectId)?.name ?? "未知项目";
      const label = `${projectName}/${pcb.name}${pcb.version ? `(${pcb.version})` : ""}`;
      for (const item of pcb.items) {
        if (!map.has(item.componentId)) {
          map.set(item.componentId, { componentId: item.componentId, totalRequired: 0, pcbNames: new Set<string>() });
        }
        const row = map.get(item.componentId)!;
        row.totalRequired += item.quantityPerBoard * pcb.boardQuantity;
        row.pcbNames.add(label);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalRequired - a.totalRequired);
  }, [filteredPcbs, projectMap]);

  async function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInfo("");
    try {
      if (editingProjectId) {
        await requestJson(`/api/projects/${editingProjectId}`, {
          method: "PUT",
          body: JSON.stringify(projectForm),
        });
      } else {
        await requestJson("/api/projects", {
          method: "POST",
          body: JSON.stringify(projectForm),
        });
      }
      setEditingProjectId(null);
      setProjectForm(initialProjectForm);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存项目失败");
    }
  }

  async function removeProject(id: string) {
    if (!window.confirm("确认删除该项目？")) return;
    try {
      await requestJson(`/api/projects/${id}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除项目失败");
    }
  }

  async function submitPcb(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInfo("");
    try {
      const payload = { ...pcbForm, boardQuantity: Number(pcbForm.boardQuantity) };
      if (editingPcbId) {
        await requestJson(`/api/pcbs/${editingPcbId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await requestJson("/api/pcbs", { method: "POST", body: JSON.stringify(payload) });
      }
      setEditingPcbId(null);
      setPcbForm({ ...initialPcbForm, projectId: projects[0]?.id ?? "" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存 PCB 失败");
    }
  }

  async function removePcb(id: string) {
    if (!window.confirm("确认删除该 PCB 及其所有 BOM 明细？")) return;
    try {
      await requestJson(`/api/pcbs/${id}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除 PCB 失败");
    }
  }

  function startEditPcb(item: PcbItem) {
    setEditingPcbId(item.id);
    setPcbForm({
      projectId: item.projectId,
      name: item.name,
      version: item.version,
      boardQuantity: String(item.boardQuantity),
      note: item.note,
    });
  }

  function openNewBom(pcb: PcbItem) {
    setActivePcb(pcb);
    setEditingBomId(null);
    setBomForm({ componentId: components[0]?.id ?? "", quantityPerBoard: "1" });
    setBomModalOpen(true);
  }

  function openEditBom(pcb: PcbItem, item: PcbBomItem) {
    setActivePcb(pcb);
    setEditingBomId(item.id);
    setBomForm({ componentId: item.componentId, quantityPerBoard: String(item.quantityPerBoard) });
    setBomModalOpen(true);
  }

  async function submitBom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activePcb) return;
    try {
      const payload = { componentId: bomForm.componentId, quantityPerBoard: Number(bomForm.quantityPerBoard) };
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
    if (!window.confirm("确认删除该 BOM 明细？")) return;
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
          <h1>项目 / PCB 管理</h1>
          <p>一个项目可挂载多个 PCB，每个 PCB 都可独立维护 BOM 明细。</p>
        </div>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}
      {info ? <p className="info-banner">{info}</p> : null}

      <section className="grid-two">
        <article className="panel">
          <h2>{editingProjectId ? "编辑项目" : "新增项目"}</h2>
          <form className="stack-form" onSubmit={submitProject}>
            <input
              value={projectForm.name}
              onChange={(event) => setProjectForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="项目名称"
              required
            />
            <textarea
              value={projectForm.note}
              onChange={(event) => setProjectForm((prev) => ({ ...prev, note: event.target.value }))}
              placeholder="项目备注"
              rows={2}
            />
            <div className="inline-actions">
              <button type="submit" className="btn-primary">
                {editingProjectId ? "更新项目" : "创建项目"}
              </button>
              {editingProjectId ? (
                <button type="button" className="btn-ghost" onClick={() => {
                  setEditingProjectId(null);
                  setProjectForm(initialProjectForm);
                }}>
                  取消
                </button>
              ) : null}
            </div>
          </form>
        </article>

        <article className="panel">
          <h2>{editingPcbId ? "编辑 PCB" : "新增 PCB"}</h2>
          <form className="stack-form" onSubmit={submitPcb}>
            <select
              value={pcbForm.projectId}
              onChange={(event) => setPcbForm((prev) => ({ ...prev, projectId: event.target.value }))}
              required
            >
              <option value="">请选择项目</option>
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
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
              placeholder="该项目使用此 PCB 数量"
              required
            />
            <textarea
              value={pcbForm.note}
              onChange={(event) => setPcbForm((prev) => ({ ...prev, note: event.target.value }))}
              placeholder="PCB 备注"
              rows={2}
            />
            <div className="inline-actions">
              <button type="submit" className="btn-primary">
                {editingPcbId ? "更新 PCB" : "创建 PCB"}
              </button>
              {editingPcbId ? (
                <button type="button" className="btn-ghost" onClick={() => {
                  setEditingPcbId(null);
                  setPcbForm({ ...initialPcbForm, projectId: projects[0]?.id ?? "" });
                }}>
                  取消
                </button>
              ) : null}
            </div>
          </form>
        </article>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>项目筛选与需求统计</h2>
          <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
            <option value="all">全部项目</option>
            {projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
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
                <th>涉及 PCB</th>
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
                    <td>{Array.from(item.pcbNames).join("，") || "-"}</td>
                  </tr>
                );
              })}
              {!requirementSummary.length ? (
                <tr>
                  <td className="muted text-center" colSpan={4}>暂无统计数据</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>项目列表（下属 PCB 独立管理）</h2>
        <div className="component-list">
          {groupedByProject.map(({ project, pcbs: projectPcbs }) => (
            <article className="component-card" key={project.id}>
              <header>
                <div>
                  <h3>{project.name}</h3>
                  <p>{project.note || "无项目备注"}</p>
                </div>
                <div className="inline-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setEditingProjectId(project.id);
                      setProjectForm({ name: project.name, note: project.note });
                    }}
                  >
                    编辑项目
                  </button>
                  <button type="button" className="btn-danger" onClick={() => void removeProject(project.id)}>
                    删除项目
                  </button>
                </div>
              </header>

              <div className="component-list" style={{ marginTop: 10 }}>
                {projectPcbs.map((pcb) => (
                  <article className="type-item" key={pcb.id}>
                    <div>
                      <strong>
                        {pcb.name}
                        {pcb.version ? ` (${pcb.version})` : ""}
                      </strong>
                      <p>
                        项目数量 {pcb.boardQuantity} / BOM {pcb.items.length} / 更新时间 {formatTime(pcb.updatedAt)}
                      </p>
                    </div>
                    <div className="inline-actions">
                      <button type="button" className="btn-primary" onClick={() => openNewBom(pcb)}>
                        BOM明细
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => startEditPcb(pcb)}>
                        编辑PCB
                      </button>
                      <button type="button" className="btn-danger" onClick={() => void removePcb(pcb.id)}>
                        删除PCB
                      </button>
                    </div>
                  </article>
                ))}
                {!projectPcbs.length ? <p className="muted">该项目下暂无 PCB。</p> : null}
              </div>
            </article>
          ))}
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
                    {activePcb.items.map((item) => {
                      const component = componentMap.get(item.componentId);
                      return (
                        <tr key={item.id}>
                          <td>{component ? (typeMap.get(component.typeId) ?? "未知类型") : "未知类型"}</td>
                          <td>{component?.model ?? "未知元器件"}</td>
                          <td>{item.quantityPerBoard}</td>
                          <td>{item.quantityPerBoard * activePcb.boardQuantity}</td>
                          <td>
                            <div className="inline-actions">
                              <button type="button" className="btn-ghost" onClick={() => openEditBom(activePcb, item)}>
                                编辑
                              </button>
                              <button
                                type="button"
                                className="btn-danger"
                                onClick={() => void removeBom(activePcb.id, item.id)}
                              >
                                删除
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!activePcb.items.length ? (
                      <tr>
                        <td className="muted text-center" colSpan={5}>暂无 BOM 明细</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="inline-actions">
                <button type="submit" className="btn-primary">{editingBomId ? "保存明细" : "新增明细"}</button>
                <button type="button" className="btn-ghost" onClick={() => setBomModalOpen(false)}>关闭</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
