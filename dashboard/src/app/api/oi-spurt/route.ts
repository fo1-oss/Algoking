import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface OISpurtStock {
  symbol: string;
  name: string;
  ltp: number;
  change: number;
  changePct: number;
  oi: number;
  oiChange: number;
  oiChangePct: number;
  volume: number;
}

// NSE requires cookies from the main page before API calls work
async function getNSECookies(): Promise<string> {
  try {
    const res = await fetch("https://www.nseindia.com", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
    const cookies = res.headers.getSetCookie?.() || [];
    return cookies.map(c => c.split(";")[0]).join("; ");
  } catch {
    return "";
  }
}

/**
 * Fetches top stocks by OI Spurt from NSE India.
 * API: https://www.nseindia.com/api/live-analysis-oi-spurts-underlyings
 * Source: https://www.nseindia.com/market-data/oi-spurts
 */
export async function GET() {
  const nseHeaders = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.nseindia.com/market-data/oi-spurts",
    "X-Requested-With": "XMLHttpRequest",
  };

  // ── Step 1: Get NSE session cookies ──
  const cookies = await getNSECookies();

  // ── Step 2: Try NSE OI Spurts (By Underlying) ──
  const nseEndpoints = [
    "https://www.nseindia.com/api/live-analysis-oi-spurts-underlyings",
    "https://www.nseindia.com/api/live-analysis-oi-spurts-contracts",
  ];

  for (const url of nseEndpoints) {
    try {
      const res = await fetch(url, {
        headers: { ...nseHeaders, ...(cookies ? { Cookie: cookies } : {}) },
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();
        const rows = data.data || data || [];

        if (Array.isArray(rows) && rows.length > 0) {
          // Sort by OI change % descending and take top 6
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sorted = [...rows].sort((a: any, b: any) =>
            Math.abs(b.pchangeinOI || b.pChange || 0) - Math.abs(a.pchangeinOI || a.pChange || 0)
          );

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const stocks: OISpurtStock[] = sorted.slice(0, 6).map((item: any) => ({
            symbol: `${item.symbol || item.underlying}.NS`,
            name: item.symbol || item.underlying || "",
            ltp: item.underlyingValue || item.latestOI || 0,
            change: item.change || 0,
            changePct: item.pChange || 0,
            oi: item.latestOI || item.openInterest || 0,
            oiChange: item.changeinOI || item.changeinOpenInterest || 0,
            oiChangePct: item.pchangeinOI || 0,
            volume: item.volume || item.totalTradedVolume || 0,
          }));

          return NextResponse.json({ stocks, source: "nse-live", timestamp: Date.now() });
        }
      }
    } catch { /* try next endpoint */ }
  }

  // ── Step 3: Fallback — Yahoo Finance volume spike proxy ──
  try {
    const symbols = [
      "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
      "BHARTIARTL.NS", "SBIN.NS", "HINDUNILVR.NS", "ITC.NS", "KOTAKBANK.NS",
      "LT.NS", "TATAMOTORS.NS", "AXISBANK.NS", "BAJFINANCE.NS", "MARUTI.NS",
      "TATASTEEL.NS", "ADANIENT.NS", "WIPRO.NS", "HCLTECH.NS", "SUNPHARMA.NS",
    ];

    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(",")}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,averageDailyVolume3Month,shortName`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const quotes = (data?.quoteResponse?.result || []) as any[];

      // Sort by volume spike ratio (current vol / avg vol) — proxy for OI spurt
      const withRatio = quotes
        .filter(q => q.regularMarketVolume && q.averageDailyVolume3Month)
        .map(q => ({
          ...q,
          volRatio: q.regularMarketVolume / Math.max(q.averageDailyVolume3Month, 1),
        }))
        .sort((a, b) => b.volRatio - a.volRatio);

      const stocks: OISpurtStock[] = withRatio.slice(0, 6).map(q => ({
        symbol: q.symbol,
        name: (q.shortName || q.symbol).replace(" Limited", "").replace(" Ltd.", "").replace(".NS", ""),
        ltp: q.regularMarketPrice || 0,
        change: q.regularMarketChange || 0,
        changePct: q.regularMarketChangePercent || 0,
        oi: 0,
        oiChange: 0,
        oiChangePct: +(q.volRatio * 100 - 100).toFixed(0),
        volume: q.regularMarketVolume || 0,
      }));

      return NextResponse.json({ stocks, source: "yahoo-volume-spike", timestamp: Date.now() });
    }
  } catch { /* Yahoo failed */ }

  return NextResponse.json({ stocks: [], source: "error", timestamp: Date.now() });
}
