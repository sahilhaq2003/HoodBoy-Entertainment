import React, { useId } from 'react';

interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  strokeWidth?: number;
  className?: string;
}

const Sparkline: React.FC<SparklineProps> = ({
  data,
  color = '#7C3AED',
  width = 96,
  height = 32,
  fill = true,
  strokeWidth = 2,
  className,
}) => {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '');

  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const padTop = 3;
  const padBottom = 4;

  const points = data.map((d, i) => {
    const x = i * step;
    const y = padTop + (1 - (d - min) / span) * (height - padTop - padBottom);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const line = `M ${points.join(' L ')}`;
  const area = `${line} L ${width},${height} L 0,${height} Z`;
  const last = points[points.length - 1].split(',');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} style={{ overflow: 'visible' }}>
      {fill && (
        <defs>
          <linearGradient id={`spark-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
      )}
      {fill && <path d={area} fill={`url(#spark-${gid})`} />}
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 4px ${color}55)` }}
      />
      <circle cx={Number(last[0])} cy={Number(last[1])} r={2.4} fill={color} />
    </svg>
  );
};

export default Sparkline;