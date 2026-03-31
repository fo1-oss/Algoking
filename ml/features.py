"""
Feature Engine — 87 ML features per symbol per day.
Categories: Price, Trend, Momentum, Volatility, Volume, Options/OI, Market Regime, Seasonal, Patterns.
"""
import sqlite3
import numpy as np
import pandas as pd
from datetime import datetime

from config import DB_PATH, SECTOR_MAP, FNO_INDICES

# Reverse sector map: stock → sector
STOCK_SECTOR = {}
for sector, stocks in SECTOR_MAP.items():
    for s in stocks:
        STOCK_SECTOR[s] = sector


# ══════════════════════════════════════════════════════════════
# INDICATOR HELPERS
# ══════════════════════════════════════════════════════════════

def sma(s: pd.Series, period: int) -> pd.Series:
    return s.rolling(period, min_periods=period).mean()

def ema(s: pd.Series, period: int) -> pd.Series:
    return s.ewm(span=period, adjust=False).mean()

def rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.rolling(period, min_periods=period).mean()
    avg_loss = loss.rolling(period, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))

def macd(close: pd.Series, fast=12, slow=26, signal=9):
    ema_fast = ema(close, fast)
    ema_slow = ema(close, slow)
    macd_line = ema_fast - ema_slow
    signal_line = ema(macd_line, signal)
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram

def bollinger_bands(close: pd.Series, period=20, std_dev=2):
    mid = sma(close, period)
    std = close.rolling(period, min_periods=period).std()
    upper = mid + std_dev * std
    lower = mid - std_dev * std
    width = (upper - lower) / mid
    position = (close - lower) / (upper - lower)
    return width, position

def atr(high: pd.Series, low: pd.Series, close: pd.Series, period=14) -> pd.Series:
    prev_close = close.shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low - prev_close).abs(),
    ], axis=1).max(axis=1)
    return tr.rolling(period, min_periods=period).mean()

def stochastic(high: pd.Series, low: pd.Series, close: pd.Series, k_period=14, d_period=3):
    lowest_low = low.rolling(k_period, min_periods=k_period).min()
    highest_high = high.rolling(k_period, min_periods=k_period).max()
    k = 100 * (close - lowest_low) / (highest_high - lowest_low).replace(0, np.nan)
    d = k.rolling(d_period, min_periods=d_period).mean()
    return k, d

def obv(close: pd.Series, volume: pd.Series) -> pd.Series:
    direction = np.sign(close.diff())
    direction.iloc[0] = 0
    return (volume * direction).cumsum()

def mfi(high: pd.Series, low: pd.Series, close: pd.Series, volume: pd.Series, period=14) -> pd.Series:
    tp = (high + low + close) / 3
    mf = tp * volume
    delta = tp.diff()
    pos_mf = mf.where(delta > 0, 0).rolling(period, min_periods=period).sum()
    neg_mf = mf.where(delta <= 0, 0).rolling(period, min_periods=period).sum()
    ratio = pos_mf / neg_mf.replace(0, np.nan)
    return 100 - (100 / (1 + ratio))

def cci(high: pd.Series, low: pd.Series, close: pd.Series, period=20) -> pd.Series:
    tp = (high + low + close) / 3
    tp_sma = sma(tp, period)
    mean_dev = tp.rolling(period, min_periods=period).apply(lambda x: np.abs(x - x.mean()).mean())
    return (tp - tp_sma) / (0.015 * mean_dev).replace(0, np.nan)

def williams_r(high: pd.Series, low: pd.Series, close: pd.Series, period=14) -> pd.Series:
    hh = high.rolling(period, min_periods=period).max()
    ll = low.rolling(period, min_periods=period).min()
    return -100 * (hh - close) / (hh - ll).replace(0, np.nan)

def adx(high: pd.Series, low: pd.Series, close: pd.Series, period=14) -> pd.Series:
    plus_dm = high.diff().clip(lower=0)
    minus_dm = (-low.diff()).clip(lower=0)
    # When plus_dm > minus_dm, keep plus_dm, else 0
    plus_dm = plus_dm.where(plus_dm > minus_dm, 0)
    minus_dm = minus_dm.where(minus_dm > plus_dm, 0)

    atr_val = atr(high, low, close, period)
    plus_di = 100 * ema(plus_dm, period) / atr_val.replace(0, np.nan)
    minus_di = 100 * ema(minus_dm, period) / atr_val.replace(0, np.nan)
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
    return ema(dx, period)


