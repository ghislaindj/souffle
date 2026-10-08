// Souffle — tablatures d'harmonica, hors ligne.

const KEY = 'souffle:data';
const VERSION = 1;

const DEFAULTS = {
  theme: 'auto',      // auto | sombre | clair
  taille: 'M',        // S | M | L
  paroles: true,
  ecranActif: true,
  compact: false,     // structure compacte (s'applique paroles masquées)
  vitesse: 2,         // défilement auto : 1 | 2 | 3
  dernierExport: null,
};

const STATUTS = [
  { id: 'a_apprendre', label: 'À apprendre', pluriel: 'À apprendre' },
  { id: 'en_cours', label: 'En cours', pluriel: 'En cours' },
  { id: 'maitrisee', label: 'Maîtrisée', pluriel: 'Maîtrisées' },
];
const STATUT_IDS = STATUTS.map((s) => s.id);
const SIZES = ['S', 'M', 'L'];
const TAB_PX = { S: 17, M: 20, L: 24 };
const SPEEDS = { 1: 9, 2: 16, 3: 26 }; // px/s à la taille M

const svg = (body, size = 20, extra = '') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;
const SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
const ICON = {
  sun: svg(SUN, 20, 'class="ic-sun"'),
  moon: svg('<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>', 20, 'class="ic-moon"'),
  wake: svg(SUN, 16),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', 18),
  back: svg('<path d="M15 18l-6-6 6-6"/>', 22),
  more: svg('<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>'),
  down: svg('<path d="M12 4v16M6 14l6 6 6-6"/>', 18),
  play: svg('<path d="M8 5l11 7-11 7z" fill="currentColor"/>', 18),
  pause: svg('<path d="M8 5v14M16 5v14"/>', 18, 'stroke-width="3"'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>', 18),
  video: svg('<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M10.5 9.5l4 2.5-4 2.5z"/>', 18),
  listen: svg('<circle cx="12" cy="12" r="9"/><path d="M8 10c3-1 6-.6 8.5.8M8.5 13.2c2.4-.7 4.8-.4 6.8.7M9 16.2c1.8-.5 3.5-.3 5 .5"/>', 18),
  share: svg('<path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 002 2h10a2 2 0 002-2v-5"/>', 18),
  check: svg('<path d="M5 12l5 5L20 7"/>', 18),
  alert: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>', 18),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3"/>'),
};

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const str = (v) => (typeof v === 'string' ? v : '');
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const fold = (s) => String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const clone = (v) => JSON.parse(JSON.stringify(v));
const has = (o, k) => isObj(o) && Object.hasOwn(o, k);

const app = $('#app');
const dlg = $('#dlg');

let data;
let view = null;
let current = null; // chanson ouverte dans le lecteur
const ui = { query: '', filtre: 'tous', listScroll: 0, importText: '', analysis: null };

/* ================= Stockage ================= */

function normalizeSettings(r) {
  const o = { ...DEFAULTS, ...(isObj(r) ? r : {}) };
  if (!['auto', 'sombre', 'clair'].includes(o.theme)) o.theme = 'auto';
  if (!SIZES.includes(o.taille)) o.taille = 'M';
  for (const k of ['paroles', 'ecranActif', 'compact']) o[k] = Boolean(o[k]);
  if (![1, 2, 3].includes(o.vitesse)) o.vitesse = 2;
  return o;
}

function normalizeSong(s) {
  const youtube = (Array.isArray(s.youtube) ? s.youtube : [])
    .map((v) => (typeof v === 'string' ? { titre: '', url: v } : { titre: str(v?.titre), url: str(v?.url) }))
    .filter((v) => v.url);
  const spotify = (Array.isArray(s.spotify) ? s.spotify : [])
    .map((v) => (typeof v === 'string' ? v : str(v?.url)))
    .filter(Boolean);
  return clone({
    id: s.id,
    titre: str(s.titre),
    artiste: str(s.artiste),
    harmonica: str(s.harmonica) || 'C',
    statut: STATUT_IDS.includes(s.statut) ? s.statut : 'a_apprendre',
    phrases: isObj(s.phrases) ? s.phrases : {},
    sections: isObj(s.sections) ? s.sections : {},
    structure: Array.isArray(s.structure) ? s.structure : [],
    paroles: isObj(s.paroles) ? s.paroles : {},
    paroles_phrase: isObj(s.paroles_phrase) ? s.paroles_phrase : {},
    youtube,
    spotify,
    notes: str(s.notes),
  });
}

function normalizeData(obj) {
  return {
    version: VERSION,
    chansons: (Array.isArray(obj?.chansons) ? obj.chansons : [])
      .filter((s) => isObj(s) && typeof s.id === 'string')
      .map(normalizeSong),
    reglages: normalizeSettings(obj?.reglages),
  };
}

function loadStored() {
  let raw;
  try { raw = localStorage.getItem(KEY); } catch { return null; }
  if (!raw) return null;
  try {
    return normalizeData(JSON.parse(raw));
  } catch {
    // Données illisibles : on les met de côté plutôt que de les écraser sans trace.
    try { localStorage.setItem(`${KEY}:corrompu`, raw); } catch { /* rien */ }
    return null;
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    toast("Impossible d'enregistrer sur ce téléphone.");
  }
}

function setSetting(k, v) {
  data.reglages[k] = v;
  save();
}

/* ================= Notation et structure ================= */

