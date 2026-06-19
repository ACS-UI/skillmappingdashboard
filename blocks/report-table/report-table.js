import { getSkillReport } from '../../scripts/api.js';
import { getSessionUser, isTestEnvironment } from '../../scripts/auth.js';
import { isManager, getDirectReports, normalizeLdap, getAllEmployeeRecords } from '../../scripts/employee-mapping.js';
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

// An employee's skills flattened in tier order (Generic → Ultra niche), then
// alphabetically within a tier — the order used by the CSV export.
function sortedTierSkills(emp, skillRarity) {
  return [...groupSkillsByTier(emp.skills, skillRarity).values()].flat();
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

// Produces a CSV that mirrors the two-row thead (group + sub-header) and the
// rowspan body of the on-screen tier table so the export is 1:1 with what is
// displayed: Employee name only on the first skill row, skill placed under its
// matching tier column, all other tier columns empty for that row.
function tierTableToCsv(employees, proficiencyLevels, skillRarity) {
  // Row 1: Employee | Generic | "" | Niche | "" | …  (mirrors colspan-2 banners)
  const groupRow = ['Employee'];
  // Row 2: ""       | Skill   | Months | Skill | Months | … (sub-column headers)
  const subRow = [''];
  RARITY_TIERS.forEach((tier) => {
    groupRow.push(tier.label, '');
    subRow.push('Skill', 'Months');
  });

  const dataRows = [];
  employees.forEach((emp) => {
    const skills = sortedTierSkills(emp, skillRarity);
    if (skills.length === 0) {
      dataRows.push([emp.name, ...RARITY_TIERS.flatMap(() => ['', ''])]);
      return;
    }
    skills.forEach((skill, index) => {
      // Mirror the on-screen rowspan: name only on the employee's first row.
      const row = [index === 0 ? emp.name : ''];
      const skillTierId = getSkillTier(skill.name, skillRarity)?.id;
      RARITY_TIERS.forEach((tier) => {
        if (tier.id === skillTierId) {
          const initial = getLevelInitial(proficiencyLevels, skill.proficiencyLevel);
          row.push(initial ? `${skill.name} (${initial})` : skill.name);
          row.push(skill.expInMonths != null ? `${skill.expInMonths} M` : '');
        } else {
          row.push('', '');
        }
      });
      dataRows.push(row);
    });
  });

  return [groupRow, subRow, ...dataRows]
    .map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(','))
    .join('\n');
}

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}

/**
 * Renders the per-employee "skills by rarity tier" table: one column group per
 * rarity tier (Generic → Ultra niche), each split into a Skill (with level
 * initial) and an Experience sub-column. Each of an employee's skills becomes a
 * row, with its name+level and months placed under the tier that matches its
 * org-wide rarity; the employee name spans all of their skill rows.
 * @param {Element} body the block body to append the table into
 * @param {Array} employees the (filtered) employees to display
 * @param {Array} proficiencyLevels level metadata from the API
 * @param {Map} skillRarity per-skill rarity info from computeSkillRarity()
 */
