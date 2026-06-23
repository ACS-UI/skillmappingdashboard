# Skill Mapping Dashboard

An internal Adobe tool for mapping and tracking frontend skill proficiency across teams. Built on AEM Edge Delivery Services (EDS) using vanilla JS — no frameworks, no build steps.

---

## Pages

| URL | Block | Audience |
|---|---|---|
| `/` | `entry-form` | All employees |
| `/employee-details` | `report-table` | Managers only (non-managers redirected to `/`) |

---

## User Flow

```
Open app (index — entry form lives here)
│
├── SSO login via Adobe IMS (wired in auth.js)
│   └── return profile → setUser({ name, email, ldap, isManager }) in db.js
│       └── isManager derived from /employee-mapping.json
│
├── Fill form → POST skill report → Backend API
│   └── Success → fetch GET employee/{id} → Saved view
│       ├── Edit any saved skill → Save changes → re-POST
│       └── + Add more skills → back to blank form
│
├── Managers also see a view toggle (Enter Skills ⇄ Manager View)
│   └── Manager View (/employee-details) → direct-reports skill report
│       (non-managers are redirected back to /)
│
Logout (either page) → clearUser() → redirect to /
```

---

## Setup

- `fstab.yaml` points to `https://content.da.live/vishnuadobe/skillmappingdashboard/` as the content source
- Org chart block scrapped — `org-chart` removed from the active codebase
- Entry form lives on the index page (`/`) — no redirect routing on the index
- `/employee-details` is gated to managers (see `report-table`); non-managers are redirected to `/`

---

## Blocks

### `entry-form` — `/` (index)

Table-based UI where employees submit their skills. Columns: Skill, Experience in Months, Specialization, Platform, Certification, Title of Certificate.

- **Skill** — dropdown fetched from `/skills.json` (da.live authorable). "Other…" reveals a free-text input for custom skills not in the list
- **Experience in Months** — free-text number input (1–1000); mandatory
- **Specialization** — custom multi-select dropdown sourced from `/specializations.json`; optional; selected values shown as indigo chips in data rows
- **Platform** — custom multi-select dropdown sourced from `/specializations/platforms.json` (second tab of the `specializations` sheet); lists Adobe platforms (EDS, AEM, AJO, AEP, etc.); optional; stored as a comma-separated string in the backend field `platform`, split back to an array on read
- **Certification** — Yes / No dropdown; Title of Certificate text input shown only when Yes
- **Proficiency level** — derived from experience months via `/skill-levels.json` (authorable); not shown as a column but included in the POST payload

**Interaction model:**
- `+ Add` submits immediately — no separate Submit button. Clicking `+ Add` validates, builds a single-skill payload, POSTs via `submitSkillReport()`, silently reloads the saved list, and shows a green success banner. The backend merges/appends so a single-skill POST is sufficient
- The `+ Add` input row is always present at the bottom; after each add it clears and is ready for the next skill

**Previously submitted skills** — rendered below the form, loaded on init via `loadPreviousEntries()` into `state.savedRows`:
- **Inline edit (✏), immediate-save** — clicking ✏ swaps that row for a pre-filled input row with floppy (Save) / × (Cancel) icon buttons. Save POSTs the single skill immediately, then silently reloads the list
- **Two independent input models** — `state.editInput` for the edit row, `state.input` for the add row. Both rows can be active at once
- **Delete (🗑)** — removes from the UI and calls `DELETE skillReport/employee/{id}/skill/{name}` on the backend

**Layout:**
- Below 900px (mobile + tablet): stacked card layout — each field on its own labelled row, no horizontal scroll
- 900px and above: full table layout with fixed column widths

**Other:**
- Resolves the user via `getSessionUser()` so `?as=<ldap>` impersonation works
- `email` and `name` in the POST payload come from the IndexDB user record (SSO wired)
- The manager view toggle lives in the global header, not in this block
- Content width capped at 1280px, centred with `margin: 0 auto`

---

### `report-table` — `/employee-details`

Manager-facing report with two tables. Content width capped at 1280px, centred with `margin: 0 auto`.

**Access gate** — resolves the session user; `allowed = await isManager(user?.email) || isTestEnvironment()`. Non-managers (or unidentified users in production) are redirected to `/` before any data is fetched.

**Direct-reports filter** — employees filtered to those whose `Manager LDAP` equals the logged-in manager's LDAP (one level only), joined on the normalised LDAP local-part via `employee-mapping.js`.

**Skill rarity tiers** (Generic / Niche / Super niche / Ultra niche) — computed from how many employees across the whole workforce hold each skill (`computeSkillRarity` + `getRarityTier`). Thresholds in `RARITY_TIERS`: Generic ≥50%, Niche ≥30%, Super niche ≥20%, Ultra niche ≥10%.

