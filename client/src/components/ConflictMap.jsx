import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const INTENSITY_COLOR = (i) => {
  if (i >= 9) return '#ef4444';
  if (i >= 7) return '#f97316';
  if (i >= 5) return '#eab308';
  return '#84cc16';
};

export default function ConflictMap({ conflicts, selected, onSelect }) {
  return (
    <MapContainer
      center={[20, 10]}
      zoom={2}
      minZoom={2}
      maxZoom={8}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
      />
      {conflicts.map(conflict => (
        <CircleMarker
          key={conflict.id}
          center={[conflict.lat, conflict.lon]}
          radius={conflict.intensity * 2 + 4}
          pathOptions={{
            fillColor: INTENSITY_COLOR(conflict.intensity),
            fillOpacity: selected?.id === conflict.id ? 0.95 : 0.65,
            color: selected?.id === conflict.id ? '#fff' : INTENSITY_COLOR(conflict.intensity),
            weight: selected?.id === conflict.id ? 2 : 1,
          }}
          eventHandlers={{ click: () => onSelect(conflict) }}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-bold text-white mb-1">{conflict.name}</div>
              <div className="text-gray-400 text-xs mb-1">{conflict.type}</div>
              <div className="text-xs space-y-0.5">
                <div>Intensity: <span className="text-orange-400 font-bold">{conflict.intensity}/10</span></div>
                <div>Status: <span className="text-yellow-300">{conflict.status}</span></div>
                {conflict.scores && (
                  <div>Risk: <span className="text-red-400 font-bold">{conflict.scores.combined}/100 ({conflict.scores.label})</span></div>
                )}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
