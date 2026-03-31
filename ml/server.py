"""
ML Prediction Server — Flask API for real-time inference.
The India scanner calls this to get ML scores for each symbol.
Also handles live data ingestion and model retraining.
"""
import os
import sys
import json
import sqlite3
import threading
import time
from datetime import datetime

from flask import Flask, jsonify, request
from flask_cors import CORS

from config import DB_PATH, MODEL_DIR, SERVER_HOST, SERVER_PORT
from train import load_models, predict, batch_predict
from features import compute_features_for_symbol
from data_collector import incremental_update, init_db

app = Flask(__name__)
CORS(app)

# Cache predictions in memory
_prediction_cache = {}
_cache_time = 0
CACHE_TTL = 300  # 5 min

# Model loaded flag
_models_loaded = False
_xgb = None
_lgb = None
_meta = None


def _ensure_models():
    """Load models into memory."""
    global _models_loaded, _xgb, _lgb, _meta
    if not _models_loaded:
        _xgb, _lgb, _meta = load_models()
        _models_loaded = _xgb is not None
    return _models_loaded


def _get_cached_predictions():
    """Return cached predictions or regenerate."""
    global _prediction_cache, _cache_time
    now = time.time()
    if _prediction_cache and now - _cache_time < CACHE_TTL:
        return _prediction_cache

    # Load from file
    pred_path = os.path.join(MODEL_DIR, "latest_predictions.json")
    if os.path.exists(pred_path):
        with open(pred_path) as f:
            data = json.load(f)
            _prediction_cache = data.get("predictions", {})
            _cache_time = now
            return _prediction_cache

    return {}


# ══════════════════════════════════════════════════════════════
# API ENDPOINTS
# ══════════════════════════════════════════════════════════════

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "models_loaded": _ensure_models(),
        "predictions_cached": len(_prediction_cache),
        "db_exists": os.path.exists(DB_PATH),
        "timestamp": datetime.now().isoformat(),
    })


