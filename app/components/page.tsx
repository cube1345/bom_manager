"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentItem, ComponentType } from "@/lib/types";
import { formatTime, requestJson, triggerDownload } from "@/lib/http-client";

function isWarning(item: ComponentItem) {
  return item.warningThreshold > 0 && item.totalQuantity <= item.warningThreshold;
}

export default function ComponentsPage() {
  const [types, setTypes] = useState<ComponentType[]>([]);
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [warningOnly, setWarningOnly] = useState(false);
  const [sortBy, setSortBy] = useState("updated");
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([
      requestJson<ComponentType[]>("/api/types"),
      requestJson<ComponentItem[]>("/api/components"),
    ])
      .then(([typesData, componentsData]) => {
        setTypes(typesData);
        setComponents(componentsData);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "加载失败");
      });
  }, []);

  const typeMap = useMemo(() => new Map(types.map((item) => [item.id, item.name])), [types]);

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

  return (
    <>
      <section className="hero-card">
        <div>
          <h1>元器件列表</h1>
          <p>支持关键词搜索、筛选和库存预警定位。</p>
        </div>
        <div className="toolbar">
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
              {isWarning(item) ? <span className="badge-warning">库存预警</span> : null}
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
            </div>
          </article>
        ))}

        {!filtered.length ? <article className="panel muted">没有符合条件的元器件。</article> : null}
      </section>
    </>
  );
}
