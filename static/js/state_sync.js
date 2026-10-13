/**
 * Shared State Sync Manager for CO-PO Attainment System
 * Preserves evaluation state in localStorage across all pages and syncs with backend serverless lambdas.
 */

const STATE_STORAGE_KEY = 'copo_attainment_state';

function getStoredState() {
  try {
    const raw = localStorage.getItem(STATE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveStoredState(patch) {
  try {
    const current = getStoredState();
    const updated = { ...current, ...patch };
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('Could not save to localStorage:', e);
    return patch;
  }
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

// Automatically sync on page load if backend state is missing
window.addEventListener('DOMContentLoaded', async () => {
  const stored = getStoredState();
  if (stored && (stored.teacher || stored.direct || stored.weighted || stored.copo)) {
    try {
      const res = await fetch('/api/get-full-state');
      const serverState = await res.json();
      if (!serverState.teacher || !serverState.teacher.faculty_name) {
        console.log('Restoring session state to server from localStorage...');
        await syncStateToBackend(stored);
      }
    } catch (e) {
      console.warn('Init state check failed:', e);
    }
  }
});
