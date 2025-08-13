import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis } from "recharts";

interface HorizontalBarChartProps {
  value: number;
  maxValue: number;
  title: string;
  currency?: string;
}

export const HorizontalBarChart = ({ 
  value, 
  maxValue, 
  title, 
  currency = "₹" 
}: HorizontalBarChartProps) => {
  // Ensure values are valid numbers
  const safeValue = isFinite(value) ? value : 0;
  const safeMaxValue = isFinite(maxValue) && maxValue > 0 ? maxValue : 100;
  const data = [{ name: title, value: safeValue, max: safeMaxValue }];
  
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <span className="text-lg font-semibold text-foreground">
          {currency}{safeValue.toFixed(2)}
        </span>
      </div>
      <div className="h-8">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="horizontal" data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis type="number" domain={[0, safeMaxValue]} hide />
            <YAxis type="category" dataKey="name" hide />
            <Bar 
              dataKey="value" 
              fill="hsl(var(--primary))" 
              radius={4}
              background={{ fill: "hsl(var(--muted))" }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};