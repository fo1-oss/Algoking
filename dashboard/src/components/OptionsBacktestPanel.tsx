"use client";
import { useState, useEffect, useCallback } from "react";
import { FlaskConical, RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Zap, Target, Shield, Star, ChevronDown, ChevronUp } from "lucide-react";

interface Pattern { rank: number; pattern: string; frequency: string; edge: string; }
interface MatchingOption {
  strike: number; type: "CE" | "PE"; ltp: number; delta: number; oi: number;
  score: number; match_reasons: string[]; risk: string;
}
interface BestSetup {
  strike: number; type: string; rationale: string; entry_condition: string;
  max_loss: string; potential: string; probability: string;
}
interface Analysis {
  top_patterns: Pattern[];
  fy_end_unique_patterns: string[];
  today_context: string;
  matching_options: MatchingOption[];
  best_setup: BestSetup;
  warning: string;
}

function ScoreRing({ score }: { score: number }) {
  const r = 14; const c = 2 * Math.PI * r;
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  const off = c - (score / 100) * c;
  return (
    <div className="relative w-9 h-9 flex items-center justify-center flex-shrink-0">
      <svg className="w-9 h-9 -rotate-90" viewBox="0 0 34 34">
        <circle cx="17" cy="17" r={r} fill="none" stroke="#222" strokeWidth="2.5" />
        <circle cx="17" cy="17" r={r} fill="none" stroke={color} strokeWidth="2.5"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
      </svg>
      <span className="absolute text-[8px] font-black text-white">{score}</span>
    </div>
  );
}

