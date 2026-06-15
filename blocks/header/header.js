import logout, { getSessionUser } from '../../scripts/auth.js';
import buildViewToggle from '../../scripts/view-toggle.js';

export default async function decorate(block) {
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Main navigation');

  // Brand / logo — wraps in a home link
  const brand = document.createElement('a');
  brand.className = 'header__brand';
  brand.href = '/';
  brand.setAttribute('aria-label', 'Adobe home');

  try {
    const resp = await fetch('/header.plain.html');
    if (resp.ok) {
      const tmp = document.createElement('div');
      tmp.innerHTML = await resp.text();
      const picture = tmp.querySelector('picture');
      const img = tmp.querySelector('img');
      if (picture) {
        brand.append(picture);
      } else if (img) {
        brand.append(img);
      } else {
        // Fall back to first element's text content (e.g. authored "Adobe")
        const first = tmp.firstElementChild;
        brand.textContent = first ? first.textContent.trim() : 'Adobe';
      }
    } else {
      brand.textContent = 'Adobe';
    }
  } catch {
    brand.textContent = 'Adobe';
  }

  // Logout button
  const actions = document.createElement('div');
  actions.className = 'header__actions';
  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'header__logout-btn';
  logoutBtn.type = 'button';
  logoutBtn.setAttribute('aria-label', 'Logout');

  const logoutLabel = document.createElement('span');
  logoutLabel.className = 'header__logout-text';
  logoutLabel.textContent = 'Logout';

  const logoutIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  logoutIcon.setAttribute('width', '18');
  logoutIcon.setAttribute('height', '18');
  logoutIcon.setAttribute('viewBox', '0 0 24 24');
  logoutIcon.setAttribute('fill', 'none');
  logoutIcon.setAttribute('stroke', 'currentColor');
  logoutIcon.setAttribute('stroke-width', '2');
  logoutIcon.setAttribute('stroke-linecap', 'round');
  logoutIcon.setAttribute('stroke-linejoin', 'round');
  logoutIcon.setAttribute('aria-hidden', 'true');
  logoutIcon.classList.add('header__logout-icon');
  const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  iconPath.setAttribute('d', 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4');
  const iconArrow = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  iconArrow.setAttribute('points', '16 17 21 12 16 7');
  const iconLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  iconLine.setAttribute('x1', '21');
  iconLine.setAttribute('y1', '12');
  iconLine.setAttribute('x2', '9');
  iconLine.setAttribute('y2', '12');
  logoutIcon.append(iconPath, iconArrow, iconLine);

  logoutBtn.append(logoutLabel, logoutIcon);
  logoutBtn.addEventListener('click', logout);
  actions.append(logoutBtn);

  nav.append(brand, actions);
  block.textContent = '';
  block.append(nav);

  // Inject the view toggle for managers, left of the logout button.
  try {
    const user = await getSessionUser();
    if (user?.isManager) {
      const currentView = window.location.pathname.startsWith('/employee-details') ? 'report' : 'entry';
      actions.prepend(buildViewToggle(currentView));
    }
  } catch { /* leave header unchanged if session lookup fails */ }
}
