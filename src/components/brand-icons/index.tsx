import type { ReactNode, SVGProps } from "react";

import type { BrandIconName } from "@/lib/brand-icons";

export type { BrandIconName } from "@/lib/brand-icons";

export type BrandIconProps = Omit<SVGProps<SVGSVGElement>, "title" | "width" | "height" | "strokeWidth"> & {
  name: BrandIconName;
  size?: number | string;
  title?: string;
  strokeWidth?: number;
};

type GlyphProps = {
  strokeWidth: number;
  children: ReactNode;
};

function GlyphFrame({ strokeWidth, children }: GlyphProps) {
  return (
    <>
      <g fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </>
  );
}

function CategoryGlyph({ strokeWidth }: Omit<GlyphProps, "children">) {
  return (
    <GlyphFrame strokeWidth={strokeWidth}>
      <path d="M12 20.5c-1.2-3.6-3.4-6.1-6.8-7.5 1.1 3.7 3.3 6.2 6.8 7.5Z" fill="currentColor" opacity=".16" />
      <path d="M12 20.5c1.2-3.6 3.4-6.1 6.8-7.5-1.1 3.7-3.3 6.2-6.8 7.5Z" fill="currentColor" opacity=".24" />
      <path d="M12 20.5V7.2" />
      <path d="M12 13.8c-1.2-2.4-3.3-3.9-6.2-4.5.5 3.3 2.6 5.2 6.2 6" />
      <path d="M12 13.8c1.2-2.4 3.3-3.9 6.2-4.5-.5 3.3-2.6 5.2-6.2 6" />
      <path d="M12 7.2c-.6-1.6-.4-3 .7-4.2 1.8.8 2.4 2.2 1.9 4.2" />
    </GlyphFrame>
  );
}

function HomeGlyph({ strokeWidth }: Omit<GlyphProps, "children">) {
  return (
    <GlyphFrame strokeWidth={strokeWidth}>
      <path d="m3.8 11.1 8.2-7 8.2 7v8.1H3.8v-8.1Z" fill="currentColor" opacity=".12" />
      <path d="m3.8 11.1 8.2-7 8.2 7M5.2 10.2v9h13.6v-9M9.5 19.2v-4.6h5v4.6" />
      <path d="M15.6 7.1c.6-.8 1.4-1.2 2.4-1.3-.1 1.1-.7 1.8-1.7 2.1" />
    </GlyphFrame>
  );
}

function HerbsGlyph({ strokeWidth }: Omit<GlyphProps, "children">) {
  return (
    <GlyphFrame strokeWidth={strokeWidth}>
      <path d="M5 20.5c.3-5.3 2.6-9.5 7-12.5 2.4-1.6 4.7-2.2 7-2.3-.2 3.3-1.5 6.1-3.8 8.4C12.8 15.5 9.4 16.8 5 17.5" fill="currentColor" opacity=".16" />
      <path d="M4 20.5c2.3-3.8 5.3-7.1 9.2-9.9" />
      <path d="M8.2 15.6c-1.4-.1-2.7-.5-3.9-1.3" />
      <path d="M11.2 13.1c1.5.1 2.8.6 4 1.4" />
      <path d="M13.8 10.8c-.1-1.4.2-2.7.9-3.9" />
    </GlyphFrame>
  );
}

function TeaGlyph({ strokeWidth }: Omit<GlyphProps, "children">) {
  return (
    <GlyphFrame strokeWidth={strokeWidth}>
      <path d="M5 10.5h11v5.2a4.3 4.3 0 0 1-4.3 4.3H9.3A4.3 4.3 0 0 1 5 15.7v-5.2Z" fill="currentColor" opacity=".14" />
      <path d="M16 12h1.8a2.7 2.7 0 0 1 0 5.4H16" />
      <path d="M4 20h14" />
      <path d="M8 7.5c-1.1-1.1-.2-2.1 0-3" />
      <path d="M12 7.5c-1.1-1.1-.2-2.1 0-3" />
      <path d="M16 7.5c-1.1-1.1-.2-2.1 0-3" />
    </GlyphFrame>
  );
}

function OilsGlyph({ strokeWidth }: Omit<GlyphProps, "children">) {
  return (
    <GlyphFrame strokeWidth={strokeWidth}>
      <path d="M12 3.5S6.5 10 6.5 14.1a5.5 5.5 0 0 0 11 0C17.5 10 12 3.5 12 3.5Z" fill="currentColor" opacity=".16" />
      <path d="M12 3.5S6.5 10 6.5 14.1a5.5 5.5 0 0 0 11 0C17.5 10 12 3.5 12 3.5Z" />
      <path d="M9.8 15.1c.3 1.1 1.1 1.8 2.3 2" />
      <path d="M14.7 6.9c1.7.1 3.1.8 4.3 2.1-1.8.5-3.4.3-4.8-.5" />
    </GlyphFrame>
  );
}