export default function OptionsBacktestPanel() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [symbol, setSymbol] = useState("NSE:NIFTY50-INDEX");
  const [chainLoading, setChainLoading] = useState(false);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError("");
    setChainLoading(true);

    // Fetch live options chain first
    let optionsChain = null;
    let spotPrice = 23500;
    try {
      const oiRes = await fetch(`/api/oi?symbol=${encodeURIComponent(symbol)}&strikecount=15`, { cache: "no-store" });
      if (oiRes.ok) {
        const oiData = await oiRes.json();
        optionsChain = oiData.data?.optionsChain || null;
        const underlying = optionsChain?.find((o: { strike_price: number }) => o.strike_price === -1);
        spotPrice = underlying?.ltp || underlying?.fp || 23500;
      }
    } catch { /* noop */ }
    setChainLoading(false);

    try {
      const res = await fetch("/api/options-backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionsChain, symbol: symbol.includes("BANKNIFTY") ? "BANKNIFTY" : "NIFTY 50", spotPrice }),
      });
      const json = await res.json();
      if (json.ok) setAnalysis(json.data);
      else setError(json.error || "Analysis failed");
    } catch (e) { setError(String(e)); }
    setLoading(false);
  }, [symbol]);

  useEffect(() => { runAnalysis(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bg-[#262626] rounded-xl border border-[#3a3a3a] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#3a3a3a] flex-shrink-0">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-3.5 h-3.5 text-orange-400" />
          <h2 className="text-[11px] font-bold text-white">1000%+ Options Pattern Scanner</h2>
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-bold">5Y BACKTEST</span>
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">FY-END LIVE</span>
        </div>
        <button onClick={runAnalysis} disabled={loading}
          className="flex items-center gap-1 text-[9px] px-2 py-1 rounded bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 disabled:opacity-50 transition">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          {loading ? (chainLoading ? "Fetching chain…" : "Analyzing…") : "Re-run"}
        </button>
      </div>

      {/* Symbol selector */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#3a3a3a]/50 flex-shrink-0">
        {[
          { v: "NSE:NIFTY50-INDEX", l: "NIFTY 50" },
          { v: "NSE:BANKNIFTY-INDEX", l: "BANK NIFTY" },
        ].map(s => (
          <button key={s.v} onClick={() => setSymbol(s.v)}
            className={`text-[8px] px-2 py-1 rounded transition ${symbol === s.v ? "bg-orange-500/30 text-orange-300" : "text-slate-500 hover:text-slate-300"}`}>
            {s.l}
          </button>
        ))}
        <span className="text-[8px] text-slate-600 ml-auto">{(() => {
          const now = new Date();
          const day = now.getDay(); // 0=Sun, 4=Thu
          const daysToThursday = (4 - day + 7) % 7 || 7;
          const nextThursday = new Date(now);
          nextThursday.setDate(now.getDate() + daysToThursday);
          const dteLabel = daysToThursday === 7 ? "7 DTE" : `${daysToThursday} DTE`;
          return `Next Expiry: ${nextThursday.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} · ${dteLabel}`;
        })()}</span>
      </div>

      {error && <div className="px-3 py-2 text-[9px] text-red-400 bg-red-500/10 border-b border-[#3a3a3a]">{error}</div>}

      {loading && !analysis && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-600">
          <FlaskConical className="w-8 h-8 text-orange-400/40 animate-pulse" />
          <div className="text-[10px]">{chainLoading ? "Fetching live options chain…" : "Analyzing 5-year historical patterns…"}</div>
          <div className="text-[9px] text-slate-700">Cross-referencing FY-end monthly expiry events</div>
        </div>
      )}

      {analysis && (
        <div className="flex-1 min-h-0 overflow-auto">
          {/* Today's Context */}
          <div className="px-3 py-2.5 border-b border-[#3a3a3a] bg-[#1e1e1e]/40">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3 h-3 text-yellow-400" />
              <span className="text-[9px] font-bold text-yellow-400 uppercase tracking-wider">FY-End Context — March 30, 2026</span>
            </div>
            <p className="text-[9px] text-slate-300 leading-relaxed">{analysis.today_context}</p>
          </div>

          {/* Best Setup */}
          {analysis.best_setup && (
            <div className="px-3 py-2.5 border-b border-[#3a3a3a] bg-green-500/5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Zap className="w-3 h-3 text-green-400" />
                <span className="text-[9px] font-bold text-green-400">BEST CANDIDATE — {analysis.best_setup.type} {analysis.best_setup.strike?.toLocaleString()}</span>
                <span className="ml-auto text-[8px] text-orange-400 font-bold">{analysis.best_setup.potential} potential</span>
              </div>
              <p className="text-[9px] text-slate-400 mb-2">{analysis.best_setup.rationale}</p>
              <div className="grid grid-cols-4 gap-2 text-[8px] mb-2">
                <div><span className="text-slate-600">Entry When</span><div className="text-white text-[8px]">{analysis.best_setup.entry_condition}</div></div>
                <div><span className="text-slate-600 flex items-center gap-0.5"><Target className="w-2 h-2" />Upside</span><div className="text-green-400 font-bold">{analysis.best_setup.potential}</div></div>
                <div><span className="text-slate-600 flex items-center gap-0.5"><Shield className="w-2 h-2" />Max Loss</span><div className="text-red-400 font-bold">{analysis.best_setup.max_loss}</div></div>
                <div><span className="text-slate-600">10x Prob.</span><div className="text-purple-400 font-bold">{analysis.best_setup.probability}</div></div>
              </div>
              <div className="flex items-start gap-1.5 text-[8px] bg-red-500/10 rounded px-2 py-1.5">
                <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                <span className="text-red-300">{analysis.warning}</span>
              </div>
            </div>
          )}

          {/* Matching Options */}
          {analysis.matching_options?.length > 0 && (
            <div className="border-b border-[#3a3a3a]">
              <div className="px-3 py-1.5 bg-[#1e1e1e]/30">
                <span className="text-[8px] text-slate-600 uppercase tracking-wider">Live Options Matching Historical Profile</span>
              </div>
              {analysis.matching_options.map((opt, i) => (
                <div key={i}>
                  <button className="w-full px-3 py-2 hover:bg-[#2e2e2e]/60 transition text-left"
                    onClick={() => setExpanded(expanded === i ? null : i)}>
                    <div className="flex items-center gap-2">
                      <ScoreRing score={opt.score} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {opt.type === "CE"
                            ? <TrendingUp className="w-3 h-3 text-green-400" />
                            : <TrendingDown className="w-3 h-3 text-red-400" />}
                          <span className="text-[10px] font-bold text-white">{opt.strike?.toLocaleString()} {opt.type}</span>
                          <span className="text-[8px] text-slate-400">₹{opt.ltp}</span>
                          <span className={`text-[7px] px-1 py-0.5 rounded font-semibold ml-auto ${opt.risk === "High" ? "bg-yellow-500/10 text-yellow-400" : "bg-red-500/10 text-red-400"}`}>
                            {opt.risk}
                          </span>
                        </div>
                        <div className="text-[8px] text-slate-600">
                          Δ {opt.delta?.toFixed(2)} · OI {(opt.oi / 1000)?.toFixed(0)}K
                        </div>
                      </div>
                      {expanded === i ? <ChevronUp className="w-3 h-3 text-slate-600" /> : <ChevronDown className="w-3 h-3 text-slate-600" />}
                    </div>
                  </button>
                  {expanded === i && (
                    <div className="px-3 pb-2 bg-[#1e1e1e]/40">
                      <div className="text-[7px] text-slate-600 uppercase mb-1">Why It Matches</div>
                      {opt.match_reasons?.map((r, j) => (
                        <div key={j} className="flex items-start gap-1.5 text-[8px] text-slate-400 mb-0.5">
                          <Star className="w-2.5 h-2.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                          {r}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Top 5 Patterns */}
          <div className="px-3 py-2 border-b border-[#3a3a3a]">
            <div className="text-[8px] text-slate-600 uppercase tracking-wider mb-2">Top 5 Universal Patterns (5Y Analysis)</div>
            <div className="space-y-2">
              {analysis.top_patterns?.map((p) => (
                <div key={p.rank} className="bg-[#1e1e1e]/60 rounded-lg p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-4 h-4 rounded-full bg-orange-500/20 text-orange-400 text-[8px] font-black flex items-center justify-center flex-shrink-0">{p.rank}</span>
                    <span className="text-[9px] font-bold text-white">{p.pattern}</span>
                    <span className="ml-auto text-[7px] text-slate-600">{p.frequency}</span>
                  </div>
                  <p className="text-[8px] text-slate-500 pl-6">{p.edge}</p>
                </div>
              ))}
            </div>
          </div>

          {/* FY-End Unique Patterns */}
          {analysis.fy_end_unique_patterns?.length > 0 && (
            <div className="px-3 py-2">
              <div className="text-[8px] text-slate-600 uppercase tracking-wider mb-1.5">March / FY-End Unique Patterns</div>
              <div className="space-y-1">
                {analysis.fy_end_unique_patterns.map((p, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[9px] text-slate-400">
                    <span className="text-orange-400 mt-0.5">·</span>{p}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
