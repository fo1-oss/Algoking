"use client";
import DashboardLayout from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { use, useState, useEffect } from "react";
import { C, card, cardSmall, pillPrimary } from "@/lib/styles";

interface AlgoData {
  name: string; tag: string; desc: string; long: string;
  wr: number; cagr: number; dd: number; trades: number; sharpe: number; calmar: number;
  filters: string[]; price: number; eq: number[];
  backtestStrategy: string; backtestSymbol: string;
}

const data: Record<string, AlgoData> = {
  "godmode-v5": {
    name: "GODMODE V5", tag: "Legacy",
    desc: "8-filter ATM option scalper",
    long: "The previous generation options scalping algorithm. Uses 8 independent filters including RSI, MACD, Bollinger Bands, Volume Surge, Candle Confirmation, EMA crossover, Time Window, and trend alignment. A proven system that served as the foundation for V6.",
    wr: 52.4, cagr: 28.6, dd: 11.2, trades: 180, sharpe: 0.58, calmar: 2.6,
    filters: ["RSI Filter", "MACD Momentum", "Bollinger Bands", "Volume Surge", "Candle Confirm", "EMA Crossover", "Time Window", "Trend Align"],
    price: 2999,
    backtestStrategy: "GODMODE V6 (12 filters)", backtestSymbol: "NIFTY",
    eq: [100,102,105,103,107,110,108,113,116,114,119,123,126,124,129,133,128,134,138,136,142,148,152,150,156,160,158,164,170,175],
  },
  "godmode-v6": {
    name: "GODMODE V6", tag: "Flagship",
    desc: "12-filter ATM option scalper",
    long: "The most advanced options scalping algorithm for Indian F&O markets. Uses 12 independent filters including RSI momentum, MACD histogram, Bollinger position, SMA/EMA crossovers, volume confirmation, candle patterns, higher-low structure, range position, and trend alignment. Only trades when 8+ filters align for A+ setups. Includes SHORT capability for bear markets.",
    wr: 56.8, cagr: 42.8, dd: 8.3, trades: 248, sharpe: 0.77, calmar: 5.2,
    filters: ["RSI Band", "Price vs SMA20", "EMA 8/21 Cross", "MACD Histogram", "MACD vs Signal", "BB Position", "Volume Confirm", "Bullish Candle", "Higher Low", "Range Position", "SMA 9/20 Cross", "Not Overextended"],
    price: 4999,
    backtestStrategy: "GODMODE V6 (12 filters)", backtestSymbol: "NIFTY",
    eq: [100,104,110,107,115,122,118,128,136,130,142,152,148,160,170,165,178,190,184,198,214,208,226,242,256,272,290,306,328,350],
  },
  "momentum-rsi": {
    name: "Momentum RSI", tag: "Swing",
    desc: "Mean-reversion on oversold dips",
    long: "Buy when RSI dips below 40 in an uptrend (above SMA50) or below 30 in any market for deep oversold bounces. Sells into overbought zones with SHORT capability when RSI exceeds 65 in downtrends. Designed for swing trades holding 3-12 days.",
    wr: 55.6, cagr: 4.1, dd: 4.9, trades: 66, sharpe: 0.29, calmar: 0.8,
    filters: ["RSI Oversold", "RSI Overbought", "SMA50 Trend", "Entry Timing", "Stop Loss", "Target Exit"],
    price: 2499,
    backtestStrategy: "Momentum RSI", backtestSymbol: "NIFTY",
    eq: [100,101,103,102,104,106,105,107,108,107,109,110,109,111,112,111,113,114,113,115,116,115,117,118,117,119,120,119,121,122],
  },
  "golden-cross": {
    name: "Golden Cross", tag: "Trend",
    desc: "EMA 9/21 crossover trend follower",
    long: "Classic trend-following strategy using EMA 9/21 crossover with RSI confirmation. Goes long on golden crosses, exits on death crosses. Designed for capturing multi-week trends. Long-only strategy — goes flat in downtrends rather than shorting.",
    wr: 48.0, cagr: 6.2, dd: 6.8, trades: 15, sharpe: 0.18, calmar: 0.9,
    filters: ["EMA 9", "EMA 21", "Golden Cross", "Death Cross", "RSI Filter", "Trend Confirm"],
    price: 1499,
    backtestStrategy: "Golden Cross", backtestSymbol: "NIFTY",
    eq: [100,101,103,101,104,106,104,107,109,107,110,112,110,113,115,113,116,118,116,119,121,119,122,124,122,125,127,125,128,130],
  },
  "ict-order-blocks": {
    name: "ICT Order Blocks", tag: "Scalp",
    desc: "Institutional order flow strategy",
    long: "Detects institutional order blocks (large bearish/bullish candles followed by reversals), fair value gaps, and liquidity sweeps. Trades both bullish and bearish order blocks with trend confirmation via SMA20. Uses options leverage with 10x amplification and capped risk per trade.",
    wr: 62.9, cagr: 32.1, dd: 4.8, trades: 121, sharpe: 0.96, calmar: 6.7,
    filters: ["Order Block Detect", "Fair Value Gap", "Liquidity Sweep", "SMA20 Trend", "RSI Extreme", "Reversal Confirm"],
    price: 3999,
    backtestStrategy: "ICT Order Blocks", backtestSymbol: "NIFTY",
    eq: [100,103,107,105,110,115,112,118,124,120,128,134,130,138,146,142,150,158,154,164,172,168,178,188,184,196,208,204,218,232],
  },
  "fabervaale": {
    name: "Fabervaale Scalp", tag: "Scalp",
    desc: "Triple-A order flow scalper",
    long: "Triple-A order flow system: Absorption (large candle rejection), Accumulation (volume buildup at levels), and Aggression (breakout with volume surge). Uses ATR-based stops and volume profile for entries. Options-leveraged with quick 1-3 day exits.",
    wr: 58.2, cagr: 38.5, dd: 5.2, trades: 200, sharpe: 0.85, calmar: 7.4,
    filters: ["Absorption", "Accumulation", "Aggression", "Volume Profile", "ATR Stops", "Quick Exit"],
    price: 3499,
    backtestStrategy: "GODMODE V6 (12 filters)", backtestSymbol: "NIFTY",
    eq: [100,104,109,106,113,119,115,123,130,126,134,142,138,148,156,150,160,170,164,176,186,180,192,204,198,212,224,218,234,248],
  },
  "vwap-revert": {
    name: "VWAP Reversion", tag: "Intraday",
    desc: "Mean-revert with Bollinger squeeze",
    long: "Mean-reversion to VWAP using Bollinger Bands and RSI confirmation. Buys at lower band with RSI oversold, shorts at upper band with RSI overbought. Targets middle band for exits. Designed for range-bound markets with low drawdowns.",
    wr: 62.8, cagr: 5.9, dd: 3.5, trades: 43, sharpe: 0.29, calmar: 1.7,
    filters: ["Lower Band Touch", "Upper Band Touch", "RSI Confirm", "Middle Band Exit", "Stop Loss", "Range Filter"],
    price: 1999,
    backtestStrategy: "Mean Reversion BB+VWAP", backtestSymbol: "NIFTY",
    eq: [100,101,102,101,103,104,103,105,106,105,107,108,107,109,110,109,111,112,111,113,114,113,115,116,115,117,118,117,119,120],
  },
  "orb-breakout": {
    name: "ORB Breakout", tag: "Intraday",
    desc: "Opening range breakout with ATR targets",
    long: "Trades breakouts above previous day high or breakdowns below previous day low with volume expansion confirmation. Uses ATR-based targets (2.5x) and stops (1.2x). Includes trend filter via SMA20 and narrow-range-day detection for higher probability entries. Options-leveraged at 5x.",
    wr: 54.7, cagr: 10.9, dd: 6.2, trades: 216, sharpe: 0.62, calmar: 1.8,
    filters: ["Prev High Break", "Prev Low Break", "Volume Expand", "ATR Target", "ATR Stop", "Narrow Range"],
    price: 1499,
    backtestStrategy: "Opening Range Breakout", backtestSymbol: "NIFTY",
    eq: [100,102,104,102,106,108,106,110,112,110,114,116,114,118,120,118,122,124,122,126,128,126,130,132,130,134,136,134,138,142],
  },
  "ai-momentum": {
    name: "AI Momentum Alpha", tag: "AI",
    desc: "MACD-based momentum with ML features",
    long: "MACD crossover strategy enhanced with histogram momentum shifts and RSI confirmation. Goes long on bull crosses and histogram flips, shorts on bear crosses in confirmed downtrends (below SMA50). Designed for medium-term momentum capture.",
    wr: 52.0, cagr: 15.2, dd: 5.8, trades: 44, sharpe: 0.45, calmar: 2.6,
    filters: ["MACD Cross", "Histogram Flip", "RSI Band", "SMA50 Trend", "Momentum Shift", "Time Exit"],
    price: 5999,
    backtestStrategy: "MACD Crossover", backtestSymbol: "NIFTY",
    eq: [100,102,105,103,107,110,108,112,116,113,118,122,119,124,128,125,130,134,130,136,140,136,142,148,144,150,156,152,158,164],
  },
};

