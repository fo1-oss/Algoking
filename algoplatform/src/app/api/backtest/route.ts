import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DHAN_BASE = "https://api.dhan.co/v2";

// ── Types ─────────────────────────────────────────────────────────────────

interface OHLC {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Trade {
  entryDate: string;
  exitDate: string;
  type: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPct: number;
  quantity: number;
}

interface BacktestResult {
  metrics: {
    totalReturn: number;
    cagr: number;
    winRate: number;
    maxDrawdown: number;
    sharpeRatio: number;
    profitFactor: number;
    totalTrades: number;
    avgWin: number;
    avgLoss: number;
    winningTrades: number;
    losingTrades: number;
    initialCapital: number;
    finalCapital: number;
  };
  trades: Trade[];
  equityCurve: Array<{ date: string; equity: number }>;
  monthlyReturns: Array<{ month: string; return: number }>;
}

// ── Technical Indicators ──────────────────────────────────────────────────

function sma(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      result.push(slice.reduce((a, b) => a + b, 0) / period);
    }
  }
  return result;
}

function ema(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      const avg = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result.push(avg);
    } else {
      const prev = result[i - 1]!;
      result.push((data[i] - prev) * multiplier + prev);
    }
  }
  return result;
}

function rsi(closes: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      result.push(null);
      continue;
    }

    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);

    if (i < period) {
      result.push(null);
    } else if (i === period) {
      const avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
      if (avgLoss === 0) {
        result.push(100);
      } else {
        result.push(100 - 100 / (1 + avgGain / avgLoss));
      }
    } else {
      const prevRsi = result[i - 1];
      if (prevRsi === null) { result.push(null); continue; }

      // Use smoothed averages
      const prevAvgGain = gains.slice(i - period, i - 1).reduce((a, b) => a + b, 0) / period;
      const prevAvgLoss = losses.slice(i - period, i - 1).reduce((a, b) => a + b, 0) / period;
      const avgGain = (prevAvgGain * (period - 1) + gains[i - 1]) / period;
      const avgLoss = (prevAvgLoss * (period - 1) + losses[i - 1]) / period;

      if (avgLoss === 0) {
        result.push(100);
      } else {
        result.push(100 - 100 / (1 + avgGain / avgLoss));
      }
    }
  }
  return result;
}

function macd(closes: number[]): { macdLine: (number | null)[]; signalLine: (number | null)[]; histogram: (number | null)[] } {
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (ema12[i] !== null && ema26[i] !== null) {
      macdLine.push(ema12[i]! - ema26[i]!);
    } else {
      macdLine.push(null);
    }
  }

  // Signal line = 9-period EMA of MACD line
  const validMacd = macdLine.filter((v): v is number => v !== null);
  const signalRaw = ema(validMacd, 9);
  const signalLine: (number | null)[] = [];
  const histogram: (number | null)[] = [];
  let validIdx = 0;

  for (let i = 0; i < closes.length; i++) {
    if (macdLine[i] === null) {
      signalLine.push(null);
      histogram.push(null);
    } else {
      const sig = signalRaw[validIdx] ?? null;
      signalLine.push(sig);
      histogram.push(sig !== null ? macdLine[i]! - sig : null);
      validIdx++;
    }
  }

  return { macdLine, signalLine, histogram };
}

function bollingerBands(closes: number[], period: number = 20, stdDev: number = 2): {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
} {
  const middle = sma(closes, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (middle[i] === null) {
      upper.push(null);
      lower.push(null);
    } else {
      const slice = closes.slice(i - period + 1, i + 1);
      const mean = middle[i]!;
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
      const std = Math.sqrt(variance);
      upper.push(mean + stdDev * std);
      lower.push(mean - stdDev * std);
    }
  }

  return { upper, middle, lower };
}

// ── Data Fetching ─────────────────────────────────────────────────────────

async function fetchDhanHistorical(securityId: string, fromDate: string, toDate: string, isIndex: boolean = false): Promise<OHLC[]> {
  const token = (process.env.DHAN_ACCESS_TOKEN || "").trim();
  const clientId = (process.env.DHAN_CLIENT_ID || "").trim();

  if (!token || !clientId) return [];

  try {
    const res = await fetch(`${DHAN_BASE}/charts/historical`, {
      method: "POST",
      headers: {
        "access-token": token,
        "client-id": clientId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        securityId,
        exchangeSegment: isIndex ? "IDX_I" : "NSE_EQ",
        instrument: isIndex ? "INDEX" : "EQUITY",
        expiryCode: 0,
        oi: false,
        fromDate,
        toDate,
      }),
      cache: "no-store",
    });

    if (!res.ok) return [];
    const data = await res.json();

    // Dhan returns { open: [...], high: [...], low: [...], close: [...], volume: [...], timestamp: [...] }
    if (!data.open || !Array.isArray(data.open)) return [];

    const candles: OHLC[] = [];
    for (let i = 0; i < data.open.length; i++) {
      const ts = data.timestamp?.[i];
      const date = ts ? new Date(ts * 1000).toISOString().split("T")[0] : `day-${i}`;
      candles.push({
        date,
        open: data.open[i],
        high: data.high[i],
        low: data.low[i],
        close: data.close[i],
        volume: data.volume?.[i] || 0,
      });
    }
    return candles;
  } catch {
    return [];
  }
}

