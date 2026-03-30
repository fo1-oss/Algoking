import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ASSET_CLASSES = [
  { id: "NIFTY", name: "NIFTY 50", type: "Index" },
  { id: "BANKNIFTY", name: "Bank Nifty", type: "Index" },
  { id: "GOLD", name: "Gold (MCX)", type: "Commodity" },
  { id: "CRUDE", name: "Crude Oil (MCX)", type: "Commodity" },
  { id: "SILVER", name: "Silver (MCX)", type: "Commodity" },
  { id: "USDINR", name: "USD/INR", type: "Currency" },
  { id: "IT", name: "Nifty IT", type: "Sector" },
  { id: "REALTY", name: "Nifty Realty", type: "Sector" },
  { id: "PSU_BANK", name: "PSU Bank", type: "Sector" },
  { id: "AUTO", name: "Nifty Auto", type: "Sector" },
];

const AGENT_PERSONAS = [
  { name: "Bull Agent", bias: "Bullish", focus: "momentum, institutional buying, positive catalysts" },
  { name: "Bear Agent", bias: "Bearish", focus: "distribution, smart money exits, macro headwinds" },
  { name: "Smart Money Agent", bias: "Neutral", focus: "OI buildup, FII/DII flows, options premium" },
  { name: "Macro Agent", bias: "Neutral", focus: "global cues, US markets, DXY, bond yields" },
  { name: "Technical Agent", bias: "Neutral", focus: "support/resistance, trend structure, key levels" },
];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { context = "", timeframe = "intraday" } = body;

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "Asia/Kolkata",
  });

  try {
    // Run all agents in one call for speed
    const prompt = `You are a multi-agent market prediction engine (MiroFish-style).
Today: ${today}. Timeframe: ${timeframe}.
${context ? `Market context provided: ${context}` : ""}

You have ${AGENT_PERSONAS.length} autonomous agents with different perspectives:
${AGENT_PERSONAS.map((a, i) => `${i + 1}. ${a.name} (${a.bias}) — focuses on ${a.focus}`).join("\n")}

Each agent independently analyzes these asset classes:
${ASSET_CLASSES.map(a => `- ${a.name} (${a.type})`).join("\n")}

Return a JSON object ONLY (no markdown) with this exact structure:
{
  "timestamp": "${new Date().toISOString()}",
  "timeframe": "${timeframe}",
  "swarm_consensus": {
    "overall_market_bias": "Bullish|Bearish|Neutral",
    "confidence": 0-100,
    "key_theme": "one line summary of today's main market theme"
  },
  "predictions": [
    {
      "asset": "NIFTY 50",
      "id": "NIFTY",
      "type": "Index",
      "direction": "Up|Down|Sideways",
      "confidence": 0-100,
      "bull_votes": 0-5,
      "bear_votes": 0-5,
      "key_levels": { "support": [level1, level2], "resistance": [level1, level2] },
      "short_thesis": "2-line prediction reason",
      "risk": "Low|Medium|High",
      "agent_signals": {
        "Bull Agent": "Up|Down|Sideways",
        "Bear Agent": "Up|Down|Sideways",
        "Smart Money Agent": "Up|Down|Sideways",
        "Macro Agent": "Up|Down|Sideways",
        "Technical Agent": "Up|Down|Sideways"
      }
    }
  ],
  "macro_triggers": ["list of 3-4 key events or triggers to watch today"],
  "best_trade": {
    "asset": "asset name",
    "setup": "trade setup description",
    "entry": "level or condition",
    "target": "level",
    "stop": "level",
    "r2r": "risk to reward ratio"
  }
}

Base predictions on realistic Indian market conditions for ${today}. Be specific with levels for NIFTY (around 22000-24000 range), BANKNIFTY (around 48000-52000), Gold MCX (around 85000-95000 per 10g), Crude (around 6000-7000 per barrel), Silver MCX (around 90000-100000 per kg), USDINR (around 83-86).`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (message.content[0] as { text: string }).text.trim();
    // Strip markdown code blocks if present
    const jsonStr = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const prediction = JSON.parse(jsonStr);

    return NextResponse.json({ ok: true, data: prediction, source: "claude-swarm" });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ assets: ASSET_CLASSES, agents: AGENT_PERSONAS });
}
