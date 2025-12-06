// packages/web/src/components/ui/ProgressRing.tsx
// Thin ring SVG circular progress component

interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: 'emerald' | 'amber' | 'red' | 'slate' | 'indigo';
  showPercentage?: boolean;
  label?: string;
  sublabel?: string;
}

const colorMap = {
  emerald: { stroke: '#10b981', bg: '#d1fae5' },
  amber: { stroke: '#f59e0b', bg: '#fef3c7' },
  red: { stroke: '#ef4444', bg: '#fee2e2' },
  slate: { stroke: '#94a3b8', bg: '#f1f5f9' },
  indigo: { stroke: '#6366f1', bg: '#e0e7ff' },
};

export function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 6,
  color = 'emerald',
  showPercentage = true,
  label,
  sublabel,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const strokeDashoffset = circumference - (clampedProgress / 100) * circumference;
  const colors = colorMap[color];

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          <title>Progress: {Math.round(clampedProgress)}%</title>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors.bg}
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-300"
          />
        </svg>
        {/* Center content */}
        {showPercentage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-slate-700">{Math.round(clampedProgress)}%</span>
          </div>
        )}
      </div>
      {label && <span className="mt-1 text-sm font-bold text-slate-800">{label}</span>}
      {sublabel && <span className="text-xs text-slate-500">{sublabel}</span>}
    </div>
  );
}
