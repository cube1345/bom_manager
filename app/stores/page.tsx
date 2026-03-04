"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { StarRating, StarRatingInput } from "@/components/star-rating";
import type { StoreReview } from "@/lib/types";
import { formatTime, requestJson } from "@/lib/http-client";
import { useUiLang } from "@/lib/ui-language";

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

function normalizeStarValue(value: number) {
  const clamped = Math.max(0.5, Math.min(5, value));
  return Math.round(clamped * 2) / 2;
}

export default function StoresPage() {
  const lang = useUiLang();
  const [stores, setStores] = useState<StoreReview[]>([]);
  const [form, setForm] = useState<StoreForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const text =
    lang === "en"
      ? {
          loadError: "Failed to load store reviews",
          saveError: "Failed to save store review",
          deleteError: "Failed to delete store review",
          deleteConfirm: "Delete this store review?",
          title: "Store Reviews",
          subtitle: "Maintain platform stores with quality, shipping, pricing, and product notes.",
          editTitle: "Edit Store",
          createTitle: "New Store",
          platform: "Platform:",
          platformPlaceholder: "e.g. Taobao / LCSC",
          shopName: "Store Name:",
          shopNamePlaceholder: "Enter store name",
          qualityScore: "Quality Rating:",
          shippingFee: "Shipping Fee (CNY):",
          shippingFeePlaceholder: "e.g. 6.50",
          priceScore: "Price Rating:",
          referencePrice: "Reference Price (CNY/unit):",
          referencePricePlaceholder: "e.g. 0.15",
          mainProducts: "Main Products:",
          mainProductsPlaceholder: "e.g. chip resistors, capacitors",
          note: "Note:",
          notePlaceholder: "Additional notes",
          update: "Update",
          add: "Add",
          cancel: "Cancel",
          listTitle: "Store List",
          loading: "Loading...",
          qualityLine: "Quality:",
          priceLine: "Price:",
          shippingLine: "Shipping:",
          referenceLine: "Reference:",
          productsLine: "Main Products:",
          noteLine: "Note:",
          updatedAt: "Updated At:",
          editBtn: "Edit",
          deleteBtn: "Delete",
          empty: "No store review data yet.",
          currentScore: "Current score: ",
          outOfFive: "/ 5",
        }
      : {
          loadError: "加载失败",
          saveError: "保存失败",
          deleteError: "删除失败",
          deleteConfirm: "确认删除该店铺评价？",
          title: "平台店铺评价",
          subtitle: "维护各平台店铺的质量、邮费、价格与主卖品信息。",
          editTitle: "编辑店铺",
          createTitle: "新增店铺",
          platform: "平台：",
          platformPlaceholder: "例如：淘宝 / 立创商城",
          shopName: "店铺名称：",
          shopNamePlaceholder: "请输入店铺名称",
          qualityScore: "质量评分：",
          shippingFee: "平均邮费（元）：",
          shippingFeePlaceholder: "例如：6.50",
          priceScore: "价格评分：",
          referencePrice: "参考价格（元/个）：",
          referencePricePlaceholder: "例如：0.15",
          mainProducts: "主卖品：",
          mainProductsPlaceholder: "例如：贴片电阻、电容",
          note: "备注：",
          notePlaceholder: "可填写补充信息",
          update: "更新",
          add: "新增",
          cancel: "取消",
          listTitle: "店铺列表",
          loading: "加载中...",
          qualityLine: "质量评分：",
          priceLine: "价格评分：",
          shippingLine: "邮费：",
          referenceLine: "参考价格：",
          productsLine: "主卖品：",
          noteLine: "备注：",
          updatedAt: "更新时间：",
          editBtn: "编辑",
          deleteBtn: "删除",
          empty: "暂无店铺评价数据。",
          currentScore: "当前评分：",
          outOfFive: " / 5",
        };

  const loadStores = useCallback(async () => {
    setLoading(true);
    try {
      const data = await requestJson<StoreReview[]>("/api/stores");
      setStores(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : text.loadError);
    } finally {
      setLoading(false);
    }
  }, [text.loadError]);

  useEffect(() => {
    void loadStores();
  }, [loadStores]);

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
      setError(err instanceof Error ? err.message : text.saveError);
    }
  }

  async function removeStore(id: string) {
    if (!window.confirm(text.deleteConfirm)) {
      return;
    }

    setError("");
    try {
      await requestJson(`/api/stores/${id}`, { method: "DELETE" });
      await loadStores();
    } catch (err) {
      setError(err instanceof Error ? err.message : text.deleteError);
    }
  }

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
          <h2>{editingId ? text.editTitle : text.createTitle}</h2>
          <form className="stack-form" onSubmit={submitStore}>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="store-platform">
                  {text.platform}
                </label>
                <span className="field-required" aria-hidden="true">
                  *
                </span>
              </div>
              <input
                id="store-platform"
                value={form.platform}
                onChange={(event) => setForm((prev) => ({ ...prev, platform: event.target.value }))}
                placeholder={text.platformPlaceholder}
                required
              />
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="store-name">
                  {text.shopName}
                </label>
                <span className="field-required" aria-hidden="true">
                  *
                </span>
              </div>
              <input
                id="store-name"
                value={form.shopName}
                onChange={(event) => setForm((prev) => ({ ...prev, shopName: event.target.value }))}
                placeholder={text.shopNamePlaceholder}
                required
              />
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="store-quality-score">
                  {text.qualityScore}
                </label>
                <span className="field-required" aria-hidden="true">
                  *
                </span>
              </div>
              <div id="store-quality-score">
                <StarRatingInput
                  lang={lang}
                  value={Number(form.qualityScore || 0)}
                  onChange={(next) => setForm((prev) => ({ ...prev, qualityScore: String(normalizeStarValue(next)) }))}
                />
              </div>
              <p className="muted">
                {text.currentScore}
                {normalizeStarValue(Number(form.qualityScore || 0)).toFixed(1)}
                {text.outOfFive}
              </p>
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="store-price-score">
                  {text.priceScore}
                </label>
                <span className="field-required" aria-hidden="true">
                  *
                </span>
              </div>
              <div id="store-price-score">
                <StarRatingInput
                  lang={lang}
                  value={Number(form.priceScore || 0)}
                  onChange={(next) => setForm((prev) => ({ ...prev, priceScore: String(normalizeStarValue(next)) }))}
                />
              </div>
              <p className="muted">
                {text.currentScore}
                {normalizeStarValue(Number(form.priceScore || 0)).toFixed(1)}
                {text.outOfFive}
              </p>
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="store-shipping-fee">
                  {text.shippingFee}
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
                placeholder={text.shippingFeePlaceholder}
                required
              />
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="store-reference-price">
                  {text.referencePrice}
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
                placeholder={text.referencePricePlaceholder}
                required
              />
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="store-main-products">
                  {text.mainProducts}
                </label>
              </div>
              <textarea
                id="store-main-products"
                rows={2}
                value={form.mainProducts}
                onChange={(event) => setForm((prev) => ({ ...prev, mainProducts: event.target.value }))}
                placeholder={text.mainProductsPlaceholder}
              />
            </div>
            <div className="form-field">
              <div className="field-head">
                <label className="field-label" htmlFor="store-note">
                  {text.note}
                </label>
              </div>
              <textarea
                id="store-note"
                rows={2}
                value={form.note}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                placeholder={text.notePlaceholder}
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
                    setForm(initialForm);
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
          <div className="type-list">
            {stores.map((item) => (
              <div className="type-item" key={item.id}>
                <div>
                  <strong>
                    {item.platform} / {item.shopName}
                  </strong>
                  <p>
                    {text.qualityLine} <StarRating value={item.qualityScore} /> {item.qualityScore.toFixed(1)} / 5
                  </p>
                  <p>
                    {text.priceLine} <StarRating value={item.priceScore} /> {item.priceScore.toFixed(1)} / 5
                  </p>
                  <p>{text.shippingLine} ¥{item.shippingFee.toFixed(2)}</p>
                  <p>{text.referenceLine} ¥{item.referencePrice.toFixed(2)}{lang === "en" ? "/unit" : "/个"}</p>
                  <p>{text.productsLine} {item.mainProducts || "-"}</p>
                  <p>{text.noteLine} {item.note || "-"}</p>
                  <p>{text.updatedAt} {formatTime(item.updatedAt)}</p>
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
                    {text.editBtn}
                  </button>
                  <button type="button" className="btn-danger" onClick={() => void removeStore(item.id)}>
                    {text.deleteBtn}
                  </button>
                </div>
              </div>
            ))}
            {!stores.length && !loading ? <p className="muted">{text.empty}</p> : null}
          </div>
        </article>
      </section>
    </>
  );
}
