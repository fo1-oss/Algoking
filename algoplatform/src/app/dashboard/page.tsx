"use client";
import DashboardLayout from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { C, card, cardSmall } from "@/lib/styles";

const stats = [
  { label: "Portfolio Value", value: "12,45,832", prefix: "Rs.", color: C.white },
  { label: "Today P&L", value: "+18,430", prefix: "Rs.", color: C.green },
  { label: "Active Algos", value: "3", prefix: "", color: C.primary },
  { label: "Win Rate 30d", value: "94.2%", prefix: "", color: C.green },
];

const trades = [
  { time: "14:32", symbol: "NIFTY 23800 CE", algo: "GODMODE V6", entry: 142.50, exit: 172.30, pnl: "+1,937", win: true },
  { time: "13:15", symbol: "BANKNIFTY 51200 PE", algo: "GODMODE V6", entry: 89.75, exit: 71.20, pnl: "+556", win: true },
  { time: "11:48", symbol: "NIFTY 23750 PE", algo: "Momentum RSI", entry: 95.40, exit: 82.60, pnl: "-832", win: false },
  { time: "10:22", symbol: "RELIANCE 2840 CE", algo: "Golden Cross", entry: 34.20, exit: 41.80, pnl: "+1,900", win: true },
  { time: "09:45", symbol: "NIFTY 23900 CE", algo: "GODMODE V6", entry: 78.50, exit: 96.20, pnl: "+1,152", win: true },
];

const deployed = [
  { name: "GODMODE V6", status: "Running", trades: 12, wr: 91.7, pnl: "+18,430" },
  { name: "Momentum RSI", status: "Running", trades: 5, wr: 80.0, pnl: "+4,210" },
  { name: "Golden Cross", status: "Paused", trades: 2, wr: 100, pnl: "+3,800" },
];

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.14em", color: C.primary, marginBottom: 8 }}>Overview</div>
          <h1 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 300, fontSize: "clamp(24px,4vw,36px)", letterSpacing: "-0.01em", color: C.white }}>
            Good Afternoon, Kunaal.
          </h1>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.dim, marginTop: 8 }}>
            3 algos running &middot; 5 trades today &middot; market closing in 1h 28m
          </p>
        </motion.div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }} style={{ ...card, padding: 20 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: C.dim, marginBottom: 12 }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 300, letterSpacing: "-0.01em", color: s.color }}>
                {s.prefix}{s.value}
              </div>
            </motion.div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
          {/* Deployed */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }} style={{ ...card, padding: 24 }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: C.dim, marginBottom: 20 }}>Deployed Algos</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {deployed.map((a) => (
                <div key={a.name} style={{ ...cardSmall, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.primary }} />
                      <span style={{ fontSize: 13, fontWeight: 300, color: C.white }}>{a.name}</span>
                    </div>
                    <span style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, padding: "2px 8px", borderRadius: 58,
                      color: a.status === "Running" ? C.green : C.dim,
                      background: a.status === "Running" ? `${C.green}10` : "rgba(255,255,255,0.03)",
                    }}>
                      {a.status}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {[
                      { l: "Trades", v: a.trades },
                      { l: "Win %", v: `${a.wr}%` },
                      { l: "P&L", v: a.pnl },
                    ].map((m) => (
                      <div key={m.l}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.dim }}>{m.l}</div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 300, color: C.white }}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Trades */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }} style={{ ...card, padding: 24 }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: C.dim, marginBottom: 20 }}>Recent Trades</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Time", "Symbol", "Algo", "Entry", "Exit", "P&L"].map((h, i) => (
                      <th key={h} style={{
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 500,
                        textTransform: "uppercase" as const, letterSpacing: "0.1em", color: C.dim,
                        textAlign: i >= 3 ? "right" : "left", paddingBottom: 12,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: "12px 8px 12px 0", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.dim }}>{t.time}</td>
                      <td style={{ padding: "12px 8px", fontSize: 12, fontWeight: 300, color: C.white }}>{t.symbol}</td>
                      <td style={{ padding: "12px 8px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.dim }}>{t.algo}</td>
                      <td style={{ padding: "12px 8px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.dim, textAlign: "right" }}>{t.entry}</td>
                      <td style={{ padding: "12px 8px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.dim, textAlign: "right" }}>{t.exit}</td>
                      <td style={{ padding: "12px 0 12px 8px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 500, textAlign: "right", color: t.win ? C.green : C.red }}>{t.pnl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>

        {/* Equity curve */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }} style={{ ...card, padding: 24 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: C.dim, marginBottom: 20 }}>Equity Curve — 30 Days</div>
          <div style={{ height: 192, display: "flex", alignItems: "flex-end", gap: 2 }}>
            {Array.from({ length: 60 }, (_, i) => {
              const base = 35 + Math.sin(i / 5) * 12 + i * 0.6;
              const h = Math.max(8, base + (Math.random() - 0.3) * 15);
              return (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ duration: 0.4, delay: 0.7 + i * 0.012 }}
                  style={{
                    flex: 1, borderRadius: "1px 1px 0 0",
                    background: h > 45
                      ? "linear-gradient(to top, rgba(74,222,128,0.15), rgba(74,222,128,0.4))"
                      : "linear-gradient(to top, rgba(248,113,113,0.15), rgba(248,113,113,0.35))",
                  }}
                />
              );
            })}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
