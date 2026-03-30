import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8440970690:AAFOHoVTCw6Gyx4Mla7Q4pOUnfzeb8fDDoE";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "6776228988";
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const DASHBOARD_URL = "https://algomaster-pro.vercel.app";

// ── Helper: send message ──
async function sendTg(text: string, parseMode = "Markdown") {
  const res = await fetch(`${API_BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: parseMode, disable_web_page_preview: true }),
  });
  return res.json();
}

// ── Helper: fetch from our own API ──
async function selfFetch(path: string, body?: Record<string, unknown>) {
  const url = `${DASHBOARD_URL}${path}`;
  const opts: RequestInit = { cache: "no-store" };
  if (body) {
    opts.method = "POST";
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  return res.json();
}

// ══════════════════════════════════════════════════════════════════
// GET — setup webhook + status
// ══════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");

  if (action === "setup-webhook") {
    const webhookUrl = `${DASHBOARD_URL}/api/telegram`;
    const res = await fetch(`${API_BASE}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message"] }),
    });
    const data = await res.json();
    return NextResponse.json({ webhook: webhookUrl, ...data });
  }

  if (action === "remove-webhook") {
    const res = await fetch(`${API_BASE}/deleteWebhook`, { method: "POST" });
    const data = await res.json();
    return NextResponse.json(data);
  }

  if (action === "status") {
    const res = await fetch(`${API_BASE}/getWebhookInfo`);
    const data = await res.json();
    return NextResponse.json(data);
  }

  return NextResponse.json({ actions: ["setup-webhook", "remove-webhook", "status"] });
}

