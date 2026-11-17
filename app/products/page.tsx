"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RemoteImage } from "../../components/remote-image";
import { StoreHeader } from "../../components/store-header";

type Product = {
  id: string;
  slug: string;
  name: string;
  category?: string | null;
  image_url?: string | null;
  short_description?: string | null;
  description?: string | null;
  current_price_toman?: number;
  price_toman?: number;
};

const money = (n: number) => new Intl.NumberFormat("fa-IR").format(n || 0) + " تومان";
const normalize = (value: string) => value
  .normalize("NFKC")
  .replace(/[يى]/g, "ی")
  .replace(/ك/g, "ک")
  .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
  .replace(/[\u064B-\u065F\u0670]/g, "")
  .replace(/\s+/g, " ")
  .trim()
  .toLocaleLowerCase("fa-IR");

export default function ProductsPage() {
  const [rows, setRows] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("همه محصولات");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProducts = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/products", { cache: "no-store", signal });
      if (!response.ok) throw new Error("دریافت محصولات انجام نشد.");
      const data = await response.json();
      setRows(Array.isArray(data.products) ? data.products : []);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError("بارگذاری محصولات با مشکل روبه‌رو شد. اتصال را بررسی کنید و دوباره تلاش کنید.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadProducts(controller.signal);
    return () => controller.abort();
  }, [loadProducts]);

  const categories = useMemo(() => [
    "همه محصولات",
    ...Array.from(new Set(rows.map((product) => product.category?.trim()).filter((value): value is string => Boolean(value)))),
  ], [rows]);

  const visibleProducts = useMemo(() => {
    const needle = normalize(query);
    return rows.filter((product) => {
      const matchesCategory = category === "همه محصولات" || product.category?.trim() === category;
      const searchable = normalize(`${product.name} ${product.category || ""} ${product.short_description || ""} ${product.description || ""}`);
      return matchesCategory && (!needle || searchable.includes(needle));
    });
  }, [category, query, rows]);

  return (
    <main dir="rtl" className="content-page catalog-page">
      <StoreHeader />
      <div className="wrap catalog-content">
        <header className="catalog-heading">
          <div>
            <span className="eyebrow">فروشگاه طب احمدی</span>
            <h1>محصولات</h1>
            <p className="page-lead">مشخصات، ترکیبات، وزن و روش مصرف را پیش از خرید بررسی کنید.</p>
          </div>
          {!loading && !error && <span className="catalog-result-count">{new Intl.NumberFormat("fa-IR").format(visibleProducts.length)} محصول</span>}
        </header>

        <div className="catalog-controls">
          <label className="catalog-search-label">
            <span>جستجو در محصولات</span>
            <input className="catalog-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="نام یا کاربرد محصول…" />
          </label>
          {query && <button className="catalog-clear" type="button" onClick={() => setQuery("")}>پاک کردن جستجو</button>}
        </div>

        {!error && categories.length > 1 && (
          <nav className="catalog-filters" aria-label="فیلتر دسته‌بندی محصولات">
            {categories.map((item) => (
              <button key={item} type="button" className={category === item ? "catalog-filter is-active" : "catalog-filter"} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>
            ))}
          </nav>
        )}

        {error ? (
          <section className="catalog-state catalog-state-error" role="alert">
            <h2>نمایش محصولات ممکن نیست</h2><p>{error}</p>
            <button className="primary" type="button" onClick={() => void loadProducts()}>تلاش دوباره</button>
          </section>
        ) : loading ? (
          <div className="catalog-grid" aria-label="در حال بارگذاری محصولات" aria-busy="true">
            {Array.from({ length: 6 }, (_, index) => <div className="catalog-skeleton" key={index}><span /><i /><i /><b /></div>)}
          </div>
        ) : visibleProducts.length ? (
          <div className="catalog-grid">
            {visibleProducts.map((product) => (
              <a className="catalog-card" href={`/products/${product.slug}`} key={product.id}>
                {product.image_url ? <RemoteImage src={product.image_url} alt={product.name} /> : <div className="catalog-placeholder"><span aria-hidden="true">⌁</span><b>طب احمدی</b></div>}
                {product.category && <small>{product.category}</small>}
                <h2>{product.name}</h2>
                {(product.short_description || product.description) && <p>{product.short_description || product.description}</p>}
                <div className="catalog-card-footer"><b>{money(product.current_price_toman || product.price_toman || 0)}</b><span>مشاهده و انتخاب <span aria-hidden="true">←</span></span></div>
              </a>
            ))}
          </div>
        ) : (
          <section className="catalog-state">
            <span aria-hidden="true">⌕</span>
            <h2>{rows.length ? "محصولی با این مشخصات پیدا نشد" : "هنوز محصولی برای نمایش ثبت نشده است"}</h2>
            <p>{rows.length ? "عبارت جستجو یا دسته‌بندی را تغییر دهید." : "بعداً دوباره به فروشگاه سر بزنید."}</p>
            {(query || category !== "همه محصولات") && <button className="admin-outline" type="button" onClick={() => { setQuery(""); setCategory("همه محصولات"); }}>پاک کردن فیلترها</button>}
          </section>
        )}
      </div>
    </main>
  );
}
