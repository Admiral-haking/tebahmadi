import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  useCart: vi.fn(),
  useTransportOptions: vi.fn(),
}));

vi.mock("./useCart", () => ({
  useCart: hooks.useCart,
}));

vi.mock("./useTransportOptions", () => ({
  useTransportOptions: hooks.useTransportOptions,
}));

import CarrierSelect from "./CarrierSelect";

describe("CarrierSelect", () => {
  beforeEach(() => {
    hooks.useCart.mockReturnValue({
      state: {
        transportId: "post",
        shippingPaymentMethod: "online",
      },
      setTransportId: vi.fn(),
      setShippingPaymentMethod: vi.fn(),
    });
    hooks.useTransportOptions.mockReturnValue({
      options: [
        { id: "post", name: "پست پیشتاز", description: "تحویل سریع در سراسر کشور" },
        { id: "courier", name: "پیک شهری", description: "تحویل در همان روز" },
      ],
      isLoading: false,
      error: null,
      retry: vi.fn(),
    });
  });

  it("renders carrier and payment choices as responsive radio cards", () => {
    const markup = renderToStaticMarkup(<CarrierSelect />);

    expect(markup).toContain("روش و هزینه ارسال");
    expect(markup).toContain("پست پیشتاز");
    expect(markup).toContain("انتخاب شده");
    expect(markup).toContain("پرداخت هزینه ارسال در همین سایت");
    expect(markup).toContain("پرداخت هزینه ارسال هنگام تحویل مرسوله");
    expect(markup).toContain('role="radio"');
    expect(markup).toContain('aria-checked="true"');
    expect(markup).not.toContain("<select");
  });

  it("explains when shipping is paid on delivery", () => {
    hooks.useCart.mockReturnValue({
      state: {
        transportId: "post",
        shippingPaymentMethod: "on_delivery",
      },
      setTransportId: vi.fn(),
      setShippingPaymentMethod: vi.fn(),
    });

    const markup = renderToStaticMarkup(<CarrierSelect />);

    expect(markup).toContain("مبلغ ارسال در جمع کل محاسبه نمی‌شود");
  });

  it("keeps the retry action visible when transport options fail", () => {
    hooks.useTransportOptions.mockReturnValue({
      options: [],
      isLoading: false,
      error: new Error("transport unavailable"),
      retry: vi.fn(),
    });

    const markup = renderToStaticMarkup(<CarrierSelect />);

    expect(markup).toContain("روش‌های ارسال موقتاً در دسترس نیست");
    expect(markup).toContain("تلاش دوباره");
  });
});