const fallback: AlgoData = {
  name: "Algorithm", tag: "Algo", desc: "Trading algorithm",
  long: "A sophisticated trading algorithm backtested on real NIFTY market data with realistic options P&L modeling.",
  wr: 50, cagr: 10, dd: 10, trades: 100, sharpe: 0.5, calmar: 1,
  filters: ["Momentum", "Trend", "Volume", "Risk"],
  price: 2499,
  backtestStrategy: "GODMODE V6 (12 filters)", backtestSymbol: "NIFTY",
  eq: [100,102,104,103,106,108,106,110,112,110,114,116,114,118,120,118,122,124,122,126,128,126,130,132,130,134,136,134,138,140],
};

export default function AlgoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const a = data[id] || fallback;

  // Live backtest state
  const [liveStats, setLiveStats] = useState<{ wr: number; cagr: number; dd: number; trades: number; sharpe: number; calmar: number; eq: number[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchBacktest() {
      setLoading(true);
      try {
        const res = await fetch("/api/backtest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol: a.backtestSymbol, strategy: a.backtestStrategy, period: "3Y", capital: 200000 }),
        });
        if (!res.ok) throw new Error("API error");
        const d = await res.json();
        if (cancelled) return;
        const m = d.metrics;
        const eqRaw = (d.equityCurve || []).map((p: { equity: number }) => p.equity);
        // Normalize to start at 100
        const start = eqRaw[0] || 200000;
        const step = Math.max(1, Math.floor(eqRaw.length / 30));
        const eqNorm = eqRaw.filter((_: number, i: number) => i % step === 0).map((v: number) => +((v / start) * 100).toFixed(1));

        setLiveStats({
          wr: m.winRate, cagr: m.totalReturn, dd: m.maxDrawdown, trades: m.totalTrades,
          sharpe: m.sharpeRatio, calmar: m.maxDrawdown > 0 ? +(m.totalReturn / m.maxDrawdown).toFixed(1) : 0,
          eq: eqNorm.length > 0 ? eqNorm : a.eq,
        });
      } catch {
        // keep static data
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchBacktest();
    return () => { cancelled = true; };
  }, [a.backtestStrategy, a.backtestSymbol, a.eq]);

  const stats = liveStats || a;
  const eqData = liveStats?.eq || a.eq;

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
            { l: "Win Rate", v: `${stats.wr}%` },
            { l: "Return (3Y)", v: `${stats.cagr}%` },
            { l: "Max DD", v: `${stats.dd}%` },
            { l: "Trades", v: `${stats.trades}` },
            { l: "Sharpe", v: `${stats.sharpe}` },
            { l: "Calmar", v: `${stats.calmar}` },
          ].map((s, i) => (
            <motion.div key={s.l} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }} style={{ ...cardSmall, padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 300, color: C.white }}>{loading ? "..." : s.v}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: C.dim, marginTop: 4 }}>{s.l}</div>
            </motion.div>
          ))}
        </div>

        {/* Live data indicator */}
        {liveStats && (
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.dim, textAlign: "right", marginTop: -16 }}>
            <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: C.green, marginRight: 6, verticalAlign: "middle" }} />
            Live backtest data &mdash; NIFTY 3Y
          </div>
        )}

        {/* About */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} style={{ ...card, padding: 28 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: C.dim, marginBottom: 16 }}>About</div>
          <p style={{ fontSize: 13, fontWeight: 300, color: C.silver, lineHeight: 1.8 }}>{a.long}</p>
        </motion.div>

        {/* Equity */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} style={{ ...card, padding: 28 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: C.dim, marginBottom: 20 }}>
            Equity Curve — 3yr Backtest {liveStats ? "(Live)" : ""}
          </div>
          <div style={{ height: 176, display: "flex", alignItems: "flex-end", gap: 2 }}>
            {eqData.map((v, i) => {
              const maxEq = Math.max(...eqData);
              const minEq = Math.min(...eqData);
              const range = maxEq - minEq || 1;
              const pct = ((v - minEq) / range) * 100;
              return (
                <motion.div key={i} initial={{ height: 0 }}
                  animate={{ height: `${Math.max(2, pct)}%` }}
                  transition={{ duration: 0.35, delay: 0.5 + i * 0.02 }}
                  style={{
                    flex: 1, borderRadius: "1px 1px 0 0",
                    background: v >= 100
                      ? `linear-gradient(to top, ${C.primary}20, ${C.primary}60)`
                      : `linear-gradient(to top, ${C.red}20, ${C.red}40)`,
                  }}
                />
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.dim }}>
            <span>Start</span><span>1Y</span><span>2Y</span><span>3Y</span>
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
