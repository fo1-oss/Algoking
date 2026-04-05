"use client";
import DashboardLayout from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { C, card, cardSmall } from "@/lib/styles";

type SentimentItem = { l: string; v: string; s: number };
type NewsItem = {
  cat: string; time: string; title: string; summary: string;
  impact: "bull" | "bear"; score: number; algos: string[];
};

const fallbackSentiment: SentimentItem[] = [
  { l: "Market Mood", v: "Bullish", s: 78 },
  { l: "FII Flow", v: "Net Buyer", s: 85 },
  { l: "Options PCR", v: "1.24", s: 62 },
  { l: "VIX Level", v: "13.4", s: 82 },
];

const fallbackNews: NewsItem[] = [
  { cat: "Market", time: "2m ago", title: "NIFTY breaks 24,000 resistance as FII buying accelerates",
    summary: "Foreign institutional investors bought Rs.3,200 crore net in cash. NIFTY surged 1.4% past the key 24,000 level.",
    impact: "bull", score: 95, algos: ["GODMODE V6", "Golden Cross"] },
  { cat: "RBI", time: "1h ago", title: "RBI holds repo rate at 6.5%, signals accommodative stance",
    summary: "Reserve Bank maintained status quo but changed stance to accommodative, hinting at potential cuts in June.",
    impact: "bull", score: 88, algos: ["Momentum RSI"] },
  { cat: "FII/DII", time: "3h ago", title: "FII short covering in index futures: 12,000 contracts unwound",
    summary: "Significant short covering in NIFTY futures. Open interest dropped 4.2% while prices rose confirming short squeeze.",
    impact: "bull", score: 92, algos: ["GODMODE V6", "ICT"] },
  { cat: "Options", time: "6h ago", title: "Massive NIFTY 24000 CE writing: 1.2 crore OI buildup",
    summary: "Call writers aggressively sold 24000 CE with OI building to 1.2 crore. Creates strong resistance at 24,000.",
    impact: "bear", score: 90, algos: ["GODMODE V6"] },
  { cat: "Global", time: "8h ago", title: "US Fed signals two rate cuts in 2025, dollar weakens",
    summary: "Federal Reserve signaled willingness to cut rates twice this year. DXY fell 0.8% supporting emerging market flows.",
    impact: "bull", score: 78, algos: [] },
];

const catColor = (cat: string) => {
  if (cat === "Market") return C.primary;
  if (cat === "Options") return C.purple;
  if (cat === "FII/DII") return C.green;
  if (cat === "RBI") return C.gold;
  if (cat === "Global") return C.cyan;
  return C.dim;
};

// Skeleton loader
function SkeletonCard() {
  return (
    <div style={{ ...card, padding: 24 }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 60, height: 16, borderRadius: 4, background: "rgba(255,255,255,0.04)" }} />
        <div style={{ width: 40, height: 16, borderRadius: 4, background: "rgba(255,255,255,0.03)" }} />
      </div>
      <div style={{ width: "80%", height: 18, borderRadius: 6, background: "rgba(255,255,255,0.04)", marginBottom: 8 }} />
      <div style={{ width: "100%", height: 14, borderRadius: 4, background: "rgba(255,255,255,0.03)", marginBottom: 4 }} />
      <div style={{ width: "60%", height: 14, borderRadius: 4, background: "rgba(255,255,255,0.03)" }} />
    </div>
  );
}

