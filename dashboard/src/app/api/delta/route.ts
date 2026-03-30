import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const DELTA_BASE = "https://api.india.delta.exchange";

let deltaApiKey = process.env.DELTA_API_KEY || "";
let deltaApiSecret = process.env.DELTA_API_SECRET || "";

// ── Signature generator ──
function signRequest(method: string, path: string, body: string, timestamp: string): string {
  // Delta India format: method + timestamp + path + query + body
  const message = method.toUpperCase() + timestamp + path + body;
  return crypto.createHmac("sha256", deltaApiSecret).update(message).digest("hex");
}

// ── Delta Exchange request helper ──
async function deltaRequest(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: unknown
): Promise<{ ok: boolean; status: number; data: unknown }> {
  if (!deltaApiKey || !deltaApiSecret) {
    return { ok: false, status: 401, data: { error: "Delta Exchange not connected" } };
  }

  // Split path and query for signature
  const [pathOnly, queryStr] = path.split("?");
  const fullPath = queryStr ? `${pathOnly}?${queryStr}` : pathOnly;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyStr = body ? JSON.stringify(body) : "";

  // Delta signature: method + timestamp + path (with query) + body
  const message = method.toUpperCase() + timestamp + fullPath + bodyStr;
  const signature = crypto.createHmac("sha256", deltaApiSecret).update(message).digest("hex");

  const headers: Record<string, string> = {
    "api-key": deltaApiKey,
    "signature": signature,
    "timestamp": timestamp,
    "Content-Type": "application/json",
    "User-Agent": "AlgoKing/1.0",
  };

  try {
    const res = await fetch(`${DELTA_BASE}${fullPath}`, {
      method,
      headers,
      body: method !== "GET" ? bodyStr : undefined,
      cache: "no-store",
    });

    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("json") ? await res.json() : { message: await res.text() };
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 500, data: { error: String(err) } };
  }
}