**Shared tier-grouping helpers** (single source of truth used by both tables and the CSV export):
- `getSkillTier(name, skillRarity)` — the tier a skill falls into
- `groupSkillsByTier(skills, skillRarity)` — `Map<tierId, sortedSkills[]>` in `RARITY_TIERS` order, alphabetical within each tier

#### Table 1 — "Skills by rarity tier" (`renderTierTable`)

- One column group per rarity tier (Generic → Ultra niche), each split into **Skill** and **Months** sub-columns
- Two-row `thead`: rose-gradient banner row (`colspan=2` per tier) + a Skill/Months sub-header row
- Body: one row per employee, skills zipped row-by-row across tiers (side-by-side). Employee name cell spans all of that employee's rows (`rowSpan`). Dark horizontal rule between employees
- Rose tier theming — `--tier-accent` CSS variable ramping light (common) → deep (rare); kept distinct from multicolour proficiency badges
- Single-letter proficiency badge (F/D/P/E/M) next to each skill name
- Sticky employee column
- **Export CSV** (`tierTableToCsv`) — mirrors the on-screen layout 1:1

#### Table 2 — "Skill Distribution" (`renderDistributionTable`)

- Rows = rarity tiers; columns = P-level bands (P10/P20/P30/P40/P50); cells = employee counts
- **Location filter** — pill buttons (Noida / Bangalore) swap cell values in place without a DOM rebuild
- **Authorable** via optional block config rows in the da.live `employee-details` document: `levels` (comma list, default `P10,P20,P30,P40,P50`) and `locations` (comma list, default `Noida,Bangalore`)
- Distribution computed at runtime via `computeDistribution()`: joins each direct-report's LDAP with `getAllEmployeeRecords()` to get `jobLevel` and `location`; each employee counted once per rarity tier they have ≥1 skill in

**Other:**
- Proficiency level badges driven by `proficiencyLevels` from API metadata; legend shown in the toolbar
- Loading, error, and empty ("No direct reports have submitted skills yet.") states handled
- View toggle lives in the global header; no logout button in-block

---

## Scripts

| File | Purpose |
|---|---|
| `scripts/api.js` | `getSkillReport()`, `getEmployeeSkillReport(id)`, `submitSkillReport()`, `buildSkillsPayload()` (specialization → comma string, platform → comma string), async `getLevelFromExperienceMonths()` |
| `scripts/auth.js` | SSO wired: `loadIms()`, `logout()` (default export), `getSessionUser()` (+ `?as=` test impersonation), `isTestEnvironment()`. Derives `isManager` from the mapping sheet on login |
| `scripts/employee-mapping.js` | Loads/caches the employee→manager mapping (authenticated `employeeMapping` API in prod, public `/employee-mapping.json` sheet locally — see detail below); `normalizeLdap`, `getEmployeeMapping`, `isManager`, `getDirectReports`, `getAllEmployeeRecords` (includes `jobLevel`/`location`), `buildUserFromMapping` |
| `scripts/view-toggle.js` | `buildViewToggle(currentView)` — segmented "Enter Skills ⇄ Manager View" control; preserves `?as=` on navigation. Rendered by the global header for managers |
| `scripts/db.js` | `getUser()` — wraps `window.adobeIMS.getProfile()` to return `{ name, email, ldap }` |
| `scripts/skill-data.js` | Legacy mock data — blocks use the live API |
| `scripts/scripts.js` | AEM page decoration entry point |

### `scripts/api.js` detail

- `API_BASE_URL` — base constant; `SKILL_REPORT_URL` derived from it
- `requestJson()` attaches a `Bearer` token from `window.adobeIMS.getAccessToken()` when available
- `buildSkillsPayload(employeeId, email, name, skills)` — constructs POST body; `specialization` and `platform` joined to comma-separated strings; cert `certificateImageUrl` only included when present

### `scripts/employee-mapping.js` detail

- **Data source is token-aware.** When `window.adobeIMS.getAccessToken()` returns a token (production, where blocks load only after IMS `onReady`), it reads the authenticated `employeeMapping` backend endpoint (camelCase keys: `empLdap`, `managerLdap`, `jobLevel`, `resourceName`, `workdayManager`, `location`, `locationCode`). With no token (localhost / `.aem.page` preview) it falls back to the public da.live `/employee-mapping.json` sheet (Title Case keys: `Emp_LDAP`, `Manager LDAP`, …). `fromApiRow`/`fromSheetRow` normalise both into one internal record shape, so downstream code is source-agnostic. This keeps the full mapping off the public network for real users while preserving `?as=<ldap>` local testing.
- `normalizeLdap(value)` — reduces an LDAP/email to its lowercase local-part so the skill-report API and the mapping join on one key
- `isManager(ldap)` — true iff the LDAP appears as a `managerLdap`/`Manager LDAP` for ≥1 employee
- `getAllEmployeeRecords()` — returns all rows including `jobLevel` (`"30"` → `"P30"`) and `location`

### `blocks/header`

