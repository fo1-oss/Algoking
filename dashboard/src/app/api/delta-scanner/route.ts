import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const DELTA_BASE = "https://api.india.delta.exchange";
const TELEGRAM_BOT = "8440970690:AAFOHoVTCw6Gyx4Mla7Q4pOUnfzeb8fDDoE";
const TELEGRAM_CHAT = "6776228988";

const API_KEY = process.env.DELTA_API_KEY || "0LotjhrNCvz27CNibX16e4kBBpQazY";
const API_SECRET = process.env.DELTA_API_SECRET || "IhbhQiAEfjbRDV85PqtySltKuJHzMlPUVbewa9ronkGhItWOUCoPuSwmDtZG";

// ── Helpers ──
async function deltaGet(path: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = "GET" + timestamp + path;
  const signature = crypto.createHmac("sha256", API_SECRET).update(message).digest("hex");
  const res = await fetch(`${DELTA_BASE}${path}`, {
    headers: { "api-key": API_KEY, signature, timestamp, "User-Agent": "AlgoKing/1.0" },
    cache: "no-store",
  });
  return res.json();
}

async function deltaPost(path: string, body: Record<string, unknown>) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyStr = JSON.stringify(body);
  const message = "POST" + timestamp + path + bodyStr;
  const signature = crypto.createHmac("sha256", API_SECRET).update(message).digest("hex");
  const res = await fetch(`${DELTA_BASE}${path}`, {
    method: "POST",
    headers: { "api-key": API_KEY, signature, timestamp, "Content-Type": "application/json", "User-Agent": "AlgoKing/1.0" },
    body: bodyStr,
    cache: "no-store",
  });
  return res.json();
}

async function sendTelegram(text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text, parse_mode: "Markdown", disable_web_page_preview: true }),
  });
}

