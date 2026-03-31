"""
ML Trainer — XGBoost + LightGBM ensemble with walk-forward validation.
Trains on 4yr rolling window, tests on next month, walks forward.
Outputs: saved model, feature importances, performance metrics.
"""
import os
import sys
import json
import time
import sqlite3
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import joblib
from datetime import datetime, timedelta

from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    classification_report, confusion_matrix
)
from sklearn.preprocessing import LabelEncoder

from config import (
    DB_PATH, MODEL_DIR, DATA_DIR,
    XGBOOST_PARAMS, LIGHTGBM_PARAMS,
    TRAIN_YEARS, TEST_MONTHS, MIN_SAMPLES,
)
from features import compute_all_features, get_feature_columns

# ══════════════════════════════════════════════════════════════
# DATA PREPARATION
# ══════════════════════════════════════════════════════════════

def prepare_training_data(df: pd.DataFrame = None):
    """Load features and prepare for training."""
    if df is None:
        # Try loading from parquet first
        parquet_path = os.path.join(DATA_DIR, "market_data_features.parquet")
        if os.path.exists(parquet_path):
            print(f"[Data] Loading from {parquet_path}")
            df = pd.read_parquet(parquet_path)
        else:
            print("[Data] Computing features from scratch...")
            df = compute_all_features()
            if not df.empty:
                df.to_parquet(parquet_path)
                print(f"[Data] Saved to {parquet_path}")

    if df.empty:
        print("[ERROR] No data available for training")
        return None, None, None

    # Target column
    target_col = "target_direction_5d"
    if target_col not in df.columns:
        print(f"[ERROR] Target column {target_col} not found")
        return None, None, None

    # Feature columns (exclude symbol, targets, and date-derived)
    exclude = {"symbol", "target_return_1d", "target_return_5d",
               "target_max_up_5d", "target_max_down_5d", "target_direction_5d"}
    feature_cols = [c for c in df.columns if c not in exclude and df[c].dtype in [np.float64, np.float32, np.int64, np.int32, float, int]]

    print(f"[Data] {len(df):,} rows × {len(feature_cols)} features")
    print(f"[Data] Date range: {df.index.min()} → {df.index.max()}")

    # Drop rows with target NaN
    mask = df[target_col].notna()
    df = df[mask].copy()

    # Map target: -1→0, 0→1, 1→2 for XGBoost multiclass
    target_map = {-1: 0, 0: 1, 1: 2}
    y = df[target_col].map(target_map).astype(int)
    X = df[feature_cols].copy()

    # Replace inf with nan, then fill
    X = X.replace([np.inf, -np.inf], np.nan)
    X = X.fillna(0)

    print(f"[Data] Class distribution: SHORT={sum(y==0):,} NEUTRAL={sum(y==1):,} LONG={sum(y==2):,}")

    return X, y, feature_cols


# ══════════════════════════════════════════════════════════════
# WALK-FORWARD VALIDATION
# ══════════════════════════════════════════════════════════════