Global Adobe header: brand/logo, actions area (view toggle for managers + Logout). Imports `logout`, `getSessionUser` from `auth.js` and `buildViewToggle` from `view-toggle.js`. Uses `.header > nav` (not `.header nav`) so the selector doesn't also match the toggle's nested `nav`.

---

## Authorable Data (da.live)

Content at [da.live/#/vishnuadobe/skillmappingdashboard](https://da.live/#/vishnuadobe/skillmappingdashboard).

| Document/Sheet | Type | Purpose |
|---|---|---|
| `index` | Document | Entry form page |
| `employee-details` | Document | Manager view page. Optional config rows: `levels` (P-level columns) and `locations` (location filter pills) |
| `skill-levels` | Spreadsheet | Experience → proficiency level thresholds |
| `skills` | Spreadsheet | Skill dropdown options for `entry-form` |
| `specializations` | Spreadsheet | Specialization multi-select options (PNA, SPA, Micro frontX, Hybrid Mobile App, iOS Native App, Android Native App, AppBuils) |
| `specializations` (tab: `platforms`) | Spreadsheet tab | Platform multi-select options (EDS, AEM, AJO, AEP, …) — served at `/specializations/platforms.json` |
| `employee-mapping` | Spreadsheet | Manager hierarchy + job level + location. Columns: `Emp_LDAP`, `Resource Name`, `Workday Manager`, `Manager LDAP`, `Job Level`, `Location`, `Location Code` |

### `/skill-levels.json` schema

| level | label | max-months |
|---|---|---|
| 1 | Foundational | 5 |
| 2 | Developing | 10 |
| 3 | Professional | 15 |
| 4 | Expert | 20 |
| 5 | Master | 999 |

### `/employee-mapping.json` notes

Filtering joins the sheet's `Emp_LDAP`/`Manager LDAP` with the skill API's `employeeId`/`email` on the normalised LDAP local-part — they must spell the LDAP identically. Known test rows (`nehalv`, `vdivyeshan`, `kmomin`) are added under `atulb`.

---

## API Reference

**Base URL (staging):**
`https://293924-uiprojectdashboard-stage.adobeio-static.net/api/v1/web/uiprojectdashboard/skillReport`

| Method | Endpoint | Function | Used by |
|---|---|---|---|
| GET | `/skillReport` | `getSkillReport()` | `report-table` |
| GET | `/skillReport/employee/{employeeId}` | `getEmployeeSkillReport(id)` | `entry-form` saved view |
| POST | `/skillReport` | `submitSkillReport()` | `entry-form` |
| DELETE | `/skillReport/employee/{employeeId}/skill/{skillName}` | `deleteSkill()` | `entry-form` delete action |

> Backend **merges/appends** on POST — does not replace the full skill set.

### POST payload shape

```json
{
  "employeeId": "robinvarshn",
  "email": "robinvarshn@adobe.com",
  "name": "Robin Varshney",
  "skills": [
    { "name": "HTML5", "expInMonths": 12, "proficiencyLevel": 1 },
    {
      "name": "TypeScript", "expInMonths": 24, "proficiencyLevel": 3,
      "specialization": "PNA, SPA",
      "platform": "EDS, AEM",
      "certification": { "certificateName": "TypeScript Advanced", "certificateImageUrl": "https://..." }
    }
  ]
}
```

### GET employee response shape

```json
{
  "data": {
    "email": "robinvarshn@adobe.com",
    "employeeId": "robinvarshn",
    "name": "Robin Varshney",
    "skills": [
      { "expInMonths": 12, "name": "HTML5", "proficiencyLevel": 1 },
      {
        "expInMonths": 24, "name": "TypeScript", "proficiencyLevel": 5,
        "specialization": "PNA",
        "platform": "EDS, AEM",
        "certification": {
          "certificateImageUrl": "https://example.com/cert.png",
          "certificateName": "TypeScript Advanced"
        }
      }
    ]
  },
  "metadata": {
    "proficiencyLevels": [
      { "label": "Foundational", "level": 1 },
      { "label": "Developing", "level": 2 },
      { "label": "Professional", "level": 3 },
      { "label": "Expert", "level": 4 },
      { "label": "Master", "level": 5 }
    ]
  }
}
```

> `mapServerSkillToRow()` in `entry-form.js` also accepts the legacy `name`/`imageUrl` cert shape for backward compatibility.

---

## Known Issues / To Do

| Item | Notes |
|---|---|
| ~~Skill names stored lowercase~~ | **Fixed on the backend** — skill names are now preserved as submitted |
| Data reconciliation | LDAP spellings must match between the mapping sheet and the skill backend (e.g. `chethankuma` vs `chethankumar`) or the employee won't surface |
| Auth headers | `requestJson()` sends a bearer token when IMS is present; confirm whether the backend enforces this |
| Replace mock skill catalog | `skill-data.js` is legacy; both blocks already use the live API |
