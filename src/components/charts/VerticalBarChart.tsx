import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis } from "recharts";

interface VerticalBarChartProps {
  value: number;
  maxValue: number;
  title: string;
  unit?: string;
}

export const VerticalBarChart = ({ 
  value, 
  maxValue, 
  title, 
  unit = "" 
}: VerticalBarChartProps) => {
  const data = [{ name: title, value, max: maxValue }];
  
  return (
    <div className="flex flex-col items-center space-y-3">
      <div className="h-24 w-16">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis dataKey="name" hide />
            <YAxis domain={[0, maxValue]} hide />
            <Bar 
              dataKey="value" 
              fill="hsl(var(--primary))" 
              radius={4}
              background={{ fill: "hsl(var(--muted))" }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-center">
        <div className="text-lg font-semibold text-foreground">
          {value}{unit}
        </div>
        <div className="text-sm text-muted-foreground">{title}</div>
      </div>
    </div>
  );
};