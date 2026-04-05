import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DHAN_BASE = "https://api.dhan.co/v2";

// Key instruments: symbol → { securityId, exchangeSegment }
const TICKER_INSTRUMENTS: Record<string, { securityId: number; exchangeSegment: string; isIndex: boolean }> = {
  NIFTY:      { securityId: 13, exchangeSegment: "IDX_I", isIndex: true },
  BANKNIFTY:  { securityId: 25, exchangeSegment: "IDX_I", isIndex: true },
  SENSEX:     { securityId: 51, exchangeSegment: "IDX_I", isIndex: true },
  RELIANCE:   { securityId: 2885, exchangeSegment: "NSE_EQ", isIndex: false },
  HDFCBANK:   { securityId: 1333, exchangeSegment: "NSE_EQ", isIndex: false },
  TCS:        { securityId: 11536, exchangeSegment: "NSE_EQ", isIndex: false },
  INFY:       { securityId: 1594, exchangeSegment: "NSE_EQ", isIndex: false },
  ICICIBANK:  { securityId: 4963, exchangeSegment: "NSE_EQ", isIndex: false },
  SBIN:       { securityId: 3045, exchangeSegment: "NSE_EQ", isIndex: false },
  BEL:        { securityId: 2513, exchangeSegment: "NSE_EQ", isIndex: false },
  BHARTIARTL: { securityId: 10604, exchangeSegment: "NSE_EQ", isIndex: false },
};

// Mock data fallback when Dhan API fails
function getMockData() {
  const mockPrices: Record<string, { price: number; prevClose: number }> = {
    NIFTY:      { price: 23450.50, prevClose: 23380.00 },
    BANKNIFTY:  { price: 49820.30, prevClose: 49650.00 },
    SENSEX:     { price: 77250.80, prevClose: 77100.00 },
    RELIANCE:   { price: 1285.40, prevClose: 1278.50 },
    HDFCBANK:   { price: 1645.20, prevClose: 1638.00 },
    TCS:        { price: 3520.75, prevClose: 3505.00 },
    INFY:       { price: 1485.60, prevClose: 1492.30 },
    ICICIBANK:  { price: 1125.80, prevClose: 1118.50 },
    SBIN:       { price: 785.40, prevClose: 780.00 },
    BEL:        { price: 295.60, prevClose: 292.80 },
    BHARTIARTL: { price: 1685.30, prevClose: 1670.00 },
  };

  return Object.entries(mockPrices).map(([symbol, { price, prevClose }]) => {
    const change = price - prevClose;
    const changePct = (change / prevClose) * 100;
    return {
      symbol,
      price: +price.toFixed(2),
      change: +change.toFixed(2),
      changePct: +changePct.toFixed(2),
      up: change >= 0,
    };
  });
}

export async function GET() {
  try {
    const token = (process.env.DHAN_ACCESS_TOKEN || "").trim();
    const clientId = (process.env.DHAN_CLIENT_ID || "").trim();

    if (!token || !clientId) {
      console.log("[Ticker] No Dhan credentials, returning mock data");
      return NextResponse.json(getMockData());
    }

    // Build Dhan LTP request: group by exchange segment
    const idxIds: number[] = [];
    const eqIds: number[] = [];

    for (const [, info] of Object.entries(TICKER_INSTRUMENTS)) {
      if (info.isIndex) {
        idxIds.push(info.securityId);
      } else {
        eqIds.push(info.securityId);
      }
    }

    const ltpBody: Record<string, number[]> = {};
    if (idxIds.length > 0) ltpBody["IDX_I"] = idxIds;
    if (eqIds.length > 0) ltpBody["NSE_EQ"] = eqIds;

    // Fetch LTP
    const ltpRes = await fetch(`${DHAN_BASE}/marketfeed/ltp`, {
      method: "POST",
      headers: {
        "access-token": token,
        "client-id": clientId,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(ltpBody),
      cache: "no-store",
    });

    // Fetch OHLC for prev close
    const ohlcRes = await fetch(`${DHAN_BASE}/marketfeed/ohlc`, {
      method: "POST",
      headers: {
        "access-token": token,
        "client-id": clientId,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(ltpBody),
      cache: "no-store",
    });

    if (!ltpRes.ok || !ohlcRes.ok) {
      console.log(`[Ticker] Dhan API failed: LTP=${ltpRes.status}, OHLC=${ohlcRes.status}`);
      return NextResponse.json(getMockData());
    }

    const ltpData = await ltpRes.json();
    const ohlcData = await ohlcRes.json();

    // Parse responses — Dhan returns: { data: { "NSE_EQ:11536": { last_price: ... } } }
    // or nested format: { data: { "IDX_I": { "13": { ... } } } }
    const results: Array<{ symbol: string; price: number; change: number; changePct: number; up: boolean }> = [];

    for (const [symbol, info] of Object.entries(TICKER_INSTRUMENTS)) {
      const seg = info.exchangeSegment;
      const sid = String(info.securityId);
      const key1 = `${seg}:${sid}`;

      // Try multiple response formats Dhan might use
      let ltp = 0;
      let prevClose = 0;

      // Format 1: flat { "NSE_EQ:11536": { last_price } }
      if (ltpData?.data?.[key1]) {
        ltp = ltpData.data[key1].last_price || ltpData.data[key1].ltp || 0;
      }
      // Format 2: nested { "NSE_EQ": { "11536": { last_price } } }
      else if (ltpData?.data?.[seg]?.[sid]) {
        const entry = ltpData.data[seg][sid];
        ltp = entry.last_price || entry.ltp || 0;
      }

      // OHLC for prev close
      if (ohlcData?.data?.[key1]) {
        const ohlc = ohlcData.data[key1].ohlc || ohlcData.data[key1];
        prevClose = ohlc.prev_close || ohlc.prevClose || ohlc.close || 0;
      } else if (ohlcData?.data?.[seg]?.[sid]) {
        const entry = ohlcData.data[seg][sid];
        const ohlc = entry.ohlc || entry;
        prevClose = ohlc.prev_close || ohlc.prevClose || ohlc.close || 0;
      }

      if (ltp > 0) {
        const change = prevClose > 0 ? ltp - prevClose : 0;
        const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
        results.push({
          symbol,
          price: +ltp.toFixed(2),
          change: +change.toFixed(2),
          changePct: +changePct.toFixed(2),
          up: change >= 0,
        });
      }
    }

    // If we got no results from Dhan, return mock data
    if (results.length === 0) {
      console.log("[Ticker] No data from Dhan, returning mock data");
      return NextResponse.json(getMockData());
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error("[Ticker] Error:", err);
    return NextResponse.json(getMockData());
  }
}