async function fetchYahooHistorical(symbol: string, period: string): Promise<OHLC[]> {
  try {
    // Yahoo Finance chart API
    const periodMap: Record<string, string> = {
      "1y": "1y",
      "2y": "2y",
      "3y": "5y",
      "5y": "5y",
      "10y": "10y",
    };
    const range = periodMap[period] || "5y";

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });

    if (!res.ok) return [];
    const data = await res.json();

    const result = data?.chart?.result?.[0];
    if (!result) return [];

    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};
    const candles: OHLC[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const o = quotes.open?.[i];
      const h = quotes.high?.[i];
      const l = quotes.low?.[i];
      const c = quotes.close?.[i];
      const v = quotes.volume?.[i];

      if (o == null || h == null || l == null || c == null) continue;

      candles.push({
        date: new Date(timestamps[i] * 1000).toISOString().split("T")[0],
        open: o,
        high: h,
        low: l,
        close: c,
        volume: v || 0,
      });
    }
    return candles;
  } catch {
    return [];
  }
}

// ── Helper: record trade and update equity ──────────────────────────────

// ── Trade Recording with Options P&L Model ──────────────────────────────
//
// Options P&L is ASYMMETRIC:
//   - You pay a premium (small fraction of underlying)
//   - Max loss = premium paid (capped)
//   - Gains are leveraged (ATM option moves ~8-15x underlying %)
//
// riskPct: % of capital risked per trade (the "premium" spent)
// leverage: how much the underlying move is amplified (options delta effect)
// For equity strategies: riskPct=large, leverage=1 (direct stock exposure)
// For options strategies: riskPct=small, leverage=high (buy ATM options)

function recordTrade(
  trades: Trade[], equityCurve: Array<{ date: string; equity: number }>,
  candles: OHLC[], entryIdx: number, exitIdx: number, equity: number,
  riskPct: number, type: "LONG" | "SHORT" = "LONG", leverage: number = 1
): number {
  const entryPrice = candles[entryIdx].close;
  const exitPrice = candles[exitIdx].close;

  // Capital at risk for this trade
  const riskAmount = equity * riskPct;

  // Raw underlying % move
  const rawPctMove = type === "LONG"
    ? (exitPrice - entryPrice) / entryPrice
    : (entryPrice - exitPrice) / entryPrice;

  let pnl: number;
  let pnlPct: number;

  if (leverage > 1) {
    // OPTIONS MODEL: asymmetric P&L
    // Gains: amplified by leverage
    // Losses: capped at premium (riskAmount) — you can't lose more than what you paid
    const leveragedMove = rawPctMove * leverage;
    if (leveragedMove >= 0) {
      // Winner: premium grows by leveraged move
      pnl = riskAmount * leveragedMove;
    } else {
      // Loser: max loss = premium paid, proportional decay
      // Option loses value faster as it goes OTM, but floor at -100% of premium
      pnl = Math.max(-riskAmount, riskAmount * leveragedMove);
    }
    pnlPct = (pnl / riskAmount) * 100;
  } else {
    // EQUITY MODEL: direct exposure, symmetric P&L
    pnl = riskAmount * rawPctMove;
    pnlPct = rawPctMove * 100;
  }

  trades.push({
    entryDate: candles[entryIdx].date, exitDate: candles[exitIdx].date,
    type, entryPrice, exitPrice, pnl: +pnl.toFixed(2), pnlPct: +pnlPct.toFixed(2),
    quantity: Math.max(1, Math.floor(riskAmount / (entryPrice * (leverage > 1 ? 0.03 : 1)))),
  });

  const newEquity = Math.max(equity * 0.05, equity + pnl);
  if (equityCurve.length > 0) equityCurve[equityCurve.length - 1].equity = newEquity;
  return newEquity;
}

// ── Strategy Implementations ──────────────────────────────────────────────
// All strategies use 80% of capital per trade (full deployment),
// compound profits, and have realistic entry/exit logic.

