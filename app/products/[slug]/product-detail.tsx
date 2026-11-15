"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { addCartQuantity, normalizeCart } from "../../../lib/cart-quantities";

const money = (value: number) => `${new Intl.NumberFormat("fa-IR").format(value || 0)} تومان`;

export default function ProductDetail({ slug }: { slug: string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState(0);
  const product = data?.product;

  useEffect(() => {
    fetch(`/api/products/${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "محصول پیدا نشد");
        setData(payload);
        const saved = normalizeCart(JSON.parse(localStorage.getItem("tab-ahmadi-cart") || "{}"));
        setQuantity(saved[payload.product.id] || 0);
      })
      .catch((reason) => setError(reason.message || "محصول پیدا نشد"));
  }, [slug]);

  function updateQuantity(next: number) {
    if (!product) return;
    const saved = normalizeCart(JSON.parse(localStorage.getItem("tab-ahmadi-cart") || "{}"));
    const capped = next <= 0 ? 0 : addCartQuantity(0, next, Number(product.stock));
    if (next > 0 && capped === 0) return;
    if (capped === 0) delete saved[product.id];
    else saved[product.id] = capped;
    localStorage.setItem("tab-ahmadi-cart", JSON.stringify(saved));
    setQuantity(capped);
  }

  if (error) return <main className="content-page" dir="rtl"><h1>{error}</h1><a className="primary" href="/">بازگشت به فروشگاه</a></main>;
  if (!data) return <main className="content-page" dir="rtl"><p>در حال بارگذاری…</p></main>;

  return <main dir="rtl" className="product-detail-page">
    <header className="content-header wrap"><a className="brand" href="/"><span className="brand-mark">ط</span><b>طب احمدی</b></a><a className="text-link" href="/">بازگشت به فروشگاه ←</a></header>
    <div className="wrap product-detail"><section className="product-detail-hero">
      <div className="product-detail-image">{product.image_url ? <img src={product.image_url} alt={product.name} /> : <span>❋</span>}</div>
      <div className="product-detail-copy"><div className="eyebrow">{product.category}</div><h1>{product.name}</h1><p className="lead">{product.short_description || product.description || ""}</p><div className="price-row"><b>{money(product.current_price_toman || product.price_toman)}</b>{product.compare_at_toman && <del>{money(product.compare_at_toman)}</del>}</div><p className={product.stock > 0 ? "stock-ok" : "stock-out"}>{product.stock > 0 ? `موجودی: ${new Intl.NumberFormat("fa-IR").format(product.stock)} عدد` : "فعلاً ناموجود"}</p>{product.stock > 0 && <div className="quantity-control" aria-label="تعداد محصول"><button type="button" aria-label="کاهش تعداد" onClick={() => updateQuantity(quantity - 1)}>−</button><output>{new Intl.NumberFormat("fa-IR").format(quantity)}</output><button type="button" aria-label="افزایش تعداد" onClick={() => updateQuantity(quantity + 1)}>+</button></div>}<a className="primary" href="/#shop">مشاهده سبد خرید ←</a><div className="product-facts"><span>شناسه کالا <b>{product.sku || "—"}</b></span><span>وزن/حجم <b>{product.net_weight || "—"}</b></span><span>مبدأ <b>{product.origin || "—"}</b></span></div></div>
    </section><section className="product-info-grid"><article><h2>معرفی محصول</h2><p>{product.description || ""}</p></article><article><h2>مزایا و کاربرد</h2><p>{product.benefits || ""}</p></article><article><h2>ترکیبات</h2><p>{product.ingredients || ""}</p></article><article><h2>روش مصرف</h2><p>{product.how_to_use || product.usage_text || ""}</p></article><article><h2>مناسب برای</h2><p>{product.suitable_for || ""}</p></article><article><h2>هشدار و نکات ایمنی</h2><p>{product.warning_text || ""}</p></article></section>{product.faq?.length > 0 && <section className="faq"><h2>پرسش‌های متداول</h2>{product.faq.map((item: any, index: number) => <details key={index}><summary>{item.q}</summary><p>{item.a}</p></details>)}</section>}<section className="related-products"><h2>محصولات مرتبط</h2><div className="related-grid">{data.related.map((item: any) => <a href={`/products/${item.slug}`} key={item.id}><b>{item.name}</b><span>{money(item.price_toman)}</span></a>)}</div></section></div>
  </main>;
}
