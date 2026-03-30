"use client";
import { useState, useEffect, useCallback } from "react";
import { Brain, RefreshCw, TrendingUp, TrendingDown, Minus, Zap, Target, Shield, ChevronDown, ChevronUp, Activity } from "lucide-react";

interface AgentSignals { [agent: string]: "Up" | "Down" | "Sideways"; }
interface Prediction {
  asset: string; id: string; type: string;
  direction: "Up" | "Down" | "Sideways";
  confidence: number; bull_votes: number; bear_votes: number;
  key_levels: { support: number[]; resistance: number[] };
  short_thesis: string; risk: "Low" | "Medium" | "High";
  agent_signals: AgentSignals;
}
interface SwarmConsensus {
  overall_market_bias: "Bullish" | "Bearish" | "Neutral";
  confidence: number;
  key_theme: string;
}
interface BestTrade { asset: string; setup: string; entry: string; target: string; stop: string; r2r: string; }
interface PredictionData {
  timestamp: string; timeframe: string;
  swarm_consensus: SwarmConsensus;
  predictions: Prediction[];
  macro_triggers: string[];
  best_trade: BestTrade;
}

const TIMEFRAMES = ["intraday", "swing (2-5 days)", "positional (1-2 weeks)"] as const;
const AGENT_COLORS: Record<string, string> = {
  "Bull Agent": "text-green-400",
  "Bear Agent": "text-red-400",
  "Smart Money Agent": "text-purple-400",
  "Macro Agent": "text-blue-400",
  "Technical Agent": "text-yellow-400",
};

function DirectionIcon({ d }: { d: string }) {
  if (d === "Up") return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (d === "Down") return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-slate-400" />;
}

function ConfBar({ val, color }: { val: number; color: string }) {
  return (
    <div className="relative h-1 bg-[#333] rounded-full w-full">
      <div className={`absolute left-0 top-0 h-1 rounded-full ${color}`} style={{ width: `${val}%` }} />
    </div>
  );
}

