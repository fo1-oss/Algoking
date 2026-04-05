// Dhan Scrip Master Cache — fetches once, caches 24h
// Maps NSE F&O stock symbols → Dhan security IDs for market data APIs

export const dynamic = "force-dynamic";

const SCRIP_MASTER_URL = "https://images.dhan.co/api-data/api-scrip-master.csv";

export interface DhanScrip {
  securityId: string;
  tradingSymbol: string;
  segment: string;       // "E" = equity, "D" = derivatives
  instrumentName: string; // "EQUITY", "OPTSTK", "FUTIDX", etc.
  lotSize: number;
}

// In-memory cache
let scripMap: Map<string, DhanScrip> | null = null;
let cacheTime = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

// Column indices (resolved dynamically from header row)
interface ColIdx {
  exchange: number;
  segment: number;
  securityId: number;
  instrument: number;
  tradingSymbol: number;
  customSymbol: number;
  lotSize: number;
}

function resolveColumns(header: string): ColIdx | null {
  const cols = header.split(",").map(c => c.trim().toUpperCase());
  const find = (pattern: string) => cols.findIndex(c => c.includes(pattern));

  const exchange = find("EXM_EXCH_ID");
  const segment = find("SEGMENT");
  const securityId = find("SECURITY_ID");
  const instrument = find("INSTRUMENT");
  const tradingSymbol = find("TRADING_SYMBOL");
  const customSymbol = find("CUSTOM_SYMBOL");
  const lotSize = find("LOT_UNITS");

  if (exchange < 0 || securityId < 0) return null;
  return { exchange, segment, securityId, instrument, tradingSymbol, customSymbol, lotSize };
}

export async function getDhanScripMap(targetSymbols?: Set<string>): Promise<Map<string, DhanScrip>> {
  // Return cache if fresh
  if (scripMap && Date.now() - cacheTime < CACHE_TTL) {
    return scripMap;
  }

  const map = new Map<string, DhanScrip>();

  try {
    const res = await fetch(SCRIP_MASTER_URL, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`Scrip master fetch failed: ${res.status}`);

    const text = await res.text();
    const lines = text.split("\n");
    if (lines.length < 2) throw new Error("Empty scrip master");

    const idx = resolveColumns(lines[0]);
    if (!idx) throw new Error("Cannot parse scrip master header");

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const cols = line.split(",");
      const exchange = (cols[idx.exchange] || "").trim();
      const segment = (cols[idx.segment] || "").trim();
      const instrument = (cols[idx.instrument] || "").trim();

      // Only NSE equity and index instruments
      if (exchange !== "NSE") continue;
      if (segment !== "E" && segment !== "I") continue;
      if (instrument !== "EQUITY" && instrument !== "INDEX") continue;

      const secId = (cols[idx.securityId] || "").trim();
      const tradingSym = (cols[idx.tradingSymbol] || "").trim();
      const lot = parseInt(cols[idx.lotSize] || "1") || 1;

      // Use trading symbol (e.g. "RELIANCE", "TCS") — NOT custom symbol
      const sym = tradingSym.replace(/-EQ$/i, "").trim();

      if (!sym || !secId) continue;

      // If target set provided, only keep matching symbols
      if (targetSymbols && !targetSymbols.has(sym)) continue;

      map.set(sym, {
        securityId: secId,
        tradingSymbol: tradingSym,
        segment,
        instrumentName: instrument,
        lotSize: lot,
      });
    }

    scripMap = map;
    cacheTime = Date.now();
    console.log(`[DhanScripCache] Loaded ${map.size} NSE equity/index scrips`);
  } catch (err) {
    console.error(`[DhanScripCache] Error:`, err);
    // Return partial/stale cache if available
    if (scripMap) return scripMap;
  }

  return map;
}

// Lookup single symbol
export async function getDhanSecurityId(symbol: string): Promise<string | null> {
  const map = await getDhanScripMap();
  return map.get(symbol)?.securityId || null;
}

// Batch lookup: returns { symbol → securityId }
export async function batchLookupSecurityIds(
  symbols: string[]
): Promise<Map<string, string>> {
  const targetSet = new Set(symbols);
  const map = await getDhanScripMap(targetSet);
  const result = new Map<string, string>();
  for (const sym of symbols) {
    const scrip = map.get(sym);
    if (scrip) result.set(sym, scrip.securityId);
  }
  return result;
}

// ── Option contract security ID lookup ──
// Resolves e.g. ("NIFTY", 22750, "CE", "2026-04-03") → Dhan security ID

let fnoMap: Map<string, DhanScrip> | null = null;
let fnoCacheTime = 0;