// ══════════════════════════════════════════════════════════════════
// POST — handles both internal actions AND Telegram webhook
// ══════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const body = await req.json();

  // ── Telegram Webhook (incoming message from user) ──
  if (body.update_id && body.message) {
    const msg = body.message;
    const text = (msg.text || "").trim();
    const chatId = msg.chat?.id;

    // Only respond to our chat
    if (String(chatId) !== CHAT_ID) {
      return NextResponse.json({ ok: true });
    }

    await handleCommand(text);
    return NextResponse.json({ ok: true });
  }

  // ── Internal API actions (from dashboard) ──
  const action = body.action as string;

  try {
    switch (action) {
      case "trade-alert": {
        const { strategy, market, direction, entry, sl, tp, mcScore, probProfit, confidence } = body;
        const dirEmoji = direction === "LONG" ? "🔼" : "🔽";
        const confEmoji = confidence === "HIGH" ? "⚡" : confidence === "MEDIUM" ? "🔶" : "⚪";
        const message = `👑 *AlgoKing Signal*\n\n🎯 *High Probability Trade*\n\n📊 Strategy: ${strategy}\n📈 Market: ${market}\n${dirEmoji} Direction: ${direction}\n\n💰 Entry: ₹${Number(entry).toLocaleString()}\n🛑 SL: ₹${Number(sl).toLocaleString()}\n🎯 TP: ₹${Number(tp).toLocaleString()}\n\n📊 MC Score: ${mcScore}\n📈 P(profit): ${probProfit}%\n${confEmoji} Confidence: ${confidence}\n\n_Trade the process, not the P&L._`;
        const data = await sendTg(message);
        return NextResponse.json({ sent: data.ok });
      }

      case "send": {
        const data = await sendTg(body.message, body.parseMode || "Markdown");
        return NextResponse.json({ sent: data.ok });
      }

      case "morning-reminder": {
        const message = `🌅 *Good Morning, Kunaal!*\n\n⏰ Time to update your Dhan API token.\n\n1️⃣ Login to api.dhan.co\n2️⃣ Generate new access token\n3️⃣ Dashboard → Workflows → Connect Dhan\n4️⃣ Client ID: \`b1e4d838\`\n\nOr run: \`python3 dhan_auto_login.py\`\n\n🔗 [Open Dashboard](${DASHBOARD_URL})`;
        const data = await sendTg(message);
        return NextResponse.json({ sent: data.ok });
      }

      case "order-executed": {
        const { orderId, symbol, side, qty, price, broker } = body;
        const message = `✅ *Order Executed*\n\n🏦 Broker: ${broker || "Dhan"}\n📋 Order ID: \`${orderId}\`\n📊 ${symbol}\n${side === "BUY" ? "🟢" : "🔴"} ${side} × ${qty}\n💰 Price: ₹${Number(price).toLocaleString()}`;
        const data = await sendTg(message);
        return NextResponse.json({ sent: data.ok });
      }

      case "daily-summary": {
        const { totalPnl, trades, winRate, capital } = body;
        const pnlEmoji = totalPnl >= 0 ? "📈" : "📉";
        const message = `📊 *Daily Trading Summary*\n\n${pnlEmoji} P&L: ${totalPnl >= 0 ? "+" : ""}₹${Number(totalPnl).toLocaleString()}\n📋 Trades: ${trades}\n🎯 Win Rate: ${winRate}%\n💰 Capital: ₹${Number(capital).toLocaleString()}\n\n_Keep compounding. 5L → 50L._`;
        const data = await sendTg(message);
        return NextResponse.json({ sent: data.ok });
      }

      default:
        return NextResponse.json({ error: "Unknown action", actions: ["trade-alert", "send", "morning-reminder", "order-executed", "daily-summary"] }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════════════
// COMMAND HANDLER — processes Telegram messages from user
// ══════════════════════════════════════════════════════════════════

async function handleCommand(text: string) {
  const cmd = text.toLowerCase().split(" ")[0];

  switch (cmd) {
    case "/start":
    case "/help": {
      await sendTg([
        `👑 *AlgoKing Bot*`,
        ``,
        `Available commands:`,
        ``,
        `/status — Dashboard & Dhan connection status`,
        `/positions — Open positions on Dhan`,
        `/orders — Today's orders on Dhan`,
        `/funds — Account balance & margins`,
        `/pnl — Today's P&L`,
        `/signals — Latest algo signals`,
        `/market — NIFTY, BANKNIFTY, key levels`,
        `/deploy — Deploy workflow (coming soon)`,
        `/squareoff — Square off all positions`,
        ``,
        `🔗 [Open Dashboard](${DASHBOARD_URL})`,
      ].join("\n"));
      break;
    }

    case "/status": {
      try {
        const dhan = await selfFetch("/api/dhan?action=status");
        const dhanStatus = dhan.connected ? `✅ Connected (${dhan.clientId})` : `❌ Not connected`;

        await sendTg([
          `📊 *System Status*`,
          ``,
          `🏦 Dhan: ${dhanStatus}`,
          `🌐 Dashboard: ✅ Online`,
          `🔗 [Open Dashboard](${DASHBOARD_URL})`,
        ].join("\n"));
      } catch {
        await sendTg("⚠️ Could not reach dashboard. Is it running?");
      }
      break;
    }

    case "/positions": {
      try {
        const data = await selfFetch("/api/dhan?action=positions");
        if (Array.isArray(data) && data.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const openPositions = data.filter((p: any) => p.netQty && p.netQty !== 0);
          if (openPositions.length === 0) {
            await sendTg("📋 No open positions.");
            break;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const lines = openPositions.map((p: any) =>
            `${p.netQty > 0 ? "🟢" : "🔴"} ${p.tradingSymbol || p.securityId} | Qty: ${p.netQty} | P&L: ₹${(p.realizedProfit || 0 + p.unrealizedProfit || 0).toLocaleString()}`
          );
          await sendTg(`📋 *Open Positions (${openPositions.length})*\n\n${lines.join("\n")}`);
        } else {
          await sendTg("📋 No open positions. " + (data?.error ? `(${data.error})` : ""));
        }
      } catch {
        await sendTg("⚠️ Dhan not connected. Update token first.");
      }
      break;
    }

    case "/orders": {
      try {
        const data = await selfFetch("/api/dhan?action=orders");
        if (Array.isArray(data) && data.length > 0) {
          const recent = data.slice(-5);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const lines = recent.map((o: any) =>
            `${o.transactionType === "BUY" ? "🟢" : "🔴"} ${o.tradingSymbol || o.securityId} | ${o.transactionType} × ${o.quantity} | ${o.orderStatus}`
          );
          await sendTg(`📋 *Recent Orders (${data.length} today)*\n\n${lines.join("\n")}`);
        } else {
          await sendTg("📋 No orders today. " + (data?.error ? `(${data.error})` : ""));
        }
      } catch {
        await sendTg("⚠️ Dhan not connected.");
      }
      break;
    }

    case "/funds": {
      try {
        const data = await selfFetch("/api/dhan?action=funds");
        if (data && !data.error) {
          const avail = data.availabelBalance || data.availableBalance || data.sodLimit || "N/A";
          const used = data.utilizedAmount || data.usedMargin || "N/A";
          await sendTg(`💰 *Account Funds*\n\n💵 Available: ₹${Number(avail).toLocaleString()}\n📊 Used: ₹${Number(used).toLocaleString()}`);
        } else {
          await sendTg("⚠️ Dhan not connected. " + (data?.error || ""));
        }
      } catch {
        await sendTg("⚠️ Dhan not connected.");
      }
      break;
    }

    case "/pnl": {
      try {
        const data = await selfFetch("/api/dhan?action=positions");
        if (Array.isArray(data)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const totalPnl = data.reduce((s: number, p: any) => s + (p.realizedProfit || 0) + (p.unrealizedProfit || 0), 0);
          const pnlEmoji = totalPnl >= 0 ? "📈" : "📉";
          await sendTg(`${pnlEmoji} *Today's P&L*\n\n💰 ${totalPnl >= 0 ? "+" : ""}₹${totalPnl.toLocaleString()}\n📋 Positions: ${data.length}`);
        } else {
          await sendTg("⚠️ Dhan not connected.");
        }
      } catch {
        await sendTg("⚠️ Dhan not connected.");
      }
      break;
    }

    case "/market": {
      try {
        const symbols = "^NSEI,^NSEBANK,^VIX";
        const data = await selfFetch(`/api/prices?symbols=${encodeURIComponent(symbols)}`);
        if (data.quotes?.length) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const lines = data.quotes.map((q: any) => {
            const emoji = q.changePct >= 0 ? "🟢" : "🔴";
            return `${emoji} *${q.displayName || q.symbol}*: ${q.price.toLocaleString()} (${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%)`;
          });
          await sendTg(`📊 *Market Overview*\n\n${lines.join("\n")}`);
        } else {
          await sendTg("⚠️ Could not fetch market data.");
        }
      } catch {
        await sendTg("⚠️ Market data unavailable.");
      }
      break;
    }

    case "/signals": {
      await sendTg(`🎯 *Algo Signals*\n\nSignals are generated when the Mother Algo runs during market hours.\n\nCheck the dashboard for live signals:\n🔗 [Signals Panel](${DASHBOARD_URL})`);
      break;
    }

    case "/squareoff": {
      try {
        const data = await selfFetch("/api/dhan", { action: "square-off-all" });
        await sendTg(`🔴 *Square Off*\n\n${data.message || "Sent square-off request."}\nPositions closed: ${data.squaredOff || 0}`);
      } catch {
        await sendTg("⚠️ Dhan not connected. Cannot square off.");
      }
      break;
    }

    default: {
      if (text.startsWith("/")) {
        await sendTg(`❓ Unknown command: \`${cmd}\`\n\nType /help for available commands.`);
        break;
      }

      // ── Natural language → AI Chat ──
      await sendTg("🤔 _Thinking..._");
      try {
        const chatRes = await fetch(`${DASHBOARD_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: text }],
          }),
        });

        if (chatRes.ok) {
          const chatData = await chatRes.json();
          if (chatData.response && !chatData.error) {
            // Telegram has 4096 char limit — split if needed
            const response = chatData.response as string;
            if (response.length <= 4000) {
              await sendTg(response);
            } else {
              // Split into chunks
              const chunks = response.match(/[\s\S]{1,4000}/g) || [response];
              for (const chunk of chunks) {
                await sendTg(chunk);
              }
            }
          } else {
            await sendTg(chatData.response || "⚠️ AI not available. Set ANTHROPIC\\_API\\_KEY in Vercel env vars.");
          }
        } else {
          await sendTg("⚠️ Could not reach AI chat. Dashboard may be down.");
        }
      } catch (err) {
        await sendTg(`⚠️ Error: ${String(err).slice(0, 200)}`);
      }
      break;
    }
  }
}