const NOTE_RE = /^([+-])(10|[1-9])(['’′]*)(o?)$/;

function parseTokens(tab) {
  return String(tab ?? '').trim().split(/\s+/).filter(Boolean).map((text) => {
    const m = NOTE_RE.exec(text);
    return { text, kind: m ? (m[1] === '-' ? 'draw' : 'blow') : 'other' };
  });
}

const tokenHtml = (t) => `<span class="tok tok-${t.kind}">${esc(t.text)}</span>`;

const isRefrain = (name) => /^(refrain|chorus)/i.test(name);
const sectionName = (name) => name.replace(/[_-]+/g, ' ');

function countOccurrences(structure) {
  const c = {};
  for (const n of structure) c[n] = (c[n] || 0) + 1;
  return c;
}

/** Résumé type « 3 couplets + refrain ». */
function structureSummary(song) {
  const counts = countOccurrences(song.structure);
  return Object.keys(counts).map((n) => {
    const label = sectionName(n).toLowerCase();
    if (counts[n] > 1 && !isRefrain(n)) return `${counts[n]} ${/[sx]$/.test(label) ? label : `${label}s`}`;
    return label;
  }).join(' + ');
}

function lyricFor(song, phraseId, entry, i) {
  const fixed = has(song.paroles_phrase, phraseId) ? song.paroles_phrase[phraseId] : null;
  if (typeof fixed === 'string' && fixed.trim()) return fixed;
  if (Array.isArray(entry)) return typeof entry[i] === 'string' ? entry[i] : null;
  if (typeof entry === 'string') return entry;
  return null;
}

/** Déroule la structure : une entrée par occurrence de section (une seule si compact). */
function expand(song, compact) {
  const totals = countOccurrences(song.structure);
  const seen = {};
  const out = [];
  for (const name of song.structure) {
    const k = seen[name] = (seen[name] ?? -1) + 1;
    if (compact && k > 0) continue;
    let entries = has(song.paroles, name) ? song.paroles[name] : null;
    if (entries != null && !Array.isArray(entries)) entries = [entries];
    const entry = entries && entries.length ? entries[k % entries.length] : null;
    const ids = has(song.sections, name) && Array.isArray(song.sections[name]) ? song.sections[name] : [];
    const numbered = !compact && totals[name] > 1 && !isRefrain(name);
    out.push({
      label: cap(sectionName(name)) + (numbered ? ` ${k + 1}` : ''),
      lines: ids.map((id, i) => ({ id, tab: has(song.phrases, id) ? song.phrases[id] : '', lyric: lyricFor(song, id, entry, i) })),
    });
  }
  return out;
}

function previewTokens(song, n = 8) {
  const out = [];
  for (const name of song.structure) {
    for (const id of has(song.sections, name) ? song.sections[name] : []) {
      for (const t of parseTokens(has(song.phrases, id) ? song.phrases[id] : '')) {
        out.push(t);
        if (out.length > n) return { tokens: out.slice(0, n), more: true };
      }
    }
  }
  return { tokens: out, more: false };
}

/* ================= Thème ================= */

const darkMq = matchMedia('(prefers-color-scheme: dark)');

function effectiveTheme() {
  const t = data.reglages.theme;
  if (t === 'sombre') return 'dark';
  if (t === 'clair') return 'light';
  return darkMq.matches ? 'dark' : 'light';
}

function applyTheme() {
  const t = effectiveTheme();
  document.documentElement.dataset.theme = t;
  const auto = data.reglages.theme === 'auto';
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    const forLight = m.media.includes('light');
    m.content = auto ? (forLight ? '#F6F3EE' : '#121418') : (t === 'dark' ? '#121418' : '#F6F3EE');
  });
}
darkMq.addEventListener('change', () => { if (data.reglages.theme === 'auto') applyTheme(); });

const themeButton = () =>
  `<button type="button" class="icon-btn" data-action="theme" aria-label="Changer de thème (clair ou sombre)">${ICON.sun}${ICON.moon}</button>`;

function applySize() {
  document.documentElement.dataset.size = data.reglages.taille;
}

/* ================= Écran actif ================= */

const wake = { wanted: false, sentinel: null, video: null, armed: false };

async function wakeOn() {
  wake.wanted = true;
  if (document.visibilityState !== 'visible') return;
  if ('wakeLock' in navigator) {
    try {
      if (!wake.sentinel) {
        const s = await navigator.wakeLock.request('screen');
        if (!wake.wanted) { s.release(); return; }
        wake.sentinel = s;
        s.addEventListener('release', () => { if (wake.sentinel === s) wake.sentinel = null; });
      }
      return;
    } catch { /* refusé ou non supporté : on passe au repli vidéo */ }
  }
  startVideoFallback();
}

async function startVideoFallback() {
  if (!wake.video) {
    const v = document.createElement('video');
    v.setAttribute('playsinline', '');
    v.setAttribute('muted', '');
    v.muted = true;
    v.loop = true;
    v.setAttribute('aria-hidden', 'true');
    v.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0.01;pointer-events:none';
    // Blob URL : évite les soucis de requêtes Range servies par le service worker sur iOS.
    try {
      const blob = await (await fetch('assets/nosleep.mp4')).blob();
      v.src = URL.createObjectURL(blob);
    } catch {
      v.src = 'assets/nosleep.mp4';
    }
    document.body.append(v);
    wake.video = v;
  }
  if (!wake.wanted) return;
  wake.video.play().catch(() => armGesture());
}

