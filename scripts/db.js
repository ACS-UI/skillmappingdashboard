import { normalizeLdap } from './employee-mapping.js';

export default async function getUser() {
  if (!window.adobeIMS?.getProfile) return null;
  const user = await window.adobeIMS.getProfile();
  return {
    email: user?.email ?? '',
    ldap: normalizeLdap(user?.email),
    name: user?.displayName ?? '',
  };
}
