"use client";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import { C, pillPrimary, pillOutline, glowText } from "@/lib/styles";

export default function CTASection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} style={{ padding: "160px 24px", position: "relative", overflow: "hidden" }}>
      {/* Gradient orb */}
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: 800, height: 400, borderRadius: "50%", pointerEvents: "none",
        background: "radial-gradient(ellipse, rgba(79,79,241,0.1), rgba(6,78,126,0.05), transparent)",
        filter: "blur(80px)",
      }} />

      <motion.div initial={{ opacity: 0, y: 40 }} animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: "relative", maxWidth: 700, margin: "0 auto", textAlign: "center" }}>

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "8px 20px", borderRadius: 58, border: `1px solid ${C.border}`,
          background: "rgba(14,11,14,0.6)", marginBottom: 32,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.primary }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: C.dim }}>Deploy</span>
        </div>

        <h2 style={{
          fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 300,
          fontSize: "clamp(36px, 6vw, 64px)", letterSpacing: "-0.02em",
          lineHeight: 1.1, color: C.white,
        }}>
          Your Edge.{" "}
          <span style={{
            background: `linear-gradient(135deg, ${C.primary}, #6B6BFF)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            ...glowText,
          }}>Automated.</span>
        </h2>

        <p style={{ marginTop: 24, fontSize: 16, fontWeight: 300, color: C.silver, maxWidth: 480, margin: "24px auto 0", lineHeight: 1.75 }}>
          Join traders using AI-powered algorithms to capture alpha
          in Indian F&O markets. Start with a free backtest.
        </p>

        <div style={{ marginTop: 48, display: "flex", flexWrap: "wrap" as const, alignItems: "center", justifyContent: "center", gap: 16 }}>
          <Link href="/pricing" style={{
            ...pillPrimary,
            padding: "16px 40px",
            fontSize: 14,
            textDecoration: "none",
            boxShadow: `0 0 40px ${C.primaryGlow}`,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = C.primaryHover; e.currentTarget.style.boxShadow = `0 0 60px rgba(79,79,241,0.35)`; }}
          onMouseLeave={e => { e.currentTarget.style.background = C.primary; e.currentTarget.style.boxShadow = `0 0 40px ${C.primaryGlow}`; }}>
            Start Free Trial
          </Link>
          <Link href="/backtest" style={{
            ...pillOutline,
            padding: "16px 40px",
            fontSize: 14,
            textDecoration: "none",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderHover; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; }}>
            Try Backtesting
          </Link>
        </div>

        <div style={{ marginTop: 80, display: "flex", flexWrap: "wrap" as const, alignItems: "center", justifyContent: "center", gap: 36 }}>
          {["SEBI Compliant", "Dhan API", "256-bit Encrypted", "99.9% Uptime"].map(t => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: `${C.primary}60` }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: C.dim }}>{t}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
