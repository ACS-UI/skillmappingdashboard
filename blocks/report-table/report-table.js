import { getSkillReport } from '../../scripts/api.js';
import { getUserProfile, showFallbackPage } from '../../scripts/profile.js';
import {
  getDirectReports, normalizeLdap, getAllEmployeeRecords,
} from '../../scripts/employee-mapping.js';
import { showSpinner, hideSpinner } from '../../scripts/spinner.js';

function readBlockConfig(block) {
  return [...block.children].reduce((config, row) => {
    const cells = [...row.children];
    if (cells.length < 2) return config;
    const key = cells[0].textContent.trim().toLowerCase();
    const value = cells[1].textContent.trim();
    if (key) config[key] = value;
    return config;
  }, {});
}

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (typeof text === 'string') el.textContent = text;
  return el;
}

// Rarity tiers by share of the workforce holding a skill (most → least common).
// First tier whose `minShare` the skill meets wins.
const RARITY_TIERS = [
  { id: 'generic', label: 'Generic', minShare: 0.5 },
  { id: 'niche', label: 'Niche', minShare: 0.3 },
  { id: 'super-niche', label: 'Super niche', minShare: 0.2 },
  { id: 'ultra-niche', label: 'Ultra niche', minShare: 0.1 },
];

const LEVEL_DESCRIPTIONS = {
  1: 'Basic understanding of frontend concepts, HTML, CSS, JavaScript, '
    + 'and simple UI development with guidance.',
  2: 'Able to independently build standard UI features, '
    + 'responsive pages, and basic integrations.',
  3: 'Strong frontend development skills with experience in complex features, '
    + 'optimization, testing, and mentoring.',
  4: 'Leads frontend architecture, solutioning, best practices, '
    + 'and enterprise-level implementations.',
  5: 'Organizational expert driving frontend strategy, innovation, standards, '
    + 'and large-scale technical transformation.',
};

function getRarityTier(share) {
  // The last tier has minShare 0, so a match is always found.
  return RARITY_TIERS.find((tier) => share >= tier.minShare);
}

// The rarity tier a given skill falls into (org-wide), or undefined if its
// share is below the lowest tier threshold.
function getSkillTier(skillName, skillRarity) {
  return skillRarity?.get(skillName)?.tier;
}

// Buckets skills into rarity tiers, sorted alphabetically within each tier.
// Returns a Map keyed by tier id in RARITY_TIERS order → skills[]. This is the
// single source of truth for tier grouping, shared by the tier table render,
// the CSV export, and the distribution table. Skills whose share falls below
// the lowest tier are omitted.
function groupSkillsByTier(skills, skillRarity) {
  const byTier = new Map(RARITY_TIERS.map((tier) => [tier.id, []]));
  skills.forEach((skill) => {
    const tierId = getSkillTier(skill.name, skillRarity)?.id;
    if (byTier.has(tierId)) byTier.get(tierId).push(skill);
  });
  byTier.forEach((tierSkills) => tierSkills.sort((a, b) => a.name.localeCompare(b.name)));
  return byTier;
}

/**
 * Computes a rarity tier per skill from how many employees across the whole
 * report hold it. Common skills are "generic", rare ones "ultra niche".
 * Computed over the full workforce, not the filtered team, so the tier reflects
 * org-wide scarcity.
 * @param {Array} employees all employees from the skill report
 * @returns {Map<string, {tier: object, holders: number, total: number, share: number}>}
 */
function computeSkillRarity(employees) {
  const total = employees.length;
  const counts = new Map();
  employees.forEach((emp) => {
    new Set(emp.skills.map((skill) => skill.name)).forEach((name) => {
      counts.set(name, (counts.get(name) || 0) + 1);
    });
  });

  const rarity = new Map();
  counts.forEach((holders, name) => {
    const share = total ? holders / total : 0;
    rarity.set(name, {
      tier: getRarityTier(share), holders, total, share,
    });
  });
  return rarity;
}

function getLevelLabel(proficiencyLevels, level) {
  const match = proficiencyLevels.find((entry) => entry.level === level);
  return match ? match.label : '—';
}

