"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ComponentItem, ComponentType, PcbItem, ProjectItem } from "@/lib/types";
import { formatTime, requestJson, triggerDownload } from "@/lib/http-client";
import { tr, useUiLang } from "@/lib/ui-language";

function isWarning(item: ComponentItem) {
  return item.warningThreshold > 0 && item.totalQuantity <= item.warningThreshold;
}

type ComponentsPageProps = {
  entryMode?: "home" | "list";
};

export default function ComponentsPage({ entryMode = "list" }: ComponentsPageProps) {
  const lang = useUiLang();
  const [types, setTypes] = useState<ComponentType[]>([]);
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [pcbs, setPcbs] = useState<PcbItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [warningOnly, setWarningOnly] = useState(false);
  const [error, setError] = useState("");
  const sortLocale = lang === "en" ? "en-US" : "zh-Hans-CN";

  useEffect(() => {
    void Promise.all([
      requestJson<ComponentType[]>("/api/types"),
      requestJson<ComponentItem[]>("/api/components"),
      requestJson<PcbItem[]>("/api/pcbs"),
      requestJson<ProjectItem[]>("/api/projects"),
    ])
      .then(([typesData, componentsData, pcbData, projectData]) => {
        setTypes(typesData);
        setComponents(componentsData);
        setPcbs(pcbData);
        setProjects(projectData);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : tr(lang, "加载失败", "Failed to load data"));
      });
  }, [lang]);

  const typeMap = useMemo(() => new Map(types.map((item) => [item.id, item.name])), [types]);
  const projectMap = useMemo(() => new Map(projects.map((item) => [item.id, item.name])), [projects]);
  const sortedTypes = useMemo(
    () => [...types].sort((a, b) => a.name.localeCompare(b.name, sortLocale)),
    [sortLocale, types],
  );
  const pcbUsageMap = useMemo(() => {
    const map = new Map<string, { totalRequired: number; pcbNames: Set<string> }>();
    for (const pcb of pcbs) {
      const projectName = projectMap.get(pcb.projectId) ?? tr(lang, "未知项目", "Unknown Project");
      const pcbName = `${projectName}/${pcb.name}${pcb.version ? `(${pcb.version})` : ""}`;
      for (const item of pcb.items) {
        if (!map.has(item.componentId)) {
          map.set(item.componentId, { totalRequired: 0, pcbNames: new Set<string>() });
        }
        const row = map.get(item.componentId)!;
        row.totalRequired += item.quantityPerBoard * pcb.boardQuantity;
        row.pcbNames.add(pcbName);
      }
    }
    return map;
  }, [lang, pcbs, projectMap]);

  const filtered = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return components
      .filter((item) => {
        const typeName = typeMap.get(item.typeId) ?? "";
        const hitKeyword =
          !normalizedKeyword ||
          [item.model, item.auxInfo, item.note, typeName]
            .join(" ")
            .toLowerCase()
            .includes(normalizedKeyword);

        const hitType = typeFilter === "all" || item.typeId === typeFilter;
        const hitWarning = !warningOnly || isWarning(item);

        return hitKeyword && hitType && hitWarning;
      })
      .sort((a, b) => a.model.localeCompare(b.model, sortLocale));
  }, [components, keyword, sortLocale, typeFilter, typeMap, warningOnly]);

  const warningCount = components.filter(isWarning).length;
  const isHome = entryMode === "home";
  const text =
    lang === "en"
      ? {
          homeTitle: "Components Home",
          listTitle: "Components List",
          subtitle: "Search, filter, and locate low-stock parts quickly, then jump to create/edit pages.",
          addComponent: "Add Component",
          addType: "Add Type",
          pcb: "PCB",
          settings: "Storage Settings",
          stores: "Store Reviews",
          exportJson: "Export JSON",
          exportExcel: "Export Excel",
          filterTitle: "Search & Filters",
          keywordPlaceholder: "Keywords: model / aux info / note / type",
          allTypes: "All Types",
          warningOnly: "Show low-stock only",
          summary: `Total ${filtered.length} items, ${warningCount} in low stock.`,
          unknownType: "Unknown Type",
          lowStock: "Low Stock",
          edit: "Edit",
          auxInfo: "Aux Info",
          note: "Note",
          totalQuantity: "Total Quantity",
          warningThreshold: "Warning Threshold",
          lowestPrice: "Lowest Price",
          updatedAt: "Updated At",
          linkedPcbCount: "Linked PCB Count",
          pcbDemand: "PCB Total Demand",
          linkedPcb: "Linked PCB",
          noMatch: "No components match current filters.",
        }
      : {
          homeTitle: "元器件首页",
          listTitle: "元器件列表",
          subtitle: "支持关键词搜索、筛选和库存预警定位，并可直接跳转到新增与编辑。",
          addComponent: "新增元器件",
          addType: "新增类型",
          pcb: "PCB管理",
          settings: "存储设置",
          stores: "店铺评价",
          exportJson: "导出 JSON",
          exportExcel: "导出 Excel",
          filterTitle: "搜索与筛选",
          keywordPlaceholder: "关键词：型号/辅助信息/备注/类型",
          allTypes: "全部类型",
          warningOnly: "仅显示库存预警",
          summary: `当前共 ${filtered.length} 条，库存预警 ${warningCount} 条。`,
          unknownType: "未知类型",
          lowStock: "库存预警",
          edit: "编辑",
          auxInfo: "辅助信息",
          note: "备注",
          totalQuantity: "总数目",
          warningThreshold: "预警阈值",
          lowestPrice: "最低价格",
          updatedAt: "更新时间",
          linkedPcbCount: "关联 PCB 数",
          pcbDemand: "PCB 需求总量",
          linkedPcb: "关联 PCB",
          noMatch: "没有符合条件的元器件。",
        };

  return (
    <>
      <section className="hero-card">
        <div>
          <h1>{isHome ? text.homeTitle : text.listTitle}</h1>
          <p>{text.subtitle}</p>
        </div>
        <div className="toolbar">
          <Link href="/components/manage?mode=new" className="btn-primary btn-link home-quick-action home-quick-action-primary">
            {text.addComponent}
          </Link>
          <Link href="/types" className="btn-secondary btn-link home-quick-action">
            {text.addType}
          </Link>
          <Link href="/pcbs" className="btn-secondary btn-link home-quick-action">
            {text.pcb}
          </Link>
          <Link href="/settings" className="btn-secondary btn-link home-quick-action">
            {text.settings}
          </Link>
          <Link href="/stores" className="btn-secondary btn-link home-quick-action">
            {text.stores}
          </Link>
          <button type="button" className="btn-secondary" onClick={() => triggerDownload("/api/export/json")}>
            {text.exportJson}
          </button>
          <button type="button" className="btn-secondary" onClick={() => triggerDownload("/api/export/excel")}>
            {text.exportExcel}
          </button>
        </div>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}

      <section className="panel">
        <h2>{text.filterTitle}</h2>
        <div className="filter-grid">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={text.keywordPlaceholder}
          />
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">{text.allTypes}</option>
            {sortedTypes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={warningOnly}
              onChange={(event) => setWarningOnly(event.target.checked)}
            />
            {text.warningOnly}
          </label>
        </div>
        <p className="muted">{text.summary}</p>
      </section>

      <section className="component-list scroll-list">
        {filtered.map((item) => (
          <article key={item.id} className={isWarning(item) ? "component-card warning-card" : "component-card"}>
            <header>
              <div>
                <h3>{item.model}</h3>
                <p>{typeMap.get(item.typeId) ?? text.unknownType}</p>
              </div>
              <div className="inline-actions">
                {isWarning(item) ? <span className="badge-warning">{text.lowStock}</span> : null}
                <Link href={`/components/manage?mode=edit&componentId=${item.id}`} className="btn-ghost btn-link">
                  {text.edit}
                </Link>
              </div>
            </header>

            <div className="meta-grid">
              <div>
                <span>{text.auxInfo}</span>
                <p>{item.auxInfo || "-"}</p>
              </div>
              <div>
                <span>{text.note}</span>
                <p>{item.note || "-"}</p>
              </div>
              <div>
                <span>{text.totalQuantity}</span>
                <p>{item.totalQuantity}</p>
              </div>
              <div>
                <span>{text.warningThreshold}</span>
                <p>{item.warningThreshold}</p>
              </div>
              <div>
                <span>{text.lowestPrice}</span>
                <p>{item.lowestPrice === null ? "-" : `¥${item.lowestPrice.toFixed(2)}${lang === "en" ? "/unit" : "/个"}`}</p>
              </div>
              <div>
                <span>{text.updatedAt}</span>
                <p>{formatTime(item.updatedAt)}</p>
              </div>
              <div>
                <span>{text.linkedPcbCount}</span>
                <p>{pcbUsageMap.get(item.id)?.pcbNames.size ?? 0}</p>
              </div>
              <div>
                <span>{text.pcbDemand}</span>
                <p>{pcbUsageMap.get(item.id)?.totalRequired ?? 0}</p>
              </div>
              <div>
                <span>{text.linkedPcb}</span>
                <p>
                  {Array.from(pcbUsageMap.get(item.id)?.pcbNames ?? [])
                    .sort((a, b) => a.localeCompare(b, sortLocale))
                    .join(lang === "en" ? ", " : "，") || "-"}
                </p>
              </div>
            </div>
          </article>
        ))}

        {!filtered.length ? <article className="panel muted">{text.noMatch}</article> : null}
      </section>
    </>
  );
}
