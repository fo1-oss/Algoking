import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const DELTA_BASE = "https://api.india.delta.exchange";
const TELEGRAM_BOT = "8440970690:AAFOHoVTCw6Gyx4Mla7Q4pOUnfzeb8fDDoE";
const TELEGRAM_CHAT = "6776228988";
const API_KEY = process.env.DELTA_API_KEY || "0LotjhrNCvz27CNibX16e4kBBpQazY";
const API_SECRET = process.env.DELTA_API_SECRET || "IhbhQiAEfjbRDV85PqtySltKuJHzMlPUVbewa9ronkGhItWOUCoPuSwmDtZG";

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

async function deltaGet(path: string) {
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = crypto.createHmac("sha256", API_SECRET).update("GET" + ts + path).digest("hex");
  const res = await fetch(`${DELTA_BASE}${path}`, {
    headers: { "api-key": API_KEY, signature: sig, timestamp: ts, "User-Agent": "AlgoKing/2.0" },
    cache: "no-store",
  });
  return res.json();
}

async function deltaPost(path: string, body: Record<string, unknown>) {
  const ts = String(Math.floor(Date.now() / 1000));
  const bodyStr = JSON.stringify(body);
  const sig = crypto.createHmac("sha256", API_SECRET).update("POST" + ts + path + bodyStr).digest("hex");
  const res = await fetch(`${DELTA_BASE}${path}`, {
    method: "POST",
    headers: { "api-key": API_KEY, signature: sig, timestamp: ts, "Content-Type": "application/json", "User-Agent": "AlgoKing/2.0" },
    body: bodyStr,
  });
  try { return await res.json(); } catch { return { error: "Parse error", status: res.status }; }
}

async function sendTg(text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text, parse_mode: "Markdown", disable_web_page_preview: true }),
  }).catch(() => {});
}

// Fetch Yahoo candles for RSI/SMA calculation
async function fetchCandles(symbol: string, range = "5d", interval = "1h"): Promise<number[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
    return closes.filter((c: number | null) => c !== null) as number[];
  } catch { return []; }
}

// ══════════════════════════════════════════════════════════════
// TECHNICAL INDICATORS
// ══════════════════════════════════════════════════════════════

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  const deltas = closes.slice(-period - 1).map((c, i, a) => i > 0 ? c - a[i - 1] : 0).slice(1);
  const gains = deltas.filter(d => d > 0);
  const losses = deltas.filter(d => d < 0).map(d => Math.abs(d));
  const avgGain = gains.length > 0 ? gains.reduce((s, g) => s + g, 0) / period : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, l) => s + l, 0) / period : 0.01;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcSMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] || 0;
  return closes.slice(-period).reduce((s, c) => s + c, 0) / period;
}

function calcZScore(closes: number[], period = 20): number {
  if (closes.length < period) return 0;
  const slice = closes.slice(-period);
  const mean = slice.reduce((s, c) => s + c, 0) / period;
  const std = Math.sqrt(slice.reduce((s, c) => s + (c - mean) ** 2, 0) / period);
  return std > 0 ? (closes[closes.length - 1] - mean) / std : 0;
}

function calcRealizedVol(closes: number[], period = 20): number {
  if (closes.length < period + 1) return 0;
  const returns = closes.slice(-period - 1).map((c, i, a) => i > 0 ? Math.log(c / a[i - 1]) : 0).slice(1);
  const std = Math.sqrt(returns.reduce((s, r) => s + r * r, 0) / returns.length);
  return std * Math.sqrt(365) * 100; // Annualized %
}

// ══════════════════════════════════════════════════════════════
// OPTION TYPES
// ══════════════════════════════════════════════════════════════

interface OptionData {
  symbol: string;
  productId: number;
  type: "CALL" | "PUT";
  asset: string;
  strike: number;
  expiry: string;
  dte: number;
  mark: number;
  bid: number;
  ask: number;
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  oi: number;
  volume: number;
  spot: number;
  otmPct: number;
}

interface TradeSignal {
  option: OptionData;
  score: number;
  direction: "LONG" | "SHORT";
  reason: string;
  layers: {
    statArb: number;
    meanRev: number;
    momentum: number;
    volArb: number;
    flow: number;
  };
  sizing: { contracts: number; costUsd: number; maxLoss: number; tp: number; sl: number };
}

