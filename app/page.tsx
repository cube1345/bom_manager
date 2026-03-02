"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ComponentItem, ComponentType } from "@/lib/types";
import { requestJson, triggerDownload } from "@/lib/http-client";

export default function Home() {
  const [types, setTypes] = useState<ComponentType[]>([]);
  const [components, setComponents] = useState<ComponentItem[]>([]);

  useEffect(() => {
    void Promise.all([
      requestJson<ComponentType[]>("/api/types"),
      requestJson<ComponentItem[]>("/api/components"),
    ]).then(([typesData, componentsData]) => {
      setTypes(typesData);
      setComponents(componentsData);
    });
  }, []);

  const warningCount = components.filter(
    (item) => item.warningThreshold > 0 && item.totalQuantity <= item.warningThreshold,
  ).length;

  return (
    <>
      <section className="hero-card">
        <div>
          <h1>电子元器件智能管理系统</h1>
          <p>按路由分离页面，覆盖类型管理、列表查询、元器件管理与批量导入。</p>
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

      <section className="grid-three">
        <article className="panel stat-card">
          <span>类型总数</span>
          <strong>{types.length}</strong>
        </article>
        <article className="panel stat-card">
          <span>元器件总数</span>
          <strong>{components.length}</strong>
        </article>
        <article className="panel stat-card warning">
          <span>库存预警</span>
          <strong>{warningCount}</strong>
        </article>
      </section>

      <section className="grid-three">
        <Link href="/types" className="panel link-card">
          <h3>类型管理</h3>
          <p>维护可选类型，支持增删改查。</p>
        </Link>
        <Link href="/components" className="panel link-card">
          <h3>元器件列表</h3>
          <p>关键词搜索、筛选和库存预警视图。</p>
        </Link>
        <Link href="/components/manage" className="panel link-card">
          <h3>元器件管理</h3>
          <p>元器件/记录 CRUD + 批量导入。</p>
        </Link>
      </section>
    </>
  );
}
