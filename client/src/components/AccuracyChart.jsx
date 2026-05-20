import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, CartesianGrid,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded px-3 py-2 text-xs">
      <div className="text-gray-400 mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>{p.name}: {p.value}%</div>
      ))}
    </div>
  );
};

export function AccuracyTimeline({ timeline = [] }) {
  if (timeline.length < 2) {
    return (
      <div className="flex items-center justify-center h-28 text-gray-600 text-xs">
        Need more resolved predictions to show trend
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={timeline} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={50} stroke="#374151" strokeDasharray="4 4" label={{ value: 'Random', fill: '#4b5563', fontSize: 9 }} />
        <Line
          type="monotone"
          dataKey="accuracy"
          name="Accuracy"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 3, fill: '#3b82f6' }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AccuracyByAsset({ byAsset = {} }) {
  const data = Object.entries(byAsset).map(([label, stats]) => ({
    label,
    accuracy: stats.accuracy_pct,
    total: stats.total,
  }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-28 text-gray-600 text-xs">
        No resolved predictions yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 20, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} angle={-30} textAnchor="end" />
        <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={50} stroke="#374151" strokeDasharray="4 4" />
        <Bar dataKey="accuracy" name="Accuracy" radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.accuracy >= 70 ? '#10b981' : entry.accuracy >= 50 ? '#3b82f6' : '#ef4444'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
