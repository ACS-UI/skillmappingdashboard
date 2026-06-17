/**
 * App-wide loading spinner overlay.
 * A single backdrop + card is created on first use and reused on subsequent calls.
 * CSS lives in styles/lazy-styles.css (.app-spinner-*).
 */

let overlay = null;
let labelEl = null;

function ensureOverlay() {
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.className = 'app-spinner-overlay';
  overlay.style.display = 'none';
  const card = document.createElement('div');
  card.className = 'app-spinner-card';
  const ring = document.createElement('div');
  ring.className = 'app-spinner-ring';
  labelEl = document.createElement('p');
  labelEl.className = 'app-spinner-label';
  card.append(ring, labelEl);
  overlay.append(card);
  document.body.append(overlay);
}

export function showSpinner(message = 'Loading…') {
  ensureOverlay();
  labelEl.textContent = message;
  overlay.style.display = 'flex';
}

export function hideSpinner() {
  if (overlay) overlay.style.display = 'none';
}
