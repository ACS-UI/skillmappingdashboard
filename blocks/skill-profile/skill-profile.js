function readBlockConfig(block) {
  return [...block.children].reduce((config, row) => {
    const cells = [...row.children];
    if (cells.length < 2) {
      return config;
    }

    const key = cells[0].textContent.trim().toLowerCase();
    const value = cells[1].textContent.trim();

    if (key) {
      config[key] = value;
    }

    return config;
  }, {});
}

// TODO: replace hardcoded data with GET /api/v1/managers/{managerId}/employees/skills
const SKILL_PROFILE_DATA = {
  metadata: {
    version: '1.0',
    lastUpdatedAt: '2026-05-25T00:00:00Z',
    categories: [
      { categoryId: 1, categoryName: 'Generic Skill' },
      { categoryId: 2, categoryName: 'Niche Skill' },
      { categoryId: 3, categoryName: 'Super Niche' },
      { categoryId: 4, categoryName: 'Ultra Niche' },
    ],
    skills: [
      { skillId: 1, skillName: 'HTML5', categoryId: 1 },
      { skillId: 2, skillName: 'CSS3', categoryId: 1 },
      { skillId: 3, skillName: 'JavaScript (ES6+)', categoryId: 1 },
      { skillId: 4, skillName: 'TypeScript', categoryId: 2 },
      { skillId: 5, skillName: 'ReactJS/AngularJS /VueJS', categoryId: 2 },
      { skillId: 6, skillName: 'ReactNative/FlutterJS', categoryId: 3 },
      { skillId: 7, skillName: 'IOS/Android Development', categoryId: 4 },
      { skillId: 8, skillName: 'SvelteJS', categoryId: 4 },
      { skillId: 9, skillName: 'Next.js', categoryId: 3 },
      { skillId: 10, skillName: 'API Integration/GraphQL', categoryId: 2 },
      { skillId: 11, skillName: 'Node.js (Frontend Integration Level)', categoryId: 4 },
      { skillId: 12, skillName: 'Webpack / Vite / Build Tools', categoryId: 2 },
      { skillId: 13, skillName: 'Unit Testing (Jest, Vitest, Jasmine)', categoryId: 2 },
      { skillId: 14, skillName: 'Progressive Web Apps (PWA)', categoryId: 4 },
      { skillId: 15, skillName: 'Adobe EDS (Edge Delivery Services)', categoryId: 2 },
      { skillId: 16, skillName: 'ElectronJS', categoryId: 4 },
      { skillId: 17, skillName: 'Magento', categoryId: 3 },
      { skillId: 18, skillName: 'AdobeIO', categoryId: 2 },
    ],
    proficiencyLevels: [
      { proficiencyLevel: 1, proficiencyLevelName: 'Foundational' },
      { proficiencyLevel: 2, proficiencyLevelName: 'Developing' },
      { proficiencyLevel: 3, proficiencyLevelName: 'Professional' },
      { proficiencyLevel: 4, proficiencyLevelName: 'Expert' },
      { proficiencyLevel: 5, proficiencyLevelName: 'Master' },
    ],
  },
  manager: {
    managerId: 'atul-bansal',
    managerName: 'Atul Bansal',
    managerEmail: 'atulb@adobe.com',
    profileImageUrl: null,
    designation: 'Engineering Manager',
  },
  employees: [
    {
      employeeId: 'abaskaran',
      employeeName: 'Aravind Baskaran',
      emailAddress: 'abaskaran@adobe.com',
      profileImageUrl: null,
      designation: 'Sr Technical Consultant',
      skillSet: [
        { skillId: 1, proficiencyLevel: 5 },
        { skillId: 2, proficiencyLevel: 5 },
        { skillId: 3, proficiencyLevel: 5 },
        { skillId: 4, proficiencyLevel: 5 },
        { skillId: 5, proficiencyLevel: 5 },
        { skillId: 6, proficiencyLevel: 3 },
        { skillId: 7, proficiencyLevel: 1 },
        { skillId: 8, proficiencyLevel: 1 },
        { skillId: 9, proficiencyLevel: 3 },
        { skillId: 10, proficiencyLevel: 4 },
        { skillId: 11, proficiencyLevel: 3 },
        { skillId: 12, proficiencyLevel: 3 },
        { skillId: 13, proficiencyLevel: 5 },
        { skillId: 14, proficiencyLevel: 1 },
        { skillId: 15, proficiencyLevel: 2 },
        { skillId: 16, proficiencyLevel: 1 },
        { skillId: 17, proficiencyLevel: 1 },
        { skillId: 18, proficiencyLevel: 1 },
      ],
    },
    {
      employeeId: 'robinvarshn',
      employeeName: 'Robin Varshney',
      emailAddress: 'robinvarshn@adobe.com',
      profileImageUrl: null,
      designation: 'Sr Technical Consultant',
      skillSet: [
        { skillId: 1, proficiencyLevel: 5 },
        { skillId: 2, proficiencyLevel: 5 },
        { skillId: 3, proficiencyLevel: 5 },
        { skillId: 4, proficiencyLevel: 5 },
        { skillId: 5, proficiencyLevel: 5 },
        { skillId: 6, proficiencyLevel: 3 },
        { skillId: 7, proficiencyLevel: 3 },
        { skillId: 8, proficiencyLevel: 3 },
        { skillId: 9, proficiencyLevel: 5 },
        { skillId: 10, proficiencyLevel: 5 },
        { skillId: 11, proficiencyLevel: 5 },
        { skillId: 12, proficiencyLevel: 5 },
        { skillId: 13, proficiencyLevel: 5 },
        { skillId: 14, proficiencyLevel: 5 },
        { skillId: 15, proficiencyLevel: 3 },
        { skillId: 16, proficiencyLevel: 3 },
        { skillId: 17, proficiencyLevel: 1 },
        { skillId: 18, proficiencyLevel: 4 },
      ],
    },
    {
      employeeId: 'shivamsharma',
      employeeName: 'Shivam Sharma',
      emailAddress: 'shivamsharma@adobe.com',
      profileImageUrl: null,
      designation: 'Technical Consultant',
      skillSet: [
        { skillId: 1, proficiencyLevel: 5 },
        { skillId: 2, proficiencyLevel: 5 },
        { skillId: 3, proficiencyLevel: 5 },
        { skillId: 4, proficiencyLevel: 5 },
        { skillId: 5, proficiencyLevel: 5 },
        { skillId: 6, proficiencyLevel: 1 },
        { skillId: 7, proficiencyLevel: 1 },
        { skillId: 8, proficiencyLevel: 3 },
        { skillId: 9, proficiencyLevel: 3 },
        { skillId: 10, proficiencyLevel: 5 },
        { skillId: 11, proficiencyLevel: 5 },
        { skillId: 12, proficiencyLevel: 4 },
        { skillId: 13, proficiencyLevel: 5 },
        { skillId: 14, proficiencyLevel: 5 },
        { skillId: 15, proficiencyLevel: 1 },
        { skillId: 16, proficiencyLevel: 1 },
        { skillId: 17, proficiencyLevel: 1 },
        { skillId: 18, proficiencyLevel: 1 },
      ],
    },
    {
      employeeId: 'kahlid',
      employeeName: 'Mohamed Khalid',
      emailAddress: 'kahlid@adobe.com',
      profileImageUrl: null,
      designation: 'Technical Architect',
      skillSet: [
        { skillId: 1, proficiencyLevel: 5 },
        { skillId: 2, proficiencyLevel: 5 },
        { skillId: 3, proficiencyLevel: 5 },
        { skillId: 4, proficiencyLevel: 5 },
        { skillId: 5, proficiencyLevel: 5 },
        { skillId: 6, proficiencyLevel: 3 },
        { skillId: 7, proficiencyLevel: 1 },
        { skillId: 8, proficiencyLevel: 1 },
        { skillId: 9, proficiencyLevel: 1 },
        { skillId: 10, proficiencyLevel: 4 },
        { skillId: 11, proficiencyLevel: 3 },
        { skillId: 12, proficiencyLevel: 4 },
        { skillId: 13, proficiencyLevel: 4 },
        { skillId: 14, proficiencyLevel: 1 },
        { skillId: 15, proficiencyLevel: 5 },
        { skillId: 16, proficiencyLevel: 1 },
        { skillId: 17, proficiencyLevel: 1 },
        { skillId: 18, proficiencyLevel: 1 },
      ],
    },
    {
      employeeId: 'karpandu',
      employeeName: 'Karvannan Pandurangan',
      emailAddress: 'karpandu@adobe.com',
      profileImageUrl: null,
      designation: 'Sr Technical Consultant',
      skillSet: [
        { skillId: 1, proficiencyLevel: 5 },
        { skillId: 2, proficiencyLevel: 5 },
        { skillId: 3, proficiencyLevel: 5 },
        { skillId: 4, proficiencyLevel: 5 },
        { skillId: 5, proficiencyLevel: 5 },
        { skillId: 6, proficiencyLevel: 3 },
        { skillId: 7, proficiencyLevel: 3 },
        { skillId: 8, proficiencyLevel: 3 },
        { skillId: 9, proficiencyLevel: 3 },
        { skillId: 10, proficiencyLevel: 4 },
        { skillId: 11, proficiencyLevel: 3 },
        { skillId: 12, proficiencyLevel: 4 },
        { skillId: 13, proficiencyLevel: 4 },
        { skillId: 14, proficiencyLevel: 3 },
        { skillId: 15, proficiencyLevel: 4 },
        { skillId: 16, proficiencyLevel: 3 },
        { skillId: 17, proficiencyLevel: 1 },
        { skillId: 18, proficiencyLevel: 3 },
      ],
    },
    {
      employeeId: 'adarshn',
      employeeName: 'Adarsh Chandra Nanda',
      emailAddress: 'adarshn@adobe.com',
      profileImageUrl: null,
      designation: 'Sr Technical Consultant',
      skillSet: [
        { skillId: 1, proficiencyLevel: 5 },
        { skillId: 2, proficiencyLevel: 5 },
        { skillId: 3, proficiencyLevel: 5 },
        { skillId: 4, proficiencyLevel: 5 },
        { skillId: 5, proficiencyLevel: 5 },
        { skillId: 6, proficiencyLevel: 1 },
        { skillId: 7, proficiencyLevel: 1 },
        { skillId: 8, proficiencyLevel: 1 },
        { skillId: 9, proficiencyLevel: 2 },
        { skillId: 10, proficiencyLevel: 5 },
        { skillId: 11, proficiencyLevel: 3 },
        { skillId: 12, proficiencyLevel: 5 },
        { skillId: 13, proficiencyLevel: 5 },
        { skillId: 14, proficiencyLevel: 1 },
        { skillId: 15, proficiencyLevel: 5 },
        { skillId: 16, proficiencyLevel: 1 },
        { skillId: 17, proficiencyLevel: 1 },
        { skillId: 18, proficiencyLevel: 2 },
      ],
    },
    {
      employeeId: 'arulk',
      employeeName: 'Arul Kumar',
      emailAddress: 'arulk@adobe.com',
      profileImageUrl: null,
      designation: 'Technical Architect',
      skillSet: [
        { skillId: 1, proficiencyLevel: 5 },
        { skillId: 2, proficiencyLevel: 5 },
        { skillId: 3, proficiencyLevel: 5 },
        { skillId: 4, proficiencyLevel: 5 },
        { skillId: 5, proficiencyLevel: 5 },
        { skillId: 6, proficiencyLevel: 3 },
        { skillId: 7, proficiencyLevel: 2 },
        { skillId: 8, proficiencyLevel: 1 },
        { skillId: 9, proficiencyLevel: 1 },
        { skillId: 10, proficiencyLevel: 4 },
        { skillId: 11, proficiencyLevel: 3 },
        { skillId: 12, proficiencyLevel: 4 },
        { skillId: 13, proficiencyLevel: 5 },
        { skillId: 14, proficiencyLevel: 3 },
        { skillId: 15, proficiencyLevel: 5 },
        { skillId: 16, proficiencyLevel: 1 },
        { skillId: 17, proficiencyLevel: 1 },
        { skillId: 18, proficiencyLevel: 1 },
      ],
    },
    {
      employeeId: 'chethankuma',
      employeeName: 'Chethan Kumar',
      emailAddress: 'chethankuma@adobe.com',
      profileImageUrl: null,
      designation: 'Sr Technical Consultant',
      skillSet: [
        { skillId: 1, proficiencyLevel: 5 },
        { skillId: 2, proficiencyLevel: 5 },
        { skillId: 3, proficiencyLevel: 5 },
        { skillId: 4, proficiencyLevel: 5 },
        { skillId: 5, proficiencyLevel: 5 },
        { skillId: 6, proficiencyLevel: 3 },
        { skillId: 7, proficiencyLevel: 1 },
        { skillId: 8, proficiencyLevel: 1 },
        { skillId: 9, proficiencyLevel: 3 },
        { skillId: 10, proficiencyLevel: 4 },
        { skillId: 11, proficiencyLevel: 3 },
        { skillId: 12, proficiencyLevel: 4 },
        { skillId: 13, proficiencyLevel: 5 },
        { skillId: 14, proficiencyLevel: 3 },
        { skillId: 15, proficiencyLevel: 4 },
        { skillId: 16, proficiencyLevel: 1 },
        { skillId: 17, proficiencyLevel: 1 },
        { skillId: 18, proficiencyLevel: 3 },
      ],
    },
    {
      employeeId: 'khokhard',
      employeeName: 'Deepak khokha',
      emailAddress: 'khokhard@adobe.com',
      profileImageUrl: null,
      designation: 'Technical Architect',
      skillSet: [
        { skillId: 1, proficiencyLevel: 5 },
        { skillId: 2, proficiencyLevel: 5 },
        { skillId: 3, proficiencyLevel: 5 },
        { skillId: 4, proficiencyLevel: 5 },
        { skillId: 5, proficiencyLevel: 5 },
        { skillId: 6, proficiencyLevel: 3 },
        { skillId: 7, proficiencyLevel: 3 },
        { skillId: 8, proficiencyLevel: 1 },
        { skillId: 9, proficiencyLevel: 3 },
        { skillId: 10, proficiencyLevel: 5 },
        { skillId: 11, proficiencyLevel: 5 },
        { skillId: 12, proficiencyLevel: 3 },
        { skillId: 13, proficiencyLevel: 5 },
        { skillId: 14, proficiencyLevel: 3 },
        { skillId: 15, proficiencyLevel: 1 },
        { skillId: 16, proficiencyLevel: 1 },
        { skillId: 17, proficiencyLevel: 1 },
        { skillId: 18, proficiencyLevel: 1 },
      ],
    },
    {
      employeeId: 'vvenkateshku',
      employeeName: 'Vigneshwaran Venkateshkuma',
      emailAddress: 'vvenkateshku@adobe.com',
      profileImageUrl: null,
      designation: 'Sr Technical Consultant',
      skillSet: [
        { skillId: 1, proficiencyLevel: 5 },
        { skillId: 2, proficiencyLevel: 5 },
        { skillId: 3, proficiencyLevel: 5 },
        { skillId: 4, proficiencyLevel: 5 },
        { skillId: 5, proficiencyLevel: 5 },
        { skillId: 6, proficiencyLevel: 5 },
        { skillId: 7, proficiencyLevel: 1 },
        { skillId: 8, proficiencyLevel: 1 },
        { skillId: 9, proficiencyLevel: 3 },
        { skillId: 10, proficiencyLevel: 5 },
        { skillId: 11, proficiencyLevel: 5 },
        { skillId: 12, proficiencyLevel: 5 },
        { skillId: 13, proficiencyLevel: 3 },
        { skillId: 14, proficiencyLevel: 5 },
        { skillId: 15, proficiencyLevel: 3 },
        { skillId: 16, proficiencyLevel: 3 },
        { skillId: 17, proficiencyLevel: 1 },
        { skillId: 18, proficiencyLevel: 3 },
      ],
    },
    {
      employeeId: 'varundixit',
      employeeName: 'Varun Dixit',
      emailAddress: 'varundixit@adobe.com',
      profileImageUrl: null,
      designation: 'Sr Technical Consultant',
      skillSet: [
        { skillId: 1, proficiencyLevel: 5 },
        { skillId: 2, proficiencyLevel: 5 },
        { skillId: 3, proficiencyLevel: 5 },
        { skillId: 4, proficiencyLevel: 5 },
        { skillId: 5, proficiencyLevel: 5 },
        { skillId: 6, proficiencyLevel: 2 },
        { skillId: 7, proficiencyLevel: 1 },
        { skillId: 8, proficiencyLevel: 1 },
        { skillId: 9, proficiencyLevel: 3 },
        { skillId: 10, proficiencyLevel: 3 },
        { skillId: 11, proficiencyLevel: 1 },
        { skillId: 12, proficiencyLevel: 2 },
        { skillId: 13, proficiencyLevel: 3 },
        { skillId: 14, proficiencyLevel: 3 },
        { skillId: 15, proficiencyLevel: 3 },
        { skillId: 16, proficiencyLevel: 3 },
        { skillId: 17, proficiencyLevel: 1 },
        { skillId: 18, proficiencyLevel: 1 },
      ],
    },
    {
      employeeId: 'svishwakarma',
      employeeName: 'Sanjay Vishwakarma',
      emailAddress: 'svishwakarma@adobe.com',
      profileImageUrl: null,
      designation: 'Sr Technical Consultant',
      skillSet: [
        { skillId: 1, proficiencyLevel: 5 },
        { skillId: 2, proficiencyLevel: 5 },
        { skillId: 3, proficiencyLevel: 5 },
        { skillId: 4, proficiencyLevel: 5 },
        { skillId: 5, proficiencyLevel: 5 },
        { skillId: 6, proficiencyLevel: 3 },
        { skillId: 7, proficiencyLevel: 1 },
        { skillId: 8, proficiencyLevel: 1 },
        { skillId: 9, proficiencyLevel: 3 },
        { skillId: 10, proficiencyLevel: 5 },
        { skillId: 11, proficiencyLevel: 3 },
        { skillId: 12, proficiencyLevel: 3 },
        { skillId: 13, proficiencyLevel: 5 },
        { skillId: 14, proficiencyLevel: 1 },
        { skillId: 15, proficiencyLevel: 3 },
        { skillId: 16, proficiencyLevel: 1 },
        { skillId: 17, proficiencyLevel: 1 },
        { skillId: 18, proficiencyLevel: 1 },
      ],
    },
  ],
};

