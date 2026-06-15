const MAPPING_URL = '/employee-mapping.json';

let mappingCache = null;

/**
 * Normalises an LDAP or email to its lowercase local-part (before the `@`).
 * `Atulb@adobe.com` and `atulb` both become `atulb`, so identifiers coming from
 * the skill-report API (`employeeId` / `email`) and the mapping sheet (`Emp_LDAP`
 * / `Manager LDAP`) can be compared on a single key.
 * @param {string} value
 * @returns {string}
 */
export function normalizeLdap(value) {
  return String(value || '').trim().toLowerCase().split('@')[0];
}

/**
 * Fetches and caches the authorable employee → manager mapping sheet.
 * @returns {Promise<Array<{ldap: string, email: string, name: string,
 *   managerName: string, managerLdap: string}>>}
 */
async function fetchMapping() {
  if (mappingCache) return mappingCache;
  const response = await fetch(MAPPING_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`employee-mapping.json request failed with status ${response.status}`);
  const body = await response.json();
  const rows = Array.isArray(body?.data) ? body.data : [];
  mappingCache = rows.map((row) => ({
    ldap: normalizeLdap(row.Emp_LDAP),
    email: String(row.Emp_LDAP || '').trim(),
    name: String(row['Resource Name'] || '').trim(),
    managerName: String(row['Workday Manager'] || '').trim(),
    managerLdap: normalizeLdap(row['Manager LDAP']),
    jobLevel: row['Job Level'] ? `P${String(row['Job Level']).trim()}` : null,
    location: String(row.Location || '').trim(),
  }));
  return mappingCache;
}

/**
 * Returns all employee mapping records (with jobLevel and location included).
 * @returns {Promise<Array>}
 */
export async function getAllEmployeeRecords() {
  return fetchMapping();
}

/**
 * Looks up a single employee's mapping record.
 * @param {string} ldapOrEmail
 * @returns {Promise<object|null>}
 */
export async function getEmployeeMapping(ldapOrEmail) {
  const key = normalizeLdap(ldapOrEmail);
  if (!key) return null;
  const rows = await fetchMapping();
  return rows.find((row) => row.ldap === key) || null;
}

/**
 * A person is a manager when their LDAP is listed as the `Manager LDAP` of at
 * least one other employee in the sheet.
 * @param {string} ldapOrEmail
 * @returns {Promise<boolean>}
 */
export async function isManager(ldapOrEmail) {
  const key = normalizeLdap(ldapOrEmail);
  if (!key) return false;
  const rows = await fetchMapping();
  return rows.some((row) => row.managerLdap === key);
}

/**
 * Returns the direct reports (one level only) of the given manager.
 * @param {string} managerLdapOrEmail
 * @returns {Promise<Array<object>>}
 */
export async function getDirectReports(managerLdapOrEmail) {
  const key = normalizeLdap(managerLdapOrEmail);
  if (!key) return [];
  const rows = await fetchMapping();
  return rows.filter((row) => row.managerLdap === key);
}

/**
 * Builds a user record (matching the IndexDB user shape) purely from the
 * mapping sheet. Used for local/preview impersonation testing via `?as=<ldap>`.
 * @param {string} ldapOrEmail
 * @returns {Promise<{name: string, email: string, ldap: string, isManager: boolean}>}
 */
export async function buildUserFromMapping(ldapOrEmail) {
  const ldap = normalizeLdap(ldapOrEmail);
  const record = await getEmployeeMapping(ldap);
  return {
    name: record?.name || ldap,
    email: record?.email || (ldap ? `${ldap}@adobe.com` : ''),
    ldap,
    isManager: await isManager(ldap),
  };
}
