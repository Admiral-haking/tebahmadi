"use client";
import { useEffect, useState } from "react";

const toman = (value: number) => new Intl.NumberFormat("fa-IR").format(Number(value || 0)) + " تومان";

export default function CrmPage() {
  const [user, setUser] = useState<any>(null), [q, setQ] = useState(""), [customers, setCustomers] = useState<any[]>([]), [selected, setSelected] = useState<any>(null), [notes, setNotes] = useState<any[]>([]), [orders, setOrders] = useState<any[]>([]), [note, setNote] = useState(""), [tag, setTag] = useState(""), [message, setMessage] = useState("");
  async function load() {
    const response = await fetch(`/api/admin/crm?q=${encodeURIComponent(q)}${selected ? `&customerId=${encodeURIComponent(selected.id)}` : ""}`, { cache: "no-store" });
    const data = await response.json();
    if (response.ok) { setCustomers(data.customers || []); setNotes(data.notes || []); setOrders(data.orders || []); }
    else setMessage(data.error || "خواندن CRM انجام نشد");
  }
  // The loader reads the current search/selection state and is intentionally invoked by these event boundaries.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetch("/api/admin/session", { cache: "no-store" }).then(r => r.json()).then(d => setUser(d.user || null)); load(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (selected) load(); }, [selected]);
  async function submit(action: "note" | "tag") {
    if (!selected) return;
    const response = await fetch("/api/admin/crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, customerId: selected.id, note, tag }) });
    const data = await response.json(); setMessage(response.ok ? "پرونده مشتری به‌روزرسانی شد" : data.error || "عملیات ناموفق بود");
    if (response.ok) { setNote(""); setTag(""); await load(); }
  }
  if (!user) return <main className="admin-page" dir="rtl"><section className="admin-login"><h1>CRM مشتریان</h1><p>برای مشاهدهٔ این بخش وارد پنل مدیریت شوید.</p><a className="admin-button" href="/admin">ورود به پنل</a></section></main>;
  if (!["owner", "admin", "manager"].includes(user.role)) return <main className="admin-page" dir="rtl"><section className="admin-login"><h1>دسترسی مجاز نیست</h1><a className="admin-outline" href="/admin">بازگشت</a></section></main>;
  return <main className="admin-page" dir="rtl"><header className="admin-top"><div><a className="admin-brand" href="/">طب احمدی</a><span>CRM مشتریان</span></div><a className="admin-outline" href="/admin">بازگشت به پنل</a></header><div className="admin-content"><div className="admin-heading"><div><small>ارتباط با مشتری و ارزش خرید</small><h1>پرونده مشتریان</h1></div><a className="admin-button" href="/api/admin/crm/export">خروجی CSV</a></div>{message && <div className="admin-message" role="status">{message}</div>}<div className="crm-grid"><section className="admin-panel"><div className="admin-panel-head"><h2>فهرست مشتریان</h2><form onSubmit={e => { e.preventDefault(); load(); }}><input value={q} onChange={e => setQ(e.target.value)} placeholder="نام، موبایل یا ایمیل"/><button className="admin-outline">جستجو</button></form></div><div className="crm-list">{customers.length ? customers.map(customer => <article key={customer.id} className={selected?.id === customer.id ? "crm-selected" : ""} onClick={() => { setSelected(customer); setTimeout(load, 0); }}><b>{customer.name}</b><span>{customer.phone}{customer.email ? ` · ${customer.email}` : ""}</span><small>{customer.orders} سفارش · {toman(customer.lifetime_value)}</small><small>برچسب‌ها: {customer.tags || "—"}</small></article>) : <div className="admin-empty">مشتری‌ای پیدا نشد.</div>}</div></section><section className="admin-panel"><h2>{selected ? `پرونده ${selected.name}` : "انتخاب مشتری"}</h2>{selected ? <><p className="commerce-note">{selected.phone} · {selected.email || "ایمیل ثبت نشده"} · عضویت {new Date(selected.created_at + "Z").toLocaleDateString("fa-IR")}</p><h3>تاریخچه سفارش‌ها</h3>{orders.length ? orders.map(order => <article className="commerce-row" key={order.id}><div><b>{order.invoice_number || order.id.slice(0, 8)}</b><small>{toman(order.subtotal_toman)} · {order.status} · {order.payment_status} · {new Date(order.created_at + "Z").toLocaleDateString("fa-IR")}</small><small>ارسال: {order.shipping_status} · رهگیری: {order.tracking_code || "ثبت نشده"}</small></div><a className="admin-outline" href={`/admin/order-center?id=${encodeURIComponent(order.id)}`}>مشاهده</a></article>) : <div className="admin-empty">سفارشی برای این مشتری ثبت نشده است.</div>}<label>یادداشت داخلی<textarea rows={3} value={note} onChange={e => setNote(e.target.value)} /></label><button className="admin-button" onClick={() => submit("note")}>ثبت یادداشت</button><label>برچسب جدید<input value={tag} onChange={e => setTag(e.target.value)} placeholder="مثلاً مشتری وفادار" /></label><button className="admin-outline" onClick={() => submit("tag")}>ثبت برچسب</button><h3>یادداشت‌های اخیر</h3>{notes.filter(item => item.customer_id === selected.id).map(item => <article className="crm-note" key={item.id}><p>{item.note}</p><small>{new Date(item.created_at + "Z").toLocaleString("fa-IR")}</small></article>)}</> : <div className="admin-empty">برای مشاهدهٔ جزئیات، یک مشتری را انتخاب کنید.</div>}</section></div></div></main>;
}
