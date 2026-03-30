const XLSX = require("xlsx");

// ═══ CONFIG ═══
const START_CAPITAL = 500000;
const TARGET_CAPITAL = 5000000;
const MONTHS = 9; // Apr 2026 – Dec 2026
const TRADING_DAYS_PER_MONTH = 22;
const RISK_PER_TRADE = 0.02; // 2%
const DAILY_LOSS_LIMIT = 0.05; // 5%
const WEEKLY_LOSS_LIMIT = 0.10; // 10%
const MAX_DRAWDOWN = 0.25; // 25%

const wb = XLSX.utils.book_new();

// ═══ SHEET 1: Monthly Growth Path ═══
const monthlyRate = Math.pow(TARGET_CAPITAL / START_CAPITAL, 1 / MONTHS) - 1;
const monthlyData = [
  ["Month", "Start Capital (₹)", "Target Return %", "Target Return (₹)", "End Capital (₹)", "Risk/Trade (₹)", "Daily Loss Limit (₹)", "BankNifty Lots", "Status"],
];
let capital = START_CAPITAL;
const months = ["Apr 2026", "May 2026", "Jun 2026", "Jul 2026", "Aug 2026", "Sep 2026", "Oct 2026", "Nov 2026", "Dec 2026"];
for (let i = 0; i < MONTHS; i++) {
  const ret = capital * monthlyRate;
  const endCap = capital + ret;
  const riskPerTrade = capital * RISK_PER_TRADE;
  const dailyLimit = capital * DAILY_LOSS_LIMIT;
  const lots = Math.max(1, Math.floor(riskPerTrade / 3000)); // ~₹3000 risk per BN lot
  monthlyData.push([
    months[i],
    Math.round(capital),
    +(monthlyRate * 100).toFixed(1),
    Math.round(ret),
    Math.round(endCap),
    Math.round(riskPerTrade),
    Math.round(dailyLimit),
    lots,
    i === 0 ? "START" : i === MONTHS - 1 ? "TARGET 🎯" : "",
  ]);
  capital = endCap;
}
const ws1 = XLSX.utils.aoa_to_sheet(monthlyData);
ws1["!cols"] = [{ wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 12 }];
XLSX.utils.book_append_sheet(wb, ws1, "Monthly Growth Path");

// ═══ SHEET 2: Weekly Targets ═══
const weeklyRate = Math.pow(TARGET_CAPITAL / START_CAPITAL, 1 / (MONTHS * 4.3)) - 1;
const weeklyData = [
  ["Week", "Start Capital (₹)", "Weekly Target %", "Weekly Target (₹)", "End Capital (₹)", "Cumulative Return %"],
];
capital = START_CAPITAL;
for (let w = 1; w <= Math.round(MONTHS * 4.3); w++) {
  const ret = capital * weeklyRate;
  const endCap = capital + ret;
  const cumReturn = ((endCap - START_CAPITAL) / START_CAPITAL) * 100;
  weeklyData.push([
    `Week ${w}`,
    Math.round(capital),
    +(weeklyRate * 100).toFixed(2),
    Math.round(ret),
    Math.round(endCap),
    +cumReturn.toFixed(1),
  ]);
  capital = endCap;
}
const ws2 = XLSX.utils.aoa_to_sheet(weeklyData);
ws2["!cols"] = [{ wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 18 }];
XLSX.utils.book_append_sheet(wb, ws2, "Weekly Targets");

// ═══ SHEET 3: Strategy Allocation ═══
const stratData = [
  ["Strategy", "Capital %", "Capital (₹)", "Avg Trades/Day", "Win Rate", "Avg R:R", "Monthly Edge", "Best Market", "Notes"],
  ["Fabervaale Triple-A Scalping", 40, 200000, 3, "55-65%", "2:1", "High freq, compounds fast", "NQ, BankNifty", "Absorption → Accumulation → Aggression"],
  ["ORB / Momentum Breakout", 30, 150000, 1, "50-58%", "2.5:1", "Fewer trades, big R:R", "BankNifty, Nifty", "First 15min range breakout"],
  ["Theta Decay (Short Straddle)", 20, 100000, 1, "65-75%", "1:1", "Consistent income", "Nifty Weekly", "Sell ATM, hedge with OTM wings"],
  ["Mean Reversion / VAH-VAL", 10, 50000, 1, "58-65%", "1.5:1", "Opportunistic", "BankNifty, Stocks", "Z-score > 2 + RSI extreme"],
];
const ws3 = XLSX.utils.aoa_to_sheet(stratData);
ws3["!cols"] = [{ wch: 28 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 24 }, { wch: 16 }, { wch: 40 }];
XLSX.utils.book_append_sheet(wb, ws3, "Strategy Allocation");

