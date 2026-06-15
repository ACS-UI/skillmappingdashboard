// Segmented toggle shown to managers, who can both submit their own skills
// (entry form, `/`) and view their team's report (`/employee-details`).
// The caller decides whether to render it (managers only).

const VIEWS = {
  entry: { href: '/', label: 'Enter Skills', short: 'Skills' },
  report: { href: '/employee-details', label: 'Manager View', short: 'Manager' },
};

/**
 * Builds the view toggle. Links carry the current query string so `?as=<ldap>`
 * test impersonation survives navigation between the two views.
 * @param {'entry'|'report'} currentView the view currently shown
 * @returns {HTMLElement}
 */
export default function buildViewToggle(currentView) {
  const { search } = window.location;
  const nav = document.createElement('nav');
  nav.className = 'view-toggle';
  nav.setAttribute('aria-label', 'Switch view');

  Object.entries(VIEWS).forEach(([key, { href, label, short }]) => {
    const link = document.createElement('a');
    const active = key === currentView;
    link.className = `view-toggle__option${active ? ' view-toggle__option--active' : ''}`;
    link.href = `${href}${search}`;
    link.textContent = label;
    link.dataset.short = short;
    if (active) link.setAttribute('aria-current', 'page');
    nav.append(link);
  });

  return nav;
}
