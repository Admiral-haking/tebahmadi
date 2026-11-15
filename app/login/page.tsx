"use client";
import { useSmsCode } from "@/hooks/use-sms-code";

import { useEffect, useState } from "react";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const [needsName, setNeedsName] = useState(false);
  useSmsCode(sent, setCode);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => setReady(true), []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch(`/api/auth/otp/${sent ? "verify" : "request"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, ...(sent ? { code, ...(needsName ? { name } : {}) } : {}) }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok && data.needsName) setNeedsName(true);
    setMessage(response.ok ? (sent ? "" : "کد ورود ارسال شد") : (data.error || ""));
    if (response.ok) {
      if (!sent) setSent(true);
      else window.location.assign(data.user ? "/admin" : "/account");
    }
  }

  return (
    <main className="account-page brand-auth-page" dir="rtl">
      <aside className="auth-brand-panel" aria-label="طب احمدی">
        <a className="auth-brand-mark" href="/" aria-label="بازگشت به فروشگاه طب احمدی"><span>طب احمدی</span></a>
        <div><h2>اصالت طبیعت، عیار تندرستی</h2><p>ورود امن به حساب، سفارش‌ها و پیگیری خریدهای شما.</p></div>
      </aside>
      <section className="account-card">
        <a className="admin-brand" href="/">فروشگاه طب احمدی</a>
        <h1>{sent ? "تأیید کد ورود" : "ورود با شماره همراه"}</h1>
        <p>{sent ? "کد پیامک‌شده را وارد کنید؛ در مرورگرهای سازگار، کد به‌صورت خودکار در این کادر قرار می‌گیرد." : "برای ورود یا ساخت حساب، شماره همراه خود را وارد کنید."}</p>
        <form className="account-form" onSubmit={submit}>
          <label>شماره همراه
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" required readOnly={sent} disabled={!ready || busy} placeholder="۰۹۱۲۱۲۳۴۵۶۷" />
          </label>
          {sent && <label>کد ورود
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9۰-۹٠-٩]{4}" maxLength={4} required disabled={busy} />
          </label>}
          {needsName && <label>نام و نام خانوادگی
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" minLength={2} maxLength={120} required disabled={busy} />
          </label>}
          <button className="admin-button" disabled={busy || !ready}>{busy ? "در حال بررسی…" : needsName ? "ساخت حساب و ورود" : sent ? "تأیید و ورود" : "ارسال کد ورود"}</button>
        </form>
        {message && <div className="admin-message" role="status">{message}</div>}
        {sent && <button className="account-switch" onClick={() => { setSent(false); setNeedsName(false); setCode(""); setName(""); setMessage(""); }}>تغییر شماره</button>}
        <a className="back-home" href="/">بازگشت به فروشگاه</a>
      </section>
    </main>
  );
}
