"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { C } from "@/lib/styles";
import GridBackground from "./GridBackground";

const sidebarLinks = [
  { href: "/dashboard", label: "Overview", letter: "O" },
  { href: "/algos", label: "Algorithms", letter: "A" },
  { href: "/backtest", label: "Backtest", letter: "B" },
  { href: "/chat", label: "AI Studio", letter: "C" },
  { href: "/news", label: "Intelligence", letter: "N" },
  { href: "/pricing", label: "Pricing", letter: "P" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", minHeight: "100vh", position: "relative" }}>
      <GridBackground />

      {/* Sidebar */}
      <aside className="hidden md:flex" style={{
        flexDirection: "column", width: 240, borderRight: `1px solid ${C.border}`,
        background: "rgba(1,2,4,0.9)", backdropFilter: "blur(20px)",
        position: "relative", zIndex: 20, flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}` }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <video
              src="/logo.mp4"
              autoPlay
              loop
              muted
              playsInline
              style={{ width: 28, height: "auto", borderRadius: 6, mixBlendMode: "lighten" as const }}
            />
            <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: "0.04em", color: C.white }}>TradeOS</span>
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
          {sidebarLinks.map((link) => {
            const active = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  position: "relative", display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 10, fontSize: 13, fontWeight: 300,
                  letterSpacing: "0.02em", textDecoration: "none",
                  transition: "all 0.3s",
                  color: active ? C.white : C.dim,
                  background: active ? "rgba(79,79,241,0.08)" : "transparent",
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.color = C.silver; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.color = C.dim; e.currentTarget.style.background = "transparent"; } }}
              >
                {active && (
                  <motion.div
                    layoutId="sidebar-active"
                    style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 2, height: 20, borderRadius: "0 2px 2px 0", background: C.primary }}
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <span style={{
                  width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500,
                  background: active ? `${C.primary}15` : "rgba(255,255,255,0.03)",
                  color: active ? C.primary : C.dim,
                }}>
                  {link.letter}
                </span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom - user info */}
        <div style={{ padding: "16px 12px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: `${C.primary}15`, border: `1px solid ${C.primary}25`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 600, color: C.primary }}>K</span>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 400, color: C.white }}>Trader</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.dim }}>Pro Plan</div>
              </div>
            </div>
            <div style={{ marginTop: 6, width: "100%", height: 2, borderRadius: 1, background: "rgba(255,255,255,0.04)" }}>
              <div style={{ height: "100%", width: "60%", borderRadius: 1, background: `${C.primary}60` }} />
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.dim, marginTop: 6 }}>3 algos deployed</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh", position: "relative", zIndex: 10 }}>
        {/* Top bar */}
        <header style={{
          position: "sticky", top: 0, zIndex: 40,
          borderBottom: `1px solid ${C.border}`,
          background: "rgba(1,2,4,0.85)", backdropFilter: "blur(20px)",
          padding: "12px 24px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="hidden md:flex" style={{ alignItems: "center", gap: 10, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.dim }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.green, animation: "pulse 2s infinite" }} />
              <span>Market Open</span>
              <span style={{ color: "rgba(255,255,255,0.1)", margin: "0 4px" }}>|</span>
              <span style={{ color: C.silver }}>NIFTY 23,842</span>
              <span style={{ color: C.green }}>+1.24%</span>
            </div>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: `${C.primary}10`, border: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.primary }}>K</span>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, padding: 24, overflow: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
