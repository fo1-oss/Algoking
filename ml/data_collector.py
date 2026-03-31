"""
Data Collector — 5 years of historical data for all 213 F&O instruments.
Sources: Yahoo Finance (OHLCV), Dhan API (OI, options), VIX, sector indices.
Stores everything in SQLite for fast ML feature computation.
"""
import sqlite3
import time
import json
import os
import sys
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import yfinance as yf
import requests

from config import (
    DB_PATH, DATA_DIR, DHAN_BASE, DHAN_TOKEN, DHAN_CLIENT_ID,
    ALL_SYMBOLS, FNO_INDICES, FNO_STOCKS, SECTOR_MAP,
    HISTORY_YEARS, YAHOO_BATCH_SIZE, YAHOO_RATE_DELAY, DHAN_RATE_DELAY,
)

# ══════════════════════════════════════════════════════════════
# DATABASE SETUP
# ══════════════════════════════════════════════════════════════

def init_db():
    """Create tables if they don't exist."""
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS daily_ohlcv (
            symbol TEXT NOT NULL,
            date TEXT NOT NULL,
            open REAL, high REAL, low REAL, close REAL,
            adj_close REAL, volume INTEGER,
            dividends REAL DEFAULT 0,
            stock_splits REAL DEFAULT 0,
            PRIMARY KEY (symbol, date)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS daily_oi (
            symbol TEXT NOT NULL,
            date TEXT NOT NULL,
            oi INTEGER DEFAULT 0,
            oi_change INTEGER DEFAULT 0,
            delivery_pct REAL DEFAULT 0,
            PRIMARY KEY (symbol, date)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS daily_options_agg (
            symbol TEXT NOT NULL,
            date TEXT NOT NULL,
            expiry TEXT,
            total_ce_oi INTEGER DEFAULT 0,
            total_pe_oi INTEGER DEFAULT 0,
            pcr REAL DEFAULT 0,
            max_ce_oi_strike REAL DEFAULT 0,
            max_pe_oi_strike REAL DEFAULT 0,
            atm_iv REAL DEFAULT 0,
            total_ce_volume INTEGER DEFAULT 0,
            total_pe_volume INTEGER DEFAULT 0,
            PRIMARY KEY (symbol, date)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS vix_daily (
            date TEXT PRIMARY KEY,
            open REAL, high REAL, low REAL, close REAL, volume INTEGER
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS sector_daily (
            sector TEXT NOT NULL,
            date TEXT NOT NULL,
            avg_return REAL DEFAULT 0,
            breadth REAL DEFAULT 0,
            PRIMARY KEY (sector, date)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS collection_log (
            source TEXT NOT NULL,
            symbol TEXT,
            date_collected TEXT NOT NULL,
            rows_added INTEGER DEFAULT 0,
            status TEXT DEFAULT 'ok',
            PRIMARY KEY (source, symbol, date_collected)
        )
    """)

    # Indices for fast lookups
    c.execute("CREATE INDEX IF NOT EXISTS idx_ohlcv_date ON daily_ohlcv(date)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_ohlcv_sym ON daily_ohlcv(symbol)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_oi_date ON daily_oi(date)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_options_date ON daily_options_agg(date)")

    conn.commit()
    conn.close()
    print(f"[DB] Initialized at {DB_PATH}")


# ══════════════════════════════════════════════════════════════
# YAHOO FINANCE — 5yr OHLCV for all stocks + indices + VIX
# ══════════════════════════════════════════════════════════════

def collect_yahoo_ohlcv(symbols_map: dict, years: int = 5):
    """Download OHLCV data from Yahoo Finance for all symbols."""
    conn = sqlite3.connect(DB_PATH)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=years * 365)

    symbols = list(symbols_map.items())
    total = len(symbols)
    total_rows = 0

    print(f"\n[Yahoo] Downloading {total} symbols, {years}yr history...")
    print(f"[Yahoo] Date range: {start_date.date()} → {end_date.date()}")

    for batch_start in range(0, total, YAHOO_BATCH_SIZE):
        batch = symbols[batch_start:batch_start + YAHOO_BATCH_SIZE]
        yahoo_symbols = [ys for _, ys in batch]
        nse_symbols = [ns for ns, _ in batch]

        pct = (batch_start / total) * 100
        print(f"  [{pct:.0f}%] Fetching batch {batch_start//YAHOO_BATCH_SIZE + 1} "
              f"({len(batch)} symbols: {nse_symbols[0]}...{nse_symbols[-1]})")

        try:
            # yfinance batch download
            data = yf.download(
                yahoo_symbols,
                start=start_date.strftime("%Y-%m-%d"),
                end=end_date.strftime("%Y-%m-%d"),
                group_by="ticker",
                auto_adjust=False,
                threads=True,
                progress=False,
            )

            for nse_sym, yahoo_sym in batch:
                try:
                    if len(batch) == 1:
                        df = data.copy()
                    else:
                        if yahoo_sym not in data.columns.get_level_values(0):
                            continue
                        df = data[yahoo_sym].copy()

                    if df.empty:
                        continue

                    df = df.dropna(subset=["Close"])
                    df = df.reset_index()
                    df.columns = [c.lower().replace(" ", "_") for c in df.columns]

                    rows = []
                    for _, row in df.iterrows():
                        date_str = str(row["date"])[:10] if "date" in row.index else str(row.get("date", ""))[:10]
                        rows.append((
                            nse_sym, date_str,
                            float(row.get("open", 0) or 0),
                            float(row.get("high", 0) or 0),
                            float(row.get("low", 0) or 0),
                            float(row.get("close", 0) or 0),
                            float(row.get("adj_close", row.get("adj close", row.get("close", 0))) or 0),
                            int(row.get("volume", 0) or 0),
                            float(row.get("dividends", 0) or 0),
                            float(row.get("stock_splits", row.get("stock splits", 0)) or 0),
                        ))

                    if rows:
                        conn.executemany(
                            "INSERT OR REPLACE INTO daily_ohlcv VALUES (?,?,?,?,?,?,?,?,?,?)",
                            rows
                        )
                        total_rows += len(rows)

                except Exception as e:
                    print(f"    [WARN] {nse_sym}: {e}")

            conn.commit()
        except Exception as e:
            print(f"    [ERROR] Batch failed: {e}")

        if batch_start + YAHOO_BATCH_SIZE < total:
            time.sleep(YAHOO_RATE_DELAY)

    # Log collection
    conn.execute(
        "INSERT OR REPLACE INTO collection_log VALUES (?,?,?,?,?)",
        ("yahoo_ohlcv", "ALL", datetime.now().isoformat(), total_rows, "ok")
    )
    conn.commit()
    conn.close()
    print(f"[Yahoo] Done! {total_rows:,} total rows saved for {total} symbols")


def collect_vix(years: int = 5):
    """Download India VIX historical data."""
    conn = sqlite3.connect(DB_PATH)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=years * 365)

    print("\n[VIX] Downloading India VIX history...")
    try:
        vix = yf.download(
            "^INDIAVIX",
            start=start_date.strftime("%Y-%m-%d"),
            end=end_date.strftime("%Y-%m-%d"),
            auto_adjust=False,
            progress=False,
        )
        if vix.empty:
            print("[VIX] No data returned")
            return

        rows = []
        vix = vix.reset_index()
        vix.columns = [c.lower().replace(" ", "_") if isinstance(c, str) else str(c[0]).lower() for c in vix.columns]

        for _, row in vix.iterrows():
            date_str = str(row.get("date", ""))[:10]
            rows.append((
                date_str,
                float(row.get("open", 0) or 0),
                float(row.get("high", 0) or 0),
                float(row.get("low", 0) or 0),
                float(row.get("close", 0) or 0),
                int(row.get("volume", 0) or 0),
            ))

        conn.executemany("INSERT OR REPLACE INTO vix_daily VALUES (?,?,?,?,?,?)", rows)
        conn.commit()
        print(f"[VIX] Saved {len(rows)} days of VIX data")
    except Exception as e:
        print(f"[VIX] Error: {e}")
    finally:
        conn.close()


# ══════════════════════════════════════════════════════════════
# DHAN API — OI + Options aggregate data
# ══════════════════════════════════════════════════════════════

def _dhan_post(path: str, body: dict) -> dict:
    """Make authenticated POST to Dhan API."""
    if not DHAN_TOKEN:
        return {}
    try:
        res = requests.post(
            f"{DHAN_BASE}{path}",
            headers={
                "access-token": DHAN_TOKEN,
                "client-id": DHAN_CLIENT_ID,
                "Content-Type": "application/json",
            },
            json=body,
            timeout=15,
        )
        if res.ok:
            return res.json()
    except Exception:
        pass
    return {}


def collect_dhan_historical_oi(security_ids: dict, days: int = 365):
    """Fetch daily historical data with OI from Dhan for recent period."""
    if not DHAN_TOKEN:
        print("[Dhan OI] No token set, skipping. Set DHAN_ACCESS_TOKEN env var.")
        return

    conn = sqlite3.connect(DB_PATH)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    total_rows = 0

    print(f"\n[Dhan OI] Fetching OI data for {len(security_ids)} instruments ({days} days)...")

    for sym, sec_id in security_ids.items():
        try:
            data = _dhan_post("/charts/historical", {
                "securityId": sec_id,
                "exchangeSegment": "NSE_EQ",
                "instrument": "EQUITY",
                "expiryCode": 0,
                "oi": True,
                "fromDate": start_date.strftime("%Y-%m-%d"),
                "toDate": end_date.strftime("%Y-%m-%d"),
            })

            if not data or "close" not in data:
                continue

            closes = data.get("close", [])
            ois = data.get("oi", [])
            timestamps = data.get("timestamp", data.get("start_Time", []))

            rows = []
            for i in range(len(closes)):
                if i < len(timestamps):
                    try:
                        ts = timestamps[i]
                        if isinstance(ts, (int, float)):
                            date_str = datetime.fromtimestamp(ts).strftime("%Y-%m-%d")
                        else:
                            date_str = str(ts)[:10]
                    except Exception:
                        continue

                    oi_val = int(ois[i]) if i < len(ois) and ois[i] else 0
                    oi_change = (oi_val - int(ois[i-1] or 0)) if i > 0 and i-1 < len(ois) else 0

                    rows.append((sym, date_str, oi_val, oi_change, 0))

            if rows:
                conn.executemany(
                    "INSERT OR REPLACE INTO daily_oi VALUES (?,?,?,?,?)",
                    rows
                )
                total_rows += len(rows)

            time.sleep(DHAN_RATE_DELAY)

        except Exception as e:
            print(f"  [WARN] {sym}: {e}")

    conn.commit()
    conn.close()
    print(f"[Dhan OI] Saved {total_rows:,} OI records")


def collect_dhan_option_chain_snapshot(security_ids: dict):
    """Fetch current option chain data for top stocks (aggregate metrics)."""
    if not DHAN_TOKEN:
        print("[Dhan Options] No token, skipping.")
        return

    conn = sqlite3.connect(DB_PATH)
    today = datetime.now().strftime("%Y-%m-%d")
    total = 0

    # Get nearest expiry from NIFTY
    expiry_data = _dhan_post("/optionchain/expirylist", {
        "UnderlyingScrip": 13,
        "UnderlyingSeg": "IDX_I",
    })
    expiries = expiry_data.get("data", expiry_data.get("expiryList", []))
    if not expiries:
        print("[Dhan Options] No expiries found")
        conn.close()
        return

    nearest_expiry = None
    for exp in sorted(expiries) if isinstance(expiries, list) else []:
        if exp >= today:
            nearest_expiry = exp
            break
    if not nearest_expiry:
        nearest_expiry = expiries[0] if expiries else None

    print(f"\n[Dhan Options] Fetching option chains (expiry: {nearest_expiry})...")

    for sym, sec_id in list(security_ids.items())[:50]:  # Top 50 to avoid rate limits
        try:
            seg = "IDX_I" if sym in FNO_INDICES else "NSE_EQ"
            oc_data = _dhan_post("/optionchain", {
                "UnderlyingScrip": int(sec_id),
                "UnderlyingSeg": seg,
                "Expiry": nearest_expiry,
            })

            chains = oc_data.get("data", oc_data.get("optionChain", []))
            if not isinstance(chains, list) or not chains:
                continue

            total_ce_oi = 0
            total_pe_oi = 0
            total_ce_vol = 0
            total_pe_vol = 0
            max_ce_oi = 0
            max_ce_strike = 0
            max_pe_oi = 0
            max_pe_strike = 0
            atm_iv = 0

            for strike in chains:
                sp = float(strike.get("strikePrice", strike.get("strike_price", 0)) or 0)
                ce_oi = int(strike.get("ce_oi", strike.get("ceOI", 0)) or 0)
                pe_oi = int(strike.get("pe_oi", strike.get("peOI", 0)) or 0)
                ce_vol = int(strike.get("ce_volume", strike.get("ceVolume", 0)) or 0)
                pe_vol = int(strike.get("pe_volume", strike.get("peVolume", 0)) or 0)

                total_ce_oi += ce_oi
                total_pe_oi += pe_oi
                total_ce_vol += ce_vol
                total_pe_vol += pe_vol

                if ce_oi > max_ce_oi:
                    max_ce_oi = ce_oi
                    max_ce_strike = sp
                if pe_oi > max_pe_oi:
                    max_pe_oi = pe_oi
                    max_pe_strike = sp

                iv = float(strike.get("ce_iv", strike.get("atm_iv", 0)) or 0)
                if iv > 0 and atm_iv == 0:
                    atm_iv = iv

            pcr = (total_pe_oi / total_ce_oi) if total_ce_oi > 0 else 0

            conn.execute(
                "INSERT OR REPLACE INTO daily_options_agg VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (sym, today, nearest_expiry, total_ce_oi, total_pe_oi,
                 round(pcr, 4), max_ce_strike, max_pe_strike, atm_iv,
                 total_ce_vol, total_pe_vol)
            )
            total += 1
            time.sleep(DHAN_RATE_DELAY)

        except Exception as e:
            print(f"  [WARN] {sym}: {e}")

    conn.commit()
    conn.close()
    print(f"[Dhan Options] Saved option chain data for {total} instruments")


# ══════════════════════════════════════════════════════════════
# SECTOR AGGREGATES
# ══════════════════════════════════════════════════════════════

def compute_sector_daily():
    """Compute daily sector returns and breadth from stock OHLCV data."""
    conn = sqlite3.connect(DB_PATH)

    print("\n[Sectors] Computing sector daily aggregates...")
    total = 0

    for sector, stocks in SECTOR_MAP.items():
        # Get all daily data for sector stocks
        placeholders = ",".join(["?"] * len(stocks))
        df = pd.read_sql_query(
            f"SELECT symbol, date, close FROM daily_ohlcv WHERE symbol IN ({placeholders}) ORDER BY date",
            conn, params=stocks
        )

        if df.empty:
            continue

        # Pivot to get per-stock close prices
        pivot = df.pivot(index="date", columns="symbol", values="close")
        returns = pivot.pct_change()

        rows = []
        for date in returns.index:
            day_returns = returns.loc[date].dropna()
            if len(day_returns) == 0:
                continue
            avg_ret = float(day_returns.mean())
            breadth = float((day_returns > 0).sum() / len(day_returns))
            rows.append((sector, date, round(avg_ret, 6), round(breadth, 4)))

        if rows:
            conn.executemany(
                "INSERT OR REPLACE INTO sector_daily VALUES (?,?,?,?)",
                rows
            )
            total += len(rows)

    conn.commit()
    conn.close()
    print(f"[Sectors] Saved {total:,} sector-day records for {len(SECTOR_MAP)} sectors")


# ══════════════════════════════════════════════════════════════
# INCREMENTAL UPDATE (daily)
# ══════════════════════════════════════════════════════════════

def incremental_update():
    """Fetch only the latest data (today + last 5 days for safety)."""
    conn = sqlite3.connect(DB_PATH)

    # Find latest date in DB
    result = conn.execute("SELECT MAX(date) FROM daily_ohlcv").fetchone()
    if result and result[0]:
        last_date = datetime.strptime(result[0], "%Y-%m-%d")
        days_behind = (datetime.now() - last_date).days
        if days_behind <= 1:
            print("[Update] Database is up to date")
            conn.close()
            return
        print(f"[Update] DB is {days_behind} days behind, fetching...")
    else:
        print("[Update] Empty DB, running full collection...")
        conn.close()
        run_full_collection()
        return

    conn.close()

    # Fetch last 10 days to fill gaps
    symbols_list = list(ALL_SYMBOLS.items())
    total_rows = 0
    conn = sqlite3.connect(DB_PATH)

    for batch_start in range(0, len(symbols_list), YAHOO_BATCH_SIZE):
        batch = symbols_list[batch_start:batch_start + YAHOO_BATCH_SIZE]
        yahoo_syms = [ys for _, ys in batch]

        try:
            data = yf.download(
                yahoo_syms,
                period="10d",
                group_by="ticker",
                auto_adjust=False,
                threads=True,
                progress=False,
            )

            for nse_sym, yahoo_sym in batch:
                try:
                    if len(batch) == 1:
                        df = data.copy()
                    else:
                        if yahoo_sym not in data.columns.get_level_values(0):
                            continue
                        df = data[yahoo_sym].copy()

                    df = df.dropna(subset=["Close"]).reset_index()
                    df.columns = [c.lower().replace(" ", "_") for c in df.columns]

                    for _, row in df.iterrows():
                        date_str = str(row["date"])[:10]
                        conn.execute(
                            "INSERT OR REPLACE INTO daily_ohlcv VALUES (?,?,?,?,?,?,?,?,?,?)",
                            (nse_sym, date_str,
                             float(row.get("open", 0) or 0),
                             float(row.get("high", 0) or 0),
                             float(row.get("low", 0) or 0),
                             float(row.get("close", 0) or 0),
                             float(row.get("adj_close", row.get("close", 0)) or 0),
                             int(row.get("volume", 0) or 0),
                             0, 0)
                        )
                        total_rows += 1
                except Exception:
                    pass

            conn.commit()
        except Exception as e:
            print(f"  [WARN] Batch update failed: {e}")

        time.sleep(YAHOO_RATE_DELAY)

    conn.close()
    print(f"[Update] Added {total_rows:,} rows")

    # Also update VIX and sectors
    collect_vix(years=1)
    compute_sector_daily()


# ══════════════════════════════════════════════════════════════
# FULL COLLECTION PIPELINE
# ══════════════════════════════════════════════════════════════

def run_full_collection():
    """Run the complete data collection pipeline."""
    start = time.time()
    print("=" * 60)
    print("  ML DATA COLLECTOR — Full Pipeline")
    print(f"  {len(ALL_SYMBOLS)} instruments × {HISTORY_YEARS} years")
    print("=" * 60)

    # 1. Init DB
    init_db()

    # 2. Yahoo OHLCV for all stocks + indices
    collect_yahoo_ohlcv(ALL_SYMBOLS, years=HISTORY_YEARS)

    # 3. VIX history
    collect_vix(years=HISTORY_YEARS)

    # 4. Sector aggregates
    compute_sector_daily()

    # 5. Dhan OI (if token available)
    if DHAN_TOKEN:
        # We need security IDs from the scrip master — for now use what Dhan gives us
        # The full scrip master mapping is in the Node.js dhan-scrip-cache
        print("\n[Dhan] OI collection requires security IDs — run with DHAN_ACCESS_TOKEN set")
        # collect_dhan_historical_oi(security_ids, days=365)
        # collect_dhan_option_chain_snapshot(security_ids)

    elapsed = time.time() - start
    print(f"\n{'=' * 60}")
    print(f"  COLLECTION COMPLETE in {elapsed:.0f}s ({elapsed/60:.1f}min)")

    # Summary
    conn = sqlite3.connect(DB_PATH)
    ohlcv_count = conn.execute("SELECT COUNT(*) FROM daily_ohlcv").fetchone()[0]
    symbols_count = conn.execute("SELECT COUNT(DISTINCT symbol) FROM daily_ohlcv").fetchone()[0]
    date_range = conn.execute("SELECT MIN(date), MAX(date) FROM daily_ohlcv").fetchone()
    vix_count = conn.execute("SELECT COUNT(*) FROM vix_daily").fetchone()[0]
    sector_count = conn.execute("SELECT COUNT(*) FROM sector_daily").fetchone()[0]
    conn.close()

    print(f"  OHLCV: {ohlcv_count:,} rows for {symbols_count} symbols")
    print(f"  Date range: {date_range[0]} → {date_range[1]}")
    print(f"  VIX: {vix_count:,} days")
    print(f"  Sector data: {sector_count:,} rows")
    db_size = os.path.getsize(DB_PATH) / (1024 * 1024)
    print(f"  DB size: {db_size:.1f} MB")
    print("=" * 60)


# ══════════════════════════════════════════════════════════════
# CLI
# ══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "full"

    if cmd == "full":
        run_full_collection()
    elif cmd == "update":
        init_db()
        incremental_update()
    elif cmd == "vix":
        init_db()
        collect_vix()
    elif cmd == "sectors":
        init_db()
        compute_sector_daily()
    elif cmd == "status":
        init_db()
        conn = sqlite3.connect(DB_PATH)
        print(f"OHLCV rows: {conn.execute('SELECT COUNT(*) FROM daily_ohlcv').fetchone()[0]:,}")
        print(f"Symbols: {conn.execute('SELECT COUNT(DISTINCT symbol) FROM daily_ohlcv').fetchone()[0]}")
        print(f"Date range: {conn.execute('SELECT MIN(date), MAX(date) FROM daily_ohlcv').fetchone()}")
        print(f"VIX days: {conn.execute('SELECT COUNT(*) FROM vix_daily').fetchone()[0]}")
        print(f"OI rows: {conn.execute('SELECT COUNT(*) FROM daily_oi').fetchone()[0]}")
        print(f"Options agg: {conn.execute('SELECT COUNT(*) FROM daily_options_agg').fetchone()[0]}")
        print(f"Sector rows: {conn.execute('SELECT COUNT(*) FROM sector_daily').fetchone()[0]}")
        conn.close()
    else:
        print("Usage: python data_collector.py [full|update|vix|sectors|status]")
