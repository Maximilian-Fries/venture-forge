import { useMemo } from "react";

interface MonopolyChartProps {
  totalMarket: number;
  wedgePercent: number;
  score: number;
  className?: string;
}

export function MonopolyChart({
  totalMarket = 100,
  wedgePercent = 15,
  score = 0,
  className = "",
}: MonopolyChartProps) {
  const { wedgePath, labelPosition } = useMemo(() => {
    const cx = 100;
    const cy = 100;
    const r = 80;
    const startAngle = -90;
    const endAngle = startAngle + (wedgePercent / 100) * 360;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);

    const largeArc = wedgePercent > 50 ? 1 : 0;

    const midAngle = ((startAngle + endAngle) / 2) * (Math.PI / 180);
    const labelR = r * 0.6;

    return {
      wedgePath: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
      labelPosition: {
        x: cx + labelR * Math.cos(midAngle),
        y: cy + labelR * Math.sin(midAngle),
      },
    };
  }, [wedgePercent]);

  const scoreColor = score >= 70 ? "text-accent" : score >= 40 ? "text-visionary" : "text-skeptic";

  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <defs>
          <linearGradient id="wedgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--visionary))" stopOpacity="0.9" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.7" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background circle */}
        <circle
          cx="100"
          cy="100"
          r="80"
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="2"
          className="opacity-50"
        />

        {/* Total market fill */}
        <circle
          cx="100"
          cy="100"
          r="78"
          fill="hsl(var(--muted))"
          className="opacity-30"
        />

        {/* Wedge highlight */}
        <path
          d={wedgePath}
          fill="url(#wedgeGradient)"
          filter="url(#glow)"
          className="transition-all duration-500"
        />

        {/* Center score */}
        <text
          x="100"
          y="95"
          textAnchor="middle"
          className={`text-3xl font-bold fill-current ${scoreColor}`}
        >
          {score}
        </text>
        <text
          x="100"
          y="115"
          textAnchor="middle"
          className="text-xs fill-muted-foreground uppercase tracking-wider"
        >
          Monopoly Score
        </text>

        {/* Wedge label */}
        <text
          x={labelPosition.x}
          y={labelPosition.y}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-xs font-medium fill-foreground"
        >
          {wedgePercent}%
        </text>
      </svg>

      {/* Legend */}
      <div className="absolute -bottom-2 left-0 right-0 flex justify-center gap-6 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-muted opacity-50" />
          <span className="text-muted-foreground">Total Market</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-visionary" />
          <span className="text-muted-foreground">Your Wedge</span>
        </div>
      </div>
    </div>
  );
}
