export const brandTokens = {
  color: {
    primary: "#2A5A44",
    primaryDeep: "#1F4635",
    primarySoft: "#DCE8E0",
    accent: "#C5A059",
    accentSoft: "#F1E7D0",
    canvas: "#F9F8F6",
    surface: "#FFFFFF",
    surfaceMuted: "#F4F3E5",
    text: "#222222",
    textMuted: "#62685F",
    border: "#DEE0D0",
    danger: "#A54A4C",
    success: "#3D7857",
  },
  radius: {
    compact: 8,
    control: 16,
    card: 24,
    panel: 32,
    pill: 999,
  },
  shadow: {
    subtle: "0 1px 2px rgba(34, 34, 34, 0.04), 0 10px 32px rgba(42, 90, 68, 0.07)",
    floating: "0 18px 55px rgba(31, 70, 53, 0.14)",
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