# ══════════════════════════════════════════════════════════════
# MAIN FEATURE COMPUTATION
# ══════════════════════════════════════════════════════════════

def compute_features_for_symbol(symbol: str, conn: sqlite3.Connection) -> pd.DataFrame:
    """Compute all 87 features for a single symbol. Returns DataFrame indexed by date."""

    # Load OHLCV
    df = pd.read_sql_query(
        "SELECT date, open, high, low, close, adj_close, volume FROM daily_ohlcv "
        "WHERE symbol = ? ORDER BY date",
        conn, params=(symbol,)
    )
    if len(df) < 220:  # Need ~200 days for SMA200
        return pd.DataFrame()

    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date").sort_index()

    o, h, l, c, v = df["open"], df["high"], df["low"], df["close"], df["volume"]
    ac = df["adj_close"]

    features = pd.DataFrame(index=df.index)
    features["symbol"] = symbol

    # ═══════ PRICE FEATURES (10) ═══════
    features["return_1d"] = c.pct_change(1)
    features["return_5d"] = c.pct_change(5)
    features["return_10d"] = c.pct_change(10)
    features["return_20d"] = c.pct_change(20)
    features["return_60d"] = c.pct_change(60)
    features["log_return_1d"] = np.log(c / c.shift(1))
    features["gap_pct"] = (o - c.shift(1)) / c.shift(1)
    features["intraday_range"] = (h - l) / c
    features["upper_shadow"] = (h - c.clip(lower=o)) / (h - l).replace(0, np.nan)
    features["lower_shadow"] = (c.clip(upper=o) - l) / (h - l).replace(0, np.nan)

    # ═══════ TREND FEATURES (12) ═══════
    for p in [5, 10, 20, 50, 100, 200]:
        features[f"sma_{p}_ratio"] = c / sma(c, p)
    for p in [9, 21]:
        features[f"ema_{p}_ratio"] = c / ema(c, p)
    features["sma20_sma50_ratio"] = sma(c, 20) / sma(c, 50)
    features["sma50_sma200_ratio"] = sma(c, 50) / sma(c, 200)
    features["pct_from_52w_high"] = c / c.rolling(252, min_periods=200).max() - 1
    features["pct_from_52w_low"] = c / c.rolling(252, min_periods=200).min() - 1

    # ═══════ MOMENTUM FEATURES (10) ═══════
    features["rsi_14"] = rsi(c, 14)
    features["rsi_7"] = rsi(c, 7)
    macd_line, macd_sig, macd_hist = macd(c)
    features["macd_signal_diff"] = (macd_line - macd_sig) / c  # Normalized
    features["macd_histogram"] = macd_hist / c
    stoch_k, stoch_d = stochastic(h, l, c)
    features["stochastic_k"] = stoch_k
    features["stochastic_d"] = stoch_d
    features["roc_10"] = c.pct_change(10)
    features["cci_20"] = cci(h, l, c, 20)
    features["williams_r"] = williams_r(h, l, c)
    features["momentum_10"] = c / c.shift(10) - 1

    # ═══════ VOLATILITY FEATURES (10) ═══════
    atr_14 = atr(h, l, c, 14)
    features["atr_14"] = atr_14
    features["atr_ratio"] = atr_14 / c
    bb_width, bb_pos = bollinger_bands(c)
    features["bb_width"] = bb_width
    features["bb_position"] = bb_pos
    features["hist_vol_20d"] = features["log_return_1d"].rolling(20, min_periods=15).std() * np.sqrt(252)
    features["hist_vol_60d"] = features["log_return_1d"].rolling(60, min_periods=40).std() * np.sqrt(252)
    features["vol_ratio_20_60"] = features["hist_vol_20d"] / features["hist_vol_60d"].replace(0, np.nan)
    features["true_range_pct"] = (h - l) / c
    features["avg_range_5d"] = features["true_range_pct"].rolling(5).mean()
    features["vol_expansion"] = features["hist_vol_20d"] / features["hist_vol_20d"].rolling(60, min_periods=30).mean()

    # ═══════ VOLUME FEATURES (8) ═══════
    vol_sma20 = sma(v.astype(float), 20)
    features["volume_ratio_20d"] = v / vol_sma20.replace(0, np.nan)
    features["volume_sma10_ratio"] = v / sma(v.astype(float), 10).replace(0, np.nan)
    obv_series = obv(c, v.astype(float))
    features["obv_slope_10d"] = obv_series.diff(10) / obv_series.shift(10).abs().replace(0, np.nan)
    features["volume_price_trend"] = (v * c.pct_change()).cumsum()
    features["mfi_14"] = mfi(h, l, c, v.astype(float))
    features["volume_change_5d"] = v.pct_change(5)
    # Buy-sell volume estimation
    features["buy_volume_pct"] = (c - l) / (h - l).replace(0, np.nan)
    features["volume_trend_20d"] = v.rolling(20).apply(
        lambda x: np.polyfit(range(len(x)), x, 1)[0] / x.mean() if x.mean() > 0 else 0,
        raw=True
    )

    # ═══════ OPTIONS / OI FEATURES (12) ═══════
    # Load OI data
    oi_df = pd.read_sql_query(
        "SELECT date, oi, oi_change FROM daily_oi WHERE symbol = ? ORDER BY date",
        conn, params=(symbol,)
    )
    if not oi_df.empty:
        oi_df["date"] = pd.to_datetime(oi_df["date"])
        oi_df = oi_df.set_index("date")
        features["oi"] = oi_df["oi"]
        features["oi_change_1d"] = oi_df["oi_change"]
        features["oi_change_pct"] = oi_df["oi"].pct_change()
        features["oi_change_5d"] = oi_df["oi"].pct_change(5)
        # OI-price divergence: price up + OI up = bullish continuation
        features["oi_price_divergence"] = np.sign(features["return_1d"]) * np.sign(features["oi_change_pct"])
    else:
        for col in ["oi", "oi_change_1d", "oi_change_pct", "oi_change_5d", "oi_price_divergence"]:
            features[col] = np.nan

    # Load options aggregate
    opt_df = pd.read_sql_query(
        "SELECT date, pcr, total_ce_oi, total_pe_oi, max_ce_oi_strike, max_pe_oi_strike, atm_iv "
        "FROM daily_options_agg WHERE symbol = ? ORDER BY date",
        conn, params=(symbol,)
    )
    if not opt_df.empty:
        opt_df["date"] = pd.to_datetime(opt_df["date"])
        opt_df = opt_df.set_index("date")
        features["pcr"] = opt_df["pcr"]
        features["pcr_change_5d"] = opt_df["pcr"].diff(5)
        features["atm_iv"] = opt_df["atm_iv"]
        features["iv_change_5d"] = opt_df["atm_iv"].diff(5)
        features["max_ce_oi_dist"] = (c - opt_df["max_ce_oi_strike"]) / c  # Negative = below resistance
        features["max_pe_oi_dist"] = (c - opt_df["max_pe_oi_strike"]) / c  # Positive = above support
        features["iv_percentile_30d"] = opt_df["atm_iv"].rolling(30, min_periods=10).apply(
            lambda x: (x.iloc[-1] > x).sum() / len(x) if len(x) > 0 else 0.5
        )
    else:
        for col in ["pcr", "pcr_change_5d", "atm_iv", "iv_change_5d",
                     "max_ce_oi_dist", "max_pe_oi_dist", "iv_percentile_30d"]:
            features[col] = np.nan

    # ═══════ MARKET REGIME FEATURES (8) ═══════
    vix_df = pd.read_sql_query(
        "SELECT date, close as vix_close FROM vix_daily ORDER BY date", conn
    )
    if not vix_df.empty:
        vix_df["date"] = pd.to_datetime(vix_df["date"])
        vix_df = vix_df.set_index("date")
        features["vix_level"] = vix_df["vix_close"]
        features["vix_change_1d"] = vix_df["vix_close"].pct_change()
        features["vix_percentile_30d"] = vix_df["vix_close"].rolling(30, min_periods=10).apply(
            lambda x: (x.iloc[-1] > x).sum() / len(x) if len(x) > 0 else 0.5
        )
    else:
        features["vix_level"] = np.nan
        features["vix_change_1d"] = np.nan
        features["vix_percentile_30d"] = np.nan

    # Nifty correlation
    nifty_df = pd.read_sql_query(
        "SELECT date, close FROM daily_ohlcv WHERE symbol = 'NIFTY' ORDER BY date", conn
    )
    if not nifty_df.empty:
        nifty_df["date"] = pd.to_datetime(nifty_df["date"])
        nifty_df = nifty_df.set_index("date")
        nifty_ret = nifty_df["close"].pct_change()
        features["nifty_return_1d"] = nifty_ret
        features["nifty_rsi"] = rsi(nifty_df["close"], 14)
        # 20-day rolling correlation with Nifty
        stock_ret = c.pct_change()
        features["corr_nifty_20d"] = stock_ret.rolling(20, min_periods=15).corr(nifty_ret)
    else:
        features["nifty_return_1d"] = np.nan
        features["nifty_rsi"] = np.nan
        features["corr_nifty_20d"] = np.nan

    # Sector relative strength
    sector = STOCK_SECTOR.get(symbol)
    if sector:
        sector_df = pd.read_sql_query(
            "SELECT date, avg_return, breadth FROM sector_daily WHERE sector = ? ORDER BY date",
            conn, params=(sector,)
        )
        if not sector_df.empty:
            sector_df["date"] = pd.to_datetime(sector_df["date"])
            sector_df = sector_df.set_index("date")
            features["sector_return"] = sector_df["avg_return"]
            features["sector_breadth"] = sector_df["breadth"]
        else:
            features["sector_return"] = np.nan
            features["sector_breadth"] = np.nan
    else:
        features["sector_return"] = np.nan
        features["sector_breadth"] = np.nan

    # ═══════ SEASONAL FEATURES (8) ═══════
    features["day_of_week"] = features.index.dayofweek  # 0=Mon, 4=Fri
    features["month"] = features.index.month
    features["is_monday"] = (features.index.dayofweek == 0).astype(int)
    features["is_friday"] = (features.index.dayofweek == 4).astype(int)
    features["is_month_end"] = features.index.is_month_end.astype(int)
    features["is_month_start"] = features.index.is_month_start.astype(int)
    # Expiry proximity (rough: last Thursday of month for monthly)
    features["day_of_month"] = features.index.day
    features["days_to_month_end"] = features.index.to_series().apply(
        lambda d: (d.replace(day=28) + pd.Timedelta(days=4)).replace(day=1) - pd.Timedelta(days=1) - d
    ).dt.days

    # ═══════ PATTERN FEATURES (5) ═══════
    features["consecutive_up_days"] = (features["return_1d"] > 0).rolling(10, min_periods=1).apply(
        lambda x: _count_consecutive_end(x), raw=True
    )
    features["consecutive_down_days"] = (features["return_1d"] < 0).rolling(10, min_periods=1).apply(
        lambda x: _count_consecutive_end(x), raw=True
    )
    # Inside bar: today's range inside yesterday's
    features["inside_bar"] = ((h < h.shift(1)) & (l > l.shift(1))).astype(int)
    # Engulfing: today's range engulfs yesterday's
    features["engulfing"] = ((h > h.shift(1)) & (l < l.shift(1))).astype(int)
    # Doji: open ≈ close, small body
    body_size = (c - o).abs() / (h - l).replace(0, np.nan)
    features["doji"] = (body_size < 0.1).astype(int)

    # ═══════ DERIVED / INTERACTION FEATURES (5) ═══════
    features["rsi_x_volume"] = features["rsi_14"] * features["volume_ratio_20d"]
    features["trend_alignment"] = (
        (c > sma(c, 20)).astype(int) +
        (c > sma(c, 50)).astype(int) +
        (c > sma(c, 100)).astype(int) +
        (c > sma(c, 200)).astype(int)
    ) / 4  # 0-1 scale
    features["volatility_regime"] = pd.cut(
        features["hist_vol_20d"],
        bins=[0, 0.15, 0.30, 0.50, float("inf")],
        labels=[0, 1, 2, 3],
        include_lowest=True
    ).astype(float)
    features["mean_reversion_score"] = (
        (50 - features["rsi_14"]).abs() / 50 * 0.5 +
        features["bb_position"].clip(0, 1).apply(lambda x: abs(0.5 - x)) * 0.5
    )
    features["adx_trend"] = adx(h, l, c)

    # ═══════ TARGET VARIABLES ═══════
    # Forward returns for ML targets
    features["target_return_1d"] = c.pct_change(1).shift(-1)
    features["target_return_5d"] = c.pct_change(5).shift(-5)
    # Max favorable move in next 5 days
    for fwd in range(1, 6):
        features[f"_fwd_high_{fwd}"] = h.shift(-fwd)
        features[f"_fwd_low_{fwd}"] = l.shift(-fwd)

    fwd_highs = features[[f"_fwd_high_{i}" for i in range(1, 6)]].max(axis=1)
    fwd_lows = features[[f"_fwd_low_{i}" for i in range(1, 6)]].min(axis=1)
    features["target_max_up_5d"] = (fwd_highs - c) / c
    features["target_max_down_5d"] = (c - fwd_lows) / c

    # Direction label: 1=LONG, 0=NEUTRAL, -1=SHORT
    threshold = 0.005  # 0.5%
    features["target_direction_5d"] = np.where(
        features["target_return_5d"] > threshold, 1,
        np.where(features["target_return_5d"] < -threshold, -1, 0)
    )

    # Clean up temp columns
    features = features.drop(columns=[f"_fwd_high_{i}" for i in range(1, 6)] +
                                     [f"_fwd_low_{i}" for i in range(1, 6)], errors="ignore")

    return features