// ══════════════════════════════════════════════════════════════
// THE ALGO ENGINE — 5 Layers
// ══════════════════════════════════════════════════════════════

function scoreOption(
  opt: OptionData,
  rsi: number,
  zScore: number,
  sma20: number,
  sma50: number,
  spotPrice: number,
  realizedVol: number,
  change24h: number,
  fundingRate: number,
  equity: number,
): TradeSignal | null {

  const layers = { statArb: 0, meanRev: 0, momentum: 0, volArb: 0, flow: 0 };
  const reasons: string[] = [];
  let direction: "LONG" | "SHORT" = "LONG";

  // Skip illiquid options
  if (opt.mark <= 0 || opt.dte < 0) return null;
  // Skip options too far OTM (>30%) — unlikely to pay off
  if (opt.otmPct > 30 && opt.dte <= 3) return null;

  // ── LAYER 1: Statistical Arbitrage ──
  // Compare IV vs realized vol — mispricing detection
  if (opt.iv > 0 && realizedVol > 0) {
    const ivRatio = opt.iv / realizedVol;
    if (ivRatio < 0.8) {
      // IV is cheap vs realized — buy options (underpriced)
      layers.statArb = 0.8;
      reasons.push(`IV cheap (${opt.iv.toFixed(0)}% vs ${realizedVol.toFixed(0)}% realized)`);
    } else if (ivRatio > 1.3) {
      // IV is expensive — sell or avoid buying
      layers.statArb = 0.2;
      reasons.push(`IV expensive (${opt.iv.toFixed(0)}% vs ${realizedVol.toFixed(0)}% realized)`);
    } else {
      layers.statArb = 0.5;
    }
  } else {
    layers.statArb = 0.5;
  }

  // ── LAYER 2: Mean Reversion (Short-Term) ──
  if (rsi < 25) {
    layers.meanRev = 0.9;
    direction = "LONG"; // Oversold → expect bounce → buy calls
    reasons.push(`RSI oversold (${rsi.toFixed(0)})`);
  } else if (rsi > 75) {
    layers.meanRev = 0.9;
    direction = "SHORT"; // Overbought → expect pullback → buy puts
    reasons.push(`RSI overbought (${rsi.toFixed(0)})`);
  } else if (rsi < 35) {
    layers.meanRev = 0.6;
    direction = "LONG";
    reasons.push(`RSI low (${rsi.toFixed(0)})`);
  } else if (rsi > 65) {
    layers.meanRev = 0.6;
    direction = "SHORT";
    reasons.push(`RSI high (${rsi.toFixed(0)})`);
  } else {
    layers.meanRev = 0.4; // Neutral RSI — weak signal
  }

  // Z-score extreme
  if (Math.abs(zScore) > 2) {
    layers.meanRev = Math.min(layers.meanRev + 0.2, 1);
    reasons.push(`Z-score extreme (${zScore.toFixed(1)})`);
  }

  // ── LAYER 3: Momentum (Longer-Term) ──
  const aboveSMA20 = spotPrice > sma20;
  const aboveSMA50 = spotPrice > sma50;
  const strongUp = aboveSMA20 && aboveSMA50 && change24h > 1;
  const strongDown = !aboveSMA20 && !aboveSMA50 && change24h < -1;

  if (strongUp) {
    layers.momentum = 0.85;
    if (direction !== "SHORT") direction = "LONG"; // Confirm bullish
    reasons.push(`Strong uptrend (above SMAs, +${change24h.toFixed(1)}%)`);
  } else if (strongDown) {
    layers.momentum = 0.85;
    if (direction !== "LONG") direction = "SHORT"; // Confirm bearish
    reasons.push(`Strong downtrend (below SMAs, ${change24h.toFixed(1)}%)`);
  } else if (Math.abs(change24h) > 2) {
    layers.momentum = 0.7;
    direction = change24h > 0 ? "LONG" : "SHORT";
    reasons.push(`Big 24h move (${change24h > 0 ? "+" : ""}${change24h.toFixed(1)}%)`);
  } else {
    layers.momentum = 0.3; // No clear momentum
  }

  // ── LAYER 4: Volatility Arbitrage ──
  if (opt.iv > 0 && realizedVol > 0) {
    const ivPercentile = Math.min(opt.iv / 100, 1); // Rough percentile
    if (ivPercentile < 0.25) {
      layers.volArb = 0.85;
      reasons.push("IV in bottom quartile — cheap premium");
    } else if (ivPercentile > 0.75) {
      layers.volArb = 0.3; // Expensive — not ideal for buying
      reasons.push("IV elevated — premium expensive");
    } else {
      layers.volArb = 0.55;
    }
  } else {
    layers.volArb = 0.5;
  }

  // ── LAYER 5: Flow Analysis ──
  if (opt.oi > 100) {
    layers.flow = 0.7;
    reasons.push(`High OI (${opt.oi.toFixed(0)} contracts)`);
  } else if (opt.oi > 30) {
    layers.flow = 0.5;
  } else {
    layers.flow = 0.3; // Low OI — illiquid
    reasons.push("Low OI — thin liquidity");
  }

  if (opt.volume > 50) {
    layers.flow = Math.min(layers.flow + 0.2, 1);
    reasons.push(`Active volume (${opt.volume.toFixed(0)})`);
  }

  if (Math.abs(fundingRate) > 0.03) {
    layers.flow = Math.min(layers.flow + 0.15, 1);
    reasons.push(`Funding rate extreme (${(fundingRate * 100).toFixed(3)}%)`);
  }

  // ── COMPOSITE SCORE ──
  const score = (
    layers.statArb * 0.20 +
    layers.meanRev * 0.25 +
    layers.momentum * 0.20 +
    layers.volArb * 0.20 +
    layers.flow * 0.15
  );

  // ── DIRECTION ALIGNMENT CHECK ──
  // If direction is LONG but option is PUT (or vice versa), skip
  if (direction === "LONG" && opt.type === "PUT") return null;
  if (direction === "SHORT" && opt.type === "CALL") return null;

  // ── POSITION SIZING (Half-Kelly) ──
  const maxRiskPct = 0.20; // 20% of equity
  const maxRisk = equity * maxRiskPct;
  const contracts = Math.max(1, Math.floor(maxRisk / Math.max(opt.ask || opt.mark, 0.1)));
  const costUsd = contracts * (opt.ask || opt.mark);
  const tp = (opt.ask || opt.mark) * 3; // 3x target
  const sl = (opt.ask || opt.mark) * 0.3; // 70% loss

  if (costUsd > maxRisk) return null; // Too expensive

  return {
    option: opt,
    score,
    direction,
    reason: reasons.join(" | "),
    layers,
    sizing: { contracts, costUsd, maxLoss: costUsd, tp, sl },
  };
}

