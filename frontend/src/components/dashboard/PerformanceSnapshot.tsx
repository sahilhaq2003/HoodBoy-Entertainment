import React from 'react';
import { Gauge } from 'lucide-react';
import Card from '../ui/Card';
import ProgressRing from '../ui/ProgressRing';

interface SnapMetric {
  label: string;
  value: number;
  color?: string;
  note?: string;
}

interface PerformanceSnapshotProps {
  title?: string;
  description?: string;
  metrics: SnapMetric[];
}

const PerformanceSnapshot: React.FC<PerformanceSnapshotProps> = ({
  title = 'Performance Snapshot',
  description = 'Key operational ratios computed from live data',
  metrics,
}) => {
  return (
    <Card title={title} description={description} icon={<Gauge size={16} />} accent="coral" badge={metrics.length}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {metrics.map((m) => (
          <div key={m.label} className="flex flex-col items-center gap-2.5 py-2 rounded-xl transition-colors hover:bg-(--hbe-fill)">
            <ProgressRing value={m.value} color={m.color || '#7C3AED'} size={78} strokeWidth={8} />
            <div className="text-center">
              <p className="text-xs font-bold text-[var(--hbe-text)]">{m.label}</p>
              {m.note && <p className="text-[10.5px] text-[var(--hbe-muted)] mt-0.5">{m.note}</p>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default PerformanceSnapshot;