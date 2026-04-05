"use client";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { C, card } from "@/lib/styles";

const stats = [
  { value: "96.1%", label: "Win Rate", accent: true },
  { value: "1,068%", label: "Annual Return", accent: false },
  { value: "1.3%", label: "Max Drawdown", accent: false },
  { value: "<50ms", label: "Execution", accent: false },
];

export default function StatsBar() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section ref={ref} style={{ padding: "16px 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{
          ...card, borderRadius: 20, overflow: "hidden",
          background: C.surface,
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 15 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                style={{
                  padding: "36px 24px", textAlign: "center",
                  borderRight: i < 3 ? `1px solid ${C.border}` : "none",
                }}
              >
                <div style={{
                  fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 300,
                  fontSize: "clamp(26px, 3vw, 42px)", letterSpacing: "-0.01em",
                  color: C.white,
                }}>
                  {s.value}
                </div>
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500,
                  textTransform: "uppercase" as const, letterSpacing: "0.12em",
                  color: C.dim, marginTop: 8,
                }}>
                  {s.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