@app.route("/predict/<symbol>", methods=["GET"])
def predict_symbol(symbol: str):
    """Get ML prediction for a single symbol."""
    symbol = symbol.upper()

    # Try cache first
    preds = _get_cached_predictions()
    if symbol in preds:
        return jsonify({"symbol": symbol, **preds[symbol], "source": "cache"})

    # Compute on the fly
    if not _ensure_models():
        return jsonify({"error": "No trained model available"}), 503

    try:
        conn = sqlite3.connect(DB_PATH)
        feat = compute_features_for_symbol(symbol, conn)
        conn.close()

        if feat.empty:
            return jsonify({"error": f"No data for {symbol}"}), 404

        latest = feat.iloc[-1].to_dict()
        feature_cols = _meta["feature_columns"]
        features_dict = {k: latest.get(k, 0) for k in feature_cols}

        result = predict(features_dict)
        return jsonify({"symbol": symbol, **result, "source": "live"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/predict/batch", methods=["GET", "POST"])
def predict_batch():
    """Get ML predictions for multiple symbols."""
    if request.method == "POST":
        body = request.get_json() or {}
        symbols = body.get("symbols")
    else:
        symbols_param = request.args.get("symbols", "")
        symbols = symbols_param.split(",") if symbols_param else None

    preds = _get_cached_predictions()

    if symbols:
        symbols = [s.strip().upper() for s in symbols]
        result = {s: preds.get(s, {"error": "no prediction"}) for s in symbols}
    else:
        result = preds

    return jsonify({
        "count": len(result),
        "predictions": result,
        "model_version": _meta.get("trained_at", "unknown") if _meta else "none",
        "timestamp": datetime.now().isoformat(),
    })


@app.route("/predict/top", methods=["GET"])
def predict_top():
    """Get top LONG and SHORT predictions sorted by confidence."""
    n = int(request.args.get("n", 10))
    min_conf = float(request.args.get("min_confidence", 0.4))

    preds = _get_cached_predictions()

    longs = [(s, p) for s, p in preds.items()
             if p.get("direction") == "LONG" and p.get("confidence", 0) >= min_conf]
    shorts = [(s, p) for s, p in preds.items()
              if p.get("direction") == "SHORT" and p.get("confidence", 0) >= min_conf]

    longs.sort(key=lambda x: x[1]["confidence"], reverse=True)
    shorts.sort(key=lambda x: x[1]["confidence"], reverse=True)

    return jsonify({
        "top_longs": [{"symbol": s, **p} for s, p in longs[:n]],
        "top_shorts": [{"symbol": s, **p} for s, p in shorts[:n]],
        "total_longs": len(longs),
        "total_shorts": len(shorts),
        "total_neutral": len(preds) - len(longs) - len(shorts),
    })


@app.route("/features/<symbol>", methods=["GET"])
def get_features(symbol: str):
    """Get computed features for a symbol (latest day)."""
    symbol = symbol.upper()
    try:
        conn = sqlite3.connect(DB_PATH)
        feat = compute_features_for_symbol(symbol, conn)
        conn.close()

        if feat.empty:
            return jsonify({"error": f"No data for {symbol}"}), 404

        latest = feat.iloc[-1]
        return jsonify({
            "symbol": symbol,
            "date": str(latest.name.date()),
            "features": {k: round(float(v), 6) if isinstance(v, (int, float)) and not pd.isna(v) else None
                         for k, v in latest.items()
                         if k != "symbol"},
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/retrain", methods=["POST"])
def retrain():
    """Trigger model retraining (runs in background)."""
    def _retrain():
        from train import run_full_training
        run_full_training()
        global _models_loaded, _prediction_cache, _cache_time
        _models_loaded = False
        _prediction_cache = {}
        _cache_time = 0
        _ensure_models()

    thread = threading.Thread(target=_retrain, daemon=True)
    thread.start()
    return jsonify({"status": "retraining started", "message": "Check /health for completion"})


@app.route("/update", methods=["POST"])
def update_data():
    """Trigger incremental data update."""
    def _update():
        init_db()
        incremental_update()
        # Regenerate predictions with new data
        batch_predict()
        global _prediction_cache, _cache_time
        _prediction_cache = {}
        _cache_time = 0

    thread = threading.Thread(target=_update, daemon=True)
    thread.start()
    return jsonify({"status": "data update started"})


@app.route("/status", methods=["GET"])
def status():
    """Database and model status."""
    info = {"db_exists": os.path.exists(DB_PATH)}

    if os.path.exists(DB_PATH):
        conn = sqlite3.connect(DB_PATH)
        info["ohlcv_rows"] = conn.execute("SELECT COUNT(*) FROM daily_ohlcv").fetchone()[0]
        info["symbols"] = conn.execute("SELECT COUNT(DISTINCT symbol) FROM daily_ohlcv").fetchone()[0]
        date_range = conn.execute("SELECT MIN(date), MAX(date) FROM daily_ohlcv").fetchone()
        info["date_range"] = {"from": date_range[0], "to": date_range[1]}
        info["vix_days"] = conn.execute("SELECT COUNT(*) FROM vix_daily").fetchone()[0]
        info["oi_rows"] = conn.execute("SELECT COUNT(*) FROM daily_oi").fetchone()[0]
        info["options_agg_rows"] = conn.execute("SELECT COUNT(*) FROM daily_options_agg").fetchone()[0]
        conn.close()

    meta_path = os.path.join(MODEL_DIR, "model_meta.json")
    if os.path.exists(meta_path):
        with open(meta_path) as f:
            meta = json.load(f)
            info["model"] = {
                "trained_at": meta.get("trained_at"),
                "samples": meta.get("samples"),
                "features": meta.get("features"),
                "top_features": [f["name"] for f in meta.get("top_30_features", [])[:10]],
            }

    pred_path = os.path.join(MODEL_DIR, "latest_predictions.json")
    if os.path.exists(pred_path):
        with open(pred_path) as f:
            pred_data = json.load(f)
            info["predictions"] = {
                "generated_at": pred_data.get("generated_at"),
                "count": pred_data.get("count"),
            }

    return jsonify(info)


# ══════════════════════════════════════════════════════════════
# LIVE FEED — Continuous data ingestion loop
# ══════════════════════════════════════════════════════════════

def start_live_feed(interval_minutes=60):
    """Background thread: update data and regenerate predictions periodically."""
    def _loop():
        while True:
            try:
                print(f"\n[LiveFeed] Updating data at {datetime.now().isoformat()}")
                init_db()
                incremental_update()
                batch_predict()
                global _prediction_cache, _cache_time
                _prediction_cache = {}
                _cache_time = 0
                print(f"[LiveFeed] Update complete. Next in {interval_minutes}min")
            except Exception as e:
                print(f"[LiveFeed] Error: {e}")
            time.sleep(interval_minutes * 60)

    thread = threading.Thread(target=_loop, daemon=True)
    thread.start()
    print(f"[LiveFeed] Started — updating every {interval_minutes}min")


# Need pandas for the features endpoint
import pandas as pd


# ══════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 60)
    print("  ML PREDICTION SERVER")
    print(f"  Port: {SERVER_PORT}")
    print("=" * 60)

    # Init
    init_db()
    _ensure_models()

    # Start live feed (update every 60 min during market hours)
    if "--live" in sys.argv:
        interval = int(sys.argv[sys.argv.index("--live") + 1]) if "--live" in sys.argv and len(sys.argv) > sys.argv.index("--live") + 1 else 60
        start_live_feed(interval)

    print(f"\nEndpoints:")
    print(f"  GET  /health              — Server health")
    print(f"  GET  /predict/<SYMBOL>    — Single prediction")
    print(f"  GET  /predict/batch       — All predictions")
    print(f"  GET  /predict/top?n=10    — Top signals")
    print(f"  GET  /features/<SYMBOL>   — Feature values")
    print(f"  POST /retrain             — Trigger retraining")
    print(f"  POST /update              — Trigger data update")
    print(f"  GET  /status              — DB & model status")

    app.run(host=SERVER_HOST, port=SERVER_PORT, debug=False)