// iOS exige un geste pour lancer la vidéo : on la démarre au premier toucher.
function armGesture() {
  if (wake.armed) return;
  wake.armed = true;
  window.addEventListener('pointerdown', () => {
    wake.armed = false;
    if (wake.wanted && wake.video) wake.video.play().catch(() => {});
  }, { once: true, capture: true });
}

function wakeOff() {
  wake.wanted = false;
  if (wake.sentinel) { wake.sentinel.release().catch(() => {}); wake.sentinel = null; }
  if (wake.video) wake.video.pause();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (view === 'reader' && data.reglages.ecranActif) wakeOn();
  } else if (auto.playing) {
    asPause();
  }
});

/* ================= Défilement auto ================= */

const auto = { visible: false, playing: false, raf: 0, last: 0, acc: 0 };

function asTick(t) {
  if (!auto.playing) return;
  if (auto.last) {
    const dt = Math.min(0.1, (t - auto.last) / 1000);
    const speed = SPEEDS[data.reglages.vitesse] * (TAB_PX[data.reglages.taille] / 20);
    auto.acc += speed * dt;
    const px = Math.floor(auto.acc);
    if (px >= 1) {
      auto.acc -= px;
      window.scrollBy(0, px);
    }
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (window.scrollY >= max - 1) { asPause(); return; }
  }
  auto.last = t;
  auto.raf = requestAnimationFrame(asTick);
}

function asPlay() {
  if (auto.playing) return;
  auto.playing = true;
  auto.last = 0;
  auto.acc = 0;
  auto.raf = requestAnimationFrame(asTick);
  renderAutoscroll();
}

function asPause() {
  auto.playing = false;
  cancelAnimationFrame(auto.raf);
  renderAutoscroll();
}

function asStop() {
  auto.visible = false;
  asPause();
}

function renderAutoscroll() {
  const el = $('#autoscroll');
  if (!el) return;
  el.hidden = !auto.visible;
  if (!auto.visible) { renderToolbar(); return; }
  const v = data.reglages.vitesse;
  const names = { 1: 'lente', 2: 'moyenne', 3: 'rapide' };
  el.innerHTML = `
    <button type="button" class="as-btn as-play" data-action="as-toggle" aria-label="${auto.playing ? 'Pause' : 'Reprendre le défilement'}">${auto.playing ? ICON.pause : ICON.play}</button>
    <div class="as-speeds" role="group" aria-label="Vitesse">
      ${[1, 2, 3].map((n) => `<button type="button" class="as-speed" data-action="as-speed" data-v="${n}" aria-pressed="${v === n}" aria-label="Vitesse ${names[n]}">${n}</button>`).join('')}
    </div>
    <button type="button" class="as-btn" data-action="as-close" aria-label="Arrêter le défilement">${ICON.close}</button>`;
  renderToolbar();
}

// Pause au toucher sur la partition.
window.addEventListener('pointerdown', (e) => {
  if (view === 'reader' && auto.playing && !e.target.closest('.autoscroll, .r-head, .bottombar, dialog')) asPause();
}, { passive: true });

/* ================= Position de lecture (rotation, tailles) ================= */

let anchor = null;
let anchorRaf = 0;
let frozen = false;
let lastWidth = window.innerWidth;

function headerBottom() {
  const h = $('#rhead');
  return h ? h.getBoundingClientRect().bottom : 0;
}

function captureAnchor() {
  if (view !== 'reader') return;
  const top = headerBottom();
  for (const el of document.querySelectorAll('#sheet .phrase')) {
    const r = el.getBoundingClientRect();
    if (r.bottom > top + 1) {
      anchor = { k: el.dataset.k, off: r.top - top };
      return;
    }
  }
}

function restoreAnchor() {
  if (view !== 'reader' || !anchor) return;
  const el = document.querySelector(`#sheet .phrase[data-k="${anchor.k}"]`);
  if (!el) return;
  const r = el.getBoundingClientRect();
  window.scrollTo(0, window.scrollY + r.top - headerBottom() - anchor.off);
}

window.addEventListener('scroll', () => {
  if (frozen || anchorRaf) return;
  anchorRaf = requestAnimationFrame(() => { anchorRaf = 0; if (!frozen) captureAnchor(); });
}, { passive: true });

// Pendant une rotation, on gèle l'ancre (le navigateur peut défiler tout seul).
const freeze = () => { frozen = true; };
window.addEventListener('orientationchange', freeze);
screen.orientation?.addEventListener?.('change', freeze);

window.addEventListener('resize', () => {
  if (window.innerWidth === lastWidth) return;
  lastWidth = window.innerWidth;
  frozen = true;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    restoreAnchor();
    frozen = false;
  }));
});

/** Re-rend une partie du lecteur sans perdre la phrase en haut de l'écran. */
function keepPosition(fn) {
  captureAnchor();
  frozen = true;
  fn();
  requestAnimationFrame(() => { restoreAnchor(); frozen = false; });
}

/* ================= Vue : liste ================= */