export default function MiroFishPanel() {
  const [data, setData] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeframe, setTimeframe] = useState<typeof TIMEFRAMES[number]>("intraday");
  const [context, setContext] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<string>("");
  const [error, setError] = useState("");

  const runPrediction = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeframe, context }),
      });
      const json = await res.json();
      if (json.ok) {
        setData(json.data);
        setLastRun(new Date().toLocaleTimeString("en-IN", { hour12: false, timeZone: "Asia/Kolkata" }));
      } else {
        setError(json.error || "Prediction failed");
      }
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }, [timeframe, context]);

  useEffect(() => { runPrediction(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const biasColor = data?.swarm_consensus.overall_market_bias === "Bullish"
    ? "text-green-400" : data?.swarm_consensus.overall_market_bias === "Bearish"
    ? "text-red-400" : "text-slate-400";

  return (
    <div className="bg-[#262626] rounded-xl border border-[#3a3a3a] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#3a3a3a] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-purple-400" />
          <h2 className="text-[11px] font-bold text-white">MiroFish Swarm</h2>
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold">5-AGENT AI</span>
          {lastRun && <span className="text-[8px] text-slate-600">Updated {lastRun}</span>}
        </div>
        <button
          onClick={runPrediction}
          disabled={loading}
          className="flex items-center gap-1 text-[9px] px-2 py-1 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 disabled:opacity-50 transition"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Simulating..." : "Run Swarm"}
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#3a3a3a]/50 flex-shrink-0">
        <div className="flex gap-1">
          {TIMEFRAMES.map(tf => (
            <button key={tf} onClick={() => setTimeframe(tf)}
              className={`text-[8px] px-2 py-1 rounded transition ${timeframe === tf ? "bg-purple-500/30 text-purple-300" : "text-slate-500 hover:text-slate-300"}`}>
              {tf}
            </button>
          ))}
        </div>
        <input
          value={context}
          onChange={e => setContext(e.target.value)}
          placeholder="Add market context (e.g. RBI meeting today, US CPI)…"
          className="flex-1 text-[9px] bg-[#1e1e1e] border border-[#3a3a3a] rounded px-2 py-1 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-purple-500/50"
        />
      </div>

      {error && (
        <div className="px-3 py-2 text-[9px] text-red-400 bg-red-500/10 border-b border-[#3a3a3a]">{error}</div>
      )}

      {loading && !data && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-600">
          <Brain className="w-8 h-8 text-purple-400/40 animate-pulse" />
          <div className="text-[10px]">5 agents simulating market futures…</div>
          <div className="text-[9px] text-slate-700">Bull · Bear · Smart Money · Macro · Technical</div>
        </div>
      )}

      {data && (
        <div className="flex-1 min-h-0 overflow-auto">
          {/* Swarm Consensus */}
          <div className="px-3 py-2.5 border-b border-[#3a3a3a] bg-[#1e1e1e]/40">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Activity className="w-3 h-3 text-purple-400" />
                <span className="text-[9px] text-slate-500 uppercase tracking-wider">Swarm Consensus</span>
              </div>
              <span className={`text-[11px] font-black ${biasColor}`}>{data.swarm_consensus.overall_market_bias}</span>
            </div>
            <ConfBar
              val={data.swarm_consensus.confidence}
              color={data.swarm_consensus.overall_market_bias === "Bullish" ? "bg-green-500" : data.swarm_consensus.overall_market_bias === "Bearish" ? "bg-red-500" : "bg-slate-500"}
            />
            <div className="mt-1.5 text-[9px] text-slate-400 italic">"{data.swarm_consensus.key_theme}"</div>
          </div>

          {/* Best Trade */}
          {data.best_trade && (
            <div className="px-3 py-2 border-b border-[#3a3a3a] bg-yellow-500/5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Zap className="w-3 h-3 text-yellow-400" />
                <span className="text-[9px] font-bold text-yellow-400">TOP SETUP — {data.best_trade.asset}</span>
              </div>
              <div className="text-[9px] text-slate-400 mb-1">{data.best_trade.setup}</div>
              <div className="grid grid-cols-4 gap-2 text-[8px]">
                <div><span className="text-slate-600">Entry</span><div className="text-white font-bold">{data.best_trade.entry}</div></div>
                <div><span className="text-slate-600 flex items-center gap-0.5"><Target className="w-2 h-2" />Target</span><div className="text-green-400 font-bold">{data.best_trade.target}</div></div>
                <div><span className="text-slate-600 flex items-center gap-0.5"><Shield className="w-2 h-2" />Stop</span><div className="text-red-400 font-bold">{data.best_trade.stop}</div></div>
                <div><span className="text-slate-600">R:R</span><div className="text-cyan-400 font-bold">{data.best_trade.r2r}</div></div>
              </div>
            </div>
          )}

          {/* Asset Predictions */}
          <div className="divide-y divide-[#3a3a3a]/30">
            {data.predictions.map(p => (
              <div key={p.id}>
                <button
                  className="w-full px-3 py-2 hover:bg-[#2e2e2e]/60 transition text-left"
                  onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DirectionIcon d={p.direction} />
                      <span className="text-[10px] font-bold text-white">{p.asset}</span>
                      <span className="text-[7px] text-slate-600">{p.type}</span>
                      <span className={`text-[7px] px-1 py-0.5 rounded font-semibold ${p.risk === "Low" ? "bg-green-500/10 text-green-400" : p.risk === "High" ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                        {p.risk}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < p.bull_votes ? "bg-green-400" : "bg-[#333]"}`} />
                        ))}
                      </div>
                      <span className="text-[9px] font-bold text-slate-400">{p.confidence}%</span>
                      {expanded === p.id ? <ChevronUp className="w-3 h-3 text-slate-600" /> : <ChevronDown className="w-3 h-3 text-slate-600" />}
                    </div>
                  </div>
                  <div className="mt-1">
                    <ConfBar val={p.confidence} color={p.direction === "Up" ? "bg-green-500" : p.direction === "Down" ? "bg-red-500" : "bg-slate-500"} />
                  </div>
                  <div className="mt-1 text-[8px] text-slate-500 line-clamp-1">{p.short_thesis}</div>
                </button>

                {expanded === p.id && (
                  <div className="px-3 pb-3 bg-[#1e1e1e]/40">
                    {/* Full thesis */}
                    <div className="text-[9px] text-slate-400 mb-2">{p.short_thesis}</div>

                    {/* Key Levels */}
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <div className="text-[7px] text-slate-600 uppercase mb-1">Support</div>
                        <div className="flex gap-1.5">
                          {p.key_levels.support.map((l, i) => (
                            <span key={i} className="text-[9px] text-green-400 font-mono font-bold">{l.toLocaleString()}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[7px] text-slate-600 uppercase mb-1">Resistance</div>
                        <div className="flex gap-1.5">
                          {p.key_levels.resistance.map((l, i) => (
                            <span key={i} className="text-[9px] text-red-400 font-mono font-bold">{l.toLocaleString()}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Agent Votes */}
                    <div className="text-[7px] text-slate-600 uppercase mb-1">Agent Signals</div>
                    <div className="grid grid-cols-2 gap-1">
                      {Object.entries(p.agent_signals).map(([agent, signal]) => (
                        <div key={agent} className="flex items-center justify-between bg-[#262626] rounded px-1.5 py-1">
                          <span className={`text-[8px] font-semibold ${AGENT_COLORS[agent] || "text-slate-400"}`}>{agent.replace(" Agent", "")}</span>
                          <div className="flex items-center gap-0.5">
                            <DirectionIcon d={signal} />
                            <span className="text-[8px] text-slate-500">{signal}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Macro Triggers */}
          {data.macro_triggers?.length > 0 && (
            <div className="px-3 py-2.5 border-t border-[#3a3a3a]">
              <div className="text-[8px] text-slate-600 uppercase tracking-wider mb-1.5">Watch Today</div>
              <div className="space-y-1">
                {data.macro_triggers.map((t, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[9px] text-slate-400">
                    <span className="text-purple-400 mt-0.5">·</span>{t}
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
