import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';
const SESSION_KEY = 'gcmi_session_id';

function getOrCreateSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = (crypto.randomUUID?.() ?? `session-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

async function fetchPortfolio(sessionId) {
  const res = await fetch(`${API}/portfolio/${sessionId}`);
  if (!res.ok) throw new Error('Failed to load portfolio');
  return res.json();
}

async function postPortfolio(sessionId, portfolio) {
  const res = await fetch(`${API}/portfolio/${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ portfolio }),
  });
  if (!res.ok) throw new Error('Failed to save portfolio');
  return res.json();
}

export default function useSession() {
  const [sessionId] = useState(getOrCreateSessionId);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['portfolio', sessionId],
    queryFn: () => fetchPortfolio(sessionId),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const saveMutation = useMutation({
    mutationFn: (portfolio) => postPortfolio(sessionId, portfolio),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portfolio', sessionId] }),
  });

  const EMPTY = { assets: [], risk_profile: 'moderate', base_currency: 'USD', focus_regions: [] };

  return {
    sessionId,
    portfolio: data?.portfolio ?? EMPTY,
    conversationCount: data?.conversation_count ?? 0,
    hasPortfolio: (data?.portfolio?.assets?.length ?? 0) > 0,
    isLoading,
    savePortfolio: saveMutation.mutate,
    isSaving: saveMutation.isPending,
  };
}
