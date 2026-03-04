"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType } from "@/lib/types";
import { formatTime, requestJson } from "@/lib/http-client";
import { tr, useUiLang } from "@/lib/ui-language";

export default function TypesPage() {
  const lang = useUiLang();
  const sortLocale = lang === "en" ? "en-US" : "zh-Hans-CN";
  const [types, setTypes] = useState<ComponentType[]>([]);
  const [primaryName, setPrimaryName] = useState("");
  const [secondaryName, setSecondaryName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadTypes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await requestJson<ComponentType[]>("/api/types");
      setTypes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr(lang, "加载失败", "Failed to load types"));
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

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
      setError(err instanceof Error ? err.message : tr(lang, "保存失败", "Failed to save type"));
    }
  }

  async function removeType(id: string) {
    if (!window.confirm(tr(lang, "确认删除该类型？", "Delete this type?"))) {
      return;
    }

    setError("");
    try {
      await requestJson(`/api/types/${id}`, { method: "DELETE" });
      await loadTypes();
    } catch (err) {
      setError(err instanceof Error ? err.message : tr(lang, "删除失败", "Failed to delete type"));
    }
  }

  const groupedTypes = useMemo(() => {
    const groups = new Map<string, ComponentType[]>();
    for (const item of types) {
      const key = item.primaryName.trim() || tr(lang, "未分类", "Uncategorized");
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)?.push(item);
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b, sortLocale))
      .map(([primary, items]) => ({
        primary,
        items: items.sort((a, b) => a.name.localeCompare(b.name, sortLocale)),
      }));
  }, [lang, sortLocale, types]);

  const text =
    lang === "en"
      ? {
          title: "Type Management",
          subtitle: "Maintain the component type dictionary for single-select when creating components.",
          edit: "Edit Type",
          create: "Create Type",
          primaryType: "Primary Type:",
          secondaryType: "Secondary Type:",
          primaryPlaceholder: "For example: Sensor",
          secondaryPlaceholder: "Optional, e.g. Temperature/Humidity",
          update: "Update",
          add: "Add",
          cancel: "Cancel",
          listTitle: "Type List",
          loading: "Loading...",
          primaryLabel: "Primary",
          secondaryLabel: "Secondary",
          secondaryNone: "None",
          updatedAt: "Updated At",
          editBtn: "Edit",
          deleteBtn: "Delete",
          empty: "No type data yet.",
        }
      : {
          title: "类型管理",
          subtitle: "维护元器件类型字典，供元器件录入时单选。",
          edit: "编辑类型",
          create: "新增类型",
          primaryType: "一级类型：",
          secondaryType: "二级类型：",
          primaryPlaceholder: "例如：传感器",
          secondaryPlaceholder: "可选，例如：温湿度",
          update: "更新",
          add: "新增",
          cancel: "取消",
          listTitle: "类型列表",
          loading: "加载中...",
          primaryLabel: "一级",
          secondaryLabel: "二级",
          secondaryNone: "无",
          updatedAt: "更新时间",
          editBtn: "编辑",
          deleteBtn: "删除",
          empty: "暂无类型数据。",
        };

  return (
    <>
      <section className="hero-card">
        <div>
          <h1>{text.title}</h1>
          <p>{text.subtitle}</p>
        </div>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}

      <section className="grid-two">
        <article className="panel">
          <h2>{editingId ? text.edit : text.create}</h2>
          <form className="stack-form" onSubmit={onSubmit}>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="type-primary-name">
                  {text.primaryType}
                </label>
                <span className="field-required" aria-hidden="true">
                  *
                </span>
              </div>
              <input
                id="type-primary-name"
                value={primaryName}
                onChange={(event) => setPrimaryName(event.target.value)}
                placeholder={text.primaryPlaceholder}
                required
              />
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="type-secondary-name">
                  {text.secondaryType}
                </label>
              </div>
              <input
                id="type-secondary-name"
                value={secondaryName}
                onChange={(event) => setSecondaryName(event.target.value)}
                placeholder={text.secondaryPlaceholder}
              />
            </div>
            <div className="inline-actions">
              <button type="submit" className="btn-primary">
                {editingId ? text.update : text.add}
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
                  {text.cancel}
                </button>
              ) : null}
            </div>
          </form>
        </article>

        <article className="panel">
          <h2>{text.listTitle}</h2>
          {loading ? <p className="muted">{text.loading}</p> : null}
          <div className="type-list scroll-list">
            {groupedTypes.map((group) => (
              <section className="type-group" key={group.primary}>
                <h3>{group.primary}</h3>
                <div className="type-list">
                  {group.items.map((item) => (
                    <div className="type-item" key={item.id}>
                      <div>
                        <strong>{item.name}</strong>
                        <p>
                          {text.primaryLabel}: {item.primaryName}
                          {item.secondaryName ? ` | ${text.secondaryLabel}: ${item.secondaryName}` : ` | ${text.secondaryLabel}: ${text.secondaryNone}`}
                        </p>
                        <p>{text.updatedAt}: {formatTime(item.updatedAt)}</p>
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
                          {text.editBtn}
                        </button>
                        <button type="button" className="btn-danger" onClick={() => void removeType(item.id)}>
                          {text.deleteBtn}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
            {!types.length && !loading ? <p className="muted">{text.empty}</p> : null}
          </div>
        </article>
      </section>
    </>
  );
}
