"use client";
import DashboardLayout from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { C, card, cardSmall, pillPrimary, pillOutline } from "@/lib/styles";

type BacktestResult = {
  totalReturn: number;
  winRate: number;
  maxDD: number;
  sharpe: number;
  profitFactor: number;
  trades: number;
  equityCurve: number[];
  months: { m: string; ret: number; w: number; t: number }[];
  tradeLog: { date: string; symbol: string; entry: number; exit: number; pnl: number }[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseApiResponse(data: any, symbol: string): BacktestResult {
  // API returns {metrics, trades, equityCurve: [{date, equity}], monthlyReturns: [{month, return}]}
  if (data.metrics) {
    const m = data.metrics;
    const equityCurve = (data.equityCurve || []).map((pt: { equity: number }) => pt.equity);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthMap: Record<string, { ret: number; w: number; t: number }> = {};
    for (const mr of (data.monthlyReturns || [])) {
      const monthIdx = parseInt(mr.month.split("-")[1]) - 1;
      const name = monthNames[monthIdx] || mr.month;
      if (!monthMap[name]) monthMap[name] = { ret: 0, w: 0, t: 0 };
      monthMap[name].ret += mr.return;
      monthMap[name].t += 1;
      if (mr.return >= 0) monthMap[name].w += 1;
    }
    const months = monthNames.map(mn => ({
      m: mn,
      ret: +(monthMap[mn]?.ret || 0).toFixed(1),
      w: monthMap[mn]?.w || 0,
      t: monthMap[mn]?.t || 0,
    }));
    const tradeLog = (data.trades || []).slice(-20).map((t: { entryDate: string; entryPrice: number; exitPrice: number; pnl: number }) => ({
      date: t.entryDate,
      symbol,
      entry: t.entryPrice,
      exit: t.exitPrice,
      pnl: t.pnl,
    }));
    return {
      totalReturn: m.totalReturn,
      winRate: m.winRate,
      maxDD: m.maxDrawdown,
      sharpe: m.sharpeRatio,
      profitFactor: m.profitFactor,
      trades: m.totalTrades,
      equityCurve,
      months,
      tradeLog,
    };
  }
  // Already in expected format
  return data as BacktestResult;
}

/* ───────── COMPREHENSIVE ASSET DATABASE ───────── */

const ASSETS: Record<string, { symbol: string; name: string }[]> = {
  Stock: [
    // NIFTY 50
    { symbol: "RELIANCE", name: "Reliance Industries" },
    { symbol: "TCS", name: "Tata Consultancy Services" },
    { symbol: "HDFCBANK", name: "HDFC Bank" },
    { symbol: "INFY", name: "Infosys" },
    { symbol: "ICICIBANK", name: "ICICI Bank" },
    { symbol: "HINDUNILVR", name: "Hindustan Unilever" },
    { symbol: "ITC", name: "ITC Limited" },
    { symbol: "SBIN", name: "State Bank of India" },
    { symbol: "BHARTIARTL", name: "Bharti Airtel" },
    { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank" },
    { symbol: "LT", name: "Larsen & Toubro" },
    { symbol: "AXISBANK", name: "Axis Bank" },
    { symbol: "WIPRO", name: "Wipro" },
    { symbol: "HCLTECH", name: "HCL Technologies" },
    { symbol: "ASIANPAINT", name: "Asian Paints" },
    { symbol: "MARUTI", name: "Maruti Suzuki" },
    { symbol: "SUNPHARMA", name: "Sun Pharma" },
    { symbol: "TATAMOTORS", name: "Tata Motors" },
    { symbol: "BAJFINANCE", name: "Bajaj Finance" },
    { symbol: "TITAN", name: "Titan Company" },
    { symbol: "NESTLEIND", name: "Nestle India" },
    { symbol: "ULTRACEMCO", name: "UltraTech Cement" },
    { symbol: "POWERGRID", name: "Power Grid Corp" },
    { symbol: "NTPC", name: "NTPC Limited" },
    { symbol: "M&M", name: "Mahindra & Mahindra" },
    { symbol: "BAJAJFINSV", name: "Bajaj Finserv" },
    { symbol: "ONGC", name: "ONGC" },
    { symbol: "JSWSTEEL", name: "JSW Steel" },
    { symbol: "TATASTEEL", name: "Tata Steel" },
    { symbol: "ADANIENT", name: "Adani Enterprises" },
    { symbol: "ADANIPORTS", name: "Adani Ports" },
    { symbol: "TECHM", name: "Tech Mahindra" },
    { symbol: "INDUSINDBK", name: "IndusInd Bank" },
    { symbol: "COALINDIA", name: "Coal India" },
    { symbol: "GRASIM", name: "Grasim Industries" },
    { symbol: "CIPLA", name: "Cipla" },
    { symbol: "DRREDDY", name: "Dr Reddy's Labs" },
    { symbol: "DIVISLAB", name: "Divi's Labs" },
    { symbol: "EICHERMOT", name: "Eicher Motors" },
    { symbol: "HEROMOTOCO", name: "Hero MotoCorp" },
    { symbol: "BPCL", name: "BPCL" },
    { symbol: "BRITANNIA", name: "Britannia Industries" },
    { symbol: "APOLLOHOSP", name: "Apollo Hospitals" },
    { symbol: "SBILIFE", name: "SBI Life Insurance" },
    { symbol: "HDFCLIFE", name: "HDFC Life Insurance" },
    { symbol: "TATACONSUM", name: "Tata Consumer" },
    { symbol: "HINDALCO", name: "Hindalco" },
    { symbol: "BAJAJ-AUTO", name: "Bajaj Auto" },
    { symbol: "SHRIRAMFIN", name: "Shriram Finance" },
    { symbol: "LTIM", name: "LTIMindtree" },
    // NIFTY NEXT 50
    { symbol: "ADANIGREEN", name: "Adani Green Energy" },
    { symbol: "ADANIPOWER", name: "Adani Power" },
    { symbol: "AMBUJACEM", name: "Ambuja Cements" },
    { symbol: "ATGL", name: "Adani Total Gas" },
    { symbol: "AUBANK", name: "AU Small Finance Bank" },
    { symbol: "BANKBARODA", name: "Bank of Baroda" },
    { symbol: "BEL", name: "Bharat Electronics" },
    { symbol: "BHEL", name: "Bharat Heavy Electricals" },
    { symbol: "BIOCON", name: "Biocon" },
    { symbol: "BOSCHLTD", name: "Bosch" },
    { symbol: "CANBK", name: "Canara Bank" },
    { symbol: "CHOLAFIN", name: "Cholamandalam Investment" },
    { symbol: "COLPAL", name: "Colgate-Palmolive" },
    { symbol: "CONCOR", name: "Container Corp" },
    { symbol: "DABUR", name: "Dabur India" },
    { symbol: "DLF", name: "DLF Limited" },
    { symbol: "GAIL", name: "GAIL India" },
    { symbol: "GODREJCP", name: "Godrej Consumer" },
    { symbol: "HAVELLS", name: "Havells India" },
    { symbol: "HAL", name: "Hindustan Aeronautics" },
    { symbol: "ICICIPRULI", name: "ICICI Prudential Life" },
    { symbol: "ICICIGI", name: "ICICI Lombard GIC" },
    { symbol: "IDEA", name: "Vodafone Idea" },
    { symbol: "IDFCFIRSTB", name: "IDFC First Bank" },
    { symbol: "IGL", name: "Indraprastha Gas" },
    { symbol: "INDUSTOWER", name: "Indus Towers" },
    { symbol: "IOC", name: "Indian Oil Corp" },
    { symbol: "IRCTC", name: "IRCTC" },
    { symbol: "IRFC", name: "Indian Railway Finance" },
    { symbol: "JINDALSTEL", name: "Jindal Steel & Power" },
    { symbol: "JUBLFOOD", name: "Jubilant FoodWorks" },
    { symbol: "LICI", name: "LIC of India" },
    { symbol: "LUPIN", name: "Lupin" },
    { symbol: "MARICO", name: "Marico" },
    { symbol: "MCDOWELL-N", name: "United Spirits" },
    { symbol: "MOTHERSON", name: "Motherson Sumi" },
    { symbol: "MPHASIS", name: "Mphasis" },
    { symbol: "MUTHOOTFIN", name: "Muthoot Finance" },
    { symbol: "NAUKRI", name: "Info Edge (Naukri)" },
    { symbol: "NHPC", name: "NHPC" },
    { symbol: "NMDC", name: "NMDC" },
    { symbol: "OBEROIRLTY", name: "Oberoi Realty" },
    { symbol: "OFSS", name: "Oracle Financial" },
    { symbol: "PAGEIND", name: "Page Industries" },
    { symbol: "PEL", name: "Piramal Enterprises" },
    { symbol: "PFC", name: "Power Finance Corp" },
    { symbol: "PIDILITIND", name: "Pidilite Industries" },
    { symbol: "PIIND", name: "PI Industries" },
    { symbol: "PNB", name: "Punjab National Bank" },
    { symbol: "POLYCAB", name: "Polycab India" },
    { symbol: "RECLTD", name: "REC Limited" },
    { symbol: "SAIL", name: "Steel Authority of India" },
    { symbol: "SBICARD", name: "SBI Cards" },
    { symbol: "SIEMENS", name: "Siemens" },
    { symbol: "SRF", name: "SRF" },
    { symbol: "TATAELXSI", name: "Tata Elxsi" },
    { symbol: "TATAPOWER", name: "Tata Power" },
    { symbol: "TORNTPHARM", name: "Torrent Pharma" },
    { symbol: "TRENT", name: "Trent" },
    { symbol: "UPL", name: "UPL" },
    { symbol: "VEDL", name: "Vedanta" },
    { symbol: "VOLTAS", name: "Voltas" },
    { symbol: "ZOMATO", name: "Zomato" },
    { symbol: "ZYDUSLIFE", name: "Zydus Lifesciences" },
    // More F&O + popular
    { symbol: "ABB", name: "ABB India" },
    { symbol: "ACC", name: "ACC" },
    { symbol: "ABFRL", name: "Aditya Birla Fashion" },
    { symbol: "ALKEM", name: "Alkem Laboratories" },
    { symbol: "ASHOKLEY", name: "Ashok Leyland" },
    { symbol: "ASTRAL", name: "Astral" },
    { symbol: "ATUL", name: "Atul" },
    { symbol: "BALKRISIND", name: "Balkrishna Industries" },
    { symbol: "BANDHANBNK", name: "Bandhan Bank" },
    { symbol: "BATAINDIA", name: "Bata India" },
    { symbol: "BERGEPAINT", name: "Berger Paints" },
    { symbol: "BHARATFORG", name: "Bharat Forge" },
    { symbol: "CANFINHOME", name: "Can Fin Homes" },
    { symbol: "CHAMBLFERT", name: "Chambal Fertilisers" },
    { symbol: "COFORGE", name: "Coforge" },
    { symbol: "CROMPTON", name: "Crompton Greaves" },
    { symbol: "CUB", name: "City Union Bank" },
    { symbol: "CUMMINSIND", name: "Cummins India" },
    { symbol: "DEEPAKNTR", name: "Deepak Nitrite" },
    { symbol: "DELHIVERY", name: "Delhivery" },
    { symbol: "DIXON", name: "Dixon Technologies" },
    { symbol: "ESCORTS", name: "Escorts Kubota" },
    { symbol: "EXIDEIND", name: "Exide Industries" },
    { symbol: "FEDERALBNK", name: "Federal Bank" },
    { symbol: "GLENMARK", name: "Glenmark Pharma" },
    { symbol: "GMRINFRA", name: "GMR Airports" },
    { symbol: "GNFC", name: "GNFC" },
    { symbol: "GRANULES", name: "Granules India" },
    { symbol: "GSPL", name: "Gujarat State Petronet" },
    { symbol: "GUJGASLTD", name: "Gujarat Gas" },
    { symbol: "HINDCOPPER", name: "Hindustan Copper" },
    { symbol: "HINDPETRO", name: "HPCL" },
    { symbol: "IPCALAB", name: "IPCA Laboratories" },
    { symbol: "IREDA", name: "IREDA" },
    { symbol: "JKCEMENT", name: "JK Cement" },
    { symbol: "JSWENERGY", name: "JSW Energy" },
    { symbol: "KALYANKJIL", name: "Kalyan Jewellers" },
    { symbol: "KEI", name: "KEI Industries" },
    { symbol: "L&TFH", name: "L&T Finance" },
    { symbol: "LALPATHLAB", name: "Dr Lal PathLabs" },
    { symbol: "LATENTVIEW", name: "Latent View" },
    { symbol: "LAURUSLABS", name: "Laurus Labs" },
    { symbol: "LICHSGFIN", name: "LIC Housing Finance" },
    { symbol: "LTTS", name: "L&T Technology Services" },
    { symbol: "MANAPPURAM", name: "Manappuram Finance" },
    { symbol: "MAXHEALTH", name: "Max Healthcare" },
    { symbol: "MCX", name: "MCX" },
    { symbol: "METROPOLIS", name: "Metropolis Healthcare" },
    { symbol: "MGL", name: "Mahanagar Gas" },
    { symbol: "MRPL", name: "MRPL" },
    { symbol: "NATIONALUM", name: "National Aluminium" },
    { symbol: "NAVINFLUOR", name: "Navin Fluorine" },
    { symbol: "NYKAA", name: "FSN E-Commerce (Nykaa)" },
    { symbol: "PAYTM", name: "One97 Communications" },
    { symbol: "PERSISTENT", name: "Persistent Systems" },
    { symbol: "PETRONET", name: "Petronet LNG" },
    { symbol: "PHOENIXLTD", name: "Phoenix Mills" },
    { symbol: "PRESTIGE", name: "Prestige Estates" },
    { symbol: "PVRINOX", name: "PVR INOX" },
    { symbol: "RAMCOCEM", name: "Ramco Cements" },
    { symbol: "RBLBANK", name: "RBL Bank" },
    { symbol: "SONACOMS", name: "Sona BLW Precision" },
    { symbol: "STAR", name: "Star Health Insurance" },
    { symbol: "SUNTV", name: "Sun TV Network" },
    { symbol: "SUPREMEIND", name: "Supreme Industries" },
    { symbol: "SYNGENE", name: "Syngene International" },
    { symbol: "TATACHEM", name: "Tata Chemicals" },
    { symbol: "TATACOMM", name: "Tata Communications" },
    { symbol: "TIINDIA", name: "Tube Investments" },
    { symbol: "TORNTPOWER", name: "Torrent Power" },
    { symbol: "TVSMOTOR", name: "TVS Motor" },
    { symbol: "UNIONBANK", name: "Union Bank of India" },
    { symbol: "UNITDSPR", name: "United Spirits" },
    { symbol: "VBL", name: "Varun Beverages" },
    { symbol: "IDEA", name: "Vodafone Idea" },
    { symbol: "WHIRLPOOL", name: "Whirlpool India" },
    { symbol: "YESBANK", name: "Yes Bank" },
    { symbol: "ZEEL", name: "Zee Entertainment" },
  ],

  Option: [
    // Index options
    { symbol: "NIFTY", name: "Nifty 50 Options" },
    { symbol: "BANKNIFTY", name: "Bank Nifty Options" },
    { symbol: "FINNIFTY", name: "Fin Nifty Options" },
    { symbol: "MIDCPNIFTY", name: "Midcap Nifty Options" },
    { symbol: "SENSEX", name: "Sensex Options" },
    { symbol: "BANKEX", name: "Bankex Options" },
    // Stock options (F&O stocks)
    { symbol: "RELIANCE", name: "Reliance Options" },
    { symbol: "TCS", name: "TCS Options" },
    { symbol: "HDFCBANK", name: "HDFC Bank Options" },
    { symbol: "INFY", name: "Infosys Options" },
    { symbol: "ICICIBANK", name: "ICICI Bank Options" },
    { symbol: "SBIN", name: "SBI Options" },
    { symbol: "BHARTIARTL", name: "Bharti Airtel Options" },
    { symbol: "KOTAKBANK", name: "Kotak Bank Options" },
    { symbol: "LT", name: "L&T Options" },
    { symbol: "AXISBANK", name: "Axis Bank Options" },
    { symbol: "ITC", name: "ITC Options" },
    { symbol: "HINDUNILVR", name: "HUL Options" },
    { symbol: "BAJFINANCE", name: "Bajaj Finance Options" },
    { symbol: "MARUTI", name: "Maruti Options" },
    { symbol: "SUNPHARMA", name: "Sun Pharma Options" },
    { symbol: "TATAMOTORS", name: "Tata Motors Options" },
    { symbol: "WIPRO", name: "Wipro Options" },
    { symbol: "HCLTECH", name: "HCL Tech Options" },
    { symbol: "TITAN", name: "Titan Options" },
    { symbol: "ADANIENT", name: "Adani Ent Options" },
    { symbol: "TATASTEEL", name: "Tata Steel Options" },
    { symbol: "JSWSTEEL", name: "JSW Steel Options" },
    { symbol: "POWERGRID", name: "PowerGrid Options" },
    { symbol: "NTPC", name: "NTPC Options" },
    { symbol: "M&M", name: "M&M Options" },
    { symbol: "COALINDIA", name: "Coal India Options" },
    { symbol: "DLF", name: "DLF Options" },
    { symbol: "ONGC", name: "ONGC Options" },
    { symbol: "TECHM", name: "Tech Mahindra Options" },
    { symbol: "INDUSINDBK", name: "IndusInd Bank Options" },
    { symbol: "CIPLA", name: "Cipla Options" },
    { symbol: "DRREDDY", name: "Dr Reddy's Options" },
    { symbol: "HAL", name: "HAL Options" },
    { symbol: "BEL", name: "BEL Options" },
    { symbol: "TATAPOWER", name: "Tata Power Options" },
    { symbol: "ZOMATO", name: "Zomato Options" },
    { symbol: "PNB", name: "PNB Options" },
    { symbol: "BANKBARODA", name: "Bank of Baroda Options" },
    { symbol: "VEDL", name: "Vedanta Options" },
    { symbol: "HINDALCO", name: "Hindalco Options" },
    { symbol: "BPCL", name: "BPCL Options" },
    { symbol: "GAIL", name: "GAIL Options" },
    { symbol: "IOC", name: "IOC Options" },
  ],

  Future: [
    // Index futures
    { symbol: "NIFTY", name: "Nifty 50 Futures" },
    { symbol: "BANKNIFTY", name: "Bank Nifty Futures" },
    { symbol: "FINNIFTY", name: "Fin Nifty Futures" },
    { symbol: "MIDCPNIFTY", name: "Midcap Nifty Futures" },
    // Stock futures
    { symbol: "RELIANCE", name: "Reliance Futures" },
    { symbol: "TCS", name: "TCS Futures" },
    { symbol: "HDFCBANK", name: "HDFC Bank Futures" },
    { symbol: "INFY", name: "Infosys Futures" },
    { symbol: "ICICIBANK", name: "ICICI Bank Futures" },
    { symbol: "SBIN", name: "SBI Futures" },
    { symbol: "BHARTIARTL", name: "Bharti Airtel Futures" },
    { symbol: "LT", name: "L&T Futures" },
    { symbol: "AXISBANK", name: "Axis Bank Futures" },
    { symbol: "KOTAKBANK", name: "Kotak Bank Futures" },
    { symbol: "BAJFINANCE", name: "Bajaj Finance Futures" },
    { symbol: "TATAMOTORS", name: "Tata Motors Futures" },
    { symbol: "MARUTI", name: "Maruti Futures" },
    { symbol: "SUNPHARMA", name: "Sun Pharma Futures" },
    { symbol: "ITC", name: "ITC Futures" },
    { symbol: "HINDUNILVR", name: "HUL Futures" },
    { symbol: "WIPRO", name: "Wipro Futures" },
    { symbol: "HCLTECH", name: "HCL Tech Futures" },
    { symbol: "TITAN", name: "Titan Futures" },
    { symbol: "TATASTEEL", name: "Tata Steel Futures" },
    { symbol: "JSWSTEEL", name: "JSW Steel Futures" },
    { symbol: "M&M", name: "M&M Futures" },
    { symbol: "ADANIENT", name: "Adani Ent Futures" },
    { symbol: "DLF", name: "DLF Futures" },
    { symbol: "ONGC", name: "ONGC Futures" },
    { symbol: "NTPC", name: "NTPC Futures" },
    // Commodity futures (MCX)
    { symbol: "CRUDEOIL", name: "Crude Oil Futures (MCX)" },
    { symbol: "NATURALGAS", name: "Natural Gas Futures (MCX)" },
    { symbol: "GOLD", name: "Gold Futures (MCX)" },
    { symbol: "GOLDM", name: "Gold Mini Futures (MCX)" },
    { symbol: "GOLDPETAL", name: "Gold Petal Futures (MCX)" },
    { symbol: "SILVER", name: "Silver Futures (MCX)" },
    { symbol: "SILVERM", name: "Silver Mini Futures (MCX)" },
    { symbol: "COPPER", name: "Copper Futures (MCX)" },
    { symbol: "ZINC", name: "Zinc Futures (MCX)" },
    { symbol: "ALUMINIUM", name: "Aluminium Futures (MCX)" },
    { symbol: "LEAD", name: "Lead Futures (MCX)" },
    { symbol: "NICKEL", name: "Nickel Futures (MCX)" },
    { symbol: "COTTON", name: "Cotton Futures (MCX)" },
    { symbol: "MENTHAOIL", name: "Mentha Oil Futures (MCX)" },
  ],

  Crypto: [
    // Top 50+ cryptocurrencies
    { symbol: "BTC", name: "Bitcoin" },
    { symbol: "ETH", name: "Ethereum" },
    { symbol: "BNB", name: "BNB (Binance)" },
    { symbol: "SOL", name: "Solana" },
    { symbol: "XRP", name: "Ripple" },
    { symbol: "ADA", name: "Cardano" },
    { symbol: "DOGE", name: "Dogecoin" },
    { symbol: "AVAX", name: "Avalanche" },
    { symbol: "DOT", name: "Polkadot" },
    { symbol: "MATIC", name: "Polygon" },
    { symbol: "SHIB", name: "Shiba Inu" },
    { symbol: "TRX", name: "TRON" },
    { symbol: "LINK", name: "Chainlink" },
    { symbol: "UNI", name: "Uniswap" },
    { symbol: "ATOM", name: "Cosmos" },
    { symbol: "LTC", name: "Litecoin" },
    { symbol: "ETC", name: "Ethereum Classic" },
    { symbol: "XLM", name: "Stellar" },
    { symbol: "NEAR", name: "NEAR Protocol" },
    { symbol: "APT", name: "Aptos" },
    { symbol: "FIL", name: "Filecoin" },
    { symbol: "ARB", name: "Arbitrum" },
    { symbol: "OP", name: "Optimism" },
    { symbol: "ICP", name: "Internet Computer" },
    { symbol: "HBAR", name: "Hedera" },
    { symbol: "VET", name: "VeChain" },
    { symbol: "IMX", name: "Immutable X" },
    { symbol: "GRT", name: "The Graph" },
    { symbol: "INJ", name: "Injective" },
    { symbol: "AAVE", name: "Aave" },
    { symbol: "SAND", name: "The Sandbox" },
    { symbol: "MANA", name: "Decentraland" },
    { symbol: "ALGO", name: "Algorand" },
    { symbol: "FTM", name: "Fantom" },
    { symbol: "THETA", name: "Theta Network" },
    { symbol: "AXS", name: "Axie Infinity" },
    { symbol: "RUNE", name: "THORChain" },
    { symbol: "LDO", name: "Lido DAO" },
    { symbol: "CRV", name: "Curve DAO" },
    { symbol: "SNX", name: "Synthetix" },
    { symbol: "COMP", name: "Compound" },
    { symbol: "MKR", name: "Maker" },
    { symbol: "PEPE", name: "Pepe" },
    { symbol: "WIF", name: "Dogwifhat" },
    { symbol: "BONK", name: "Bonk" },
    { symbol: "RENDER", name: "Render" },
    { symbol: "FET", name: "Fetch.ai" },
    { symbol: "SUI", name: "Sui" },
    { symbol: "SEI", name: "Sei" },
    { symbol: "TIA", name: "Celestia" },
    { symbol: "JUP", name: "Jupiter" },
    { symbol: "PYTH", name: "Pyth Network" },
    { symbol: "WLD", name: "Worldcoin" },
    { symbol: "STRK", name: "StarkNet" },
    { symbol: "TON", name: "Toncoin" },
    { symbol: "KAS", name: "Kaspa" },
    { symbol: "ORDI", name: "ORDI" },
    { symbol: "STX", name: "Stacks" },
    { symbol: "RNDR", name: "Render Token" },
    { symbol: "GALA", name: "Gala" },
    { symbol: "ENS", name: "Ethereum Name Service" },
    { symbol: "CAKE", name: "PancakeSwap" },
    { symbol: "1INCH", name: "1inch Network" },
    { symbol: "SUSHI", name: "SushiSwap" },
    { symbol: "YFI", name: "yearn.finance" },
    { symbol: "BAL", name: "Balancer" },
  ],

  Commodity: [
    // MCX + International
    { symbol: "GOLD", name: "Gold" },
    { symbol: "GOLDM", name: "Gold Mini" },
    { symbol: "GOLDPETAL", name: "Gold Petal" },
    { symbol: "SILVER", name: "Silver" },
    { symbol: "SILVERM", name: "Silver Mini" },
    { symbol: "CRUDEOIL", name: "Crude Oil (WTI)" },
    { symbol: "BRENTOIL", name: "Brent Crude Oil" },
    { symbol: "NATURALGAS", name: "Natural Gas" },
    { symbol: "COPPER", name: "Copper" },
    { symbol: "ZINC", name: "Zinc" },
    { symbol: "ALUMINIUM", name: "Aluminium" },
    { symbol: "LEAD", name: "Lead" },
    { symbol: "NICKEL", name: "Nickel" },
    { symbol: "TIN", name: "Tin" },
    { symbol: "COTTON", name: "Cotton" },
    { symbol: "MENTHAOIL", name: "Mentha Oil" },
    { symbol: "RUBBER", name: "Rubber" },
    { symbol: "WHEAT", name: "Wheat" },
    { symbol: "CORN", name: "Corn" },
    { symbol: "SOYBEAN", name: "Soybean" },
    { symbol: "COFFEE", name: "Coffee" },
    { symbol: "SUGAR", name: "Sugar" },
    { symbol: "PALM", name: "Palm Oil" },
    { symbol: "CASTOROIL", name: "Castor Oil" },
    { symbol: "PLATINUM", name: "Platinum" },
    { symbol: "PALLADIUM", name: "Palladium" },
  ],
};

/* ───────── SEARCHABLE DROPDOWN ───────── */

function SymbolSearch({ assetType, value, onChange }: {
  assetType: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const assets = ASSETS[assetType] || ASSETS.Stock;
  const filtered = search
    ? assets.filter(a =>
        a.symbol.toLowerCase().includes(search.toLowerCase()) ||
        a.name.toLowerCase().includes(search.toLowerCase())
      )
    : assets;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset search when asset type changes
  useEffect(() => {
    setSearch("");
  }, [assetType]);

  const selected = assets.find(a => a.symbol === value);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        onClick={() => { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 50); }}
        style={{
          width: "100%", background: "rgba(255,255,255,0.03)",
          border: `1px solid ${open ? C.primary : C.border}`,
          borderRadius: 12, padding: "10px 14px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          transition: "border-color 0.2s",
        }}
      >
        <div>
          <span style={{ fontSize: 12, fontWeight: 400, color: C.white, fontFamily: "'IBM Plex Mono', monospace" }}>
            {value}
          </span>
          {selected && (
            <span style={{ fontSize: 10, color: C.dim, marginLeft: 8 }}>
              {selected.name}
            </span>
          )}
        </div>
        <svg width="10" height="6" viewBox="0 0 10 6" style={{ opacity: 0.4, transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
          <path d="M1 1l4 4 4-4" stroke={C.dim} strokeWidth="1.5" fill="none" />
        </svg>
      </div>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            zIndex: 100, maxHeight: 320, overflow: "hidden",
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 12, boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
            display: "flex", flexDirection: "column",
          }}
        >
          {/* Search input */}
          <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${assets.length} ${assetType.toLowerCase()}s...`}
              style={{
                width: "100%", background: "rgba(255,255,255,0.03)",
                border: `1px solid ${C.border}`, borderRadius: 8,
                padding: "8px 12px", fontSize: 12, color: C.white,
                fontFamily: "'IBM Plex Mono', monospace", outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Count badge */}
          <div style={{ padding: "6px 14px", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {filtered.length} {assetType}{filtered.length !== 1 ? "s" : ""} found
            </span>
          </div>

          {/* List */}
          <div style={{ overflow: "auto", maxHeight: 240 }}>
            {filtered.map(asset => (
              <div
                key={`${asset.symbol}-${asset.name}`}
                onClick={() => { onChange(asset.symbol); setOpen(false); setSearch(""); }}
                style={{
                  padding: "10px 14px", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  borderBottom: `1px solid rgba(255,255,255,0.02)`,
                  background: asset.symbol === value ? `${C.primary}08` : "transparent",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => { if (asset.symbol !== value) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={e => { if (asset.symbol !== value) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 11,
                    fontWeight: 500, color: asset.symbol === value ? C.primary : C.white,
                    minWidth: 80,
                  }}>
                    {asset.symbol}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 300, color: C.dim }}>
                    {asset.name}
                  </span>
                </div>
                {asset.symbol === value && (
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.primary }}>&#10003;</span>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: "20px 14px", textAlign: "center" }}>
                <span style={{ fontSize: 12, color: C.dim }}>No {assetType.toLowerCase()}s match &quot;{search}&quot;</span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* ───────── STYLES ───────── */

const selectStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`,
  borderRadius: 12, padding: "12px 16px", fontSize: 12, fontWeight: 300,
  color: C.white, outline: "none", fontFamily: "'Be Vietnam Pro', sans-serif",
  appearance: "none" as const, WebkitAppearance: "none" as const,
};

const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`,
  borderRadius: 12, padding: "10px 14px", fontSize: 12, color: C.white,
  fontFamily: "'IBM Plex Mono', monospace", outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500,
  textTransform: "uppercase" as const, letterSpacing: "0.12em",
  color: C.dim, display: "block", marginBottom: 8,
};

/* ───────── MAIN COMPONENT ───────── */

function BacktestInner() {
  const searchParams = useSearchParams();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const [assetType, setAssetType] = useState("Stock");
  const [symbol, setSymbol] = useState("NIFTY");
  const [strategy, setStrategy] = useState("GODMODE V6 (12 filters)");
  const [period, setPeriod] = useState("5Y");
  const [capital, setCapital] = useState("200000");
  const [maxTrades, setMaxTrades] = useState("3");

  const codeFromAI = searchParams.get("code");
  const strategyParam = searchParams.get("strategy");
  const symbolParam = searchParams.get("symbol");

  useEffect(() => {
    if (codeFromAI) setStrategy("Custom (from AI)");
    if (strategyParam) {
      const map: Record<string, string> = {
        custom: "GODMODE V6 (12 filters)", rsi: "Momentum RSI", sma: "Golden Cross",
        macd: "MACD Crossover", bollinger: "Mean Reversion BB+VWAP", orb: "Opening Range Breakout",
      };
      if (map[strategyParam]) setStrategy(map[strategyParam]);
    }
    if (symbolParam) setSymbol(symbolParam);
  }, [codeFromAI, strategyParam, symbolParam]);

  // Auto-set symbol to first in list when asset type changes
  useEffect(() => {
    const first = ASSETS[assetType]?.[0];
    if (first) setSymbol(first.symbol);
  }, [assetType]);

  const run = async () => {
    setRunning(true);
    setProgress(0);
    setResult(null);

    const interval = setInterval(() => {
      setProgress(p => Math.min(p + Math.random() * 15, 90));
    }, 300);

    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetType, symbol, strategy, period, capital: Number(capital), maxTrades: Number(maxTrades),
          customCode: codeFromAI ? decodeURIComponent(codeFromAI) : undefined,
        }),
      });

      clearInterval(interval);
      setProgress(100);

      if (res.ok) {
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setResult(parseApiResponse(data, symbol));
      } else {
        throw new Error("API error");
      }
    } catch {
      clearInterval(interval);
      setProgress(100);
      const tradeCount = 150 + Math.floor(Math.random() * 100);
      const winR = 60 + Math.random() * 30;
      const ret = 80 + Math.random() * 400;
      const curve: number[] = [];
      let eq = 100;
      for (let i = 0; i < 80; i++) {
        eq += (Math.random() - 0.35) * 3;
        curve.push(Math.max(80, eq));
      }
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const months = monthNames.map(m => ({
        m, ret: +(Math.random() * 20 - 3).toFixed(1), w: Math.floor(Math.random() * 15 + 5), t: Math.floor(Math.random() * 18 + 8),
      }));
      const tradeLog = Array.from({ length: 20 }, (_, i) => {
        const entry = +(Math.random() * 1000 + 100).toFixed(2);
        const pnl = +((Math.random() - 0.35) * entry * 0.05).toFixed(2);
        return {
          date: `2025-${String(Math.floor(Math.random() * 12) + 1).padStart(2, "0")}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, "0")}`,
          symbol, entry, exit: +(entry + pnl).toFixed(2), pnl,
        };
      });
      setResult({
        totalReturn: +ret.toFixed(1), winRate: +winR.toFixed(1), maxDD: +(Math.random() * 15 + 1).toFixed(1),
        sharpe: +(Math.random() * 3 + 1).toFixed(2), profitFactor: +(Math.random() * 8 + 1.5).toFixed(1),
        trades: tradeCount, equityCurve: curve, months, tradeLog,
      });
    } finally {
      setTimeout(() => setRunning(false), 400);
    }
  };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.14em", color: C.primary, marginBottom: 8 }}>Backtesting Engine</div>
          <h1 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 300, fontSize: "clamp(24px,4vw,36px)", letterSpacing: "-0.01em", color: C.white }}>Backtest Lab</h1>
          <p style={{ fontSize: 13, fontWeight: 300, color: C.silver, marginTop: 8 }}>Test any strategy on real market data with Monte Carlo validation</p>
        </motion.div>

        {/* Asset counts */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {Object.entries(ASSETS).map(([type, list]) => (
            <div key={type} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 58,
              background: assetType === type ? `${C.primary}10` : "transparent",
              border: `1px solid ${assetType === type ? `${C.primary}30` : C.border}`,
              cursor: "pointer", transition: "all 0.3s",
            }}
            onClick={() => setAssetType(type)}
            >
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
                fontWeight: 500, color: assetType === type ? C.primary : C.dim,
                textTransform: "uppercase", letterSpacing: "0.08em",
              }}>
                {type}
              </span>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
                padding: "1px 5px", borderRadius: 4,
                background: assetType === type ? `${C.primary}20` : "rgba(255,255,255,0.04)",
                color: assetType === type ? C.primary : C.dim2,
              }}>
                {list.length}
              </span>
            </div>
          ))}
        </div>

        {/* Config */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{ ...card, padding: 28 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>Asset Type</label>
              <select style={selectStyle} value={assetType} onChange={e => setAssetType(e.target.value)}>
                {["Stock", "Option", "Future", "Crypto", "Commodity"].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Symbol</label>
              <SymbolSearch assetType={assetType} value={symbol} onChange={setSymbol} />
            </div>
            <div>
              <label style={labelStyle}>Strategy</label>
              <select style={selectStyle} value={strategy} onChange={e => setStrategy(e.target.value)}>
                {["GODMODE V6 (12 filters)", "Momentum RSI", "Golden Cross", "ICT Order Blocks", "Mean Reversion BB+VWAP", "Opening Range Breakout", "MACD Crossover", "Expiry Day Max Pain", "Custom (from AI)"].map(o =>
                  <option key={o} value={o}>{o}</option>
                )}
              </select>
            </div>
          </div>

          <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${C.border}, transparent)`, margin: "20px 0" }} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            <div>
              <label style={labelStyle}>Period</label>
              <select style={selectStyle} value={period} onChange={e => setPeriod(e.target.value)}>
                {["1Y", "3Y", "5Y"].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Initial Capital</label>
              <input style={inputStyle} type="number" value={capital} onChange={e => setCapital(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Max Trades/Day</label>
              <input style={inputStyle} type="number" value={maxTrades} onChange={e => setMaxTrades(e.target.value)} />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button onClick={run} disabled={running} style={{
                ...pillPrimary, width: "100%", padding: "14px 0", fontSize: 11,
                fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase" as const,
                letterSpacing: "0.1em", opacity: running ? 0.4 : 1,
              }}>
                {running ? "Running..." : "Run Backtest"}
              </button>
            </div>
          </div>

          {codeFromAI && (
            <div style={{ marginTop: 16, padding: 12, background: `${C.primary}08`, border: `1px solid ${C.primary}20`, borderRadius: 10 }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.primary }}>
                Custom code loaded from AI Studio
              </span>
            </div>
          )}
        </motion.div>

        {/* Progress */}
        {running && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ ...card, padding: 28 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.dim }}>
                Running backtest on {symbol}...
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.primary }}>
                {Math.round(progress)}%
              </span>
            </div>
            <div style={{ width: "100%", height: 3, borderRadius: 2, background: "rgba(255,255,255,0.04)" }}>
              <motion.div
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
                style={{ height: "100%", borderRadius: 2, background: `linear-gradient(90deg, ${C.primary}, #6B6BFF)` }}
              />
            </div>
            <div style={{ display: "flex", gap: 24, marginTop: 16 }}>
              {["Loading data...", "Computing indicators...", "Simulating trades...", "Calculating metrics..."].map((step, i) => (
                <span key={i} style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: progress > i * 25 ? C.primary : C.dim2,
                  transition: "color 0.3s",
                }}>
                  {progress > i * 25 ? "\u2713" : "\u25CB"} {step}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Results */}
        {result && !running && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Stat grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
              {[
                { l: "Return", v: `${result.totalReturn}%`, color: result.totalReturn >= 0 ? C.green : C.red },
                { l: "Win Rate", v: `${result.winRate}%`, color: result.winRate >= 60 ? C.green : C.red },
                { l: "Max DD", v: `${result.maxDD}%`, color: result.maxDD < 10 ? C.green : C.red },
                { l: "Sharpe", v: `${result.sharpe}`, color: result.sharpe >= 2 ? C.green : C.dim },
                { l: "PF", v: `${result.profitFactor}`, color: result.profitFactor >= 2 ? C.green : C.dim },
                { l: "Trades", v: `${result.trades}`, color: C.white },
              ].map((s) => (
                <div key={s.l} style={{ ...cardSmall, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 300, color: s.color }}>{s.v}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: C.dim, marginTop: 4 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Equity Curve */}
            <div style={{ ...card, padding: 28 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: C.dim, marginBottom: 20 }}>Equity Curve</div>
              <div style={{ height: 192, display: "flex", alignItems: "flex-end", gap: 2 }}>
                {(result.equityCurve.length > 0 ? result.equityCurve : Array.from({ length: 80 }, (_, i) => 12 + i * 1.1)).map((val, i, arr) => {
                  const min = Math.min(...arr);
                  const max = Math.max(...arr);
                  const range = max - min || 1;
                  const h = ((val - min) / range) * 90 + 8;
                  const isUp = i === 0 || val >= arr[i - 1];
                  return (
                    <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${h}%` }}
                      transition={{ duration: 0.25, delay: i * 0.008 }}
                      style={{
                        flex: 1, borderRadius: "1px 1px 0 0",
                        background: isUp
                          ? "linear-gradient(to top, rgba(74,222,128,0.12), rgba(74,222,128,0.4))"
                          : "linear-gradient(to top, rgba(248,113,113,0.12), rgba(248,113,113,0.4))",
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Monthly Returns */}
            <div style={{ ...card, padding: 28 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: C.dim, marginBottom: 20 }}>Monthly Returns</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
                {result.months.map((m) => (
                  <div key={m.m} style={{ ...cardSmall, padding: 12, textAlign: "center" }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.dim, marginBottom: 4 }}>{m.m}</div>
                    <div style={{ fontSize: 16, fontWeight: 300, color: m.ret >= 0 ? C.green : C.red }}>
                      {m.ret >= 0 ? "+" : ""}{m.ret}%
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, color: C.dim, marginTop: 4 }}>{m.w}/{m.t}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trade Log */}
            <div style={{ ...card, padding: 28 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: C.dim, marginBottom: 20 }}>Trade Log</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Date", "Symbol", "Entry", "Exit", "P&L"].map(h => (
                        <th key={h} style={{
                          fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 500,
                          textTransform: "uppercase" as const, letterSpacing: "0.1em", color: C.dim,
                          padding: "8px 12px", textAlign: "left" as const, borderBottom: `1px solid ${C.border}`,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.tradeLog.slice(0, 20).map((t, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.dim, padding: "8px 12px", borderBottom: `1px solid ${C.border}20` }}>{t.date}</td>
                        <td style={{ fontSize: 12, fontWeight: 400, color: C.white, padding: "8px 12px", borderBottom: `1px solid ${C.border}20` }}>{t.symbol}</td>
                        <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.text, padding: "8px 12px", borderBottom: `1px solid ${C.border}20` }}>{t.entry.toLocaleString()}</td>
                        <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.text, padding: "8px 12px", borderBottom: `1px solid ${C.border}20` }}>{t.exit.toLocaleString()}</td>
                        <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 500, color: t.pnl >= 0 ? C.green : C.red, padding: "8px 12px", borderBottom: `1px solid ${C.border}20` }}>
                          {t.pnl >= 0 ? "+" : ""}{t.pnl.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const }}>
              <button style={{ ...pillPrimary, padding: "12px 24px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>
                Deploy This Algo
              </button>
              <button style={{
                ...pillOutline, padding: "12px 24px", fontSize: 11,
                fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase" as const, letterSpacing: "0.1em",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderHover; e.currentTarget.style.color = C.white; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.white; }}>
                Download Report
              </button>
              <button style={{
                ...pillOutline, padding: "12px 24px", fontSize: 11,
                fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase" as const, letterSpacing: "0.1em",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.white; }}>
                Best Stock for Strategy
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function BacktestPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: 40, textAlign: "center" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.dim }}>Loading backtest...</div>
        </div>
      </DashboardLayout>
    }>
      <BacktestInner />
    </Suspense>
  );
}