// ══════════════════════════════════════════════════════════════
// MAIN SCANNER ENDPOINT
// ══════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action") || "scan";
  const autoExecute = req.nextUrl.searchParams.get("auto") === "true";

  if (action !== "scan") {
    return NextResponse.json({ actions: ["scan"], usage: "/api/delta-scanner?action=scan&auto=true" });
  }

  try {
    // ── 1. Fetch spot prices ──
    const [btcFut, ethFut] = await Promise.all([
      fetch(`${DELTA_BASE}/v2/tickers/BTCUSD`, { headers: { "User-Agent": "AlgoKing/2.0" }, cache: "no-store" }).then(r => r.json()),
      fetch(`${DELTA_BASE}/v2/tickers/ETHUSD`, { headers: { "User-Agent": "AlgoKing/2.0" }, cache: "no-store" }).then(r => r.json()),
    ]);

    const btcPrice = parseFloat(btcFut.result?.mark_price || "0");
    const ethPrice = parseFloat(ethFut.result?.mark_price || "0");
    const btcChange = parseFloat(btcFut.result?.price_change_24h || "0");
    const ethChange = parseFloat(ethFut.result?.price_change_24h || "0");
    const btcFunding = parseFloat(btcFut.result?.funding_rate || "0");
    const ethFunding = parseFloat(ethFut.result?.funding_rate || "0");

    if (!btcPrice) return NextResponse.json({ error: "Could not fetch BTC price" });

    // ── 2. Fetch historical candles for technicals ──
    const [btcCandles, ethCandles] = await Promise.all([
      fetchCandles("BTC-USD", "1mo", "1h"),
      fetchCandles("ETH-USD", "1mo", "1h"),
    ]);

    const btcRSI = calcRSI(btcCandles);
    const ethRSI = calcRSI(ethCandles);
    const btcSMA20 = calcSMA(btcCandles, 20);
    const btcSMA50 = calcSMA(btcCandles, 50);
    const ethSMA20 = calcSMA(ethCandles, 20);
    const ethSMA50 = calcSMA(ethCandles, 50);
    const btcZScore = calcZScore(btcCandles);
    const ethZScore = calcZScore(ethCandles);
    const btcRealizedVol = calcRealizedVol(btcCandles);
    const ethRealizedVol = calcRealizedVol(ethCandles);

    // ── 3. Fetch all options ──
    const allOptions: OptionData[] = [];
    for (const asset of ["BTC", "ETH"]) {
      try {
        const res = await fetch(`${DELTA_BASE}/v2/tickers?contract_types=call_options,put_options&underlying_asset_symbols=${asset}`, {
          headers: { "User-Agent": "AlgoKing/2.0" }, cache: "no-store",
        });
        const data = await res.json();
        const spot = asset === "BTC" ? btcPrice : ethPrice;

        for (const t of (data.result || [])) {
          const sym = t.symbol || "";
          const parts = sym.split("-");
          if (parts.length < 4) continue;

          const strike = parseInt(parts[2]);
          const expiry = parts[3];
          let dte = 99;
          try {
            const expDate = new Date(
              2000 + parseInt(expiry.slice(4, 6)),
              parseInt(expiry.slice(2, 4)) - 1,
              parseInt(expiry.slice(0, 2))
            );
            dte = Math.max(0, Math.floor((expDate.getTime() - Date.now()) / 86400000));
          } catch { /* */ }

          allOptions.push({
            symbol: sym,
            productId: t.product_id || t.id || 0,
            type: sym.startsWith("C-") ? "CALL" : "PUT",
            asset: parts[1],
            strike,
            expiry,
            dte,
            mark: parseFloat(t.mark_price || "0"),
            bid: parseFloat(t.best_bid || "0"),
            ask: parseFloat(t.best_ask || "0"),
            iv: parseFloat(t.greeks?.iv || t.greeks?.implied_volatility || "0"),
            delta: parseFloat(t.greeks?.delta || "0"),
            gamma: parseFloat(t.greeks?.gamma || "0"),
            theta: parseFloat(t.greeks?.theta || "0"),
            oi: parseFloat(t.oi || "0"),
            volume: parseFloat(t.volume || "0"),
            spot,
            otmPct: Math.abs(strike - spot) / spot * 100,
          });
        }
      } catch { /* skip */ }
    }

    // ── 4. Get wallet for sizing ──
    let equity = 118;
    try {
      const wallet = await deltaGet("/v2/wallet/balances");
      equity = parseFloat(wallet.meta?.net_equity || "118");
    } catch { /* use default */ }

    // ── 5. Score ALL options through the algo ──
    const signals: TradeSignal[] = [];
    for (const opt of allOptions) {
      const rsi = opt.asset === "BTC" ? btcRSI : ethRSI;
      const zScore = opt.asset === "BTC" ? btcZScore : ethZScore;
      const sma20 = opt.asset === "BTC" ? btcSMA20 : ethSMA20;
      const sma50 = opt.asset === "BTC" ? btcSMA50 : ethSMA50;
      const spot = opt.asset === "BTC" ? btcPrice : ethPrice;
      const realVol = opt.asset === "BTC" ? btcRealizedVol : ethRealizedVol;
      const change = opt.asset === "BTC" ? btcChange : ethChange;
      const funding = opt.asset === "BTC" ? btcFunding : ethFunding;

      const signal = scoreOption(opt, rsi, zScore, sma20, sma50, spot, realVol, change, funding, equity);
      if (signal && signal.score >= 0.5) signals.push(signal);
    }

    // Sort by score descending
    signals.sort((a, b) => b.score - a.score);

    // ── 6. Build analysis summary ──
    const btcBias = btcChange > 2 ? "BULLISH" : btcChange < -2 ? "BEARISH" : btcRSI < 35 ? "OVERSOLD" : btcRSI > 65 ? "OVERBOUGHT" : "NEUTRAL";
    const ethBias = ethChange > 2 ? "BULLISH" : ethChange < -2 ? "BEARISH" : ethRSI < 35 ? "OVERSOLD" : ethRSI > 65 ? "OVERBOUGHT" : "NEUTRAL";

    const analysis = {
      btc: { price: btcPrice, change24h: btcChange, rsi: btcRSI, sma20: btcSMA20, sma50: btcSMA50, zScore: btcZScore, realizedVol: btcRealizedVol, funding: btcFunding, bias: btcBias },
      eth: { price: ethPrice, change24h: ethChange, rsi: ethRSI, sma20: ethSMA20, sma50: ethSMA50, zScore: ethZScore, realizedVol: ethRealizedVol, funding: ethFunding, bias: ethBias },
      totalOptions: allOptions.length,
      signalsAbove60: signals.filter(s => s.score >= 0.6).length,
      signalsAbove70: signals.filter(s => s.score >= 0.7).length,
      topSignals: signals.slice(0, 10).map(s => ({
        symbol: s.option.symbol,
        score: +s.score.toFixed(3),
        direction: s.direction,
        reason: s.reason,
        mark: s.option.mark,
        ask: s.option.ask,
        iv: s.option.iv,
        dte: s.option.dte,
        oi: s.option.oi,
        sizing: s.sizing,
        layers: Object.fromEntries(Object.entries(s.layers).map(([k, v]) => [k, +v.toFixed(2)])),
      })),
      equity,
      timestamp: Date.now(),
    };

    // ── 7. Auto-execute if enabled and signal is strong enough ──
    const executedTrades: unknown[] = [];
    if (autoExecute) {
      const topPicks = signals.filter(s => s.score >= 0.65 && s.option.mark > 0 && s.sizing.costUsd <= equity * 0.20);

      // Get current positions to avoid doubling up
      let openPositions = 0;
      try {
        const pos = await deltaGet("/v2/positions/margined");
        openPositions = (pos.result || []).filter((p: { size?: string }) => parseFloat(p.size || "0") > 0).length;
      } catch { /* */ }

      if (openPositions >= 5) {
        // Max positions reached
      } else if (topPicks.length > 0) {
        const pick = topPicks[0];
        const limitPrice = pick.option.ask > 0 ? String(Math.round(pick.option.ask * 1.15 * 100) / 100) : String(Math.round(pick.option.mark * 1.25 * 100) / 100);

        const order = await deltaPost("/v2/orders", {
          product_id: pick.option.productId,
          size: pick.sizing.contracts,
          side: "buy",
          order_type: "limit_order",
          limit_price: limitPrice,
          time_in_force: "gtc",
          client_order_id: `algo_${Date.now()}`,
        });

        if (order.result) {
          executedTrades.push({
            symbol: pick.option.symbol,
            orderId: order.result.id,
            state: order.result.state,
            size: pick.sizing.contracts,
            price: limitPrice,
            score: pick.score,
          });

          // Set TP order
          await deltaPost("/v2/orders", {
            product_id: pick.option.productId,
            size: pick.sizing.contracts,
            side: "sell",
            order_type: "limit_order",
            limit_price: String(Math.round(pick.sizing.tp * 100) / 100),
            time_in_force: "gtc",
            reduce_only: true,
            client_order_id: `tp_${Date.now()}`,
          });

          // Alert on Telegram
          await sendTg([
            `⚡ *AUTO-TRADE EXECUTED*`,
            ``,
            `📊 ${pick.option.symbol}`,
            `🎯 Score: ${(pick.score * 100).toFixed(0)}%`,
            `📦 ${pick.sizing.contracts}x @ $${limitPrice}`,
            `💰 Cost: $${pick.sizing.costUsd.toFixed(2)}`,
            `🎯 TP: $${pick.sizing.tp.toFixed(2)} (3x)`,
            ``,
            `📋 *Analysis:*`,
            `${pick.reason}`,
            ``,
            `Layers: StatArb=${(pick.layers.statArb * 100).toFixed(0)}% MeanRev=${(pick.layers.meanRev * 100).toFixed(0)}% Mom=${(pick.layers.momentum * 100).toFixed(0)}% VolArb=${(pick.layers.volArb * 100).toFixed(0)}% Flow=${(pick.layers.flow * 100).toFixed(0)}%`,
          ].join("\n"));
        }
      }
    }

    return NextResponse.json({ ...analysis, executed: executedTrades });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