function renderList() {
  view = 'list';
  const songs = data.chansons;
  const keys = [...new Set(songs.map((s) => s.harmonica))].sort();
  const eyebrow = (keys.length ? `${keys.length > 1 ? 'Harmonicas' : 'Harmonica'} ${keys.join(', ')} · ` : '') + plural(songs.length, 'chanson');
  app.innerHTML = `
    <div class="page list">
      <header class="list-head">
        <div class="list-row">
          <div>
            <p class="eyebrow">${esc(eyebrow)}</p>
            <h1 class="brand">Souffle</h1>
          </div>
          <div class="head-actions">
            ${themeButton()}
            <a class="icon-btn" href="#/bibliotheque" aria-label="Bibliothèque : importer, sauvegarder, réglages">${ICON.plus}</a>
          </div>
        </div>
        <label class="search">
          ${ICON.search}
          <span class="sr-only">Rechercher une chanson</span>
          <input id="q" type="search" placeholder="Titre, artiste…" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" value="${esc(ui.query)}">
        </label>
        <div class="chips" id="chips" role="group" aria-label="Filtrer par statut"></div>
      </header>
      <main class="cards" id="cards"></main>
    </div>`;
  renderChips();
  renderCards();
  $('#q').addEventListener('input', (e) => { ui.query = e.target.value; renderCards(); });
}

function renderChips() {
  const counts = {};
  for (const s of data.chansons) counts[s.statut] = (counts[s.statut] || 0) + 1;
  const chips = [{ id: 'tous', label: 'Toutes', n: data.chansons.length },
    ...STATUTS.map((s) => ({ id: s.id, label: s.pluriel, n: counts[s.id] || 0 }))];
  $('#chips').innerHTML = chips.map((c) =>
    `<button type="button" class="chip" data-action="filter" data-v="${c.id}" aria-pressed="${ui.filtre === c.id}">${esc(c.label)} · ${c.n}</button>`).join('');
}

function renderCards() {
  const words = fold(ui.query).split(/\s+/).filter(Boolean);
  const list = data.chansons
    .filter((s) => ui.filtre === 'tous' || s.statut === ui.filtre)
    .filter((s) => { const hay = fold(`${s.titre} ${s.artiste}`); return words.every((w) => hay.includes(w)); })
    .sort((a, b) => a.titre.localeCompare(b.titre, 'fr', { sensitivity: 'base', ignorePunctuation: true }));

  if (!list.length) {
    $('#cards').innerHTML = `<p class="empty">${data.chansons.length ? 'Aucune chanson ne correspond.' : 'Aucune chanson. Ajoute-en depuis la bibliothèque.'}</p>`;
    return;
  }
  $('#cards').innerHTML = list.map((s) => {
    const p = previewTokens(s);
    const statut = STATUTS.find((x) => x.id === s.statut);
    const sub = [s.artiste, structureSummary(s)].filter(Boolean).join(' · ');
    return `
      <a class="card" href="#/chanson/${encodeURIComponent(s.id)}">
        <div class="card-top">
          <div class="card-text">
            <h2 class="card-title">${esc(s.titre)}</h2>
            <p class="card-sub">${esc(sub)}</p>
          </div>
          <span class="key" title="Harmonica ${esc(s.harmonica)}"><span class="sr-only">Harmonica </span>${esc(s.harmonica)}</span>
        </div>
        <div class="preview" aria-hidden="true">${p.tokens.map(tokenHtml).join('')}${p.more ? '<span class="more">…</span>' : ''}</div>
        <p class="status st-${s.statut}"><span class="dot"></span>${esc(statut.label)}</p>
      </a>`;
  }).join('');
}

/* ================= Vue : lecteur ================= */

function renderReader(id) {
  const song = data.chansons.find((s) => s.id === id);
  if (!song) {
    view = 'missing';
    app.innerHTML = `
      <div class="page lib">
        <header class="lib-head"><a class="icon-btn bare" href="#/" aria-label="Retour à la liste">${ICON.back}</a><h1 class="lib-title">Introuvable</h1></header>
        <main class="lib-body"><p>Cette chanson n'existe pas ou a été supprimée.</p></main>
      </div>`;
    return;
  }
  view = 'reader';
  current = song;
  anchor = null;
  const sub = [song.artiste, `harmonica ${song.harmonica}`].filter(Boolean).join(' · ');
  const bar = bottomBar(song);
  app.innerHTML = `
    <div class="page reader">
      <header class="r-head" id="rhead">
        <div class="r-row">
          <a class="icon-btn bare" href="#/" aria-label="Retour à la liste">${ICON.back}</a>
          <div class="r-title">
            <h1>${esc(song.titre)}</h1>
            <p class="r-sub">${esc(sub)}</p>
          </div>
          ${themeButton()}
          <button type="button" class="icon-btn" data-action="song-menu" aria-haspopup="dialog" aria-label="Plus d'options : statut, structure">${ICON.more}</button>
        </div>
        <div class="toolbar" id="toolbar" role="toolbar" aria-label="Réglages du lecteur"></div>
      </header>
      <main class="r-body${bar ? ' has-bar' : ''}" id="sheet"></main>
      <div class="autoscroll" id="autoscroll" hidden></div>
      ${bar}
    </div>`;
  renderToolbar();
  renderSheet();
  if (data.reglages.ecranActif) wakeOn();
}

function renderToolbar() {
  const el = $('#toolbar');
  if (!el) return;
  const r = data.reglages;
  el.innerHTML = `
    <button type="button" class="pill" data-action="lyrics" aria-pressed="${r.paroles}">Paroles</button>
    <button type="button" class="pill" data-action="size">
      <span class="sr-only">Taille du texte</span><span class="aa">A<span>A</span></span> <span class="pill-val">${r.taille}</span>
    </button>
    <button type="button" class="pill pill-wake" data-action="wake" aria-pressed="${r.ecranActif}">${ICON.wake}Écran actif</button>
    <button type="button" class="pill pill-icon" data-action="autoscroll" aria-pressed="${auto.visible}" aria-label="Défilement automatique">${ICON.down}</button>`;
}