def walk_forward_validation(X: pd.DataFrame, y: pd.Series, feature_cols: list):
    """Walk-forward validation: train on N years, test on next month, roll forward."""
    print(f"\n[WF] Walk-Forward Validation")
    print(f"  Train window: {TRAIN_YEARS} years, Test window: {TEST_MONTHS} month(s)")

    dates = X.index.sort_values().unique()
    train_days = TRAIN_YEARS * 252
    test_days = TEST_MONTHS * 21

    results = []
    all_preds = []
    fold = 0

    start_idx = train_days
    while start_idx + test_days <= len(dates):
        fold += 1
        train_end = dates[start_idx - 1]
        test_start = dates[start_idx]
        test_end_idx = min(start_idx + test_days, len(dates)) - 1
        test_end = dates[test_end_idx]

        train_mask = X.index <= train_end
        test_mask = (X.index >= test_start) & (X.index <= test_end)

        X_train, y_train = X[train_mask], y[train_mask]
        X_test, y_test = X[test_mask], y[test_mask]

        if len(X_train) < MIN_SAMPLES or len(X_test) < 10:
            start_idx += test_days
            continue

        # Train XGBoost
        xgb_params = XGBOOST_PARAMS.copy()
        xgb_params.pop("eval_metric", None)
        xgb = XGBClassifier(**xgb_params)
        xgb.fit(X_train[feature_cols], y_train, eval_set=[(X_test[feature_cols], y_test)], verbose=False)

        # Train LightGBM
        lgb_params = LIGHTGBM_PARAMS.copy()
        lgb = LGBMClassifier(**lgb_params)
        lgb.fit(X_train[feature_cols], y_train)

        # Ensemble predictions (average probabilities)
        xgb_proba = xgb.predict_proba(X_test[feature_cols])
        lgb_proba = lgb.predict_proba(X_test[feature_cols])
        ensemble_proba = (xgb_proba + lgb_proba) / 2
        ensemble_pred = ensemble_proba.argmax(axis=1)

        # Metrics
        acc = accuracy_score(y_test, ensemble_pred)
        f1 = f1_score(y_test, ensemble_pred, average="weighted", zero_division=0)

        results.append({
            "fold": fold,
            "train_end": str(train_end.date()),
            "test_start": str(test_start.date()),
            "test_end": str(test_end.date()),
            "train_size": len(X_train),
            "test_size": len(X_test),
            "accuracy": round(acc, 4),
            "f1_weighted": round(f1, 4),
        })

        # Store predictions for analysis
        for i, idx in enumerate(X_test.index):
            all_preds.append({
                "date": str(idx.date()),
                "actual": int(y_test.iloc[i]),
                "predicted": int(ensemble_pred[i]),
                "prob_short": round(float(ensemble_proba[i][0]), 4),
                "prob_neutral": round(float(ensemble_proba[i][1]), 4),
                "prob_long": round(float(ensemble_proba[i][2]), 4),
            })

        if fold % 5 == 0:
            print(f"  Fold {fold}: acc={acc:.3f} f1={f1:.3f} "
                  f"({str(test_start.date())}→{str(test_end.date())}, n={len(X_test)})")

        start_idx += test_days

    # Summary
    if results:
        avg_acc = np.mean([r["accuracy"] for r in results])
        avg_f1 = np.mean([r["f1_weighted"] for r in results])
        print(f"\n[WF] {len(results)} folds completed")
        print(f"  Average Accuracy: {avg_acc:.4f}")
        print(f"  Average F1 Score: {avg_f1:.4f}")

        # Save results
        results_path = os.path.join(MODEL_DIR, "wf_results.json")
        with open(results_path, "w") as f:
            json.dump({"summary": {"folds": len(results), "avg_accuracy": avg_acc, "avg_f1": avg_f1},
                        "folds": results}, f, indent=2)
        print(f"  Results saved to {results_path}")

    return results, all_preds


# ══════════════════════════════════════════════════════════════
# FINAL MODEL TRAINING
# ══════════════════════════════════════════════════════════════

