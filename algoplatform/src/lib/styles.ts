import { CSSProperties } from "react";

// ── FINSIGHT DESIGN SYSTEM ──

export const C = {
  // Backgrounds
  bg: "#010204",
  surface: "#0e0b0e",
  surfaceLight: "#141114",
  surfaceHover: "#1a171a",

  // Borders
  border: "#252525",
  borderHover: "#3a3a3a",
  borderLight: "rgba(255,255,255,0.06)",

  // Primary
  primary: "#4F4FF1",
  primaryHover: "#3939B8",
  primaryGlow: "rgba(79,79,241,0.25)",
  primaryDim: "rgba(79,79,241,0.12)",

  // Text
  white: "#FFFFFF",
  text: "#D6D6D6",
  dim: "#6B6B6B",
  dim2: "#454545",
  silver: "#A8A8A8",

  // Accents
  green: "#4ADE80",
  red: "#F87171",
  purple: "#A78BFA",
  cyan: "#22D3EE",
  gold: "#D4A853",

  // Legacy aliases (keep for easy migration)
  void: "#010204",
  ice: "#4F4FF1",
  iceBright: "#6B6BFF",
  frostBg: "rgba(14,11,14,0.85)",
  frostBorder: "#252525",
  frostBorderHover: "#3a3a3a",
  glow: "rgba(79,79,241,0.08)",
  slate: "#0e0b0e",
} as const;

// ── CARD (dark glass) ──
export const card: CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 20,
};

export const cardSmall: CSSProperties = {
  ...card,
  borderRadius: 14,
};

// ── GLASS CARD (with gradient shine) ──
export const glass: CSSProperties = {
  background: `radial-gradient(62% 100% at 47.9% -12.3%, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%), ${C.surface}`,
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  border: `1px solid ${C.border}`,
  borderRadius: 20,
};

// ── Legacy frost alias → card ──
export const frost: CSSProperties = card;
export const frostSmall: CSSProperties = cardSmall;

// ── PILL BUTTON ──
export const pillBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "14px 32px",
  borderRadius: 58,
  fontSize: 14,
  fontWeight: 500,
  letterSpacing: "0.01em",
  textDecoration: "none",
  cursor: "pointer",
  transition: "all 0.3s ease",
};

export const pillPrimary: CSSProperties = {
  ...pillBtn,
  background: C.primary,
  color: C.white,
  border: "none",
};

export const pillOutline: CSSProperties = {
  ...pillBtn,
  background: "transparent",
  color: C.white,
  border: `1px solid ${C.border}`,
};

// ── LABEL (mono uppercase) ──
export const label: CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 11,
  fontWeight: 500,
  textTransform: "uppercase" as const,
  letterSpacing: "0.14em",
  color: C.dim,
};

export const labelAccent: CSSProperties = {
  ...label,
  color: C.primary,
};
export const labelIce = labelAccent; // legacy alias

// ── HEADING ──
export const heading = (size: number): CSSProperties => ({
  fontFamily: "'Be Vietnam Pro', sans-serif",
  fontWeight: 300,
  fontSize: size,
  letterSpacing: "-0.01em",
  lineHeight: 1.1,
  color: C.white,
});

// ── GLOW ──
export const glowText: CSSProperties = {
  textShadow: `0 0 40px rgba(79,79,241,0.4), 0 0 80px rgba(79,79,241,0.15)`,
};

export const glowBox: CSSProperties = {
  boxShadow: `0 0 60px ${C.primaryGlow}, 0 0 120px rgba(79,79,241,0.05)`,
};

// ── GRADIENT ──
export const gradientLine: CSSProperties = {
  background: `linear-gradient(90deg, transparent, ${C.primary}60, transparent)`,
  height: 1,
};

// ── BOTTOM FADE MASK ──
export const bottomFade: CSSProperties = {
  WebkitMaskImage: "linear-gradient(#000 63.85%, transparent 100%)",
  maskImage: "linear-gradient(#000 63.85%, transparent 100%)",
};

// ── NOISE OVERLAY ──
export const noise: CSSProperties = {
  position: "fixed" as const,
  inset: 0,
  zIndex: 9998,
  pointerEvents: "none" as const,
  opacity: 0.02,
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
};
