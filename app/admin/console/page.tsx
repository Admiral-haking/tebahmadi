"use client";
import { useEffect,useState } from "react";
const modules=[
  ["مرکز عملیات سفارش","مشاهده، ویرایش، ثبت Tapin، رهگیری و خروجی سفارش‌ها","/admin/order-center",["owner","admin","manager","support"]],
  ["محصولات","ایجاد، ویرایش، موجودی، import و export محصولات","/admin",["owner","admin","manager"]],
  ["محتوای محصولات","مزایا، روش مصرف، FAQ و SEO محصولات","/admin/products-content",["owner","admin","manager"]],
  ["بلاگ و مجله","ایجاد، ویرایش، انتشار و بایگانی مقاله‌ها","/admin/blog",["owner","admin","manager"]],
  ["گزارش‌های مدیریتی","فروش، پرداخت، ارسال و محصولات پرفروش","/admin/reports",["owner","admin","manager"]],
  ["Audit Log","ردیابی عملیات حساس و خروجی فعالیت‌ها","/admin/audit",["owner","admin"]],
  ["مالی و فاکتورها","اسناد مالی، درآمد، هزینه و فاکتور","/admin",["owner","admin","manager"]],
  ["عودت وجه و تطبیق","صف refund، مرجع provider و تطبیق سند مالی","/admin/refunds",["owner","admin","manager"]],
  ["انبار و تأمین","موجودی، گردش کالا، تأمین‌کننده و خرید","/admin",["owner","admin","manager"]],
  ["پشتیبانی و مرجوعی","تیکت‌ها، تماس‌ها و درخواست‌های مرجوعی","/admin",["owner","admin","manager","support"]],
  ["وضعیت اتصال‌ها","بررسی وضعیت زرین‌پال، Tapin و پیامک بدون نمایش secret","/admin/integrations",["owner","admin"]],
  ["CRM مشتریان","جست‌وجو، پرونده، برچسب، یادداشت و خروجی مشتریان","/admin/crm",["owner","admin","manager"]],
  ["کدهای تخفیف","کد درصدی، مبلغ ثابت و ارسال رایگان با محدودیت مصرف","/admin/promotions",["owner","admin","manager"]],
  ["روش‌های ارسال","مدیریت روش‌ها، هزینه، بازه تحویل و تنظیمات قیمت‌گذاری","/admin/integrations?tab=shipping",["owner","admin","manager"]],
];
export default function AdminConsole(){const [user,setUser]=useState<any>(null);useEffect(()=>{fetch("/api/admin/session",{cache:"no-store"}).then(r=>r.json()).then(d=>setUser(d.user||null))},[]);if(!user)return <main className="admin-page" dir="rtl"><section className="admin-login"><h1>مرکز فرمان مدیریت</h1><p>برای دسترسی به ابزارهای مدیریتی وارد شوید.</p><a className="admin-button" href="/admin">ورود به پنل</a></section></main>;return <main className="admin-page" dir="rtl"><header className="admin-top"><div><a className="admin-brand" href="/">طب احمدی</a><span>مرکز فرمان مدیریت</span></div><div><b>{user.name}</b><a className="admin-outline" href="/admin">پنل قدیمی</a></div></header><div className="admin-content"><div className="admin-heading"><div><small>دسترسی سریع عملیات</small><h1>مرکز فرمان فروشگاه</h1></div><span className="commerce-note">نقش: {user.role}</span></div><div className="admin-module-grid">{modules.filter(x=>(x[3] as string[]).includes(user.role)).map(x=><a className="admin-module-card" href={x[2] as string} key={x[0] as string}><h2>{x[0]}</h2><p>{x[1]}</p><span>ورود به بخش ←</span></a>)}</div></div></main>}