// Single-letter proficiency abbreviation (Master → M, Professional → P, …).
// The boilerplate levels each start with a distinct letter, so the first
// character is unambiguous.
function getLevelInitial(proficiencyLevels, level) {
  const label = getLevelLabel(proficiencyLevels, level);
  return label && label !== '—' ? label.charAt(0).toUpperCase() : '';
}

// Produces a flat, one-row-per-skill CSV: Employee, Rarity Tier, Skill,
// Proficiency Code, Proficiency Level, Experience (Months). Employees are
// alphabetical; within each, skills are grouped in tier order then alphabetical
// (via groupSkillsByTier). Skills below the lowest rarity tier are omitted,
// matching what the tables display.
function skillDataToCsv(employees, proficiencyLevels, skillRarity) {
  const header = ['Employee', 'Rarity Tier', 'Skill', 'Proficiency Code',
    'Proficiency Level', 'Experience (Months)'];
  const rows = [header];

  [...employees]
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((emp) => {
      groupSkillsByTier(emp.skills, skillRarity).forEach((skills, tierId) => {
        const tier = RARITY_TIERS.find((t) => t.id === tierId);
        skills.forEach((skill) => {
          rows.push([
            emp.name,
            tier.label,
            skill.name,
            getLevelInitial(proficiencyLevels, skill.proficiencyLevel),
            getLevelLabel(proficiencyLevels, skill.proficiencyLevel),
            skill.expInMonths != null ? skill.expInMonths : '',
          ]);
        });
      });
    });

  return rows
    .map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(','))
    .join('\n');
}

