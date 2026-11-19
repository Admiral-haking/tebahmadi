"use client";

import { useEffect } from "react";

/**
 * Globally stop the mouse wheel from changing the value of a focused
 * `input[type=number]` (a long-standing browser annoyance, especially bad for
 * stock/price fields). Mounted once in the admin layout so every current and
 * future numeric input is covered without per-field wiring.
 *
 * We blur the focused number input on wheel: the scroll still scrolls the page,
 * but the input no longer increments/decrements.
 */
export default function NumberInputWheelGuard() {
  useEffect(() => {
    const onWheel = () => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement && el.type === "number") {
        el.blur();
      }
    };
    document.addEventListener("wheel", onWheel, { passive: true });
    return () => document.removeEventListener("wheel", onWheel);
  }, []);

  return null;
}