function renderSheet() {
  const r = data.reglages;
  const song = current;
  const compact = r.compact && !r.paroles;
  const secs = expand(song, compact);
  const body = secs.map((sec, i) => `
    <section class="sec">
      <h2 class="label">${esc(sec.label)}</h2>
      ${sec.lines.map((ln, j) => `
        <div class="phrase" data-k="${i}-${j}">
          <span class="pid" aria-hidden="true">${esc(ln.id)}</span>
          <div class="tab">${parseTokens(ln.tab).map(tokenHtml).join('')}</div>
          ${r.paroles && ln.lyric ? `<p class="lyr">${esc(ln.lyric)}</p>` : ''}
        </div>`).join('')}
    </section>`).join('');
  $('#sheet').innerHTML = `
    ${compact ? `<p class="compact-note">Structure compacte · à jouer : ${esc(structureSummary(song))}</p>` : ''}
    <div class="secs">${body}</div>
    ${song.notes ? `<aside class="notes"><h2 class="label">Notes</h2><p>${esc(song.notes)}</p></aside>` : ''}`;
}

function safeUrl(u) {
  return /^(https?:\/\/|spotify:)/i.test(u) ? u : '#';
}

function spotifyLabel(u, i) {
  const m = /(track|album|playlist|artist|episode)/.exec(u);
  const kinds = { track: 'Titre', album: 'Album', playlist: 'Playlist', artist: 'Artiste', episode: 'Épisode' };
  return m ? `${kinds[m[1]]} Spotify` : `Lien Spotify ${i + 1}`;
}

function songLinks(song, kind) {
  if (kind === 'youtube') return song.youtube.map((v, i) => ({ label: v.titre || `Vidéo ${i + 1}`, url: v.url }));
  return song.spotify.map((u, i) => ({ label: spotifyLabel(u, i), url: u }));
}

function bottomBar(song) {
  const btn = (kind, label, icon) => {
    const links = songLinks(song, kind);
    if (!links.length) return '';
    if (links.length === 1) {
      return `<a class="bar-btn" href="${esc(safeUrl(links[0].url))}" target="_blank" rel="noopener">${icon}${label}</a>`;
    }
    return `<button type="button" class="bar-btn" data-action="links" data-kind="${kind}" aria-haspopup="dialog">${icon}${label}<span class="count">${links.length}</span></button>`;
  };
  const items = btn('youtube', 'Tuto vidéo', ICON.video) + btn('spotify', 'Écouter', ICON.listen);
  return items ? `<nav class="bottombar" aria-label="Liens externes">${items}</nav>` : '';
}

/* ================= Vue : bibliothèque ================= */

function renderLibrary() {
  view = 'library';
  const r = data.reglages;
  const n = data.chansons.length;
  app.innerHTML = `
    <div class="page lib">
      <header class="lib-head">
        <a class="icon-btn bare" href="#/" aria-label="Retour à la liste">${ICON.back}</a>
        <h1 class="lib-title">Bibliothèque</h1>
      </header>
      <main class="lib-body">
        <section class="block" aria-labelledby="h-add">
          <h2 class="label" id="h-add">Ajouter des chansons</h2>
          <label class="field-label" for="imp">Colle le JSON préparé avec Claude</label>
          <textarea id="imp" rows="5" spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off" placeholder='{ "id": "…", "titre": "…", "phrases": { … } }'>${esc(ui.importText)}</textarea>
          <div id="imp-status" aria-live="polite"></div>
          <div class="btn-row">
            <button type="button" class="btn" data-action="pick-file">Fichier .json</button>
            <button type="button" class="btn btn-primary" id="imp-go" data-action="import" disabled>Importer</button>
          </div>
          <input id="imp-file" class="sr-only" type="file" accept=".json,application/json" tabindex="-1" aria-hidden="true">
        </section>

        <fieldset class="block">
          <legend class="label">Apparence</legend>
          <div class="seg" id="theme-seg">${themeSeg()}</div>
          <p class="hint">Auto suit le réglage de l'iPhone.</p>
        </fieldset>

        <section class="block" aria-labelledby="h-save">
          <h2 class="label" id="h-save">Sauvegarde</h2>
          <p>Tout est stocké sur ce téléphone. Exporte de temps en temps vers iCloud Drive via le menu Partager.</p>
          <button type="button" class="btn" data-action="export" ${n ? '' : 'disabled'}>${ICON.share}Exporter ${n > 1 ? `les ${n} chansons` : n === 1 ? 'la chanson' : ''}</button>
          <p class="hint" id="last-export">${lastExportText()}</p>
        </section>

        <section class="block" aria-labelledby="h-songs">
          <h2 class="label" id="h-songs">Chansons · ${n}</h2>
          ${n ? `<div class="song-rows">${[...data.chansons]
            .sort((a, b) => a.titre.localeCompare(b.titre, 'fr', { sensitivity: 'base', ignorePunctuation: true }))
            .map((s) => `
            <div class="song-row">
              <div class="song-row-text">
                <div class="song-row-title">${esc(s.titre)}</div>
                <div class="song-row-sub">${esc([s.artiste, `harmonica ${s.harmonica}`].filter(Boolean).join(' · '))}</div>
              </div>
              <button type="button" class="icon-btn" data-action="delete" data-id="${esc(s.id)}" aria-label="Supprimer ${esc(s.titre)}">${ICON.trash}</button>
            </div>`).join('')}</div>` : '<p class="hint">Aucune chanson pour le moment.</p>'}
        </section>

        <aside class="tip">
          <div class="tip-title">Nouvelle chanson ?</div>
          <p>Envoie tes captures à Claude dans le projet Perso : il renvoie un JSON prêt à coller ici.</p>
        </aside>

        <p class="version">Souffle · données v${VERSION}</p>
      </main>
    </div>`;

  const ta = $('#imp');
  let timer = 0;
  ta.addEventListener('input', () => {
    ui.importText = ta.value;
    clearTimeout(timer);
    timer = setTimeout(updateImport, 250);
  });
  $('#imp-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      ui.importText = await file.text();
    } catch {
      toast('Lecture du fichier impossible.');
      return;
    }
    ta.value = ui.importText;
    updateImport();
  });
  updateImport();
}

