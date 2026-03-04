"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ComponentItem, ComponentType, PcbBomItem, PcbItem, ProjectItem } from "@/lib/types";
import { formatTime, requestJson } from "@/lib/http-client";
import { useUiLang } from "@/lib/ui-language";

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
  const lang = useUiLang();
  const sortLocale = lang === "en" ? "en-US" : "zh-Hans-CN";
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
  const text =
    lang === "en"
      ? {
          loadError: "Failed to load data",
          unknownProject: "Unknown Project",
          saveProjectError: "Failed to save project",
          deleteProjectConfirm: "Delete this project?",
          deleteProjectError: "Failed to delete project",
          savePcbError: "Failed to save PCB",
          deletePcbConfirm: "Delete this PCB and all BOM items?",
          deletePcbError: "Failed to delete PCB",
          saveBomError: "Failed to save BOM item",
          deleteBomConfirm: "Delete this BOM item?",
          deleteBomError: "Failed to delete BOM item",
          pageTitle: "Project / PCB Management",
          pageSubtitle: "Each project can contain multiple PCBs, and each PCB maintains an independent BOM.",
          editProject: "Edit Project",
          addProject: "New Project",
          projectName: "Project Name:",
          projectNamePlaceholder: "e.g. Thermal Controller Mainboard",
          projectNote: "Project Note:",
          projectNotePlaceholder: "Project description",
          updateProject: "Update Project",
          createProject: "Create Project",
          cancel: "Cancel",
          editPcb: "Edit PCB",
          addPcb: "New PCB",
          targetProject: "Project:",
          selectProject: "Select project",
          pcbName: "PCB Name:",
          pcbNamePlaceholder: "e.g. Main Control Board",
          version: "Version:",
          versionPlaceholder: "Optional, e.g. v1.2",
          boardQuantity: "Board Quantity in Project:",
          boardQuantityPlaceholder: "e.g. 10",
          pcbNote: "PCB Note:",
          pcbNotePlaceholder: "Version differences or notes",
          updatePcb: "Update PCB",
          createPcb: "Create PCB",
          summaryTitle: "Project Filter & Demand Summary",
          allProjects: "All Projects",
          colType: "Type",
          colModel: "Model",
          colTotalDemand: "Total Demand",
          colRelatedPcb: "Related PCB",
          unknownType: "Unknown Type",
          unknownComponent: "Unknown Component",
          noSummary: "No summary data",
          listTitle: "Project List (with Independent PCB Management)",
          noProjectNote: "No project note",
          editProjectBtn: "Edit Project",
          deleteProjectBtn: "Delete Project",
          pcbSummaryPrefix: "Project Qty",
          pcbSummaryMid: "BOM",
          updatedAt: "Updated",
          bomDetail: "BOM Details",
          editPcbBtn: "Edit PCB",
          deletePcbBtn: "Delete PCB",
          noPcb: "No PCB under this project.",
          editBom: "Edit BOM Item",
          addBom: "New BOM Item",
          component: "Component:",
          selectComponent: "Select component",
          qtyPerBoard: "Qty per Board:",
          qtyPerBoardPlaceholder: "e.g. 2",
          colPerBoard: "Qty per Board",
          colProjectTotal: "Project Total",
          colAction: "Action",
          edit: "Edit",
          delete: "Delete",
          noBom: "No BOM items",
          saveBom: "Save Item",
          addBomBtn: "Add Item",
          close: "Close",
        }
      : {
          loadError: "加载失败",
          unknownProject: "未知项目",
          saveProjectError: "保存项目失败",
          deleteProjectConfirm: "确认删除该项目？",
          deleteProjectError: "删除项目失败",
          savePcbError: "保存 PCB 失败",
          deletePcbConfirm: "确认删除该 PCB 及其所有 BOM 明细？",
          deletePcbError: "删除 PCB 失败",
          saveBomError: "保存 BOM 明细失败",
          deleteBomConfirm: "确认删除该 BOM 明细？",
          deleteBomError: "删除 BOM 明细失败",
          pageTitle: "项目 / PCB 管理",
          pageSubtitle: "一个项目可挂载多个 PCB，每个 PCB 都可独立维护 BOM 明细。",
          editProject: "编辑项目",
          addProject: "新增项目",
          projectName: "项目名称：",
          projectNamePlaceholder: "例如：温控主板项目",
          projectNote: "项目备注：",
          projectNotePlaceholder: "可填写项目说明",
          updateProject: "更新项目",
          createProject: "创建项目",
          cancel: "取消",
          editPcb: "编辑 PCB",
          addPcb: "新增 PCB",
          targetProject: "所属项目：",
          selectProject: "请选择项目",
          pcbName: "PCB 名称：",
          pcbNamePlaceholder: "例如：主控板",
          version: "版本号：",
          versionPlaceholder: "可选，例如：v1.2",
          boardQuantity: "项目用板数量：",
          boardQuantityPlaceholder: "例如：10",
          pcbNote: "PCB 备注：",
          pcbNotePlaceholder: "可填写版本差异说明",
          updatePcb: "更新 PCB",
          createPcb: "创建 PCB",
          summaryTitle: "项目筛选与需求统计",
          allProjects: "全部项目",
          colType: "类型",
          colModel: "型号",
          colTotalDemand: "总需求",
          colRelatedPcb: "涉及 PCB",
          unknownType: "未知类型",
          unknownComponent: "未知元器件",
          noSummary: "暂无统计数据",
          listTitle: "项目列表（下属 PCB 独立管理）",
          noProjectNote: "无项目备注",
          editProjectBtn: "编辑项目",
          deleteProjectBtn: "删除项目",
          pcbSummaryPrefix: "项目数量",
          pcbSummaryMid: "BOM",
          updatedAt: "更新时间",
          bomDetail: "BOM明细",
          editPcbBtn: "编辑PCB",
          deletePcbBtn: "删除PCB",
          noPcb: "该项目下暂无 PCB。",
          editBom: "编辑 BOM 明细",
          addBom: "新增 BOM 明细",
          component: "元器件：",
          selectComponent: "请选择元器件",
          qtyPerBoard: "单板需求数量：",
          qtyPerBoardPlaceholder: "例如：2",
          colPerBoard: "单板需求",
          colProjectTotal: "项目总需求",
          colAction: "操作",
          edit: "编辑",
          delete: "删除",
          noBom: "暂无 BOM 明细",
          saveBom: "保存明细",
          addBomBtn: "新增明细",
          close: "关闭",
        };

  async function loadData() {
    const [typesData, componentsData, projectsData, pcbsData] = await Promise.all([
      requestJson<ComponentType[]>("/api/types"),
      requestJson<ComponentItem[]>("/api/components"),
      requestJson<ProjectItem[]>("/api/projects"),
      requestJson<PcbItem[]>("/api/pcbs"),
    ]);
    const firstProjectId = [...projectsData].sort((a, b) => a.name.localeCompare(b.name, sortLocale))[0]?.id ?? "";
    setTypes(typesData);
    setComponents(componentsData);
    setProjects(projectsData);
    setPcbs(pcbsData);
    setPcbForm((prev) => ({ ...prev, projectId: prev.projectId || firstProjectId }));
  }

  useEffect(() => {
    void Promise.all([
      requestJson<ComponentType[]>("/api/types"),
      requestJson<ComponentItem[]>("/api/components"),
      requestJson<ProjectItem[]>("/api/projects"),
      requestJson<PcbItem[]>("/api/pcbs"),
    ])
      .then(([typesData, componentsData, projectsData, pcbsData]) => {
        const firstProjectId = [...projectsData].sort((a, b) => a.name.localeCompare(b.name, sortLocale))[0]?.id ?? "";
        setTypes(typesData);
        setComponents(componentsData);
        setProjects(projectsData);
        setPcbs(pcbsData);
        setPcbForm((prev) => ({ ...prev, projectId: prev.projectId || firstProjectId }));
      })
      .catch((err) => setError(err instanceof Error ? err.message : text.loadError));
  }, [sortLocale, text.loadError]);

  const typeMap = useMemo(() => new Map(types.map((item) => [item.id, item.name])), [types]);
  const componentMap = useMemo(() => new Map(components.map((item) => [item.id, item])), [components]);
  const projectMap = useMemo(() => new Map(projects.map((item) => [item.id, item])), [projects]);
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name, sortLocale)),
    [projects, sortLocale],
  );
  const sortedComponents = useMemo(
    () => [...components].sort((a, b) => a.model.localeCompare(b.model, sortLocale)),
    [components, sortLocale],
  );

  const filteredPcbs = useMemo(() => {
    const target = projectFilter === "all" ? pcbs : pcbs.filter((item) => item.projectId === projectFilter);
    return [...target].sort((a, b) => `${a.name} ${a.version}`.localeCompare(`${b.name} ${b.version}`, sortLocale));
  }, [pcbs, projectFilter, sortLocale]);

  const groupedByProject = useMemo(() => {
    return sortedProjects
      .map((project) => ({
        project,
        pcbs: filteredPcbs.filter((pcb) => pcb.projectId === project.id),
      }))
      .filter((entry) => entry.pcbs.length || projectFilter === "all" || entry.project.id === projectFilter);
  }, [filteredPcbs, projectFilter, sortedProjects]);

  const requirementSummary = useMemo(() => {
    const map = new Map<string, { componentId: string; totalRequired: number; pcbNames: Set<string> }>();
    for (const pcb of filteredPcbs) {
      const projectName = projectMap.get(pcb.projectId)?.name ?? text.unknownProject;
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
    return Array.from(map.values()).sort((a, b) => {
      const modelA = componentMap.get(a.componentId)?.model ?? text.unknownComponent;
      const modelB = componentMap.get(b.componentId)?.model ?? text.unknownComponent;
      return modelA.localeCompare(modelB, sortLocale);
    });
  }, [componentMap, filteredPcbs, projectMap, sortLocale, text.unknownComponent, text.unknownProject]);

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
      setError(err instanceof Error ? err.message : text.saveProjectError);
    }
  }

  async function removeProject(id: string) {
    if (!window.confirm(text.deleteProjectConfirm)) return;
    try {
      await requestJson(`/api/projects/${id}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : text.deleteProjectError);
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
      setPcbForm({ ...initialPcbForm, projectId: sortedProjects[0]?.id ?? "" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : text.savePcbError);
    }
  }

  async function removePcb(id: string) {
    if (!window.confirm(text.deletePcbConfirm)) return;
    try {
      await requestJson(`/api/pcbs/${id}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : text.deletePcbError);
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
    setBomForm({ componentId: sortedComponents[0]?.id ?? "", quantityPerBoard: "1" });
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
      setError(err instanceof Error ? err.message : text.saveBomError);
    }
  }

  async function removeBom(pcbId: string, itemId: string) {
    if (!window.confirm(text.deleteBomConfirm)) return;
    try {
      await requestJson(`/api/pcbs/${pcbId}/items/${itemId}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : text.deleteBomError);
    }
  }

  return (
    <>
      <section className="hero-card">
        <div>
          <h1>{text.pageTitle}</h1>
          <p>{text.pageSubtitle}</p>
        </div>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}
      {info ? <p className="info-banner">{info}</p> : null}

      <section className="grid-two">
        <article className="panel">
          <h2>{editingProjectId ? text.editProject : text.addProject}</h2>
          <form className="stack-form" onSubmit={submitProject}>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="project-name">
                  {text.projectName}
                </label>
                <span className="field-required" aria-hidden="true">
                  *
                </span>
              </div>
              <input
                id="project-name"
                value={projectForm.name}
                onChange={(event) => setProjectForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={text.projectNamePlaceholder}
                required
              />
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="project-note">
                  {text.projectNote}
                </label>
              </div>
              <textarea
                id="project-note"
                value={projectForm.note}
                onChange={(event) => setProjectForm((prev) => ({ ...prev, note: event.target.value }))}
                placeholder={text.projectNotePlaceholder}
                rows={2}
              />
            </div>
            <div className="inline-actions">
              <button type="submit" className="btn-primary">
                {editingProjectId ? text.updateProject : text.createProject}
              </button>
              {editingProjectId ? (
                <button type="button" className="btn-ghost" onClick={() => {
                  setEditingProjectId(null);
                  setProjectForm(initialProjectForm);
                }}>
                  {text.cancel}
                </button>
              ) : null}
            </div>
          </form>
        </article>

        <article className="panel">
          <h2>{editingPcbId ? text.editPcb : text.addPcb}</h2>
          <form className="stack-form" onSubmit={submitPcb}>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="pcb-project-id">
                  {text.targetProject}
                </label>
                <span className="field-required" aria-hidden="true">
                  *
                </span>
              </div>
              <select
                id="pcb-project-id"
                value={pcbForm.projectId}
                onChange={(event) => setPcbForm((prev) => ({ ...prev, projectId: event.target.value }))}
                required
              >
                <option value="">{text.selectProject}</option>
                {sortedProjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="pcb-name">
                  {text.pcbName}
                </label>
                <span className="field-required" aria-hidden="true">
                  *
                </span>
              </div>
              <input
                id="pcb-name"
                value={pcbForm.name}
                onChange={(event) => setPcbForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={text.pcbNamePlaceholder}
                required
              />
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="pcb-version">
                  {text.version}
                </label>
              </div>
              <input
                id="pcb-version"
                value={pcbForm.version}
                onChange={(event) => setPcbForm((prev) => ({ ...prev, version: event.target.value }))}
                placeholder={text.versionPlaceholder}
              />
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="pcb-board-quantity">
                  {text.boardQuantity}
                </label>
                <span className="field-required" aria-hidden="true">
                  *
                </span>
              </div>
              <input
                id="pcb-board-quantity"
                type="number"
                min="1"
                step="1"
                value={pcbForm.boardQuantity}
                onChange={(event) => setPcbForm((prev) => ({ ...prev, boardQuantity: event.target.value }))}
                placeholder={text.boardQuantityPlaceholder}
                required
              />
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="pcb-note">
                  {text.pcbNote}
                </label>
              </div>
              <textarea
                id="pcb-note"
                value={pcbForm.note}
                onChange={(event) => setPcbForm((prev) => ({ ...prev, note: event.target.value }))}
                placeholder={text.pcbNotePlaceholder}
                rows={2}
              />
            </div>
            <div className="inline-actions">
              <button type="submit" className="btn-primary">
                {editingPcbId ? text.updatePcb : text.createPcb}
              </button>
              {editingPcbId ? (
                <button type="button" className="btn-ghost" onClick={() => {
                  setEditingPcbId(null);
                  setPcbForm({ ...initialPcbForm, projectId: sortedProjects[0]?.id ?? "" });
                }}>
                  {text.cancel}
                </button>
              ) : null}
            </div>
          </form>
        </article>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>{text.summaryTitle}</h2>
          <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
            <option value="all">{text.allProjects}</option>
            {sortedProjects.map((item) => (
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
                <th>{text.colType}</th>
                <th>{text.colModel}</th>
                <th>{text.colTotalDemand}</th>
                <th>{text.colRelatedPcb}</th>
              </tr>
            </thead>
            <tbody>
              {requirementSummary.map((item) => {
                const component = componentMap.get(item.componentId);
                return (
                  <tr key={item.componentId}>
                    <td>{component ? (typeMap.get(component.typeId) ?? text.unknownType) : text.unknownType}</td>
                    <td>{component?.model ?? text.unknownComponent}</td>
                    <td>{item.totalRequired}</td>
                    <td>{Array.from(item.pcbNames).sort((a, b) => a.localeCompare(b, sortLocale)).join(lang === "en" ? ", " : "，") || "-"}</td>
                  </tr>
                );
              })}
              {!requirementSummary.length ? (
                <tr>
                  <td className="muted text-center" colSpan={4}>{text.noSummary}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>{text.listTitle}</h2>
        <div className="component-list scroll-list">
          {groupedByProject.map(({ project, pcbs: projectPcbs }) => (
            <article className="component-card" key={project.id}>
              <header>
                <div>
                  <h3>{project.name}</h3>
                  <p>{project.note || text.noProjectNote}</p>
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
                    {text.editProjectBtn}
                  </button>
                  <button type="button" className="btn-danger" onClick={() => void removeProject(project.id)}>
                    {text.deleteProjectBtn}
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
                        {text.pcbSummaryPrefix} {pcb.boardQuantity} / {text.pcbSummaryMid} {pcb.items.length} / {text.updatedAt} {formatTime(pcb.updatedAt)}
                      </p>
                    </div>
                    <div className="inline-actions">
                      <button type="button" className="btn-primary" onClick={() => openNewBom(pcb)}>
                        {text.bomDetail}
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => startEditPcb(pcb)}>
                        {text.editPcbBtn}
                      </button>
                      <button type="button" className="btn-danger" onClick={() => void removePcb(pcb.id)}>
                        {text.deletePcbBtn}
                      </button>
                    </div>
                  </article>
                ))}
                {!projectPcbs.length ? <p className="muted">{text.noPcb}</p> : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      {bomModalOpen && activePcb ? (
        <div className="modal-overlay" role="presentation" onClick={() => setBomModalOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3>{editingBomId ? text.editBom : `${text.addBom} - ${activePcb.name}`}</h3>
            <form className="stack-form" onSubmit={submitBom}>
              <div className="form-field">
                <div className="field-head">
                  <label className="field-label" htmlFor="bom-component-id">
                    {text.component}
                  </label>
                  <span className="field-required" aria-hidden="true">
                    *
                  </span>
                </div>
                <select
                  id="bom-component-id"
                  value={bomForm.componentId}
                  onChange={(event) => setBomForm((prev) => ({ ...prev, componentId: event.target.value }))}
                  required
                >
                  <option value="">{text.selectComponent}</option>
                  {sortedComponents.map((item) => (
                    <option key={item.id} value={item.id}>
                      {typeMap.get(item.typeId) ?? text.unknownType} / {item.model}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <div className="field-head">
                  <label className="field-label" htmlFor="bom-quantity-per-board">
                    {text.qtyPerBoard}
                  </label>
                  <span className="field-required" aria-hidden="true">
                    *
                  </span>
                </div>
                <input
                  id="bom-quantity-per-board"
                  type="number"
                  min="1"
                  step="1"
                  value={bomForm.quantityPerBoard}
                  onChange={(event) => setBomForm((prev) => ({ ...prev, quantityPerBoard: event.target.value }))}
                  placeholder={text.qtyPerBoardPlaceholder}
                  required
                />
              </div>
              <div className="record-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{text.colType}</th>
                      <th>{text.colModel}</th>
                      <th>{text.colPerBoard}</th>
                      <th>{text.colProjectTotal}</th>
                      <th>{text.colAction}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...activePcb.items]
                      .sort((a, b) => {
                        const modelA = componentMap.get(a.componentId)?.model ?? text.unknownComponent;
                        const modelB = componentMap.get(b.componentId)?.model ?? text.unknownComponent;
                        return modelA.localeCompare(modelB, sortLocale);
                      })
                      .map((item) => {
                      const component = componentMap.get(item.componentId);
                      return (
                        <tr key={item.id}>
                          <td>{component ? (typeMap.get(component.typeId) ?? text.unknownType) : text.unknownType}</td>
                          <td>{component?.model ?? text.unknownComponent}</td>
                          <td>{item.quantityPerBoard}</td>
                          <td>{item.quantityPerBoard * activePcb.boardQuantity}</td>
                          <td>
                            <div className="inline-actions">
                              <button type="button" className="btn-ghost" onClick={() => openEditBom(activePcb, item)}>
                                {text.edit}
                              </button>
                              <button
                                type="button"
                                className="btn-danger"
                                onClick={() => void removeBom(activePcb.id, item.id)}
                              >
                                {text.delete}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                      })}
                    {!activePcb.items.length ? (
                      <tr>
                        <td className="muted text-center" colSpan={5}>{text.noBom}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="inline-actions">
                <button type="submit" className="btn-primary">{editingBomId ? text.saveBom : text.addBomBtn}</button>
                <button type="button" className="btn-ghost" onClick={() => setBomModalOpen(false)}>{text.close}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
