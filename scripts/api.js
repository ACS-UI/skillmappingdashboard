const API_BASE_URL = 'https://293924-uiprojectdashboard-stage.adobeio-static.net/api/v1/web/uiprojectdashboard';
const SKILL_REPORT_URL = `${API_BASE_URL}/skillReport`;

let levelsCache = null;

async function ensureOk(response) {
  if (response.ok) {
    return response;
  }

  // Surface the backend's actual error message, not just the status code
  let detail = '';
  try {
    const body = await response.clone().json();
    detail = body?.error || JSON.stringify(body);
  } catch {
    try {
      detail = await response.text();
    } catch {
      detail = '';
    }
  }

  const error = new Error(detail || `API request failed with status ${response.status}`);
  error.status = response.status;
  error.detail = detail;
  throw error;
}

async function requestJson(path, options = {}) {
  const { headers: optHeaders, ...restOptions } = options;
  const token = window.adobeIMS?.getAccessToken()?.token;
  const response = await fetch(path, {
    headers: {
      Accept: 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...optHeaders,
    },
    ...restOptions,
  });

  await ensureOk(response);
  return response.json();
}

async function fetchExperienceLevels() {
  if (levelsCache) return levelsCache;
  const { data } = await requestJson('/skill-levels.json');
  const rows = Array.isArray(data) ? data : data?.data;
  if (!Array.isArray(rows)) throw new Error(`skill-levels.json returned unexpected data: ${JSON.stringify(data)}`);
  levelsCache = rows.map((row) => ({
    maxMonths: Number(row['max-months']),
    level: Number(row.level),
    label: row.label,
  }));
  return levelsCache;
}

export async function getLevelFromExperienceMonths(months) {
  const normalizedMonths = Number(months);
  if (!Number.isFinite(normalizedMonths) || normalizedMonths < 1) return null;
  const levels = await fetchExperienceLevels();
  return levels.find((entry) => normalizedMonths <= entry.maxMonths) || null;
}

export function buildSkillsPayload(employeeId, email, name, skillEntries) {
  return {
    employeeId,
    email,
    name,
    skills: skillEntries.map((entry) => {
      const skill = {
        name: entry.name,
        expInMonths: entry.expInMonths,
        proficiencyLevel: entry.proficiencyLevel,
      };
      // Backend stores specialization and platform as comma-separated strings.
      if (Array.isArray(entry.specializations) && entry.specializations.length) {
        skill.specialization = entry.specializations.join(', ');
      }
      if (Array.isArray(entry.platforms) && entry.platforms.length) {
        skill.platform = entry.platforms.join(', ');
      }
      if (entry.certification) {
        skill.certification = { certificateName: entry.certification.name };
        if (entry.certification.imageUrl) {
          skill.certification.certificateImageUrl = entry.certification.imageUrl;
        }
      }
      return skill;
    }),
  };
}

export async function getSkillReport() {
  return requestJson(SKILL_REPORT_URL);
}

export async function getEmployeeSkillReport(employeeId) {
  return requestJson(`${SKILL_REPORT_URL}/employee/${encodeURIComponent(employeeId)}`);
}

export async function submitSkillReport(payload) {
  return requestJson(SKILL_REPORT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteSkill(employeeId, skillName) {
  return requestJson(SKILL_REPORT_URL, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId, skillName }),
  });
}