def train_final_model(X: pd.DataFrame, y: pd.Series, feature_cols: list):
    """Train the final production models on ALL data."""
    print(f"\n[Train] Training final models on {len(X):,} samples...")

    X_feat = X[feature_cols].replace([np.inf, -np.inf], np.nan).fillna(0)

    # XGBoost
    xgb_params = XGBOOST_PARAMS.copy()
    xgb_params.pop("eval_metric", None)
    xgb = XGBClassifier(**xgb_params)
    xgb.fit(X_feat, y, verbose=False)

    # LightGBM
    lgb = LGBMClassifier(**LIGHTGBM_PARAMS)
    lgb.fit(X_feat, y)

    # Save models
    os.makedirs(MODEL_DIR, exist_ok=True)
    xgb_path = os.path.join(MODEL_DIR, "xgb_direction.joblib")
    lgb_path = os.path.join(MODEL_DIR, "lgb_direction.joblib")
    meta_path = os.path.join(MODEL_DIR, "model_meta.json")

    joblib.dump(xgb, xgb_path)
    joblib.dump(lgb, lgb_path)

    # Feature importances
    xgb_imp = dict(zip(feature_cols, xgb.feature_importances_.tolist()))
    lgb_imp = dict(zip(feature_cols, lgb.feature_importances_.tolist()))

    # Average importance
    avg_imp = {}
    for col in feature_cols:
        avg_imp[col] = (xgb_imp.get(col, 0) + lgb_imp.get(col, 0)) / 2

    top_features = sorted(avg_imp.items(), key=lambda x: x[1], reverse=True)[:30]

    meta = {
        "trained_at": datetime.now().isoformat(),
        "samples": len(X),
        "features": len(feature_cols),
        "feature_columns": feature_cols,
        "class_map": {"0": "SHORT", "1": "NEUTRAL", "2": "LONG"},
        "top_30_features": [{"name": n, "importance": round(v, 4)} for n, v in top_features],
        "xgb_path": xgb_path,
        "lgb_path": lgb_path,
    }

    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"[Train] Models saved:")
    print(f"  XGBoost: {xgb_path}")
    print(f"  LightGBM: {lgb_path}")
    print(f"  Metadata: {meta_path}")

    print(f"\n[Train] Top 15 features:")
    for name, imp in top_features[:15]:
        bar = "█" * int(imp * 100)
        print(f"  {name:30s} {imp:.4f} {bar}")

    return xgb, lgb, meta


# ══════════════════════════════════════════════════════════════
# PREDICTION
# ══════════════════════════════════════════════════════════════

def load_models():
    """Load saved models and metadata."""
    meta_path = os.path.join(MODEL_DIR, "model_meta.json")
    if not os.path.exists(meta_path):
        return None, None, None

    with open(meta_path) as f:
        meta = json.load(f)

    xgb = joblib.load(meta["xgb_path"])
    lgb = joblib.load(meta["lgb_path"])

    return xgb, lgb, meta


def predict(features_dict: dict) -> dict:
    """Make a prediction for a single symbol's features."""
    xgb, lgb, meta = load_models()
    if xgb is None:
        return {"error": "No trained model found"}

    feature_cols = meta["feature_columns"]
    X = pd.DataFrame([features_dict])[feature_cols]
    X = X.replace([np.inf, -np.inf], np.nan).fillna(0)

    xgb_proba = xgb.predict_proba(X)[0]
    lgb_proba = lgb.predict_proba(X)[0]
    ensemble_proba = (xgb_proba + lgb_proba) / 2

    pred_class = int(ensemble_proba.argmax())
    class_map = {0: "SHORT", 1: "NEUTRAL", 2: "LONG"}
    confidence = float(ensemble_proba.max())

    return {
        "direction": class_map[pred_class],
        "confidence": round(confidence, 4),
        "probabilities": {
            "SHORT": round(float(ensemble_proba[0]), 4),
            "NEUTRAL": round(float(ensemble_proba[1]), 4),
            "LONG": round(float(ensemble_proba[2]), 4),
        },
        "model_version": meta.get("trained_at", "unknown"),
    }