function downloadCsv(filename, content) {
  // Prepend a UTF-8 BOM so Excel opens the file with the right encoding
  // (keeps accented names and symbols intact).
  const bom = String.fromCharCode(0xFEFF);
  const blob = new Blob([bom, content], { type: 'text/csv;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}

// Builds one employee's skills grouped into rarity-tier sections for the detail
// pane: each tier a colour-coded block (rarity "heat" ramp) with rarity pips, a
// skill count, and the skills flowing across a grid.
function buildDetailSections(emp, proficiencyLevels, skillRarity) {
  const byTier = groupSkillsByTier(emp.skills, skillRarity);
  const total = [...byTier.values()].reduce((sum, s) => sum + s.length, 0);

  const head = createElement('div', 'report-table__md-detail-head');
  head.append(
    createElement('h3', 'report-table__md-detail-name', emp.name),
    createElement('span', 'report-table__md-detail-meta', `${total} skill${total === 1 ? '' : 's'}`),
  );

  const tiers = createElement('div', 'report-table__md-tiers');
  RARITY_TIERS.forEach((tier, idx) => {
    const skills = byTier.get(tier.id) || [];
    if (!skills.length) return;
    const section = createElement('div', `report-table__md-tier report-table__md-tier--${tier.id}`);

    // Header: tier name + rarity pips (1 = common … 4 = rarest) + skill count.
    const tierHead = createElement('div', 'report-table__md-tier-head');
    tierHead.append(createElement('span', 'report-table__md-tier-name', tier.label));
    const pips = createElement('span', 'report-table__md-pips');
    pips.title = `Rarity ${idx + 1} of ${RARITY_TIERS.length}`;
    for (let i = 0; i < RARITY_TIERS.length; i += 1) {
      pips.append(createElement('span', `report-table__md-pip${i <= idx ? ' report-table__md-pip--on' : ''}`));
    }
    tierHead.append(
      pips,
      createElement('span', 'report-table__md-tier-count', `${skills.length} skill${skills.length === 1 ? '' : 's'}`),
    );
    section.append(tierHead);

    const grid = createElement('div', 'report-table__md-tier-grid');
    skills.forEach((skill) => {
      const row = createElement('div', 'report-table__md-skill');
      const initial = getLevelInitial(proficiencyLevels, skill.proficiencyLevel);
      row.append(createElement('span', 'report-table__skill-label', skill.name));
      if (initial) {
        row.append(createElement('span', `report-table__badge report-table__badge--l${skill.proficiencyLevel}`, `(${initial})`));
      }
      row.append(createElement('span', 'report-table__md-months', skill.expInMonths != null ? `${skill.expInMonths} M` : '—'));
      grid.append(row);
    });
    section.append(grid);
    tiers.append(section);
  });

  return [head, tiers];
}

/**
 * Renders the "Skill Data" tab as a master/detail view: a scrollable sidebar of
 * employees on the left, and the selected employee's skills grouped into rarity
 * tiers on the right. Only one employee renders at a time, so the view stays
 * compact for large teams and for people with many skills.
 * @param {Element} body the block body to append the view into
 * @param {Array} employees the (filtered) employees to display
 * @param {Array} proficiencyLevels level metadata from the API
 * @param {Map} skillRarity per-skill rarity info from computeSkillRarity()
 */
function renderMasterDetail(body, employees, proficiencyLevels, skillRarity) {
  const searchWrap = createElement('div', 'report-table__search-wrap');
  const searchInput = createElement('input', 'report-table__search');
  searchInput.type = 'search';
  searchInput.placeholder = 'Search by employee name…';
  searchInput.setAttribute('aria-label', 'Search employees');
  searchWrap.append(searchInput);

  const md = createElement('div', 'report-table__md');
  const list = createElement('div', 'report-table__md-list');
  const detail = createElement('div', 'report-table__md-detail');
  md.append(list, detail);
  body.append(searchWrap, md);

  let activeName = employees[0] ? employees[0].name : null;

  function renderDetail(emp) {
    detail.textContent = '';
    if (!emp) {
      detail.append(createElement('p', 'report-table__md-empty', 'No employees match your search.'));
      return;
    }
    detail.append(...buildDetailSections(emp, proficiencyLevels, skillRarity));
  }

  function renderList(items) {
    list.textContent = '';
    list.append(createElement('div', 'report-table__md-count', `${items.length} employee${items.length === 1 ? '' : 's'}`));
    items.forEach((emp) => {
      const btn = createElement('button', 'report-table__md-item');
      btn.type = 'button';
      btn.append(
        createElement('span', 'report-table__md-item-name', emp.name),
        createElement('span', 'report-table__md-item-count', `${emp.skills.length}`),
      );
      if (emp.name === activeName) btn.classList.add('report-table__md-item--active');
      btn.addEventListener('click', () => {
        activeName = emp.name;
        list.querySelectorAll('.report-table__md-item').forEach((b) => b.classList.remove('report-table__md-item--active'));
        btn.classList.add('report-table__md-item--active');
        renderDetail(emp);
      });
      list.append(btn);
    });
  }

  renderList(employees);
  renderDetail(employees[0]);

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    const matches = q ? employees.filter((emp) => emp.name.toLowerCase().includes(q)) : employees;
    // Keep the current selection if it survives the filter, else jump to the
    // first match so the detail pane always reflects the visible list.
    if (!matches.some((emp) => emp.name === activeName)) {
      activeName = matches[0] ? matches[0].name : null;
      renderDetail(matches[0] || null);
    }
    renderList(matches);
  });
}

/**
 * Builds a location → tier → P-level → employee count distribution from the
 * skill report joined with the employee mapping. Each employee is counted once
 * per tier they have at least one skill in, under their job level and location.
 * @param {Array} employees direct-reports with submitted skills
 * @param {Map} skillRarity from computeSkillRarity()
 * @param {Array} employeeRecords from getAllEmployeeRecords() (includes jobLevel/location)
 * @returns {Map<string, Map<string, Map<string, number>>>}
 */
function computeDistribution(employees, skillRarity, employeeRecords) {
  const empInfo = new Map(
    employeeRecords
      .filter((rec) => rec.jobLevel && rec.location)
      .map((rec) => [rec.ldap, { jobLevel: rec.jobLevel, location: rec.location.toLowerCase() }]),
  );

  const distribution = new Map();
  employees.forEach((emp) => {
    const info = empInfo.get(normalizeLdap(emp.email || emp.employeeId));
    if (!info) return;
    const { jobLevel, location } = info;
    if (!distribution.has(location)) distribution.set(location, new Map());
    const locData = distribution.get(location);
    groupSkillsByTier(emp.skills, skillRarity).forEach((skills, tierId) => {
      if (!skills.length) return;
      if (!locData.has(tierId)) locData.set(tierId, new Map());
      const tierData = locData.get(tierId);
      tierData.set(jobLevel, (tierData.get(jobLevel) || 0) + 1);
    });
  });
  return distribution;
}

/**
 * Renders the "Skill Distribution" table with a location filter toggle.
 * Rows are rarity tiers, columns are P-level bands. Locations and levels are
 * authorable via "locations" and "levels" config rows in the da.live block.
 * Distribution is computed from the employee mapping (Job Level + Location)
 * joined with the skill report via computeDistribution().
 */
function renderDistributionTable(body, config, distribution) {
  const levels = (config.levels || 'P10,P20,P30,P40,P50').split(',').map((s) => s.trim());
  const locationNames = (config.locations || 'Noida,Bangalore').split(',').map((s) => s.trim());

  // ── Location filter buttons ──
  const filterBar = createElement('div', 'report-table__location-filter');
  const allBtn = createElement('button', 'report-table__location-btn report-table__location-btn--active', 'All');
  allBtn.type = 'button';
  allBtn.dataset.loc = 'all';
  filterBar.append(allBtn);
  locationNames.forEach((loc) => {
    const btn = createElement('button', 'report-table__location-btn', loc);
    btn.type = 'button';
    btn.dataset.loc = loc;
    filterBar.append(btn);
  });

  // ── Table ──
  const tableWrapper = createElement('div', 'report-table__table-wrapper');
  const table = createElement('table', 'report-table__table report-table__table--distribution');

  // Header row 1: "By" | "Skill Distribution" (colspan)
  // Header row 2: "Role" | one th per level
  const thead = document.createElement('thead');
  const groupRow = document.createElement('tr');
  groupRow.append(createElement('th', 'report-table__col-employee', 'By'));
  const distTh = createElement('th', 'report-table__group report-table__group--distribution', 'Skill Distribution');
  distTh.colSpan = levels.length;
  groupRow.append(distTh);
  const subRow = document.createElement('tr');
  subRow.append(createElement('th', 'report-table__col-employee', 'Role'));
  levels.forEach((level) => subRow.append(createElement('th', 'report-table__col-level', level)));
  thead.append(groupRow, subRow);
  table.append(thead);

  // ── Body: one row per tier, cells updated on location change ──
  const tbody = document.createElement('tbody');
  const countCells = new Map(); // `${tierId}-${level}` → td

  RARITY_TIERS.forEach((tier) => {
    const tr = document.createElement('tr');
    tr.append(createElement('td', 'report-table__cell-employee', tier.label));
    levels.forEach((level) => {
      const td = createElement('td', 'report-table__cell-count');
      td.dataset.label = level;
      countCells.set(`${tier.id}-${level}`, td);
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(tbody);
  tableWrapper.append(table);

  // Populate cells for the given location label, or sum all locations when loc === 'all'
  function updateLocation(loc) {
    RARITY_TIERS.forEach((tier) => {
      levels.forEach((level) => {
        const td = countCells.get(`${tier.id}-${level}`);
        if (!td) return;
        if (loc === 'all') {
          let total = 0;
          let hasAny = false;
          distribution.forEach((locData) => {
            const count = locData?.get(tier.id)?.get(level);
            if (count != null) { total += count; hasAny = true; }
          });
          td.textContent = hasAny ? String(total) : '—';
        } else {
          const locData = distribution.get(loc.toLowerCase());
          const count = locData?.get(tier.id)?.get(level);
          td.textContent = count != null ? String(count) : '—';
        }
      });
    });
  }

  // Render All by default
  updateLocation('all');

  // Switch location on filter click
  filterBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.report-table__location-btn');
    if (!btn) return;
    filterBar.querySelectorAll('.report-table__location-btn').forEach((b) => {
      b.classList.toggle('report-table__location-btn--active', b === btn);
    });
    updateLocation(btn.dataset.loc);
  });

  body.append(filterBar, tableWrapper);
}

function renderTable(block, config, data, skillRarity, distribution) {
  const { employees, metadata: { proficiencyLevels } } = data;

  block.textContent = '';
  const wrapper = createElement('div', 'report-table__wrapper');

  // ── Header: title (left) + toggle bar (right) ──
  const headerLeft = createElement('div', 'report-table__header-left');
  headerLeft.append(
    createElement('span', 'report-table__heading-accent'),
    createElement('h2', 'report-table__heading', config.heading || 'Manager Skill Report'),
  );

  const tabs = [
    { id: 'tier', label: 'Skill Data' },
    { id: 'distribution', label: 'Skill Distribution' },
  ];

  const tabBar = createElement('div', 'report-table__tab-bar');
  tabs.forEach(({ id, label }, idx) => {
    const btn = createElement('button', `report-table__tab${idx === 0 ? ' report-table__tab--active' : ''}`, label);
    btn.type = 'button';
    btn.dataset.panel = id;
    tabBar.append(btn);
  });

  const header = createElement('div', 'report-table__header');
  header.append(headerLeft);
  wrapper.append(header, tabBar);

  // ── Tab bar controls: legend + export (appended to tab bar on the right) ──
  const legend = createElement('div', 'report-table__legend');
  proficiencyLevels.forEach(({ level, label }) => {
    const initial = label.charAt(0).toUpperCase();
    const item = createElement('span', 'report-table__legend-item');
    const badge = createElement('span', `report-table__badge report-table__badge--l${level}`);
    badge.append(
      document.createTextNode(`${label} `),
      createElement('span', 'report-table__legend-initial', `(${initial})`),
    );
    item.append(badge);
    legend.append(item);
  });

  const infoBtn = createElement('button', 'report-table__info-btn');
  infoBtn.type = 'button';
  infoBtn.setAttribute('aria-label', 'Proficiency level descriptions');
  const infoSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  infoSvg.setAttribute('width', '14');
  infoSvg.setAttribute('height', '14');
  infoSvg.setAttribute('viewBox', '0 0 24 24');
  infoSvg.setAttribute('fill', 'none');
  infoSvg.setAttribute('stroke', 'currentColor');
  infoSvg.setAttribute('stroke-width', '2.5');
  infoSvg.setAttribute('stroke-linecap', 'round');
  infoSvg.setAttribute('stroke-linejoin', 'round');
  infoSvg.setAttribute('aria-hidden', 'true');
  const infoCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  infoCircle.setAttribute('cx', '12');
  infoCircle.setAttribute('cy', '12');
  infoCircle.setAttribute('r', '10');
  const infoPath1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  infoPath1.setAttribute('d', 'M12 16v-4');
  const infoPath2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  infoPath2.setAttribute('d', 'M12 8h.01');
  infoSvg.append(infoCircle, infoPath1, infoPath2);
  infoBtn.append(infoSvg);

  document.querySelectorAll('.report-table__info-panel').forEach((p) => p.remove());
  const infoPanel = document.createElement('div');
  infoPanel.className = 'report-table report-table__info-panel';
  infoPanel.style.display = 'none';
  const infoPanelTitle = createElement(
    'p',
    'report-table__info-panel-title',
    'Proficiency Levels',
  );
  const infoRows = createElement('div', 'report-table__info-panel-rows');
  proficiencyLevels.forEach(({ level, label }) => {
    const row = createElement('div', 'report-table__info-panel-row');
    const badge = createElement(
      'span',
      `report-table__badge report-table__badge--l${level}`,
      label,
    );
    const desc = createElement(
      'p',
      'report-table__info-panel-desc',
      LEVEL_DESCRIPTIONS[level] || '',
    );
    row.append(badge, desc);
    infoRows.append(row);
  });
  infoPanel.append(infoPanelTitle, infoRows);
  document.body.append(infoPanel);

  function positionInfoPanel() {
    const rect = infoBtn.getBoundingClientRect();
    const panelWidth = 440;
    const panelHeight = infoPanel.offsetHeight || 320;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const top = spaceBelow >= panelHeight
      ? rect.bottom + 8
      : Math.max(8, rect.top - panelHeight - 8);
    infoPanel.style.top = `${top}px`;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8));
    infoPanel.style.left = `${left}px`;
  }

  function closeInfoOnOutside(e) {
    if (!infoPanel.contains(e.target) && e.target !== infoBtn) {
      infoPanel.style.display = 'none';
      document.removeEventListener('click', closeInfoOnOutside);
    }
  }

  infoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (infoPanel.style.display === 'none') {
      positionInfoPanel();
      infoPanel.style.display = 'block';
      document.addEventListener('click', closeInfoOnOutside);
    } else {
      infoPanel.style.display = 'none';
      document.removeEventListener('click', closeInfoOnOutside);
    }
  });

  const exportBtn = createElement('button', 'report-table__button', 'Export CSV');
  exportBtn.type = 'button';
  exportBtn.addEventListener('click', () => downloadCsv(
    'skill-report.csv',
    skillDataToCsv(employees, proficiencyLevels, skillRarity),
  ));

  const toolbarRight = createElement('div', 'report-table__toolbar-right');
  toolbarRight.append(legend, infoBtn, exportBtn);
  tabBar.append(toolbarRight);

  const body = createElement('div', 'report-table__body');

  // ── Panels ──
  const tierPanel = createElement('div', 'report-table__panel report-table__panel--active');
  tierPanel.dataset.panel = 'tier';
  renderMasterDetail(tierPanel, employees, proficiencyLevels, skillRarity);

  const distPanel = createElement('div', 'report-table__panel');
  distPanel.dataset.panel = 'distribution';
  renderDistributionTable(distPanel, config, distribution);

  body.append(tierPanel, distPanel);

  tabBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.report-table__tab');
    if (!btn) return;
    const target = btn.dataset.panel;
    tabBar.querySelectorAll('.report-table__tab').forEach((b) => {
      b.classList.toggle('report-table__tab--active', b.dataset.panel === target);
    });
    body.querySelectorAll('.report-table__panel').forEach((panel) => {
      panel.classList.toggle('report-table__panel--active', panel.dataset.panel === target);
    });
    legend.style.display = target === 'tier' ? '' : 'none';
    infoBtn.style.display = target === 'tier' ? '' : 'none';
    exportBtn.style.display = target === 'tier' ? '' : 'none';
    if (target !== 'tier') {
      infoPanel.style.display = 'none';
      document.removeEventListener('click', closeInfoOnOutside);
    }
  });

  wrapper.append(body);
  block.append(wrapper);
}