function runRSIMeanReversion(candles: OHLC[], capital: number): { trades: Trade[]; equityCurve: Array<{ date: string; equity: number }> } {
  const closes = candles.map(c => c.close);
  const rsiValues = rsi(closes, 14);
  const sma50 = sma(closes, 50);
  const trades: Trade[] = [];
  const equityCurve: Array<{ date: string; equity: number }> = [];
  let equity = capital;
  let inPosition = false;
  let posType: "LONG" | "SHORT" = "LONG";
  let entryIdx = 0;
  let entryPrice = 0;

  for (let i = 1; i < candles.length; i++) {
    equityCurve.push({ date: candles[i].date, equity });
    if (rsiValues[i] === null || sma50[i] === null) continue;
    const r = rsiValues[i]!;
    const trend = candles[i].close > sma50[i]! ? "up" : "down";

    if (!inPosition) {
      // LONG: RSI oversold bounce in uptrend
      if (r < 40 && trend === "up") {
        inPosition = true; posType = "LONG"; entryIdx = i; entryPrice = candles[i].close;
      }
      // LONG: Deep RSI oversold (any trend — strong bounce play)
      else if (r < 30) {
        inPosition = true; posType = "LONG"; entryIdx = i; entryPrice = candles[i].close;
      }
      // SHORT: RSI overbought in downtrend
      else if (r > 65 && trend === "down") {
        inPosition = true; posType = "SHORT"; entryIdx = i; entryPrice = candles[i].close;
      }
      // SHORT: Extreme overbought (any trend)
      else if (r > 75) {
        inPosition = true; posType = "SHORT"; entryIdx = i; entryPrice = candles[i].close;
      }
    }
    else {
      const pctMove = posType === "LONG"
        ? (candles[i].close - entryPrice) / entryPrice
        : (entryPrice - candles[i].close) / entryPrice;
      const holdDays = i - entryIdx;

      // Exit conditions
      const rsiExit = posType === "LONG" ? r > 58 : r < 38;
      const stopHit = pctMove < -0.025;
      const targetHit = pctMove > 0.045;
      const timeExit = holdDays > 12;

      if (rsiExit || stopHit || targetHit || timeExit) {
        equity = recordTrade(trades, equityCurve, candles, entryIdx, i, equity, 0.40, posType, 1);
        inPosition = false;
      }
    }
  }
  return { trades, equityCurve };
}

function runSMACrossover(candles: OHLC[], capital: number): { trades: Trade[]; equityCurve: Array<{ date: string; equity: number }> } {
  const closes = candles.map(c => c.close);
  const emaFast = ema(closes, 9);
  const emaSlow = ema(closes, 21);
  const sma50v = sma(closes, 50);
  const rsiValues = rsi(closes, 14);
  const trades: Trade[] = [];
  const equityCurve: Array<{ date: string; equity: number }> = [];
  let equity = capital;
  let inPosition = false;
  let posType: "LONG" | "SHORT" = "LONG";
  let entryIdx = 0;
  let entryPrice = 0;

  for (let i = 1; i < candles.length; i++) {
    equityCurve.push({ date: candles[i].date, equity });
    if (emaFast[i] === null || emaSlow[i] === null || emaFast[i - 1] === null || emaSlow[i - 1] === null) continue;

    const goldenCross = emaFast[i - 1]! <= emaSlow[i - 1]! && emaFast[i]! > emaSlow[i]!;
    const deathCross = emaFast[i - 1]! >= emaSlow[i - 1]! && emaFast[i]! < emaSlow[i]!;

    if (!inPosition) {
      // LONG on golden cross + RSI confirmation
      if (goldenCross && (rsiValues[i] === null || rsiValues[i]! < 68)) {
        inPosition = true; posType = "LONG"; entryIdx = i; entryPrice = candles[i].close;
      }
      // Go flat on death cross (equity strategy — no short selling)
    }
    else {
      const pctMove = posType === "LONG"
        ? (candles[i].close - entryPrice) / entryPrice
        : (entryPrice - candles[i].close) / entryPrice;
      const holdDays = i - entryIdx;

      const oppositeCross = posType === "LONG" ? deathCross : goldenCross;
      if (oppositeCross || pctMove < -0.025 || pctMove > 0.06 || holdDays > 20) {
        equity = recordTrade(trades, equityCurve, candles, entryIdx, i, equity, 0.50, posType, 1);
        inPosition = false;
      }
    }
  }
  return { trades, equityCurve };
}

function runMACDCrossover(candles: OHLC[], capital: number): { trades: Trade[]; equityCurve: Array<{ date: string; equity: number }> } {
  const closes = candles.map(c => c.close);
  const { macdLine: macdL, signalLine: sigL, histogram: hist } = macd(closes);
  const rsiValues = rsi(closes, 14);
  const sma50v = sma(closes, 50);
  const trades: Trade[] = [];
  const equityCurve: Array<{ date: string; equity: number }> = [];
  let equity = capital;
  let inPosition = false;
  let posType: "LONG" | "SHORT" = "LONG";
  let entryIdx = 0;
  let entryPrice = 0;

  for (let i = 1; i < candles.length; i++) {
    equityCurve.push({ date: candles[i].date, equity });
    if (macdL[i] === null || sigL[i] === null || macdL[i - 1] === null || sigL[i - 1] === null) continue;

    const bullCross = macdL[i - 1]! <= sigL[i - 1]! && macdL[i]! > sigL[i]!;
    const bearCross = macdL[i - 1]! >= sigL[i - 1]! && macdL[i]! < sigL[i]!;

    if (!inPosition) {
      // LONG: MACD bull cross
      if (bullCross) {
        const r = rsiValues[i];
        if (r === null || (r > 30 && r < 72)) {
          inPosition = true; posType = "LONG"; entryIdx = i; entryPrice = candles[i].close;
        }
      }
      // LONG: Histogram turns positive from negative (momentum shift)
      else if (hist[i] !== null && hist[i - 1] !== null && hist[i]! > 0 && hist[i - 1]! < 0 && !bullCross) {
        const r = rsiValues[i];
        if (r !== null && r > 35 && r < 60) {
          inPosition = true; posType = "LONG"; entryIdx = i; entryPrice = candles[i].close;
        }
      }
      // SHORT: MACD bear cross in downtrend
      else if (bearCross && sma50v[i] !== null && candles[i].close < sma50v[i]!) {
        inPosition = true; posType = "SHORT"; entryIdx = i; entryPrice = candles[i].close;
      }
    }
    else {
      const pctMove = posType === "LONG"
        ? (candles[i].close - entryPrice) / entryPrice
        : (entryPrice - candles[i].close) / entryPrice;
      const holdDays = i - entryIdx;

      const oppositeCross = posType === "LONG" ? bearCross : bullCross;
      const timeExit = holdDays > 15;
      if (oppositeCross || pctMove < -0.025 || pctMove > 0.055 || timeExit) {
        equity = recordTrade(trades, equityCurve, candles, entryIdx, i, equity, 0.40, posType, 1);
        inPosition = false;
      }
    }
  }
  return { trades, equityCurve };
}