const CATEGORY_ORDER = SKILL_PROFILE_DATA.metadata.categories
  .map((category) => category.categoryName);

const FILTER_OPTIONS = ['All', ...CATEGORY_ORDER];

function getInitials(name) {
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

function getEmployeeIdFromUrl() {
  return new URLSearchParams(window.location.search).get('emp');
}

function getLevelName(level) {
  const match = SKILL_PROFILE_DATA.metadata.proficiencyLevels
    .find((entry) => entry.proficiencyLevel === level);
  return match?.proficiencyLevelName || 'Not assessed';
}

function createButton(text, variant = 'secondary') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `skill-profile__button skill-profile__button--${variant}`;
  button.textContent = text;
  return button;
}

function createBackButton(path) {
  const link = document.createElement('a');
  link.className = 'skill-profile__back-button';
  link.href = path;
  link.setAttribute('aria-label', 'Go back');

  const icon = document.createElement('span');
  icon.className = 'skill-profile__back-button-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '<';

  link.append(icon);
  return link;
}

function createEmptyState(message) {
  const emptyState = document.createElement('p');
  emptyState.className = 'skill-profile__empty';
  emptyState.textContent = message;
  return emptyState;
}

function buildSkillMap(skills) {
  return skills.reduce((map, skill) => {
    map[skill.skillId] = skill.proficiencyLevel;
    return map;
  }, {});
}