def _count_consecutive_end(arr):
    """Count consecutive True values at the end of array."""
    count = 0
    for val in reversed(arr):
        if val:
            count += 1
        else:
            break
    return count


# ══════════════════════════════════════════════════════════════
# BATCH FEATURE COMPUTATION
# ══════════════════════════════════════════════════════════════

def compute_all_features(symbols: list = None) -> pd.DataFrame:
    """Compute features for all (or specified) symbols. Returns combined DataFrame."""
    conn = sqlite3.connect(DB_PATH)

    if symbols is None:
        result = conn.execute("SELECT DISTINCT symbol FROM daily_ohlcv").fetchall()
        symbols = [r[0] for r in result]

    all_features = []
    total = len(symbols)

    print(f"\n[Features] Computing 87 features for {total} symbols...")

    for i, sym in enumerate(symbols):
        if (i + 1) % 20 == 0 or i == 0:
            print(f"  [{(i+1)/total*100:.0f}%] Processing {sym} ({i+1}/{total})")

        try:
            feat = compute_features_for_symbol(sym, conn)
            if not feat.empty:
                all_features.append(feat)
        except Exception as e:
            print(f"  [WARN] {sym}: {e}")

    conn.close()

    if not all_features:
        return pd.DataFrame()

    combined = pd.concat(all_features, axis=0)
    print(f"[Features] Done! {len(combined):,} rows × {len(combined.columns)} columns "
          f"for {len(all_features)} symbols")

    return combined


