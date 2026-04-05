"use client";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import { C, card, cardSmall } from "@/lib/styles";
import TextScramble from "./TextScramble";

const algos = [
  { id: "godmode-v6", name: "GODMODE V6", tag: "Flagship", desc: "12-filter ATM option scalper with CCI crossover and expected move zone. Institutional-grade entry precision.", wr: 96.1, cagr: 1068, dd: 1.3, trades: 229, filters: 12, live: true },
  { id: "momentum-rsi", name: "Momentum RSI", tag: "Swing", desc: "RSI mean-reversion on uptrend stocks. Buys dips above SMA200, exits on overbought readings.", wr: 78.4, cagr: 342, dd: 8.2, trades: 156, filters: 6, live: true },
  { id: "golden-cross", name: "Golden Cross", tag: "Trend", desc: "SMA 50/200 crossover with volume confirmation. Designed to capture macro trends while filtering noise.", wr: 71.2, cagr: 185, dd: 15.4, trades: 48, filters: 4, live: true },
  { id: "ict-order-blocks", name: "ICT Order Blocks", tag: "Scalp", desc: "Institutional order flow analysis using fair value gaps, liquidity sweeps, and breaker blocks.", wr: 82.7, cagr: 456, dd: 5.8, trades: 312, filters: 8, live: false },
];

export default function AlgoShowcase() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} style={{ padding: "140px 24px", position: "relative" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <motion.div initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}}
          style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 60 }}>
          <div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "8px 20px", borderRadius: 58, border: `1px solid ${C.border}`,
              background: "rgba(14,11,14,0.6)", marginBottom: 24,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.primary }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: C.dim }}>
                {inView && <TextScramble text="Algorithms" delay={200} />}
              </span>
            </div>
            <h2 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 300, fontSize: "clamp(32px, 5vw, 52px)", letterSpacing: "-0.01em", color: C.white, lineHeight: 1.1 }}>
              Battle-Tested Algos
            </h2>
          </div>
          <Link href="/algos" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 400, letterSpacing: "0.05em", color: C.dim, textDecoration: "none", transition: "color 0.3s" }}
            onMouseEnter={e => (e.currentTarget.style.color = C.primary)}
            onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
            View All &rarr;
          </Link>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))", gap: 16 }}>
          {algos.map((a, i) => (
            <motion.div key={a.id} initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.1 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}>
              <Link href={`/algos/${a.id}`} style={{
                ...card, padding: 28, display: "block", textDecoration: "none", color: "inherit",
                transition: "all 0.4s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderHover; e.currentTarget.style.boxShadow = `0 8px 40px rgba(79,79,241,0.08)`; e.currentTarget.style.transform = "translateY(-3px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}>

                {/* Top */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.primary, boxShadow: `0 0 12px ${C.primaryGlow}` }} />
                    <span style={{ fontSize: 15, fontWeight: 400, letterSpacing: "0.02em", color: C.white }}>{a.name}</span>
                    <span style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 500,
                      letterSpacing: "0.1em", textTransform: "uppercase" as const,
                      padding: "3px 10px", borderRadius: 58, border: `1px solid ${C.border}`,
                      color: C.primary, background: `${C.primary}10`,
                    }}>{a.tag}</span>
                  </div>
                  {a.live && (
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 500, color: C.green }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.green, animation: "pulse 2s infinite" }} />
                      Live
                    </span>
                  )}
                </div>

                <p style={{ fontSize: 13, fontWeight: 300, color: C.silver, lineHeight: 1.7, marginBottom: 24 }}>{a.desc}</p>

                {/* Metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {[
                    { v: `${a.wr}%`, l: "Win Rate" },
                    { v: `${a.cagr}%`, l: "CAGR" },
                    { v: `${a.dd}%`, l: "Max DD" },
                    { v: `${a.trades}`, l: "Trades" },
                  ].map(m => (
                    <div key={m.l} style={{ ...cardSmall, padding: "12px 8px", textAlign: "center", background: "rgba(14,11,14,0.5)" }}>
                      <div style={{ fontSize: 16, fontWeight: 300, letterSpacing: "-0.01em", color: C.white }}>{m.v}</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: C.dim, marginTop: 4 }}>{m.l}</div>
                    </div>
                  ))}
                </div>

                {/* Filter bar */}
                <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, height: 2, borderRadius: 1, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={inView ? { width: `${(a.filters / 12) * 100}%` } : {}}
                      transition={{ duration: 1.2, delay: 0.5 + i * 0.1 }}
                      style={{ height: "100%", borderRadius: 1, background: `linear-gradient(90deg, ${C.primary}80, ${C.primary}20)` }}
                    />
                  </div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.dim }}>{a.filters}/12</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
