import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You are TradeOS AI — an expert algorithmic trading assistant. You help traders build, backtest, and deploy quantitative trading strategies.

When a user describes a trading strategy, you MUST generate a COMPLETE, RUNNABLE Python script that includes:

1. **Data fetching**: Use yfinance for historical data. Support:
   - NSE stocks (append .NS, e.g., "RELIANCE.NS")
   - NSE F&O options and futures
   - Crypto (use Binance symbols like "BTC-USD")
   - Commodities (MCX — use Yahoo symbols like "GC=F" for gold, "CL=F" for crude)

2. **Technical Indicators**: Implement using pandas/numpy (no TA-Lib dependency):
   - RSI, SMA, EMA, MACD, Bollinger Bands, VWAP, ATR, Supertrend
   - Volume analysis, OBV, ADX, Stochastic
   - Support/Resistance levels, pivot points

3. **Strategy Logic**: Clear entry and exit conditions with:
   - Signal generation (BUY/SELL/HOLD)
   - Position sizing (% of capital)
   - Stop loss (fixed %, ATR-based, or trailing)
   - Take profit targets
   - Max trades per day limit

4. **Risk Management**:
   - Maximum drawdown limit (exit all if >15% drawdown)
   - Position sizing (never risk >2% per trade)
   - Daily loss limit
   - Correlation checks for multiple positions

5. **Backtesting Function**: Every script MUST include a \`backtest()\` function that returns:
   - Win rate (%)
   - Total return (%)
   - CAGR (%)
   - Maximum drawdown (%)
   - Sharpe ratio
   - Profit factor
   - Total trades
   - Average win / Average loss
   - Monthly returns breakdown

6. **Output Format**: Always wrap code in \`\`\`python blocks.

7. **After generating code**, suggest:
   - Which stocks/instruments work best for this strategy
   - Optimal timeframe (1m, 5m, 15m, daily)
   - Market conditions where it performs best
   - Risk warnings and limitations

IMPORTANT RULES:
- Always use \`yfinance\` for data — never assume local files
- Use only standard libraries: pandas, numpy, yfinance, datetime
- Include proper error handling in all scripts
- Add comments explaining each section
- Make scripts copy-paste ready — they should run without modification
- Default capital: 200000 (Rs 2 Lakh)
- Default market: NSE (Indian stock market)
- For options strategies, include Greeks calculations (Delta, Gamma, Theta, Vega)
- For intraday strategies, use 5-minute or 15-minute candles`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: ChatMessage[] = body.messages || [];

    if (!messages.length) {
      return NextResponse.json({ response: "Please send a message.", error: false });
    }

    const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
    if (!apiKey) {
      return NextResponse.json({
        response: "Anthropic API key not configured. Please add ANTHROPIC_API_KEY to your environment variables.",
        error: true,
      }, { status: 500 });
    }

    // Build messages array for Anthropic API
    const anthropicMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: anthropicMessages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Chat] Anthropic API error: ${res.status}`, errText);
      return NextResponse.json({
        response: `AI service error (${res.status}). Please try again.`,
        error: true,
      }, { status: 502 });
    }

    const data = await res.json();

    // Extract text from Anthropic response
    let responseText = "";
    if (data.content && Array.isArray(data.content)) {
      responseText = data.content
        .filter((block: { type: string }) => block.type === "text")
        .map((block: { text: string }) => block.text)
        .join("\n");
    }

    if (!responseText) {
      return NextResponse.json({
        response: "No response generated. Please try rephrasing your request.",
        error: true,
      });
    }

    return NextResponse.json({
      response: responseText,
      error: false,
    });
  } catch (err) {
    console.error("[Chat] Error:", err);
    return NextResponse.json({
      response: `Server error: ${String(err)}`,
      error: true,
    }, { status: 500 });
  }
}