def get_feature_columns() -> list:
    """Return list of feature column names (excluding symbol and targets)."""
    exclude = {"symbol", "target_return_1d", "target_return_5d",
               "target_max_up_5d", "target_max_down_5d", "target_direction_5d"}
    # Generate a dummy to get column names
    conn = sqlite3.connect(DB_PATH)
    result = conn.execute("SELECT DISTINCT symbol FROM daily_ohlcv LIMIT 1").fetchone()
    conn.close()

    if not result:
        return []

    conn = sqlite3.connect(DB_PATH)
    df = compute_features_for_symbol(result[0], conn)
    conn.close()

    if df.empty:
        return []

    return [c for c in df.columns if c not in exclude]


# ══════════════════════════════════════════════════════════════
# CLI
# ══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import sys

    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"

    if cmd == "all":
        df = compute_all_features()
        if not df.empty:
            out_path = f"{DB_PATH.replace('.db', '')}_features.parquet"
            df.to_parquet(out_path)
            print(f"Saved to {out_path}")
    elif cmd == "single":
        sym = sys.argv[2] if len(sys.argv) > 2 else "RELIANCE"
        conn = sqlite3.connect(DB_PATH)
        df = compute_features_for_symbol(sym, conn)
        conn.close()
        print(f"\n{sym}: {len(df)} rows × {len(df.columns)} features")
        print(df.tail(3).T)
    elif cmd == "columns":
        cols = get_feature_columns()
        print(f"\n{len(cols)} feature columns:")
        for c in cols:
            print(f"  {c}")
    else:
        print("Usage: python features.py [all|single <SYMBOL>|columns]")
