"use client";

import { FormEvent, useEffect, useState } from "react";
import type { ComponentType } from "@/lib/types";
import { formatTime, requestJson } from "@/lib/http-client";

export default function TypesPage() {
  const [types, setTypes] = useState<ComponentType[]>([]);
  const [name, setName] = useState("");
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
    if (!name.trim()) {
      return;
    }

    setError("");
    try {
      if (editingId) {
        await requestJson(`/api/types/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({ name }),
        });
      } else {
        await requestJson("/api/types", {
          method: "POST",
          body: JSON.stringify({ name }),
        });
      }

      setName("");
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
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：传感器"
              required
            />
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
                    setName("");
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
            {types.map((item) => (
              <div className="type-item" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <p>更新时间：{formatTime(item.updatedAt)}</p>
                </div>
                <div className="inline-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setEditingId(item.id);
                      setName(item.name);
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
            {!types.length && !loading ? <p className="muted">暂无类型数据。</p> : null}
          </div>
        </article>
      </section>
    </>
  );
}
