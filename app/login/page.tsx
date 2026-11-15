"use client";
import { useSmsCode } from "@/hooks/use-sms-code";

import { useState } from "react";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  useSmsCode(sent, setCode);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch(`/api/auth/otp/${sent ? "verify" : "request"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, ...(sent ? { code } : {}) }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    setMessage(response.ok ? (sent ? "" : "کد ورود ارسال شد") : (data.error || ""));
    if (response.ok) {
      if (!sent) setSent(true);
      else window.location.assign(data.user ? "/admin" : "/account");
    }
  }

  return (
    <main className="account-page" dir="rtl">
      <section className="account-card">
        <a className="admin-brand" href="/">طب احمدی</a>
        <h1>ورود</h1>
        <form className="account-form" onSubmit={submit}>
          <label>شماره همراه
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" required readOnly={sent} placeholder="۰۹۱۲۱۲۳۴۵۶۷" />
          </label>
          {sent && <label>کد ورود
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9۰-۹٠-٩]{4}" maxLength={4} required />
          </label>}
          <button className="admin-button" disabled={busy}>{busy ? "در حال بررسی…" : sent ? "تأیید و ورود" : "ارسال کد ورود"}</button>
        </form>
        {message && <div className="admin-message" role="status">{message}</div>}
        {sent && <button className="account-switch" onClick={() => { setSent(false); setCode(""); setMessage(""); }}>تغییر شماره</button>}
        <a className="back-home" href="/">بازگشت به فروشگاه</a>
      </section>
    </main>
  );
}
