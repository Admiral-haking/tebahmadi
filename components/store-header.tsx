"use client";

import { Menu, ShoppingBag, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLogo } from "./brand-logo";

export function StoreHeader() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);

  return <header className="store-shell-header" dir="rtl">
    <div className="wrap store-shell-inner">
      <Link href="/" className="store-shell-brand" aria-label="صفحه اصلی طب احمدی"><BrandLogo /></Link>
      <nav className="store-shell-nav" aria-label="منوی اصلی">
        <Link href="/#shop">فروشگاه</Link><Link href="/policies">درباره فروشگاه</Link><Link href="/track">پیگیری سفارش</Link><Link href="/#contact">تماس</Link>
      </nav>
      <div className="store-shell-actions">
        <Link href="/account" aria-label="حساب کاربری"><UserRound aria-hidden="true"/><span>حساب من</span></Link>
        <Link href="/#shop" aria-label="رفتن به سبد خرید"><ShoppingBag aria-hidden="true"/><span>خرید</span></Link>
        <button type="button" className="store-shell-menu-button" aria-label="باز کردن منوی فروشگاه" aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? <X aria-hidden="true"/> : <Menu aria-hidden="true"/>}</button>
      </div>
    </div>
    {open && <><button type="button" className="store-shell-backdrop" aria-label="بستن منوی فروشگاه" onClick={() => setOpen(false)}/><nav className="store-shell-drawer" aria-label="منوی فروشگاه"><Link href="/#shop" onClick={() => setOpen(false)}>فروشگاه</Link><Link href="/account" onClick={() => setOpen(false)}>حساب و سفارش‌ها</Link><Link href="/track" onClick={() => setOpen(false)}>پیگیری سفارش</Link><Link href="/policies" onClick={() => setOpen(false)}>درباره فروشگاه</Link><Link href="/#contact" onClick={() => setOpen(false)}>تماس و پشتیبانی</Link></nav></>}
  </header>;
}
