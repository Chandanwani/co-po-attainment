/**
 * Shared State Sync Manager for CO-PO Attainment System
 * Preserves evaluation state in sessionStorage across pages within the active session.
 * Exiting the browser or closing the tab automatically destroys the session.
 */

const STATE_STORAGE_KEY = 'copo_attainment_session_state';

// Purge any legacy localStorage data so past dead evaluations are never resurrected
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('copo_attainment_state');
    localStorage.removeItem('copo_attainment_session_state');
  }
} catch (e) {}

function getStoredState() {
  try {
    if (typeof sessionStorage === 'undefined') return {};
    const raw = sessionStorage.getItem(STATE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveStoredState(patch) {
  try {
    if (typeof sessionStorage === 'undefined') return patch;
    const current = getStoredState();
    const updated = { ...current, ...patch };
    sessionStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('Could not save to sessionStorage:', e);
    return patch;
  }
}

function clearStoredState() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(STATE_STORAGE_KEY);
      sessionStorage.clear();
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('copo_attainment_state');
      localStorage.removeItem('copo_attainment_session_state');
    }
  } catch (e) {}
}

async function syncStateToBackend(overrideState) {
  const stateToSend = overrideState || getStoredState();
  if (!stateToSend || Object.keys(stateToSend).length === 0) return null;
  try {
    const res = await fetch('/api/sync-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stateToSend)
    });
    return await res.json();
  } catch (err) {
    console.warn('Sync state error:', err);
    return null;
  }
}

// Automatically sync on page load ONLY within an active ongoing session
window.addEventListener('DOMContentLoaded', async () => {
  // If user opens Page 1 fresh (no ?nav=1), clear storage and do not restore old data
  if (window.location.pathname === '/' || window.location.pathname === '/teacher' || window.location.pathname === '/api' || window.location.pathname === '/api/index') {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('nav') !== '1') {
      clearStoredState();
      return;
    }
  }

  const stored = getStoredState();
  if (stored && (stored.teacher || stored.direct || stored.weighted || stored.copo)) {
    try {
      const res = await fetch('/api/get-full-state');
      const serverState = await res.json();
      if (!serverState.teacher || !serverState.teacher.faculty_name) {
        console.log('Restoring active session state to server from sessionStorage...');
        await syncStateToBackend(stored);
      }
    } catch (e) {
      console.warn('Init state check failed:', e);
    }
  }
});
