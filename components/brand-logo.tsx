type BrandLogoProps = {
  compact?: boolean;
  inverse?: boolean;
};

export function BrandLogo({ compact = false, inverse = false }: BrandLogoProps) {
  return <span className={`brand-logo${compact ? " brand-logo-compact" : ""}${inverse ? " brand-logo-inverse" : ""}`}>
    <svg className="brand-logo-symbol" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 4c5.2 6.6 10.5 7.3 18.1 7.9.6 7.6 1.3 12.9 7.9 18.1-6.6 5.2-7.3 10.5-7.9 18.1-7.6.6-12.9 1.3-18.1 7.9-5.2-6.6-10.5-7.3-18.1-7.9-.6-7.6-1.3-12.9-7.9-18.1 6.6-5.2 7.3-10.5 7.9-18.1C21.5 11.3 26.8 10.6 32 4Z" fill="none" stroke="currentColor" strokeWidth="2.2"/>
      <path d="M20 39c9.8-.4 17.2-6 23.3-17.1 1.3 10.9-3.4 19.4-13.8 21.2-4.4.8-7.4-.6-9.5-4.1Z" fill="currentColor" opacity=".16"/>
      <path d="M20 39c9.8-.4 17.2-6 23.3-17.1M27.2 42.8c.8-7.7 5.3-12.5 13.5-16.9" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5"/>
      <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth=".8" opacity=".45"/>
    </svg>
    <span className="brand-logo-copy"><b>طب احمدی</b>{!compact && <small>فروشگاه محصولات طبیعی</small>}</span>
  </span>;
}
