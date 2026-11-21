export type ShippingAddressInput = {
  fname?: string | null;
  lname?: string | null;
  phone?: string | null;
  state?: string | null;
  city?: string | null;
  address?: string | null;
  postalCode?: string | null;
};

export type NormalizedShippingAddress = {
  fname: string;
  lname: string;
  phone: string;
  state: string;
  city: string;
  address: string;
  postalCode: string;
};

type ShippingAddressResult =
  | { success: true; data: NormalizedShippingAddress }
  | { success: false; error: string };

function toLatinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

function normalizeIranianMobile(value: string): string | null {
  let digits = toLatinDigits(value).trim().replace(/^00/, '+').replace(/[^+\d]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);

  if (/^09\d{9}$/.test(digits)) return `+98${digits.slice(1)}`;
  if (/^9\d{9}$/.test(digits)) return `+98${digits}`;
  if (/^98\d{10}$/.test(digits)) return `+${digits}`;
  return null;
}

export function normalizeAndValidateShippingAddress(input?: ShippingAddressInput | null): ShippingAddressResult {
  if (!input) return { success: false, error: 'اطلاعات گیرنده را کامل کنید.' };

  const fname = input.fname?.trim() ?? '';
  const lname = input.lname?.trim() ?? '';
  const state = input.state?.trim() ?? '';
  const city = input.city?.trim() ?? '';
  const address = input.address?.trim() ?? '';
  const postalCode = toLatinDigits(input.postalCode?.trim() ?? '').replace(/\D/g, '');
  const phone = normalizeIranianMobile(input.phone ?? '');

  if (!fname) return { success: false, error: 'نام گیرنده را وارد کنید.' };
  if (!lname) return { success: false, error: 'نام خانوادگی گیرنده را وارد کنید.' };
  if (!phone) return { success: false, error: 'شماره موبایل گیرنده معتبر نیست.' };
  if (!state) return { success: false, error: 'استان را انتخاب کنید.' };
  if (!city) return { success: false, error: 'شهر را انتخاب کنید.' };
  if (!address) return { success: false, error: 'نشانی کامل محل تحویل را وارد کنید.' };
  if (!/^\d{10}$/.test(postalCode)) return { success: false, error: 'کد پستی باید ۱۰ رقم باشد.' };

  return {
    success: true,
    data: { fname, lname, phone, state, city, address, postalCode },
  };
}
