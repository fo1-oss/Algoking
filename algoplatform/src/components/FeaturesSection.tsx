"use client";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { C, card } from "@/lib/styles";
import TextScramble from "./TextScramble";

const features = [
  { num: "01", title: "Algo Marketplace", desc: "Browse battle-tested algorithms. Each backtested on five years of real market data with Monte Carlo validated results.", tags: ["12 Filters", "96.1% WR", "1,068% Annual"] },
  { num: "02", title: "AI Algo Builder", desc: "Describe your strategy in plain English. Our AI builds, backtests, and optimizes it into a deployable algorithm.", tags: ["Natural Language", "Auto-Optimize", "One-Click Deploy"] },
  { num: "03", title: "Live Backtesting", desc: "Test any strategy on real NSE data. See every trade, drawdown curve, Monte Carlo simulation, and risk metric.", tags: ["5yr Real Data", "10K Simulations", "60+ Metrics"] },
  { num: "04", title: "Smart Execution", desc: "Auto-execute via broker Super Orders. Entry, target, and stop-loss in one atomic order with sub-50ms latency.", tags: ["Super Orders", "Auto SL", "3 Trades/Day"] },
  { num: "05", title: "Real-Time Scanner", desc: "209 F&O stocks scanned every minute. Six-layer scoring with open interest, Greeks, IV, volume, and price action.", tags: ["209 Stocks", "6-Layer Score", "Every Minute"] },
  { num: "06", title: "Personalized Feed", desc: "AI learns your trading style, risk appetite, and preferences. Receive tailored recommendations and market insights.", tags: ["AI Persona", "Custom Alerts", "Risk Matched"] },
];

function Card({ f, i }: { f: typeof features[0]; i: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
      style={{
        ...card, padding: 32, display: "flex", flexDirection: "column",
        transition: "all 0.4s ease", cursor: "default",
        position: "relative", overflow: "hidden",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = C.borderHover;
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = `0 8px 40px rgba(79,79,241,0.08)`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = C.border;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Number */}
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 500, letterSpacing: "0.14em", color: C.primary, marginBottom: 24 }}>
        {f.num}
      </span>

      <h3 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 400, fontSize: 20, letterSpacing: "0.01em", color: C.white, marginBottom: 14 }}>
        {f.title}
      </h3>

      <p style={{ fontSize: 14, fontWeight: 300, color: C.silver, lineHeight: 1.75, marginBottom: 28, flex: 1 }}>
        {f.desc}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
        {f.tags.map(t => (
          <span key={t} style={{
            padding: "6px 14px", borderRadius: 58,
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 500,
            textTransform: "uppercase" as const, letterSpacing: "0.08em",
            color: C.dim, border: `1px solid ${C.border}`,
            background: "rgba(14,11,14,0.5)",
          }}>
            {t}
          </span>
        ))}
      </div>

      {/* Bottom accent line */}
      <div style={{
        position: "absolute", bottom: 0, left: "10%", right: "10%", height: 1,
        background: `linear-gradient(90deg, transparent, ${C.primary}30, transparent)`,
        opacity: 0.5,
      }} />
    </motion.div>
  );
}

export default function FeaturesSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section ref={ref} style={{ padding: "140px 24px", position: "relative" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          style={{ marginBottom: 72, textAlign: "center" }}
        >
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "8px 20px", borderRadius: 58, border: `1px solid ${C.border}`,
            background: "rgba(14,11,14,0.6)", marginBottom: 24,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.primary }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: C.dim }}>
              {inView && <TextScramble text="Platform" delay={200} />}
            </span>
          </div>
          <h2 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 300, fontSize: "clamp(32px, 5vw, 52px)", letterSpacing: "-0.01em", color: C.white, lineHeight: 1.1 }}>
            Everything You Need
          </h2>
          <p style={{ marginTop: 16, fontSize: 16, fontWeight: 300, color: C.silver, maxWidth: 500, margin: "16px auto 0" }}>
            A complete suite of tools designed for the modern Indian trader.
          </p>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
          {features.map((f, i) => <Card key={f.num} f={f} i={i} />)}
        </div>
      </div>
    </section>
  );
}
