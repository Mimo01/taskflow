// Shared renderer for sketches 003–005 (release detail page). Placeholder data only. Today = Fri 30 Oct 2026.
const TODAY = '2026-10-30';

const P = {
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  calx: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M10 14l4 4M14 14l-4 4"/>',
  pkg: '<path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12"/>',
  milestone: '<path d="M12 13v8M12 3v3"/><path d="M4 6a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h13a2 2 0 0 0 1.15-.37l3.43-2.31a1 1 0 0 0 0-1.64l-3.43-2.31A2 2 0 0 0 17 6z"/>',
  branch: '<path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  merge: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/>',
  tag: '<path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1"/>',
  sigma: '<path d="M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6a2 2 0 0 1 0 2.4l-4.5 6a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  pencil: '<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/>',
  ext: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  back: '<path d="m12 19-7-7 7-7M19 12H5"/>',
  story: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  bug: '<path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6zM12 20v-9M9 7V6a3 3 0 0 1 6 0v1M6 13H2M22 13h-4M3 21c0-2.1 1.7-3.9 3.8-4M21 21c0-2.1-1.7-3.9-3.8-4M3 5c0 2 1.6 3.8 3.5 4M21 5c0 2-1.6 3.8-3.5 4"/>',
  task: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/>',
  impr: '<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65M22 12.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  trend: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/>',
  list: '<path d="M3 12h.01M3 18h.01M3 6h.01M8 12h13M8 18h13M8 6h13"/>',
};
const ic = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24">${P[n]}</svg>`;
const TYPE_ICON = { Story: 'story', Bug: 'bug', Task: 'task', Improvement: 'impr' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, '&#39;');
const tipAttr = (title, rows) => `data-tip='${esc(JSON.stringify({ title, rows: rows.slice(0, 4) }))}'`;
const SEG = { d: 'var(--done)', p: 'var(--progress)', n: 'var(--muted-foreground)' };
const segRows = (o) => [
  { l: 'Done', v: o.d, c: SEG.d },
  { l: 'In Progress', v: o.p, c: SEG.p },
  { l: 'To Do', v: o.n, c: SEG.n },
];

// ---------- dates ----------
const D = (s) => new Date(`${s}T00:00:00Z`);
const days = (a, b) => Math.round((D(b) - D(a)) / 864e5);
const addDays = (s, n) => new Date(D(s).getTime() + n * 864e5).toISOString().slice(0, 10);
const fmtD = (s) => D(s).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).replace(',', '');
const fmtShort = (s) => D(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });

// ---------- base data ----------
function baseRelease() {
  return {
    name: 'Standard 03.11.2026 - Statement export',
    date: '2026-11-03',
    released: false,
    next: true,
    pkg: { short: 'WEEK45 RM-14', full: 'WEEK45 (02.11.2026 - 08.11.2026) STANDARD' },
    desc: 'Statement export for business accounts (PDF and CSV), the new fee breakdown in the statement header, and the fixes agreed in the October incident review. Deployment window Tue 03 Nov 18:00–20:00; migration 0412 must run before the API pods roll out. Rollback steps are in the RM ticket.',
    msDesc: null,
    prev: { name: 'Standard 20.10.2026 - Card limits', date: '2026-10-20' },
    gitlab: true,
    loading: false,
    issues: {
      d: 15, p: 4, n: 5,
      statuses: { d: [['Done', 11], ['Ready for release', 2], ['Closed', 2]], p: [['In Review', 2], ['In Progress', 2]], n: [['To Do', 3], ['Open', 2]] },
    },
    sp: { total: 61, done: 38 },
    types: [
      { t: 'Story', d: 7, p: 2, n: 3, sp: 34 },
      { t: 'Bug', d: 5, p: 1, n: 1, sp: 13 },
      { t: 'Task', d: 2, p: 1, n: 1, sp: 11 },
      { t: 'Improvement', d: 1, p: 0, n: 0, sp: 3 },
    ],
    people: [
      { nm: 'Martin Kováč', i: 'MK', d: 5, p: 1, n: 0, sp: 18 },
      { nm: 'Jana Nováková', i: 'JN', d: 4, p: 1, n: 1, sp: 15 },
      { nm: 'Andrej Polák', i: 'AP', d: 3, p: 0, n: 1, sp: 11 },
      { nm: 'Lucia Benková', i: 'LB', d: 2, p: 1, n: 0, sp: 8 },
      { nm: 'Tomáš Sloboda', i: 'TS', d: 1, p: 1, n: 0, sp: 5 },
      { nm: 'Unassigned', i: '', d: 0, p: 0, n: 3, sp: 4 },
    ],
    mrs: { merged: 17, opened: 4, draft: 1, closed: 2 },
    // daily series from the previous version's date up to today
    series: {
      scope: [18, 19, 19, 21, 21, 21, 22, 23, 23, 24, 24],
      done: [0, 1, 2, 4, 4, 4, 6, 8, 11, 13, 15],
      spDone: [0, 3, 5, 10, 10, 10, 16, 21, 28, 33, 38],
    },
    facts: {
      milestone: { kind: 'exact', name: 'Standard 03.11.2026' },
      branch: { kind: 'exists', name: 'release/03.11.2026' },
      mergeBack: { kind: 'hidden' },
      labels: { kind: 'missing', missing: 2, total: 24, mrs: [['!412', 'Fix fee rounding in statement header'], ['!418', 'Bump pdf-renderer to 4.2']] },
    },
    labels: [['backend', 11, '#1f75cb'], ['frontend', 9, '#6699cc'], ['needs-qa', 4, '#ed9121'], ['database', 2, '#8e44ad'], ['hotfix-candidate', 1, '#dc143c']],
    mismatches: [
      { key: 'TF-1832', sum: 'Fee breakdown in the statement header', st: 'No package', why: 'Fix version 03 Nov · no Deployment package', fix: 'Set WEEK45 RM-14' },
      { key: 'TF-1840', sum: 'CSV export: column order follows the PDF', st: 'Mismatch', why: 'Package WEEK46 RM-15 · fix version 03 Nov', fix: 'Move to RM-14' },
    ],
    tasks: [
      ['story', 'TF-1801', 'Statement export: PDF layout for business accounts', 'MK', 'Martin Kováč', ['t-green', 'Done'], ['!401', 'm'], 1, 1],
      ['story', 'TF-1806', 'Statement export: CSV download', 'JN', 'Jana Nováková', ['t-green', 'Ready for release'], ['!405', 'm'], 1, 1],
      ['bug', 'TF-1811', 'Rounding error in fee totals over 10 000', 'AP', 'Andrej Polák', ['t-green', 'Done'], ['!412', 'm'], 1, 1],
      ['story', 'TF-1832', 'Fee breakdown in the statement header', 'MK', 'Martin Kováč', ['t-blue', 'In Review'], ['!421', 'o'], 1, 1],
      ['task', 'TF-1835', 'Migration 0412: statement_fee columns', 'LB', 'Lucia Benková', ['t-blue', 'In Progress'], ['!423', 'd'], 1, 0],
      ['story', 'TF-1840', 'CSV export: column order follows the PDF', 'TS', 'Tomáš Sloboda', ['t-blue', 'In Progress'], ['—', ''], 0, 0],
      ['bug', 'TF-1844', 'Statement date shows UTC instead of local time', 'JN', 'Jana Nováková', ['t-muted', 'To Do'], ['—', ''], 0, 0],
      ['task', 'TF-1847', 'Update statement export runbook', '', 'Unassigned', ['t-muted', 'Open'], ['—', ''], 0, 0],
    ],
  };
}

// ---------- pill ----------
function pillOf(r) {
  if (r.released) return ['t-green', 'Released'];
  if (!r.date) return ['t-amber', 'No date'];
  const n = days(TODAY, r.date);
  if (n < 0) return ['t-red', 'Overdue'];
  if (n === 0) return ['t-blue', 'Due today'];
  return ['t-muted', n === 1 ? 'Tomorrow' : `In ${n} days`];
}