function themeSeg() {
  const t = data.reglages.theme;
  return [['auto', 'Auto'], ['sombre', 'Sombre'], ['clair', 'Clair']].map(([v, l]) =>
    `<button type="button" class="seg-btn" data-action="set-theme" data-v="${v}" aria-pressed="${t === v}">${l}</button>`).join('');
}

function lastExportText() {
  const d = data.reglages.dernierExport;
  if (!d) return 'Jamais exporté.';
  const date = new Date(d);
  return `Dernier export : ${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

/* ================= Import ================= */

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateSong(s) {
  if (!isObj(s)) return ['ce n\'est pas un objet JSON.'];
  const e = [];
  if (typeof s.id !== 'string' || !s.id) e.push('champ « id » manquant.');
  else if (!SLUG_RE.test(s.id)) e.push(`l'id « ${s.id} » doit être un slug (minuscules, chiffres et tirets, ex. « oh-susanna »).`);
  if (typeof s.titre !== 'string' || !s.titre.trim()) e.push('champ « titre » manquant.');
  if (typeof s.harmonica !== 'string' || !s.harmonica.trim()) e.push('champ « harmonica » manquant (tonalité, ex. « C »).');
  if (s.artiste != null && typeof s.artiste !== 'string') e.push('« artiste » doit être un texte.');
  if (s.statut != null && !STATUT_IDS.includes(s.statut)) e.push(`statut « ${s.statut} » inconnu (attendu : ${STATUT_IDS.join(', ')}).`);

  if (!isObj(s.phrases) || !Object.keys(s.phrases).length) e.push('« phrases » doit être un objet non vide, ex. { "A": "+4 -4 +5" }.');
  else for (const [id, tab] of Object.entries(s.phrases)) if (typeof tab !== 'string') e.push(`la phrase « ${id} » doit être un texte.`);

  if (!isObj(s.sections) || !Object.keys(s.sections).length) e.push('« sections » doit être un objet non vide, ex. { "couplet": ["A", "B"] }.');
  else for (const [nom, ids] of Object.entries(s.sections)) {
    if (!Array.isArray(ids)) { e.push(`la section « ${nom} » doit être une liste d'ids de phrases.`); continue; }
    for (const id of ids) if (!has(s.phrases, id)) e.push(`la section « ${nom} » cite la phrase « ${id} », qui n'existe pas.`);
  }

  if (!Array.isArray(s.structure) || !s.structure.length) e.push('« structure » doit être une liste non vide de sections.');
  else for (const nom of s.structure) if (!has(s.sections, nom)) e.push(`la structure cite la section « ${nom} », qui n'existe pas.`);

  if (s.paroles != null) {
    if (!isObj(s.paroles)) e.push('« paroles » doit être un objet { section: [ … ] }.');
    else for (const [nom, v] of Object.entries(s.paroles)) {
      const entries = Array.isArray(v) ? v : [v];
      if (!entries.every((x) => typeof x === 'string' || (Array.isArray(x) && x.every((l) => typeof l === 'string')))) {
        e.push(`les paroles de « ${nom} » doivent être des textes ou des listes de textes.`);
      }
    }
  }
  if (s.paroles_phrase != null && (!isObj(s.paroles_phrase) || !Object.values(s.paroles_phrase).every((v) => typeof v === 'string'))) {
    e.push('« paroles_phrase » doit être un objet { idPhrase: "texte" }.');
  }
  if (s.youtube != null && (!Array.isArray(s.youtube) || !s.youtube.every((v) => typeof v === 'string' || (isObj(v) && typeof v.url === 'string')))) {
    e.push('« youtube » doit être une liste de { titre, url }.');
  }
  if (s.spotify != null && (!Array.isArray(s.spotify) || !s.spotify.every((v) => typeof v === 'string' || (isObj(v) && typeof v.url === 'string')))) {
    e.push('« spotify » doit être une liste d\'URL.');
  }
  if (s.notes != null && typeof s.notes !== 'string') e.push('« notes » doit être un texte.');
  return e;
}

