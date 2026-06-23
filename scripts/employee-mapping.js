// Authenticated backend endpoint (production). The mapping is no longer publicly
// exposed there; a Bearer token is required.
const MAPPING_API_URL = 'https://293924-uiprojectdashboard-stage.adobeio-static.net/api/v1/web/uiprojectdashboard/employeeMapping';
// Public da.live sheet, used only on local dev / branch preview where there is no
// IMS token (and `?as=<ldap>` impersonation testing still needs the data).
const MAPPING_SHEET_URL = '/employee-mapping.json';

let mappingCache = null;

/**
 * Normalises an LDAP or email to its lowercase local-part (before the `@`).
 * `Atulb@adobe.com` and `atulb` both become `atulb`, so identifiers coming from
 * the skill-report API (`employeeId` / `email`) and the mapping (`empLdap` /
 * `managerLdap`) can be compared on a single key.
 * @param {string} value
 * @returns {string}
 */
export function normalizeLdap(value) {
  return String(value || '').trim().toLowerCase().split('@')[0];
}

// Backend API row (camelCase keys) → internal record.
function fromApiRow(row) {
  return {
    ldap: normalizeLdap(row.empLdap),
    email: String(row.empLdap || '').trim(),
    name: String(row.resourceName || '').trim(),
    managerName: String(row.workdayManager || '').trim(),
    managerLdap: normalizeLdap(row.managerLdap),
    jobLevel: row.jobLevel ? `P${String(row.jobLevel).trim()}` : null,
    location: String(row.location || '').trim(),
  };
}

// da.live sheet row (Title Case keys) → internal record.
function fromSheetRow(row) {
  return {
    ldap: normalizeLdap(row.Emp_LDAP),
    email: String(row.Emp_LDAP || '').trim(),
    name: String(row['Resource Name'] || '').trim(),
    managerName: String(row['Workday Manager'] || '').trim(),
    managerLdap: normalizeLdap(row['Manager LDAP']),
    jobLevel: row['Job Level'] ? `P${String(row['Job Level']).trim()}` : null,
    location: String(row.Location || '').trim(),
  };
}

/**
 * Fetches and caches the employee → manager mapping. When an IMS token is present
 * (production) it reads the authenticated backend endpoint; otherwise (local dev /
 * preview) it falls back to the public da.live sheet. Both are normalised to the
 * same internal record shape.
 * @returns {Promise<Array<{ldap: string, email: string, name: string,
 *   managerName: string, managerLdap: string, jobLevel: string, location: string}>>}
 */
async function fetchMapping() {
  if (mappingCache) return mappingCache;
  const token = window.adobeIMS?.getAccessToken()?.token;
  const url = token ? MAPPING_API_URL : MAPPING_SHEET_URL;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  if (!response.ok) throw new Error(`employee mapping request failed with status ${response.status}`);
  const body = await response.json();
  const rows = Array.isArray(body?.data) ? body.data : [];
  mappingCache = rows.map(token ? fromApiRow : fromSheetRow);
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
