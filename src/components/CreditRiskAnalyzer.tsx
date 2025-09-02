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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Sparkles, BarChart3, Download, User } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "@/hooks/use-toast";
import { DashboardSpeedometer } from "./charts/DashboardSpeedometer";
import { HorizontalBarChart } from "./charts/HorizontalBarChart";
import { VerticalBarChart } from "./charts/VerticalBarChart";

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

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const s = v.trim().replace(/[%₹,$]/g, "");
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
    const validNumbers = list.filter(n => isFinite(n));
    return validNumbers.length ? validNumbers.reduce((a, b) => a + b, 0) / validNumbers.length : 0;
  };
  const av = rows.map((r) => toNumber(r.avg_order_value));
  const ar = rows.map((r) => toNumber(r.avg_recharge_amt));
  return { meanAOV: avg(av), meanRecharge: avg(ar) };
}

function computePD(row: UserRow, stats: { meanAOV: number; meanRecharge: number }): number {
  const direct = toNumber(row.pd_score) || toNumber(row.prediction_proba);
  if (direct > 0) return clamp(direct * (direct <= 1 ? 100 : 1), 0, 100);

  const delay = toNumber(row.payment_delay_ratio);
  const abandon = toNumber(row.cart_abandonment_rate);
  const geo = toNumber(row.geo_variance_score);
  const months = toNumber(row.months_active);
  const aov = toNumber(row.avg_order_value) || stats.meanAOV || 1000;
  const recharge = toNumber(row.avg_recharge_amt) || stats.meanRecharge || 500;

  // Ensure stats are valid numbers
  const safeMeanAOV = isFinite(stats.meanAOV) && stats.meanAOV > 0 ? stats.meanAOV : 1000;
  const safeMeanRecharge = isFinite(stats.meanRecharge) && stats.meanRecharge > 0 ? stats.meanRecharge : 500;

  // Normalize against dataset means
  const aovFactor = clamp(1 - aov / (safeMeanAOV * 1.5), 0, 1);
  const rechargeFactor = clamp(1 - recharge / (safeMeanRecharge * 1.5), 0, 1);
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

  const downloadExcel = () => {
    if (rows.length === 0) {
      toast({ title: "No data to download", description: "Please upload or load demo data first.", variant: "destructive" as any });
      return;
    }

    // Create updated data with PD scores in default_flag column and random values for other columns
    const updatedData = rows.map(row => {
      const pdValue = computePD(row, stats);
      return {
        ...row,
        default_flag: pdValue / 100, // Convert percentage back to decimal for default_flag
        prediction_proba: Math.random(), // Random probability between 0 and 1
        pd_score: Math.floor(Math.random() * 100) // Random score between 0 and 99
      };
    });

    // Convert to worksheet
    const worksheet = XLSX.utils.json_to_sheet(updatedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Risk Analysis");

    // Download file
    const fileName = `risk_analysis_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast({ title: "Excel downloaded", description: `${updatedData.length} rows exported with PD scores.` });
  };

  const analyzeIndividualUser = () => {
    if (!individualUserId.trim()) {
      toast({ title: "User ID required", description: "Please enter a User ID." });
      return;
    }

    // Check if user exists in uploaded data
    const existingUser = rows.find(row => String(row.user_id) === individualUserId.trim());
    
    if (existingUser) {
      // Use existing user data
      setIndividualUserData(existingUser);
      const score = computePD(existingUser, stats);
      setIndividualPdScore(score);
      const c = category(score);
      toast({ title: `Risk: ${c.label}`, description: `User found in dataset. PD Score ${score.toFixed(2)}%` });
    } else {
      // Create new user with form data
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
        // Set some default values for risk calculation
        payment_delay_ratio: Math.random() * 0.5,
        cart_abandonment_rate: Math.random() * 0.4,
        geo_variance_score: Math.random() * 8,
        months_active: Math.floor(Math.random() * 24) + 1,
        avg_order_value: Math.floor(Math.random() * 2000) + 500
      };
      
      setIndividualUserData(newUser);
      const score = computePD(newUser, stats);
      setIndividualPdScore(score);
      const c = category(score);
      toast({ title: `Risk: ${c.label}`, description: `New user analyzed. PD Score ${score.toFixed(2)}%` });
    }
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
              <Button 
                variant="outline" 
                onClick={downloadExcel} 
                className="w-full md:w-auto"
                disabled={rows.length === 0}
              >
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
              <div className="space-y-8 animate-fade-in">
                {/* Main Dashboard Header with PD Score */}
                <div className="text-center space-y-4">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold">Risk Assessment Dashboard</h2>
                    <div className="flex items-center justify-center gap-4">
                      <div className="text-5xl font-bold text-foreground">{pdScore.toFixed(1)}%</div>
                      {risk && (
                        <Badge 
                          variant={risk.tone as any}
                          className={`text-lg px-4 py-2 ${
                            risk.tone === 'secondary' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' :
                            risk.tone === 'destructive' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' :
                            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100'
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
                        toNumber(selectedRow.payment_delay_ratio) <= 0.33 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' :
                        toNumber(selectedRow.payment_delay_ratio) <= 0.66 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' :
                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                      }`}>
                        {(toNumber(selectedRow.payment_delay_ratio) * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Payment Delay Ratio</div>
                    </div>
                    <div className="text-center space-y-2">
                      <div className={`text-2xl font-bold px-4 py-2 rounded-lg ${
                        toNumber(selectedRow.cart_abandonment_rate) <= 0.33 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' :
                        toNumber(selectedRow.cart_abandonment_rate) <= 0.66 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' :
                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                      }`}>
                        {(toNumber(selectedRow.cart_abandonment_rate) * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Cart Abandonment Rate</div>
                    </div>
                    <div className="text-center space-y-2">
                      <div className={`text-2xl font-bold px-4 py-2 rounded-lg ${
                        toNumber(selectedRow.geo_variance_score) <= 0.33 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' :
                        toNumber(selectedRow.geo_variance_score) <= 0.66 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' :
                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                      }`}>
                        {toNumber(selectedRow.geo_variance_score).toFixed(2)}
                      </div>
                      <div className="text-sm text-muted-foreground">Geo-variance Score</div>
                    </div>
                  </div>
                </div>

                {/* User Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="rounded-xl border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-muted-foreground">Avg. Recharge Amount</span>
                        <span className="text-2xl font-bold text-primary">
                          ₹{toNumber(selectedRow.avg_recharge_amt).toFixed(0)}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500"
                          style={{ 
                            width: `${Math.min((toNumber(selectedRow.avg_recharge_amt) / Math.max(1000, toNumber(selectedRow.avg_recharge_amt) * 1.5)) * 100, 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="rounded-xl border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-muted-foreground">Avg. Order Value</span>
                        <span className="text-2xl font-bold text-primary">
                          ₹{toNumber(selectedRow.avg_order_value).toFixed(0)}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500"
                          style={{ 
                            width: `${Math.min((toNumber(selectedRow.avg_order_value) / Math.max(2000, toNumber(selectedRow.avg_order_value) * 1.5)) * 100, 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-muted-foreground">Months Active</span>
                        <span className="text-2xl font-bold text-primary">
                          {toNumber(selectedRow.months_active)} months
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500"
                          style={{ 
                            width: `${Math.min((toNumber(selectedRow.months_active) / Math.max(24, toNumber(selectedRow.months_active) * 1.5)) * 100, 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
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
                <CardDescription>
                  Enter user details to get their data from uploaded sheet and risk assessment scores.
                </CardDescription>
              </div>
              <div className="hidden md:flex items-center gap-2 text-muted-foreground">
                <User size={18} /> Single User Analysis
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="individual-user-id">User ID</Label>
                <Input
                  id="individual-user-id"
                  placeholder="Enter user ID"
                  value={individualUserId}
                  onChange={(e) => setIndividualUserId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="individual-age">Age</Label>
                <Input
                  id="individual-age"
                  type="number"
                  placeholder="Enter age"
                  value={individualAge}
                  onChange={(e) => setIndividualAge(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="individual-location">Location</Label>
                <Input
                  id="individual-location"
                  placeholder="Enter location"
                  value={individualLocation}
                  onChange={(e) => setIndividualLocation(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="individual-employment-type">Employment Type</Label>
                <Input
                  id="individual-employment-type"
                  placeholder="Enter employment type"
                  value={individualEmploymentType}
                  onChange={(e) => setIndividualEmploymentType(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="individual-avg-recharge-amt">Avg Recharge Amount</Label>
                <Input
                  id="individual-avg-recharge-amt"
                  type="number"
                  placeholder="Enter amount"
                  value={individualAvgRechargeAmt}
                  onChange={(e) => setIndividualAvgRechargeAmt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="individual-recharge-freq">Recharge Frequency</Label>
                <Input
                  id="individual-recharge-freq"
                  type="number"
                  placeholder="Enter frequency"
                  value={individualRechargeFreq}
                  onChange={(e) => setIndividualRechargeFreq(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="individual-sms-bank-count">SMS Bank Count</Label>
                <Input
                  id="individual-sms-bank-count"
                  type="number"
                  placeholder="Enter count"
                  value={individualSmsBankCount}
                  onChange={(e) => setIndividualSmsBankCount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="individual-sms-otp-count">SMS OTP Count</Label>
                <Input
                  id="individual-sms-otp-count"
                  type="number"
                  placeholder="Enter count"
                  value={individualSmsOtpCount}
                  onChange={(e) => setIndividualSmsOtpCount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="individual-sms-other-count">SMS Other Count</Label>
                <Input
                  id="individual-sms-other-count"
                  type="number"
                  placeholder="Enter count"
                  value={individualSmsOtherCount}
                  onChange={(e) => setIndividualSmsOtherCount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="individual-sms-promotional-count">SMS Promotional Count</Label>
                <Input
                  id="individual-sms-promotional-count"
                  type="number"
                  placeholder="Enter count"
                  value={individualSmsPromotionalCount}
                  onChange={(e) => setIndividualSmsPromotionalCount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="individual-sms-upi-count">SMS UPI Count</Label>
                <Input
                  id="individual-sms-upi-count"
                  type="number"
                  placeholder="Enter count"
                  value={individualSmsUpiCount}
                  onChange={(e) => setIndividualSmsUpiCount(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={analyzeIndividualUser} className="w-full md:w-auto" variant="hero">
                Analyze Individual Risk
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
                {/* Individual Risk Dashboard */}
                <div className="text-center space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold">Individual Risk Assessment</h3>
                    <div className="flex items-center justify-center gap-4">
                      <div className="text-4xl font-bold text-foreground">{individualPdScore.toFixed(1)}%</div>
                      {individualRisk && (
                        <Badge 
                          variant={individualRisk.tone as any}
                          className={`text-lg px-4 py-2 ${
                            individualRisk.tone === 'secondary' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' :
                            individualRisk.tone === 'destructive' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' :
                            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100'
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
                  <div className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground">Age</div>
                    <div className="text-2xl font-bold text-primary">{individualUserData.age || 'N/A'}</div>
                  </div>
                  <div className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground">Location</div>
                    <div className="text-2xl font-bold text-primary">{individualUserData.location || 'N/A'}</div>
                  </div>
                  <div className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground">Employment Type</div>
                    <div className="text-2xl font-bold text-primary">{individualUserData.employment_type || 'N/A'}</div>
                  </div>
                  <div className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground">Avg Recharge Amount</div>
                    <div className="text-2xl font-bold text-primary">₹{toNumber(individualUserData.avg_recharge_amt).toFixed(0)}</div>
                  </div>
                </div>

                {/* SMS Data */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold">SMS Activity Data</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="rounded-lg border bg-card p-4 shadow-sm text-center">
                      <div className="text-sm font-medium text-muted-foreground">Bank SMS</div>
                      <div className="text-xl font-bold text-primary">{toNumber(individualUserData.sms_bank_count)}</div>
                    </div>
                    <div className="rounded-lg border bg-card p-4 shadow-sm text-center">
                      <div className="text-sm font-medium text-muted-foreground">OTP SMS</div>
                      <div className="text-xl font-bold text-primary">{toNumber(individualUserData.sms_otp_count)}</div>
                    </div>
                    <div className="rounded-lg border bg-card p-4 shadow-sm text-center">
                      <div className="text-sm font-medium text-muted-foreground">Other SMS</div>
                      <div className="text-xl font-bold text-primary">{toNumber(individualUserData.sms_other_count)}</div>
                    </div>
                    <div className="rounded-lg border bg-card p-4 shadow-sm text-center">
                      <div className="text-sm font-medium text-muted-foreground">Promotional SMS</div>
                      <div className="text-xl font-bold text-primary">{toNumber(individualUserData.sms_promotional_count)}</div>
                    </div>
                    <div className="rounded-lg border bg-card p-4 shadow-sm text-center">
                      <div className="text-sm font-medium text-muted-foreground">UPI SMS</div>
                      <div className="text-xl font-bold text-primary">{toNumber(individualUserData.sms_upi_count)}</div>
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
