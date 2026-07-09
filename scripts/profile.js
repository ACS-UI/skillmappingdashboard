import { getProfile } from './api.js';
import { isTestEnvironment } from './auth.js';
import { buildUserFromMapping } from './employee-mapping.js';

let profilePromise = null;
let fallbackShown = false;

/**
 * Resolves the current user's profile `{ empLdap, empEmail, userId, role }`.
 * In production this hits the getProfile API (Bearer token attached by api.js).
 * On local dev / preview (no IMS token) it derives a profile from the
 * `?as=<ldap>` impersonation param against the mapping, with an optional
 * `?role=` override so employee/manager/admin can all be exercised locally.
 * @returns {Promise<{empLdap: string, empEmail: string, userId: string, role: string}>}
 */
async function resolveProfile() {
  if (isTestEnvironment()) {
    const params = new URLSearchParams(window.location.search);
    const asLdap = params.get('as');
    const roleOverride = params.get('role');
    if (asLdap) {
      const user = await buildUserFromMapping(asLdap);
      return {
        empLdap: user.ldap,
        empEmail: user.email,
        userId: user.ldap,
        role: roleOverride || (user.isManager ? 'manager' : 'employee'),
      };
    }
    return {
      empLdap: '', empEmail: '', userId: '', role: roleOverride || 'employee',
    };
  }
  return getProfile();
}

/**
 * Cached so the profile API is called only once per page load — the header and
 * any role-gated blocks can all await this without triggering extra requests.
 * @returns {Promise<{empLdap: string, empEmail: string, userId: string, role: string}>}
 */
export async function getUserProfile() {
  if (!profilePromise) profilePromise = resolveProfile();
  return profilePromise;
}

/**
 * Replaces the whole page with a minimal fallback when the profile can't be
 * loaded. Idempotent — safe to call from multiple blocks. Uses inline styles so
 * it has no CSS dependency.
 * @param {string} [message]
 */
export function showFallbackPage(message = 'Something went wrong. Please try again.') {
  if (fallbackShown) return;
  fallbackShown = true;
  document.body.replaceChildren();

  const wrap = document.createElement('div');
  wrap.className = 'profile-fallback';
  wrap.setAttribute('style', 'min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center;');

  const text = document.createElement('p');
  text.textContent = message;
  text.setAttribute('style', 'font-size:1.125rem;color:#2c2c2c;margin:0;');

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = 'Retry';
  retry.setAttribute('style', 'padding:8px 20px;border:1px solid #1473e6;background:#1473e6;color:#fff;border-radius:6px;font-size:0.9375rem;cursor:pointer;');
  retry.addEventListener('click', () => window.location.reload());

  wrap.append(text, retry);
  document.body.append(wrap);
}