export async function getFnoScripMap(): Promise<Map<string, DhanScrip>> {
  if (fnoMap && Date.now() - fnoCacheTime < CACHE_TTL) return fnoMap;

  const map = new Map<string, DhanScrip>();

  try {
    const res = await fetch(SCRIP_MASTER_URL, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Scrip master fetch failed: ${res.status}`);

    const text = await res.text();
    const lines = text.split("\n");
    if (lines.length < 2) throw new Error("Empty scrip master");

    const idx = resolveColumns(lines[0]);
    if (!idx) throw new Error("Cannot parse scrip master header");

    // Also need: expiry date, strike, option type columns
    const header = lines[0].split(",").map(c => c.trim().toUpperCase());
    const expiryIdx = header.findIndex(c => c === "SEM_EXPIRY_DATE" || c.includes("EXPIRY_DATE"));
    const strikeIdx = header.findIndex(c => c.includes("STRIKE"));
    const optTypeIdx = header.findIndex(c => c.includes("OPTION_TYPE") || c === "SEM_OPTION_TYPE");

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const cols = line.split(",");
      const exchange = (cols[idx.exchange] || "").trim();
      const instrument = (cols[idx.instrument] || "").trim();

      // Only NSE F&O option contracts
      if (exchange !== "NSE") continue;
      if (!instrument.includes("OPT")) continue; // OPTSTK, OPTIDX

      const secId = (cols[idx.securityId] || "").trim();
      const tradingSym = (cols[idx.tradingSymbol] || "").trim();
      const lot = parseInt(cols[idx.lotSize] || "1") || 1;
      const expiry = expiryIdx >= 0 ? (cols[expiryIdx] || "").trim() : "";
      const strike = strikeIdx >= 0 ? parseFloat(cols[strikeIdx] || "0") : 0;
      const optType = optTypeIdx >= 0 ? (cols[optTypeIdx] || "").trim() : "";

      if (!secId || !strike) continue;

      // Extract underlying symbol from trading symbol: "NIFTY-Apr2026-22800-CE" → "NIFTY"
      const sym = tradingSym.split("-")[0].trim();
      if (!sym) continue;

      // Normalize expiry to YYYY-MM-DD format
      const expiryDate = expiry.includes(" ") ? expiry.split(" ")[0] : expiry;

      // Build lookup key: "NIFTY|22800|CE|2026-04-07"
      const key = `${sym}|${strike}|${optType}|${expiryDate}`;

      map.set(key, {
        securityId: secId,
        tradingSymbol: tradingSym,
        segment: "D",
        instrumentName: instrument,
        lotSize: lot,
      });

      // Also store without expiry for "nearest" matching
      const keyNoExp = `${sym}|${strike}|${optType}`;
      if (!map.has(keyNoExp)) {
        map.set(keyNoExp, {
          securityId: secId,
          tradingSymbol: tradingSym,
          segment: "D",
          instrumentName: instrument,
          lotSize: lot,
        });
      }
    }

    fnoMap = map;
    fnoCacheTime = Date.now();
    console.log(`[DhanScripCache] Loaded ${map.size} F&O option contracts`);
  } catch (err) {
    console.error(`[DhanScripCache] FnO error:`, err);
    if (fnoMap) return fnoMap;
  }

  return map;
}

/**
 * Resolve the Dhan security ID for a specific option contract.
 * @param underlying - e.g. "NIFTY", "RELIANCE"
 * @param strike - e.g. 22750
 * @param optionType - "CE" or "PE"
 * @param expiry - optional, e.g. "2026-04-03". If omitted, returns nearest.
 */
export async function getOptionSecurityId(
  underlying: string,
  strike: number,
  optionType: string,
  expiry?: string,
): Promise<{ securityId: string; tradingSymbol: string; lotSize: number } | null> {
  const map = await getFnoScripMap();

  // Try with expiry first
  if (expiry) {
    const key = `${underlying}|${strike}|${optionType}|${expiry}`;
    const scrip = map.get(key);
    if (scrip) return { securityId: scrip.securityId, tradingSymbol: scrip.tradingSymbol, lotSize: scrip.lotSize };
  }

  // Fallback: match without expiry (nearest)
  const keyNoExp = `${underlying}|${strike}|${optionType}`;
  const scrip = map.get(keyNoExp);
  if (scrip) return { securityId: scrip.securityId, tradingSymbol: scrip.tradingSymbol, lotSize: scrip.lotSize };

  return null;
}

// Clear cache (for testing/refresh)
export function clearScripCache() {
  scripMap = null;
  cacheTime = 0;
  fnoMap = null;
  fnoCacheTime = 0;
}
