"use client";
import DashboardLayout from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { C, card, cardSmall } from "@/lib/styles";

interface LiveAlgo {
  name: string;
  status: "Active" | "Watching" | "Flat";
  todayPnl: number;
  todayTrades: number;
  winRate: number;
  position: {
    symbol: string;
    type: "LONG" | "SHORT" | "FLAT";
    entryPrice: number;
    currentPrice: number;
    pnl: number;
    pnlPct: number;
    signal: string;
    confidence: number;
  } | null;
  lastSignal: string;
  lastSignalTime: string;
}

interface LiveData {
  timestamp: string;
  market: {
    nifty: number;
    niftyChange: number;
    niftyChangePct: number;
    dayHigh: number;
    dayLow: number;
    isOpen: boolean;
  };
  portfolio: {
    capital: number;
    totalPnl: number;
    totalPnlPct: number;
    activeTrades: number;
    totalAlgos: number;
  };
  algos: LiveAlgo[];
}

function formatINR(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 10000000) return `${(n / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${(n / 100000).toFixed(2)} L`;
  return n.toLocaleString("en-IN");
}

export default function DashboardPage() {
  const [live, setLive] = useState<LiveData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchLive() {
      try {
        const res = await fetch("/api/live-pnl");
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        if (cancelled) return;
        setLive(data);
        setLastUpdate(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        setPulse(true);
        setTimeout(() => setPulse(false), 500);
      } catch {
        // keep previous data
      }
    }

    fetchLive();
    const interval = setInterval(fetchLive, 10000); // Every 10 seconds
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const market = live?.market;
  const portfolio = live?.portfolio;
  const algos = live?.algos || [];
  const activeAlgos = algos.filter(a => a.status === "Active");
  const totalPnl = portfolio?.totalPnl || 0;

  // Greeting based on time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.14em", color: C.primary, marginBottom: 8 }}>Live Dashboard</div>
              <h1 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 300, fontSize: "clamp(24px,4vw,36px)", letterSpacing: "-0.01em", color: C.white }}>
                {greeting}, Kunaal.
              </h1>
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.dim, marginTop: 8 }}>
                {activeAlgos.length} algo{activeAlgos.length !== 1 ? "s" : ""} active &middot; {algos.filter(a => a.status === "Watching").length} watching &middot; {market?.isOpen ? "Market Open" : "Market Closed"}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.dim }}>
                <span style={{
                  display: "inline-block", width: 6, height: 6, borderRadius: "50%",
                  background: pulse ? C.green : `${C.green}80`,
                  marginRight: 6, verticalAlign: "middle",
                  transition: "all 0.3s",
                  boxShadow: pulse ? `0 0 8px ${C.green}` : "none",
                }} />
                Live &middot; Updated {lastUpdate || "..."}
              </div>
              {market && (
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: market.niftyChange >= 0 ? C.green : C.red, marginTop: 6 }}>
                  NIFTY {market.nifty.toLocaleString("en-IN")} <span style={{ fontSize: 10 }}>{market.niftyChange >= 0 ? "▲" : "▼"} {Math.abs(market.niftyChangePct)}%</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Portfolio Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { label: "Capital", value: `₹${formatINR(portfolio?.capital || 200000)}`, color: C.white },
            { label: "Today P&L", value: `${totalPnl >= 0 ? "+" : ""}₹${formatINR(totalPnl)}`, color: totalPnl >= 0 ? C.green : C.red },
            { label: "Active Trades", value: `${activeAlgos.length}`, color: C.primary },
            { label: "P&L %", value: `${(portfolio?.totalPnlPct || 0) >= 0 ? "+" : ""}${portfolio?.totalPnlPct || 0}%`, color: (portfolio?.totalPnlPct || 0) >= 0 ? C.green : C.red },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }} style={{ ...card, padding: 20 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: C.dim, marginBottom: 12 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 300, letterSpacing: "-0.01em", color: s.color }}>
                {s.value}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Algo Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: C.dim }}>Algo Status — Live</div>
          {algos.map((algo, i) => (
            <motion.div key={algo.name} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.06 }}
              style={{ ...card, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                {/* Left: Name + Status */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: algo.status === "Active" ? C.green : algo.status === "Watching" ? C.gold : C.dim,
                      boxShadow: algo.status === "Active" ? `0 0 8px ${C.green}60` : "none",
                    }} />
                    <span style={{ fontSize: 14, fontWeight: 400, color: C.white }}>{algo.name}</span>
                    <span style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, padding: "2px 8px", borderRadius: 58,
                      color: algo.status === "Active" ? C.green : algo.status === "Watching" ? C.gold : C.dim,
                      background: algo.status === "Active" ? `${C.green}10` : algo.status === "Watching" ? `${C.gold}10` : "rgba(255,255,255,0.03)",
                    }}>
                      {algo.status}
                    </span>
                  </div>

                  {/* Signal */}
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.dim, marginBottom: 8 }}>
                    <span style={{ color: C.silver }}>{algo.lastSignal}</span>
                    <span style={{ marginLeft: 10, fontSize: 8 }}>@ {algo.lastSignalTime}</span>
                  </div>

                  {/* Position details */}
                  {algo.position && (
                    <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                      {[
                        { l: "Position", v: `${algo.position.type} ${algo.position.symbol}` },
                        { l: "Entry", v: algo.position.entryPrice.toLocaleString("en-IN") },
                        { l: "CMP", v: algo.position.currentPrice.toLocaleString("en-IN") },
                        { l: "Confidence", v: `${algo.position.confidence}%` },
                      ].map(m => (
                        <div key={m.l}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, textTransform: "uppercase" as const, color: C.dim, marginBottom: 2 }}>{m.l}</div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.white }}>{m.v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: P&L */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{
                    fontSize: 20, fontWeight: 300, fontFamily: "'IBM Plex Mono', monospace",
                    color: algo.todayPnl >= 0 ? C.green : C.red,
                  }}>
                    {algo.todayPnl >= 0 ? "+" : ""}₹{formatINR(algo.todayPnl)}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.dim, marginTop: 4 }}>
                    WR {algo.winRate}% &middot; {algo.todayTrades} trade{algo.todayTrades !== 1 ? "s" : ""} today
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Market Summary */}
        {market && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }} style={{ ...card, padding: 20 }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: C.dim, marginBottom: 16 }}>Market Range</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.red }}>L {market.dayLow.toLocaleString("en-IN")}</span>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.04)", position: "relative" }}>
                {/* Range bar */}
                <div style={{
                  position: "absolute",
                  left: 0, top: 0, height: "100%", borderRadius: 2,
                  width: market.dayHigh - market.dayLow > 0
                    ? `${((market.nifty - market.dayLow) / (market.dayHigh - market.dayLow)) * 100}%`
                    : "50%",
                  background: `linear-gradient(to right, ${C.red}40, ${market.niftyChange >= 0 ? C.green : C.red}80)`,
                }} />
                {/* Current price marker */}
                <div style={{
                  position: "absolute",
                  left: market.dayHigh - market.dayLow > 0
                    ? `${((market.nifty - market.dayLow) / (market.dayHigh - market.dayLow)) * 100}%`
                    : "50%",
                  top: -3, width: 10, height: 10, borderRadius: "50%",
                  background: market.niftyChange >= 0 ? C.green : C.red,
                  boxShadow: `0 0 6px ${market.niftyChange >= 0 ? C.green : C.red}60`,
                  transform: "translateX(-5px)",
                }} />
              </div>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.green }}>H {market.dayHigh.toLocaleString("en-IN")}</span>
            </div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