// ── GET handler ──
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");

  try {
    switch (action) {
      case "status":
        return NextResponse.json({ connected: !!(deltaApiKey && deltaApiSecret), broker: "delta-exchange-india" });

      case "wallet": {
        const r = await deltaRequest("/v2/wallet");
        return NextResponse.json(r.data, { status: r.status });
      }

      case "positions": {
        const r = await deltaRequest("/v2/positions/margined");
        return NextResponse.json(r.data, { status: r.status });
      }

      case "orders": {
        const r = await deltaRequest("/v2/orders");
        return NextResponse.json(r.data, { status: r.status });
      }

      case "products": {
        const type = req.nextUrl.searchParams.get("type") || "call_options,put_options";
        const underlying = req.nextUrl.searchParams.get("underlying") || "BTC";
        const expiry = req.nextUrl.searchParams.get("expiry") || "";
        let path = `/v2/tickers?contract_types=${type}&underlying_asset_symbols=${underlying}`;
        if (expiry) path += `&expiry_date=${expiry}`;
        const r = await deltaRequest(path);
        return NextResponse.json(r.data, { status: r.status });
      }

      case "ticker": {
        const symbol = req.nextUrl.searchParams.get("symbol") || "";
        const r = await deltaRequest(symbol ? `/v2/tickers/${symbol}` : "/v2/tickers");
        return NextResponse.json(r.data, { status: r.status });
      }

      default:
        return NextResponse.json({ actions: ["status", "wallet", "positions", "orders", "products", "ticker"] });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── POST handler ──
export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action as string;

  try {
    switch (action) {
      // ── Connect ──
      case "set-token": {
        deltaApiKey = body.apiKey || body.accessToken || "";
        deltaApiSecret = body.apiSecret || "";
        // Verify by fetching wallet balances
        const verify = await deltaRequest("/v2/wallet/balances");
        if (verify.ok) {
          return NextResponse.json({ connected: true, message: "Delta Exchange connected", wallet: verify.data });
        }
        // Try profile as fallback
        const profileVerify = await deltaRequest("/v2/profile");
        if (profileVerify.ok) {
          return NextResponse.json({ connected: true, message: "Delta Exchange connected", profile: profileVerify.data });
        }
        deltaApiKey = "";
        deltaApiSecret = "";
        return NextResponse.json({ connected: false, error: "Invalid credentials", details: verify.data }, { status: 401 });
      }

      case "disconnect": {
        deltaApiKey = "";
        deltaApiSecret = "";
        return NextResponse.json({ connected: false });
      }

      // ── Place Order ──
      case "place-order": {
        const order = {
          product_id: body.productId,
          product_symbol: body.productSymbol,
          size: body.size || body.quantity || 1,
          side: body.side || "buy",
          order_type: body.orderType || "market_order",
          limit_price: body.limitPrice ? String(body.limitPrice) : undefined,
          time_in_force: body.timeInForce || "gtc",
          post_only: body.postOnly || false,
          reduce_only: body.reduceOnly || false,
          client_order_id: body.clientOrderId || `algoking_${Date.now()}`,
        };
        const r = await deltaRequest("/v2/orders", "POST", order);
        return NextResponse.json({ success: r.ok, ...r.data as object, broker: "delta" }, { status: r.status });
      }

      // ── Place Bracket Order (entry + SL + TP) ──
      case "place-bracket-order": {
        const bracketOrder = {
          product_id: body.productId,
          product_symbol: body.productSymbol,
          size: body.size || 1,
          side: body.side || "buy",
          order_type: body.orderType || "market_order",
          limit_price: body.limitPrice ? String(body.limitPrice) : undefined,
          time_in_force: body.timeInForce || "gtc",
          bracket_stop_loss_price: body.stopLossPrice ? String(body.stopLossPrice) : undefined,
          bracket_take_profit_price: body.takeProfitPrice ? String(body.takeProfitPrice) : undefined,
          bracket_stop_trigger_method: body.triggerMethod || "last_traded_price",
          bracket_trail_amount: body.trailAmount ? String(body.trailAmount) : undefined,
          client_order_id: body.clientOrderId || `algoking_bracket_${Date.now()}`,
        };
        const r = await deltaRequest("/v2/orders/bracket", "POST", bracketOrder);
        return NextResponse.json({ success: r.ok, ...r.data as object, broker: "delta", orderType: "BRACKET" }, { status: r.status });
      }

      // ── Modify Order ──
      case "modify-order": {
        const mod = {
          id: body.orderId,
          product_id: body.productId,
          size: body.size,
          limit_price: body.limitPrice ? String(body.limitPrice) : undefined,
        };
        const r = await deltaRequest("/v2/orders", "PUT", mod);
        return NextResponse.json({ success: r.ok, ...r.data as object }, { status: r.status });
      }

      // ── Cancel Order ──
      case "cancel-order": {
        const r = await deltaRequest("/v2/orders", "DELETE", {
          id: body.orderId,
          product_id: body.productId,
        });
        return NextResponse.json({ success: r.ok, ...r.data as object }, { status: r.status });
      }

      // ── Cancel All ──
      case "cancel-all": {
        const r = await deltaRequest("/v2/orders/all", "DELETE", {
          product_id: body.productId,
        });
        return NextResponse.json({ success: r.ok, ...r.data as object }, { status: r.status });
      }

      // ── Close Position ──
      case "close-position": {
        const r = await deltaRequest("/v2/positions/close", "POST", {
          product_id: body.productId,
          close_all_portfolio_options: body.closeAll || false,
        });
        return NextResponse.json({ success: r.ok, ...r.data as object }, { status: r.status });
      }

      // ── Get Option Chain ──
      case "option-chain": {
        const underlying = body.underlying || "BTC";
        const expiry = body.expiry || "";
        const types = body.types || "call_options,put_options";
        let path = `/v2/tickers?contract_types=${types}&underlying_asset_symbols=${underlying}`;
        if (expiry) path += `&expiry_date=${expiry}`;
        const r = await deltaRequest(path);
        return NextResponse.json(r.data, { status: r.status });
      }

      default:
        return NextResponse.json({
          error: "Unknown action",
          actions: [
            "set-token", "disconnect",
            "place-order", "place-bracket-order", "modify-order", "cancel-order", "cancel-all",
            "close-position", "option-chain",
          ],
        }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