function HoneyGlyph({ strokeWidth }: Omit<GlyphProps, "children">) {
  return (
    <GlyphFrame strokeWidth={strokeWidth}>
      <path d="m8 5.2 4-2.3 4 2.3v4.6l-4 2.3-4-2.3V5.2Z" fill="currentColor" opacity=".14" />
      <path d="m8 5.2 4-2.3 4 2.3v4.6l-4 2.3-4-2.3V5.2Z" />
      <path d="m4 12.1 4-2.3 4 2.3v4.6l-4 2.3-4-2.3v-4.6Z" fill="currentColor" opacity=".08" />
      <path d="m4 12.1 4-2.3 4 2.3v4.6l-4 2.3-4-2.3v-4.6Z" />
      <path d="m12 12.1 4-2.3 4 2.3v4.6l-4 2.3-4-2.3v-4.6Z" />
    </GlyphFrame>
  );
}

function DistillateGlyph({ strokeWidth }: Omit<GlyphProps, "children">) {
  return (
    <GlyphFrame strokeWidth={strokeWidth}>
      <path d="M9 3.5h6M10 3.5v3l-3.2 5.1A5.5 5.5 0 0 0 11.4 20h1.2a5.5 5.5 0 0 0 4.6-8.4L14 6.5v-3" fill="currentColor" opacity=".14" />
      <path d="M9 3.5h6M10 3.5v3l-3.2 5.1A5.5 5.5 0 0 0 11.4 20h1.2a5.5 5.5 0 0 0 4.6-8.4L14 6.5v-3" />
      <path d="M8.8 13.5h6.4" />
      <path d="M9.8 10.4c.6-1.1 1.6-1.7 2.9-1.7" />
    </GlyphFrame>
  );
}

function SpicesGlyph({ strokeWidth }: Omit<GlyphProps, "children">) {
  return (
    <GlyphFrame strokeWidth={strokeWidth}>
      <path d="m12 3 1.8 5.2 5.2 1.8-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" fill="currentColor" opacity=".16" />
      <path d="m12 3 1.8 5.2 5.2 1.8-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
      <path d="M5 18.5h.01M9 20.5h.01M18 17.5h.01M19 13.5h.01" strokeWidth={strokeWidth + 0.6} />
    </GlyphFrame>
  );
}

function ShippingGlyph({ strokeWidth }: Omit<GlyphProps, "children">) {
  return (
    <GlyphFrame strokeWidth={strokeWidth}>
      <path d="M3.5 7h10.2v9.4H3.5V7Z" fill="currentColor" opacity=".12" />
      <path d="M13.7 10h3.2l3.1 3.2v3.2h-6.3V10Z" fill="currentColor" opacity=".2" />
      <path d="M3.5 7h10.2v9.4H3.5V7ZM13.7 10h3.2l3.1 3.2v3.2h-6.3" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17.3" cy="18" r="1.6" />
      <path d="M8.6 18h7.1M20 14h-3.1" />
    </GlyphFrame>
  );
}

function AuthenticityGlyph({ strokeWidth }: Omit<GlyphProps, "children">) {
  return (
    <GlyphFrame strokeWidth={strokeWidth}>
      <path d="M12 3.2 19 6v5.2c0 4.3-2.8 7.7-7 9.6-4.2-1.9-7-5.3-7-9.6V6l7-2.8Z" fill="currentColor" opacity=".14" />
      <path d="M12 3.2 19 6v5.2c0 4.3-2.8 7.7-7 9.6-4.2-1.9-7-5.3-7-9.6V6l7-2.8Z" />
      <path d="m8.7 12.1 2.1 2.1 4.6-4.7" />
    </GlyphFrame>
  );
}

function SupportGlyph({ strokeWidth }: Omit<GlyphProps, "children">) {
  return (
    <GlyphFrame strokeWidth={strokeWidth}>
      <path d="M5 11.4a7 7 0 0 1 14 0v3.4a2 2 0 0 1-2 2h-1.3v-5.2H19M5 11.4v5.4h1.3v-5.2H5" fill="currentColor" opacity=".12" />
      <path d="M5 11.4a7 7 0 0 1 14 0v3.4a2 2 0 0 1-2 2h-1.3v-5.2H19M5 11.4v5.4h1.3v-5.2H5" />
      <path d="M15.7 17c-.4 2-1.8 3-4.1 3" />
      <path d="M10 20h1.6" />
    </GlyphFrame>
  );
}

function PaymentGlyph({ strokeWidth }: Omit<GlyphProps, "children">) {
  return (
    <GlyphFrame strokeWidth={strokeWidth}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.2" fill="currentColor" opacity=".12" />
      <rect x="3" y="5.5" width="18" height="13" rx="2.2" />
      <path d="M3 10h18M7 14.5h3.5" />
      <path d="m16.5 13.2.8 1.1 1.9-2.2" />
    </GlyphFrame>
  );
}

function StoreGlyph({ strokeWidth }: Omit<GlyphProps, "children">) {
  return (
    <GlyphFrame strokeWidth={strokeWidth}>
      <path d="M4 9.2h16l-1.2-4.7H5.2L4 9.2Z" fill="currentColor" opacity=".14" />
      <path d="M4 9.2h16l-1.2-4.7H5.2L4 9.2ZM4.5 9.2v9.3h15V9.2M3.2 18.5h17.6" />
      <path d="M7 9.2v2.1a2.1 2.1 0 0 0 4.2 0V9.2M11.2 9.2v2.1a2.1 2.1 0 0 0 4.2 0V9.2" />
      <path d="M8 18.5v-4.2h4.2v4.2" />
    </GlyphFrame>
  );
}

