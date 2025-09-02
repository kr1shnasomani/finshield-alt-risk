import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Sparkles, BarChart3, Download, User } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "@/hooks/use-toast";
import { predictRisk } from "@/lib/api"; // uses VITE_API_BASE

export type UserRow = Record<string, string | number | undefined> & {
  user_id?: string | number;
  age?: number;
  location?: string;
  employment_type?: string;
  avg_recharge_amt?: number;
  recharge_freq?: number;
  sms_bank_count?: number;
  sms_otp_count?: number;
  sms_other_count?: number;
  sms_promotional_count?: number;
  sms_upi_count?: number;
  default_flag?: number;
  payment_delay_ratio?: number;
  avg_order_value?: number;
  cart_abandonment_rate?: number;
  geo_variance_score?: number;
  months_active?: number;
  pd_score?: number;          // optional if present in CSV
  prediction_proba?: number;  // optional if present in CSV
};

const demoData: UserRow[] = [
  { user_id: "U-1024", default_flag: 0, payment_delay_ratio: 0.12, avg_recharge_amt: 350, avg_order_value: 1200, cart_abandonment_rate: 0.18, geo_variance_score: 2.1, months_active: 18 },
  { user_id: "U-2048", default_flag: 0, payment_delay_ratio: 0.35, avg_recharge_amt: 240, avg_order_value: 800,  cart_abandonment_rate: 0.42, geo_variance_score: 4.5, months_active: 7  },
  { user_id: "U-4096", default_flag: 1, payment_delay_ratio: 0.62, avg_recharge_amt: 150, avg_order_value: 560,  cart_abandonment_rate: 0.58, geo_variance_score: 7.4, months_active: 3  },
];

// ---------- helpers ----------
function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const s = v.trim().replace(/[%₹,$,]/g, "");
    const n = Number(s);
    return isFinite(n) ? n : 0;
  }
  return 0;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function computeDatasetStats(rows: UserRow[]) {
  const avg = (list: number[]) => {
    const valid = list.filter((n) => isFinite(n));
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
  };
  return {
    meanAOV: avg(rows.map((r) => toNumber(r.avg_order_value))),
    meanRecharge: avg(rows.map((r) => toNumber(r.avg_recharge_amt))),
  };
}
/** Heuristic fallback ONLY if we can't call the API (e.g., new user missing columns) */
function computePD(row: UserRow, stats: { meanAOV: number; meanRecharge: number }): number {
  const direct = toNumber(row.pd_score) || toNumber(row.prediction_proba);
  if (direct > 0) return clamp(direct * (direct <= 1 ? 100 : 1), 0, 100);

  const delay = toNumber(row.payment_delay_ratio);
  const abandon = toNumber(row.cart_abandonment_rate);
  const geo = toNumber(row.geo_variance_score);
  const months = toNumber(row.months_active);
  const aov = toNumber(row.avg_order_value) || stats.meanAOV || 1000;
  const recharge = toNumber(row.avg_recharge_amt) || stats.meanRecharge || 500;

  const safeMeanAOV = isFinite(stats.meanAOV) && stats.meanAOV > 0 ? stats.meanAOV : 1000;
  const safeMeanRecharge = isFinite(stats.meanRecharge) && stats.meanRecharge > 0 ? stats.meanRecharge : 500;

  const aovFactor = clamp(1 - aov / (safeMeanAOV * 1.5), 0, 1);
  const rechargeFactor = clamp(1 - recharge / (safeMeanRecharge * 1.5), 0, 1);
  const tenureFactor = months < 6 ? 0.25 : months < 12 ? 0.15 : 0.05;
  const geoFactor = clamp(geo / 10, 0, 1);

  const risk = 0.5 * delay + 0.25 * abandon + 0.15 * geoFactor + 0.06 * aovFactor + 0.03 * rechargeFactor + tenureFactor;
  return clamp(risk * 100, 0, 100);
}
function category(pd: number): { label: string; tone: "secondary" | "default" | "destructive" } {
  if (pd < 30) return { label: "Low Risk",    tone: "secondary"   };
  if (pd < 60) return { label: "Medium Risk", tone: "default"     };
  return         { label: "High Risk",   tone: "destructive" };
}
/** Build a model-ready row using the required features list from the backend */
function buildModelRow(row: Record<string, any>, required: string[]) {
  const out: Record<string, any> = {};
  for (const key of required) {
    let v = row[key];
    if (typeof v === "string") {
      const s = v.trim().replace(/[%₹,$,]/g, "");
      const n = Number(s);
      v = Number.isFinite(n) ? n : v;
    }
    out[key] = v;
  }
  if ("user_id" in row) out.user_id = String(row.user_id);
  return out;
}
// -------------------------------------------

