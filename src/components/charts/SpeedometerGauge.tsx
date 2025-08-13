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
  // Comprehensive NaN protection
  const safeValue = (!isNaN(value) && isFinite(value) && value >= 0) ? value : 0;
  const safeMax = (!isNaN(max) && isFinite(max) && max > 0) ? max : 1;
  
  console.log(`SpeedometerGauge ${title}:`, { 
    originalValue: value, 
    originalMax: max,
    safeValue, 
    safeMax,
    valueType: typeof value,
    maxType: typeof max,
    isValueNaN: isNaN(value),
    isMaxNaN: isNaN(max)
  });
  
  const percentage = Math.min((safeValue / safeMax) * 100, 100);
  const displayValue = unit === "%" ? (safeValue * 100).toFixed(1) : safeValue.toFixed(2);
  
  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="relative" style={{ width: size, height: size * 0.6 }}>
        <div className="absolute inset-0 border-8 border-muted rounded-t-full" />
        <div 
          className="absolute inset-0 border-8 border-primary rounded-t-full transition-all duration-500"
          style={{ 
            background: `conic-gradient(from 180deg, hsl(var(--primary)) ${percentage}%, transparent ${percentage}%)`,
            borderRadius: '50% 50% 0 0'
          }}
        />
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