def batch_predict(symbols: list = None) -> dict:
    """Generate predictions for all (or specified) symbols using latest data."""
    xgb, lgb, meta = load_models()
    if xgb is None:
        return {"error": "No trained model found"}

    feature_cols = meta["feature_columns"]
    conn = sqlite3.connect(DB_PATH)

    if symbols is None:
        result = conn.execute("SELECT DISTINCT symbol FROM daily_ohlcv").fetchall()
        symbols = [r[0] for r in result]

    from features import compute_features_for_symbol

    predictions = {}
    for sym in symbols:
        try:
            feat = compute_features_for_symbol(sym, conn)
            if feat.empty:
                continue

            # Get latest row
            latest = feat.iloc[-1]
            X = pd.DataFrame([latest])[feature_cols]
            X = X.replace([np.inf, -np.inf], np.nan).fillna(0)

            xgb_proba = xgb.predict_proba(X)[0]
            lgb_proba = lgb.predict_proba(X)[0]
            ensemble_proba = (xgb_proba + lgb_proba) / 2

            pred_class = int(ensemble_proba.argmax())
            class_map = {0: "SHORT", 1: "NEUTRAL", 2: "LONG"}

            predictions[sym] = {
                "direction": class_map[pred_class],
                "confidence": round(float(ensemble_proba.max()), 4),
                "prob_short": round(float(ensemble_proba[0]), 4),
                "prob_neutral": round(float(ensemble_proba[1]), 4),
                "prob_long": round(float(ensemble_proba[2]), 4),
            }
        except Exception:
            pass

    conn.close()

    # Save predictions
    pred_path = os.path.join(MODEL_DIR, "latest_predictions.json")
    with open(pred_path, "w") as f:
        json.dump({
            "generated_at": datetime.now().isoformat(),
            "model_version": meta.get("trained_at", "unknown"),
            "count": len(predictions),
            "predictions": predictions,
        }, f, indent=2)

    print(f"[Predict] {len(predictions)} predictions saved to {pred_path}")
    return predictions


# ══════════════════════════════════════════════════════════════
# FULL PIPELINE
# ══════════════════════════════════════════════════════════════

def run_full_training():
    """End-to-end: load data → compute features → validate → train → predict."""
    start = time.time()
    print("=" * 60)
    print("  ML TRAINING PIPELINE")
    print("=" * 60)

    # 1. Prepare data
    X, y, feature_cols = prepare_training_data()
    if X is None:
        return

    # 2. Walk-forward validation
    wf_results, all_preds = walk_forward_validation(X, y, feature_cols)

    # 3. Train final model on all data
    xgb, lgb, meta = train_final_model(X, y, feature_cols)

    # 4. Generate batch predictions for all symbols
    predictions = batch_predict()

    elapsed = time.time() - start
    print(f"\n{'=' * 60}")
    print(f"  TRAINING COMPLETE in {elapsed:.0f}s ({elapsed/60:.1f}min)")

    # Top signals
    if predictions:
        longs = [(s, p) for s, p in predictions.items() if p["direction"] == "LONG"]
        shorts = [(s, p) for s, p in predictions.items() if p["direction"] == "SHORT"]
        longs.sort(key=lambda x: x[1]["confidence"], reverse=True)
        shorts.sort(key=lambda x: x[1]["confidence"], reverse=True)

        print(f"\n  Top 10 LONG signals:")
        for sym, pred in longs[:10]:
            print(f"    🟢 {sym:15s} conf={pred['confidence']:.2f} "
                  f"(L={pred['prob_long']:.2f} S={pred['prob_short']:.2f})")

        print(f"\n  Top 10 SHORT signals:")
        for sym, pred in shorts[:10]:
            print(f"    🔴 {sym:15s} conf={pred['confidence']:.2f} "
                  f"(S={pred['prob_short']:.2f} L={pred['prob_long']:.2f})")

    print("=" * 60)


# ══════════════════════════════════════════════════════════════
# CLI
# ══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "full"

    if cmd == "full":
        run_full_training()
    elif cmd == "predict":
        predictions = batch_predict()
        if isinstance(predictions, dict) and "error" not in predictions:
            print(f"\n{len(predictions)} predictions generated")
    elif cmd == "validate":
        X, y, feature_cols = prepare_training_data()
        if X is not None:
            walk_forward_validation(X, y, feature_cols)
    elif cmd == "features":
        X, y, feature_cols = prepare_training_data()
        if X is not None:
            print(f"\n{len(feature_cols)} features:")
            for c in feature_cols:
                print(f"  {c}")
    else:
        print("Usage: python train.py [full|predict|validate|features]")
