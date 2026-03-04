"use client";

import { FormEvent, useEffect, useState } from "react";
import type { StoreReview } from "@/lib/types";
import { formatTime, requestJson } from "@/lib/http-client";

type StoreForm = {
  platform: string;
  shopName: string;
  qualityScore: string;
  shippingFee: string;
  priceScore: string;
  referencePrice: string;
  mainProducts: string;
  note: string;
};

const initialForm: StoreForm = {
  platform: "",
  shopName: "",
  qualityScore: "5",
  shippingFee: "0",
  priceScore: "5",
  referencePrice: "0",
  mainProducts: "",
  note: "",
};

export default function StoresPage() {
  const [stores, setStores] = useState<StoreReview[]>([]);
  const [form, setForm] = useState<StoreForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadStores() {
    setLoading(true);
    try {
      const data = await requestJson<StoreReview[]>("/api/stores");
      setStores(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStores();
  }, []);

  async function submitStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      const payload = {
        platform: form.platform,
        shopName: form.shopName,
        qualityScore: Number(form.qualityScore),
        shippingFee: Number(form.shippingFee),
        priceScore: Number(form.priceScore),
        referencePrice: Number(form.referencePrice),
        mainProducts: form.mainProducts,
        note: form.note,
      };

      if (editingId) {
        await requestJson(`/api/stores/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await requestJson("/api/stores", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setEditingId(null);
      setForm(initialForm);
      await loadStores();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function removeStore(id: string) {
    if (!window.confirm("确认删除该店铺评价？")) {
      return;
    }

    setError("");
    try {
      await requestJson(`/api/stores/${id}`, { method: "DELETE" });
      await loadStores();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  return (
    <>
      <section className="hero-card">
        <div>
          <h1>平台店铺评价</h1>
          <p>维护各平台店铺的质量、邮费、价格与主卖品信息。</p>
        </div>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}

      <section className="grid-two">
        <article className="panel">
          <h2>{editingId ? "编辑店铺" : "新增店铺"}</h2>
          <form className="stack-form" onSubmit={submitStore}>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="store-platform">
                  平台：
                </label>
                <span className="field-required" aria-hidden="true">
                  *
                </span>
              </div>
              <input
                id="store-platform"
                value={form.platform}
                onChange={(event) => setForm((prev) => ({ ...prev, platform: event.target.value }))}
                placeholder="例如：淘宝 / 立创商城"
                required
              />
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="store-name">
                  店铺名称：
                </label>
                <span className="field-required" aria-hidden="true">
                  *
                </span>
              </div>
              <input
                id="store-name"
                value={form.shopName}
                onChange={(event) => setForm((prev) => ({ ...prev, shopName: event.target.value }))}
                placeholder="请输入店铺名称"
                required
              />
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="store-quality-score">
                  质量评分（0-5）：
                </label>
                <span className="field-required" aria-hidden="true">
                  *
                </span>
              </div>
              <input
                id="store-quality-score"
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={form.qualityScore}
                onChange={(event) => setForm((prev) => ({ ...prev, qualityScore: event.target.value }))}
                placeholder="例如：4.8"
                required
              />
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="store-shipping-fee">
                  平均邮费（元）：
                </label>
                <span className="field-required" aria-hidden="true">
                  *
                </span>
              </div>
              <input
                id="store-shipping-fee"
                type="number"
                min="0"
                step="0.01"
                value={form.shippingFee}
                onChange={(event) => setForm((prev) => ({ ...prev, shippingFee: event.target.value }))}
                placeholder="例如：6.50"
                required
              />
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="store-price-score">
                  价格评分（0-5）：
                </label>
                <span className="field-required" aria-hidden="true">
                  *
                </span>
              </div>
              <input
                id="store-price-score"
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={form.priceScore}
                onChange={(event) => setForm((prev) => ({ ...prev, priceScore: event.target.value }))}
                placeholder="例如：4.6"
                required
              />
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="store-reference-price">
                  参考价格（元/个）：
                </label>
                <span className="field-required" aria-hidden="true">
                  *
                </span>
              </div>
              <input
                id="store-reference-price"
                type="number"
                min="0"
                step="0.01"
                value={form.referencePrice}
                onChange={(event) => setForm((prev) => ({ ...prev, referencePrice: event.target.value }))}
                placeholder="例如：0.15"
                required
              />
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="store-main-products">
                  主卖品：
                </label>
              </div>
              <textarea
                id="store-main-products"
                rows={2}
                value={form.mainProducts}
                onChange={(event) => setForm((prev) => ({ ...prev, mainProducts: event.target.value }))}
                placeholder="例如：贴片电阻、电容"
              />
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="store-note">
                  备注：
                </label>
              </div>
              <textarea
                id="store-note"
                rows={2}
                value={form.note}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                placeholder="可填写补充信息"
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
                    setForm(initialForm);
                  }}
                >
                  取消
                </button>
              ) : null}
            </div>
          </form>
        </article>

        <article className="panel">
          <h2>店铺列表</h2>
          {loading ? <p className="muted">加载中...</p> : null}
          <div className="type-list">
            {stores.map((item) => (
              <div className="type-item" key={item.id}>
                <div>
                  <strong>
                    {item.platform} / {item.shopName}
                  </strong>
                  <p>质量评分：{item.qualityScore.toFixed(1)} / 5</p>
                  <p>价格评分：{item.priceScore.toFixed(1)} / 5</p>
                  <p>邮费：¥{item.shippingFee.toFixed(2)}</p>
                  <p>参考价格：¥{item.referencePrice.toFixed(2)}/个</p>
                  <p>主卖品：{item.mainProducts || "-"}</p>
                  <p>备注：{item.note || "-"}</p>
                  <p>更新时间：{formatTime(item.updatedAt)}</p>
                </div>
                <div className="inline-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setEditingId(item.id);
                      setForm({
                        platform: item.platform,
                        shopName: item.shopName,
                        qualityScore: String(item.qualityScore),
                        shippingFee: String(item.shippingFee),
                        priceScore: String(item.priceScore),
                        referencePrice: String(item.referencePrice),
                        mainProducts: item.mainProducts,
                        note: item.note,
                      });
                    }}
                  >
                    编辑
                  </button>
                  <button type="button" className="btn-danger" onClick={() => void removeStore(item.id)}>
                    删除
                  </button>
                </div>
              </div>
            ))}
            {!stores.length && !loading ? <p className="muted">暂无店铺评价数据。</p> : null}
          </div>
        </article>
      </section>
    </>
  );
}
