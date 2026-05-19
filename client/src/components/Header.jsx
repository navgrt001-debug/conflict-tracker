export default function Header({ conflicts, selectedConflict }) {
  const active = conflicts.filter(c => c.status === 'Active').length;
  const tense = conflicts.filter(c => c.status === 'Tense').length;
  const critical = conflicts.filter(c => c.scores?.label === 'Critical').length;

  return (
    <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-accent-red animate-pulse" />
        <h1 className="text-white font-bold text-lg tracking-wide">
          GLOBAL CONFLICT & MARKET INTELLIGENCE
        </h1>
        {selectedConflict && (
          <span className="text-accent-blue text-sm font-mono">
            › {selectedConflict.name}
          </span>
        )}
      </div>
      <div className="flex items-center gap-6 text-sm">
        <Stat label="Active Conflicts" value={active} color="text-accent-red" />
        <Stat label="Tense" value={tense} color="text-accent-amber" />
        <Stat label="Critical Risk" value={critical} color="text-accent-red" />
        <div className="text-gray-500 font-mono text-xs">
          {new Date().toUTCString().slice(0, 25)} UTC
        </div>
      </div>
    </header>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="text-center">
      <div className={`font-bold text-base ${color}`}>{value}</div>
      <div className="text-gray-500 text-xs uppercase tracking-wider">{label}</div>
    </div>
  );
}
