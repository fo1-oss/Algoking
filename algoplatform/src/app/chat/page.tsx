"use client";
import DashboardLayout from "@/components/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { C, card } from "@/lib/styles";

type Msg = { role: "user" | "ai"; text: string };

const suggestions = [
  "Build a NIFTY options scalper using RSI and OI",
  "Create a momentum strategy for BANKNIFTY futures",
  "Design a mean-reversion algo for top F&O stocks",
  "Build a crypto momentum strategy for BTC/ETH",
];

function extractCodeBlocks(text: string): { before: string; code: string; after: string }[] | null {
  const regex = /```python\n([\s\S]*?)```/g;
  let match;
  const blocks: { before: string; code: string; after: string }[] = [];
  let lastIndex = 0;
  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      before: text.slice(lastIndex, match.index),
      code: match[1].trim(),
      after: "",
    });
    lastIndex = match.index + match[0].length;
  }
  if (blocks.length === 0) return null;
  blocks[blocks.length - 1].after = text.slice(lastIndex);
  return blocks;
}

function CodeBlock({ code, onBacktest }: { code: string; onBacktest: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ margin: "12px 0", borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}` }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 14px", background: "#111111", borderBottom: `1px solid ${C.border}`,
      }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.dim }}>python</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={copy} style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: copied ? C.green : C.dim,
            background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6,
            padding: "4px 10px", cursor: "pointer", transition: "all 0.2s",
          }}>
            {copied ? "Copied!" : "Copy"}
          </button>
          <button onClick={onBacktest} style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.primary,
            background: `${C.primary}10`, border: `1px solid ${C.primary}30`, borderRadius: 6,
            padding: "4px 10px", cursor: "pointer", transition: "all 0.2s",
          }}>
            Backtest This
          </button>
        </div>
      </div>
      <pre style={{
        margin: 0, padding: 16, background: "#0a0a0a", overflowX: "auto",
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, lineHeight: 1.7, color: C.text,
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function MessageContent({ text, onBacktest }: { text: string; onBacktest: (code: string) => void }) {
  const blocks = extractCodeBlocks(text);
  if (!blocks) {
    return <span style={{ whiteSpace: "pre-wrap" }}>{text}</span>;
  }
  return (
    <>
      {blocks.map((b, i) => (
        <span key={i}>
          {b.before && <span style={{ whiteSpace: "pre-wrap" }}>{b.before}</span>}
          <CodeBlock code={b.code} onBacktest={() => onBacktest(b.code)} />
          {b.after && <span style={{ whiteSpace: "pre-wrap" }}>{b.after}</span>}
        </span>
      ))}
    </>
  );
}

export default function ChatPage() {
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "ai", text: "Welcome to AI Studio.\n\nDescribe your trading strategy in plain English. I will build it, backtest it on real data, and prepare it for deployment.\n\nWhat would you like to create?" },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, typing]);

  const handleBacktest = useCallback((code: string) => {
    const encoded = encodeURIComponent(code);
    router.push(`/backtest?code=${encoded}`);
  }, [router]);

  const send = async (t: string) => {
    if (!t.trim() || typing) return;
    const userMsg = t.trim();
    setMsgs(p => [...p, { role: "user", text: userMsg }]);
    setInput("");
    setTyping(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...msgs, { role: "user", text: userMsg }].map(m => ({
            role: m.role === "ai" ? "assistant" : "user",
            content: m.text,
          })),
        }),
      });

      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const aiText = data.response || data.message || data.text || "I could not generate a response. Please try again.";
      setMsgs(p => [...p, { role: "ai", text: aiText }]);
    } catch {
      setMsgs(p => [...p, {
        role: "ai",
        text: `I am analyzing your request: "${userMsg}"\n\nHere is a starting framework:\n\n\`\`\`python\nimport numpy as np\nimport pandas as pd\n\ndef strategy(data):\n    \"\"\"\n    Custom strategy based on your description.\n    Modify parameters to optimize.\n    \"\"\"\n    rsi = compute_rsi(data['close'], period=14)\n    signal = rsi < 30  # Entry when oversold\n    \n    return {\n        'entry': signal,\n        'sl_pct': 0.02,    # 2% stop loss\n        'target_pct': 0.04  # 4% target\n    }\n\`\`\`\n\nWould you like me to add more filters like OI analysis, volume confirmation, or VWAP levels?`,
      }]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", height: "calc(100vh - 120px)" }}>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.14em", color: C.primary, marginBottom: 8 }}>AI Studio</div>
          <h1 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 300, fontSize: "clamp(24px,4vw,32px)", letterSpacing: "-0.01em", color: C.white }}>Build Your Algo</h1>
        </motion.div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, marginBottom: 16, paddingRight: 8 }}>
          <AnimatePresence>
            {msgs.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "85%" }}>
                  {m.role === "ai" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 6,
                        background: `${C.primary}15`, border: `1px solid ${C.primary}25`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, color: C.primary }}>AI</span>
                      </div>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.dim }}>TradeOS AI</span>
                    </div>
                  )}
                  <div style={{
                    padding: "16px 20px", borderRadius: 16,
                    fontSize: 13, fontWeight: 300, lineHeight: 1.75,
                    ...(m.role === "user"
                      ? { background: `${C.primary}10`, border: `1px solid ${C.primary}20`, color: C.white }
                      : { ...card, color: C.silver }),
                  }}>
                    <MessageContent text={m.text} onBacktest={handleBacktest} />
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {typing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ ...card, width: "fit-content", padding: "12px 20px", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <motion.div key={i} animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }}
                    style={{ width: 5, height: 5, borderRadius: "50%", background: `${C.primary}60` }} />
                ))}
              </div>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.dim }}>Thinking...</span>
            </motion.div>
          )}
          <div ref={endRef} />
        </div>

        {/* Suggestions */}
        {msgs.length <= 1 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            {suggestions.map(s => (
              <button key={s} onClick={() => send(s)}
                style={{
                  ...card, textAlign: "left" as const, padding: "12px 16px",
                  fontSize: 11, fontWeight: 300, color: C.dim, cursor: "pointer",
                  transition: "all 0.3s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderHover; e.currentTarget.style.color = C.silver; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ ...card, display: "flex", alignItems: "center", padding: 8, gap: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send(input)}
            placeholder="Describe your strategy..."
            style={{
              flex: 1, background: "transparent", padding: "12px 16px",
              fontSize: 13, fontWeight: 300, color: C.white, outline: "none", border: "none",
              fontFamily: "'Be Vietnam Pro', sans-serif",
            }} />
          <button onClick={() => send(input)} disabled={!input.trim() || typing}
            style={{
              padding: "10px 20px", borderRadius: 58, background: C.primary,
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
              textTransform: "uppercase" as const, letterSpacing: "0.1em",
              color: C.white, border: "none", cursor: "pointer",
              opacity: !input.trim() || typing ? 0.3 : 1,
              transition: "all 0.3s",
            }}>
            Send
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
