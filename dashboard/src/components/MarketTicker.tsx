"use client";
import { useState, useEffect, useRef } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface TickerItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
}

const TICKER_SYMBOLS = [
  { sym: "NSE_EQ", ids: [13], name: "NIFTY 50", yahoo: "^NSEI" },
  { sym: "NSE_EQ", ids: [25], name: "BANK NIFTY", yahoo: "^NSEBANK" },
  { sym: "NSE_EQ", ids: [2885], name: "RELIANCE", yahoo: "RELIANCE.NS" },
  { sym: "NSE_EQ", ids: [1333], name: "HDFC BANK", yahoo: "HDFCBANK.NS" },
  { sym: "NSE_EQ", ids: [11536], name: "TCS", yahoo: "TCS.NS" },
  { sym: "NSE_EQ", ids: [1594], name: "INFOSYS", yahoo: "INFY.NS" },
  { sym: "NSE_EQ", ids: [4963], name: "ICICI BANK", yahoo: "ICICIBANK.NS" },
  { sym: "NSE_EQ", ids: [10604], name: "BHARTI AIRTEL", yahoo: "BHARTIARTL.NS" },
  { sym: "NSE_EQ", ids: [3045], name: "SBIN", yahoo: "SBIN.NS" },
  { sym: "NSE_EQ", ids: [7229], name: "ITC", yahoo: "ITC.NS" },
];

const GLOBAL_YAHOO = [
  { yahoo: "ES=F", name: "S&P 500" },
  { yahoo: "NQ=F", name: "NASDAQ" },
  { yahoo: "CL=F", name: "WTI CRUDE" },
  { yahoo: "GC=F", name: "GOLD" },
  { yahoo: "BTC-USD", name: "BITCOIN" },
  { yahoo: "^VIX", name: "VIX" },
  { yahoo: "DX-Y.NYB", name: "DXY" },
  { yahoo: "EURUSD=X", name: "EUR/USD" },
  { yahoo: "USDINR=X", name: "USD/INR" },
];

export default function MarketTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [source, setSource] = useState<"loading" | "dhan" | "yahoo">("loading");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchTicker = async () => {
      // ── Try Dhan first ──
      try {
        const statusRes = await fetch("/api/dhan?action=status");
        const status = await statusRes.json();

        if (status.connected) {
          // Build request body: { "NSE_EQ": [13, 25, 2885, ...] }
          const body: Record<string, number[]> = {};
          for (const t of TICKER_SYMBOLS) {
            if (!body[t.sym]) body[t.sym] = [];
            body[t.sym].push(...t.ids);
          }

          const res = await fetch("/api/dhan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "ohlc", ...body }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.data && data.status === "success") {
              const dhanItems: TickerItem[] = [];
              for (const t of TICKER_SYMBOLS) {
                const segData = data.data[t.sym];
                if (segData) {
                  const idStr = String(t.ids[0]);
                  const quote = segData[idStr];
                  if (quote) {
                    const price = quote.last_price || 0;
                    const prevClose = quote.ohlc?.close || price;
                    const change = price - prevClose;
                    const changePct = prevClose ? (change / prevClose) * 100 : 0;
                    dhanItems.push({ symbol: t.yahoo, name: t.name, price, change, changePct });
                  }
                }
              }
              if (dhanItems.length > 0) {
                setItems(dhanItems);
                setSource("dhan");
                return;
              }
            }
          }
        }
      } catch { /* Dhan not available */ }

      // ── Fallback: Yahoo Finance ──
      try {
        const allSymbols = [
          ...TICKER_SYMBOLS.map(t => t.yahoo),
          ...GLOBAL_YAHOO.map(t => t.yahoo),
        ].join(",");

        const res = await fetch(`/api/prices?symbols=${encodeURIComponent(allSymbols)}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.quotes?.length) {
            const nameMap: Record<string, string> = {};
            TICKER_SYMBOLS.forEach(t => { nameMap[t.yahoo] = t.name; });
            GLOBAL_YAHOO.forEach(t => { nameMap[t.yahoo] = t.name; });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const yahooItems: TickerItem[] = data.quotes.map((q: any) => ({
              symbol: q.symbol,
              name: nameMap[q.symbol] || q.displayName || q.symbol,
              price: q.price || 0,
              change: q.change || 0,
              changePct: q.changePct || 0,
            }));
            setItems(yahooItems);
            setSource("yahoo");
          }
        }
      } catch { /* noop */ }
    };

    fetchTicker();
    const id = setInterval(fetchTicker, 5000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll animation
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let animId: number;
    let pos = 0;

    const animate = () => {
      pos += 0.5;
      if (pos >= el.scrollWidth / 2) pos = 0;
      el.scrollLeft = pos;
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="border-b border-[#333333] bg-[#1e1e1e] flex-shrink-0 h-[42px] flex items-center px-4">
        <span className="text-[10px] text-[#555] animate-pulse">Loading market data...</span>
      </div>
    );
  }

  // Duplicate items for seamless infinite scroll
  const doubled = [...items, ...items];

  return (
    <div className="border-b border-[#333333] bg-[#1e1e1e] flex-shrink-0 overflow-hidden relative">
      {/* Source badge */}
      <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center pl-2 pr-4 bg-gradient-to-r from-[#1e1e1e] via-[#1e1e1e] to-transparent">
        <span className={`text-[7px] px-1.5 py-0.5 rounded font-bold ${source === "dhan" ? "bg-blue-500/15 text-blue-400" : "bg-[#333] text-[#666]"}`}>
          {source === "dhan" ? "DHAN LIVE" : source === "yahoo" ? "YAHOO" : "..."}
        </span>
      </div>

      <div ref={scrollRef} className="flex items-center gap-0 overflow-hidden whitespace-nowrap h-[42px] pl-16">
        {doubled.map((item, i) => (
          <div key={`${item.symbol}-${i}`} className="flex items-center gap-2 px-4 border-r border-[#2a2a2a] flex-shrink-0 h-full">
            <span className="text-[10px] text-[#888] font-medium">{item.name}</span>
            <span className="text-[11px] text-white font-bold">
              {item.price.toLocaleString(undefined, { maximumFractionDigits: item.price < 100 ? 2 : item.price < 1000 ? 1 : 0 })}
            </span>
            <div className={`flex items-center gap-0.5 ${item.changePct >= 0 ? "text-[#BFFF00]" : "text-red-400"}`}>
              {item.changePct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              <span className="text-[9px] font-semibold">
                {item.changePct >= 0 ? "+" : ""}{item.changePct.toFixed(2)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
