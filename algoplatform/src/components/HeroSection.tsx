"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { C, pillPrimary, pillOutline, glowText } from "@/lib/styles";
import TextScramble from "./TextScramble";

export default function HeroSection() {
  return (
    <section style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", overflow: "hidden" }}>
      {/* Massive gradient orb */}
      <div style={{
        position: "absolute", top: "35%", left: "50%", transform: "translate(-50%,-50%)",
        width: 1000, height: 600, borderRadius: "50%", pointerEvents: "none",
        background: "radial-gradient(ellipse, rgba(79,79,241,0.12) 0%, rgba(6,78,126,0.06) 40%, transparent 70%)",
        filter: "blur(60px)",
      }} />

      {/* Rotating geometric */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 200, repeat: Infinity, ease: "linear" }}
        style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }}
      >
        <svg width="700" height="700" viewBox="0 0 700 700" style={{ opacity: 0.04 }}>
          <circle cx="350" cy="350" r="300" fill="none" stroke={C.primary} strokeWidth="0.5" />
          <circle cx="350" cy="350" r="220" fill="none" stroke={C.primary} strokeWidth="0.3" />
          <circle cx="350" cy="350" r="140" fill="none" stroke={C.primary} strokeWidth="0.2" />
          <line x1="350" y1="50" x2="350" y2="650" stroke={C.primary} strokeWidth="0.2" />
          <line x1="50" y1="350" x2="650" y2="350" stroke={C.primary} strokeWidth="0.2" />
          <line x1="100" y1="100" x2="600" y2="600" stroke={C.primary} strokeWidth="0.15" />
          <line x1="600" y1="100" x2="100" y2="600" stroke={C.primary} strokeWidth="0.15" />
        </svg>
      </motion.div>

      <div style={{ position: "relative", zIndex: 10, textAlign: "center", maxWidth: 800 }}>
        {/* Video Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}
        >
          <video
            src="/logo.mp4"
            autoPlay
            loop
            muted
            playsInline
            style={{
              width: 180, height: "auto", borderRadius: 16,
              boxShadow: "0 0 60px rgba(79,79,241,0.3)",
              mixBlendMode: "lighten",
            }}
          />
        </motion.div>

        {/* Tag pill */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "8px 20px", borderRadius: 58, border: `1px solid ${C.border}`,
            background: "rgba(14,11,14,0.6)", marginBottom: 40,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.primary, boxShadow: `0 0 10px ${C.primaryGlow}` }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", color: C.dim, textTransform: "uppercase" as const }}>
            <TextScramble text="Institutional Trading For Everyone" delay={700} />
          </span>
        </motion.div>

        {/* Main heading */}
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 300,
            fontSize: "clamp(48px, 8vw, 96px)", letterSpacing: "-0.02em",
            lineHeight: 1.05, color: C.white,
          }}
        >
          <span style={{ display: "block" }}>Trade Like</span>
          <span style={{
            display: "block",
            background: `linear-gradient(135deg, ${C.primary}, #6B6BFF, #22D3EE)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            ...glowText,
          }}>
            Machines.
          </span>
        </motion.h1>

        {/* Sub */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.9 }}
          style={{ marginTop: 28, fontSize: 17, fontWeight: 300, color: C.silver, maxWidth: 500, marginLeft: "auto", marginRight: "auto", lineHeight: 1.75 }}
        >
          AI-powered algorithms that scan, score, and execute with precision.
          Deploy in one click. No code required.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.3 }}
          style={{ marginTop: 48, display: "flex", flexWrap: "wrap" as const, alignItems: "center", justifyContent: "center", gap: 16 }}
        >
          <Link href="/algos" style={{
            ...pillPrimary,
            padding: "16px 36px",
            fontSize: 14,
            textDecoration: "none",
            boxShadow: `0 0 40px ${C.primaryGlow}`,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = C.primaryHover; e.currentTarget.style.boxShadow = `0 0 60px rgba(79,79,241,0.35)`; e.currentTarget.style.transform = "translateY(-2px)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = C.primary; e.currentTarget.style.boxShadow = `0 0 40px ${C.primaryGlow}`; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            Explore Algorithms
          </Link>
          <Link href="/chat" style={{
            ...pillOutline,
            padding: "16px 36px",
            fontSize: 14,
            textDecoration: "none",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderHover; e.currentTarget.style.color = C.white; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.white; }}
          >
            Build Your Own &rarr;
          </Link>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3 }}
        style={{ position: "absolute", bottom: 48, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}
      >
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 400, textTransform: "uppercase" as const, letterSpacing: "0.2em", color: C.dim }}>
          Scroll
        </span>
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          style={{ width: 1, height: 40, background: `linear-gradient(to bottom, ${C.primary}60, transparent)` }}
        />
      </motion.div>
    </section>
  );
}
