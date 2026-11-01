// Galaxy home. UI mode: the numbers sit on top of the live galaxy, the ten most recent unlocks replay one by one
// (each flashes its star, the card is wired to it), and the panels below come from the published community
// snapshot. Explore mode: the content steps aside and the galaxy's names come out (hold, fly in).
import { createGalaxy } from './galaxy.js';
import { CATS, catIcon, BANDS, bandOf, kelvin } from './stars.js';
import { get, loadPack, showLoadFailure } from './pack.js';

const $ = id => document.getElementById(id);
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = t => String(t ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const num = n => Number(n).toLocaleString('en');
const pct = n => (n * 100 >= 10 ? Math.round(n * 100) : (n * 100).toFixed(1)) + '%';
const rel = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const ago = d => { const s = (d - Date.now()) / 1000, A = Math.abs(s); for (const [u, n] of [['year', 31536e3], ['month', 2592e3], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]]) if (A >= n) return rel.format(Math.round(s / n), u); return 'just now'; };
const href = name => `profile.html?u=${encodeURIComponent(name)}`;
const hexOf = earned => '#' + kelvin(BANDS[bandOf(earned)].K).getHexString();
const catColor = cat => CATS[cat]?.[1] || '#9aa3b8', catLabel = cat => CATS[cat]?.[0] || cat;
let me = ''; try { me = localStorage.getItem('cosmic.me') || ''; } catch (e) {}

// ---- data -----------------------------------------------------------------------------------------
let pack;
try { pack = await loadPack(); } // stars, ranks and earner counts, all derived from community.json + achievements.json
catch (e) { $('find-msg').textContent = 'Couldn’t load the pack right now. Try again in a moment.'; showLoadFailure(); throw e; }
const sky = pack.rows, meta = pack.meta, defs = pack.defs;
const skyBy = new Map(sky.map(r => [r[0].toLowerCase(), r]));
const canon = name => skyBy.get(String(name || '').trim().replace(/^@/, '').toLowerCase())?.[0] || null;

