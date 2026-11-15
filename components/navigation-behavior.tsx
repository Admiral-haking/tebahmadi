"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** Shared dismissal behavior for the existing administrative drawer. */
export function NavigationBehavior() {
  const account = usePathname() === "/account";
  const [open,setOpen] = useState(false);
  useEffect(() => {
    const close = () => {document.body.classList.remove("admin-menu-open");setOpen(false)};
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        document.querySelector<HTMLButtonElement>(".admin-hamburger")?.focus();
      }
    };
    const click = (event: MouseEvent) => {
      if ((event.target as Element)?.closest(".admin-tabs button, .admin-tabs a")) close();
    };
    document.addEventListener("keydown", keydown);
    document.addEventListener("click", click);
    return () => { close(); document.removeEventListener("keydown", keydown); document.removeEventListener("click", click); };
  }, []);
  return account ? <><button type="button" className="admin-hamburger" aria-label="منوی حساب کاربری" aria-expanded={open} onClick={()=>{setOpen(value=>!value);document.body.classList.toggle("admin-menu-open")}}>☰<span>حساب من</span></button>{open&&<button type="button" className="account-menu-backdrop" aria-label="بستن منوی حساب" style={{position:"fixed",inset:0,zIndex:19,border:0,background:"#183b2748"}} onClick={()=>{setOpen(false);document.body.classList.remove("admin-menu-open")}}/>}</> : null;
}