function buildProfileSkills(skillsMap) {
  return SKILL_PROFILE_DATA.metadata.skills.map((skill) => {
    const category = SKILL_PROFILE_DATA.metadata.categories
      .find((entry) => entry.categoryId === skill.categoryId);

    return {
      skillId: skill.skillId,
      name: skill.skillName,
      category: category?.categoryName || 'Uncategorized',
      actual: skillsMap[skill.skillId] || 0,
      expected: 0,
    };
  });
}

function normalizeManagerProfile() {
  return {
    id: SKILL_PROFILE_DATA.manager.managerId,
    name: SKILL_PROFILE_DATA.manager.managerName,
    designation: SKILL_PROFILE_DATA.manager.designation,
    department: 'ACS',
    email: SKILL_PROFILE_DATA.manager.managerEmail,
    skills: [],
  };
}

function normalizeEmployeeProfile(employee) {
  return {
    id: employee.employeeId,
    name: employee.employeeName,
    designation: employee.designation,
    department: 'ACS',
    email: employee.emailAddress,
    skills: employee.skillSet || [],
  };
}

function findProfileById(employeeId) {
  if (employeeId === SKILL_PROFILE_DATA.manager.managerId) {
    return normalizeManagerProfile();
  }

  const employee = SKILL_PROFILE_DATA.employees.find((entry) => entry.employeeId === employeeId);
  if (!employee) {
    return null;
  }

  return normalizeEmployeeProfile(employee);
}

