export type RiskRow = Record<string, any>;

let cachedFeatures: string[] | null = null;

/** Fetch the required feature names from backend once (cached). */
async function getRequiredFeatures(base: string): Promise<string[]> {
  if (cachedFeatures) return cachedFeatures;
  const r = await fetch(`${base}/required_features`);
  if (!r.ok) return [];
  const j = await r.json();
  cachedFeatures = j.required || [];
  return cachedFeatures;
}

/** Clean and map a row so it matches the model’s required features. */
function buildModelRow(row: Record<string, any>, required: string[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of required) {
    let v = row[key];
    if (typeof v === "string") {
      const s = v.trim().replace(/[%₹,$]/g, "");
      const n = Number(s);
      v = Number.isFinite(n) ? n : v;
    }
    out[key] = v;
  }
  if ("user_id" in row) out.user_id = String(row.user_id); // optional, for traceability
  return out;
}

export async function predictRisk(
  rows: RiskRow[],
  base = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000"
) {
  // fetch required features once
  const required = await getRequiredFeatures(base);

  // clean & build payload
  const payload = required.length
    ? rows.map(r => buildModelRow(r, required))
    : rows;

  const r = await fetch(`${base}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows: payload }),
  });
  if (!r.ok) throw new Error(await r.text());

  return r.json() as Promise<{
    results: { user_id: string; pd: number; risk_band: string; credit_score: number }[];
  }>;
}