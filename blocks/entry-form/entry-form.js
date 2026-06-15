import {
  buildSkillsPayload,
  getLevelFromExperienceMonths,
  submitSkillReport,
  deleteSkill,
  getEmployeeSkillReport,
} from '../../scripts/api.js';
import { getSessionUser } from '../../scripts/auth.js';

function parseSpecializations(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((v) => v.trim()).filter(Boolean);
  return [];
}

function mapServerSkillToRow(skill) {
  const certification = skill.certification || null;
  return {
    skillName: skill.name,
    months: Number(skill.expInMonths) || 0,
    // Backend sends comma-separated strings for specialization and platform; UI uses arrays.
    specializations: parseSpecializations(skill.specialization ?? skill.specializations),
    platforms: parseSpecializations(skill.platform ?? skill.platforms),
    cert: certification ? 'yes' : 'no',
    certTitle: certification?.certificateName || certification?.name || '',
    certImageUrl: certification?.certificateImageUrl || certification?.imageUrl || '',
  };
}

async function fetchSkillList() {
  try {
    const res = await fetch('/skills.json');
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data || []).map((r) => r.name).filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchSpecializationsAndPlatforms() {
  try {
    const res = await fetch('/specializations.json');
    if (!res.ok) return [[], []];
    const json = await res.json();
    const specializations = (json.data?.data || []).map((r) => r.name).filter(Boolean);
    const platforms = (json.platforms?.data || []).map((r) => r.Name || r.name).filter(Boolean);
    return [specializations, platforms];
  } catch {
    return [[], []];
  }
}

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
  if (text) el.textContent = text;
  return el;
}

function buildIconSvg(paths, size = 16) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  paths.forEach((d) => {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    svg.append(p);
  });
  return svg;
}

const multiPanelCleanups = new WeakMap();

function buildSelect(options, currentValue) {
  const sel = document.createElement('select');
  sel.className = 'entry-form__select';
  options.forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if (value === String(currentValue)) opt.selected = true;
    sel.append(opt);
  });
  return sel;
}

function buildMultiSelect(options, initialValues, onChange) {
  let current = [...initialValues];

  const wrap = document.createElement('div');
  wrap.className = 'entry-form__multi-select';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'entry-form__multi-trigger';

  // Portal panel to body so it escapes any overflow:auto ancestor
  const panel = document.createElement('div');
  panel.className = 'entry-form__multi-panel';
  panel.hidden = true;
  document.body.append(panel);

  function updateTrigger() {
    trigger.textContent = current.length ? current.join(', ') : 'Select…';
  }

  function positionPanel() {
    const rect = trigger.getBoundingClientRect();
    panel.style.top = `${rect.bottom + 4}px`;
    panel.style.left = `${rect.left}px`;
    panel.style.width = `${rect.width}px`;
  }

  options.forEach((opt) => {
    const label = document.createElement('label');
    label.className = 'entry-form__multi-option';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = opt;
    cb.checked = current.includes(opt);
    cb.addEventListener('change', () => {
      current = cb.checked ? [...current, opt] : current.filter((v) => v !== opt);
      updateTrigger();
      onChange(current);
    });
    label.append(cb, document.createTextNode(` ${opt}`));
    panel.append(label);
  });

  const closeOnOutside = (e) => {
    if (!wrap.contains(e.target) && !panel.contains(e.target)) {
      panel.hidden = true;
      document.removeEventListener('click', closeOnOutside);
    }
  };

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panel.hidden) {
      positionPanel();
      panel.hidden = false;
      document.addEventListener('click', closeOnOutside);
    } else {
      panel.hidden = true;
      document.removeEventListener('click', closeOnOutside);
    }
  });

  multiPanelCleanups.set(panel, () => {
    document.removeEventListener('click', closeOnOutside);
    panel.remove();
  });

  updateTrigger();
  wrap.append(trigger);
  return wrap;
}