/**
 * GET /api/delta-scanner?action=scan
 * Scans BTC options, finds cheap 0-1 DTE options, checks BTC momentum,
 * and either alerts or auto-executes based on criteria.
 */
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action") || "scan";
  const autoExecute = req.nextUrl.searchParams.get("auto") === "true";

  try {
    if (action === "scan") {
      // ── 1. Get BTC spot price ──
      const futures = await fetch(`${DELTA_BASE}/v2/tickers?contract_types=perpetual_futures&underlying_asset_symbols=BTC`, {
        headers: { "User-Agent": "AlgoKing/1.0" }, cache: "no-store",
      }).then(r => r.json());

      const btcPerp = futures.result?.[0];
      const btcPrice = btcPerp ? parseFloat(btcPerp.mark_price) : 0;
      const btc24hChange = btcPerp ? parseFloat(btcPerp.price_change_24h || "0") : 0;

      if (!btcPrice) {
        return NextResponse.json({ error: "Could not fetch BTC price" });
      }

      // ── 2. Get all BTC options ──
      // Scan ALL crypto assets — BTC, ETH, SOL, etc.
      const cryptos = ["BTC", "ETH"];
      const allOptions: OptionTicker[] = [];

      for (const asset of cryptos) {
        try {
          const options = await fetch(`${DELTA_BASE}/v2/tickers?contract_types=call_options,put_options&underlying_asset_symbols=${asset}`, {
            headers: { "User-Agent": "AlgoKing/1.0" }, cache: "no-store",
          }).then(r => r.json());
          if (options.result) allOptions.push(...options.result);
        } catch { /* skip */ }
      }

      // Also get ETH spot
      let ethPrice = 0;
      try {
        const ethFutures = await fetch(`${DELTA_BASE}/v2/tickers?contract_types=perpetual_futures&underlying_asset_symbols=ETH`, {
          headers: { "User-Agent": "AlgoKing/1.0" }, cache: "no-store",
        }).then(r => r.json());
        ethPrice = ethFutures.result?.[0] ? parseFloat(ethFutures.result[0].mark_price) : 0;
      } catch { /* */ }

      // ── 3. Filter for cheap options with liquidity ──
      type OptionTicker = {
        symbol: string;
        product_id?: number;
        id?: number;
        best_ask?: string;
        best_bid?: string;
        mark_price?: string;
        oi?: string;
        volume?: number;
        greeks?: { delta?: string; gamma?: string; theta?: string; vega?: string; iv?: string };
      };

      const cheap = allOptions
        .filter((o: OptionTicker) => {
          const ask = parseFloat(o.best_ask || "0");
          const bid = parseFloat(o.best_bid || "0");
          return ask > 0 && ask <= 50 && bid > 0; // Options under $50 with actual bid
        })
        .map((o: OptionTicker) => ({
          symbol: o.symbol,
          productId: o.product_id || o.id,
          ask: parseFloat(o.best_ask || "0"),
          bid: parseFloat(o.best_bid || "0"),
          mark: parseFloat(o.mark_price || "0"),
          oi: parseFloat(o.oi || "0"),
          volume: o.volume || 0,
          type: o.symbol?.startsWith("C-") ? "CALL" : "PUT",
          strike: parseInt(o.symbol?.split("-")[2] || "0"),
          expiry: o.symbol?.split("-")[3] || "",
          delta: parseFloat(o.greeks?.delta || "0"),
          iv: parseFloat(o.greeks?.iv || "0"),
        }))
        .sort((a: { ask: number }, b: { ask: number }) => a.ask - b.ask);

      // ── 4. Determine bias ──
      const bias = btc24hChange > 2 ? "BULLISH" : btc24hChange < -2 ? "BEARISH" : "NEUTRAL";
      const isBigMove = Math.abs(btc24hChange) > 2;

      // ── 5. Select best trades ──
      const lotteryTickets = cheap.filter((o: { ask: number }) => o.ask <= 5);
      const directional = cheap.filter((o: { ask: number; type: string }) => {
        if (bias === "BULLISH") return o.type === "CALL" && o.ask <= 30;
        if (bias === "BEARISH") return o.type === "PUT" && o.ask <= 30;
        return o.ask <= 20;
      });

      // ── 6. Build response ──
      const result = {
        btcPrice,
        ethPrice,
        btc24hChange,
        bias,
        isBigMove,
        totalOptions: allOptions.length,
        cheapOptions: cheap.length,
        lotteryTickets: lotteryTickets.slice(0, 10),
        directionalPicks: directional.slice(0, 5),
        cryptosScanned: ["BTC", "ETH"],
        timestamp: Date.now(),
      };

      // ── 7. Alert on Telegram if big move detected ──
      if (isBigMove && (lotteryTickets.length > 0 || directional.length > 0)) {
        const emoji = bias === "BULLISH" ? "🟢" : bias === "BEARISH" ? "🔴" : "🟡";
        const picks = directional.slice(0, 3);
        const pickLines = picks.map((p: { symbol: string; ask: number; strike: number }) =>
          `  ${p.symbol} | Ask: $${p.ask} | Strike: $${p.strike.toLocaleString()}`
        ).join("\n");

        const msg = [
          `${emoji} *BTC OPTIONS ALERT*`,
          ``,
          `BTC: $${btcPrice.toLocaleString()} (${btc24hChange >= 0 ? "+" : ""}${btc24hChange.toFixed(1)}%)`,
          `Bias: *${bias}*`,
          ``,
          `🎯 *Top Picks:*`,
          pickLines || "  No options with bid/ask right now",
          ``,
          lotteryTickets.length > 0 ? `🎰 *Lottery Tickets (< $5):* ${lotteryTickets.length} available` : "",
          ``,
          autoExecute ? `⚡ *AUTO-EXECUTE: ON*` : `💡 Execute via localhost:3000`,
        ].filter(Boolean).join("\n");

        await sendTelegram(msg);

        // ── 8. Auto-execute if enabled ──
        if (autoExecute && picks.length > 0) {
          const pick = picks[0];
          const size = Math.floor(10 / pick.ask); // Spend ~$10 per trade
          if (size >= 1 && pick.productId) {
            const order = await deltaPost("/v2/orders/bracket", {
              product_id: pick.productId,
              size,
              side: "buy",
              order_type: "market_order",
              time_in_force: "ioc",
              bracket_take_profit_price: String(pick.ask * 3), // 3x target
              bracket_stop_loss_price: String(Math.max(pick.ask * 0.3, 0.1)), // 70% SL
              client_order_id: `algoking_auto_${Date.now()}`,
            });

            await sendTelegram([
              `⚡ *AUTO-EXECUTED*`,
              ``,
              `📊 ${pick.symbol}`,
              `📦 Size: ${size} contracts`,
              `💰 Cost: ~$${(size * pick.ask).toFixed(2)}`,
              `🎯 TP: $${(pick.ask * 3).toFixed(2)} (3x)`,
              `🛑 SL: $${Math.max(pick.ask * 0.3, 0.1).toFixed(2)} (70% loss)`,
              ``,
              `Order: ${JSON.stringify(order).slice(0, 200)}`,
            ].join("\n"));

            return NextResponse.json({ ...result, autoExecuted: true, order });
          }
        }
      }

      return NextResponse.json(result);
    }

    return NextResponse.json({ actions: ["scan"] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
