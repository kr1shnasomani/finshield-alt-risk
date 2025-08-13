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
  // Debug logging
  console.log(`HorizontalBarChart ${title}:`, { value, maxValue, isValueFinite: isFinite(value), isMaxFinite: isFinite(maxValue) });
  
  // Comprehensive NaN protection
  const safeValue = (!isNaN(value) && isFinite(value) && value >= 0) ? value : 0;
  const safeMaxValue = (!isNaN(maxValue) && isFinite(maxValue) && maxValue > 0) ? maxValue : Math.max(100, safeValue * 2);
  
  console.log(`HorizontalBarChart ${title} safe values:`, { safeValue, safeMaxValue });
  
  // Double-check that domain values are valid
  const domainMax = !isNaN(safeMaxValue) && isFinite(safeMaxValue) ? safeMaxValue : 100;
  
  const data = [{ name: title, value: safeValue }];
  
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
            <XAxis type="number" domain={[0, domainMax]} hide />
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