function CartGlyph({ strokeWidth }: Omit<GlyphProps, "children">) {
  return (
    <GlyphFrame strokeWidth={strokeWidth}>
      <path d="M4 5h2l1.3 9.2h9.8L19 8H7" />
      <path d="M8 14.2h9.1a2 2 0 0 1 0 4H9.2" fill="currentColor" opacity=".12" />
      <circle cx="9.5" cy="20" r="1" fill="currentColor" />
      <circle cx="17" cy="20" r="1" fill="currentColor" />
      <path d="M13 8.2c.8-1.7 2.1-2.6 3.8-2.7-.2 1.8-1.1 3-2.7 3.6" />
    </GlyphFrame>
  );
}

function AccountGlyph({ strokeWidth }: Omit<GlyphProps, "children">) {
  return (
    <GlyphFrame strokeWidth={strokeWidth}>
      <circle cx="12" cy="8" r="3.3" fill="currentColor" opacity=".14" />
      <circle cx="12" cy="8" r="3.3" />
      <path d="M5 20c.6-3.5 2.9-5.5 7-5.5s6.4 2 7 5.5" fill="currentColor" opacity=".14" />
      <path d="M5 20c.6-3.5 2.9-5.5 7-5.5s6.4 2 7 5.5" />
      <path d="M14.8 7.3c.7.2 1.3.7 1.7 1.3" />
    </GlyphFrame>
  );
}

function OrdersGlyph({ strokeWidth }: Omit<GlyphProps, "children">) {
  return (
    <GlyphFrame strokeWidth={strokeWidth}>
      <path d="M6 3.5h12v17H6v-17Z" fill="currentColor" opacity=".12" />
      <path d="M6 3.5h12v17H6v-17ZM9 7h6M9 10.5h6M9 14h3.2" />
      <path d="m14.7 16.3 1.2 1.2 2.4-2.6" />
    </GlyphFrame>
  );
}

function LogoutGlyph({ strokeWidth }: Omit<GlyphProps, "children">) {
  return (
    <GlyphFrame strokeWidth={strokeWidth}>
      <path d="M13 4.5H6.5v15H13" />
      <path d="M11 12h9M16.5 8.5 20 12l-3.5 3.5" />
      <path d="M6.5 7.5h2" strokeWidth={strokeWidth + 0.5} />
    </GlyphFrame>
  );
}

function SearchGlyph({ strokeWidth }: Omit<GlyphProps, "children">) {
  return (
    <GlyphFrame strokeWidth={strokeWidth}>
      <circle cx="10.8" cy="10.8" r="6.3" fill="currentColor" opacity=".1" />
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m15.5 15.5 4.3 4.3" />
      <path d="M10.8 7.7c1.1.1 2.1.6 2.8 1.5" />
    </GlyphFrame>
  );
}

function MenuGlyph({ strokeWidth }: Omit<GlyphProps, "children">) {
  return (
    <GlyphFrame strokeWidth={strokeWidth}>
      <path d="M4 6.5h16M4 12h16M4 17.5h10" />
      <path d="M18.1 15.2c.7.3 1.3.8 1.7 1.5-.8.1-1.6 0-2.3-.4" />
    </GlyphFrame>
  );
}

function InfoGlyph({ strokeWidth }: Omit<GlyphProps, "children">) {
  return (
    <GlyphFrame strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="8.7" fill="currentColor" opacity=".12" />
      <circle cx="12" cy="12" r="8.7" />
      <path d="M12 10.5v5M12 7.7h.01" strokeWidth={strokeWidth + 0.7} />
    </GlyphFrame>
  );
}

const GLYPHS: Record<BrandIconName, ({ strokeWidth }: Omit<GlyphProps, "children">) => ReactNode> = {
  category: CategoryGlyph,
  home: HomeGlyph,
  herbs: HerbsGlyph,
  tea: TeaGlyph,
  oils: OilsGlyph,
  honey: HoneyGlyph,
  distillate: DistillateGlyph,
  spices: SpicesGlyph,
  shipping: ShippingGlyph,
  authenticity: AuthenticityGlyph,
  support: SupportGlyph,
  payment: PaymentGlyph,
  store: StoreGlyph,
  cart: CartGlyph,
  account: AccountGlyph,
  orders: OrdersGlyph,
  logout: LogoutGlyph,
  search: SearchGlyph,
  menu: MenuGlyph,
  info: InfoGlyph,
};

export function BrandIcon({ name, size = 24, title, strokeWidth = 1.75, ...svgProps }: BrandIconProps) {
  const Glyph = GLYPHS[name] ?? CategoryGlyph;

  return (
    <svg
      {...svgProps}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <Glyph strokeWidth={strokeWidth} />
    </svg>
  );
}
