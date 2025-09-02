# api/app.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import joblib, pandas as pd, numpy as np

MODEL_PATH = "model_pipeline.pkl"

# ---- Load pipeline ----
try:
    PIPE = joblib.load(MODEL_PATH)
except Exception as e:
    raise RuntimeError(f"Failed to load model: {e}")

FEATURE_ORDER: List[str] = list(getattr(PIPE, "feature_names_in_", []))

# ---- Schema: numeric vs categorical ----
NUMERIC_FEATURES = {
    "age","avg_recharge_amt","recharge_freq","data_usage_MB","calls_peak_hours",
    "avg_days_late","payment_delay_ratio","avg_payment_due","avg_payment_made",
    "payment_to_due_ratio","sms_bank_count","sms_otp_count","sms_other_count",
    "sms_promotional_count","sms_upi_count","sms_fin_txn_count",
    "cart_abandonment_rate","avg_order_value","return_rate","geo_variance_score",
    "months_active","employer_count"
}
CATEGORICAL_FEATURES = set(FEATURE_ORDER) - NUMERIC_FEATURES if FEATURE_ORDER else {
    "location","employment_type","salary_band"
}

# ---- Helpers ----
def band(pd_: float) -> str:
    if pd_ < 0.10: return "Very Low"
    if pd_ < 0.20: return "Low"
    if pd_ < 0.35: return "Medium"
    if pd_ < 0.50: return "High"
    return "Very High"

def pd_to_score(pd_: float) -> int:
    score = 900 - int(round(pd_ * 600))
    return max(300, min(900, score))

def normalize_strings(df: pd.DataFrame) -> pd.DataFrame:
    """
    1) Normalize placeholders to NaN (none, null, nan, n/a)
    2) Convert CSV-like numerics ('1,200', '₹350', '$5.20', '12%') where possible
    Only overwrites cells that successfully parse as numeric.
    """
    out = df.copy()

    # placeholders -> NaN
    placeholders = {"", "none", "null", "nan", "na", "n/a"}
    for col in out.columns:
        if out[col].dtype == object:
            s = out[col].astype(str).str.strip()
            out[col] = s.where(~s.str.lower().isin(placeholders), np.nan)

    # numeric-like strings -> numbers
    obj_cols = out.select_dtypes(include=["object"]).columns
    for col in obj_cols:
        s = out[col].astype(str).str.strip()
        s2 = s.str.replace(r"[₹$,]", "", regex=True)  # remove currency/separators
        pct = s2.str.endswith("%", na=False)
        s2 = s2.where(~pct, s2.str.removesuffix("%"))
        nums = pd.to_numeric(s2, errors="coerce")
        nums = nums.where(~pct, nums / 100.0)  # 12% -> 0.12
        out[col] = nums.where(nums.notna(), out[col])  # only replace when parsed
    return out

def cast_schema(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()

    # Numerics: float64 + fillna(0.0)
    num_cols = sorted(NUMERIC_FEATURES & set(out.columns))
    for c in num_cols:
        out[c] = pd.to_numeric(out[c], errors="coerce").astype("float64")
    if num_cols:
        out[num_cols] = out[num_cols].fillna(0.0)

    # Categoricals: plain object + "unknown" for missing
    cat_cols = sorted(CATEGORICAL_FEATURES & set(out.columns))
    for c in cat_cols:
        out[c] = out[c].astype("object")
        out[c] = out[c].where(out[c].notna(), "unknown")

    return out

def validate_dtypes(df: pd.DataFrame):
    if FEATURE_ORDER:
        missing = [c for c in FEATURE_ORDER if c not in df.columns]
        if missing:
            raise HTTPException(400, f"Missing required columns: {missing}")

    wrong = []
    for col in NUMERIC_FEATURES & set(df.columns):
        if not np.issubdtype(df[col].dtype, np.number):
            wrong.append((col, str(df[col].dtype)))
    if wrong:
        details = ", ".join([f"{c} (dtype={t})" for c, t in wrong])
        raise HTTPException(400, f"Numeric columns not numeric after casting: {details}")

# ---- Schemas ----
class PredictRows(BaseModel):
    rows: List[Dict[str, Any]]

class PredictionResult(BaseModel):
    user_id: str
    pd: float
    risk_band: str
    credit_score: int

class PredictResponse(BaseModel):
    results: List[PredictionResult]

# ---- App ----
app = FastAPI(title="FinShield Credit Risk API", version="1.4")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten for prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"ok": True, "feature_order_known": bool(FEATURE_ORDER)}

@app.get("/required_features")
def required_features():
    return {"required": FEATURE_ORDER, "count": len(FEATURE_ORDER)}

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRows):
    if not req.rows:
        raise HTTPException(400, "No rows provided")

    df = pd.DataFrame(req.rows)

    # Drop accidental labels
    for label_col in ["default_flag", "target", "label"]:
        if label_col in df.columns:
            df = df.drop(columns=[label_col])

    # 1) normalize strings (placeholders, ₹, %, commas)
    df = normalize_strings(df)

    # 2) enforce exact feature order (if pipeline exposes it)
    if FEATURE_ORDER:
        missing = [c for c in FEATURE_ORDER if c not in df.columns]
        if missing:
            raise HTTPException(400, f"Missing required columns: {missing}. Expected exactly {FEATURE_ORDER}")
        df = df[FEATURE_ORDER]

    # 3) cast to strict schema
    df = cast_schema(df)

    # 4) validate before inference (avoids ufunc isnan surprises)
    validate_dtypes(df)

    # Predict
    try:
        if hasattr(PIPE, "predict_proba"):
            proba = np.asarray(PIPE.predict_proba(df))
            pd_vals = proba[:, 1] if proba.ndim == 2 and proba.shape[1] >= 2 else np.squeeze(proba)
        else:
            pd_vals = np.clip(PIPE.predict(df), 0.0, 1.0)
    except Exception as e:
        # Uncomment for deep debug:
        # print("DTYPES:\n", df.dtypes)
        raise HTTPException(400, f"Inference error: {type(e).__name__}: {e}")

    results = []
    for row, pd_ in zip(req.rows, pd_vals):
        pd_f = float(pd_)
        results.append({
            "user_id": str(row.get("user_id", "")),
            "pd": pd_f,
            "risk_band": band(pd_f),
            "credit_score": pd_to_score(pd_f),
        })
    return {"results": results}