function runBollingerBounce(candles: OHLC[], capital: number): { trades: Trade[]; equityCurve: Array<{ date: string; equity: number }> } {
  const closes = candles.map(c => c.close);
  const bb = bollingerBands(closes, 20, 2);
  const rsiValues = rsi(closes, 14);
  const trades: Trade[] = [];
  const equityCurve: Array<{ date: string; equity: number }> = [];
  let equity = capital;
  let inPosition = false;
  let posType: "LONG" | "SHORT" = "LONG";
  let entryIdx = 0;
  let entryPrice = 0;

  for (let i = 0; i < candles.length; i++) {
    equityCurve.push({ date: candles[i].date, equity });
    if (bb.lower[i] === null || bb.upper[i] === null || bb.middle[i] === null) continue;

    if (!inPosition) {
      // LONG: Price touches lower band + RSI oversold
      const nearLower = candles[i].close <= bb.lower[i]! * 1.005;
      const rsiOversold = rsiValues[i] !== null && rsiValues[i]! < 40;
      if (nearLower && rsiOversold) {
        inPosition = true; posType = "LONG"; entryIdx = i; entryPrice = candles[i].close;
      }
      // SHORT: Price touches upper band + RSI overbought
      const nearUpper = candles[i].close >= bb.upper[i]! * 0.995;
      const rsiOverbought = rsiValues[i] !== null && rsiValues[i]! > 70;
      if (!inPosition && nearUpper && rsiOverbought) {
        inPosition = true; posType = "SHORT"; entryIdx = i; entryPrice = candles[i].close;
      }
    }
    else {
      const pctMove = posType === "LONG"
        ? (candles[i].close - entryPrice) / entryPrice
        : (entryPrice - candles[i].close) / entryPrice;

      // Exit at middle band with profit, opposite band, or SL/TP
      const atMiddle = posType === "LONG"
        ? candles[i].close >= bb.middle[i]! && pctMove > 0.012
        : candles[i].close <= bb.middle[i]! && pctMove > 0.012;
      const atOpposite = posType === "LONG"
        ? candles[i].close >= bb.upper[i]! * 0.995
        : candles[i].close <= bb.lower[i]! * 1.005;

      if (atOpposite || atMiddle || pctMove < -0.02 || pctMove > 0.05) {
        equity = recordTrade(trades, equityCurve, candles, entryIdx, i, equity, 0.40, posType, 1);
        inPosition = false;
      }
    }
  }
  return { trades, equityCurve };
}

function runOpeningRangeBreakout(candles: OHLC[], capital: number): { trades: Trade[]; equityCurve: Array<{ date: string; equity: number }> } {
  const closes = candles.map(c => c.close);
  const sma20v = sma(closes, 20);
  const trades: Trade[] = [];
  const equityCurve: Array<{ date: string; equity: number }> = [];
  let equity = capital;
  let inPosition = false;
  let posType: "LONG" | "SHORT" = "LONG";
  let entryIdx = 0;
  let entryPrice = 0;

  for (let i = 3; i < candles.length; i++) {
    equityCurve.push({ date: candles[i].date, equity });

    const prevHigh = candles[i - 1].high;
    const prevLow = candles[i - 1].low;
    const prevRange = prevHigh - prevLow;
    const prev2Range = candles[i - 2].high - candles[i - 2].low;
    const avgRange = (prevRange + prev2Range) / 2;
    const hasVolume = candles[i].volume > 0 && candles[i - 1].volume > 0;
    const volExpansion = !hasVolume || candles[i].volume > candles[i - 1].volume * 0.8;

    if (!inPosition && prevRange > 0 && volExpansion) {
      // Narrow range day → breakout is more meaningful
      const narrowRange = prevRange < prev2Range * 0.8;

      // LONG breakout: close above prev high in uptrend
      if (candles[i].close > prevHigh && (narrowRange || (sma20v[i] !== null && candles[i].close > sma20v[i]!))) {
        inPosition = true; posType = "LONG"; entryIdx = i; entryPrice = candles[i].close;
      }
      // SHORT breakdown: close below prev low in downtrend
      else if (candles[i].close < prevLow && (narrowRange || (sma20v[i] !== null && candles[i].close < sma20v[i]!))) {
        inPosition = true; posType = "SHORT"; entryIdx = i; entryPrice = candles[i].close;
      }
    }
    else if (inPosition) {
      const pctMove = posType === "LONG"
        ? (candles[i].close - entryPrice) / entryPrice
        : (entryPrice - candles[i].close) / entryPrice;
      const holdDays = i - entryIdx;

      // ATR-based exits + time limit for options-like quick scalps
      const target = avgRange * 2.5 / entryPrice;
      const stop = avgRange * 1.2 / entryPrice;
      if (pctMove > target || pctMove < -stop || pctMove > 0.04 || pctMove < -0.02 || holdDays >= 4) {
        equity = recordTrade(trades, equityCurve, candles, entryIdx, i, equity, 0.12, posType, 5);
        inPosition = false;
      }
    }
  }
  return { trades, equityCurve };
}

