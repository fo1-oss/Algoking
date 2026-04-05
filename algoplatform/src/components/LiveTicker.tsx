"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { C } from "@/lib/styles";

type TickerItem = { s: string; p: string; c: string; u: boolean };

const fallback: TickerItem[] = [
  { s: "NIFTY", p: "23,842", c: "+1.24%", u: true },
  { s: "BANKNIFTY", p: "51,234", c: "+0.87%", u: true },
  { s: "RELIANCE", p: "2,845", c: "-0.32%", u: false },
  { s: "HDFCBANK", p: "1,678", c: "+0.56%", u: true },
  { s: "TCS", p: "3,456", c: "-0.18%", u: false },
  { s: "INFY", p: "1,523", c: "+1.02%", u: true },
  { s: "BEL", p: "287", c: "+2.34%", u: true },
  { s: "VIX", p: "13.42", c: "-5.2%", u: false },
];

export default function LiveTicker() {
  const [tickers, setTickers] = useState<TickerItem[]>(fallback);

  useEffect(() => {
    let mounted = true;
    const fetchTicker = async () => {
      try {
        const res = await fetch("/api/ticker");
        if (!res.ok) throw new Error("API error");
        const data: TickerItem[] = await res.json();
        if (mounted && data.length > 0) setTickers(data);
      } catch {
        // keep current data (fallback on first load)
      }
    };
    fetchTicker();
    const interval = setInterval(fetchTicker, 10000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const tripled = [...tickers, ...tickers, ...tickers];

  return (
    <div style={{
      width: "100%", overflow: "hidden",
      borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
      background: "rgba(1,2,4,0.8)", backdropFilter: "blur(12px)",
    }}>
      <motion.div
        animate={{ x: [0, -55 * tickers.length] }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        style={{ display: "flex", alignItems: "center", gap: 36, padding: "14px 0", width: "max-content" }}
      >
        {tripled.map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.5)" }}>{t.s}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 400, color: C.dim }}>{t.p}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, color: t.u ? C.green : C.red }}>{t.c}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
