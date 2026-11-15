"use client";
import { useEffect, useState } from "react";
import { OrderCenter } from "../order-center";

export default function OrderCenterPage() {
  const [user, setUser] = useState<any>(null);
  useEffect(() => { fetch("/api/admin/session", { cache: "no-store" }).then(r => r.json()).then(d => setUser(d.user || null)); }, []);
  if (!user) return <main className="admin-page" dir="rtl"><section className="admin-login"><a className="admin-brand" href="/">طب احمدی</a><h1>مرکز عملیات سفارش</h1><p>برای مشاهدهٔ این صفحه ابتدا از پنل مدیریت وارد شوید.</p><a className="admin-button" href="/admin">ورود به پنل مدیریت</a></section></main>;
  return <main className="admin-page" dir="rtl"><header className="admin-top"><div><a className="admin-brand" href="/">طب احمدی</a><span>مرکز عملیات سفارش</span></div><a className="admin-outline" href="/admin">بازگشت به پنل</a></header><div className="admin-content"><OrderCenter role={user.role}/></div></main>;
}
