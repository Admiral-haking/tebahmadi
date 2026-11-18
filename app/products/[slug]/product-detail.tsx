"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import { addCartQuantity, normalizeCart } from "../../../lib/cart-quantities";
import { cartLineKey } from "../../../lib/storefront-cart";
import { StoreHeader } from "../../../components/store-header";
import { BrandLogo } from "../../../components/brand-logo";

const money = (value: number) => `${new Intl.NumberFormat("fa-IR").format(value || 0)} تومان`;

export default function ProductDetail({ slug }: { slug: string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [variantId, setVariantId] = useState("");
  const [added, setAdded] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const product = data?.product;
  const variants = useMemo(() => Array.isArray(product?.variants) ? product.variants : [], [product]);
  const variant = variants.find((item: any) => item.id === variantId) || variants[0];
  const available = Number(variant?.available_quantity ?? product?.stock ?? 0);
  const price = Number(variant?.price_toman ?? product?.current_price_toman ?? product?.price_toman ?? 0);
  const cartKey = cartLineKey(product?.id || "", variant?.id);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/products/${encodeURIComponent(slug)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "محصول پیدا نشد");
        if (controller.signal.aborted) return;
        setData(payload);
        const firstVariant = payload.product.variants?.[0];
        setVariantId(firstVariant?.id || "");
        try {
          const saved = normalizeCart(JSON.parse(localStorage.getItem("tab-ahmadi-cart") || "{}"));
          setQuantity(saved[firstVariant?.id || payload.product.id] || saved[payload.product.id] || 0);
        } catch { setQuantity(0); }
      })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message || "محصول پیدا نشد"); });
    return () => controller.abort();
  }, [slug]);

  useEffect(() => {
    if (!product) return;
    try {
      const saved = normalizeCart(JSON.parse(localStorage.getItem("tab-ahmadi-cart") || "{}"));
      setQuantity(saved[cartKey] || 0);
    } catch { setQuantity(0); }
  }, [cartKey, product]);

  function updateQuantity(requested: number) {
    if (!product) return;
    let saved = {};
    try { saved = normalizeCart(JSON.parse(localStorage.getItem("tab-ahmadi-cart") || "{}")); } catch { /* recover from malformed local cart */ }
    const capped = requested <= 0 ? 0 : addCartQuantity(0, requested, available);
    if (requested > 0 && capped === 0) return;
    if (capped === 0) delete (saved as Record<string, number>)[cartKey];
    else (saved as Record<string, number>)[cartKey] = capped;
    localStorage.setItem("tab-ahmadi-cart", JSON.stringify(saved));
    setQuantity(capped);
    setAdded(capped > 0);
    window.setTimeout(() => setAdded(false), 1800);
  }

  if (error) return <main className="content-page" dir="rtl"><section className="catalog-state catalog-state-error"><h1>{error}</h1><a className="primary" href="/products">بازگشت به محصولات</a></section></main>;
  if (!data) return <main className="content-page" dir="rtl"><div className="wrap product-detail"><p role="status">در حال بارگذاری اطلاعات محصول…</p></div></main>;

  const details = [
    ["معرفی محصول", product.description], ["مزایا و کاربرد", Array.isArray(product.benefits) ? product.benefits.join("\n") : product.benefits],
    ["ترکیبات", product.ingredients], ["روش مصرف", product.how_to_use || product.usage_text],
    ["مناسب برای", product.suitable_for], ["هشدار و نکات ایمنی", product.warning_text],
  ].filter(([, content]) => String(content || "").trim());

  return <main dir="rtl" className="product-detail-page">
    <StoreHeader />
    <div className="wrap product-detail">
      <section className="product-detail-hero">
        <div className="product-detail-media">{(product.images?.[selectedImage]?.url || product.image_url) ? <img className="product-detail-image" src={product.images?.[selectedImage]?.url || product.image_url} alt={product.images?.[selectedImage]?.alt_text || product.name} /> : <div className="product-detail-placeholder"><BrandLogo /><small>تصویر این محصول به‌زودی اضافه می‌شود</small></div>}{product.images?.length > 1 && <div className="product-image-thumbs" aria-label="تصاویر محصول">{product.images.map((image: any, index: number) => <button type="button" className={selectedImage === index ? "is-active" : ""} key={image.id} onClick={() => setSelectedImage(index)}><img src={image.url} alt={image.alt_text || `${product.name} تصویر ${index + 1}`} /></button>)}</div>}</div>
        <div className="product-detail-copy">
          <a className="product-back-link" href="/products">فروشگاه{product.category ? ` / ${product.category}` : ""}</a>
          <h1>{product.name}</h1>
          {(product.short_description || product.description) && <p className="lead">{product.short_description || product.description}</p>}
          {variants.length > 1 && <label className="detail-variant-picker">انتخاب مدل<select value={variant?.id || ""} onChange={(event) => setVariantId(event.target.value)}>{variants.map((item: any) => <option key={item.id} value={item.id} disabled={Number(item.available_quantity) < 1}>{item.title}{item.available_quantity < 1 ? " · ناموجود" : ` · ${money(item.price_toman)}`}</option>)}</select></label>}
          <div className="price-row"><b>{money(price)}</b>{(variant?.compare_at_toman || product.compare_at_toman) && <del>{money(Number(variant?.compare_at_toman || product.compare_at_toman))}</del>}</div>
          <p className={available > 0 ? "stock-ok" : "stock-out"}>{available > 0 ? `موجود · ${new Intl.NumberFormat("fa-IR").format(available)} عدد` : "فعلاً ناموجود"}</p>
          {available > 0 && <div className="product-purchase"><div className="quantity-control" aria-label="تعداد محصول"><button type="button" aria-label="کاهش تعداد" onClick={() => updateQuantity(quantity - 1)}>−</button><output>{new Intl.NumberFormat("fa-IR").format(quantity)}</output><button type="button" aria-label="افزایش تعداد" disabled={quantity >= available} onClick={() => updateQuantity(quantity + 1)}>+</button></div><button type="button" className="primary product-add-button" onClick={() => updateQuantity(quantity || 1)}>{added ? "به‌روزرسانی سبد انجام شد" : quantity ? "در سبد خرید" : "افزودن به سبد خرید"}</button></div>}
          <a className="product-cart-link" href="/#shop">ادامه خرید</a>
          <div className="product-facts"><span>شناسه کالا <b>{variant?.sku || product.sku || "—"}</b></span><span>وزن/حجم <b>{product.net_weight || (variant?.weight_grams ? `${variant.weight_grams} گرم` : "—")}</b></span>{product.origin && <span>مبدأ <b>{product.origin}</b></span>}</div>
        </div>
      </section>
      {details.length > 0 && <section className="product-info-grid">{details.map(([title, content]) => <article key={title}><h2>{title}</h2><p>{content}</p></article>)}</section>}
      {product.faq?.length > 0 && <section className="faq"><h2>پرسش‌های متداول</h2>{product.faq.map((item: any, index: number) => <details key={index}><summary>{item.q}</summary><p>{item.a}</p></details>)}</section>}
      {data.related?.length > 0 && <section className="related-products"><h2>محصولات مرتبط</h2><div className="related-grid">{data.related.map((item: any) => <a href={`/products/${item.slug}`} key={item.id}><b>{item.name}</b><span>{money(item.price_toman)}</span></a>)}</div></section>}
    </div>
  </main>;
}
