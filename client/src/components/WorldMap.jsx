import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { useState } from 'react';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const INTENSITY_COLOR = (i) =>
  i >= 9 ? '#ef4444' : i >= 7 ? '#f97316' : i >= 5 ? '#eab308' : '#84cc16';

export default function WorldMap({ conflicts = [], gdeltEvents = [], onSelectConflict, selectedConflict }) {
  const [tooltip, setTooltip] = useState(null);

  return (
    <div className="relative w-full h-full bg-[#0a0e1a]">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 140, center: [10, 20] }}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup zoom={1} minZoom={0.8} maxZoom={6}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map(geo => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#1a2235"
                  stroke="#0d1526"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover: { fill: '#1f2d47', outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {/* Static conflict markers */}
          {conflicts.map(c => (
            <Marker key={c.id} coordinates={[c.lon, c.lat]}>
              <circle
                r={c.intensity * 1.8 + 3}
                fill={INTENSITY_COLOR(c.intensity)}
                fillOpacity={selectedConflict?.id === c.id ? 0.95 : 0.6}
                stroke={selectedConflict?.id === c.id ? '#fff' : INTENSITY_COLOR(c.intensity)}
                strokeWidth={selectedConflict?.id === c.id ? 2 : 0.5}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectConflict(c)}
                onMouseEnter={() => setTooltip({ text: c.name, x: c.lon, y: c.lat })}
                onMouseLeave={() => setTooltip(null)}
              />
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>

      {/* Tooltip */}
      {tooltip && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-card border border-border rounded px-3 py-1.5 text-xs text-white pointer-events-none z-10 shadow-lg">
          {tooltip.text}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-card/90 border border-border rounded p-2 text-[10px] space-y-1 z-10">
        <div className="text-gray-500 font-bold uppercase tracking-wider mb-1">Intensity</div>
        {[
          { color: '#ef4444', label: '9-10 Critical' },
          { color: '#f97316', label: '7-8 High' },
          { color: '#eab308', label: '5-6 Elevated' },
          { color: '#84cc16', label: '1-4 Moderate' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-gray-400">{label}</span>
          </div>
        ))}
      </div>

      <div className="absolute bottom-3 right-3 text-[10px] text-gray-700">
        scroll to zoom · drag to pan
      </div>
    </div>
  );
}