// ---------- facts (milestone / branch / merged back / MR labels / story points) ----------
function factList(r) {
  const f = r.facts;
  const out = [];
  if (r.gitlab) {
    const m = f.milestone;
    if (m.kind === 'exact') out.push({ icon: 'milestone', k: 'Milestone', v: m.name, link: true, tip: tipAttr('Milestone', [{ l: 'Exact match', v: m.name }, { l: 'Opens in GitLab', v: '↗' }]) });
    else if (m.kind === 'fuzzy') out.push({ icon: 'milestone', k: 'Milestone', v: m.name, link: true, fuzzy: true, tone: 'warn', tip: tipAttr('Fuzzy match', [{ l: 'Candidate', v: m.name }, { l: 'Version', v: r.name.slice(0, 22) + '…' }]) });
    else out.push({ icon: 'milestone', k: 'Milestone', v: r.date ? 'Missing' : 'Set a release date first', tone: r.date ? 'warn' : '', action: r.date ? 'Create milestone' : null });
    const b = f.branch;
    if (b.kind === 'exists') out.push({ icon: 'branch', k: 'Branch', v: b.name, mono: true, tone: 'ok', tip: tipAttr('Release branch', [{ l: 'Exists', v: b.name }]) });
    else if (b.kind === 'missing') out.push({ icon: 'branch', k: 'Branch', v: 'Missing', tone: 'warn', action: 'Create branch' });
    else if (b.kind === 'blocked') out.push({ icon: 'branch', k: 'Branch', v: 'Create the milestone first' });
    else if (b.kind === 'check-failed') out.push({ icon: 'branch', k: 'Branch', v: "Couldn't check", tone: 'warn', action: 'Retry', actionIcon: 'refresh' });
    else if (b.kind === 'released') out.push({ icon: 'branch', k: 'Branch', v: `Released · ${b.tag}`, tip: tipAttr('Release branch', [{ l: 'Branch', v: `${b.name} deleted` }, { l: 'Tagged', v: b.tag }]) });
    const mb = f.mergeBack;
    if (mb.kind === 'merged') out.push({ icon: 'merge', k: 'Merged back', v: `into ${mb.into} · ${mb.on}`, tone: 'ok', tip: tipAttr('Merged back', [{ l: 'Via', v: mb.via }, { l: 'Merged', v: mb.on }]) });
    else if (mb.kind === 'likely-not') out.push({ icon: 'merge', k: 'Merged back', v: `Likely not into ${mb.into}`, tone: 'warn', tip: tipAttr('Likely not merged back', [{ l: mb.tag, v: `${mb.commits} commits not in ${mb.into}` }]) });
    else if (mb.kind === 'unverified') out.push({ icon: 'merge', k: 'Merged back', v: "Couldn't verify", tip: tipAttr("Couldn't verify", [{ l: 'No tracking MR and no tag', v: '' }]) });
    const l = f.labels;
    if (l.kind === 'missing') out.push({ icon: 'tag', k: 'MR labels', v: `${l.missing}/${l.total} missing`, tone: 'warn', tip: tipAttr(`${l.missing} MRs without a label`, l.mrs.map(([k, t]) => ({ l: t, v: k }))) });
    else if (l.kind === 'all') out.push({ icon: 'tag', k: 'MR labels', v: `All ${l.total} labeled`, tone: 'ok' });
  }
  if (r.sp) out.push({ icon: 'sigma', k: 'Story points', v: `${r.sp.total} SP`, tip: tipAttr('Story points', [{ l: 'Done', v: r.sp.done, c: SEG.d }, { l: 'Total', v: r.sp.total }]) });
  return out;
}

function factInline(f, iconOnly) {
  const tone = f.tone ? ` ${f.tone}` : f.tone === '' ? '' : '';
  const label = iconOnly ? '' : `<span>${f.k}</span>`;
  const val = `<b class="${f.mono ? 'mono' : ''}${f.fuzzy ? ' fz' : ''}">${f.v}</b>`;
  const tip = f.tip || (iconOnly ? tipAttr(f.k, [{ l: f.v, v: '' }]) : '');
  const act = f.action ? `<button class="btn xs">${ic(f.actionIcon || 'plus', 's3')}${f.action}</button>` : '';
  return `<span class="stat${tone}${f.link ? ' link' : ''}" ${tip}>${ic(f.icon)}${label}${val}${act}</span>`;
}
function factChip(f) {
  const act = f.action ? `<button class="btn xs" style="margin-right:-5px">${ic(f.actionIcon || 'plus', 's3')}${f.action}</button>` : '';
  return `<span class="fchip ${f.tone || ''}" ${f.tip || ''}>${ic(f.icon)}<span class="k">${f.k}</span><span class="v ${f.mono ? 'mono' : ''}">${f.v}</span>${f.link ? ic('ext', 's3') : ''}${act}</span>`;
}

