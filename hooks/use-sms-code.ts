"use client";
import { useEffect } from "react";

export function useSmsCode(enabled: boolean, onCode: (code: string) => void) {
  useEffect(() => {
    if (!enabled || !window.isSecureContext || !("OTPCredential" in window)) return;
    const controller = new AbortController();
    const credentials = navigator.credentials as unknown as {get(options: {otp:{transport:string[]};signal:AbortSignal}):Promise<{code?:string}|null>};
    credentials.get({otp:{transport:["sms"]},signal:controller.signal}).then(value=>{
      if(value?.code && /^\d{4}$/.test(value.code)) onCode(value.code);
    }).catch(()=>{ /* Manual entry and OS autofill remain available. */ });
    return ()=>controller.abort();
  },[enabled,onCode]);
}