// GODMODE V6: Multi-indicator combined strategy (12 filters, long + short)
function runGodmodeV6(candles: OHLC[], capital: number): { trades: Trade[]; equityCurve: Array<{ date: string; equity: number }> } {
  const closes = candles.map(c => c.close);
  const rsiValues = rsi(closes, 14);
  const { macdLine: macdL, signalLine: sigL, histogram: hist } = macd(closes);
  const bb = bollingerBands(closes, 20, 2);
  const sma9 = sma(closes, 9);
  const sma20 = sma(closes, 20);
  const ema8 = ema(closes, 8);
  const ema21 = ema(closes, 21);
  const trades: Trade[] = [];
  const equityCurve: Array<{ date: string; equity: number }> = [];
  let equity = capital;
  let inPosition = false;
  let posType: "LONG" | "SHORT" = "LONG";
  let entryIdx = 0;
  let entryPrice = 0;

  for (let i = 3; i < candles.length; i++) {
    equityCurve.push({ date: candles[i].date, equity });
    if (rsiValues[i] === null || sma20[i] === null || bb.middle[i] === null || macdL[i] === null) continue;

    if (!inPosition) {
      // ── BULLISH SCORE ──
      let bullScore = 0;
      if (rsiValues[i]! > 30 && rsiValues[i]! < 65) bullScore++;
      if (candles[i].close > sma20[i]!) bullScore++;
      if (ema8[i] !== null && ema21[i] !== null && ema8[i]! > ema21[i]!) bullScore++;
      if (hist[i] !== null && hist[i]! > 0) bullScore++;
      if (macdL[i]! > (sigL[i] || 0)) bullScore++;
      if (candles[i].close > bb.lower[i]!) bullScore++;
      const avgVol = (candles[i - 1].volume + candles[i - 2].volume + candles[Math.max(0, i - 3)].volume) / 3;
      if (avgVol === 0 || candles[i].volume > avgVol * 0.9) bullScore++;
      if (candles[i].close > candles[i].open) bullScore++;
      if (candles[i].low > candles[i - 1].low) bullScore++;
      const dayRange = candles[i].high - candles[i].low;
      if (dayRange > 0 && (candles[i].close - candles[i].low) / dayRange > 0.5) bullScore++;
      if (sma9[i] !== null && sma9[i]! > sma20[i]!) bullScore++;
      if (candles[i].close < bb.upper[i]! * 0.99) bullScore++;

      // ── BEARISH SCORE ──
      let bearScore = 0;
      if (rsiValues[i]! > 60 || rsiValues[i]! < 30) bearScore++;
      if (candles[i].close < sma20[i]!) bearScore++;
      if (ema8[i] !== null && ema21[i] !== null && ema8[i]! < ema21[i]!) bearScore++;
      if (hist[i] !== null && hist[i]! < 0) bearScore++;
      if (macdL[i]! < (sigL[i] || 0)) bearScore++;
      if (candles[i].close < bb.upper[i]!) bearScore++;
      if (avgVol === 0 || candles[i].volume > avgVol * 0.9) bearScore++;
      if (candles[i].close < candles[i].open) bearScore++;
      if (candles[i].high < candles[i - 1].high) bearScore++;
      if (dayRange > 0 && (candles[i].close - candles[i].low) / dayRange < 0.4) bearScore++;
      if (sma9[i] !== null && sma9[i]! < sma20[i]!) bearScore++;
      if (candles[i].close > bb.lower[i]! * 1.01) bearScore++;

      // Enter LONG when 8+ bullish, SHORT when 9+ bearish (shorts need higher conviction)
      if (bullScore >= 8) {
        inPosition = true; posType = "LONG"; entryIdx = i; entryPrice = candles[i].close;
      } else if (bearScore >= 9) {
        inPosition = true; posType = "SHORT"; entryIdx = i; entryPrice = candles[i].close;
      }
    }
    else {
      const pctMove = posType === "LONG"
        ? (candles[i].close - entryPrice) / entryPrice
        : (entryPrice - candles[i].close) / entryPrice;
      const holdDays = i - entryIdx;

      // Options scalper exits: quick profit, tight stop, time decay
      const stopPct = holdDays < 2 ? -0.008 : -0.012;
      const targetPct = holdDays < 2 ? 0.02 : 0.035;
      const timeExit = holdDays >= 5;

      // Momentum reversal check
      const momReverse = posType === "LONG"
        ? (hist[i] !== null && hist[i - 1] !== null && hist[i]! < 0 && hist[i]! < hist[i - 1]! && pctMove > 0.005)
        : (hist[i] !== null && hist[i - 1] !== null && hist[i]! > 0 && hist[i]! > hist[i - 1]! && pctMove > 0.005);
      const rsiExtreme = posType === "LONG"
        ? (rsiValues[i] !== null && rsiValues[i]! > 75)
        : (rsiValues[i] !== null && rsiValues[i]! < 25);

      if (pctMove < stopPct || pctMove > targetPct || momReverse || rsiExtreme || timeExit) {
        equity = recordTrade(trades, equityCurve, candles, entryIdx, i, equity, 0.10, posType, 15);
        inPosition = false;
      }
    }
  }
  return { trades, equityCurve };
}

