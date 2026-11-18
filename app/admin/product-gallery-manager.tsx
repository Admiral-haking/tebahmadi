"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";

type ImageRow = { id: string; url: string; original_name?: string; alt_text?: string; is_primary?: number; sort_order?: number; variant_id?: string | null };
type Variant = { id: string; title: string };

export function ProductGalleryManager({ productId, productName }: { productId: string; productName: string }) {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<ImageRow[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [variantId, setVariantId] = useState("");
  const [altText, setAltText] = useState("");
  const [primary, setPrimary] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const [mediaResponse, variantsResponse] = await Promise.all([fetch(`/api/admin/media?productId=${encodeURIComponent(productId)}`, { cache: "no-store" }), fetch(`/api/admin/products/${encodeURIComponent(productId)}/variants`, { cache: "no-store" })]);
    const media = await mediaResponse.json().catch(() => ({}));
    const variantData = await variantsResponse.json().catch(() => ({}));
    setImages(Array.isArray(media.images) ? media.images : []);
    setVariants(Array.isArray(variantData.variants) ? variantData.variants : []);
  }

  // The loader is intentionally scoped to this product and only runs when the drawer opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) void load(); }, [open]);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return setMessage("یک فایل تصویر انتخاب کنید.");
    setBusy(true); setMessage("");
    const body = new FormData(); body.append("file", file); body.append("productId", productId); body.append("variantId", variantId); body.append("altText", altText || productName); body.append("isPrimary", String(primary));
    const response = await fetch("/api/admin/media", { method: "POST", body });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setMessage(data.error || "بارگذاری تصویر انجام نشد.");
    setFile(null); setAltText(""); setPrimary(false); setMessage("تصویر ذخیره شد."); await load();
  }

  async function update(image: ImageRow, values: Partial<{ isPrimary: boolean; sortOrder: number; variantId: string | null }>) {
    setBusy(true); setMessage("");
    const response = await fetch("/api/admin/media", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: image.id, ...values }) });
    const data = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) return setMessage(data.error || "ویرایش تصویر انجام نشد.");
    await load();
  }

  async function remove(image: ImageRow) {
    if (!window.confirm("این تصویر حذف شود؟")) return;
    setBusy(true); const response = await fetch(`/api/admin/media?id=${encodeURIComponent(image.id)}`, { method: "DELETE" }); setBusy(false);
    if (!response.ok) { setMessage("حذف تصویر انجام نشد."); return; } await load();
  }

  return <section className="product-gallery-manager">
    <button type="button" className="admin-outline gallery-toggle" aria-expanded={open} onClick={() => setOpen(value => !value)}>گالری تصاویر {images.length ? `(${new Intl.NumberFormat("fa-IR").format(images.length)})` : ""}</button>
    {open && <div className="gallery-editor">
      <form className="gallery-upload" onSubmit={upload}><label>تصویر جدید<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => setFile(event.target.files?.[0] || null)} required /></label><label>اتصال به واریانت<select value={variantId} onChange={event => setVariantId(event.target.value)}><option value="">تصویر عمومی محصول</option>{variants.map(variant => <option value={variant.id} key={variant.id}>{variant.title}</option>)}</select></label><label>متن جایگزین<input value={altText} onChange={event => setAltText(event.target.value)} placeholder={productName} maxLength={180} /></label><label className="gallery-check"><input type="checkbox" checked={primary} onChange={event => setPrimary(event.target.checked)} /> تصویر اصلی</label><button className="admin-button" disabled={busy}>بارگذاری تصویر</button></form>
      {message && <p className="admin-inline-message" role="status">{message}</p>}
      <div className="gallery-grid">{images.length ? images.map(image => <article className={image.is_primary ? "gallery-item is-primary" : "gallery-item"} key={image.id}><img src={image.url} alt={image.alt_text || productName} /><div className="gallery-item-actions"><label>ترتیب<input type="number" min="0" value={image.sort_order ?? 0} onChange={event => void update(image, { sortOrder: Number(event.target.value) })} /></label><select value={image.variant_id || ""} onChange={event => void update(image, { variantId: event.target.value || null })}><option value="">عمومی</option>{variants.map(variant => <option value={variant.id} key={variant.id}>{variant.title}</option>)}</select><button type="button" className="admin-outline" disabled={busy || Boolean(image.is_primary)} onClick={() => void update(image, { isPrimary: true })}>{image.is_primary ? "تصویر اصلی" : "انتخاب اصلی"}</button><button type="button" className="admin-danger" disabled={busy} onClick={() => void remove(image)}>حذف</button></div></article>) : <p className="admin-empty">هنوز تصویری برای این محصول ثبت نشده است.</p>}</div>
    </div>}
  </section>;
}
