"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { C, pillPrimary } from "@/lib/styles";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/algos", label: "Algorithms" },
  { href: "/backtest", label: "Backtest" },
  { href: "/chat", label: "AI Studio" },
  { href: "/news", label: "Intelligence" },
  { href: "/pricing", label: "Pricing" },
];

export default function Navbar() {
  const [show, setShow] = useState(true);
  const [lastY, setLastY] = useState(0);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => {
      const y = window.scrollY;
      setShow(y < 80 || y < lastY);
      setScrolled(y > 30);
      setLastY(y);
    };
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, [lastY]);

  return (
    <>
      <motion.header
        initial={{ y: -80 }}
        animate={{ y: show ? 0 : -80 }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
          background: scrolled ? "rgba(1,2,4,0.85)" : "transparent",
          backdropFilter: scrolled ? "blur(20px)" : "none",
          borderBottom: scrolled ? `1px solid ${C.border}` : "1px solid transparent",
          transition: "background 0.4s, border 0.4s",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Logo */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <video
              src="/logo.mp4"
              autoPlay
              loop
              muted
              playsInline
              style={{ width: 36, height: "auto", borderRadius: 8, mixBlendMode: "lighten" as const }}
            />
            <span style={{ fontSize: 16, fontWeight: 500, letterSpacing: "0.04em", color: C.white }}>
              TradeOS
            </span>
          </Link>

          {/* Desktop nav */}
          <nav style={{ display: "flex", alignItems: "center", gap: 32 }} className="hidden md:flex">
            {links.map(l => (
              <Link key={l.href} href={l.href} style={{
                fontSize: 13, fontWeight: 400, color: C.dim, textDecoration: "none",
                transition: "color 0.3s",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = C.white)}
              onMouseLeave={e => (e.currentTarget.style.color = C.dim)}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }} className="hidden md:flex">
            <Link href="/login" style={{
              fontSize: 13, fontWeight: 400, color: C.dim, textDecoration: "none",
              transition: "color 0.3s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = C.white)}
            onMouseLeave={e => (e.currentTarget.style.color = C.dim)}
            >
              Login
            </Link>
            <Link href="/pricing" style={{
              ...pillPrimary,
              padding: "10px 24px",
              fontSize: 13,
              textDecoration: "none",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = C.primaryHover; e.currentTarget.style.boxShadow = `0 0 30px ${C.primaryGlow}`; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.primary; e.currentTarget.style.boxShadow = "none"; }}
            >
              Get Started
            </Link>
          </div>

          {/* Mobile */}
          <button onClick={() => setOpen(!open)} className="md:hidden" style={{ padding: 8, background: "none", border: "none", cursor: "pointer" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <motion.span animate={{ rotate: open ? 45 : 0, y: open ? 7 : 0 }} style={{ display: "block", width: 20, height: 1.5, background: C.white, transformOrigin: "center" }} />
              <motion.span animate={{ opacity: open ? 0 : 1 }} style={{ display: "block", width: 20, height: 1.5, background: C.white }} />
              <motion.span animate={{ rotate: open ? -45 : 0, y: open ? -7 : 0 }} style={{ display: "block", width: 20, height: 1.5, background: C.white, transformOrigin: "center" }} />
            </div>
          </button>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 45, background: "rgba(1,2,4,0.97)", backdropFilter: "blur(30px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 }}>
            {links.map((l, i) => (
              <motion.div key={l.href} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Link href={l.href} onClick={() => setOpen(false)} style={{ fontSize: 28, fontWeight: 300, letterSpacing: "0.02em", color: C.white, textDecoration: "none" }}>
                  {l.label}
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
