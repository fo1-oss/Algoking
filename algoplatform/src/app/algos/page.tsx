"use client";
import DashboardLayout from "@/components/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { C, card, cardSmall, pillPrimary, pillOutline } from "@/lib/styles";

const categories = ["All", "Scalping", "Swing", "Trend", "Options", "AI-Built"];

const allAlgos = [
  { id: "godmode-v5", name: "GODMODE V5", category: "Options", tag: "Legacy",
    desc: "Previous generation 8-filter option scalper. RSI + MACD + BB + volume with ATR exits.",
    winRate: 52.4, cagr: 28.6, maxDD: 11.2, sharpe: 0.58, price: 2999, live: true, popular: false,
    backtestStrategy: "GODMODE V6 (12 filters)", backtestSymbol: "NIFTY",
    ret1m: 2.1, ret3m: 7.8, ret1y: 28.6 },
  { id: "godmode-v6", name: "GODMODE V6", category: "Options", tag: "Flagship",
    desc: "12-filter ATM option scalper with CCI crossover and expected move zone.",
    winRate: 56.8, cagr: 42.8, maxDD: 8.3, sharpe: 0.77, price: 4999, live: true, popular: true,
    backtestStrategy: "GODMODE V6 (12 filters)", backtestSymbol: "NIFTY",
    ret1m: 3.2, ret3m: 11.9, ret1y: 42.8 },
  { id: "momentum-rsi", name: "Momentum RSI", category: "Swing", tag: "Swing",
    desc: "Mean-reversion on uptrend dips. Buy RSI oversold above SMA50.",
    winRate: 55.6, cagr: 4.8, maxDD: 3.4, sharpe: 0.29, price: 2499, live: true, popular: true,
    backtestStrategy: "Momentum RSI", backtestSymbol: "NIFTY",
    ret1m: 1.1, ret3m: 2.8, ret1y: 4.8 },
  { id: "golden-cross", name: "Golden Cross", category: "Trend", tag: "Trend",
    desc: "EMA 9/21 crossover with RSI confirmation for trend following.",
    winRate: 48.0, cagr: 6.2, maxDD: 6.8, sharpe: 0.18, price: 1499, live: true, popular: false,
    backtestStrategy: "Golden Cross", backtestSymbol: "NIFTY",
    ret1m: 0.8, ret3m: 3.1, ret1y: 6.2 },
  { id: "ict-order-blocks", name: "ICT Order Blocks", category: "Scalping", tag: "Scalp",
    desc: "Institutional order flow using fair value gaps and liquidity sweeps.",
    winRate: 62.9, cagr: 32.1, maxDD: 4.8, sharpe: 0.96, price: 3999, live: false, popular: true,
    backtestStrategy: "ICT Order Blocks", backtestSymbol: "NIFTY",
    ret1m: 2.4, ret3m: 8.6, ret1y: 32.1 },
  { id: "fabervaale", name: "Fabervaale Scalp", category: "Scalping", tag: "Scalp",
    desc: "Triple-A order flow: absorption, accumulation, aggression with ATR stops.",
    winRate: 58.2, cagr: 38.5, maxDD: 5.2, sharpe: 0.85, price: 3499, live: true, popular: false,
    backtestStrategy: "GODMODE V6 (12 filters)", backtestSymbol: "NIFTY",
    ret1m: 2.8, ret3m: 9.8, ret1y: 38.5 },
  { id: "vwap-revert", name: "VWAP Reversion", category: "Scalping", tag: "Intraday",
    desc: "Mean-revert to VWAP with volume profile and Bollinger squeeze detection.",
    winRate: 62.8, cagr: 5.9, maxDD: 3.5, sharpe: 0.29, price: 1999, live: true, popular: false,
    backtestStrategy: "Mean Reversion BB+VWAP", backtestSymbol: "NIFTY",
    ret1m: 0.9, ret3m: 2.4, ret1y: 5.9 },
  { id: "orb-breakout", name: "ORB Breakout", category: "Scalping", tag: "Intraday",
    desc: "Opening range breakout with ATR targets and trend confirmation.",
    winRate: 54.7, cagr: 10.9, maxDD: 6.2, sharpe: 0.62, price: 1499, live: true, popular: false,
    backtestStrategy: "Opening Range Breakout", backtestSymbol: "NIFTY",
    ret1m: 1.5, ret3m: 4.2, ret1y: 10.9 },
  { id: "ai-momentum", name: "AI Momentum Alpha", category: "AI-Built", tag: "AI",
    desc: "Machine learning ensemble combining 40+ features. Auto-retrains weekly.",
    winRate: 52.0, cagr: 15.2, maxDD: 5.8, sharpe: 0.45, price: 5999, live: false, popular: true,
    backtestStrategy: "MACD Crossover", backtestSymbol: "NIFTY",
    ret1m: 1.8, ret3m: 5.6, ret1y: 15.2 },
];