function analyzeImport(text) {
  if (!text.trim()) return null;
  let obj;
  try {
    obj = JSON.parse(text);
  } catch (err) {
    return { errors: [`JSON invalide : ${err.message}`] };
  }
  let list;
  if (Array.isArray(obj)) list = obj;
  else if (isObj(obj) && Array.isArray(obj.chansons)) list = obj.chansons;
  else if (isObj(obj) && ('id' in obj || 'phrases' in obj)) list = [obj];
  else return { errors: ['Format non reconnu : attendu une chanson, une liste de chansons ou un objet { "chansons": [ … ] }.'] };
  if (!list.length) return { errors: ['Aucune chanson dans ce JSON.'] };

  const errors = [];
  const songs = [];
  const ids = new Set();
  list.forEach((s, i) => {
    const who = `Chanson ${i + 1}${isObj(s) && typeof s.titre === 'string' && s.titre ? ` (« ${s.titre} »)` : ''}`;
    const errs = validateSong(s);
    if (!errs.length && ids.has(s.id)) errs.push(`l'id « ${s.id} » apparaît deux fois dans l'import.`);
    if (errs.length) errors.push(...errs.map((m) => `${who} : ${m}`));
    else {
      ids.add(s.id);
      const song = normalizeSong(s);
      // Statut absent de l'import : on garde la progression existante.
      const existing = data.chansons.find((x) => x.id === s.id);
      if (s.statut == null && existing) song.statut = existing.statut;
      songs.push(song);
    }
  });
  if (errors.length) return { errors };

  const items = songs.map((s) => {
    const existing = data.chansons.find((x) => x.id === s.id);
    const state = !existing ? 'nouvelle' : JSON.stringify(existing) === JSON.stringify(s) ? 'identique' : 'maj';
    return { song: s, state };
  });
  return { items };
}

function updateImport() {
  const status = $('#imp-status');
  const go = $('#imp-go');
  if (!status) return;
  const a = ui.analysis = analyzeImport(ui.importText);
  go.disabled = true;
  go.textContent = 'Importer';
  if (!a) { status.innerHTML = ''; return; }
  if (a.errors) {
    const shown = a.errors.slice(0, 6);
    const rest = a.errors.length - shown.length;
    status.innerHTML = `<div class="msg msg-err">${ICON.alert}<div>
      <strong>Import impossible</strong>
      <ul>${shown.map((m) => `<li>${esc(m)}</li>`).join('')}${rest > 0 ? `<li>… et ${rest} autre${rest > 1 ? 's' : ''} problème${rest > 1 ? 's' : ''}.</li>` : ''}</ul>
    </div></div>`;
    return;
  }
  const c = { nouvelle: 0, maj: 0, identique: 0 };
  for (const it of a.items) c[it.state]++;
  const parts = [];
  if (c.nouvelle) parts.push(`${c.nouvelle} nouvelle${c.nouvelle > 1 ? 's' : ''}`);
  if (c.maj) parts.push(`${c.maj} mise${c.maj > 1 ? 's' : ''} à jour`);
  if (c.identique) parts.push(`${c.identique} identique${c.identique > 1 ? 's' : ''}`);
  const tags = { nouvelle: 'nouvelle', maj: 'mise à jour', identique: 'identique' };
  status.innerHTML = `<div class="msg msg-ok">${ICON.check}<div>
    <strong>${plural(a.items.length, 'chanson')} reconnue${a.items.length > 1 ? 's' : ''}</strong> · ${parts.join(', ')}
    <ul>${a.items.map((it) => `<li>${esc(it.song.titre)} <span class="tag">(${tags[it.state]})</span></li>`).join('')}</ul>
    ${c.nouvelle + c.maj === 0 ? '<div>Rien à importer : la bibliothèque est déjà à jour.</div>' : ''}
  </div></div>`;
  const n = c.nouvelle + c.maj;
  go.disabled = n === 0;
  if (n) go.textContent = `Importer (${n})`;
}

async function doImport() {
  const a = ui.analysis;
  if (!a?.items) return;
  const todo = a.items.filter((it) => it.state !== 'identique');
  if (!todo.length) return;
  const updates = todo.filter((it) => it.state === 'maj');
  if (updates.length) {
    const names = updates.map((it) => `« ${it.song.titre} »`).join(', ');
    const ok = await confirmBox(
      updates.length > 1 ? `Écraser ${updates.length} chansons ?` : 'Écraser cette chanson ?',
      `${names} ${updates.length > 1 ? 'seront remplacées' : 'sera remplacée'} par la version importée.`,
      'Écraser', true);
    if (!ok) return;
  }
  for (const { song } of todo) {
    const i = data.chansons.findIndex((x) => x.id === song.id);
    if (i >= 0) data.chansons[i] = song; else data.chansons.push(song);
  }
  save();
  ui.importText = '';
  ui.analysis = null;
  renderLibrary();
  toast(`${plural(todo.length, 'chanson')} importée${todo.length > 1 ? 's' : ''}.`);
}

/* ================= Export ================= */

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function doExport() {
  const json = JSON.stringify({ version: VERSION, chansons: data.chansons }, null, 2);
  const name = `souffle-${today()}.json`;
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      markExported();
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
      // autre échec : on bascule sur le téléchargement
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  markExported();
}

function markExported() {
  setSetting('dernierExport', new Date().toISOString());
  const el = $('#last-export');
  if (el) el.textContent = lastExportText();
  toast('Export prêt.');
}

/* ================= Feuilles et messages ================= */

function openSheet(inner) {
  dlg.innerHTML = `<div class="sheet-in">${inner}<form method="dialog"><button class="btn btn-block" value="cancel">Fermer</button></form></div>`;
  dlg.returnValue = '';
  dlg.showModal();
}

function confirmBox(title, text, okLabel, danger) {
  return new Promise((resolve) => {
    dlg.innerHTML = `<div class="sheet-in">
      <h2 class="sheet-title">${esc(title)}</h2>
      ${text ? `<p class="sheet-text">${esc(text)}</p>` : ''}
      <form method="dialog" class="sheet-actions">
        <button class="btn" value="cancel">Annuler</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" value="ok">${esc(okLabel)}</button>
      </form></div>`;
    dlg.returnValue = '';
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
    dlg.showModal();
  });
}