function createAvatar(name) {
  const avatar = document.createElement('div');
  avatar.className = 'skill-profile__avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = getInitials(name);
  return avatar;
}

function createHeader(employee, canEdit) {
  const header = document.createElement('section');
  header.className = 'skill-profile__header';

  const identity = document.createElement('div');
  identity.className = 'skill-profile__identity';
  identity.append(createAvatar(employee.name));

  const content = document.createElement('div');
  content.className = 'skill-profile__identity-content';

  const name = document.createElement('h2');
  name.className = 'skill-profile__name';
  name.textContent = employee.name;
  content.append(name);

  const title = document.createElement('p');
  title.className = 'skill-profile__title';
  title.textContent = `${employee.designation} | ${employee.department}`;
  content.append(title);

  const email = document.createElement('a');
  email.className = 'skill-profile__email';
  email.href = `mailto:${employee.email}`;
  email.textContent = employee.email;
  content.append(email);

  identity.append(content);
  header.append(identity);

  if (canEdit) {
    const actions = document.createElement('div');
    actions.className = 'skill-profile__header-actions';

    const button = createButton('Edit skills');
    button.classList.add('skill-profile__edit-toggle');
    actions.append(button);
    header.append(actions);
  }

  return header;
}

function createFilter(state, refresh) {
  const controls = document.createElement('div');
  controls.className = 'skill-profile__controls';

  const filterLabel = document.createElement('label');
  filterLabel.className = 'skill-profile__filter-label';
  filterLabel.setAttribute('for', 'skill-profile-category-filter');
  filterLabel.textContent = 'Filter by category';

  const filterSelect = document.createElement('select');
  filterSelect.id = 'skill-profile-category-filter';
  filterSelect.className = 'skill-profile__filter-select';

  FILTER_OPTIONS.forEach((option) => {
    const optionElement = document.createElement('option');
    optionElement.value = option;
    optionElement.textContent = option;
    optionElement.selected = option === state.activeFilter;
    filterSelect.append(optionElement);
  });

  filterSelect.addEventListener('change', (event) => {
    state.activeFilter = event.target.value;
    refresh();
  });

  controls.append(filterLabel, filterSelect);
  return controls;
}

