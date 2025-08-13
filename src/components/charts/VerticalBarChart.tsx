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
  // Comprehensive NaN protection
  const safeValue = (!isNaN(value) && isFinite(value) && value >= 0) ? value : 0;
  const safeMaxValue = (!isNaN(maxValue) && isFinite(maxValue) && maxValue > 0) ? maxValue : Math.max(100, safeValue * 2);
  
  console.log(`VerticalBarChart ${title}:`, { 
    originalValue: value, 
    originalMaxValue: maxValue,
    safeValue, 
    safeMaxValue,
    valueType: typeof value,
    maxValueType: typeof maxValue,
    isValueNaN: isNaN(value),
    isMaxValueNaN: isNaN(maxValue)
  });
  
  const percentage = (safeValue / safeMaxValue) * 100;
  
  return (
    <div className="flex flex-col items-center space-y-3">
      <div className="h-24 w-16 bg-muted rounded-lg overflow-hidden flex flex-col justify-end">
        <div 
          className="w-full bg-primary rounded-lg transition-all duration-300"
          style={{ height: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="text-center">
        <div className="text-lg font-semibold text-foreground">
          {safeValue}{unit}
        </div>
        <div className="text-sm text-muted-foreground">{title}</div>
      </div>
    </div>
  );
};