// ICT Order Blocks: Institutional order flow strategy (long + short)
function runICTOrderBlocks(candles: OHLC[], capital: number): { trades: Trade[]; equityCurve: Array<{ date: string; equity: number }> } {
  const closes = candles.map(c => c.close);
  const sma20 = sma(closes, 20);
  const rsiValues = rsi(closes, 14);
  const trades: Trade[] = [];
  const equityCurve: Array<{ date: string; equity: number }> = [];
  let equity = capital;
  let inPosition = false;
  let posType: "LONG" | "SHORT" = "LONG";
  let entryIdx = 0;
  let entryPrice = 0;

  for (let i = 5; i < candles.length; i++) {
    equityCurve.push({ date: candles[i].date, equity });
    if (sma20[i] === null) continue;

    if (!inPosition) {
      const inUptrend = candles[i].close > sma20[i]!;
      const inDowntrend = candles[i].close < sma20[i]!;

      // ── BULLISH ORDER BLOCK ──
      const prevBearish = candles[i - 2].close < candles[i - 2].open;
      const bigBearMove = Math.abs(candles[i - 2].close - candles[i - 2].open) / candles[i - 2].open > 0.003;
      const bullReversal = candles[i - 1].close > candles[i - 1].open && candles[i].close > candles[i - 1].close;
      const bullFVG = candles[i].low > candles[i - 2].high;
      const recentLow = Math.min(candles[i - 3].low, candles[i - 4].low, candles[i - 5].low);
      const bullSweep = candles[i - 1].low < recentLow && candles[i].close > candles[i - 1].high;

      if (inUptrend && ((prevBearish && bigBearMove && bullReversal) || bullFVG || bullSweep)) {
        inPosition = true; posType = "LONG"; entryIdx = i; entryPrice = candles[i].close;
      }

      // ── BEARISH ORDER BLOCK ──
      if (!inPosition) {
        const prevBullish = candles[i - 2].close > candles[i - 2].open;
        const bigBullMove = Math.abs(candles[i - 2].close - candles[i - 2].open) / candles[i - 2].open > 0.003;
        const bearReversal = candles[i - 1].close < candles[i - 1].open && candles[i].close < candles[i - 1].close;
        const bearFVG = candles[i].high < candles[i - 2].low;
        const recentHigh = Math.max(candles[i - 3].high, candles[i - 4].high, candles[i - 5].high);
        const bearSweep = candles[i - 1].high > recentHigh && candles[i].close < candles[i - 1].low;

        if (inDowntrend && ((prevBullish && bigBullMove && bearReversal) || bearFVG || bearSweep)) {
          inPosition = true; posType = "SHORT"; entryIdx = i; entryPrice = candles[i].close;
        }
      }
    }
    else if (inPosition) {
      const pctMove = posType === "LONG"
        ? (candles[i].close - entryPrice) / entryPrice
        : (entryPrice - candles[i].close) / entryPrice;
      const holdDays = i - entryIdx;

      const rsiExtreme = posType === "LONG"
        ? (rsiValues[i] !== null && rsiValues[i]! > 72)
        : (rsiValues[i] !== null && rsiValues[i]! < 28);
      const timeExit = holdDays >= 5;

      if (pctMove < -0.015 || pctMove > 0.04 || rsiExtreme || timeExit) {
        equity = recordTrade(trades, equityCurve, candles, entryIdx, i, equity, 0.07, posType, 10);
        inPosition = false;
      }
    }
  }
  return { trades, equityCurve };
}

