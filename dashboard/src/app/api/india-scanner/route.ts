import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TG_BOT = "8440970690:AAFOHoVTCw6Gyx4Mla7Q4pOUnfzeb8fDDoE";
const TG_CHAT = "6776228988";

// ── In-memory: track alerted signals to avoid repeats ──
const alertedSignals = new Map<string, number>(); // key → timestamp
const ALERT_COOLDOWN = 3600000; // 1 hour cooldown per signal

// ── All F&O instruments ──
const INSTRUMENTS: Record<string, { yahoo: string; lot: number; step: number; type: "index" | "stock" }> = {
  "NIFTY": { yahoo: "%5ENSEI", lot: 25, step: 50, type: "index" },
  "BANKNIFTY": { yahoo: "%5ENSEBANK", lot: 15, step: 100, type: "index" },
  "RELIANCE": { yahoo: "RELIANCE.NS", lot: 250, step: 20, type: "stock" },
  "TCS": { yahoo: "TCS.NS", lot: 175, step: 20, type: "stock" },
  "HDFCBANK": { yahoo: "HDFCBANK.NS", lot: 550, step: 10, type: "stock" },
  "INFY": { yahoo: "INFY.NS", lot: 400, step: 20, type: "stock" },
  "ICICIBANK": { yahoo: "ICICIBANK.NS", lot: 700, step: 20, type: "stock" },
  "SBIN": { yahoo: "SBIN.NS", lot: 750, step: 10, type: "stock" },
  "BAJFINANCE": { yahoo: "BAJFINANCE.NS", lot: 125, step: 20, type: "stock" },
  "BHARTIARTL": { yahoo: "BHARTIARTL.NS", lot: 475, step: 20, type: "stock" },
  "ITC": { yahoo: "ITC.NS", lot: 1600, step: 5, type: "stock" },
  "KOTAKBANK": { yahoo: "KOTAKBANK.NS", lot: 400, step: 10, type: "stock" },
  "LT": { yahoo: "LT.NS", lot: 150, step: 20, type: "stock" },
  "AXISBANK": { yahoo: "AXISBANK.NS", lot: 625, step: 10, type: "stock" },
  "TATAMOTORS": { yahoo: "TATAMOTORS.NS", lot: 575, step: 5, type: "stock" },
  "SUNPHARMA": { yahoo: "SUNPHARMA.NS", lot: 700, step: 10, type: "stock" },
  "TATASTEEL": { yahoo: "TATASTEEL.NS", lot: 5500, step: 2, type: "stock" },
  "WIPRO": { yahoo: "WIPRO.NS", lot: 1500, step: 5, type: "stock" },
  "HCLTECH": { yahoo: "HCLTECH.NS", lot: 350, step: 20, type: "stock" },
  "ADANIENT": { yahoo: "ADANIENT.NS", lot: 500, step: 20, type: "stock" },
  "HINDUNILVR": { yahoo: "HINDUNILVR.NS", lot: 300, step: 20, type: "stock" },
  "COALINDIA": { yahoo: "COALINDIA.NS", lot: 2100, step: 5, type: "stock" },
  "ONGC": { yahoo: "ONGC.NS", lot: 3250, step: 5, type: "stock" },
  "NTPC": { yahoo: "NTPC.NS", lot: 2025, step: 5, type: "stock" },
  "MARUTI": { yahoo: "MARUTI.NS", lot: 100, step: 100, type: "stock" },
};

// ── Helpers ──
async function sendTg(text: string) {
  await fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: "Markdown", disable_web_page_preview: true }),
  }).catch(() => {});
}

