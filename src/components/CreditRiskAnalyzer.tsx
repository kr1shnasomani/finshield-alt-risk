import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Upload, Sparkles, BarChart3 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { SpeedometerGauge } from "./charts/SpeedometerGauge";
import { HorizontalBarChart } from "./charts/HorizontalBarChart";
import { VerticalBarChart } from "./charts/VerticalBarChart";

export type UserRow = Record<string, string | number | undefined> & {
  user_id?: string | number;
  default_flag?: number;
  payment_delay_ratio?: number;
  avg_recharge_amt?: number;
  avg_order_value?: number;
  cart_abandonment_rate?: number;
  geo_variance_score?: number;
  months_active?: number;
  pd_score?: number; // if provided
  prediction_proba?: number; // if provided
};

const demoData: UserRow[] = [
  {
    user_id: "U-1024",
    default_flag: 0,
    payment_delay_ratio: 0.12,
    avg_recharge_amt: 350,
    avg_order_value: 1200,
    cart_abandonment_rate: 0.18,
    geo_variance_score: 2.1,
    months_active: 18,
  },
  {
    user_id: "U-2048",
    default_flag: 0,
    payment_delay_ratio: 0.35,
    avg_recharge_amt: 240,
    avg_order_value: 800,
    cart_abandonment_rate: 0.42,
    geo_variance_score: 4.5,
    months_active: 7,
  },
  {
    user_id: "U-4096",
    default_flag: 1,
    payment_delay_ratio: 0.62,
    avg_recharge_amt: 150,
    avg_order_value: 560,
    cart_abandonment_rate: 0.58,
    geo_variance_score: 7.4,
    months_active: 3,
  },
];

function toNumber(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const s = v.trim().replace(/[%₹,$]/g, "");
    const n = Number(s);
    return isFinite(n) ? n : undefined;
  }
  return undefined;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function computeDatasetStats(rows: UserRow[]) {
  const avg = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
  const av = rows.map((r) => toNumber(r.avg_order_value) ?? 0);
  const ar = rows.map((r) => toNumber(r.avg_recharge_amt) ?? 0);
  return { meanAOV: avg(av), meanRecharge: avg(ar) };
}

function computePD(row: UserRow, stats: { meanAOV: number; meanRecharge: number }): number {
  const direct = toNumber(row.pd_score) ?? toNumber(row.prediction_proba);
  if (typeof direct === "number") return clamp(direct * (direct <= 1 ? 100 : 1), 0, 100);

  const delay = toNumber(row.payment_delay_ratio) ?? 0; // 0..1
  const abandon = toNumber(row.cart_abandonment_rate) ?? 0; // 0..1
  const geo = toNumber(row.geo_variance_score) ?? 0; // assume 0..10
  const months = toNumber(row.months_active) ?? 0; // months
  const aov = toNumber(row.avg_order_value) ?? stats.meanAOV;
  const recharge = toNumber(row.avg_recharge_amt) ?? stats.meanRecharge;

  // Normalize against dataset means
  const aovFactor = stats.meanAOV ? clamp(1 - aov / (stats.meanAOV * 1.5), 0, 1) : 0.5;
  const rechargeFactor = stats.meanRecharge ? clamp(1 - recharge / (stats.meanRecharge * 1.5), 0, 1) : 0.5;
  const tenureFactor = months < 6 ? 0.25 : months < 12 ? 0.15 : 0.05;
  const geoFactor = clamp(geo / 10, 0, 1);

  const risk =
    0.5 * delay +
    0.25 * abandon +
    0.15 * geoFactor +
    0.06 * aovFactor +
    0.03 * rechargeFactor +
    tenureFactor;

  return clamp(risk * 100, 0, 100);
}

function category(pd: number): { label: string; tone: "secondary" | "default" | "destructive" } {
  if (pd < 30) return { label: "Low Risk", tone: "secondary" };
  if (pd < 60) return { label: "Medium Risk", tone: "default" };
  return { label: "High Risk", tone: "destructive" };
}