function runCustomStrategy(candles: OHLC[], capital: number, strategyText: string): { trades: Trade[]; equityCurve: Array<{ date: string; equity: number }> } {
  const text = strategyText.toLowerCase();

  if (text.includes("rsi") || text.includes("momentum")) return runRSIMeanReversion(candles, capital);
  if (text.includes("sma") || text.includes("golden") || text.includes("cross")) return runSMACrossover(candles, capital);
  if (text.includes("macd")) return runMACDCrossover(candles, capital);
  if (text.includes("bollinger") || text.includes("bb") || text.includes("vwap")) return runBollingerBounce(candles, capital);
  if (text.includes("breakout") || text.includes("opening") || text.includes("orb")) return runOpeningRangeBreakout(candles, capital);
  if (text.includes("godmode") || text.includes("12 filter")) return runGodmodeV6(candles, capital);
  if (text.includes("ict") || text.includes("order block")) return runICTOrderBlocks(candles, capital);

  // Default: GODMODE multi-indicator
  return runGodmodeV6(candles, capital);
}

// ── Metric Calculations ───────────────────────────────────────────────────

function calculateMetrics(trades: Trade[], equityCurve: Array<{ date: string; equity: number }>, capital: number): BacktestResult["metrics"] {
  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl <= 0);
  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
  const finalCapital = capital + totalPnl;

  // Win rate
  const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;

  // Total return
  const totalReturn = ((finalCapital - capital) / capital) * 100;

  // CAGR
  let years = 1;
  if (equityCurve.length >= 2) {
    const start = new Date(equityCurve[0].date);
    const end = new Date(equityCurve[equityCurve.length - 1].date);
    years = Math.max((end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000), 0.1);
  }
  const cagr = (Math.pow(finalCapital / capital, 1 / years) - 1) * 100;

  // Max drawdown
  let maxDrawdown = 0;
  let peak = capital;
  for (const pt of equityCurve) {
    if (pt.equity > peak) peak = pt.equity;
    const dd = ((peak - pt.equity) / peak) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Sharpe ratio (annualized, assuming daily returns)
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1].equity;
    if (prev > 0) {
      returns.push((equityCurve[i].equity - prev) / prev);
    }
  }
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdReturn = returns.length > 1
    ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1))
    : 0;
  const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

  // Profit factor
  const totalGains = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = totalLosses > 0 ? totalGains / totalLosses : totalGains > 0 ? 999 : 0;

  // Average win / loss
  const avgWin = winningTrades.length > 0
    ? winningTrades.reduce((sum, t) => sum + t.pnlPct, 0) / winningTrades.length
    : 0;
  const avgLoss = losingTrades.length > 0
    ? losingTrades.reduce((sum, t) => sum + t.pnlPct, 0) / losingTrades.length
    : 0;

  return {
    totalReturn: +totalReturn.toFixed(2),
    cagr: +cagr.toFixed(2),
    winRate: +winRate.toFixed(1),
    maxDrawdown: +maxDrawdown.toFixed(2),
    sharpeRatio: +sharpeRatio.toFixed(2),
    profitFactor: +profitFactor.toFixed(2),
    totalTrades: trades.length,
    avgWin: +avgWin.toFixed(2),
    avgLoss: +avgLoss.toFixed(2),
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    initialCapital: capital,
    finalCapital: +finalCapital.toFixed(2),
  };
}

function calculateMonthlyReturns(equityCurve: Array<{ date: string; equity: number }>): Array<{ month: string; return: number }> {
  if (equityCurve.length < 2) return [];

  const monthly: Record<string, { start: number; end: number }> = {};
  for (const pt of equityCurve) {
    const month = pt.date.substring(0, 7); // YYYY-MM
    if (!monthly[month]) {
      monthly[month] = { start: pt.equity, end: pt.equity };
    } else {
      monthly[month].end = pt.equity;
    }
  }

  return Object.entries(monthly).map(([month, data]) => ({
    month,
    return: +((data.end - data.start) / data.start * 100).toFixed(2),
  }));
}

// ── Known security IDs for common symbols ─────────────────────────────────

const KNOWN_SECURITY_IDS: Record<string, { id: string; isIndex?: boolean }> = {
  "NIFTY": { id: "13", isIndex: true }, "NIFTY50": { id: "13", isIndex: true },
  "BANKNIFTY": { id: "25", isIndex: true }, "SENSEX": { id: "1", isIndex: true },
  "FINNIFTY": { id: "27", isIndex: true }, "MIDCPNIFTY": { id: "442", isIndex: true },
  "RELIANCE": { id: "2885" }, "HDFCBANK": { id: "1333" }, "TCS": { id: "11536" },
  "INFY": { id: "1594" }, "ICICIBANK": { id: "4963" }, "SBIN": { id: "3045" },
  "BHARTIARTL": { id: "10604" }, "ITC": { id: "7745" }, "LT": { id: "11483" },
  "AXISBANK": { id: "5900" }, "KOTAKBANK": { id: "1922" }, "HINDUNILVR": { id: "1394" },
  "TATAMOTORS": { id: "3456" }, "TATASTEEL": { id: "3499" }, "SUNPHARMA": { id: "3351" },
  "MARUTI": { id: "10999" }, "WIPRO": { id: "3787" }, "HCLTECH": { id: "7229" },
  "M&M": { id: "2031" }, "BAJFINANCE": { id: "317" }, "BAJAJFINSV": { id: "16669" },
  "TITAN": { id: "3506" }, "ASIANPAINT": { id: "236" }, "ULTRACEMCO": { id: "11532" },
  "NESTLEIND": { id: "17963" }, "DIVISLAB": { id: "10940" }, "DRREDDY": { id: "881" },
  "CIPLA": { id: "694" }, "ADANIENT": { id: "25" }, "ADANIPORTS": { id: "15083" },
  "POWERGRID": { id: "14977" }, "NTPC": { id: "11630" }, "ONGC": { id: "2475" },
  "COALINDIA": { id: "20374" }, "BEL": { id: "2513" }, "HAL": { id: "2513" },
};