function renderTierTable(body, employees, proficiencyLevels, skillRarity) {
  const PAGE_SIZE = 10;
  let filtered = employees;

  const searchWrap = createElement('div', 'report-table__search-wrap');
  const searchInput = createElement('input', 'report-table__search');
  searchInput.type = 'search';
  searchInput.placeholder = 'Search by employee name…';
  searchInput.setAttribute('aria-label', 'Search employees');
  searchWrap.append(searchInput);

  // Mobile card list (hidden at >= 600px via CSS)
  const cardList = createElement('div', 'report-table__tier-cards');

  // Desktop table — thead is static, tbody is repopulated per page
  const tableWrapper = createElement('div', 'report-table__table-wrapper report-table__table-wrapper--tiers');
  const table = createElement('table', 'report-table__table report-table__table--tiers');

  const thead = document.createElement('thead');
  const groupRow = document.createElement('tr');
  const employeeTh = createElement('th', 'report-table__col-employee', 'Employee');
  employeeTh.rowSpan = 2;
  groupRow.append(employeeTh);
  const subRow = document.createElement('tr');
  RARITY_TIERS.forEach((tier) => {
    const th = createElement('th', `report-table__group report-table__group--${tier.id}`, tier.label);
    th.colSpan = 2;
    groupRow.append(th);
    subRow.append(
      createElement('th', `report-table__col-skill report-table__tier report-table__tier--${tier.id} report-table__tier--lead`, 'Skill'),
      createElement('th', `report-table__col-skill report-table__tier report-table__tier--${tier.id} report-table__tier--trail`, 'Months'),
    );
  });
  thead.append(groupRow, subRow);
  table.append(thead);

  const tbody = document.createElement('tbody');
  table.append(tbody);
  tableWrapper.append(table);

  const pagination = createElement('div', 'report-table__pagination');
  const emptyMsg = createElement('p', 'report-table__search-empty', 'No employees match your search.');
  emptyMsg.hidden = true;

  body.append(searchWrap, cardList, tableWrapper, emptyMsg, pagination);

  function renderPage(page) {
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
    const hasResults = filtered.length > 0;
    emptyMsg.hidden = hasResults;
    tableWrapper.hidden = !hasResults;
    cardList.hidden = !hasResults;
    if (!hasResults) { pagination.textContent = ''; return; }
    const start = page * PAGE_SIZE;
    const pageEmployees = filtered.slice(start, start + PAGE_SIZE);

    // ── Mobile cards ──
    cardList.textContent = '';
    pageEmployees.forEach((emp) => {
      const byTier = groupSkillsByTier(emp.skills, skillRarity);
      const card = createElement('div', 'report-table__emp-card');
      card.append(createElement('div', 'report-table__emp-card-name', emp.name));
      const tiersDiv = createElement('div', 'report-table__emp-card-tiers');
      RARITY_TIERS.forEach((tier) => {
        const tierSkills = byTier.get(tier.id) || [];
        if (!tierSkills.length) return;
        const section = createElement('div', `report-table__emp-card-tier report-table__emp-card-tier--${tier.id}`);
        section.append(createElement('div', 'report-table__emp-card-tier-label', tier.label));
        const skillsDiv = createElement('div', 'report-table__emp-card-skills');
        tierSkills.forEach((skill) => {
          const skillRow = createElement('div', 'report-table__emp-card-skill');
          const initial = getLevelInitial(proficiencyLevels, skill.proficiencyLevel);
          skillRow.append(createElement('span', 'report-table__skill-label', skill.name));
          if (initial) {
            skillRow.append(createElement('span', `report-table__badge report-table__badge--l${skill.proficiencyLevel}`, `(${initial})`));
          }
          skillRow.append(createElement('span', 'report-table__emp-card-months', skill.expInMonths != null ? `${skill.expInMonths} M` : '—'));
          skillsDiv.append(skillRow);
        });
        section.append(skillsDiv);
        tiersDiv.append(section);
      });
      card.append(tiersDiv);
      cardList.append(card);
    });

    // ── Desktop table body ──
    tbody.textContent = '';
    pageEmployees.forEach((emp) => {
      const byTier = groupSkillsByTier(emp.skills, skillRarity);
      const rowCount = Math.max(...[...byTier.values()].map((s) => s.length), 1);
      for (let i = 0; i < rowCount; i += 1) {
        const tr = document.createElement('tr');
        if (i === 0) {
          tr.classList.add('report-table__row--emp-start');
          const nameTd = createElement('td', 'report-table__cell-employee', emp.name);
          nameTd.rowSpan = rowCount;
          tr.append(nameTd);
        }
        RARITY_TIERS.forEach((tier) => {
          const skill = byTier.get(tier.id)?.[i];
          const skillTd = createElement('td', `report-table__tier report-table__tier--${tier.id} report-table__tier--lead`);
          const monthsTd = createElement('td', `report-table__tier report-table__tier--${tier.id} report-table__tier--trail`);
          if (skill) {
            const name = createElement('span', 'report-table__skill-label', skill.name);
            const initial = getLevelInitial(proficiencyLevels, skill.proficiencyLevel);
            if (initial) {
              skillTd.append(name, createElement('span', `report-table__badge report-table__badge--l${skill.proficiencyLevel}`, `(${initial})`));
            } else {
              skillTd.append(name);
            }
            monthsTd.textContent = skill.expInMonths != null ? `${skill.expInMonths} M` : '—';
          }
          tr.append(skillTd, monthsTd);
        });
        tbody.append(tr);
      }
    });

    // ── Pagination controls ──
    pagination.textContent = '';
    if (totalPages <= 1) return;

    const prevBtn = createElement('button', 'report-table__page-btn', '← Prev');
    prevBtn.type = 'button';
    prevBtn.disabled = page === 0;
    prevBtn.addEventListener('click', () => renderPage(page - 1));

    const pageInfo = createElement('span', 'report-table__page-info', `${page + 1} of ${totalPages}`);

    const nextBtn = createElement('button', 'report-table__page-btn', 'Next →');
    nextBtn.type = 'button';
    nextBtn.disabled = page === totalPages - 1;
    nextBtn.addEventListener('click', () => renderPage(page + 1));

    pagination.append(prevBtn, pageInfo, nextBtn);
  }

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    filtered = q ? employees.filter((emp) => emp.name.toLowerCase().includes(q)) : employees;
    renderPage(0);
  });

  renderPage(0);
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
    tierTableToCsv(employees, proficiencyLevels, skillRarity),
  ));

  const toolbarRight = createElement('div', 'report-table__toolbar-right');
  toolbarRight.append(legend, infoBtn, exportBtn);
  tabBar.append(toolbarRight);

  const body = createElement('div', 'report-table__body');

  // ── Panels ──
  const tierPanel = createElement('div', 'report-table__panel report-table__panel--active');
  tierPanel.dataset.panel = 'tier';
  renderTierTable(tierPanel, employees, proficiencyLevels, skillRarity);

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
 * When there is no authenticated user (local/preview, where auth is skipped)
 * the full list is returned so the view remains testable.
 * @param {Array} employees employees from the skill-report API
 * @param {object|null} user the IndexDB user record
 * @returns {Promise<Array>}
 */
async function filterToDirectReports(employees, user) {
  if (!user?.ldap) return employees;
  const reportKeys = new Set((await getDirectReports(user.ldap)).map((report) => report.ldap));
  return employees.filter((emp) => reportKeys.has(normalizeLdap(emp.email || emp.employeeId)));
}

export default async function decorate(block) {
  const config = readBlockConfig(block);
  block.textContent = '';
  showSpinner('Loading skill report…');

  let user = null;
  try {
    user = await getSessionUser();
  } catch { /* treat as unidentified */ }

  // Only verified managers may view this report. Outside test environments an
  // unidentified user (no SSO record) is denied as well.
  const allowed = isManager(user?.email) || isTestEnvironment();
  if (!allowed) {
    hideSpinner();
    window.location.replace('/');
    return;
  }

  try {
    const data = await getSkillReport();
    // Rarity is computed across the whole workforce before filtering to the team.
    const skillRarity = computeSkillRarity(data.employees);
    const employees = await filterToDirectReports(data.employees, user);

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
