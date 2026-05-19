const SCORE_COLOR = (v) =>
  v >= 80 ? 'text-red-400' : v >= 60 ? 'text-orange-400' : v >= 40 ? 'text-yellow-400' : 'text-green-400';

const SCORE_BG = (v) =>
  v >= 80 ? 'bg-red-500' : v >= 60 ? 'bg-orange-500' : v >= 40 ? 'bg-yellow-500' : 'bg-green-500';

export default function ConflictDetail({ conflict }) {
  if (!conflict) return <EmptyState />;

  const { scores } = conflict;

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div>
        <div className="flex items-start justify-between mb-2">
          <div>
            <h2 className="text-xl font-bold text-white">{conflict.name}</h2>
            <div className="text-gray-400 text-sm">{conflict.region} · {conflict.type}</div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${SCORE_COLOR(scores?.combined)}`}>
              {scores?.combined}
            </div>
            <div className="text-xs text-gray-500">Combined Risk</div>
            <div className={`text-xs font-bold ${SCORE_COLOR(scores?.combined)}`}>{scores?.label}</div>
          </div>
        </div>

        <p className="text-gray-300 text-sm leading-relaxed">{conflict.description}</p>
      </div>

      {/* Risk scores */}
      {scores && (
        <div className="grid grid-cols-3 gap-3">
          <ScoreCard label="Conflict Severity" value={scores.severity} />
          <ScoreCard label="Economic Impact" value={scores.economic} />
          <ScoreCard label="Escalation Risk" value={scores.escalation} />
        </div>
      )}

      {/* Key facts */}
      <div className="grid grid-cols-2 gap-3">
        <InfoCard label="Status" value={conflict.status} />
        <InfoCard label="Intensity" value={`${conflict.intensity}/10`} />
        <InfoCard label="Since" value={new Date(conflict.startDate).getFullYear()} />
        <InfoCard label="Casualties Est." value={conflict.casualtiesEstimate} />
        <InfoCard label="Displaced" value={conflict.displaced} />
        <InfoCard label="Economic Impact" value={conflict.economicImpact} />
      </div>

      {/* Parties */}
      <Section title="Parties Involved">
        <div className="flex flex-wrap gap-1.5">
          {conflict.parties.map(p => (
            <span key={p} className="bg-surface border border-border text-gray-300 text-xs px-2 py-1 rounded">
              {p}
            </span>
          ))}
        </div>
      </Section>

      {/* Tags */}
      <Section title="Key Risk Tags">
        <div className="flex flex-wrap gap-1.5">
          {conflict.tags.map(t => (
            <span key={t} className="bg-blue-950 border border-blue-800 text-blue-300 text-xs px-2 py-1 rounded">
              #{t}
            </span>
          ))}
        </div>
      </Section>

      {/* Commodities */}
      <Section title="Critical Commodities">
        <div className="flex flex-wrap gap-1.5">
          {conflict.commodities.map(c => (
            <span key={c} className="bg-amber-950 border border-amber-800 text-amber-300 text-xs px-2 py-1 rounded">
              {c}
            </span>
          ))}
        </div>
      </Section>
    </div>
  );
}

function ScoreCard({ label, value }) {
  return (
    <div className="bg-surface rounded p-3">
      <div className={`text-xl font-bold ${SCORE_COLOR(value)}`}>{value}</div>
      <div className="text-xs text-gray-500 mb-2">{label}</div>
      <div className="h-1.5 bg-gray-800 rounded overflow-hidden">
        <div className={`h-full ${SCORE_BG(value)} rounded`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="bg-surface rounded p-2.5">
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className="text-sm text-white font-medium">{value}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{title}</div>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full text-gray-600">
      <div className="text-center">
        <div className="text-4xl mb-3">🌍</div>
        <div>Select a conflict from the map or sidebar</div>
      </div>
    </div>
  );
}