export default function NewsPage() {
  const [sentiment, setSentiment] = useState<SentimentItem[]>(fallbackSentiment);
  const [news, setNews] = useState<NewsItem[]>(fallbackNews);
  const [loading, setLoading] = useState(true);

  const fetchNews = async () => {
    try {
      const res = await fetch("/api/news");
      if (!res.ok) throw new Error("API error");
      const data = await res.json();

      // Map API sentiment object to UI array
      if (data.sentiment && data.sentiment.mood) {
        const s = data.sentiment;
        setSentiment([
          { l: "Market Mood", v: s.mood.split("—")[0]?.trim() || s.mood, s: s.bullishPct || 50 },
          { l: "FII Flow", v: s.fiiFlow === "positive" ? "Net Buyer" : s.fiiFlow === "negative" ? "Net Seller" : "Neutral", s: s.fiiFlow === "positive" ? 80 : s.fiiFlow === "negative" ? 25 : 50 },
          { l: "Options PCR", v: String(s.pcr || "N/A"), s: s.pcr > 1 ? 65 : 40 },
          { l: "India VIX", v: String(s.vix || "N/A"), s: s.vix < 15 ? 82 : s.vix < 20 ? 55 : 30 },
        ]);
      }

      // Map API news items to UI format
      if (data.news && data.news.length > 0) {
        const mapped: NewsItem[] = data.news.map((n: { title: string; source: string; sentiment: string; sentimentScore: number; relevance: number; pubDate: string; link: string }) => {
          // Determine category from source/title
          const lower = (n.title || "").toLowerCase();
          let cat = "Market";
          if (lower.includes("option") || lower.includes("pcr") || lower.includes("oi")) cat = "Options";
          else if (lower.includes("fii") || lower.includes("dii") || lower.includes("foreign")) cat = "FII/DII";
          else if (lower.includes("rbi") || lower.includes("fed") || lower.includes("rate")) cat = "RBI";
          else if (lower.includes("global") || lower.includes("us ") || lower.includes("china") || lower.includes("dow")) cat = "Global";

          // Time ago
          const pubTime = new Date(n.pubDate).getTime();
          const now = Date.now();
          const diffMin = Math.floor((now - pubTime) / 60000);
          let time = `${diffMin}m ago`;
          if (diffMin > 60) time = `${Math.floor(diffMin / 60)}h ago`;
          if (diffMin > 1440) time = `${Math.floor(diffMin / 1440)}d ago`;

          return {
            cat,
            time,
            title: n.title,
            summary: `Source: ${n.source} — Relevance: ${n.relevance}%`,
            impact: n.sentiment === "bullish" ? "bull" as const : n.sentiment === "bearish" ? "bear" as const : "bull" as const,
            score: n.relevance,
            algos: [] as string[],
          };
        });
        setNews(mapped);
      }
    } catch {
      // keep fallback data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.14em", color: C.primary, marginBottom: 8 }}>Intelligence</div>
          <h1 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 300, fontSize: "clamp(24px,4vw,36px)", letterSpacing: "-0.01em", color: C.white }}>Market Intelligence</h1>
          <p style={{ fontSize: 13, fontWeight: 300, color: C.dim, marginTop: 6 }}>
            Auto-refreshes every 60 seconds
            <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: C.green, marginLeft: 8, verticalAlign: "middle" }} />
          </p>
        </motion.div>

        {/* Sentiment */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {sentiment.map((s, i) => (
            <motion.div key={s.l} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }} style={{ ...card, padding: 20 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: C.dim, marginBottom: 12 }}>{s.l}</div>
              <div style={{ fontSize: 18, fontWeight: 300, color: C.white, marginBottom: 12 }}>{s.v}</div>
              <div style={{ width: "100%", height: 2, borderRadius: 1, background: "rgba(255,255,255,0.04)" }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${s.s}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                  style={{ height: "100%", borderRadius: 1, background: `${C.primary}60` }} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Feed */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            news.map((n, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.06 }}
                style={{
                  ...card, padding: 24, cursor: "pointer", transition: "all 0.3s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderHover; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <span style={{
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 500,
                        padding: "2px 8px", borderRadius: 4,
                        background: `${catColor(n.cat)}10`, color: catColor(n.cat),
                      }}>{n.cat}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.dim }}>{n.time}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 500, color: n.impact === "bull" ? C.green : C.red }}>
                        {n.impact === "bull" ? "\u25B2 Bullish" : "\u25BC Bearish"}
                      </span>
                    </div>
                    <h3 style={{ fontSize: 14, fontWeight: 400, color: C.white, marginBottom: 6 }}>{n.title}</h3>
                    <p style={{ fontSize: 12, fontWeight: 300, color: C.dim, lineHeight: 1.7 }}>{n.summary}</p>
                    {n.algos.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, color: C.dim }}>Relevant:</span>
                        {n.algos.map(a => (
                          <span key={a} style={{
                            fontFamily: "'IBM Plex Mono', monospace", fontSize: 8,
                            padding: "2px 8px", border: `1px solid ${C.border}`,
                            borderRadius: 58, color: C.dim,
                          }}>{a}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    <div style={{ position: "relative", width: 44, height: 44 }}>
                      <svg width="44" height="44" viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)" }}>
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2" />
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none" stroke={n.score > 80 ? C.primary : C.dim} strokeWidth="2"
                          strokeDasharray={`${n.score}, 100`} />
                      </svg>
                      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.white }}>{n.score}</span>
                    </div>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, color: C.dim, marginTop: 4 }}>Score</span>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
