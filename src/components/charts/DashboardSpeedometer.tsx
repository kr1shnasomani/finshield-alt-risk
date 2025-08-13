interface DashboardSpeedometerProps {
  value: number;
  max: number;
  title: string;
  unit?: string;
  size?: number;
}

export const DashboardSpeedometer = ({ 
  value, 
  max, 
  title, 
  unit = "%", 
  size = 140 
}: DashboardSpeedometerProps) => {
  const safeValue = (!isNaN(value) && isFinite(value) && value >= 0) ? value : 0;
  const safeMax = (!isNaN(max) && isFinite(max) && max > 0) ? max : 1;
  
  const percentage = Math.min((safeValue / safeMax) * 100, 100);
  const displayValue = unit === "%" ? (safeValue * 100).toFixed(1) : safeValue.toFixed(1);
  
  // Calculate the rotation angle for the needle (180 degrees total)
  const needleAngle = -90 + (percentage / 100) * 180;
  
  // Determine color based on percentage (lower is better for risk indicators)
  const getColor = (pct: number) => {
    if (pct <= 33) return { bg: 'bg-green-500', text: 'text-green-600' };
    if (pct <= 66) return { bg: 'bg-yellow-500', text: 'text-yellow-600' };
    return { bg: 'bg-red-500', text: 'text-red-600' };
  };
  
  const colors = getColor(percentage);
  
  return (
    <div className="flex flex-col items-center space-y-3 p-4">
      <div className="relative" style={{ width: size, height: size * 0.7 }}>
        {/* Background arc */}
        <svg 
          width={size} 
          height={size * 0.7} 
          className="absolute inset-0"
          viewBox={`0 0 ${size} ${size * 0.7}`}
        >
          {/* Background arc */}
          <path
            d={`M 20 ${size * 0.6} A ${size/2 - 20} ${size/2 - 20} 0 0 1 ${size - 20} ${size * 0.6}`}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="8"
            strokeLinecap="round"
          />
          
          {/* Colored segments */}
          {/* Green segment (0-33%) */}
          <path
            d={`M 20 ${size * 0.6} A ${size/2 - 20} ${size/2 - 20} 0 0 1 ${size/2 - 15} ${25}`}
            fill="none"
            stroke="hsl(142 76% 36%)"
            strokeWidth="8"
            strokeLinecap="round"
            opacity={percentage > 0 ? 1 : 0.3}
          />
          
          {/* Yellow segment (33-66%) */}
          <path
            d={`M ${size/2 - 15} ${25} A ${size/2 - 20} ${size/2 - 20} 0 0 1 ${size/2 + 15} ${25}`}
            fill="none"
            stroke="hsl(48 96% 53%)"
            strokeWidth="8"
            strokeLinecap="round"
            opacity={percentage > 33 ? 1 : 0.3}
          />
          
          {/* Red segment (66-100%) */}
          <path
            d={`M ${size/2 + 15} ${25} A ${size/2 - 20} ${size/2 - 20} 0 0 1 ${size - 20} ${size * 0.6}`}
            fill="none"
            stroke="hsl(0 84% 60%)"
            strokeWidth="8"
            strokeLinecap="round"
            opacity={percentage > 66 ? 1 : 0.3}
          />
          
          {/* Needle */}
          <line
            x1={size/2}
            y1={size * 0.6}
            x2={size/2 + (size/2 - 35) * Math.cos((needleAngle * Math.PI) / 180)}
            y2={size * 0.6 + (size/2 - 35) * Math.sin((needleAngle * Math.PI) / 180)}
            stroke="hsl(var(--foreground))"
            strokeWidth="3"
            strokeLinecap="round"
          />
          
          {/* Center dot */}
          <circle
            cx={size/2}
            cy={size * 0.6}
            r="6"
            fill="hsl(var(--foreground))"
          />
        </svg>
        
        {/* Value display */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
          <div className={`text-xl font-bold ${colors.text} bg-background/80 px-2 py-1 rounded-md shadow-sm`}>
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