type BacktestData = {
  totalReturn: number;
  winRate: number;
  maxDD: number;
  sharpe: number;
  profitFactor: number;
  trades: number;
  equityCurve: number[];
  tradeLog: { date: string; entry: number; exit: number; pnl: number }[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseResult(data: any): BacktestData {
  if (data.metrics) {
    const m = data.metrics;
    const eq = (data.equityCurve || []).map((p: { equity: number }) => p.equity);
    const log = (data.trades || []).slice(-10).map((t: { entryDate: string; entryPrice: number; exitPrice: number; pnl: number }) => ({
      date: t.entryDate, entry: t.entryPrice, exit: t.exitPrice, pnl: t.pnl,
    }));
    return { totalReturn: m.totalReturn, winRate: m.winRate, maxDD: m.maxDrawdown, sharpe: m.sharpeRatio, profitFactor: m.profitFactor, trades: m.totalTrades, equityCurve: eq, tradeLog: log };
  }
  return data;
}

export default function AlgosPage() {
  const [active, setActive] = useState("All");
  const [deployModal, setDeployModal] = useState<typeof allAlgos[0] | null>(null);
  const [brokerKey, setBrokerKey] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState<string[]>([]);
  // Inline backtest state
  const [backtestOpen, setBacktestOpen] = useState<string | null>(null);
  const [backtestLoading, setBacktestLoading] = useState<string | null>(null);
  const [backtestProgress, setBacktestProgress] = useState(0);
  const [backtestResults, setBacktestResults] = useState<Record<string, BacktestData>>({});
  const [backtestPeriod, setBacktestPeriod] = useState<Record<string, string>>({});
  const router = useRouter();
  const { user } = useAuth();
  const filtered = active === "All" ? allAlgos : allAlgos.filter(a => a.category === active);

  const handleDeploy = (algo: typeof allAlgos[0], e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { router.push("/login"); return; }
    setDeployModal(algo);
  };

  const runBacktest = async (algo: typeof allAlgos[0], period: string) => {
    setBacktestLoading(algo.id);
    setBacktestProgress(0);
    setBacktestPeriod(p => ({ ...p, [algo.id]: period }));
    const interval = setInterval(() => setBacktestProgress(p => Math.min(p + Math.random() * 18, 92)), 250);

    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetType: "Stock", symbol: algo.backtestSymbol, strategy: algo.backtestStrategy,
          period, capital: 200000, maxTrades: 9999,
        }),
      });
      clearInterval(interval);
      setBacktestProgress(100);
      if (res.ok) {
        const data = await res.json();
        if (!data.error) {
          setBacktestResults(prev => ({ ...prev, [algo.id]: parseResult(data) }));
        }
      }
    } catch { clearInterval(interval); }
    setTimeout(() => { setBacktestLoading(null); setBacktestProgress(0); }, 300);
  };

  const handleBacktest = (algo: typeof allAlgos[0], e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (backtestOpen === algo.id) {
      setBacktestOpen(null);
      return;
    }
    setBacktestOpen(algo.id);
    if (!backtestResults[algo.id]) {
      runBacktest(algo, "1Y");
    }
  };

  const confirmDeploy = async () => {
    if (!deployModal) return;
    setDeploying(true);
    await new Promise(r => setTimeout(r, 2000));
    setDeployed(prev => [...prev, deployModal.id]);
    setDeploying(false);
    setDeployModal(null);
    setBrokerKey("");
  };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.14em", color: C.primary, marginBottom: 8 }}>Marketplace</div>
          <h1 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 300, fontSize: "clamp(24px,4vw,36px)", letterSpacing: "-0.01em", color: C.white }}>
            Algorithm Marketplace
          </h1>
        </motion.div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
          {categories.map((c) => (
            <button key={c} onClick={() => setActive(c)}
              style={{
                padding: "8px 16px", borderRadius: 58,
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
                textTransform: "uppercase" as const, letterSpacing: "0.1em",
                cursor: "pointer", transition: "all 0.3s",
                color: active === c ? C.primary : C.dim,
                background: active === c ? `${C.primary}10` : "transparent",
                border: `1px solid ${active === c ? `${C.primary}30` : C.border}`,
              }}
              onMouseEnter={e => { if (active !== c) { e.currentTarget.style.borderColor = C.borderHover; e.currentTarget.style.color = C.silver; }}}
              onMouseLeave={e => { if (active !== c) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {filtered.map((algo, i) => (
            <motion.div key={algo.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }} style={{ display: "flex", flexDirection: "column" }}>
              <Link href={`/algos/${algo.id}`} style={{
                ...card, padding: 24, display: "flex", flexDirection: "column",
                textDecoration: "none", color: "inherit", transition: "all 0.4s",
                borderBottomLeftRadius: backtestOpen === algo.id ? 0 : 20,
                borderBottomRightRadius: backtestOpen === algo.id ? 0 : 20,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderHover; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "translateY(0)"; }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.primary }} />
                    <h3 style={{ fontSize: 14, fontWeight: 400, color: C.white }}>{algo.name}</h3>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {algo.popular && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, padding: "2px 6px", background: `${C.primary}10`, color: C.primary, borderRadius: 4 }}>Popular</span>}
                    {algo.live && (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, color: C.green }}>
                        <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.green, animation: "pulse 2s infinite" }} />
                        Live
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: C.primary, marginBottom: 10 }}>{algo.tag}</div>
                <p style={{ fontSize: 12, fontWeight: 300, color: C.silver, lineHeight: 1.7, marginBottom: 20, flex: 1 }}>{algo.desc}</p>

                {/* Backtest returns */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
                  {[
                    { v: algo.ret1m, l: "1 Month" },
                    { v: algo.ret3m, l: "3 Months" },
                    { v: algo.ret1y, l: "1 Year" },
                  ].map((m) => (
                    <div key={m.l} style={{ ...cardSmall, textAlign: "center", padding: "10px 4px", background: "rgba(14,11,14,0.5)" }}>
                      <div style={{ fontSize: 14, fontWeight: 300, color: m.v >= 0 ? C.green : C.red }}>{m.v >= 0 ? "+" : ""}{m.v}%</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, textTransform: "uppercase" as const, color: C.dim, marginTop: 2 }}>{m.l}</div>
                    </div>
                  ))}
                </div>

                {/* Stats row */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.dim }}>
                    WR <span style={{ color: C.white }}>{algo.winRate}%</span>
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.08)" }}>|</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.dim }}>
                    Sharpe <span style={{ color: C.white }}>{algo.sharpe}</span>
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.08)" }}>|</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.dim }}>
                    DD <span style={{ color: C.red }}>{algo.maxDD}%</span>
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                  <div>
                    <span style={{ fontSize: 16, fontWeight: 300, color: C.white }}>Rs.{algo.price.toLocaleString()}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.dim }}> /mo</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={(e) => handleBacktest(algo, e)}
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500,
                        padding: "6px 14px", borderRadius: 58,
                        background: backtestOpen === algo.id ? `${C.primary}15` : "transparent",
                        border: `1px solid ${backtestOpen === algo.id ? `${C.primary}40` : C.border}`,
                        color: backtestOpen === algo.id ? C.primary : C.silver,
                        cursor: "pointer", transition: "all 0.3s", letterSpacing: "0.06em",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; e.currentTarget.style.background = `${C.primary}08`; }}
                      onMouseLeave={e => { if (backtestOpen !== algo.id) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.silver; e.currentTarget.style.background = "transparent"; }}}
                    >
                      {backtestOpen === algo.id ? "Hide" : "Backtest"}
                    </button>
                    <button
                      onClick={(e) => handleDeploy(algo, e)}
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500,
                        padding: "6px 14px", borderRadius: 58,
                        background: deployed.includes(algo.id) ? `${C.green}15` : `${C.primary}10`,
                        border: `1px solid ${deployed.includes(algo.id) ? `${C.green}30` : `${C.primary}30`}`,
                        color: deployed.includes(algo.id) ? C.green : C.primary,
                        cursor: "pointer", transition: "all 0.3s", letterSpacing: "0.06em",
                      }}
                      onMouseEnter={e => { if (!deployed.includes(algo.id)) { e.currentTarget.style.background = `${C.primary}20`; e.currentTarget.style.boxShadow = `0 0 15px ${C.primaryGlow}`; }}}
                      onMouseLeave={e => { if (!deployed.includes(algo.id)) { e.currentTarget.style.background = `${C.primary}10`; e.currentTarget.style.boxShadow = "none"; }}}
                    >
                      {deployed.includes(algo.id) ? "Deployed" : "Deploy"} &rarr;
                    </button>
                  </div>
                </div>
              </Link>

              {/* ─── INLINE BACKTEST RESULTS ─── */}
              <AnimatePresence>
                {backtestOpen === algo.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div style={{
                      background: C.surface, border: `1px solid ${C.border}`, borderTop: "none",
                      borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
                      padding: 20, display: "flex", flexDirection: "column", gap: 14,
                    }}>
                      {/* Period selector */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: C.dim }}>
                          Live Backtest — {algo.backtestSymbol}
                        </span>
                        <div style={{ display: "flex", gap: 4 }}>
                          {["1Y", "3Y", "5Y"].map(p => (
                            <button key={p}
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); runBacktest(algo, p); }}
                              style={{
                                fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 500,
                                padding: "4px 10px", borderRadius: 58, cursor: "pointer",
                                background: (backtestPeriod[algo.id] || "1Y") === p ? `${C.primary}15` : "transparent",
                                border: `1px solid ${(backtestPeriod[algo.id] || "1Y") === p ? `${C.primary}40` : C.border}`,
                                color: (backtestPeriod[algo.id] || "1Y") === p ? C.primary : C.dim,
                                transition: "all 0.2s",
                              }}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Loading state */}
                      {backtestLoading === algo.id && (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.dim }}>Running backtest...</span>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.primary }}>{Math.round(backtestProgress)}%</span>
                          </div>
                          <div style={{ width: "100%", height: 3, borderRadius: 2, background: "rgba(255,255,255,0.04)" }}>
                            <motion.div animate={{ width: `${backtestProgress}%` }} transition={{ duration: 0.2 }}
                              style={{ height: "100%", borderRadius: 2, background: `linear-gradient(90deg, ${C.primary}, #6B6BFF)` }} />
                          </div>
                        </div>
                      )}

                      {/* Results */}
                      {backtestResults[algo.id] && backtestLoading !== algo.id && (() => {
                        const r = backtestResults[algo.id];
                        return (
                          <>
                            {/* Stats grid */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                              {[
                                { l: "Return", v: `${r.totalReturn >= 0 ? "+" : ""}${r.totalReturn.toFixed(1)}%`, c: r.totalReturn >= 0 ? C.green : C.red },
                                { l: "Win Rate", v: `${r.winRate.toFixed(1)}%`, c: r.winRate >= 55 ? C.green : C.red },
                                { l: "Trades", v: `${r.trades}`, c: C.white },
                                { l: "Max DD", v: `${r.maxDD.toFixed(1)}%`, c: r.maxDD < 10 ? C.green : C.red },
                                { l: "Sharpe", v: `${r.sharpe.toFixed(2)}`, c: r.sharpe >= 1.5 ? C.green : C.dim },
                                { l: "PF", v: `${r.profitFactor.toFixed(1)}`, c: r.profitFactor >= 1.5 ? C.green : C.dim },
                              ].map(s => (
                                <div key={s.l} style={{ ...cardSmall, padding: "8px 6px", textAlign: "center" }}>
                                  <div style={{ fontSize: 14, fontWeight: 300, color: s.c }}>{s.v}</div>
                                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, textTransform: "uppercase" as const, color: C.dim, marginTop: 2 }}>{s.l}</div>
                                </div>
                              ))}
                            </div>

                            {/* Mini equity curve */}
                            {r.equityCurve.length > 0 && (
                              <div>
                                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, textTransform: "uppercase" as const, color: C.dim, marginBottom: 8, letterSpacing: "0.1em" }}>Equity Curve</div>
                                <div style={{ height: 80, display: "flex", alignItems: "flex-end", gap: 1 }}>
                                  {(() => {
                                    // Sample to max 60 bars
                                    const ec = r.equityCurve;
                                    const step = Math.max(1, Math.floor(ec.length / 60));
                                    const sampled = ec.filter((_, i) => i % step === 0);
                                    const min = Math.min(...sampled);
                                    const max = Math.max(...sampled);
                                    const range = max - min || 1;
                                    return sampled.map((v, i) => {
                                      const h = ((v - min) / range) * 90 + 8;
                                      const isUp = i === 0 || v >= sampled[i - 1];
                                      return (
                                        <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${h}%` }}
                                          transition={{ duration: 0.2, delay: i * 0.005 }}
                                          style={{
                                            flex: 1, borderRadius: "1px 1px 0 0",
                                            background: isUp
                                              ? "linear-gradient(to top, rgba(74,222,128,0.1), rgba(74,222,128,0.4))"
                                              : "linear-gradient(to top, rgba(248,113,113,0.1), rgba(248,113,113,0.35))",
                                          }} />
                                      );
                                    });
                                  })()}
                                </div>
                              </div>
                            )}

                            {/* Recent trades */}
                            {r.tradeLog.length > 0 && (
                              <div>
                                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, textTransform: "uppercase" as const, color: C.dim, marginBottom: 6, letterSpacing: "0.1em" }}>Recent Trades</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                  {r.tradeLog.slice(-5).map((t, i) => (
                                    <div key={i} style={{
                                      display: "flex", justifyContent: "space-between", alignItems: "center",
                                      padding: "5px 8px", borderRadius: 6, background: "rgba(255,255,255,0.015)",
                                    }}>
                                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.dim }}>{t.date}</span>
                                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.silver }}>
                                        {t.entry.toFixed(0)} → {t.exit.toFixed(0)}
                                      </span>
                                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 500, color: t.pnl >= 0 ? C.green : C.red }}>
                                        {t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(0)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Open in full backtest lab */}
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/backtest?strategy=${encodeURIComponent(algo.backtestStrategy)}&symbol=${algo.backtestSymbol}`); }}
                              style={{
                                fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 500,
                                padding: "8px 0", borderRadius: 10, cursor: "pointer",
                                background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`,
                                color: C.dim, textTransform: "uppercase" as const, letterSpacing: "0.1em",
                                transition: "all 0.2s",
                              }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}
                            >
                              Open Full Backtest Lab →
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Deploy Modal */}
      <AnimatePresence>
        {deployModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 100,
              background: "rgba(1,2,4,0.85)", backdropFilter: "blur(20px)",
              display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
            }}
            onClick={() => { if (!deploying) { setDeployModal(null); setBrokerKey(""); } }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              onClick={e => e.stopPropagation()}
              style={{ ...card, width: "100%", maxWidth: 480, padding: "36px 32px", display: "flex", flexDirection: "column", gap: 24 }}
            >
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.14em", color: C.primary, marginBottom: 8 }}>Deploy Algorithm</div>
                <h2 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 300, fontSize: 22, color: C.white, letterSpacing: "-0.01em" }}>{deployModal.name}</h2>
                <p style={{ fontSize: 12, fontWeight: 300, color: C.dim, marginTop: 4 }}>Rs.{deployModal.price.toLocaleString()}/mo &mdash; {deployModal.tag}</p>
              </div>

              <div style={{ ...cardSmall, padding: 16 }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: C.dim, marginBottom: 12 }}>How Deployment Works</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { n: "01", t: "Connect your broker (Dhan API key)" },
                    { n: "02", t: "Algorithm runs on our servers using your credentials" },
                    { n: "03", t: "Orders execute automatically in your account" },
                    { n: "04", t: "You maintain full control \u2014 pause/stop anytime" },
                  ].map(step => (
                    <div key={step.n} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, background: `${C.primary}10`, color: C.primary, flexShrink: 0 }}>{step.n}</span>
                      <span style={{ fontSize: 12, fontWeight: 300, color: C.silver }}>{step.t}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: C.dim, display: "block", marginBottom: 8 }}>Dhan Access Token</label>
                <input type="password" placeholder="Paste your Dhan API access token" value={brokerKey} onChange={e => setBrokerKey(e.target.value)}
                  style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 12, color: C.white, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
                  onFocus={e => e.currentTarget.style.borderColor = C.primary}
                  onBlur={e => e.currentTarget.style.borderColor = C.border}
                />
                <p style={{ fontSize: 10, fontWeight: 300, color: C.dim, marginTop: 6 }}>Your credentials are encrypted and stored per-user.</p>
              </div>

              <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.15)" }}>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "rgba(248,113,113,0.7)", lineHeight: 1.6 }}>
                  Trading involves risk. Past backtest performance does not guarantee future results.
                </p>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setDeployModal(null); setBrokerKey(""); }} disabled={deploying}
                  style={{ ...pillOutline, flex: 1, fontSize: 12, padding: "12px 20px", fontFamily: "'Be Vietnam Pro', sans-serif", opacity: deploying ? 0.5 : 1 }}>
                  Cancel
                </button>
                <button onClick={confirmDeploy} disabled={!brokerKey.trim() || deploying}
                  style={{ ...pillPrimary, flex: 1, fontSize: 12, padding: "12px 20px", fontFamily: "'Be Vietnam Pro', sans-serif", opacity: !brokerKey.trim() || deploying ? 0.5 : 1, boxShadow: brokerKey.trim() && !deploying ? `0 0 20px ${C.primaryGlow}` : "none" }}>
                  {deploying ? "Deploying..." : "Confirm Deploy"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