// ---- galaxy ---------------------------------------------------------------------------------------
const galaxy = createGalaxy({ gl: $('gl'), overlay: $('ov'), flash: $('flash'), rows: sky, onDive: () => document.body.classList.add('diving') });
addEventListener('pageshow', e => { if (e.persisted) document.body.classList.remove('diving'); });
window.__galaxy = galaxy; // handy in the console
$('names').innerHTML = sky.map(r => `<option value="${esc(r[0])}"></option>`).join('');
const fly = name => { const n = canon(name); if (!n) return false; if (galaxy) galaxy.punch(n); else location.href = href(n); return true; };
if (!galaxy) { document.body.classList.add('nogl'); $('to-explore').hidden = true; } // no WebGL: a still sky, names link straight to profiles
// any player name on the page flies into their star (modifier / middle clicks still open a tab as usual)
document.addEventListener('click', e => {
  const a = e.target.closest('a.who'); if (!a || !galaxy || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const name = new URL(a.href, location.href).searchParams.get('u'); if (!name) return;
  e.preventDefault(); $('gl').style.filter = ''; fly(name);
});

// ---- hero numbers ---------------------------------------------------------------------------------
const total = meta.total_achievements || defs.size, found = defs.size;
function countUp(el, to, ms = 1400) {
  if (still) { el.textContent = num(to); return; }
  const t0 = performance.now(), f = now => { const k = Math.min(1, (now - t0) / ms), e = 1 - (1 - k) ** 3; el.textContent = num(Math.round(to * e)); if (k < 1) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}
countUp($('t-found'), found); $('t-total').textContent = num(total); countUp($('t-hidden'), total - found, 1100);
countUp($('s-stars'), sky.length); countUp($('s-players'), meta.total_users || 0, 1700);
$('g-pct').textContent = pct(total ? found / total : 0);
if (!found) { // debut day: nothing discovered yet
  document.querySelector('.kicker').textContent = "TheDogVT's pack · debut";
  $('hero-title').innerHTML = 'The galaxy is<br>waiting to <em>ignite.</em>';
  document.querySelector('.lede').textContent = `${num(sky.length)} stars are still embers. Earn an achievement on stream and yours lights up first.`;
  document.querySelector('.hidden-line').textContent = `All ${num(total)} are out there. Nobody has found one yet.`;
}
requestAnimationFrame(() => { $('gauge').querySelector('.g-fill').setAttribute('stroke-dasharray', `${2 * Math.PI * 44 * found / total} 999`); });
$('gauge').setAttribute('aria-label', `${found} of ${total} achievements discovered`);

// ---- find my star -----------------------------------------------------------------------------------
$('find').addEventListener('submit', e => {
  e.preventDefault();
  const q = $('find-q').value.trim(); if (!q) { $('find-q').focus(); return; }
  if (!fly(q)) $('find-msg').textContent = `No star called “${q}” yet. Chat on stream and earn your first achievement to light one up.`;
});
$('find-q').addEventListener('input', () => { $('find-msg').textContent = ''; });
if (me && canon(me)) {
  const w = $('welcome'); w.hidden = false; w.innerHTML = `<span class="sdot" style="--c:${hexOf(skyBy.get(me.toLowerCase())[1])}"></span> Welcome back, ${esc(canon(me))}`;
  w.href = href(canon(me)); w.addEventListener('click', e => { e.preventDefault(); fly(me); });
  const nav = $('nav-me'); nav.querySelector('i').style.setProperty('--c', hexOf(skyBy.get(me.toLowerCase())[1]));
}
if (location.hash === '#find') setTimeout(() => $('find-q').focus(), 300);
document.querySelectorAll('a[href="#find"]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); setMode('ui'); scrollTo({ top: 0 }); setTimeout(() => $('find-q').focus(), 350); }));

// ---- modes ----------------------------------------------------------------------------------------
let hintTimer = 0;
function setMode(m) {
  const ex = m === 'explore';
  document.body.classList.toggle('explore', ex); document.body.classList.toggle('ui', !ex);
  galaxy?.setMode(m);
  if (ex) { galaxy?.pin(null); scrollTo({ top: 0, behavior: 'auto' }); $('hint').classList.add('show'); clearTimeout(hintTimer); hintTimer = setTimeout(() => $('hint').classList.remove('show'), 6500); }
  else { $('found-card').hidden = true; $('types-pop').hidden = true; $('types-btn').setAttribute('aria-expanded', 'false'); galaxy?.find(null); }
  const url = new URL(location.href); url.searchParams.delete('focus');
  if (ex) url.searchParams.set('explore', '1'); else url.searchParams.delete('explore');
  history.replaceState(null, '', url);
  if (!ex) replay.wake();
}
$('to-explore').addEventListener('click', () => setMode('explore'));
$('to-ui').addEventListener('click', () => setMode('ui'));
function showFound(name) {
  const g = galaxy?.find(name);
  if (!g) { $('find2-q').value = ''; $('find2-q').placeholder = 'No star by that name yet'; $('found-card').hidden = true; return; }
  $('fc-name').textContent = g.name; $('fc-dot').style.setProperty('--c', g.quasar ? '#ffffff' : g.color);
  $('fc-tab').textContent = g.quasar ? 'The quasar' : g.runaway ? 'Legendary runaway' : `${g.band.name} star`;
  $('fc-line').innerHTML = `#${g.rank} of ${num(g.of)} · ${num(g.earned)} achievement${g.earned === 1 ? '' : 's'}${g.next ? `<br>${g.next.more} more to burn ${g.next.band.name}` : ''}`;
  $('found-card').hidden = false; $('fc-fly').onclick = () => galaxy.punch(g.name);
}
$('find2').addEventListener('submit', e => { e.preventDefault(); showFound($('find2-q').value); });
$('types-btn').addEventListener('click', () => { const open = $('types-pop').hidden; $('types-pop').hidden = !open; $('types-btn').setAttribute('aria-expanded', String(open)); });

// star types (UI panel and the explore picker share one list)
const counts = BANDS.map(B => ({ ...B, n: 0 })); sky.forEach(r => { counts[bandOf(r[1])].n++; });
const topStar = sky.slice().sort((a, b) => b[1] - a[1])[0], quasarName = topStar && topStar[1] > 0 ? topStar[0] : null;
const nRunaway = sky.filter(r => r[2] === 2 && r[0] !== quasarName).length;
const typeRows = counts.map((B, i) => ({ key: B.key, name: B.name, range: B.range === '0' ? 'no achievements yet' : `${B.range} achievements`, c: '#' + kelvin(B.K).getHexString(), g: 4 + i * 3, n: B.n }))
  .concat([{ key: 'runaway', name: 'Legendary runaway', range: 'Legendary Legacy', c: '#9fdcff', g: 10, n: nRunaway, ring: true, sep: true }, { key: 'quasar', name: 'The quasar', range: 'most achievements', c: '#ffffff', g: 18, n: quasarName ? 1 : 0 }]);
const typeLi = t => `<li data-k="${t.key}"${t.sep ? ' class="sep"' : ''}><span class="orb${t.ring ? ' ring' : ''}" style="--c:${t.c};--g:${t.g}"></span><span><b>${t.name}</b><small>${t.range}</small></span><span class="n">${num(t.n)}</span></li>`;
$('type-list').innerHTML = typeRows.map(typeLi).join('');
$('type-pick').innerHTML = typeRows.map(typeLi).join('');
$('type-pick').addEventListener('click', e => { const li = e.target.closest('li'); if (!li || !galaxy) return; const on = galaxy.solo(li.dataset.k); $('type-pick').querySelectorAll('li').forEach(x => x.classList.toggle('on', x.dataset.k === on)); });
$('type-list').addEventListener('click', e => { const li = e.target.closest('li'); if (!li || !galaxy) return; setMode('explore'); if (galaxy.solo(li.dataset.k) !== li.dataset.k) galaxy.solo(li.dataset.k); $('type-pick').querySelectorAll('li').forEach(x => x.classList.toggle('on', x.dataset.k === li.dataset.k)); $('types-pop').hidden = false; });

// brightest stars + the quasar race
{
  const top = sky.slice().sort((a, b) => b[1] - a[1]);
  const [q, s] = top;
  if (!q || !(q[1] > 0)) { $('race').innerHTML = '<p class="sub">Nobody has earned an achievement yet. The first one to do it becomes the quasar at the heart of the galaxy.</p>'; }
  else if (!s) { $('race').innerHTML = `<div class="side"><span class="lbl">The quasar</span><a class="nm who" href="${href(q[0])}">${esc(q[0])}</a><span class="ct">${q[1]}</span></div><div class="gap"><span>nobody<br>chasing yet</span></div><div></div>`; }
  else $('race').innerHTML = `<div class="side"><span class="lbl">The quasar</span><a class="nm who" href="${href(q[0])}">${esc(q[0])}</a><span class="ct">${q[1]}</span></div>
    <div class="gap"><b>${q[1] - s[1]}</b><span>achievement${q[1] - s[1] === 1 ? '' : 's'}<br>between them</span></div>
    <div class="side r"><span class="lbl">#2 · chasing</span><a class="nm who" href="${href(s[0])}">${esc(s[0])}</a><span class="ct">${s[1]}</span></div>`;
  $('board').innerHTML = top.slice(2, 10).filter(r => r[1] > 0).map((r, i) => `<li><span class="rk">${i + 3}</span><span class="nm"><span class="sdot" style="--c:${hexOf(r[1])}"></span><a class="who" href="${href(r[0])}">${esc(r[0])}</a>${r[2] === 2 ? '<span class="chip" style="border-color:#9fdcff;color:#9fdcff">Legendary</span>' : ''}</span><span class="ct">${r[1]}<small>ach.</small></span></li>`).join('');
}

// ---- the replay ------------------------------------------------------------------------------------
const replay = (() => {
  let list = [], i = 0, timer = 0, hover = false, heroSeen = true;
  const card = $('replay'), body = $('r-body');
  new IntersectionObserver(([e]) => { heroSeen = e.isIntersecting; if (heroSeen) wake(); }, { threshold: .15 }).observe(document.querySelector('.hero'));
  card.addEventListener('pointerenter', () => { hover = true; }); card.addEventListener('pointerleave', () => { hover = false; });
  body.addEventListener('click', () => { const ev = list[i]; if (ev) fly(ev.name); });
  const live = () => !hover && heroSeen && !document.hidden && document.body.classList.contains('ui');
  function render(k) {
    const ev = list[k], d = ev.def, star = skyBy.get(ev.name.toLowerCase());
    $('r-tab').textContent = k === list.length - 1 ? 'Latest unlock' : 'Just unlocked';
    $('r-ico').style.setProperty('--c', catColor(d.cat)); $('r-ico').innerHTML = catIcon(d.cat);
    $('r-name').textContent = d.name;
    $('r-who').innerHTML = `<span class="sdot" style="--c:${star ? hexOf(star[1]) : '#cfe9ff'}"></span><strong>${esc(ev.name)}</strong><span>· ${esc(ago(ev.at))}</span>`;
    $('r-chips').innerHTML = [ev.founder && '<span class="chip gold">✦ First in the pack</span>', ev.born && '<span class="chip new">A new star is born</span>',
      d.plat && '<span class="chip" style="border-color:#9fe8ff;color:#cfeeff">Platinum</span>', ev.share <= .05 ? `<span class="chip rare">Only ${pct(ev.share)} have it</span>` : `<span class="chip">${pct(ev.share)} have it</span>`].filter(Boolean).join('');
    $('r-dots').innerHTML = list.map((_, n) => `<i class="${n === k ? 'on' : ''}"></i>`).join('');
    body.title = `Fly to ${ev.name}'s star`;
    if (document.body.classList.contains('ui')) { galaxy?.flash(ev.name, ev.founder); galaxy?.pin(ev.name, card); } // the wire belongs to the UI view only
  }
  function show(k) {
    if (still) { render(k); return; }
    body.classList.add('swap'); setTimeout(() => { render(k); body.classList.remove('swap'); }, 260);
  }
  function step() {
    clearTimeout(timer);
    if (!live()) { timer = setTimeout(step, 900); return; }
    i = (i + 1) % list.length; show(i);
    timer = setTimeout(step, i === list.length - 1 ? 9000 : 4200); // hold on the newest a little longer
  }
  function wake() { if (list.length && document.body.classList.contains('ui')) galaxy?.pin(list[i].name, card); }
  return {
    start(events) {
      list = events; if (!list.length) { $('r-name').textContent = 'The first unlock will light up this sky.'; return; }
      i = still ? list.length - 1 : 0; render(i);
      if (!still) timer = setTimeout(step, 4200);
    },
    wake,
  };
})();

// ---- everything that needs the community snapshot ---------------------------------------------------
(async () => {
  let users;
  users = pack.users;
  const N = Object.keys(users).length, events = [], earners = new Map(), firstAt = new Map();
  for (const [uid, u] of Object.entries(users)) {
    const earned = u.achievements?.earned || {}, fnd = u.achievements?.founded || {};
    for (const [id, at] of Object.entries({ ...earned, ...fnd })) {
      const def = defs.get(id), d = new Date(at); if (!def || isNaN(d)) continue;
      events.push({ uid, name: u.username, id, def, at: d, founder: Object.hasOwn(fnd, id) });
      earners.set(id, (earners.get(id) || 0) + 1);
      if (!firstAt.has(uid) || d < firstAt.get(uid)) firstAt.set(uid, d);
    }
  }
  for (const ev of events) { ev.share = (earners.get(ev.id) || 1) / N; ev.born = +ev.at === +firstAt.get(ev.uid); }
  events.sort((a, b) => b.at - a.at || a.name.localeCompare(b.name));
  const firsts = events.filter(e => e.founder);
  countUp($('s-unlocks'), events.length, 1600); countUp($('s-firsts'), firsts.length, 1500);
  if (events[0]) $('snap').textContent = `Pack snapshot · ${events[0].at.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  replay.start(events.slice(0, 10).reverse());

  const row = (ev, showFounder) => `<li class="${ev.founder && showFounder ? 'f' : ''}" style="--rare:${ev.share <= .02 ? '#ffe1a0' : ev.share <= .06 ? '#c9a2ff' : 'var(--aur)'}">
    <span class="ico" style="--c:${catColor(ev.def.cat)}">${catIcon(ev.def.cat)}</span>
    <span class="txt"><b>${esc(ev.def.name)}</b><span class="by"><a class="who" href="${href(ev.name)}">${esc(ev.name)}</a> · ${esc(catLabel(ev.def.cat))}${ev.founder && showFounder ? ' · ✦ first' : ''}</span></span>
    <span class="r"><em>${pct(ev.share)}</em>${esc(ago(ev.at))}</span></li>`;
  $('feed').innerHTML = events.slice(0, 9).map(ev => row(ev, true)).join('');
  $('firsts').innerHTML = firsts.slice(0, 7).map(ev => row(ev, false)).join('');

  // top of the pack: highest lifetime (cumulative) milestone in each category; ties go to whoever got there first
  const SUP = [['cheer', 'Bits', a => `${num(a)} bits`], ['donation', 'Donations', a => `$${num(a)}`], ['gifted', 'Gifted subs', a => `${num(a)} gifted`]];
  $('podiums').innerHTML = SUP.map(([cat, label, fmt]) => {
    const best = new Map();
    for (const ev of events) {
      const a = Number(ev.def.amount); if (ev.def.cat !== cat || ev.def.type !== 'cumulative' || !(a > 0)) continue;
      const b = best.get(ev.uid); if (!b || a > b.a || (a === b.a && ev.at < b.at)) best.set(ev.uid, { name: ev.name, a, at: ev.at, def: ev.def });
    }
    const top = [...best.values()].sort((x, y) => y.a - x.a || x.at - y.at).slice(0, 3);
    const step = (r, k) => r ? `<div class="step s${k}"><span class="medal" style="--m:${['#ffe1a0', '#d9e0f2', '#d08a4a'][k - 1]}">${k}</span><a class="who" href="${href(r.name)}">${esc(r.name)}</a><span class="amt">${fmt(r.a)}</span>${k === 1 ? `<span class="ms">${esc(r.def.name)}</span>` : ''}</div>` : '<div></div>';
    return `<div class="panel podium"><span class="tab">${label}</span>
      ${top.length ? `<div class="steps">${step(top[1], 2)}${step(top[0], 1)}${step(top[2], 3)}</div>` : '<p class="empty">No milestones yet. Be the first.</p>'}</div>`;
  }).join('');
  fitNames();
})();

// long names shrink to fit their podium step on one line (down to 10px, then ellipsis; full name in the tooltip)
function fitNames() {
  document.querySelectorAll('.step a').forEach(a => { a.title = a.textContent; let size = parseFloat(getComputedStyle(a).fontSize); while (a.scrollWidth > a.clientWidth + 1 && size > 10) { size -= .5; a.style.fontSize = size + 'px'; } });
}
addEventListener('resize', () => { document.querySelectorAll('.step a').forEach(a => { a.style.fontSize = ''; }); fitNames(); });

// ---- decorations teaser: your own name tag if we know you, otherwise the quasar's --------------------
(() => {
  const who = canon(me) || quasarName; if (!who) return; // nobody to show yet
  if (canon(me)) $('teaser-cta').href = `builder.html?user=${encodeURIComponent(who)}`;
  const css = ['static/css/builder/card/name/core.css', 'static/css/builder/card/name/animations.css', 'static/css/builder/card/name/effects.css',
    'https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Audiowide&family=Bangers&family=Caveat:wght@500;600;700&family=Cinzel+Decorative:wght@400;700&family=Cormorant+Garamond:wght@400;600;700&family=Grenze+Gotisch:wght@400;700&family=Lobster&family=Luckiest+Guy&family=Metamorphous&family=Orbitron:wght@400;700&family=Pacifico&family=Permanent+Marker&family=Playfair+Display:wght@400;700&family=Press+Start+2P&family=Rubik+Glitch&family=VT323&family=Rye&family=Satisfy&family=Shadows+Into+Light&family=Special+Elite&family=Uncial+Antiqua&display=swap',
    'https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700&family=Bubblegum+Sans&family=Chewy&family=Comfortaa:wght@400;500;600;700&family=DynaPuff:wght@400;500;600;700&family=Fredoka:wght@400;500;600;700&family=Mochiy+Pop+One&family=Nunito:wght@400;600;700;800&family=Quicksand:wght@400;500;600;700&family=Varela+Round&display=swap',
    'https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Black+Ops+One&family=Bowlby+One+SC&family=Bungee+Spice&family=Faster+One&family=Iceland&family=Kanit:ital,wght@0,400;0,700;1,400;1,700&family=Michroma&family=Rubik+Burned&family=Sigmar+One&family=Teko:wght@400;600;700&family=Titan+One&family=Tourney:wght@400;700&family=Wallpoet&family=WindSong:wght@400;500&display=swap'];
  const js = ['effects_manifest.js', 'particle_engine.js', 'translate-core.js', 'translate-glow.js', 'translate-effects.js', 'name.js'].map(f => 'static/js/builder/card/' + (f === 'particle_engine.js' ? '' : 'name/') + f);
  const load = async () => {
    window.DECORATION_NAME_CONFIG = window.DECORATION_NAME_CONFIG || {}; window.PUPPY_IMG_BASE = 'static/resources/backgrounds/';
    css.forEach(h => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = h; document.head.appendChild(l); });
    for (const src of js) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
    const [map, catalog] = await Promise.all([get('username_map.json'), get('decoration_catalog.json')]);
    const key = Object.keys(map).find(k => k.toLowerCase() === who.toLowerCase()); if (!key) return;
    const user = await get(`users/${map[key]}.json`), act = user.decorations?.active || {}, tr = window.DECORATION_NAME_TRANSLATOR;
    const tag = $('teaser-tag'), TAPE = { washi_pink: '#f3a6c8', washi_mint: '#9fe3cf', washi_gold: '#f2cf74', washi_lavender: '#c5b5ef' };
    const piece = (cls, id, text) => { const s = document.createElement('span'); s.className = cls + ' name-tag'; const config = id && catalog[id] ? { ...(catalog[id].config || {}) } : {}; if (text !== undefined) config.text = text; if (tr) tr.applyTagPresentation(s, config, 'name-tag'); else s.textContent = text || config.text || ''; return s; };
    if (TAPE[act.washi_color]) { const t = document.createElement('i'); t.className = 'tape'; t.style.setProperty('--tape', TAPE[act.washi_color]); tag.appendChild(t); }
    if (act.name_prefix) tag.appendChild(piece('name-prefix', act.name_prefix));
    tag.appendChild(piece('name-base', act.name_base, user.username || who));
    if (act.name_suffix) tag.appendChild(piece('name-suffix', act.name_suffix));
    tag.insertAdjacentHTML('beforeend', `<small>${canon(me) ? 'your look right now' : `${esc(who)}'s look`}</small>`);
  };
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); load().catch(() => {}); } }, { rootMargin: '400px' });
  io.observe(document.querySelector('.teaser')); // the tag itself is hidden while empty, so watch its panel
})();

// ---- scroll: the galaxy dims as the panels come up --------------------------------------------------
addEventListener('scroll', () => {
  document.querySelector('.site-nav').classList.toggle('solid', scrollY > 40);
  if (!document.body.classList.contains('ui')) return;
  const k = Math.min(1, scrollY / (innerHeight * .85));
  $('gl').style.filter = k > .01 ? `brightness(${(1 - .55 * k).toFixed(3)}) saturate(${(1 - .3 * k).toFixed(3)})` : '';
}, { passive: true });

// ---- arrivals ---------------------------------------------------------------------------------------
{
  const q = new URLSearchParams(location.search), focus = q.get('focus');
  if (focus && galaxy) { setMode('explore'); galaxy.rise(focus); if (canon(focus)) setTimeout(() => showFound(canon(focus)), still ? 0 : 2300); }
  else if (q.has('explore')) setMode('explore');
}
