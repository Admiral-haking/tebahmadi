"use client";

import { useState } from "react";
import { VariantManager } from "./variant-manager";

type Product = {
  id: string;
  name: string;
  category: string;
  price_toman: number;
  stock: number;
  active: number;
  description?: string;
  ingredients?: string;
  usage_text?: string;
  warning_text?: string;
  sku?: string;
};

export function ProductStockEditor({ product, onSaved }: { product: Product; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(String(product.price_toman));
  const [stock, setStock] = useState(String(product.stock));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const nextPrice = Number(price);
    const nextStock = Number(stock);
    if (!Number.isSafeInteger(nextPrice) || nextPrice < 1 || !Number.isSafeInteger(nextStock) || nextStock < 0 || nextStock > 100000) {
      setError("قیمت و موجودی را بررسی کنید");
      return;
    }
    setBusy(true);
    setError("");
    const response = await fetch(`/api/admin/products/${product.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: product.name, category: product.category, priceToman: nextPrice, stock: nextStock, active: !!product.active, description: product.description, ingredients: product.ingredients, usage: product.usage_text, warning: product.warning_text, sku: product.sku }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("به‌روزرسانی محصول انجام نشد");
      return;
    }
    setOpen(false);
    onSaved();
  }

  if (!open) return <><button type="button" onClick={() => setOpen(true)} aria-label="ویرایش قیمت و موجودی">✎</button><VariantManager product={product} onSaved={onSaved} /></>;
  return <div className="inline-product-editor" role="group" aria-label={`ویرایش ${product.name}`}>
    <label>قیمت<input type="number" min="1" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
    <label>موجودی<input type="number" min="0" max="100000" value={stock} onChange={(event) => setStock(event.target.value)} /></label>
    {error && <small role="alert">{error}</small>}
    <button type="button" className="admin-button" disabled={busy} onClick={save}>{busy ? "در حال ذخیره…" : "ذخیره"}</button>
    <button type="button" className="admin-outline" onClick={() => setOpen(false)}>لغو</button>
  </div>;
}
