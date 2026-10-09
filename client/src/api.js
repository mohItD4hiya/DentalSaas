export const api = async (path, method = 'GET', body) => {
  const r = await fetch('/api/' + path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.token || '') }, body: body && JSON.stringify(body) });
  if (r.status === 401) { localStorage.clear(); location.reload(); }
  const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Request failed'); return d;
};
