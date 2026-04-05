"use client";
import DashboardLayout from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { useState } from "react";
import { C, card, pillPrimary } from "@/lib/styles";

const plans = [
  {
    name: "Free", price: 0, period: "forever",
    desc: "Get started with paper trading and limited backtests",
    features: ["1 algo (paper only)", "5 backtests/month", "Basic news feed", "Community access", "Email support"],
    cta: "Get Started", highlight: false,
  },
  {
    name: "Pro", price: 2999, priceAnn: 1999, period: "month",
    desc: "For serious retail traders who want real edge",
    features: ["3 live algos", "Unlimited backtests", "Monte Carlo simulation", "AI Builder (50 prompts)", "Real-time scanner", "Personalized feed", "Priority support", "Excel exports"],
    cta: "Start Pro Trial", highlight: true,
  },
  {
    name: "Elite", price: 9999, priceAnn: 7499, period: "month",
    desc: "Institutional-grade for professional traders",
    features: ["Unlimited algos", "Unlimited everything", "AI Builder (unlimited)", "Custom development", "Options analytics", "Greeks scanner", "API access", "Dedicated manager", "White-glove onboarding"],
    cta: "Contact Sales", highlight: false,
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", gap: 40 }}>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.14em", color: C.primary, marginBottom: 8 }}>Pricing</div>
          <h1 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 300, fontSize: "clamp(28px,5vw,48px)", letterSpacing: "-0.01em", color: C.white }}>Choose Your Edge</h1>
          <p style={{ fontSize: 14, fontWeight: 300, color: C.silver, marginTop: 12 }}>Start free. Scale when you are ready.</p>

          {/* Toggle */}
          <div style={{ marginTop: 28, display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 300, color: !annual ? C.white : C.dim, transition: "color 0.3s" }}>Monthly</span>
            <button onClick={() => setAnnual(!annual)} style={{
              position: "relative", width: 44, height: 22, borderRadius: 11,
              background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, cursor: "pointer",
            }}>
              <motion.div animate={{ x: annual ? 22 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                style={{ width: 18, height: 18, borderRadius: "50%", background: C.primary, position: "absolute", top: 1 }} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 300, color: annual ? C.white : C.dim, transition: "color 0.3s" }}>
              Annual <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.green }}>-33%</span>
            </span>
          </div>
        </motion.div>

        {/* Plans */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {plans.map((p, i) => (
            <motion.div key={p.name} initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.12 }}
              style={{
                ...card, position: "relative", display: "flex", flexDirection: "column", padding: 32,
                borderColor: p.highlight ? `${C.primary}30` : C.border,
                boxShadow: p.highlight ? `0 0 40px ${C.primaryGlow}` : "none",
              }}>
              {p.highlight && (
                <div style={{
                  position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                  padding: "4px 16px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
                  textTransform: "uppercase" as const, letterSpacing: "0.1em",
                  color: C.white, background: C.primary, borderRadius: 58,
                }}>
                  Most Popular
                </div>
              )}

              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 400, letterSpacing: "0.02em", color: C.primary, marginBottom: 4 }}>{p.name}</h3>
                <p style={{ fontSize: 12, fontWeight: 300, color: C.dim }}>{p.desc}</p>
              </div>

              <div style={{ marginBottom: 32 }}>
                <span style={{ fontSize: 36, fontWeight: 300, color: C.white }}>
                  {p.price === 0 ? "Free" : `Rs.${(annual && p.priceAnn ? p.priceAnn : p.price).toLocaleString()}`}
                </span>
                {p.price > 0 && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.dim }}> /{p.period}</span>}
                {annual && p.priceAnn && (
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.dim, textDecoration: "line-through", marginTop: 4 }}>Rs.{p.price.toLocaleString()}/month</div>
                )}
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
                {p.features.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, fontWeight: 300, color: C.silver }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: `${C.primary}50`, flexShrink: 0 }} />
                    {f}
                  </div>
                ))}
              </div>

              <button style={{
                width: "100%", padding: "14px 0", borderRadius: 58,
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 11,
                textTransform: "uppercase" as const, letterSpacing: "0.1em",
                cursor: "pointer", transition: "all 0.3s",
                background: p.highlight ? C.primary : "transparent",
                border: p.highlight ? "none" : `1px solid ${C.border}`,
                color: p.highlight ? C.white : C.dim,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = p.highlight ? C.primaryHover : "rgba(255,255,255,0.03)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = p.highlight ? C.primary : "transparent"; }}>
                {p.cta}
              </button>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          style={{ textAlign: "center" }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.dim }}>All plans include paper trading. 7-day free trial on Pro.</p>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.dim2, marginTop: 4 }}>Trading involves risk. Past performance does not guarantee future results.</p>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
