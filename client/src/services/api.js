import axios from 'axios';

// In dev, VITE_API_URL is unset so requests go to /api (Vite proxy → localhost:3001).
// In production, set VITE_API_URL to the Railway server service URL.
const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

const api = axios.create({ baseURL: BASE });

export const fetchConflicts = () => api.get('/conflicts').then(r => r.data);
export const fetchConflict = (id) => api.get(`/conflicts/${id}`).then(r => r.data);

export const fetchMarkets = (symbols) =>
  api.get('/markets', { params: { symbols: symbols.join(',') } }).then(r => r.data);

export const fetchFX = () => api.get('/markets/fx').then(r => r.data);

export const fetchTrade = (countryCode) =>
  api.get(`/trade/${countryCode}`).then(r => r.data);

export async function streamPrediction(conflictId, marketData, tradeData, onChunk, onDone, onError) {
  try {
    const response = await fetch(`${BASE}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conflictId, marketData, tradeData }),
    });

    if (!response.ok) {
      const err = await response.json();
      onError(err.error || 'Prediction failed');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const payload = JSON.parse(line.slice(6));
          if (payload.error) { onError(payload.error); return; }
          if (payload.done) { onDone(payload.scores); return; }
          if (payload.text) onChunk(payload.text);
        } catch {}
      }
    }
  } catch (err) {
    onError(err.message);
  }
}
