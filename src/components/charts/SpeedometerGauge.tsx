import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface SpeedometerGaugeProps {
  value: number;
  max: number;
  title: string;
  unit?: string;
  size?: number;
}

export const SpeedometerGauge = ({ 
  value, 
  max, 
  title, 
  unit = "%", 
  size = 120 
}: SpeedometerGaugeProps) => {
  const data = useMemo(() => {
    // Ensure values are valid numbers
    const safeValue = isFinite(value) ? value : 0;
    const safeMax = isFinite(max) && max > 0 ? max : 1;
    const percentage = Math.min((safeValue / safeMax) * 100, 100);
    return [
      { value: percentage, fill: "hsl(var(--primary))" },
      { value: 100 - percentage, fill: "hsl(var(--muted))" }
    ];
  }, [value, max]);

  const safeValue = isFinite(value) ? value : 0;
  const displayValue = unit === "%" ? (safeValue * 100).toFixed(1) : safeValue.toFixed(2);
  
  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="relative">
        <ResponsiveContainer width={size} height={size * 0.6}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius={size * 0.25}
              outerRadius={size * 0.4}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
          <div className="text-2xl font-bold text-foreground">
            {displayValue}{unit}
          </div>
        </div>
      </div>
      <div className="text-sm font-medium text-muted-foreground text-center">
        {title}
      </div>
    </div>
  );
};