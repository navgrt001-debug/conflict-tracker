import { LineChart, Line, ResponsiveContainer } from 'recharts';

export function SparklineChart({ data, up }) {
  const points = data.map((v, i) => ({ v }));
  return (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={points}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={up ? '#10b981' : '#ef4444'}
          dot={false}
          strokeWidth={1.5}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