function createDots(actual, expected) {
  const dots = document.createElement('div');
  dots.className = 'skill-profile__dots';
  dots.setAttribute('aria-label', `Current level ${actual} of 5, expected level ${expected} of 5`);

  for (let index = 1; index <= 5; index += 1) {
    const dot = document.createElement('span');
    dot.className = 'skill-profile__dot';

    if (index <= actual) {
      dot.classList.add('skill-profile__dot--actual');
    } else if (index <= expected) {
      dot.classList.add('skill-profile__dot--expected');
    }

    dots.append(dot);
  }

  return dots;
}

function createSegmentedControl(skill, currentValue, onChange) {
  const control = document.createElement('div');
  control.className = 'skill-profile__segments';
  control.setAttribute('role', 'group');
  control.setAttribute('aria-label', `${skill.name} proficiency level`);

  const values = [0, 1, 2, 3, 4, 5];
  values.forEach((value) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'skill-profile__segment';
    option.textContent = value === 0 ? '-' : String(value);
    option.setAttribute('aria-pressed', String(value === currentValue));

    if (value === currentValue) {
      option.classList.add('is-active');
    }

    option.addEventListener('click', () => onChange(skill.skillId, value));
    control.append(option);
  });

  return control;
}

function createSkillRow(skill, state, refresh) {
  const row = document.createElement('div');
  row.className = 'skill-profile__row';

  const name = document.createElement('div');
  name.className = 'skill-profile__skill-name';
  name.textContent = skill.name;
  row.append(name);

  const middle = document.createElement('div');
  middle.className = 'skill-profile__skill-indicator';

  const currentValue = state.draft[skill.skillId] ?? 0;
  if (state.isEditing) {
    middle.append(createSegmentedControl(skill, currentValue, (skillId, value) => {
      state.draft[skillId] = value;
      refresh();
    }));
  } else {
    middle.append(createDots(currentValue, skill.expected));
  }

  row.append(middle);

  const label = document.createElement('div');
  label.className = 'skill-profile__skill-level';
  label.textContent = getLevelName(currentValue);
  row.append(label);

  return row;
}

