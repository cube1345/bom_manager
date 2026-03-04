"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ComponentItem, ComponentType, PcbItem, ProjectItem } from "@/lib/types";
import { formatTime, requestJson, triggerDownload } from "@/lib/http-client";

function isWarning(item: ComponentItem) {
  return item.warningThreshold > 0 && item.totalQuantity <= item.warningThreshold;
}

type ComponentsPageProps = {
  entryMode?: "home" | "list";
};

export default function ComponentsPage({ entryMode = "list" }: ComponentsPageProps) {
  const [types, setTypes] = useState<ComponentType[]>([]);
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [pcbs, setPcbs] = useState<PcbItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [warningOnly, setWarningOnly] = useState(false);
  const [sortBy, setSortBy] = useState("updated");
  const [error, setError] = useState("");

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
        setError(err instanceof Error ? err.message : "加载失败");
      });
  }, []);

  const typeMap = useMemo(() => new Map(types.map((item) => [item.id, item.name])), [types]);
  const projectMap = useMemo(() => new Map(projects.map((item) => [item.id, item.name])), [projects]);
  const pcbUsageMap = useMemo(() => {
    const map = new Map<string, { totalRequired: number; pcbNames: Set<string> }>();
    for (const pcb of pcbs) {
      const projectName = projectMap.get(pcb.projectId) ?? "未知项目";
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
  }, [pcbs, projectMap]);

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
      .sort((a, b) => {
        if (sortBy === "updated") {
          return +new Date(b.updatedAt) - +new Date(a.updatedAt);
        }

        if (sortBy === "quantity") {
          return b.totalQuantity - a.totalQuantity;
        }

        if (sortBy === "price") {
          const priceA = a.lowestPrice ?? Number.POSITIVE_INFINITY;
          const priceB = b.lowestPrice ?? Number.POSITIVE_INFINITY;
          return priceA - priceB;
        }

        return a.model.localeCompare(b.model, "zh-CN");
      });
  }, [components, keyword, sortBy, typeFilter, typeMap, warningOnly]);

  const warningCount = components.filter(isWarning).length;
  const isHome = entryMode === "home";

  return (
    <>
      <section className="hero-card">
        <div>
          <h1>{isHome ? "元器件首页" : "元器件列表"}</h1>
          <p>支持关键词搜索、筛选和库存预警定位，并可直接跳转到新增与编辑。</p>
        </div>
        <div className="toolbar">
          <Link href="/components/manage?mode=new" className="btn-primary btn-link home-quick-action home-quick-action-primary">
            新增元器件
          </Link>
          <Link href="/types" className="btn-secondary btn-link home-quick-action">
            新增类型
          </Link>
          <Link href="/pcbs" className="btn-secondary btn-link home-quick-action">
            PCB管理
          </Link>
          <Link href="/settings" className="btn-secondary btn-link home-quick-action">
            存储设置
          </Link>
          <Link href="/stores" className="btn-secondary btn-link home-quick-action">
            店铺评价
          </Link>
          <button type="button" className="btn-secondary" onClick={() => triggerDownload("/api/export/json")}>
            导出 JSON
          </button>
          <button type="button" className="btn-secondary" onClick={() => triggerDownload("/api/export/excel")}>
            导出 Excel
          </button>
        </div>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}

      <section className="panel">
        <h2>搜索与筛选</h2>
        <div className="filter-grid">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="关键词：型号/辅助信息/备注/类型"
          />
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">全部类型</option>
            {types.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="updated">按更新时间</option>
            <option value="quantity">按总数目</option>
            <option value="price">按最低价格</option>
            <option value="model">按型号</option>
          </select>
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={warningOnly}
              onChange={(event) => setWarningOnly(event.target.checked)}
            />
            仅显示库存预警
          </label>
        </div>
        <p className="muted">当前共 {filtered.length} 条，库存预警 {warningCount} 条。</p>
      </section>

      <section className="component-list">
        {filtered.map((item) => (
          <article key={item.id} className={isWarning(item) ? "component-card warning-card" : "component-card"}>
            <header>
              <div>
                <h3>{item.model}</h3>
                <p>{typeMap.get(item.typeId) ?? "未知类型"}</p>
              </div>
              <div className="inline-actions">
                {isWarning(item) ? <span className="badge-warning">库存预警</span> : null}
                <Link href={`/components/manage?mode=edit&componentId=${item.id}`} className="btn-ghost btn-link">
                  编辑
                </Link>
              </div>
            </header>

            <div className="meta-grid">
              <div>
                <span>辅助信息</span>
                <p>{item.auxInfo || "-"}</p>
              </div>
              <div>
                <span>备注</span>
                <p>{item.note || "-"}</p>
              </div>
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
              <div>
                <span>关联 PCB 数</span>
                <p>{pcbUsageMap.get(item.id)?.pcbNames.size ?? 0}</p>
              </div>
              <div>
                <span>PCB 需求总量</span>
                <p>{pcbUsageMap.get(item.id)?.totalRequired ?? 0}</p>
              </div>
              <div>
                <span>关联 PCB</span>
                <p>{Array.from(pcbUsageMap.get(item.id)?.pcbNames ?? []).join("，") || "-"}</p>
              </div>
            </div>
          </article>
        ))}

        {!filtered.length ? <article className="panel muted">没有符合条件的元器件。</article> : null}
      </section>
    </>
  );
}
