"use client";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Loader2 } from "lucide-react";

interface HeatmapStock {
  symbol: string; name: string; sector: string;
  price: number; change: number; changePct: number;
  marketCap: number; volume: number;
}

interface TreeRect {
  stock: HeatmapStock;
  x: number; y: number; w: number; h: number;
}

const GEOS = [
  { id: "india", label: "F&O Stocks" },
  { id: "us", label: "US" },
  { id: "crypto", label: "Crypto" },
  { id: "commodities", label: "Commodities" },
];

const SIZE_MODES = [
  { id: "mcap", label: "Market Cap" },
  { id: "volume", label: "Volume" },
  { id: "equal", label: "Equal" },
];

const COLOR_MODES = [
  { id: "day", label: "D%" },
];

const INTENSITY = ["-3%", "-2%", "-1%", "0%", "1%", "2%", "3%"];
const INTENSITY_COLORS = ["#991b1b", "#dc2626", "#ef4444", "#374151", "#22c55e", "#16a34a", "#15803d"];

function getColor(pct: number): string {
  if (pct <= -3) return "#7f1d1d";
  if (pct <= -2) return "#991b1b";
  if (pct <= -1) return "#dc2626";
  if (pct < 0) return "#b91c1c80";
  if (pct === 0) return "#374151";
  if (pct < 1) return "#16a34a80";
  if (pct < 2) return "#16a34a";
  if (pct < 3) return "#15803d";
  return "#14532d";
}

// ── Squarified Treemap Layout ──
function squarify(items: { stock: HeatmapStock; value: number }[], x: number, y: number, w: number, h: number): TreeRect[] {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ stock: items[0].stock, x, y, w, h }];

  const total = items.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return [];

  const sorted = [...items].sort((a, b) => b.value - a.value);
  const rects: TreeRect[] = [];

  let remaining = [...sorted];
  let cx = x, cy = y, cw = w, ch = h;

  while (remaining.length > 0) {
    const isWide = cw >= ch;
    const side = isWide ? ch : cw;
    const remTotal = remaining.reduce((s, i) => s + i.value, 0);

    // Find best row
    let row: typeof remaining = [];
    let rowTotal = 0;
    let bestAspect = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = [...row, remaining[i]];
      const candidateTotal = rowTotal + remaining[i].value;
      const rowLen = (candidateTotal / remTotal) * (isWide ? cw : ch);

      // Worst aspect ratio in this row
      let worstAspect = 0;
      for (const item of candidate) {
        const itemSize = (item.value / candidateTotal) * side;
        const aspect = Math.max(rowLen / itemSize, itemSize / rowLen);
        worstAspect = Math.max(worstAspect, aspect);
      }

      if (worstAspect <= bestAspect || row.length === 0) {
        bestAspect = worstAspect;
        row = candidate;
        rowTotal = candidateTotal;
      } else {
        break;
      }
    }

    // Lay out the row
    const rowFraction = rowTotal / remTotal;
    const rowLen = rowFraction * (isWide ? cw : ch);

    let offset = 0;
    for (const item of row) {
      const itemFraction = item.value / rowTotal;
      const itemLen = itemFraction * side;

      if (isWide) {
        rects.push({ stock: item.stock, x: cx, y: cy + offset, w: rowLen, h: itemLen });
      } else {
        rects.push({ stock: item.stock, x: cx + offset, y: cy, w: itemLen, h: rowLen });
      }
      offset += itemLen;
    }

    // Reduce remaining area
    if (isWide) {
      cx += rowLen;
      cw -= rowLen;
    } else {
      cy += rowLen;
      ch -= rowLen;
    }

    remaining = remaining.slice(row.length);
  }

  return rects;
}

