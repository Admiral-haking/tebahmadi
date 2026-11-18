"use client";
import { useCallback, useEffect, useState } from "react";

const labels: Record<string, string> = {
  pending: "در انتظار پرداخت",
  paid: "پرداخت‌شده",
  processing: "در حال آماده‌سازی",
  shipped: "ارسال‌شده",
  cancelled: "لغوشده",
  refunded: "مرجوع‌شده",
  shipping_quoted: "هزینه ارسال استعلام شد",
  shipping_registered: "مرسوله ثبت شد",
  shipping_in_transit: "مرسوله در مسیر است",
  shipping_delivered: "مرسوله تحویل شد",
  shipping_failed: "ثبت مرسوله ناموفق بود",
  shipping_cancelled: "ارسال لغو شد",
};
const shippingLabels: Record<string, string> = {
  unquoted: "ثبت نشده",
  quoted: "استعلام شده",
  registered: "ثبت‌شده در تاپین",
  in_transit: "در مسیر",
  delivered: "تحویل‌شده",
  failed: "خطا",
  cancelled: "لغوشده",
};
const money = (n: number) =>
  new Intl.NumberFormat("fa-IR").format(Number(n || 0)) + " تومان";

export function OrderCenter({ role }: { role: string }) {
  const [rows, setRows] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(null),
    [events, setEvents] = useState<any[]>([]),
    [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [summary, setSummary] = useState<any>({}),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [shippingFilter, setShippingFilter] = useState(""),
    [page, setPage] = useState(1),
    [tapinProvince, setTapinProvince] = useState("1"),
    [tapinCity, setTapinCity] = useState("1"),
    [tapinWeight, setTapinWeight] = useState("1000");
  const canEdit = ["owner", "admin", "manager"].includes(role);
  const load = useCallback(async () => {
    const r = await fetch(
        `/api/admin/order-center?q=${encodeURIComponent(q)}&status=${status}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&shippingStatus=${encodeURIComponent(shippingFilter)}&page=${page}`,
        { cache: "no-store" },
      ),
      d = await r.json();
    if (r.ok) {
      setRows(d.orders || []);
      setSummary({ ...(d.summary || {}), totalPages: d.totalPages || 1 });
    } else setMessage(d.error || "خواندن سفارش‌ها ناموفق بود");
  }, [from, page, q, shippingFilter, status, to]);
  async function detail(id: string) {
    const r = await fetch(
        `/api/admin/order-center?id=${encodeURIComponent(id)}`,
        { cache: "no-store" },
      ),
      d = await r.json();
    if (r.ok) {
      setSelected(d.order);
      setEvents(d.events || []);
    }
  }
  useEffect(() => {
    void load();
  }, [load]);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const f = new FormData(e.currentTarget),
      body = Object.fromEntries(f);
    setBusy(true);
    const r = await fetch("/api/admin/order-center", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, ...body }),
      }),
      d = await r.json();
    setBusy(false);
    setMessage(r.ok ? "اطلاعات سفارش ذخیره شد" : d.error || "ذخیره انجام نشد");
    if (r.ok) {
      await detail(selected.id);
      await load();
    }
  }
  async function registerTapin() {
    if (!selected) return;
    const postalCode = selected.postal_code,
      provinceCode = Number(tapinProvince),
      cityCode = Number(tapinCity),
      weightGrams = Number(tapinWeight);
    if (!postalCode) {
      setMessage("کد پستی برای ثبت در تاپین لازم است");
      return;
    }
    if (
      !Number.isSafeInteger(provinceCode) ||
      provinceCode < 1 ||
      !Number.isSafeInteger(cityCode) ||
      cityCode < 1 ||
      !Number.isSafeInteger(weightGrams) ||
      weightGrams < 1 ||
      weightGrams > 100000
    ) {
      setMessage("کد استان، شهر و وزن مرسوله را بررسی کنید");
      return;
    }
    setBusy(true);
    const r = await fetch("/api/admin/shipping/tapin/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selected.id,
          provinceCode,
          cityCode,
          weightGrams,
          recipient: {
            name: selected.customer_name,
            mobile: selected.phone,
            address: selected.address,
            postalCode,
          },
          items: selected.items,
        }),
      }),
      d = await r.json();
    setBusy(false);
    setMessage(
      r.ok ? "مرسوله در تاپین ثبت شد" : d.error || "ثبت در تاپین ناموفق بود",
    );
    if (r.ok) {
      await detail(selected.id);
      await load();
    }
  }
  async function trackShipment() {
    if (
      !selected ||
      (!selected.tracking_code && !selected.shipment_tracking_code)
    ) {
      setMessage("کد رهگیری برای پیگیری لازم است");
      return;
    }
    setBusy(true);
    const r = await fetch("/api/admin/shipping/tapin/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: selected.id,
        trackingCode: selected.tracking_code || selected.shipment_tracking_code,
      }),
    });
    const d = await r.json();
    setBusy(false);
    setMessage(
      r.ok
        ? "وضعیت مرسوله به‌روزرسانی شد"
        : d.error || "پیگیری مرسوله ناموفق بود",
    );
    if (r.ok) {
      await detail(selected.id);
      await load();
    }
  }
  return (
    <div className="order-center admin-order-center">
      <section className="admin-panel order-center-panel">
        <div className="admin-panel-head order-center-head">
          <div className="order-center-title">
            <span className="order-center-eyebrow">عملیات روزانه</span>
            <h2>مرکز عملیات سفارش</h2>
            <p className="commerce-note">
              سفارش‌ها را بررسی کنید، اطلاعات گیرنده را کامل کنید و وضعیت ارسال را از همین‌جا مدیریت کنید.
            </p>
          </div>
          <a
            className="admin-button order-export"
            href={`/api/admin/order-center/export?q=${encodeURIComponent(q)}&status=${status}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&shippingStatus=${encodeURIComponent(shippingFilter)}`}
          >
            دانلود خروجی CSV
          </a>
        </div>
        <div className="order-summary" aria-label="خلاصه سفارش‌ها">
          <span className="summary-total">
            کل <b>{summary.count || 0}</b>
          </span>
          <span className="summary-paid">
            وصول‌شده <b>{summary.paid || 0}</b>
          </span>
          <span className="summary-ready">
            آماده ارسال <b>{summary.readyToShip || 0}</b>
          </span>
          <span className="summary-shipped">
            ثبت‌شده در ارسال <b>{summary.shipped || 0}</b>
          </span>
          <span className="summary-revenue">
            فروش <b>{money(summary.revenueToman)}</b>
          </span>
        </div>
        <div className="order-filter-box">
          <div className="order-filter-heading">
            <div>
              <strong>فیلتر سفارش‌ها</strong>
              <span>جستجو بر اساس شماره سفارش، نام مشتری یا موبایل</span>
            </div>
            {(q || status || shippingFilter || from || to) && (
              <button className="filter-reset" type="button" onClick={() => { setQ(""); setStatus(""); setShippingFilter(""); setFrom(""); setTo(""); setPage(1); }}>
                حذف فیلترها
              </button>
            )}
          </div>
          <div className="order-filters">
            <label className="order-search-field">
              <span>جستجو</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()}
                placeholder="شماره سفارش، نام یا موبایل"
              />
            </label>
            <label>
              <span>وضعیت سفارش</span>
              <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="">همه وضعیت‌ها</option>
                {Object.entries(labels).map(([v, l]) => <option value={v} key={v}>{l}</option>)}
              </select>
            </label>
            <label>
              <span>وضعیت ارسال</span>
              <select value={shippingFilter} onChange={(e) => { setShippingFilter(e.target.value); setPage(1); }}>
                <option value="">همه ارسال‌ها</option>
                {Object.entries(shippingLabels).map(([v, l]) => <option value={v} key={v}>{l}</option>)}
              </select>
            </label>
            <label>
              <span>از تاریخ</span>
              <input type="date" lang="fa-IR" dir="ltr" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
            </label>
            <label>
              <span>تا تاریخ</span>
              <input type="date" lang="fa-IR" dir="ltr" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
            </label>
            <button className="admin-button filter-submit" type="button" onClick={() => { setPage(1); void load(); }}>
              اعمال فیلتر
            </button>
          </div>
        </div>
        {message && (
          <div className="admin-message" role="status">
            {message}
          </div>
        )}
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>سفارش</th>
                <th>مشتری</th>
                <th>مبلغ</th>
                <th>وضعیت</th>
                <th>ارسال</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="order-code">{row.id.slice(0, 10)}</td>
                  <td>
                    <b>{row.customer_name}</b>
                    <small>{row.phone}</small>
                  </td>
                  <td>{money(row.subtotal_toman)}</td>
                  <td>{labels[row.status] || row.status}</td>
                  <td>
                    {shippingLabels[row.shipping_status] ||
                      row.shipping_status ||
                      "—"}
                    <small>
                      {row.tracking_code || row.shipment_tracking_code || ""}
                    </small>
                  </td>
                  <td>
                    <button
                      className="admin-outline"
                      onClick={() => detail(row.id)}
                    >
                      جزئیات
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <div className="admin-empty order-empty">
            <span className="order-empty-icon" aria-hidden="true">⌕</span>
            <strong>{q || status || shippingFilter || from || to ? "سفارشی با این فیلتر پیدا نشد" : "هنوز سفارشی ثبت نشده است"}</strong>
            <small>{q || status || shippingFilter || from || to ? "فیلترها را تغییر دهید یا حذف کنید تا سفارش‌های بیشتری ببینید." : "با ثبت سفارش جدید، وضعیت آن در اینجا نمایش داده می‌شود."}</small>
          </div>}
          {rows.length > 0 && (
            <div className="order-pagination">
              <button
                className="admin-outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                قبلی
              </button>
              <span>صفحه {new Intl.NumberFormat("fa-IR").format(page)}</span>
              <button
                className="admin-outline"
                disabled={page >= Number(summary.totalPages || 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                بعدی
              </button>
            </div>
          )}
        </div>
      </section>
      {selected && (
        <section className="admin-panel order-detail-panel">
          <div className="admin-panel-head">
            <h2>جزئیات سفارش {selected.id.slice(0, 10)}</h2>
            <button className="admin-outline" onClick={() => setSelected(null)}>
              بستن
            </button>
          </div>
          <div className="order-detail-grid">
            <div>
              <h3>مشتری و گیرنده</h3>
              {canEdit ? (
                <form className="product-form" onSubmit={save}>
                  <label>
                    نام مشتری
                    <input name="name" defaultValue={selected.customer_name} />
                  </label>
                  <label>
                    موبایل
                    <input name="phone" defaultValue={selected.phone} />
                  </label>
                  <label>
                    آدرس
                    <textarea
                      name="address"
                      defaultValue={selected.address}
                      rows={3}
                    />
                  </label>
                  <label>
                    کد پستی
                    <input
                      name="postalCode"
                      defaultValue={selected.postal_code || ""}
                      maxLength={10}
                    />
                  </label>
                  <label>
                    وضعیت سفارش
                    <select name="status" defaultValue={selected.status}>
                      {Object.entries(labels).filter(([v]) => !["paid", "refunded"].includes(v) || v === selected.status).map(([v, l]) => (
                        <option value={v} key={v} disabled={["paid", "refunded"].includes(v)}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    وضعیت ارسال
                    <select
                      name="shippingStatus"
                      defaultValue={selected.shipping_status || "unquoted"}
                    >
                      {Object.entries(shippingLabels).map(([v, l]) => (
                        <option value={v} key={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    کد رهگیری
                    <input
                      name="trackingCode"
                      defaultValue={selected.tracking_code || ""}
                      maxLength={120}
                      dir="ltr"
                      placeholder="در صورت ثبت دستی"
                    />
                  </label>
                  <label>
                    یادداشت داخلی
                    <textarea
                      name="note"
                      rows={2}
                      placeholder="یادداشت عملیات"
                    />
                  </label>
                  <button className="admin-button" disabled={busy}>
                    ذخیره تغییرات
                  </button>
                </form>
              ) : (
                <p>
                  {selected.customer_name}
                  <br />
                  {selected.phone}
                  <br />
                  {selected.address}
                  <br />
                  {selected.postal_code || "کد پستی ثبت نشده"}
                </p>
              )}
            </div>
            <div>
              <h3>اقلام سفارش</h3>
              {(selected.items || []).map((item: any, i: number) => (
                <div className="commerce-row" key={i}>
                  <span>
                    {item.name} × {item.quantity}
                  </span>
                  <b>{money(item.price || item.priceToman)}</b>
                </div>
              ))}
              <div className="cart-total">
                <span>جمع</span>
                <b>{money(selected.subtotal_toman)}</b>
              </div>
              <h3>پرداخت و عودت</h3>
              <p>
                وضعیت پرداخت: {selected.payment_status || "—"}
                <br />
                وضعیت عملیات عودت: {selected.refund_operation_status || "ثبت نشده"}
                {selected.refund_provider_reference && <><br />مرجع provider: <span dir="ltr">{selected.refund_provider_reference}</span></>}
                {selected.refund_last_error && <><br />خطای آخر: {selected.refund_last_error}</>}
              </p>
              <h3>ارسال پست پیشتاز / تاپین</h3>
              {canEdit && (
                <div className="admin-form-row">
                  <label>
                    کد استان
                    <input
                      inputMode="numeric"
                      value={tapinProvince}
                      onChange={(e) => setTapinProvince(e.target.value)}
                      min="1"
                    />
                  </label>
                  <label>
                    کد شهر
                    <input
                      inputMode="numeric"
                      value={tapinCity}
                      onChange={(e) => setTapinCity(e.target.value)}
                      min="1"
                    />
                  </label>
                  <label>
                    وزن (گرم)
                    <input
                      inputMode="numeric"
                      value={tapinWeight}
                      onChange={(e) => setTapinWeight(e.target.value)}
                      min="1"
                    />
                  </label>
                </div>
              )}
              <p>
                وضعیت: {shippingLabels[selected.shipping_status] || "ثبت نشده"}
                <br />
                کد رهگیری:{" "}
                {selected.tracking_code ||
                  selected.shipment_tracking_code ||
                  "—"}
                {selected.shipment_last_error && <div className="shipment-error-help" role="status"><b>ثبت مرسوله کامل نشد</b><span>{selected.shipment_last_error}</span><small>اطلاعات گیرنده، کدپستی و وزن را بررسی کنید؛ پس از رفع مشکل می‌توانید ثبت را دوباره اجرا کنید.</small></div>}
              </p>
              {canEdit && (
                <>
                  <button
                    className="admin-button"
                    onClick={registerTapin}
                    disabled={busy}
                  >
                    {busy ? "در حال ثبت…" : selected.shipment_status === "failed" ? "تلاش مجدد ثبت در تاپین" : "ثبت مرسوله در تاپین"}
                  </button>
                  <button
                    className="admin-outline"
                    onClick={trackShipment}
                    disabled={busy}
                  >
                    به‌روزرسانی وضعیت مرسوله
                  </button>
                </>
              )}
            </div>
            <div>
              <h3>تاریخچه عملیات</h3>
              {events.map((e) => (
                <article className="crm-note" key={e.id}>
                  <b>{labels[e.status] || e.status}</b>
                  <p>{e.note || "بدون یادداشت"}</p>
                  <small>
                    {new Date(e.created_at + "Z").toLocaleString("fa-IR")}
                  </small>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
