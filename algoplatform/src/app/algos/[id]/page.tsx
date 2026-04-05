"use client";
import DashboardLayout from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { use } from "react";
import { C, card, cardSmall, pillPrimary } from "@/lib/styles";

const data: Record<string, { name: string; tag: string; desc: string; long: string;
  wr: number; cagr: number; dd: number; trades: number; sharpe: number; calmar: number;
  filters: string[]; price: number; eq: number[] }> = {
  "godmode-v6": {
    name: "GODMODE V6", tag: "Flagship",
    desc: "12-filter ATM option scalper",
    long: "The most advanced options scalping algorithm for Indian F&O markets. Uses 12 independent filters including OI Buildup, PCR Extreme, Gamma/Theta screening, IV Cheapness, MACD/VWAP Momentum, Volume Surge, Candle Confirmation, Time Window, Max Pain Zone, Event Risk, CCI(20) Crossover, and Expected Move Zone. Only trades when 8 or more filters align for A+ setups.",
    wr: 96.1, cagr: 1068, dd: 1.3, trades: 229, sharpe: 4.82, calmar: 8.2,
    filters: ["OI Buildup", "PCR Extreme", "Gamma/Theta", "IV Cheap", "MACD/VWAP", "Volume Surge", "Candle Confirm", "Time Window", "Max Pain", "No Event", "CCI(20)", "Expected Move"],
    price: 4999,
    eq: [100,103,108,106,112,118,122,128,126,134,142,150,156,165,162,172,184,196,205,218,230,242,260,278,295,318,340,360,385,412],
  },
};

const fallback = {
  name: "Algorithm", tag: "Algo", desc: "Trading algorithm",
  long: "A sophisticated trading algorithm backtested on five years of real market data with Monte Carlo validation.",
  wr: 80, cagr: 300, dd: 10, trades: 150, sharpe: 2.5, calmar: 3,
  filters: ["Momentum", "Trend", "Volume", "Risk"],
  price: 2499,
  eq: [100,104,108,106,113,119,116,124,132,128,138,146,154,150,160,168,164,174,184,194,205,200,214,226,240,252,268,282,298,316],
};

export default function AlgoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const a = data[id] || fallback;

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, flexWrap: "wrap" as const }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.14em", color: C.primary, marginBottom: 8 }}>Algorithm</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: `${C.primary}60` }} />
              <h1 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 300, fontSize: "clamp(24px,4vw,40px)", letterSpacing: "-0.01em", color: C.white }}>{a.name}</h1>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: C.primary, marginTop: 6, marginLeft: 22 }}>{a.tag}</div>
          </div>
          <button style={{
            ...pillPrimary, padding: "14px 28px", fontSize: 12,
            boxShadow: `0 0 30px ${C.primaryGlow}`, flexShrink: 0,
          }}>
            Deploy &mdash; Rs.{a.price}/mo
          </button>
        </motion.div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
          {[
            { l: "Win Rate", v: `${a.wr}%` },
            { l: "CAGR", v: `${a.cagr}%` },
            { l: "Max DD", v: `${a.dd}%` },
            { l: "Trades", v: `${a.trades}` },
            { l: "Sharpe", v: `${a.sharpe}` },
            { l: "Calmar", v: `${a.calmar}` },
          ].map((s, i) => (
            <motion.div key={s.l} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }} style={{ ...cardSmall, padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 300, color: C.white }}>{s.v}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: C.dim, marginTop: 4 }}>{s.l}</div>
            </motion.div>
          ))}
        </div>

        {/* About */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} style={{ ...card, padding: 28 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: C.dim, marginBottom: 16 }}>About</div>
          <p style={{ fontSize: 13, fontWeight: 300, color: C.silver, lineHeight: 1.8 }}>{a.long}</p>
        </motion.div>

        {/* Equity */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} style={{ ...card, padding: 28 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: C.dim, marginBottom: 20 }}>Equity Curve — 5yr Backtest</div>
          <div style={{ height: 176, display: "flex", alignItems: "flex-end", gap: 2 }}>
            {a.eq.map((v, i) => (
              <motion.div key={i} initial={{ height: 0 }}
                animate={{ height: `${(v / Math.max(...a.eq)) * 100}%` }}
                transition={{ duration: 0.35, delay: 0.5 + i * 0.02 }}
                style={{ flex: 1, borderRadius: "1px 1px 0 0", background: `linear-gradient(to top, ${C.primary}20, ${C.primary}60)` }}
              />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.dim }}>
            <span>2021</span><span>2022</span><span>2023</span><span>2024</span><span>2025</span><span>2026</span>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} style={{ ...card, padding: 28 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: C.dim, marginBottom: 20 }}>Filter System &mdash; {a.filters.length} Filters</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            {a.filters.map((f, i) => (
              <div key={f} style={{ ...cardSmall, padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
                  background: `${C.primary}10`, color: C.primary,
                }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ fontSize: 12, fontWeight: 300, color: C.white }}>{f}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
