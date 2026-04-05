"use client";
import { C } from "@/lib/styles";

const cols = [
  { title: "Platform", links: ["Algo Marketplace", "Backtesting", "AI Studio", "Live Scanner", "Intelligence"] },
  { title: "Resources", links: ["Documentation", "API Reference", "Blog", "Research", "Community"] },
  { title: "Legal", links: ["Privacy Policy", "Terms of Service", "Risk Disclaimer", "SEBI Compliance"] },
];

export default function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${C.border}`, padding: "64px 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 48 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <video src="/logo.mp4" autoPlay loop muted playsInline style={{ width: 28, height: "auto", borderRadius: 6, mixBlendMode: "lighten" as const }} />
              <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: "0.04em", color: C.white }}>TradeOS</span>
            </div>
            <p style={{ fontSize: 13, fontWeight: 300, color: C.dim, lineHeight: 1.8 }}>
              AI-powered trading algorithms for Indian F&O markets.
              Institutional precision for retail investors.
            </p>
          </div>

          {cols.map(col => (
            <div key={col.title}>
              <h4 style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.14em", color: C.dim, marginBottom: 20 }}>{col.title}</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {col.links.map(l => (
                  <a key={l} href="#" style={{ fontSize: 13, fontWeight: 300, color: C.dim, textDecoration: "none", transition: "color 0.3s" }}
                    onMouseEnter={e => (e.currentTarget.style.color = C.white)}
                    onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                    {l}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.dim2 }}>// Copyright (c) 2026 TradeOS</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.dim2 }}>Trading involves risk. Past performance does not guarantee future results.</span>
        </div>
      </div>
    </footer>
  );
}