// Toucher le fond ferme la feuille.
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close('cancel'); });

let toastTimer = 0;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function songMenuHtml() {
  const s = current;
  const r = data.reglages;
  return `
    <h2 class="sheet-title">${esc(s.titre)}</h2>
    <fieldset class="sheet-field">
      <legend class="label">Statut</legend>
      <div class="seg">${STATUTS.map((st) =>
        `<button type="button" class="seg-btn" data-action="set-status" data-v="${st.id}" aria-pressed="${s.statut === st.id}">${st.label}</button>`).join('')}</div>
    </fieldset>
    <div class="switch-row">
      <div>
        <div id="compact-lbl">Structure compacte</div>
        <p class="hint">Chaque section une seule fois. Masque les paroles.</p>
      </div>
      <button type="button" class="switch" role="switch" aria-labelledby="compact-lbl" aria-checked="${r.compact && !r.paroles}" data-action="compact"></button>
    </div>`;
}

/* ================= Actions ================= */

const actions = {
  theme() {
    setSetting('theme', effectiveTheme() === 'dark' ? 'clair' : 'sombre');
    applyTheme();
  },
  filter(el) {
    ui.filtre = el.dataset.v;
    renderChips();
    renderCards();
  },
  lyrics() {
    keepPosition(() => {
      const on = !data.reglages.paroles;
      setSetting('paroles', on);
      if (on) setSetting('compact', false);
      renderToolbar();
      renderSheet();
    });
  },
  size() {
    keepPosition(() => {
      const r = data.reglages;
      setSetting('taille', SIZES[(SIZES.indexOf(r.taille) + 1) % SIZES.length]);
      applySize();
      renderToolbar();
    });
  },
  wake() {
    const on = !data.reglages.ecranActif;
    setSetting('ecranActif', on);
    if (on) wakeOn(); else wakeOff();
    renderToolbar();
    toast(on ? "L'écran restera allumé." : "L'écran peut se mettre en veille.");
  },
  autoscroll() {
    if (auto.visible) asStop();
    else { auto.visible = true; asPlay(); }
  },
  'as-toggle'() {
    if (auto.playing) asPause(); else asPlay();
  },
  'as-speed'(el) {
    setSetting('vitesse', Number(el.dataset.v));
    renderAutoscroll();
  },
  'as-close'() { asStop(); },
  'song-menu'() {
    openSheet(songMenuHtml());
  },
  'set-status'(el) {
    current.statut = el.dataset.v;
    save();
    dlg.querySelectorAll('[data-action="set-status"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === current.statut)));
  },
  compact(el) {
    const r = data.reglages;
    const on = !(r.compact && !r.paroles);
    setSetting('compact', on);
    if (on) setSetting('paroles', false);
    el.setAttribute('aria-checked', String(on));
    renderToolbar();
    renderSheet();
    window.scrollTo(0, 0);
  },
  links(el) {
    const kind = el.dataset.kind;
    const links = songLinks(current, kind);
    openSheet(`
      <h2 class="sheet-title">${kind === 'youtube' ? 'Tuto vidéo' : 'Écouter'}</h2>
      <div class="sheet-list">${links.map((l) => {
        let host = '';
        try { host = new URL(l.url).host.replace(/^www\./, ''); } catch { /* lien spotify: */ }
        return `<a class="sheet-item" href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener" data-action="close-sheet">${esc(l.label)}${host ? `<small>${esc(host)}</small>` : ''}</a>`;
      }).join('')}</div>`);
  },
  'close-sheet'() { dlg.close(); },
  'set-theme'(el) {
    setSetting('theme', el.dataset.v);
    applyTheme();
    $('#theme-seg').innerHTML = themeSeg();
  },
  'pick-file'() { $('#imp-file').click(); },
  import() { doImport(); },
  export() { doExport(); },
  async delete(el) {
    const s = data.chansons.find((x) => x.id === el.dataset.id);
    if (!s) return;
    const ok = await confirmBox(`Supprimer « ${s.titre} » ?`,
      'Elle sera retirée de ce téléphone. Exporte avant si tu veux la garder.', 'Supprimer', true);
    if (!ok) return;
    data.chansons = data.chansons.filter((x) => x.id !== s.id);
    save();
    renderLibrary();
    updateImport();
    toast('Chanson supprimée.');
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (fn) fn(el, e);
});

/* ================= Routage ================= */

function route() {
  if (view === 'list') ui.listScroll = window.scrollY;
  if (view === 'reader') { asStop(); wakeOff(); }
  if (dlg.open) dlg.close();
  current = null;

  const h = location.hash;
  const m = /^#\/chanson\/(.+)$/.exec(h);
  if (m) {
    renderReader(decodeURIComponent(m[1]));
    window.scrollTo(0, 0);
  } else if (h === '#/bibliotheque') {
    renderLibrary();
    window.scrollTo(0, 0);
  } else {
    renderList();
    window.scrollTo(0, ui.listScroll);
  }
}

/* ================= Démarrage ================= */

async function init() {
  data = loadStored();
  if (!data) {
    try {
      const res = await fetch('seed-songs.json');
      data = normalizeData(await res.json());
    } catch {
      data = normalizeData({});
    }
    save();
  }
  applyTheme();
  applySize();
  window.addEventListener('hashchange', route);
  route();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  navigator.storage?.persist?.().catch(() => {});
}

init();