async function fetchYahoo(symbols: string[]): Promise<Record<string, { price: number; change: number; changePct: number; high: number; low: number; prevClose: number; volume: number; avgVolume: number }>> {
  const result: Record<string, ReturnType<typeof Object>> = {};
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(",")}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketDayHigh,regularMarketDayLow,regularMarketPreviousClose,regularMarketVolume,averageDailyVolume3Month`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!res.ok) return result;
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const q of (data?.quoteResponse?.result || []) as any[]) {
      result[q.symbol] = {
        price: q.regularMarketPrice || 0,
        change: q.regularMarketChange || 0,
        changePct: q.regularMarketChangePercent || 0,
        high: q.regularMarketDayHigh || 0,
        low: q.regularMarketDayLow || 0,
        prevClose: q.regularMarketPreviousClose || 0,
        volume: q.regularMarketVolume || 0,
        avgVolume: q.averageDailyVolume3Month || 1,
      };
    }
  } catch { /* */ }
  return result;
}

async function fetchCandles(symbol: string, range = "5d", interval = "15m"): Promise<number[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || []).filter((c: number | null) => c !== null);
  } catch { return []; }
}

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  const d = closes.slice(-period - 1).map((c, i, a) => i > 0 ? c - a[i - 1] : 0).slice(1);
  const g = d.filter(x => x > 0); const l = d.filter(x => x < 0).map(x => -x);
  const ag = g.length > 0 ? g.reduce((s, x) => s + x, 0) / period : 0;
  const al = l.length > 0 ? l.reduce((s, x) => s + x, 0) / period : 0.01;
  return 100 - (100 / (1 + ag / al));
}

function calcSMA(c: number[], p: number): number {
  if (c.length < p) return c[c.length - 1] || 0;
  return c.slice(-p).reduce((s, x) => s + x, 0) / p;
}

function isMarketHours(): boolean {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const h = ist.getHours(), m = ist.getMinutes(), tm = h * 60 + m, day = ist.getDay();
  return day >= 1 && day <= 5 && tm >= 555 && tm <= 930; // 9:15 - 15:30
}

// ── Signal type ──
interface Signal {
  name: string;
  instrument: string;
  type: "CE" | "PE";
  strike: number;
  score: number;
  direction: "LONG" | "SHORT";
  reason: string;
  layers: { statArb: number; meanRev: number; momentum: number; volArb: number; flow: number };
  price: number;
  changePct: number;
  rsi: number;
  lotSize: number;
  estimatedPremium: number;
}

// ══════════════════════════════════════════════════════════════
// MAIN SCANNER
// ══════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action") || "scan";
  const autoExecute = req.nextUrl.searchParams.get("auto") === "true";

  if (action !== "scan") return NextResponse.json({ actions: ["scan"] });

  try {
    // ── 1. Fetch ALL instruments in batch ──
    const yahooSymbols = Object.values(INSTRUMENTS).map(i => i.yahoo);
    yahooSymbols.push("%5EINDIAVIX"); // VIX

    const quotes = await fetchYahoo(yahooSymbols);

    // VIX
    const vixData = quotes["%5EINDIAVIX"] || quotes["^INDIAVIX"];
    const vixPrice = vixData?.price || 15;

    // ── 2. Fetch intraday candles for top movers (parallel, max 8 to stay fast) ──
    // Sort by absolute change % and scan top movers + indices
    const sortedByMove = Object.entries(INSTRUMENTS)
      .map(([name, info]) => {
        const q = quotes[info.yahoo] || quotes[info.yahoo.replace("%5E", "^")];
        return { name, info, quote: q, absChange: Math.abs(q?.changePct || 0) };
      })
      .filter(x => x.quote)
      .sort((a, b) => b.absChange - a.absChange);

    // Always include indices + top 6 movers
    const toScan = [
      ...sortedByMove.filter(x => x.info.type === "index"),
      ...sortedByMove.filter(x => x.info.type === "stock").slice(0, 6),
    ];

    const candleResults = await Promise.allSettled(
      toScan.map(x => fetchCandles(x.info.yahoo, "5d", "15m"))
    );

    // ── 3. Score each instrument ──
    const allSignals: Signal[] = [];

    for (let i = 0; i < toScan.length; i++) {
      const { name, info, quote } = toScan[i];
      if (!quote || !quote.price) continue;

      const candleRes = candleResults[i];
      const candles = candleRes.status === "fulfilled" ? (candleRes as PromiseFulfilledResult<number[]>).value : [];
      const rsi = calcRSI(candles);
      const sma20 = calcSMA(candles, 20);
      const sma50 = calcSMA(candles, 50);
      const price = quote.price;
      const changePct = quote.changePct;
      const volRatio = quote.avgVolume > 0 ? quote.volume / quote.avgVolume : 1;

      const layers = { statArb: 0.5, meanRev: 0.4, momentum: 0.3, volArb: 0.5, flow: 0.5 };
      const reasons: string[] = [];
      let direction: "LONG" | "SHORT" = "LONG";

      // Layer 1: Stat Arb — VIX based
      if (vixPrice > 22) { layers.statArb = 0.75; reasons.push(`VIX high (${vixPrice.toFixed(0)})`); }
      else if (vixPrice < 13) { layers.statArb = 0.75; reasons.push(`VIX low (${vixPrice.toFixed(0)})`); }

      // Layer 2: Mean Reversion (INTRADAY RSI — changes throughout day)
      if (rsi < 25) { layers.meanRev = 0.9; direction = "LONG"; reasons.push(`RSI oversold (${rsi.toFixed(0)})`); }
      else if (rsi > 75) { layers.meanRev = 0.9; direction = "SHORT"; reasons.push(`RSI overbought (${rsi.toFixed(0)})`); }
      else if (rsi < 35) { layers.meanRev = 0.65; direction = "LONG"; reasons.push(`RSI low (${rsi.toFixed(0)})`); }
      else if (rsi > 65) { layers.meanRev = 0.65; direction = "SHORT"; reasons.push(`RSI high (${rsi.toFixed(0)})`); }

      // Layer 3: Momentum (INTRADAY — uses live change %)
      if (price > sma20 && changePct > 1) {
        layers.momentum = 0.85; direction = "LONG";
        reasons.push(`Bullish (+${changePct.toFixed(1)}%, above SMA)`);
      } else if (price < sma20 && changePct < -1) {
        layers.momentum = 0.85; direction = "SHORT";
        reasons.push(`Bearish (${changePct.toFixed(1)}%, below SMA)`);
      } else if (Math.abs(changePct) > 2) {
        layers.momentum = 0.7;
        direction = changePct > 0 ? "LONG" : "SHORT";
        reasons.push(`Big move (${changePct > 0 ? "+" : ""}${changePct.toFixed(1)}%)`);
      }

      // PDC reaction
      if (quote.prevClose > 0) {
        const pdcDist = Math.abs(price - quote.prevClose) / price * 100;
        if (pdcDist < 0.3 && Math.abs(changePct) < 0.5) {
          layers.momentum = Math.min(layers.momentum + 0.15, 1);
          reasons.push("Near PDC level");
        }
      }

      // Layer 4: Vol Arb
      if (vixPrice > 20) {
        layers.volArb = 0.7; reasons.push("Premium rich (VIX >20)");
      } else if (vixPrice < 13) {
        layers.volArb = 0.8; reasons.push("Premium cheap (VIX <13)");
      }

      // Layer 5: Flow — volume spike + day-of-week
      if (volRatio > 1.5) {
        layers.flow = 0.75; reasons.push(`Vol spike (${volRatio.toFixed(1)}x avg)`);
      } else if (volRatio > 1.2) {
        layers.flow = 0.6;
      }

      const dow = new Date().getDay();
      if (dow === 4) { // Thursday expiry
        layers.flow = Math.min(layers.flow + 0.1, 1);
        reasons.push("Expiry day");
      }

      // Composite score
      const score = layers.statArb * 0.15 + layers.meanRev * 0.30 + layers.momentum * 0.25 + layers.volArb * 0.15 + layers.flow * 0.15;

      if (score >= 0.55) {
        const optType = direction === "LONG" ? "CE" as const : "PE" as const;
        const atm = Math.round(price / info.step) * info.step;
        const strike = direction === "LONG" ? atm : atm;
        // Rough premium estimate based on ATR
        const range = quote.high - quote.low;
        const estimatedPremium = Math.max(range * 0.4, price * 0.005);

        allSignals.push({
          name, instrument: `${name}-${strike}-${optType}`, type: optType, strike, score, direction,
          reason: reasons.join(" | "), layers, price, changePct, rsi, lotSize: info.lot,
          estimatedPremium: Math.round(estimatedPremium * 100) / 100,
        });
      }
    }

    // Sort by score
    allSignals.sort((a, b) => b.score - a.score);

    // ── 4. Deduplicate: skip already-alerted signals ──
    const now = Date.now();
    const newSignals = allSignals.filter(s => {
      const key = s.instrument;
      const lastAlert = alertedSignals.get(key) || 0;
      return now - lastAlert > ALERT_COOLDOWN;
    });

    // ── 5. Build response ──
    const instrumentData = toScan.map(x => ({
      name: x.name, price: x.quote?.price, changePct: x.quote?.changePct,
      volume: x.quote?.volume, rsi: calcRSI(candleResults[toScan.indexOf(x)]?.status === "fulfilled" ? (candleResults[toScan.indexOf(x)] as PromiseFulfilledResult<number[]>).value : []),
    }));

    const response = {
      instruments: instrumentData,
      vix: vixPrice,
      marketHours: isMarketHours(),
      totalScanned: toScan.length,
      totalFnOStocks: Object.keys(INSTRUMENTS).length,
      signals: allSignals.slice(0, 10).map(s => ({
        ...s, layers: Object.fromEntries(Object.entries(s.layers).map(([k, v]) => [k, +v.toFixed(2)])),
        score: +s.score.toFixed(3),
      })),
      newSignals: newSignals.slice(0, 5).map(s => s.instrument),
      signalsAbove60: allSignals.filter(s => s.score >= 0.6).length,
      signalsAbove70: allSignals.filter(s => s.score >= 0.7).length,
      timestamp: now,
    };

    // ── 6. Alert on new signals ──
    if (newSignals.filter(s => s.score >= 0.6).length > 0) {
      const top3 = newSignals.filter(s => s.score >= 0.6).slice(0, 3);
      const lines = [`🇮🇳 *India Market Signals*\n`];
      lines.push(`VIX: ${vixPrice.toFixed(1)} | Market: ${isMarketHours() ? "OPEN" : "CLOSED"}\n`);

      for (const s of top3) {
        const emoji = s.direction === "LONG" ? "🟢" : "🔴";
        lines.push(`${emoji} *${s.instrument}*`);
        lines.push(`  Score: ${(s.score * 100).toFixed(0)}% | ₹${s.price.toLocaleString()} (${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(1)}%)`);
        lines.push(`  RSI: ${s.rsi.toFixed(0)} | Lot: ${s.lotSize} | Premium: ~₹${s.estimatedPremium}`);
        lines.push(`  _${s.reason}_\n`);

        // Mark as alerted
        alertedSignals.set(s.instrument, now);
      }

      // Top movers context
      const topMovers = sortedByMove.slice(0, 5);
      lines.push(`📊 *Top Movers:*`);
      for (const m of topMovers) {
        const emoji = (m.quote?.changePct || 0) >= 0 ? "🟢" : "🔴";
        lines.push(`  ${emoji} ${m.name}: ₹${m.quote?.price?.toLocaleString()} (${(m.quote?.changePct || 0) >= 0 ? "+" : ""}${m.quote?.changePct?.toFixed(1)}%)`);
      }

      await sendTg(lines.join("\n"));

      // Auto-execute during market hours
      if (autoExecute && isMarketHours() && top3.length > 0) {
        const best = top3[0];
        await sendTg(`⚡ *Signal: ${best.instrument}*\nScore: ${(best.score * 100).toFixed(0)}% | ${best.direction}\nExecute via Dhan Super Order:\n\`/buy ${best.name} ${best.lotSize} ${best.strike} ${best.type}\``);
      }
    }

    return NextResponse.json(response);

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
