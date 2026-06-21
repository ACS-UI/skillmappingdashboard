import { buildUserFromMapping } from './employee-mapping.js';
import getUser from './db.js';

/**
 * True on local dev and branch-preview hosts, where SSO is skipped and
 * `?as=<ldap>` impersonation is permitted for testing.
 * @returns {boolean}
 */
export function isTestEnvironment() {
  const { hostname } = window.location;
  return hostname === 'localhost' || hostname.includes('.aem.page');
}

/**
 * Resolves the active user. In test environments an `?as=<ldap>` query
 * parameter impersonates that employee (resolved from the mapping sheet);
 * otherwise the SSO-populated IndexDB record is returned.
 * @returns {Promise<object|null>}
 */
export async function getSessionUser() {
  if (isTestEnvironment()) {
    const asLdap = new URLSearchParams(window.location.search).get('as');
    if (asLdap) return buildUserFromMapping(asLdap);
  }
  return getUser();
}

function loadScript(src) {
  const script = document.createElement('script');
  script.src = src;
  document.head.append(script);
}

let imsLoaded;

async function loadIms(onReady) {
  if (!imsLoaded) {
    imsLoaded = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('IMS timeout')), 5000);
      window.adobeid = {
        client_id: 'adobe_skill_mapping',
        environment: 'stg1',
        scope: 'account_cluster.read,additional_info.company,additional_info.ownerOrg,AdobeID,avatar,create_session,exchange.openid-AdobeID-creative_cloud,openid,read_organizations,read_pc',
        debug: false,
        onReady: async () => {
          clearTimeout(timeout);
          if (window.adobeIMS?.isSignedInUser()) {
            try {
              onReady();
            } catch { window.adobeIMS?.signIn(); }
          } else {
            window.adobeIMS?.signIn();
          }
          resolve();
        },
        onError: reject,
      };
      loadScript('https://auth.services.adobe.com/imslib/imslib.min.js');
    });
  }
  return imsLoaded;
}

export async function initAuth(onReady) {
  await loadIms(onReady);
}

export default async function logout() {
  if (window.adobeIMS) {
    window.adobeIMS.signOut();
  } else {
    window.location.replace('/');
  }
}
