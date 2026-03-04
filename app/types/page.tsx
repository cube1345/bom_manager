"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ComponentType } from "@/lib/types";
import { formatTime, requestJson } from "@/lib/http-client";

export default function TypesPage() {
  const [types, setTypes] = useState<ComponentType[]>([]);
  const [primaryName, setPrimaryName] = useState("");
  const [secondaryName, setSecondaryName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadTypes() {
    setLoading(true);
    try {
      const data = await requestJson<ComponentType[]>("/api/types");
      setTypes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTypes();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!primaryName.trim()) {
      return;
    }

    setError("");
    try {
      if (editingId) {
        await requestJson(`/api/types/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({ primaryName, secondaryName }),
        });
      } else {
        await requestJson("/api/types", {
          method: "POST",
          body: JSON.stringify({ primaryName, secondaryName }),
        });
      }

      setPrimaryName("");
      setSecondaryName("");
      setEditingId(null);
      await loadTypes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function removeType(id: string) {
    if (!window.confirm("确认删除该类型？")) {
      return;
    }

    setError("");
    try {
      await requestJson(`/api/types/${id}`, { method: "DELETE" });
      await loadTypes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  const groupedTypes = useMemo(() => {
    const groups = new Map<string, ComponentType[]>();
    for (const item of types) {
      const key = item.primaryName.trim() || "未分类";
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)?.push(item);
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b, "zh-Hans-CN"))
      .map(([primary, items]) => ({
        primary,
        items: items.sort((a, b) => {
          const aSecondary = a.secondaryName ?? "";
          const bSecondary = b.secondaryName ?? "";
          return aSecondary.localeCompare(bSecondary, "zh-Hans-CN");
        }),
      }));
  }, [types]);

  return (
    <>
      <section className="hero-card">
        <div>
          <h1>类型管理</h1>
          <p>维护元器件类型字典，供元器件录入时单选。</p>
        </div>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}

      <section className="grid-two">
        <article className="panel">
          <h2>{editingId ? "编辑类型" : "新增类型"}</h2>
          <form className="stack-form" onSubmit={onSubmit}>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="type-primary-name">
                  一级类型：
                </label>
                <span className="field-required" aria-hidden="true">
                  *
                </span>
              </div>
              <input
                id="type-primary-name"
                value={primaryName}
                onChange={(event) => setPrimaryName(event.target.value)}
                placeholder="例如：传感器"
                required
              />
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="type-secondary-name">
                  二级类型：
                </label>
              </div>
              <input
                id="type-secondary-name"
                value={secondaryName}
                onChange={(event) => setSecondaryName(event.target.value)}
                placeholder="可选，例如：温湿度"
              />
            </div>
            <div className="inline-actions">
              <button type="submit" className="btn-primary">
                {editingId ? "更新" : "新增"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setEditingId(null);
                    setPrimaryName("");
                    setSecondaryName("");
                  }}
                >
                  取消
                </button>
              ) : null}
            </div>
          </form>
        </article>

        <article className="panel">
          <h2>类型列表</h2>
          {loading ? <p className="muted">加载中...</p> : null}
          <div className="type-list">
            {groupedTypes.map((group) => (
              <section className="type-group" key={group.primary}>
                <h3>{group.primary}</h3>
                <div className="type-list">
                  {group.items.map((item) => (
                    <div className="type-item" key={item.id}>
                      <div>
                        <strong>{item.name}</strong>
                        <p>
                          一级：{item.primaryName}
                          {item.secondaryName ? ` ｜ 二级：${item.secondaryName}` : " ｜ 二级：无"}
                        </p>
                        <p>更新时间：{formatTime(item.updatedAt)}</p>
                      </div>
                      <div className="inline-actions">
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => {
                            setEditingId(item.id);
                            setPrimaryName(item.primaryName);
                            setSecondaryName(item.secondaryName ?? "");
                          }}
                        >
                          编辑
                        </button>
                        <button type="button" className="btn-danger" onClick={() => void removeType(item.id)}>
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
            {!types.length && !loading ? <p className="muted">暂无类型数据。</p> : null}
          </div>
        </article>
      </section>
    </>
  );
}
