export const brandTokens = {
  color: {
    primary: "#6D7D45",
    primaryDeep: "#3F4F2F",
    primarySoft: "#E6E9D6",
    accent: "#B49A68",
    accentSoft: "#F3EEDC",
    canvas: "#FBFBF8",
    surface: "#FFFFFF",
    surfaceMuted: "#F4F3E8",
    text: "#2F3428",
    textMuted: "#737968",
    border: "#E4E1CF",
    danger: "#A95750",
    success: "#6D7D45",
  },
  radius: {
    compact: 8,
    control: 16,
    card: 28,
    panel: 34,
    pill: 999,
  },
  shadow: {
    subtle: "0 1px 2px rgba(47, 52, 40, 0.03), 0 12px 30px rgba(91, 103, 58, 0.07)",
    floating: "0 18px 55px rgba(63, 79, 47, 0.13)",
  },
  typography: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    title: 24,
    display: 40,
  },
  space: (step: number) => step * 4,
} as const;

export const responsiveContainer = {
  xs: "calc(100% - 24px)",
  sm: "calc(100% - 40px)",
  lg: 1200,
} as const;

export const glassSurface = {
  backgroundColor: "rgba(255, 255, 255, 0.88)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: `1px solid ${brandTokens.color.border}`,
} as const;
