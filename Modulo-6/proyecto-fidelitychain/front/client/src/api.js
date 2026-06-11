// Cliente HTTP minimalista contra la API REST del backend (/api).

const BASE = '/api';

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export const api = {
  getToken: () => req('/token'),
  getClients: () => req('/clients'),
  getBalance: (id) => req(`/clients/${encodeURIComponent(id)}/balance`),
  getHistory: (id) => req(`/clients/${encodeURIComponent(id)}/history`),
  register: (clientID, name) =>
    req('/hotel/register', { method: 'POST', body: JSON.stringify({ clientID, name }) }),
  mint: (clientID, amount, description) =>
    req('/hotel/mint', { method: 'POST', body: JSON.stringify({ clientID, amount, description }) }),
  redeem: (clientID, amount, product) =>
    req('/cafeteria/redeem', { method: 'POST', body: JSON.stringify({ clientID, amount, product }) }),
};