// ═══ SHEET 4: Risk Management Rules ═══
const riskData = [
  ["Rule", "Limit", "Action When Hit", "Why"],
  ["Max risk per trade", "2% of capital", "Cap position size", "One bad trade can't kill the account"],
  ["Max daily loss", "5% of capital", "STOP trading for the day", "Prevent tilt & revenge trading"],
  ["Max weekly loss", "10% of capital", "STOP trading for the week", "Preserve capital for next week"],
  ["Max total drawdown", "25% of peak", "PAUSE entire system", "Force review before continuing"],
  ["Max concurrent trades", "5 positions", "Queue new signals", "Don't over-leverage"],
  ["Max single position", "20% of capital", "Cap position size", "Diversification"],
  ["Min R:R ratio", "1.5:1", "Reject lower R:R trades", "Only take asymmetric bets"],
  ["Consecutive losses", "3 in a row", "Reduce size 10%/loss (floor 50%)", "Scale down when wrong"],
  ["No trading before", "9:30 AM IST", "Wait for ORB range", "Avoid gap volatility"],
  ["No new positions after", "2:30 PM IST (intraday)", "Exit only mode", "EOD squaring risk"],
  ["Stop loss", "NON-NEGOTIABLE", "Never move SL further away", "SL = insurance, always honored"],
  ["Revenge trading", "PROHIBITED", "Walk away after 3 losses", "Emotions = losses"],
];
const ws4 = XLSX.utils.aoa_to_sheet(riskData);
ws4["!cols"] = [{ wch: 24 }, { wch: 24 }, { wch: 30 }, { wch: 40 }];
XLSX.utils.book_append_sheet(wb, ws4, "Risk Rules");

