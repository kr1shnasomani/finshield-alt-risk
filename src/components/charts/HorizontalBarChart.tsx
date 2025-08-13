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
  // Comprehensive NaN protection
  const safeValue = (!isNaN(value) && isFinite(value) && value >= 0) ? value : 0;
  const safeMaxValue = (!isNaN(maxValue) && isFinite(maxValue) && maxValue > 0) ? maxValue : Math.max(100, safeValue * 2);
  
  console.log(`HorizontalBarChart ${title}:`, { 
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
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <span className="text-lg font-semibold text-foreground">
          {currency}{safeValue.toFixed(2)}
        </span>
      </div>
      <div className="h-8 bg-muted rounded-lg overflow-hidden">
        <div 
          className="h-full bg-primary rounded-lg transition-all duration-300"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
};