export default async function decorate(block) {
  const config = readBlockConfig(block);
  const [user, skillList, [specializationList, platformList]] = await Promise.all([
    getSessionUser(), fetchSkillList(), fetchSpecializationsAndPlatforms(),
  ]);
  const blankInput = () => ({
    skill: '', skillOther: '', months: 0, specializations: [], platforms: [], cert: '', certTitle: '', certImageUrl: '',
  });

  const state = {
    busy: false,
    message: '',
    messageType: '',
    employeeId: user?.ldap || config['employee-id'] || 'robinvarshn',
    email: user?.email || `${user?.ldap || config['employee-id'] || 'robinvarshn'}@adobe.com`,
    name: user?.name || user?.ldap || config['employee-id'] || 'robinvarshn',
    rows: [],
    savedRows: [],
    savedSkillNames: [],
    // Index in `state.rows` being edited inline (pending change, not yet POSTed)
    editingIndex: -1,
    // Index in `state.savedRows` being edited inline — Save POSTs immediately
    // and refreshes the previously-submitted list.
    editingSavedIndex: -1,
    // `input` backs the always-present "+ Add" row at the bottom of the form
    // table; `editInput` backs the inline edit row in the previously-submitted
    // list. Keeping them separate lets both input rows exist at the same time.
    input: blankInput(),
    editInput: blankInput(),
  };

  let render;

  function getInputSkillName(input) {
    return input.skill === 'other'
      ? input.skillOther.trim()
      : input.skill;
  }

  function validateInput(input) {
    const skillName = getInputSkillName(input);
    if (!skillName) throw new Error('Please select or type a skill.');
    const months = Number(input.months);
    if (!months || months < 1 || months > 1000) throw new Error('Please enter experience between 1 and 1000 months.');
    if (!input.cert) throw new Error('Please select Yes or No for Certification.');
    if (input.cert === 'yes' && !input.certTitle.trim()) {
      throw new Error('Please enter the Title of Certificate.');
    }
    // Re-adds of an already-saved skill are allowed — the backend merges/appends,
    // so submitting an existing skill just updates it with the new values.
  }

  function deleteRow(i) {
    const deleted = state.rows[i];
    state.rows.splice(i, 1);
    state.savedSkillNames = state.savedSkillNames.filter(
      (n) => n.toLowerCase() !== deleted.skillName.toLowerCase(),
    );
    if (state.editingIndex === i) {
      state.editingIndex = -1;
      state.input = blankInput();
    } else if (state.editingIndex > i) {
      state.editingIndex -= 1;
    }
    render();
  }

  function editRow(i) {
    const s = state.rows[i];
    const isPreset = skillList.includes(s.skillName);
    state.input = {
      skill: isPreset ? s.skillName : 'other',
      skillOther: isPreset ? '' : s.skillName,
      months: s.months,
      specializations: [...(s.specializations || [])],
      platforms: [...(s.platforms || [])],
      cert: s.cert,
      certTitle: s.certTitle,
      certImageUrl: s.certImageUrl || '',
    };
    state.editingIndex = i;
    state.editingSavedIndex = -1;
    state.message = '';
    render();
  }

  function cancelEdit() {
    state.editingSavedIndex = -1;
    state.editInput = blankInput();
    state.message = '';
    state.messageType = '';
    render();
  }

  // Loads the employee's already-submitted skills for the
  // "Previously submitted skills" list shown below the form. Pass
  // `{ silent: true }` from callers that will render themselves afterwards
  // (e.g. submitInputSkill) to avoid an extra repaint with
  // a stale `state.rows`.
  async function loadPreviousEntries({ silent = false } = {}) {
    try {
      const res = await getEmployeeSkillReport(state.employeeId);
      const data = res?.data || {};
      if (data.email) state.email = data.email;
      if (data.name) state.name = data.name;
      state.savedRows = (data.skills || []).map(mapServerSkillToRow);
      state.savedSkillNames = state.savedRows.map((r) => r.skillName);
      if (!silent) render();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Could not load previous entries:', err);
    }
  }

  async function deleteSavedRow(i) {
    const s = state.savedRows[i];
    if (!s) return;
    state.busy = true;
    state.message = '';
    state.messageType = '';
    render();
    try {
      await deleteSkill(state.employeeId, s.skillName);
      await loadPreviousEntries({ silent: true });
      state.message = `"${s.skillName}" deleted.`;
      state.messageType = 'success';
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Skill delete failed:', err);
      state.message = err.message || 'Delete failed. Check the browser console for details.';
      state.messageType = 'error';
    } finally {
      state.busy = false;
      render();
    }
  }

  // Pre-fills the input row from a previously-submitted skill so the user can
  // edit it. The form's bottom input row is hidden while this is active and the
  // input row appears inline at that saved row's position.
  function editSavedRow(i) {
    const s = state.savedRows[i];
    if (!s) return;
    const isPreset = skillList.includes(s.skillName);
    state.editInput = {
      skill: isPreset ? s.skillName : 'other',
      skillOther: isPreset ? '' : s.skillName,
      months: s.months,
      specializations: [...(s.specializations || [])],
      platforms: [...(s.platforms || [])],
      cert: s.cert,
      certTitle: s.certTitle,
      certImageUrl: s.certImageUrl || '',
    };
    state.editingSavedIndex = i;
    state.message = '';
    state.messageType = '';
    render();
  }

  // Submits one input row as a single skill straight to the backend and refreshes
  // the previously-submitted list. Used both by "+ Add" (model = state.input) and
  // by Save on a saved-row inline edit (model = state.editInput) — the backend
  // merges/appends, so a single-skill POST covers both. Only the submitted model
  // is reset, so the other input row keeps whatever the user has typed in it.
  // Validation errors throw before any state change so the caller's catch shows them.
  async function submitInputSkill(input, { isEdit }) {
    validateInput(input);
    state.busy = true;
    state.message = '';
    state.messageType = '';
    render();
    try {
      const skillName = getInputSkillName(input);
      const months = Number(input.months);
      const level = await getLevelFromExperienceMonths(months);
      const skill = {
        name: skillName,
        expInMonths: months,
        proficiencyLevel: level?.level || 1,
      };
      if (input.specializations?.length) {
        skill.specializations = [...input.specializations];
      }
      if (input.platforms?.length) {
        skill.platforms = [...input.platforms];
      }
      if (input.cert === 'yes') {
        skill.certification = { name: input.certTitle.trim() };
        if (input.certImageUrl) skill.certification.imageUrl = input.certImageUrl;
      }
      const payload = buildSkillsPayload(state.employeeId, state.email, state.name, [skill]);
      await submitSkillReport(payload);
      await loadPreviousEntries({ silent: true });
      if (isEdit) {
        state.editingSavedIndex = -1;
        state.editInput = blankInput();
      } else {
        state.input = blankInput();
      }
      state.message = isEdit ? `"${skillName}" updated successfully.` : `"${skillName}" added successfully.`;
      state.messageType = 'success';
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Skill submit failed:', err);
      const status = err.status ? ` (HTTP ${err.status})` : '';
      const reason = err.detail || err.message;
      state.message = reason
        ? `Submission failed${status}: ${reason}`
        : `Submission failed${status}. Check the browser console for details.`;
      state.messageType = 'error';
    } finally {
      state.busy = false;
      render();
    }
  }

  function renderMessage(container) {
    if (!state.message) return;
    container.append(createElement(
      'p',
      `entry-form__message entry-form__message--${state.messageType || 'info'}`,
      state.message,
    ));
  }

  // Builds an editable row bound to `input` (either state.input for the bottom
  // "+ Add" row, or state.editInput for an inline saved-row edit). `mode` is
  // 'add' or 'edit' and controls the action button(s).
  function renderInputRow(input, mode) {
    const isEdit = mode === 'edit';
    const tr = document.createElement('tr');
    tr.className = `entry-form__input-row${isEdit ? ' entry-form__input-row--editing' : ''}`;

    // ── Skill ──
    const skillTd = document.createElement('td');
    skillTd.dataset.label = 'Skill';
    const skillOpts = [
      { value: '', label: 'Select skill…' },
      ...skillList.map((n) => ({ value: n, label: n })),
      { value: 'other', label: 'Other…' },
    ];
    const skillSel = buildSelect(skillOpts, input.skill);
    skillSel.style.display = input.skill === 'other' ? 'none' : '';

    const otherInput = document.createElement('input');
    otherInput.type = 'text';
    otherInput.className = 'entry-form__input';
    otherInput.placeholder = 'Type your skill…';
    otherInput.value = input.skillOther;
    otherInput.style.display = input.skill === 'other' ? '' : 'none';
    otherInput.addEventListener('input', (e) => { input.skillOther = e.target.value; });

    skillSel.addEventListener('change', (e) => {
      input.skill = e.target.value;
      if (e.target.value !== 'other') {
        input.skillOther = '';
        skillSel.style.display = '';
        otherInput.style.display = 'none';
        otherInput.value = '';
      } else {
        skillSel.style.display = 'none';
        otherInput.style.display = '';
        otherInput.focus();
      }
    });

    skillTd.append(skillSel, otherInput);
    tr.append(skillTd);

    // ── Experience ──
    const expTd = document.createElement('td');
    expTd.dataset.label = 'Experience';
    const expInput = document.createElement('input');
    expInput.type = 'number';
    expInput.className = 'entry-form__input';
    expInput.placeholder = 'months';
    expInput.min = '1';
    expInput.max = '1000';
    expInput.value = input.months || '';
    expInput.addEventListener('input', (e) => { input.months = e.target.value; });
    expTd.append(expInput);
    tr.append(expTd);

    // ── Specialization (optional, multi-select) ──
    const specTd = document.createElement('td');
    specTd.className = 'entry-form__spec-td';
    specTd.dataset.label = 'Specialization';
    specTd.append(buildMultiSelect(
      specializationList,
      input.specializations,
      (vals) => { input.specializations = vals; },
    ));
    tr.append(specTd);

    // ── Platform (optional, multi-select) ──
    const platformTd = document.createElement('td');
    platformTd.className = 'entry-form__spec-td';
    platformTd.dataset.label = 'Platform';
    platformTd.append(buildMultiSelect(
      platformList,
      input.platforms,
      (vals) => { input.platforms = vals; },
    ));
    tr.append(platformTd);

    // ── Certification ──
    const certTd = document.createElement('td');
    certTd.dataset.label = 'Certification';
    const certSel = buildSelect([
      { value: '', label: 'Select…' },
      { value: 'no', label: 'No' },
      { value: 'yes', label: 'Yes' },
    ], input.cert);
    certTd.append(certSel);
    tr.append(certTd);

    // ── Title of Certificate ──
    const titleTd = document.createElement('td');
    titleTd.dataset.label = 'Certificate';
    const certTitleWrap = createElement('div', 'entry-form__cert-title-wrap');
    const certDash = createElement('span', 'entry-form__dash', '—');
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'entry-form__input';
    titleInput.placeholder = 'e.g. AWS Certified Developer';
    titleInput.value = input.certTitle;
    titleInput.addEventListener('input', (e) => { input.certTitle = e.target.value; });
    certTitleWrap.append(titleInput);

    const dashWrap = document.createElement('div');
    dashWrap.className = 'entry-form__dash-center';
    dashWrap.append(certDash);

    certTitleWrap.style.display = input.cert === 'yes' ? 'block' : 'none';
    dashWrap.style.display = input.cert === 'yes' ? 'none' : '';

    certSel.addEventListener('change', (e) => {
      input.cert = e.target.value;
      if (e.target.value === 'yes') {
        certTitleWrap.style.display = 'block';
        dashWrap.style.display = 'none';
        titleInput.focus();
      } else {
        input.certTitle = '';
        titleInput.value = '';
        certTitleWrap.style.display = 'none';
        dashWrap.style.display = '';
      }
    });

    titleTd.append(certTitleWrap, dashWrap);
    tr.append(titleTd);

    // ── Add / Save (+ Cancel) buttons ──
    // "+ Add" submits the skill straight away; Save does the same for an inline
    // edit. In edit mode Save/Cancel render as compact icon buttons so the
    // action cell stays on one line.
    const addTd = document.createElement('td');
    addTd.className = 'entry-form__action-cell';
    addTd.dataset.label = '';

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    if (state.busy) addBtn.disabled = true;
    if (isEdit) {
      addBtn.className = 'entry-form__icon-btn entry-form__icon-btn--save';
      addBtn.title = 'Save';
      addBtn.setAttribute('aria-label', 'Save');
      addBtn.append(buildIconSvg([
        'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z',
        'M17 21v-8H7v8',
        'M7 3v5h8',
      ]));
    } else {
      addBtn.className = 'entry-form__add-btn';
      addBtn.textContent = '+ Add';
    }
    addBtn.addEventListener('click', async () => {
      try {
        await submitInputSkill(input, { isEdit });
      } catch (err) {
        state.message = err.message;
        state.messageType = 'error';
        render();
      }
    });

    if (isEdit) {
      const editActions = createElement('div', 'entry-form__edit-actions');
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'entry-form__icon-btn entry-form__icon-btn--cancel';
      cancelBtn.title = 'Cancel';
      cancelBtn.setAttribute('aria-label', 'Cancel');
      cancelBtn.append(buildIconSvg(['M18 6L6 18', 'M6 6l12 12']));
      if (state.busy) cancelBtn.disabled = true;
      cancelBtn.addEventListener('click', cancelEdit);
      editActions.append(addBtn, cancelBtn);
      addTd.append(editActions);
    } else {
      addTd.append(addBtn);
    }
    tr.append(addTd);

    return tr;
  }

  function renderDataRows(rows, showActions = true, showDelete = showActions, tableKind = 'form') {
    return rows.map((s, i) => {
      // A saved row being edited is replaced inline by its own input row
      // (bound to state.editInput, independent of the bottom "+ Add" row).
      if (showActions && tableKind === 'saved' && state.editingSavedIndex === i) {
        return renderInputRow(state.editInput, 'edit');
      }

      const expLabel = `${s.months} month${s.months === 1 ? '' : 's'}`;

      const tr = document.createElement('tr');
      tr.className = `entry-form__data-row${state.editingIndex === i ? ' entry-form__data-row--editing' : ''}`;

      const skillTd = document.createElement('td');
      skillTd.dataset.label = 'Skill';
      skillTd.append(createElement('span', 'entry-form__skill-chip', s.skillName));

      const expTd = createElement('td', 'entry-form__exp-cell', expLabel);
      expTd.dataset.label = 'Experience';

      const specTd = document.createElement('td');
      specTd.dataset.label = 'Specialization';
      const slist = s.specializations || [];
      if (slist.length) {
        const chipsWrap = createElement('div', 'entry-form__spec-chips');
        slist.forEach((sp) => chipsWrap.append(createElement('span', 'entry-form__spec-chip', sp)));
        specTd.append(chipsWrap);
      } else {
        specTd.append(createElement('span', 'entry-form__dash', '—'));
      }

      const platformTd = document.createElement('td');
      platformTd.dataset.label = 'Platform';
      const plist = s.platforms || [];
      if (plist.length) {
        const chipsWrap = createElement('div', 'entry-form__spec-chips');
        plist.forEach((p) => chipsWrap.append(createElement('span', 'entry-form__spec-chip', p)));
        platformTd.append(chipsWrap);
      } else {
        platformTd.append(createElement('span', 'entry-form__dash', '—'));
      }

      const certTd = document.createElement('td');
      certTd.dataset.label = 'Certification';
      certTd.append(createElement(
        'span',
        `entry-form__cert-badge entry-form__cert-badge--${s.cert}`,
        s.cert === 'yes' ? 'Yes' : 'No',
      ));

      const titleTd = document.createElement('td');
      titleTd.dataset.label = 'Certificate';
      if (s.cert === 'yes') {
        titleTd.append(createElement('strong', 'entry-form__cert-title', s.certTitle));
      } else {
        titleTd.append(createElement('span', 'entry-form__dash', '—'));
      }

      const actionTd = document.createElement('td');
      actionTd.className = 'entry-form__action-cell';
      actionTd.dataset.label = '';

      const editBtn = document.createElement('button');
      editBtn.className = 'entry-form__icon-btn entry-form__icon-btn--edit';
      editBtn.type = 'button';
      editBtn.title = 'Edit';
      editBtn.setAttribute('aria-label', `Edit ${s.skillName}`);
      const editSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      editSvg.setAttribute('width', '16');
      editSvg.setAttribute('height', '16');
      editSvg.setAttribute('viewBox', '0 0 24 24');
      editSvg.setAttribute('fill', 'none');
      editSvg.setAttribute('stroke', 'currentColor');
      editSvg.setAttribute('stroke-width', '2');
      editSvg.setAttribute('stroke-linecap', 'round');
      editSvg.setAttribute('stroke-linejoin', 'round');
      editSvg.setAttribute('aria-hidden', 'true');
      const editPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      editPath.setAttribute('d', 'M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z');
      editSvg.append(editPath);
      editBtn.append(editSvg);
      editBtn.addEventListener('click', () => (
        tableKind === 'saved' ? editSavedRow(i) : editRow(i)
      ));

      const delBtn = document.createElement('button');
      delBtn.className = 'entry-form__icon-btn entry-form__icon-btn--del';
      delBtn.type = 'button';
      delBtn.title = 'Delete';
      delBtn.setAttribute('aria-label', `Delete ${s.skillName}`);
      const delSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      delSvg.setAttribute('width', '16');
      delSvg.setAttribute('height', '16');
      delSvg.setAttribute('viewBox', '0 0 24 24');
      delSvg.setAttribute('fill', 'none');
      delSvg.setAttribute('stroke', 'currentColor');
      delSvg.setAttribute('stroke-width', '2');
      delSvg.setAttribute('stroke-linecap', 'round');
      delSvg.setAttribute('stroke-linejoin', 'round');
      delSvg.setAttribute('aria-hidden', 'true');
      const delPath1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      delPath1.setAttribute('d', 'M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6');
      const delPath2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      delPath2.setAttribute('d', 'M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2');
      delSvg.append(delPath1, delPath2);
      delBtn.append(delSvg);
      delBtn.addEventListener('click', () => (
        tableKind === 'saved' ? deleteSavedRow(i) : deleteRow(i)
      ));

      const actionsWrap = createElement('div', 'entry-form__row-actions');
      actionsWrap.append(editBtn);
      if (showDelete) actionsWrap.append(delBtn);
      actionTd.append(actionsWrap);

      if (showActions) {
        tr.append(skillTd, expTd, specTd, platformTd, certTd, titleTd, actionTd);
      } else {
        tr.append(skillTd, expTd, specTd, platformTd, certTd, titleTd);
      }
      return tr;
    });
  }

  function renderTable(
    rows,
    showActions = true,
    showInputRow = showActions,
    showDelete = showActions,
    tableKind = 'form',
  ) {
    const tableWrap = createElement('div', 'entry-form__table-wrap');
    const table = document.createElement('table');
    table.className = 'entry-form__skills-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const headers = ['Skill', 'Experience in Months', 'Specialization', 'Platform', 'Certification', 'Title of Certificate'];
    if (showActions) headers.push('');
    headers.forEach((label) => headerRow.append(createElement('th', '', label)));
    thead.append(headerRow);
    table.append(thead);

    const tbody = document.createElement('tbody');
    renderDataRows(rows, showActions, showDelete, tableKind).forEach((tr) => tbody.append(tr));
    table.append(tbody);

    // The form table always carries the "+ Add" input row in its footer. It stays
    // put even while a saved row is being edited inline, so both input rows can
    // be in use at once.
    if (showInputRow) {
      const tfoot = document.createElement('tfoot');
      tfoot.append(renderInputRow(state.input, 'add'));
      table.append(tfoot);
    }

    tableWrap.append(table);
    return tableWrap;
  }

  function renderPreviousEntries(wrapper) {
    if (!state.savedRows.length) return;
    const section = createElement('div', 'entry-form__previous');
    section.append(createElement('h3', 'entry-form__previous-title', 'Previously submitted skills'));
    section.append(renderTable(state.savedRows, true, false, true, 'saved'));
    wrapper.append(section);
  }

  function renderForm(wrapper) {
    renderMessage(wrapper);
    wrapper.append(renderTable(state.rows, true));
    renderPreviousEntries(wrapper);
  }

  render = function renderEntryForm() {
    document.querySelectorAll('.entry-form__multi-panel').forEach((p) => multiPanelCleanups.get(p)?.());
    block.textContent = '';
    const wrapper = createElement('div', 'entry-form__wrapper');

    const header = createElement('div', 'entry-form__header');
    const displayName = state.name || state.employeeId;
    header.append(
      createElement('span', 'entry-form__heading-accent'),
      createElement('h2', 'entry-form__heading', displayName),
      createElement('p', 'entry-form__heading-sub', config.heading || 'Submit your skills'),
    );
    wrapper.append(header);

    const body = createElement('div', 'entry-form__body');
    renderForm(body);
    wrapper.append(body);
    block.append(wrapper);
  };

  render();
  loadPreviousEntries();
}