function createSkillSection(category, skills, state, refresh) {
  const section = document.createElement('section');
  section.className = 'skill-profile__section';

  const header = document.createElement('div');
  header.className = 'skill-profile__section-header';

  const heading = document.createElement('h3');
  heading.className = 'skill-profile__section-title';
  heading.textContent = category;
  header.append(heading);

  const count = document.createElement('span');
  count.className = 'skill-profile__count';
  count.textContent = `${skills.length} skills`;
  header.append(count);

  section.append(header);

  const body = document.createElement('div');
  body.className = 'skill-profile__section-body';
  skills.forEach((skill) => body.append(createSkillRow(skill, state, refresh)));
  section.append(body);

  return section;
}

function createActionBar(state, onCancel, onSave) {
  if (!state.isEditing) {
    return null;
  }

  const bar = document.createElement('div');
  bar.className = 'skill-profile__action-bar';

  const cancelButton = createButton('Cancel');
  cancelButton.addEventListener('click', onCancel);

  const updateButton = createButton('Update', 'primary');
  updateButton.addEventListener('click', onSave);

  bar.append(cancelButton, updateButton);
  return bar;
}

function renderProfile(block, employee, canEdit, backPath) {
  const state = {
    isEditing: false,
    activeFilter: 'All',
    pendingExitAction: null,
    historyStateActive: false,
    saved: buildSkillMap(employee.skills),
    draft: buildSkillMap(employee.skills),
  };

  const skills = buildProfileSkills(state.saved);
  let refresh;

  function applyExitFromEditMode(action = 'cancel') {
    if (action === 'save') {
      state.saved = { ...state.draft };
    } else {
      state.draft = { ...state.saved };
    }

    state.isEditing = false;
    state.historyStateActive = false;
    state.pendingExitAction = null;
    refresh();
  }

  function exitEditMode(action = 'cancel') {
    if (state.historyStateActive) {
      state.pendingExitAction = action;
      window.history.back();
      return;
    }

    applyExitFromEditMode(action);
  }

  refresh = function refreshProfile() {
    block.textContent = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'skill-profile__wrapper';

    wrapper.append(createBackButton(backPath));

    const header = createHeader(employee, canEdit);
    const editButton = header.querySelector('.skill-profile__edit-toggle');

    if (editButton) {
      editButton.textContent = state.isEditing ? 'Editing...' : 'Edit skills';
      editButton.classList.toggle('is-editing', state.isEditing);
      editButton.disabled = state.isEditing;

      if (state.isEditing) {
        const badge = document.createElement('span');
        badge.className = 'skill-profile__editing-badge';
        badge.textContent = 'In progress';
        editButton.append(badge);
      } else {
        editButton.addEventListener('click', () => {
          state.draft = { ...state.saved };
          state.isEditing = true;
          state.historyStateActive = true;
          window.history.pushState({
            ...window.history.state,
            skillProfileEditMode: employee.id,
          }, '', window.location.href);
          refresh();
        });
      }
    }

    wrapper.append(header);

    wrapper.append(createFilter(state, refresh));

    CATEGORY_ORDER.forEach((category) => {
      if (state.activeFilter !== 'All' && state.activeFilter !== category) {
        return;
      }

      const categorySkills = skills.filter((skill) => skill.category === category);
      wrapper.append(createSkillSection(category, categorySkills, state, refresh));
    });

    const actionBar = createActionBar(
      state,
      () => exitEditMode('cancel'),
      () => {
        // TODO: replace with POST /api/v1/managers/{managerId}/employees/skills
        exitEditMode('save');
      },
    );
    if (actionBar) {
      wrapper.append(actionBar);
    }

    block.append(wrapper);
  };

  function handlePopState() {
    if (!state.historyStateActive) {
      return;
    }

    applyExitFromEditMode(state.pendingExitAction || 'cancel');
  }

  window.addEventListener('popstate', handlePopState);

  refresh();
}

export default function decorate(block) {
  const config = readBlockConfig(block);
  const employeeId = getEmployeeIdFromUrl() || config['employee-id'] || '';
  const role = (config.role || 'employee').toLowerCase();
  const backPath = config['back-path'] || '/';
  const employee = findProfileById(employeeId);

  block.textContent = '';

  if (!employee) {
    block.append(createEmptyState('Employee not found'));
    return;
  }

  renderProfile(block, employee, role === 'manager', backPath);
}