/**
 * Restricts the employee list to the logged-in manager's direct reports.
 * When no manager LDAP is known the full list is returned so the view stays
 * testable.
 * @param {Array} employees employees from the skill-report API
 * @param {string} managerLdap the logged-in user's LDAP (profile.empLdap)
 * @returns {Promise<Array>}
 */
async function filterToDirectReports(employees, managerLdap) {
  if (!managerLdap) return employees;
  const reportKeys = new Set((await getDirectReports(managerLdap)).map((report) => report.ldap));
  return employees.filter((emp) => reportKeys.has(normalizeLdap(emp.email || emp.employeeId)));
}

export default async function decorate(block) {
  const config = readBlockConfig(block);
  block.textContent = '';
  showSpinner('Loading skill report…');

  let profile = null;
  try {
    profile = await getUserProfile();
  } catch {
    hideSpinner();
    showFallbackPage();
    return;
  }

  // Role is the source of truth: only managers and admins may view this report;
  // employees are sent back to the homepage.
  if (profile?.role !== 'manager' && profile?.role !== 'admin') {
    hideSpinner();
    window.location.replace('/');
    return;
  }

  try {
    const data = await getSkillReport();
    // Rarity is computed across the whole workforce before filtering to the team.
    const skillRarity = computeSkillRarity(data.employees);
    const employees = await filterToDirectReports(data.employees, profile.empLdap);

    if (employees.length === 0) {
      hideSpinner();
      block.append(createElement('p', 'report-table__empty', 'No direct reports have submitted skills yet.'));
      return;
    }

    const distribution = computeDistribution(
      employees,
      skillRarity,
      await getAllEmployeeRecords(),
    );

    renderTable(block, config, { ...data, employees }, skillRarity, distribution);
  } catch {
    block.append(createElement('p', 'report-table__error', 'Failed to load skill report. Please try again.'));
  } finally {
    hideSpinner();
  }
}