// ---------- header ----------
function crumbs(r) {
  return `<div class="crumbs"><button class="back" aria-label="Go back">${ic('back', 's4')}</button><span class="muted">Releases</span><span class="muted">/</span><span class="nowrap" style="font-weight:500">${r.name}</span></div>`;
}
function header(r, o) {
  const [pc, pl] = pillOf(r);
  const facts = factList(r);
  const date = r.date ? `<span class="stat fg">${ic('calendar')}<b>${fmtD(r.date)}</b></span>` : `<span class="stat warn">${ic('calx')}<b>No release date</b></span>`;
  const pkg = r.pkg ? `<span class="stat" ${tipAttr('RM package', [{ l: r.pkg.full, v: '' }])}>${ic('pkg')}<b>${r.pkg.short}</b></span>` : '';
  const inline = o.facts === 'inline' || o.facts === 'icons';
  const sum = `<div class="summary"><span class="pill ${pc}">${pl}</span>${date}${pkg}${inline ? `<span class="sep-dot"></span>${facts.map((f) => factInline(f, o.facts === 'icons')).join('')}` : ''}</div>`;
  const descs = [r.desc && ['', r.desc], r.msDesc && ['Milestone', r.msDesc]].filter(Boolean);
  const desc = descs.length ? `<div class="desc"><span class="txt">${descs.map(([s, t]) => `${s ? `<span class="src">${s}</span>` : ''}${t}`).join(' ')}</span>${descs.map((x) => x[1]).join(' ').length > 160 ? `<button class="more" onclick="this.parentNode.classList.toggle('open');this.textContent=this.parentNode.classList.contains('open')?'less':'more'">more</button>` : ''}</div>` : '';
  const row = o.facts === 'row' ? `<div class="facts-row">${facts.map(factChip).join('')}</div>` : '';
  return `<header class="hdr"><div class="left"><h1>${r.name}</h1>${sum}${row}${desc}</div>
    <div class="actions"><span>Updated 2 min ago</span><button class="textbtn">${ic('refresh', 's3')}Refresh</button>
    <span style="width:4px"></span><button class="btn" title="Pin">${ic('pin')}<span class="lbl">Pin</span></button><button class="btn" title="Edit">${ic('pencil')}<span class="lbl">Edit</span></button><button class="btn" title="Open in Jira">${ic('ext')}<span class="lbl">Open in Jira</span></button></div></header>`;
}
function doneBar(r, cls = 'wide') {
  const i = r.issues;
  if (r.loading) return `<div class="bar ${cls} sk" style="background:var(--muted)"></div>`;
  if (!i) return `<div class="bar ${cls}"></div>`;
  const t = i.d + i.p + i.n;
  const rows = [
    { l: 'Done', v: i.d, c: SEG.d },
    { l: 'In Progress', v: i.p, c: SEG.p },
    { l: 'To Do', v: i.n, c: SEG.n },
    { l: 'Statuses', v: [...i.statuses.d, ...i.statuses.p, ...i.statuses.n].map(([s, n]) => `${s} ${n}`).slice(0, 3).join(' · ') + ' …' },
  ];
  return `<div class="bar ${cls}" ${tipAttr(`${i.d} of ${t} done`, rows)}><div class="d" style="width:${(i.d / t) * 100}%"></div><div class="p" style="width:${(i.p / t) * 100}%"></div></div>`;
}
function doneFig(r) {
  if (r.loading) return `<span class="f"><span class="sk" style="display:inline-block;width:70px;height:12px"></span></span>`;
  if (!r.issues) return `<span class="f">No issues</span>`;
  const i = r.issues;
  return `<span class="f"><b>${i.d}</b> / ${i.d + i.p + i.n} done</span>`;
}

