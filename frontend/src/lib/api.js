// Calls to the Python review service.
export const API_BASE = (import.meta.env.VITE_REVIEW_API_URL || 'http://localhost:8000').replace(/\/$/, '')

export async function apiFetch(path, { token, method = 'GET', body, signal } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    let detail = response.statusText
    try { detail = (await response.json()).detail || detail } catch { /* ignore */ }
    throw new Error(detail)
  }
  return response.json()
}

export const getHealth = (signal) => apiFetch('/health', { signal })

// Reviews an item (and the other items of its campaign) and stores the findings.
export const reviewItem = (itemId, token) => apiFetch(`/review/item/${itemId}`, { method: 'POST', token })
export const reviewCampaign = (campaignId, token) => apiFetch(`/review/campaign/${campaignId}`, { method: 'POST', token })