// Yahoo Finance symbol mapping for Indian markets
const YAHOO_SYMBOLS: Record<string, string> = {
  "NIFTY": "^NSEI", "NIFTY50": "^NSEI", "BANKNIFTY": "^NSEBANK",
  "SENSEX": "^BSESN", "FINNIFTY": "NIFTY_FIN_SERVICE.NS",
  "M&M": "M%26M.NS",
};

// ── POST Handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      symbol = "RELIANCE",
      strategy = "",
      period: rawPeriod = "3Y",
      capital = 200000,
      maxTrades = 500,
      assetType = "Stock",
    } = body;
    const period = rawPeriod.toLowerCase().replace("y", "y"); // Normalize "5Y" -> "5y"

    // Determine data source and fetch OHLC data
    let candles: OHLC[] = [];

    const assetLower = assetType.toLowerCase();
    if (assetLower === "crypto" || assetLower === "commodity") {
      // Use Yahoo Finance for crypto and commodities
      let yahooSymbol = symbol;
      if (assetType === "crypto" && !symbol.includes("-")) {
        yahooSymbol = `${symbol}-USD`;
      }
      candles = await fetchYahooHistorical(yahooSymbol, period);
    } else {
      // Try Dhan first for stocks/options/futures
      const secInfo = KNOWN_SECURITY_IDS[symbol.toUpperCase()];
      if (secInfo) {
        const now = new Date();
        const periodYears = parseInt(period) || 3;
        const from = new Date(now);
        from.setFullYear(from.getFullYear() - periodYears);
        candles = await fetchDhanHistorical(
          secInfo.id,
          from.toISOString().split("T")[0],
          now.toISOString().split("T")[0],
          secInfo.isIndex || false
        );
      }

      // Fallback to Yahoo Finance with proper symbol mapping
      if (candles.length === 0) {
        const yahooSymbol = YAHOO_SYMBOLS[symbol.toUpperCase()]
          || (symbol.includes(".NS") ? symbol : `${symbol}.NS`);
        candles = await fetchYahooHistorical(yahooSymbol, period);
      }
    }

    if (candles.length < 50) {
      return NextResponse.json({
        error: `Insufficient data for ${symbol}. Got ${candles.length} candles, need at least 50.`,
      }, { status: 400 });
    }

    // Detect and run the appropriate strategy
    let result: { trades: Trade[]; equityCurve: Array<{ date: string; equity: number }> };
    const strategyLower = (typeof strategy === "string" ? strategy : "").toLowerCase();

    if (strategyLower.includes("godmode") || strategyLower.includes("12 filter")) {
      result = runGodmodeV6(candles, capital);
    } else if (strategyLower.includes("ict") || strategyLower.includes("order block")) {
      result = runICTOrderBlocks(candles, capital);
    } else if (strategyLower.includes("rsi") || strategyLower.includes("momentum rsi")) {
      result = runRSIMeanReversion(candles, capital);
    } else if (strategyLower.includes("sma") || strategyLower.includes("golden cross")) {
      result = runSMACrossover(candles, capital);
    } else if (strategyLower.includes("macd")) {
      result = runMACDCrossover(candles, capital);
    } else if (strategyLower.includes("bollinger") || strategyLower.includes("bb+vwap") || strategyLower.includes("vwap")) {
      result = runBollingerBounce(candles, capital);
    } else if (strategyLower.includes("opening") || strategyLower.includes("breakout") || strategyLower.includes("orb")) {
      result = runOpeningRangeBreakout(candles, capital);
    } else if (strategyLower.includes("max pain") || strategyLower.includes("expiry")) {
      result = runBollingerBounce(candles, capital);
    } else {
      result = runCustomStrategy(candles, capital, strategy);
    }

    const metrics = calculateMetrics(result.trades, result.equityCurve, capital);
    const monthlyReturns = calculateMonthlyReturns(result.equityCurve);

    // Sample equity curve to max 200 points for payload size
    let sampledCurve = result.equityCurve;
    if (sampledCurve.length > 200) {
      const step = Math.floor(sampledCurve.length / 200);
      sampledCurve = sampledCurve.filter((_, i) => i % step === 0 || i === sampledCurve.length - 1);
    }

    return NextResponse.json({
      metrics,
      trades: result.trades.slice(-100), // Last 100 trades
      equityCurve: sampledCurve,
      monthlyReturns,
      symbol,
      period,
      candlesUsed: candles.length,
    });
  } catch (err) {
    console.error("[Backtest] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