// ---------- burnup ----------
function burnupHTML(r, tall) {
  return `<div class="burnup${tall ? ' tall' : ''}" data-burnup="1"></div>`;
}
function drawBurnups(root, store) {
  root.querySelectorAll('[data-burnup]').forEach((el) => {
    const r = store;
    const W = el.clientWidth, H = el.clientHeight;
    if (!W) return;
    if (r.loading) { el.innerHTML = `<div class="sk" style="position:absolute;inset:0 0 22px 28px"></div>`; return; }
    if (!r.issues) { el.innerHTML = `<div class="empty" style="height:100%">No issues</div>`; return; }
    const s = r.series;
    if (!s || s.done.length < 2) { el.innerHTML = `<div class="empty" style="height:100%">Not enough history yet — the burnup starts after the first day</div>`; return; }
    const start = r.prev ? r.prev.date : s.start;
    const end = r.date && !r.released && days(TODAY, r.date) >= 0 ? r.date : r.released ? r.date : TODAY;
    const span = days(start, end);
    const L = 28, R = 10, T = 16, B = 22;
    const iw = W - L - R, ih = H - T - B;
    const maxY = Math.ceil((Math.max(...s.scope) * 1.1) / 5) * 5;
    const step = maxY <= 20 ? 5 : 10;
    const x = (i) => L + (i / span) * iw;
    const y = (v) => T + ih - (v / maxY) * ih;
    const n = s.done.length;
    const path = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    let g = '';
    for (let v = 0; v <= maxY; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--border)" stroke-dasharray="${v ? '2 3' : ''}"/><text class="ax" x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end">${v}</text>`;
    // ticks on Mondays + start/end
    for (let i = 0; i <= span; i++) {
      const dd = addDays(start, i);
      const dow = D(dd).getUTCDay();
      if (i === 0 || i === span || (dow === 1 && i > 1 && span - i > 1)) g += `<text class="ax" x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === span ? 'end' : 'middle'}">${fmtShort(dd)}</text>`;
    }
    const area = `${path(s.done)}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`;
    g += `<path d="${area}" fill="var(--done)" opacity=".12"/>`;
    g += `<path d="${path(s.scope)}" fill="none" stroke="var(--muted-foreground)" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    g += `<path d="${path(s.done)}" fill="none" stroke="var(--done)" stroke-width="2"/>`;
    g += `<circle cx="${x(n - 1)}" cy="${y(s.done[n - 1])}" r="3" fill="var(--done)"/>`;
    const flip = x(n - 1) > W - R - 64;
    const lx = x(n - 1) + (flip ? -6 : 6), an = flip ? 'end' : 'start';
    g += `<text class="ax" x="${lx}" y="${y(s.scope[n - 1]) - 6}" text-anchor="${an}" style="fill:var(--foreground)">${s.scope[n - 1]} scope</text>`;
    g += `<text class="ax" x="${lx}" y="${y(s.done[n - 1]) + (flip ? 14 : 4)}" text-anchor="${an}" style="fill:var(--done)">${s.done[n - 1]} done</text>`;
    const ti = days(start, TODAY);
    if (!r.released && ti <= span) g += `<line x1="${x(ti)}" x2="${x(ti)}" y1="${T - 6}" y2="${T + ih}" stroke="var(--foreground)" stroke-width="1" opacity=".55"/><text class="mk" x="${x(ti)}" y="${T - 9}" text-anchor="${ti === span ? 'end' : 'middle'}" style="fill:var(--foreground)">Today</text>`;
    if (r.date) {
      const ri = days(start, r.date);
      if (ri <= span && ri !== ti) g += `<line x1="${x(ri)}" x2="${x(ri)}" y1="${T - 6}" y2="${T + ih}" stroke="var(--muted-foreground)" stroke-dasharray="3 3"/><text class="mk" x="${x(ri)}" y="${T - 9}" text-anchor="end">Release</text>`;
    }
    el.innerHTML = `<svg width="${W}" height="${H}">${g}</svg><div class="guide"></div>`;
    const guide = el.querySelector('.guide');
    el.onmousemove = (e) => {
      const bx = e.clientX - el.getBoundingClientRect().left;
      const i = Math.round(((bx - L) / iw) * span);
      if (i < 0 || i >= n) { guide.style.display = 'none'; hideTip(); return; }
      guide.style.display = 'block'; guide.style.left = `${x(i)}px`; guide.style.top = `${T}px`;
      showTip(e, { title: fmtD(addDays(start, i)), rows: [{ l: 'Scope', v: s.scope[i], c: 'var(--muted-foreground)' }, { l: 'Done', v: s.done[i], c: SEG.d }, { l: 'Story points done', v: s.spDone[i] }] });
    };
    el.onmouseleave = () => { guide.style.display = 'none'; hideTip(); };
  });
}

// ---------- MR donut ----------
function donut(r, size = 112) {
  if (!r.gitlab) return null;
  if (r.loadingMrs || r.loading) return `<div class="donut-wrap"><div class="sk" style="width:${size}px;height:${size}px;border-radius:50%"></div><div class="donut-side">${'<span class="sk" style="width:80px;height:10px;margin:4px 0"></span>'.repeat(3)}</div></div>`;
  const m = r.mrs;
  const tot = m ? m.merged + m.opened + m.draft + m.closed : 0;
  if (!tot) return `<div class="empty" style="height:${size}px">No MRs in this milestone</div>`;
  const sl = [['Merged', m.merged, 'var(--done)'], ['Open', m.opened, 'var(--progress)'], ['Draft', m.draft, 'rgb(59 130 246 / .4)'], ['Closed', m.closed, 'var(--muted-foreground)']].filter((s) => s[1]);
  const R = size * 0.48, ri = size * 0.36, c = size / 2;
  let a0 = -Math.PI / 2, arcs = '';
  const gap = sl.length > 1 ? 0.02 : 0;
  sl.forEach(([l, v, col]) => {
    const a1 = a0 + (v / tot) * Math.PI * 2;
    const s0 = a0 + gap / 2, s1 = a1 - gap / 2;
    const big = s1 - s0 > Math.PI ? 1 : 0;
    const p = (rad, a) => `${(c + rad * Math.cos(a)).toFixed(2)},${(c + rad * Math.sin(a)).toFixed(2)}`;
    const d = sl.length === 1 ? `M${c},${c - R}A${R},${R} 0 1 1 ${c - 0.01},${c - R}L${c - 0.01},${c - ri}A${ri},${ri} 0 1 0 ${c},${c - ri}Z` : `M${p(R, s0)}A${R},${R} 0 ${big} 1 ${p(R, s1)}L${p(ri, s1)}A${ri},${ri} 0 ${big} 0 ${p(ri, s0)}Z`;
    arcs += `<path d="${d}" fill="${col}" ${tipAttr(l, [{ l: 'MRs', v, c: col }, { l: 'Share', v: `${Math.round((v / tot) * 100)}%` }])}/>`;
    a0 = a1;
  });
  const side = sl.map(([l, v, col]) => `<span class="r"><span class="sw" style="background:${col}"></span><b>${v}</b>${l.toLowerCase()}</span>`).join('');
  return `<div class="donut-wrap"><div style="position:relative;width:${size}px;height:${size}px;flex:none"><svg width="${size}" height="${size}">${arcs}</svg><div class="center"><b>${tot}</b><span>MRs</span></div></div><div class="donut-side">${side}</div></div>`;
}

// ---------- issues by assignee ----------
function assignees(r, max = 6) {
  if (r.loading) return `<div class="arows">${'<div class="arow"><span class="sk" style="width:22px;height:22px;border-radius:50%"></span><span class="sk" style="height:10px;width:80%"></span><span class="sk" style="height:6px"></span><span class="sk" style="height:10px"></span></div>'.repeat(5)}</div>`;
  if (!r.issues) return `<div class="empty" style="height:150px">No issues</div>`;
  return `<div class="arows">${r.people.slice(0, max).map((a) => {
    const t = a.d + a.p + a.n;
    return `<div class="arow" ${tipAttr(a.nm, [...segRows(a), { l: 'Story points', v: a.sp }])}><span class="av ${a.i ? '' : 'none'}">${a.i}</span><span class="nm ${a.i ? '' : 'muted'}">${a.nm}</span><div class="bar"><div class="d" style="width:${(a.d / t) * 100}%"></div><div class="p" style="width:${(a.p / t) * 100}%"></div></div><span class="fg">${a.d}/${t}</span></div>`;
  }).join('')}</div>`;
}

// ---------- issues by type: three forms ----------
function typeColumns(r) {
  if (r.loading) return `<div class="tcols">${[70, 45, 30, 15].map((h) => `<div class="tcol"><div class="sk" style="width:40px;height:${h}%"></div><span class="sk" style="width:44px;height:10px"></span></div>`).join('')}</div>`;
  if (!r.issues) return `<div class="empty" style="height:150px">No issues</div>`;
  const max = Math.max(...r.types.map((t) => t.d + t.p + t.n));
  return `<div class="tcols">${r.types.map((t) => {
    const tot = t.d + t.p + t.n;
    const h = Math.max(6, Math.round((tot / max) * 92));
    return `<div class="tcol" ${tipAttr(t.t, [...segRows(t), { l: 'Story points', v: t.sp }])}><span class="top">${t.d}/${tot}</span><div class="stack" style="height:${h}px"><div class="d" style="height:${(t.d / tot) * 100}%"></div><div class="p" style="height:${(t.p / tot) * 100}%"></div></div><span class="lab">${ic(TYPE_ICON[t.t])}${t.t}</span></div>`;
  }).join('')}</div>`;
}
function typeWaffle(r) {
  if (r.loading) return `<div class="waffle">${[12, 7, 4, 1].map((n) => `<div class="wrow"><span class="sk" style="height:10px;width:80px"></span><div class="cells">${'<i class="sk"></i>'.repeat(n)}</div></div>`).join('')}</div>`;
  if (!r.issues) return `<div class="empty" style="height:120px">No issues</div>`;
  return `<div class="waffle">${r.types.map((t) => {
    const tot = t.d + t.p + t.n;
    const cells = '<i class="d"></i>'.repeat(t.d) + '<i class="p"></i>'.repeat(t.p) + '<i></i>'.repeat(t.n);
    return `<div class="wrow" ${tipAttr(t.t, [...segRows(t), { l: 'Story points', v: t.sp }])}><span class="lab">${ic(TYPE_ICON[t.t])}${t.t}<span class="c">${t.d}/${tot}</span></span><div class="cells">${cells}</div></div>`;
  }).join('')}</div>`;
}
function typeTiles(r) {
  if (r.loading) return `<div class="ttiles">${'<div class="ttile"><span class="sk" style="height:10px;width:60%"></span><span class="sk" style="height:18px;width:40%"></span><span class="sk" style="height:4px"></span></div>'.repeat(4)}</div>`;
  if (!r.issues) return `<div class="empty" style="height:120px">No issues</div>`;
  return `<div class="ttiles">${r.types.map((t) => {
    const tot = t.d + t.p + t.n;
    return `<div class="ttile" ${tipAttr(t.t, [...segRows(t), { l: 'Story points', v: t.sp }])}><span class="top">${ic(TYPE_ICON[t.t])}${t.t}</span><span class="big">${t.d}<span> / ${tot} done</span></span><div class="bar thin"><div class="d" style="width:${(t.d / tot) * 100}%"></div><div class="p" style="width:${(t.p / tot) * 100}%"></div></div></div>`;
  }).join('')}</div>`;
}
const TYPE_FORMS = { columns: typeColumns, waffle: typeWaffle, tiles: typeTiles };

// ---------- labels / mismatches / table ----------
function labelsSec(r) {
  if (!r.gitlab || !r.labels || !r.labels.length) return '';
  return `<section class="sec"><h3>${ic('tag')}Labels</h3><div class="labels">${r.labels.map(([n, c, col]) => `<span class="glabel" style="background:${col};color:#fff;border-color:${col}80">${n} (${c})</span>`).join('')}</div></section>`;
}
function mismatchSec(r) {
  if (!r.mismatches || !r.mismatches.length) return '';
  return `<section class="sec"><h3>${ic('alert')}Deployment package mismatches <span class="n">${r.mismatches.length}</span></h3><div class="mm">${r.mismatches.map((m) => `<div class="r"><div class="l1"><span class="key">${m.key}</span><span class="sum">${m.sum}</span><span class="st">${m.st}</span></div><div class="why">${m.why}<button class="btn xs">${m.fix}</button></div></div>`).join('')}</div></section>`;
}
function table(r) {
  const rows = r.loading ? Array.from({ length: 6 }, () => `<div class="tr"><span class="c-ic"><span class="sk" style="width:14px;height:14px"></span></span><span class="c-key"><span class="sk" style="display:block;height:10px;width:60px"></span></span><span class="c-sum"><span class="sk" style="display:block;height:10px;width:70%"></span></span><span class="c-per"><span class="sk" style="width:20px;height:20px;border-radius:50%"></span></span><span class="c-st"><span class="sk" style="height:18px;width:88px"></span></span><span class="c-mr"></span><span class="c-x"></span><span class="c-x"></span></div>`).join('')
    : !r.issues ? `<div class="empty" style="height:64px;margin-top:8px">No issues in this fix version</div>`
    : r.tasks.map(([t, k, s, i, nm, [pc, pl], [mr, ms], br, mst]) => {
      const mrc = ms === 'm' ? 'ok-c' : ms === 'o' ? '' : 'muted';
      return `<div class="tr"><span class="c-ic">${ic(t)}</span><span class="c-key">${k}</span><span class="c-sum">${s}</span><span class="c-per"><span class="av ${i ? '' : 'none'}" style="width:20px;height:20px">${i}</span><span class="pn ${i ? '' : 'muted'}">${nm}</span></span><span class="c-st"><span class="pill ${pc}">${pl}</span></span><span class="c-mr ${mrc}">${mr === '—' ? '<span class="muted">—</span>' : `${ic('merge', 's3')}${mr}${ms === 'd' ? ' <span class="muted" style="font-family:var(--font-sans)">draft</span>' : ''}`}</span><span class="c-x ${br ? 'ok-c' : 'muted'}">${br ? '✓' : '—'}</span><span class="c-x ${mst ? 'ok-c' : 'muted'}">${mst ? '✓' : '—'}</span></div>`;
    }).join('');
  const head = `<div class="th"><span class="c-ic"></span><span class="c-key">Key</span><span class="c-sum">Summary</span><span class="c-per"><span>Assignee</span></span><span class="c-st">Status</span><span class="c-mr">MR</span><span class="c-x" title="Target branch matches release branch">BR</span><span class="c-x" title="Release milestone assigned">MS</span></div>`;
  return `<section class="sec"><h3>${ic('list')}Tasks <span class="n">${r.issues ? r.issues.d + r.issues.p + r.issues.n : ''}</span><span class="aside">Column header sticks while the page scrolls</span></h3><div class="tt">${head}${rows}</div></section>`;
}

const h3 = (icon, t, aside = '') => `<h3>${ic(icon)}${t}${aside ? `<span class="aside">${aside}</span>` : ''}</h3>`;
const burnAside = (r) => (r.prev ? `since ${r.prev.name.split(' - ')[0]} · ${fmtShort(r.prev.date)}` : '');

// ---------- layouts ----------
const LAYOUTS = {
  // A: burnup leads full width, then assignee · type columns · MR donut; labels + mismatches side by side; table
  a(r, o) {
    const dn = donut(r);
    return `${header(r, o)}<div class="donefig">${doneBar(r)}${doneFig(r)}</div>
    <div class="body">
      <section class="sec">${h3('trend', 'Progress', burnAside(r))}${burnupHTML(r)}</section>
      <div class="${dn ? 'g-a' : 'g-2'}">
        <section class="sec">${h3('users', 'By assignee')}${assignees(r)}</section>
        <section class="sec">${h3('layers', 'By type')}${(TYPE_FORMS[o.type] || typeColumns)(r)}</section>
        ${dn ? `<section class="sec s-donut">${h3('merge', 'Merge requests')}${dn}</section>` : ''}
      </div>
      ${labelsSec(r) || mismatchSec(r) ? `<div class="g-2">${labelsSec(r) || '<div></div>'}${mismatchSec(r)}</div>` : ''}
      ${table(r)}
    </div>`;
  },
  // B: graphs as a 2×2 grid on the left, labels + mismatches in a quiet right column; facts as their own chip row
  b(r, o) {
    const dn = donut(r, 104);
    const side = labelsSec(r) + mismatchSec(r);
    return `${header(r, o)}<div class="donefig">${doneBar(r)}${doneFig(r)}</div>
    <div class="body">
      <div class="g-b${side ? '' : ' solo'}">
        <div class="quad">
          <section class="sec${dn ? '' : ' span2'}">${h3('trend', 'Progress', burnAside(r))}${burnupHTML(r)}</section>
          ${dn ? `<section class="sec s-donut">${h3('merge', 'Merge requests')}${dn}</section>` : ''}
          <section class="sec s-people">${h3('users', 'By assignee')}${assignees(r)}</section>
          <section class="sec s-type">${h3('layers', 'By type')}${(TYPE_FORMS[o.type] || typeWaffle)(r)}</section>
        </div>
        ${side ? `<div class="vr" style="display:flex;flex-direction:column;gap:24px">${side}</div>` : ''}
      </div>
      ${table(r)}
    </div>`;
  },
  // C: F5 next-release card treatment — rocket card holds the done bar + burnup; donut · assignee · type tiles below
  c(r, o) {
    const dn = donut(r, 104);
    const [, pl] = pillOf(r);
    const kicker = r.released ? 'Released' : r.next ? 'Next release' : r.date && days(TODAY, r.date) < 0 ? 'Overdue release' : 'Planned release';
    return `${header(r, o)}
    <div class="body">
      <div class="rcard"><svg class="ico rocket" viewBox="0 0 24 24">${P.rocket}</svg>
        <div class="kicker">${ic('rocket', 's3')}${kicker} · ${pl.toLowerCase()}</div>
        <div class="barline">${doneBar(r)}${doneFig(r).replace('class="f"', 'class="f"')}</div>
        <div>${burnupHTML(r, true)}</div>
      </div>
      <div class="g-c">
        ${dn ? `<section class="sec s-donut">${h3('merge', 'Merge requests')}${dn}</section>` : '<div></div>'}
        <section class="sec">${h3('users', 'By assignee')}${assignees(r)}</section>
        <section class="sec">${h3('layers', 'By type')}${(TYPE_FORMS[o.type] || typeTiles)(r)}</section>
      </div>
      ${labelsSec(r) || mismatchSec(r) ? `<div class="g-2">${labelsSec(r) || '<div></div>'}${mismatchSec(r)}</div>` : ''}
      ${table(r)}
    </div>`;
  },
};

function renderPage(el, r, o) {
  el.innerHTML = `<div class="app-page">${crumbs(r)}<div class="scroll"><div class="inner">${o.note ? `<div class="note">${o.note}</div>` : ''}${LAYOUTS[o.layout](r, o)}</div></div></div>`;
  el._r = r;
  requestAnimationFrame(() => drawBurnups(el, r));
}
function redrawAll() {
  document.querySelectorAll('[data-page]').forEach((el) => el._r && el.offsetParent && drawBurnups(el, el._r));
}

// ---------- tooltip ----------
const tip = () => document.getElementById('tip');
function showTip(e, d) {
  const t = tip();
  t.innerHTML = `<div class="tt-t">${d.title}</div>${d.rows.map((r) => `<div class="tt-r">${r.c ? `<span class="sw" style="background:${r.c}"></span>` : ''}<span class="l">${r.l}</span>${r.v !== '' ? `<span class="v">${r.v}</span>` : ''}</div>`).join('')}`;
  t.style.display = 'block';
  const w = t.offsetWidth, h = t.offsetHeight;
  let x = e.clientX + 14, y = e.clientY + 14;
  if (x + w > innerWidth - 8) x = e.clientX - w - 14;
  if (y + h > innerHeight - 8) y = e.clientY - h - 14;
  t.style.left = `${x}px`; t.style.top = `${y}px`;
}
function hideTip() { tip().style.display = 'none'; }
document.addEventListener('mousemove', (e) => {
  if (e.target.closest('[data-burnup]')) return;
  const el = e.target.closest('[data-tip]');
  if (!el) return hideTip();
  showTip(e, JSON.parse(el.getAttribute('data-tip')));
});

// ---------- sketch chrome ----------
function initChrome(onSwitch) {
  document.querySelectorAll('.variant-tab').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.variant-tab').forEach((x) => x.classList.toggle('active', x === b));
    onSwitch(b.dataset.v);
  }));
  document.getElementById('t-theme').onclick = () => {
    const root = document.documentElement;
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  };
  document.querySelectorAll('[data-w]').forEach((b) => (b.onclick = () => {
    document.getElementById('frame').style.maxWidth = `${b.dataset.w}px`;
    setTimeout(redrawAll, 250);
  }));
  document.getElementById('t-annot').onclick = () => document.body.classList.toggle('notes');
  let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(redrawAll, 100); });
}