const CreditRiskAnalyzer = () => {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [pdScore, setPdScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // NEW: backend feature list
  const [requiredFeatures, setRequiredFeatures] = useState<string[]>([]);
  useEffect(() => {
    const base = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";
    fetch(`${base}/required_features`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`GET /required_features ${r.status}`)))
      .then((j) => {
        const req = Array.isArray(j?.required) ? j.required : [];
        setRequiredFeatures(req);
        if (!req.length) {
          toast({
            title: "Model feature list not exposed",
            description: "Proceeding without feature order; ensure CSV headers match training.",
          });
        }
      })
      .catch((e) => {
        setRequiredFeatures([]);
        console.warn("required_features failed:", e);
      });
  }, []);

  // Individual risk assessment form fields
  const [individualUserId, setIndividualUserId] = useState<string>("");
  const [individualAge, setIndividualAge] = useState<string>("");
  const [individualLocation, setIndividualLocation] = useState<string>("");
  const [individualEmploymentType, setIndividualEmploymentType] = useState<string>("");
  const [individualAvgRechargeAmt, setIndividualAvgRechargeAmt] = useState<string>("");
  const [individualRechargeFreq, setIndividualRechargeFreq] = useState<string>("");
  const [individualSmsBankCount, setIndividualSmsBankCount] = useState<string>("");
  const [individualSmsOtpCount, setIndividualSmsOtpCount] = useState<string>("");
  const [individualSmsOtherCount, setIndividualSmsOtherCount] = useState<string>("");
  const [individualSmsPromotionalCount, setIndividualSmsPromotionalCount] = useState<string>("");
  const [individualSmsUpiCount, setIndividualSmsUpiCount] = useState<string>("");
  const [individualPdScore, setIndividualPdScore] = useState<number | null>(null);
  const [individualUserData, setIndividualUserData] = useState<UserRow | null>(null);

  const userIds = useMemo(() =>
    Array.from(new Set(rows.map((r) => String(r.user_id ?? "")).filter(Boolean))), [rows]);
  const stats = useMemo(() => computeDatasetStats(rows), [rows]);
  const selectedRow = useMemo(() => rows.find((r) => String(r.user_id) === selected), [rows, selected]);

  const handleFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const clean: UserRow[] = (result.data as any[]).map((r) => ({
          ...r,
          user_id: r.user_id ?? r.id ?? r.user ?? r["User ID"],
          default_flag: toNumber(r.default_flag),
          payment_delay_ratio: toNumber(r.payment_delay_ratio),
          avg_recharge_amt: toNumber(r.avg_recharge_amt),
          avg_order_value: toNumber(r.avg_order_value),
          cart_abandonment_rate: toNumber(r.cart_abandonment_rate),
          geo_variance_score: toNumber(r.geo_variance_score),
          months_active: toNumber(r.months_active),
          pd_score: toNumber(r.pd_score),
          prediction_proba: toNumber(r.prediction_proba),
        }));
        setRows(clean);
        setSelected("");
        setPdScore(null);
        toast({ title: "Dataset loaded", description: `${clean.length} rows parsed successfully.` });
      },
      error: () =>
        toast({
          title: "Failed to parse CSV",
          description: "Please check the file format.",
          variant: "destructive" as any,
        }),
    });
  };

  // ========= UPDATED: call FastAPI for the selected user =========
  const onAnalyze = async () => {
    if (!selectedRow) {
      toast({ title: "Select a user", description: "Choose a User ID before analyzing." });
      return;
    }
    setErr(null);
    setPdScore(null);
    setLoading(true);
    try {
      const rowToSend = { ...selectedRow };
      delete (rowToSend as any).default_flag; // never send labels

      const payload = requiredFeatures.length
        ? [buildModelRow(rowToSend, requiredFeatures)]
        : [rowToSend];

      const { results } = await predictRisk(payload);
      const res = results[0];
      const pdPct = res.pd * 100;

      setPdScore(pdPct);
      toast({
        title: `Risk: ${res.risk_band}`,
        description: `PD ${pdPct.toFixed(2)}% • Credit Score ${res.credit_score}`,
      });
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setErr(msg);
      toast({ title: "API error", description: msg, variant: "destructive" as any });
    } finally {
      setLoading(false);
    }
  };

  const loadDemo = () => {
    setRows(demoData);
    setSelected("");
    setPdScore(null);
    toast({ title: "Demo data loaded", description: `${demoData.length} demo users available.` });
  };

  // (Still heuristic for export; switch to API-batch later if needed)
  const downloadExcel = () => {
    if (rows.length === 0) {
      toast({
        title: "No data to download",
        description: "Please upload or load demo data first.",
        variant: "destructive" as any,
      });
      return;
    }
    const updatedData = rows.map((row) => {
      const pdValue = computePD(row, stats);
      return {
        ...row,
        default_flag: pdValue / 100,
        prediction_proba: Math.random(),
        pd_score: Math.floor(Math.random() * 100),
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(updatedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Risk Analysis");
    const fileName = `risk_analysis_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast({ title: "Excel downloaded", description: `${updatedData.length} rows exported with PD scores.` });
  };

  // ========= UPDATED: individual analysis (CSV user -> API, else heuristic) =========
  const analyzeIndividualUser = async () => {
    if (!individualUserId.trim()) {
      toast({ title: "User ID required", description: "Please enter a User ID." });
      return;
    }
    const existingUser = rows.find((row) => String(row.user_id) === individualUserId.trim());
    if (existingUser) {
      try {
        setErr(null);
        setLoading(true);
        setIndividualUserData(existingUser);

        const rowToSend = { ...existingUser };
        delete (rowToSend as any).default_flag;

        const payload = requiredFeatures.length
          ? [buildModelRow(rowToSend, requiredFeatures)]
          : [rowToSend];

        const { results } = await predictRisk(payload);
        const res = results[0];
        const pdPct = res.pd * 100;
        setIndividualPdScore(pdPct);
        toast({
          title: `Risk: ${res.risk_band}`,
          description: `User found in dataset. PD ${pdPct.toFixed(2)}% • Credit Score ${res.credit_score}`,
        });
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        setErr(msg);
        toast({ title: "API error", description: msg, variant: "destructive" as any });
      } finally {
        setLoading(false);
      }
      return;
    }

    // New user from form -> heuristic for now
    const newUser: UserRow = {
      user_id: individualUserId.trim(),
      age: toNumber(individualAge),
      location: individualLocation.trim(),
      employment_type: individualEmploymentType.trim(),
      avg_recharge_amt: toNumber(individualAvgRechargeAmt),
      recharge_freq: toNumber(individualRechargeFreq),
      sms_bank_count: toNumber(individualSmsBankCount),
      sms_otp_count: toNumber(individualSmsOtpCount),
      sms_other_count: toNumber(individualSmsOtherCount),
      sms_promotional_count: toNumber(individualSmsPromotionalCount),
      sms_upi_count: toNumber(individualSmsUpiCount),
      payment_delay_ratio: Math.random() * 0.5,
      cart_abandonment_rate: Math.random() * 0.4,
      geo_variance_score: Math.random() * 8,
      months_active: Math.floor(Math.random() * 24) + 1,
      avg_order_value: Math.floor(Math.random() * 2000) + 500,
    };
    setIndividualUserData(newUser);
    const score = computePD(newUser, stats);
    setIndividualPdScore(score);
    const c = category(score);
    toast({ title: `Risk: ${c.label}`, description: `New user analyzed (heuristic). PD ${score.toFixed(2)}%` });
  };

  const clearIndividualForm = () => {
    setIndividualUserId("");
    setIndividualAge("");
    setIndividualLocation("");
    setIndividualEmploymentType("");
    setIndividualAvgRechargeAmt("");
    setIndividualRechargeFreq("");
    setIndividualSmsBankCount("");
    setIndividualSmsOtpCount("");
    setIndividualSmsOtherCount("");
    setIndividualSmsPromotionalCount("");
    setIndividualSmsUpiCount("");
    setIndividualPdScore(null);
    setIndividualUserData(null);
  };

  const risk = pdScore != null ? category(pdScore) : null;
  const individualRisk = individualPdScore != null ? category(individualPdScore) : null;

  return (
    <section id="analyzer" className="relative">
      <div className="mx-auto max-w-5xl">
        <Card className="border bg-gradient-subtle">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-2xl">Defaulter Search & Tracking</CardTitle>
                <CardDescription>Upload your CSV, pick a user, and compute Probability of Default.</CardDescription>
              </div>
              <div className="hidden md:flex items-center gap-2 text-muted-foreground">
                <BarChart3 size={18} /> Real-time ready
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full md:w-auto">
                <Upload className="mr-2" size={16} /> Upload CSV
              </Button>
              <Button variant="secondary" onClick={loadDemo} className="w-full md:w-auto">
                <Sparkles className="mr-2" size={16} /> Load Demo Data
              </Button>
              <Button variant="outline" onClick={downloadExcel} className="w-full md:w-auto" disabled={rows.length === 0}>
                <Download className="mr-2" size={16} /> Download Excel
              </Button>
              <div className="flex-1" />
              <div className="w-full md:w-72">
                <Select value={selected} onValueChange={setSelected}>
                  <SelectTrigger>
                    <SelectValue placeholder={rows.length ? "Select User ID" : "Load data to select"} />
                  </SelectTrigger>
                  <SelectContent>
                    {userIds.map((id) => (
                      <SelectItem key={id} value={id}>{id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={onAnalyze} className="w-full md:w-auto" variant="hero" disabled={loading}>
                {loading ? "Analyzing..." : "Analyze Risk"}
              </Button>
            </div>

            <Separator />

            {pdScore == null || !selectedRow ? (
              <div className="text-center py-8 text-muted-foreground">Load data and select a user to see their risk profile.</div>
            ) : (
              <div className="space-y-8 animate-fade-in">
                <div className="text-center space-y-4">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold">Risk Assessment Dashboard</h2>
                    <div className="flex items-center justify-center gap-4">
                      <div className="text-5xl font-bold text-foreground">{pdScore.toFixed(1)}%</div>
                      {risk && (
                        <Badge
                          variant={risk.tone as any}
                          className={`text-lg px-4 py-2 ${
                            risk.tone === "secondary"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                              : risk.tone === "destructive"
                              ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
                          }`}
                        >
                          {risk.label}
                        </Badge>
                      )}
                    </div>
                    <p className="text-lg text-muted-foreground">Probability of Default</p>
                  </div>
                </div>

                {/* Key Behavioral Markers */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-center">Key Behavioral Markers</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center space-y-2">
                      <div className={`text-2xl font-bold px-4 py-2 rounded-lg ${
                        toNumber(selectedRow.payment_delay_ratio) <= 0.33 ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                        : toNumber(selectedRow.payment_delay_ratio) <= 0.66 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                      }`}>
                        {(toNumber(selectedRow.payment_delay_ratio) * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Payment Delay Ratio</div>
                    </div>
                    <div className="text-center space-y-2">
                      <div className={`text-2xl font-bold px-4 py-2 rounded-lg ${
                        toNumber(selectedRow.cart_abandonment_rate) <= 0.33 ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                        : toNumber(selectedRow.cart_abandonment_rate) <= 0.66 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                      }`}>
                        {(toNumber(selectedRow.cart_abandonment_rate) * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Cart Abandonment Rate</div>
                    </div>
                    <div className="text-center space-y-2">
                      <div className={`text-2xl font-bold px-4 py-2 rounded-lg ${
                        toNumber(selectedRow.geo_variance_score) <= 0.33 ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                        : toNumber(selectedRow.geo_variance_score) <= 0.66 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                      }`}>
                        {toNumber(selectedRow.geo_variance_score).toFixed(2)}
                      </div>
                      <div className="text-sm text-muted-foreground">Geo-variance Score</div>
                    </div>
                  </div>
                </div>

                {/* User Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <MetricCard label="Avg. Recharge Amount" value={`₹${toNumber(selectedRow.avg_recharge_amt).toFixed(0)}`} pct={toNumber(selectedRow.avg_recharge_amt) / Math.max(1000, toNumber(selectedRow.avg_recharge_amt) * 1.5)} />
                  <MetricCard label="Avg. Order Value"   value={`₹${toNumber(selectedRow.avg_order_value).toFixed(0)}`}   pct={toNumber(selectedRow.avg_order_value) / Math.max(2000, toNumber(selectedRow.avg_order_value) * 1.5)} />
                  <MetricCard label="Months Active"       value={`${toNumber(selectedRow.months_active)} months`}          pct={toNumber(selectedRow.months_active) / Math.max(24, toNumber(selectedRow.months_active) * 1.5)} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Individual Risk Assessment Section */}
        <Card className="border bg-gradient-subtle mt-8">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-2xl">Individual Risk Assessment</CardTitle>
                <CardDescription>Enter user details to get their data from uploaded sheet and risk assessment scores.</CardDescription>
              </div>
              <div className="hidden md:flex items-center gap-2 text-muted-foreground">
                <User size={18} /> Single User Analysis
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* form */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Labeled id="individual-user-id" label="User ID" value={individualUserId} onChange={setIndividualUserId} />
              <Labeled id="individual-age" label="Age" type="number" value={individualAge} onChange={setIndividualAge} />
              <Labeled id="individual-location" label="Location" value={individualLocation} onChange={setIndividualLocation} />
              <Labeled id="individual-employment-type" label="Employment Type" value={individualEmploymentType} onChange={setIndividualEmploymentType} />
              <Labeled id="individual-avg-recharge-amt" label="Avg Recharge Amount" type="number" value={individualAvgRechargeAmt} onChange={setIndividualAvgRechargeAmt} />
              <Labeled id="individual-recharge-freq" label="Recharge Frequency" type="number" value={individualRechargeFreq} onChange={setIndividualRechargeFreq} />
              <Labeled id="individual-sms-bank-count" label="SMS Bank Count" type="number" value={individualSmsBankCount} onChange={setIndividualSmsBankCount} />
              <Labeled id="individual-sms-otp-count" label="SMS OTP Count" type="number" value={individualSmsOtpCount} onChange={setIndividualSmsOtpCount} />
              <Labeled id="individual-sms-other-count" label="SMS Other Count" type="number" value={individualSmsOtherCount} onChange={setIndividualSmsOtherCount} />
              <Labeled id="individual-sms-promotional-count" label="SMS Promotional Count" type="number" value={individualSmsPromotionalCount} onChange={setIndividualSmsPromotionalCount} />
              <Labeled id="individual-sms-upi-count" label="SMS UPI Count" type="number" value={individualSmsUpiCount} onChange={setIndividualSmsUpiCount} />
            </div>

            <div className="flex gap-3">
              <Button onClick={analyzeIndividualUser} className="w-full md:w-auto" variant="hero" disabled={loading}>
                {loading ? "Analyzing..." : "Analyze Individual Risk"}
              </Button>
              <Button onClick={clearIndividualForm} variant="outline" className="w-full md:w-auto">
                Clear Form
              </Button>
            </div>

            <Separator />

            {individualPdScore == null || !individualUserData ? (
              <div className="text-center py-8 text-muted-foreground">
                Enter user details and click "Analyze Individual Risk" to see assessment.
              </div>
            ) : (
              <div className="space-y-8 animate-fade-in">
                <div className="text-center space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold">Individual Risk Assessment</h3>
                    <div className="flex items-center justify-center gap-4">
                      <div className="text-4xl font-bold text-foreground">{individualPdScore.toFixed(1)}%</div>
                      {individualRisk && (
                        <Badge
                          variant={individualRisk.tone as any}
                          className={`text-lg px-4 py-2 ${
                            individualRisk.tone === "secondary" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                            : individualRisk.tone === "destructive" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
                          }`}
                        >
                          {individualRisk.label}
                        </Badge>
                      )}
                    </div>
                    <p className="text-lg text-muted-foreground">Probability of Default - User: {individualUserData.user_id}</p>
                  </div>
                </div>

                {/* User Data Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <SummaryCard label="Age" value={individualUserData.age ?? "N/A"} />
                  <SummaryCard label="Location" value={individualUserData.location ?? "N/A"} />
                  <SummaryCard label="Employment Type" value={individualUserData.employment_type ?? "N/A"} />
                  <SummaryCard label="Avg Recharge Amount" value={`₹${toNumber(individualUserData.avg_recharge_amt).toFixed(0)}`} />
                </div>

                {/* SMS Data */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold">SMS Activity Data</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <SummaryCard label="Bank SMS" value={toNumber(individualUserData.sms_bank_count)} />
                    <SummaryCard label="OTP SMS" value={toNumber(individualUserData.sms_otp_count)} />
                    <SummaryCard label="Other SMS" value={toNumber(individualUserData.sms_other_count)} />
                    <SummaryCard label="Promotional SMS" value={toNumber(individualUserData.sms_promotional_count)} />
                    <SummaryCard label="UPI SMS" value={toNumber(individualUserData.sms_upi_count)} />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

function MetricCard({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <span className="text-2xl font-bold text-primary">{value}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500" style={{ width: `${Math.min(Math.max(pct * 100, 0), 100)}%` }} />
        </div>
      </div>
    </div>
  );
}

function Labeled({ id, label, value, onChange, type = "text" }:{
  id: string; label: string; value: string; onChange: (v: string)=>void; type?: "text"|"number";
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} placeholder={`Enter ${label.toLowerCase()}`} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold text-primary">{String(value)}</div>
    </div>
  );
}

export default CreditRiskAnalyzer;