export default function TVHeatmap() {
  const [geo, setGeo] = useState("india");
  const [sizeMode, setSizeMode] = useState("mcap");
  const [stocks, setStocks] = useState<HeatmapStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 1200, h: 600 });

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDims({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/heatmap?geo=${geo}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.stocks?.length > 0) {
          setStocks(data.stocks);
          setLastUpdate(Date.now());
        }
      }
    } catch { /* noop */ }
    setLoading(false);
  }, [geo]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const i = setInterval(fetchData, 5000);
    return () => clearInterval(i);
  }, [fetchData]);

  // Compute treemap layout
  const rects = useMemo(() => {
    const w = dims.w || 1200;
    const h = dims.h || 600;
    if (stocks.length === 0 || w < 10 || h < 10) return [];

    const items = stocks.map(s => ({
      stock: s,
      value: Math.max(sizeMode === "mcap" ? s.marketCap : sizeMode === "volume" ? s.volume : 1, 1),
    }));

    return squarify(items, 0, 0, w, h);
  }, [stocks, dims.w, dims.h, sizeMode]);

  return (
    <div className="h-full flex flex-col bg-[#1a1a1a] overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#333] flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Geo tabs */}
          <div className="flex items-center gap-0 border border-[#3a3a3a] rounded overflow-hidden">
            {GEOS.map(g => (
              <button key={g.id} onClick={() => setGeo(g.id)}
                className={`text-[10px] px-3 py-1.5 font-semibold transition ${geo === g.id ? "bg-white/10 text-white" : "text-[#888] hover:text-white"}`}>
                {g.label}
              </button>
            ))}
          </div>
          {/* Size mode */}
          <div className="flex items-center gap-0 border border-[#3a3a3a] rounded overflow-hidden">
            {SIZE_MODES.map(m => (
              <button key={m.id} onClick={() => setSizeMode(m.id)}
                className={`text-[10px] px-3 py-1.5 font-semibold transition ${sizeMode === m.id ? "bg-white/10 text-white" : "text-[#888] hover:text-white"}`}>
                {m.label}
              </button>
            ))}
          </div>
          {/* Color mode */}
          <div className="flex items-center gap-0 border border-[#3a3a3a] rounded overflow-hidden">
            {COLOR_MODES.map(m => (
              <button key={m.id} className="text-[10px] px-3 py-1.5 font-semibold bg-white/10 text-white">{m.label}</button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Scale selector */}
          <span className="text-[10px] text-[#888] font-semibold border border-[#3a3a3a] rounded px-2 py-1">1x</span>
          {/* Color legend */}
          <div className="flex items-center gap-0">
            {INTENSITY.map((label, i) => (
              <div key={label} className="text-[9px] font-bold px-2 py-1 text-white" style={{ background: INTENSITY_COLORS[i] }}>
                {label}
              </div>
            ))}
          </div>
          {lastUpdate > 0 && <span className="flex items-center gap-1 text-[8px] text-[#888]"><span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot" />Live</span>}
        </div>
      </div>

      {/* ── Treemap ── */}
      <div ref={containerRef} className="flex-1 min-h-0 relative overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 text-slate-600 animate-spin" /></div>
        ) : stocks.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[11px] text-slate-600">No data — market may be closed</div>
        ) : (
          rects.map((rect, i) => {
            const isLarge = rect.w > 90 && rect.h > 60;
            const isMedium = rect.w > 55 && rect.h > 40;
            const isHover = hovered === rect.stock.symbol;

            return (
              <div
                key={rect.stock.symbol + i}
                className="absolute flex flex-col items-center justify-center overflow-hidden cursor-pointer transition-all duration-150"
                style={{
                  left: rect.x + 1, top: rect.y + 1,
                  width: rect.w - 2, height: rect.h - 2,
                  background: getColor(rect.stock.changePct),
                  borderRadius: 4,
                  zIndex: isHover ? 10 : 1,
                  transform: isHover ? "scale(1.03)" : "scale(1)",
                  boxShadow: isHover ? "0 0 20px rgba(0,0,0,0.5)" : "none",
                }}
                onMouseEnter={() => setHovered(rect.stock.symbol)}
                onMouseLeave={() => setHovered(null)}
                title={`${rect.stock.name} (${rect.stock.symbol})\n₹${rect.stock.price.toLocaleString()}\n${rect.stock.changePct >= 0 ? "+" : ""}${rect.stock.changePct.toFixed(2)}%\nVol: ${rect.stock.volume.toLocaleString()}`}
              >
                {isLarge && (
                  <>
                    <div className="text-white font-black text-[13px] leading-tight">{rect.stock.symbol}</div>
                    <div className="text-white/80 text-[11px] font-bold mt-0.5">
                      ₹{rect.stock.price.toLocaleString(undefined, { maximumFractionDigits: rect.stock.price < 100 ? 2 : 0 })}
                    </div>
                    <div className="text-white font-bold text-[11px]">
                      {rect.stock.changePct >= 0 ? "+" : ""}{rect.stock.changePct.toFixed(2)}%
                    </div>
                  </>
                )}
                {!isLarge && isMedium && (
                  <>
                    <div className="text-white font-bold text-[9px] leading-tight">{rect.stock.symbol}</div>
                    <div className="text-white/80 text-[8px]">
                      {rect.stock.changePct >= 0 ? "+" : ""}{rect.stock.changePct.toFixed(1)}%
                    </div>
                  </>
                )}
                {!isMedium && rect.w > 30 && rect.h > 20 && (
                  <div className="text-white/70 text-[7px] font-semibold">{rect.stock.symbol.slice(0, 4)}</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