const CreditRiskAnalyzer = () => {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [pdScore, setPdScore] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const userIds = useMemo(() => Array.from(new Set(rows.map((r) => String(r.user_id ?? "")).filter(Boolean))), [rows]);
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
      error: () => toast({ title: "Failed to parse CSV", description: "Please check the file format.", variant: "destructive" as any }),
    });
  };

  const onAnalyze = () => {
    if (!selectedRow) {
      toast({ title: "Select a user", description: "Choose a User ID before analyzing." });
      return;
    }
    const score = computePD(selectedRow, stats);
    setPdScore(score);
    const c = category(score);
    toast({ title: `Risk: ${c.label}`, description: `PD Score ${score.toFixed(2)}%` });
  };

  const loadDemo = () => {
    setRows(demoData);
    setSelected("");
    setPdScore(null);
    toast({ title: "Demo data loaded", description: `${demoData.length} demo users available.` });
  };

  const risk = pdScore != null ? category(pdScore) : null;

  return (
    <section id="analyzer" className="relative">
      <div className="mx-auto max-w-5xl">
        <Card className="border bg-gradient-subtle">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-2xl">Defaulter Search & Tracking</CardTitle>
                <CardDescription>
                  Upload your CSV, pick a user, and compute Probability of Default.
                </CardDescription>
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
              <div className="flex-1" />
              <div className="w-full md:w-72">
                <Select value={selected} onValueChange={setSelected}>
                  <SelectTrigger>
                    <SelectValue placeholder={rows.length ? "Select User ID" : "Load data to select"} />
                  </SelectTrigger>
                  <SelectContent>
                    {userIds.map((id) => (
                      <SelectItem key={id} value={id}>
                        {id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={onAnalyze} className="w-full md:w-auto" variant="hero">
                Analyze Risk
              </Button>
            </div>

            <Separator />

            {pdScore == null || !selectedRow ? (
              <div className="text-center py-8 text-muted-foreground">
                Load data and select a user to see their risk profile.
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6 animate-fade-in">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-medium">Probability of Default</div>
                    {risk && (
                      <Badge variant={risk.tone as any}>{risk.label}</Badge>
                    )}
                  </div>
                  <div className="text-3xl font-semibold">{pdScore.toFixed(2)}%</div>
                  <Progress value={pdScore} className="h-3" />
                </div>

                <div className="space-y-6">
                  {/* Speedometer Gauges Section */}
                  <div className="rounded-lg border p-6 bg-gradient-subtle">
                    <h3 className="text-lg font-semibold mb-4 text-center">Risk Indicators</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <SpeedometerGauge
                        value={toNumber(selectedRow.payment_delay_ratio) ?? 0}
                        max={1}
                        title="Payment Delay Ratio"
                        unit="%"
                      />
                      <SpeedometerGauge
                        value={toNumber(selectedRow.cart_abandonment_rate) ?? 0}
                        max={1}
                        title="Cart Abandonment Rate"
                        unit="%"
                      />
                      <SpeedometerGauge
                        value={toNumber(selectedRow.geo_variance_score) ?? 0}
                        max={10}
                        title="Geo-variance Score"
                        unit=""
                      />
                    </div>
                  </div>

                  {/* Bar Charts Section */}
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="rounded-lg border p-4 bg-card">
                      <HorizontalBarChart
                        value={toNumber(selectedRow.avg_recharge_amt) ?? 0}
                        maxValue={Math.max(1000, (toNumber(selectedRow.avg_recharge_amt) ?? 0) * 1.5)}
                        title="Avg. Recharge Amount"
                      />
                    </div>
                    
                    <div className="rounded-lg border p-4 bg-card">
                      <HorizontalBarChart
                        value={toNumber(selectedRow.avg_order_value) ?? 0}
                        maxValue={Math.max(2000, (toNumber(selectedRow.avg_order_value) ?? 0) * 1.5)}
                        title="Avg. Order Value"
                      />
                    </div>

                    <div className="rounded-lg border p-4 bg-card flex justify-center">
                      <VerticalBarChart
                        value={toNumber(selectedRow.months_active) ?? 0}
                        maxValue={Math.max(24, (toNumber(selectedRow.months_active) ?? 0) * 1.5)}
                        title="Months Active"
                        unit=" months"
                      />
                    </div>
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

export default CreditRiskAnalyzer;
