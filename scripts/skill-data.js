export const MANAGERS = [
  { id: 'atul-bansal', name: 'Atul Bansal' },
];

export const SKILL_CATALOG = [
  { skillId: 1, skillName: 'HTML5', category: 'Generic Skill' },
  { skillId: 2, skillName: 'CSS3', category: 'Generic Skill' },
  { skillId: 3, skillName: 'JavaScript (ES6+)', category: 'Generic Skill' },
  { skillId: 4, skillName: 'TypeScript', category: 'Niche Skill' },
  { skillId: 5, skillName: 'ReactJS / AngularJS / VueJS', category: 'Niche Skill' },
  { skillId: 6, skillName: 'ReactNative / FlutterJS', category: 'Super Niche' },
  { skillId: 7, skillName: 'iOS / Android Development', category: 'Ultra Niche' },
  { skillId: 8, skillName: 'SvelteJS', category: 'Ultra Niche' },
  { skillId: 9, skillName: 'Next.js', category: 'Super Niche' },
  { skillId: 10, skillName: 'API Integration / GraphQL', category: 'Niche Skill' },
  { skillId: 11, skillName: 'Node.js (Frontend Integration Level)', category: 'Ultra Niche' },
  { skillId: 12, skillName: 'Webpack / Vite / Build Tools', category: 'Niche Skill' },
  { skillId: 13, skillName: 'Unit Testing (Jest, Vitest, Jasmine)', category: 'Niche Skill' },
  { skillId: 14, skillName: 'Progressive Web Apps (PWA)', category: 'Ultra Niche' },
  { skillId: 15, skillName: 'Adobe EDS (Edge Delivery Services)', category: 'Niche Skill' },
  { skillId: 16, skillName: 'ElectronJS', category: 'Ultra Niche' },
  { skillId: 17, skillName: 'Magento', category: 'Super Niche' },
  { skillId: 18, skillName: 'AdobeIO', category: 'Niche Skill' },
];

export const MOCK_SUBMISSIONS = [
  {
    employeeId: 'abaskaran',
    employeeName: 'Aravind Baskaran',
    managerId: 'atul-bansal',
    managerName: 'Atul Bansal',
    skillId: 15,
    experienceMonths: 18,
    certified: true,
  },
  {
    employeeId: 'robinvarshn',
    employeeName: 'Robin Varshney',
    managerId: 'atul-bansal',
    managerName: 'Atul Bansal',
    skillId: 9,
    experienceMonths: 22,
    certified: true,
  },
  {
    employeeId: 'shivamsharma',
    employeeName: 'Shivam Sharma',
    managerId: 'atul-bansal',
    managerName: 'Atul Bansal',
    skillId: 10,
    experienceMonths: 14,
    certified: false,
  },
  {
    employeeId: 'kahlid',
    employeeName: 'Mohamed Khalid',
    managerId: 'atul-bansal',
    managerName: 'Atul Bansal',
    skillId: 3,
    experienceMonths: 30,
    certified: false,
  },
  {
    employeeId: 'adarshn',
    employeeName: 'Adarsh Chandra Nanda',
    managerId: 'atul-bansal',
    managerName: 'Atul Bansal',
    skillId: 12,
    experienceMonths: 11,
    certified: true,
  },
  {
    employeeId: 'arulk',
    employeeName: 'Arul Kumar',
    managerId: 'atul-bansal',
    managerName: 'Atul Bansal',
    skillId: 17,
    experienceMonths: 8,
    certified: false,
  },
  {
    employeeId: 'chethankuma',
    employeeName: 'Chethan Kumar',
    managerId: 'atul-bansal',
    managerName: 'Atul Bansal',
    skillId: 18,
    experienceMonths: 19,
    certified: true,
  },
  {
    employeeId: 'varundixit',
    employeeName: 'Varun Dixit',
    managerId: 'atul-bansal',
    managerName: 'Atul Bansal',
    skillId: 5,
    experienceMonths: 6,
    certified: false,
  },
];

export function getSkillById(skillId) {
  return SKILL_CATALOG.find((entry) => entry.skillId === skillId) || null;
}

function normalizeSkillName(skillName) {
  return skillName.trim().toLowerCase();
}

export function getSkillByName(skillName) {
  const normalizedSkillName = normalizeSkillName(skillName);
  return SKILL_CATALOG.find(
    (entry) => normalizeSkillName(entry.skillName) === normalizedSkillName,
  ) || null;
}

export function getSkillAdoptionSnapshot(skillName, totalEmployees = 100) {
  const normalizedSkillName = normalizeSkillName(skillName);
  const submissionCount = MOCK_SUBMISSIONS.filter((entry) => {
    const skill = getSkillById(entry.skillId);
    return skill && normalizeSkillName(skill.skillName) === normalizedSkillName;
  }).length;

  const adoptionRate = totalEmployees > 0
    ? Number(((submissionCount / totalEmployees) * 100).toFixed(1))
    : 0;

  return {
    submissionCount,
    totalEmployees,
    adoptionRate,
  };
}

export function getCategoryFromAdoptionRate(adoptionRate) {
  if (adoptionRate <= 5) {
    return 'Ultra Niche';
  }

  if (adoptionRate <= 15) {
    return 'Super Niche';
  }

  if (adoptionRate <= 30) {
    return 'Niche Skill';
  }

  return 'Generic Skill';
}