// ═══ SHEET 5: Position Sizing Table ═══
const sizingData = [
  ["Capital Level (₹)", "2% Risk (₹)", "BankNifty Lots", "Nifty Lots", "Max Daily Loss (₹)", "Phase"],
  [500000, 10000, 1, 1, 25000, "Starting — prove the system"],
  [750000, 15000, 1, 1, 37500, "Building confidence"],
  [1000000, 20000, 2, 1, 50000, "Scale up begins"],
  [1500000, 30000, 2, 2, 75000, "Comfortable scaling"],
  [2000000, 40000, 3, 2, 100000, "Intermediate target"],
  [2500000, 50000, 4, 3, 125000, "Strong equity curve"],
  [3000000, 60000, 4, 3, 150000, "Momentum phase"],
  [4000000, 80000, 5, 4, 200000, "Accelerating"],
  [5000000, 100000, 7, 5, 250000, "🎯 TARGET ACHIEVED"],
];
const ws5 = XLSX.utils.aoa_to_sheet(sizingData);
ws5["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 28 }];
XLSX.utils.book_append_sheet(wb, ws5, "Position Sizing");

// ═══ SHEET 6: Daily Checklist ═══
const checkData = [
  ["Time", "Task", "Check"],
  ["8:30 AM", "Load overnight data (US futures, crypto, SGX Nifty)", "☐"],
  ["8:30 AM", "Calculate gap vs PDC for Nifty & BankNifty", "☐"],
  ["8:30 AM", "Detect current regime (trending/range/volatile)", "☐"],
  ["8:30 AM", "Mark PDH, PDL, PDC levels on chart", "☐"],
  ["8:30 AM", "Check India VIX (>18 = volatile day)", "☐"],
  ["8:30 AM", "Check economic calendar for high-impact events", "☐"],
  ["9:00 AM", "Update Dhan API token", "☐"],
  ["9:15 AM", "Market opens — observe, don't trade", "☐"],
  ["9:15-9:30", "Capture Opening Range (ORB)", "☐"],
  ["9:30 AM", "ORB algo armed — start trading", "☐"],
  ["10:15 AM", "1Hr High/Low range complete", "☐"],
  ["10:15 AM-12:30 PM", "All 10 sisters scanning — highest signal density", "☐"],
  ["12:30-2:00 PM", "Lunch lull — reduce activity, mean reversion only", "☐"],
  ["2:00-3:00 PM", "Power Hour — momentum plays, position squaring", "☐"],
  ["3:00 PM", "NO new positions — exit mode only", "☐"],
  ["3:15 PM", "Close all intraday positions", "☐"],
  ["3:30 PM", "Log all trades in journal", "☐"],
  ["3:30 PM", "Calculate daily P&L", "☐"],
  ["3:30 PM", "Did I follow ALL rules? Honest self-review", "☐"],
  ["Evening", "Weekly review every Sunday", "☐"],
];
const ws6 = XLSX.utils.aoa_to_sheet(checkData);
ws6["!cols"] = [{ wch: 18 }, { wch: 50 }, { wch: 8 }];
XLSX.utils.book_append_sheet(wb, ws6, "Daily Checklist");

// ═══ SHEET 7: Trade Journal Template ═══
const journalData = [
  ["Date", "Time", "Instrument", "Direction", "Strategy", "Entry", "SL", "TP", "Exit", "Qty", "P&L (₹)", "R:R Achieved", "MC Score", "Followed Rules?", "Emotion", "Lesson Learned"],
  ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
];
const ws7 = XLSX.utils.aoa_to_sheet(journalData);
ws7["!cols"] = [
  { wch: 12 }, { wch: 8 }, { wch: 20 }, { wch: 8 }, { wch: 20 }, { wch: 10 },
  { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 6 }, { wch: 12 }, { wch: 12 },
  { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 30 },
];
XLSX.utils.book_append_sheet(wb, ws7, "Trade Journal");

// ═══ SHEET 8: Kill Zone Schedule ═══
const kzData = [
  ["Kill Zone", "IST Time", "What Happens", "Best Strategies", "Activity Level"],
  ["Pre-Market Prep", "8:30 - 9:15 AM", "Gap analysis, levels, regime detection", "None — preparation only", "🟡 Prep"],
  ["Indian Open", "9:15 - 9:30 AM", "Gap fill, ORB range forms", "Observe only", "🟡 Watch"],
  ["Early Session", "9:30 - 10:15 AM", "ORB triggers, PDC reactions", "ORB, PDC/PDH, Triple-A", "🔴 High"],
  ["1Hr Range Set", "10:15 - 10:30 AM", "First hour range complete", "1Hr H/L breakout", "🔴 High"],
  ["Mid-Morning", "10:30 - 12:30 PM", "All sisters active, highest signal density", "ALL strategies", "🔴 Highest"],
  ["Lunch Lull", "12:30 - 2:00 PM", "Lower volume, mean reversion setups", "Volume Profile, VWAP Rev", "🟢 Low"],
  ["Power Hour", "2:00 - 3:00 PM", "End-of-day moves, squaring", "Momentum, PDC/PDH", "🔴 High"],
  ["Exit Window", "3:00 - 3:15 PM", "Close all intraday positions", "Exit only", "🟡 Exit"],
  ["London Open", "12:30 - 3:30 PM", "Gold, Crude, EUR/USD moves", "ICT PO3, Momentum", "🔴 High"],
  ["NY AM Session", "7:00 - 9:30 PM", "Highest global volume", "All (NQ, ES, BTC)", "🔴 Highest"],
];
const ws8 = XLSX.utils.aoa_to_sheet(kzData);
ws8["!cols"] = [{ wch: 16 }, { wch: 18 }, { wch: 40 }, { wch: 28 }, { wch: 14 }];
XLSX.utils.book_append_sheet(wb, ws8, "Kill Zones");

// ═══ WRITE ═══
const outPath = "/Users/kunaalxg_/Desktop/Trading Algo/AlgoKing_5L_to_50L_Gameplan.xlsx";
XLSX.writeFile(wb, outPath);
console.log(`✅ Gameplan saved to: ${outPath}`);
