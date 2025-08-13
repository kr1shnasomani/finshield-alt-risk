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
  // Debug logging
  console.log(`SpeedometerGauge ${title}:`, { value, max, isValueFinite: isFinite(value), isMaxFinite: isFinite(max) });
  
  const data = useMemo(() => {
    // Comprehensive NaN protection
    const safeValue = (!isNaN(value) && isFinite(value) && value >= 0) ? value : 0;
    const safeMax = (!isNaN(max) && isFinite(max) && max > 0) ? max : 1;
    const percentage = Math.min((safeValue / safeMax) * 100, 100);
    
    console.log(`SpeedometerGauge ${title} calculation:`, { safeValue, safeMax, percentage });
    
    // Ensure percentage is a valid number
    const safePercentage = (!isNaN(percentage) && isFinite(percentage)) ? percentage : 0;
    
    return [
      { value: safePercentage, fill: "hsl(var(--primary))" },
      { value: 100 - safePercentage, fill: "hsl(var(--muted))" }
    ];
  }, [value, max, title]);

  const safeValue = (!isNaN(value) && isFinite(value)) ? value : 0;
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