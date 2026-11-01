// Flair layer for the star profile (profile.html). Every effect has its own switch in the visitor-facing Effects panel
// (bottom-left), remembered in localStorage. CSS effects are gated by `fx-<key>` classes on <html>; JS effects
// check on(key) when they run. Arrival effects play as each panel scrolls into view; "Replay arrival" reruns them.
(function () {
  const FX = [ // key, label, group, default
    ['reveal', 'Panels swing in on their tabs', 'Arrival', true],
    ['count', 'Numbers count up', 'Arrival', true],
    ['gauge', 'Gauge fills, star rides round', 'Arrival', true],
    ['meteor', 'Meteors streak to their spot', 'Arrival', true],
    ['gems', 'Medals pop in', 'Arrival', true],
    ['list', 'Unlocks slide in one by one', 'Arrival', true],
    ['icons', 'Glyphs on tabs + big watermark', 'At a glance', true],
    ['chips', 'COMPLETE / 1 LEFT on categories', 'At a glance', true],
    ['rank', 'Gold / silver / bronze + TOP 10 on rank', 'At a glance', true],
    ['rare', 'Legendary shimmer on unlocks under 2%', 'At a glance', true],
    ['glint', 'Brass tabs catch the light', 'Ambient', true],
    ['tilt', 'Panels tilt toward the cursor + sheen', 'Ambient', true],
    ['eyepiece', 'Eyepiece sky drifts, star twinkles', 'Ambient', true],
    ['pulse', 'Meteor heads pulse', 'Ambient', true],
    ['sway', 'Name tag sways', 'Ambient', true],
    ['spot', 'Star light falls on the name plate', 'Ambient', true],
    ['shooting', 'Shooting stars in the background', 'Ambient', true],
    ['dust', 'Stardust trail behind the cursor', 'Ambient', true],
    ['moonlink', 'Hover a founded row: its moon grows', 'Links', true],
    ['cascade', 'Tiles cascade in as you scroll', 'Logbook', true],
    ['founderfx', 'Founder glow; Platinum founder frame spins', 'Logbook', true],
    ['platsky', 'Platinum skies twinkle, moon floats', 'Logbook', true],
    ['konami', 'Konami code easter egg (↑↑↓↓←→←→BA)', 'Logbook', true],
  ];
  const KEY = 'cosmic.fx', root = document.documentElement, still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let state = {}; try { state = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  FX.forEach(([k, , , d]) => { if (typeof state[k] !== 'boolean') state[k] = d; });
  const on = k => state[k] && !still;
  const apply = () => { FX.forEach(([k]) => root.classList.toggle('fx-' + k, on(k))); try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };
  apply(); // classes go on before first paint so revealed-later panels start hidden

  const css = document.createElement('style');
  css.textContent = `
/* ---- arrival ---- */
.fx-reveal .panel { transform-origin:50% 0; transition:opacity .55s ease var(--d, 0s), transform .9s cubic-bezier(.2,1.25,.35,1) var(--d, 0s); }
.fx-reveal .panel:not(.in) { opacity:0; transform:perspective(900px) rotateX(-16deg) translateY(28px); }
.fx-meteor .panel .meteor i { transition:width 1.3s cubic-bezier(.2,.8,.2,1) var(--md, 0s); }
.fx-meteor .panel .meteor::after { transition:left 1.3s cubic-bezier(.2,.8,.2,1) var(--md, 0s), opacity .3s var(--md, 0s); }
.fx-meteor .panel:not(.in) .meteor i { width:0; } .fx-meteor .panel:not(.in) .meteor::after { left:0; opacity:0; }
.fx-gems .gem { transition:opacity .3s calc(var(--i, 0) * 70ms), transform .55s cubic-bezier(.3,1.8,.5,1) calc(var(--i, 0) * 70ms); }
.fx-gems .gems:not(.in) .gem { opacity:0; transform:scale(.3) rotate(-20deg); }
.fx-gems .gem.first i { animation:fxshine 2.6s ease-in-out infinite; } @keyframes fxshine { 50% { box-shadow:0 0 22px var(--m), 0 0 4px #fff; filter:brightness(1.25); } }
.fx-list .list li { transition:opacity .4s calc(var(--i, 0) * 90ms + .2s), transform .6s cubic-bezier(.2,1.3,.4,1) calc(var(--i, 0) * 90ms + .2s); }
.fx-list .panel:not(.in) .list li { opacity:0; transform:translateX(-26px); }
/* ---- at a glance ---- */
.wm { display:none; position:absolute; right:12px; bottom:2px; font:400 64px/1 Lora; color:var(--brass); opacity:.14; pointer-events:none; }
.fx-icons .wm { display:block; } .fx-icons .stat.wide .wm { display:none; }
.fx-icons .tab[data-ico]::before { content:attr(data-ico) " "; }
.chip { display:none; margin-left:8px; padding:2px 7px; border-radius:99px; font:500 9px 'DM Mono'; letter-spacing:.1em; vertical-align:middle; }
.fx-chips .chip { display:inline-block; }
.chip.done { background:linear-gradient(180deg, #ffe1a0, #c99645); color:#211014; box-shadow:0 0 12px rgba(255,225,160,.6); }
.chip.left { border:1px solid #ffe1a0; color:#ffe1a0; animation:fxbeat 1.4s ease-in-out infinite; } @keyframes fxbeat { 50% { box-shadow:0 0 12px rgba(255,225,160,.7); transform:scale(1.08); } }
.fx-chips .cat.done .meteor { --c:#ffe1a0 !important; }
.fx-rank .stat.r1 b { color:#ffe1a0; text-shadow:0 0 20px rgba(255,225,160,.6); } .fx-rank .stat.r2 b { color:#e6ecf8; text-shadow:0 0 18px rgba(230,236,248,.5); } .fx-rank .stat.r3 b { color:#e8a66a; }
.crown { display:none; } .fx-rank .crown { display:inline-block; margin-left:6px; font-size:.6em; vertical-align:super; }
.fx-rare .list li.legend b { background:linear-gradient(90deg, #ffe1a0, #fff 30%, #c99645 60%, #ffe1a0); background-size:250% 100%; -webkit-background-clip:text; background-clip:text; color:transparent; animation:fxgold 3s linear infinite; }
@keyframes fxgold { to { background-position:-250% 0; } }
/* ---- ambient ---- */
.fx-glint .tab { overflow:hidden; } .fx-glint .tab::after { content:""; position:absolute; inset:0; background:linear-gradient(110deg, transparent 38%, rgba(255,255,255,.75) 50%, transparent 62%); background-size:260% 100%; background-position:160% 0; animation:fxglint 7s ease-in-out infinite var(--gd, 0s); }
@keyframes fxglint { 0%, 70% { background-position:160% 0; } 100% { background-position:-60% 0; } }
.sheen { display:none; position:absolute; inset:0; z-index:-1; border-radius:inherit; pointer-events:none; background:radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(255,225,160,.16), transparent 45%); opacity:0; transition:opacity .25s; }
.fx-tilt .sheen { display:block; } .fx-tilt .panel.hov .sheen { opacity:1; }
.fx-tilt .panel.in { transform:perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)); } .fx-tilt .panel.in.hov { transition:transform .12s ease-out; }
.fx-eyepiece .stat.wide::before { animation:fxeye 40s linear infinite alternate, fxtw 3.2s ease-in-out infinite; }
@keyframes fxeye { to { background-position:center, 30% 70%; } } @keyframes fxtw { 50% { filter:brightness(1.35); } }
.fx-pulse .meteor::after { animation:fxhead 1.7s ease-in-out infinite; } @keyframes fxhead { 50% { box-shadow:0 0 14px #fff, 0 0 30px var(--c), 0 0 60px var(--c); } }
.fx-sway .who { animation:fxsway 7s ease-in-out infinite; transform-origin:50% -14px; } @keyframes fxsway { 0%, 100% { transform:rotate(-1.4deg); } 50% { transform:rotate(-.2deg); } }
.fx-spot .plate::before { content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none; background:radial-gradient(120% 95% at 50% -35%, color-mix(in srgb, var(--starc, #fff) 38%, transparent), transparent 62%); mix-blend-mode:screen; }
#fxsky { position:fixed; inset:0; z-index:1; pointer-events:none; }
/* ---- logbook ---- */
.fx-cascade .ach { transition:opacity .45s var(--ad, 0s), transform .6s cubic-bezier(.2,1.3,.4,1) var(--ad, 0s), border-color .2s, filter .3s; }
.fx-cascade .ach:not(.in) { opacity:0; transform:translateY(20px) scale(.96); }
.fx-founderfx .ach.founded { animation:fxfd 3.2s ease-in-out infinite; } @keyframes fxfd { 50% { box-shadow:0 0 22px rgba(255,225,160,.28), inset 0 0 18px rgba(255,225,160,.08); } }
.fx-founderfx .bdg.founder, .fx-founderfx .bdg.pfb { animation:fxgold 3s linear infinite; }
.fx-founderfx .ach.pf::before { animation:fxpf 5s linear infinite; } @keyframes fxpf { to { --ang:360deg; } }
.fx-founderfx .ach.pf { animation:fxpfglow 3s ease-in-out infinite; } @keyframes fxpfglow { 50% { box-shadow:0 0 34px rgba(159,232,255,.35), 0 0 70px rgba(201,162,255,.18); } }
.fx-founderfx .moon.plat .pfc { animation:fxgold 3s linear infinite; background-size:250% 100%; }
.fx-platsky .psky i { animation:fxtw2 3s ease-in-out infinite var(--t, 0s); } @keyframes fxtw2 { 50% { opacity:1; transform:scale(1.6); } }
.fx-platsky .pmoon { animation:fxmoon 7s ease-in-out infinite; } @keyframes fxmoon { 50% { transform:translateY(-7px); } }
.fx-platsky .paur span { animation:fxaur 9s ease-in-out infinite alternate; } @keyframes fxaur { to { transform:translateX(8%) skewY(-3deg); opacity:.2; } }
.kon-toast { position:fixed; z-index:40; left:50%; top:22%; transform:translate(-50%, -20px); opacity:0; padding:16px 26px; border-radius:4px 18px 4px 18px; background:linear-gradient(180deg, #452127, #211014); border:1px solid #ffe1a0; font:700 22px Lora; color:#ffe1a0; box-shadow:0 0 40px rgba(255,225,160,.35); transition:opacity .4s, transform .5s cubic-bezier(.2,1.4,.4,1); pointer-events:none; }
.kon-toast.on { opacity:1; transform:translate(-50%, 0); }
.konami .ach { animation:fxkon 1.2s ease-in-out infinite; } @keyframes fxkon { 50% { box-shadow:0 0 18px rgba(255,225,160,.45); } }
/* ---- debug panel ---- */
.fxdbg { position:fixed; z-index:30; left:14px; bottom:14px; font:500 12px Lora; }
.fxbtn { padding:8px 12px; border-radius:4px 12px 4px 12px; border:1px solid #c99645; background:linear-gradient(180deg, #452127, #211014); color:#ffe1a0; font:600 12px 'DM Mono'; letter-spacing:.12em; cursor:pointer; }
.fxpanel { position:absolute; left:0; bottom:44px; width:300px; max-height:70vh; overflow:auto; padding:14px; border-radius:4px 16px 4px 16px; background:linear-gradient(180deg, rgba(69,33,39,.98), rgba(33,16,20,.98)); border:1px solid #704034; box-shadow:0 16px 40px rgba(0,0,0,.6); color:#fff1d1; }
.fxpanel h4 { margin:0 0 6px; font:700 14px Lora; color:#ffe1a0; } .fxpanel h5 { margin:12px 0 4px; font:500 10px 'DM Mono'; letter-spacing:.14em; text-transform:uppercase; color:#d9b98a; }
.fxpanel label { display:flex; gap:8px; align-items:center; padding:3px 0; cursor:pointer; } .fxpanel input { accent-color:#62ead7; }
.fxrow { display:flex; gap:6px; margin-top:12px; } .fxrow button { flex:1; padding:6px; border-radius:6px; border:1px solid #704034; background:#211014; color:#fff1d1; font:500 11px 'DM Mono'; cursor:pointer; }
.fxnote { margin-top:8px; font:500 10px 'DM Mono'; color:#d9b98a; }`;
  document.head.appendChild(css);

  document.addEventListener('profile:ready', init, { once: true });

  function init() {
    const $$ = (q, r = document) => [...r.querySelectorAll(q)];
    // --- dress the page: glyphs, watermarks, sheens, chips, rank, rarity, stagger indices ---
    const ICO = { 'Founded': '☾', 'Rank': '♛', 'Chat': '✎', 'With us': '⌛', 'Rarest': '◆', 'Style': '✿', 'Top month': '★', 'Achievements': '✦', 'Categories': '✧', 'Latest unlocks': '☄', 'Logbook': '❖' };
    $$('.tab').forEach((t, i) => { const k = Object.keys(ICO).find(k => t.textContent.trim().startsWith(k)); if (k) t.dataset.ico = ICO[k]; t.style.setProperty('--gd', (i * 1.3 % 7).toFixed(1) + 's'); });
    $$('.stat').forEach(s => { const ico = s.querySelector('.tab')?.dataset.ico; if (ico) s.insertAdjacentHTML('beforeend', `<span class="wm">${ico}</span>`); });
    $$('.panel').forEach(p => p.insertAdjacentHTML('afterbegin', '<span class="sheen"></span>'));
    // stagger: panels in the stat grid by position, others by order
    $$('.grid .panel').forEach((p, i) => p.style.setProperty('--d', (i * .07).toFixed(2) + 's'));
    $$('.cat').forEach((c, i) => {
      c.querySelector('.meteor')?.style.setProperty('--md', (i * .08).toFixed(2) + 's');
      const m = c.querySelector('b')?.textContent.match(/(\d+)\s*\/\s*(\d+)/); if (!m) return;
      const have = +m[1], total = +m[2], label = c.querySelector('span');
      if (have === total && total) { c.classList.add('done'); label.insertAdjacentHTML('beforeend', '<span class="chip done">✦ COMPLETE</span>'); }
      else if (have > 0 && total - have === 1) label.insertAdjacentHTML('beforeend', '<span class="chip left">1 LEFT</span>');
    });
    $$('.gem').forEach((g, i) => { g.style.setProperty('--i', i); if (g.querySelector('i')?.textContent.trim() === '1') g.classList.add('first'); });
    $$('.list li').forEach((li, i) => { li.style.setProperty('--i', i); const p = parseFloat(li.querySelector('em')?.textContent); if (p < 2) li.classList.add('legend'); });
    const rankPanel = $$('.stat').find(s => s.querySelector('.tab')?.textContent.includes('Rank'));
    if (rankPanel) {
      const r = parseInt(rankPanel.querySelector('b').textContent.replace(/\D/g, ''), 10), of = parseInt(rankPanel.querySelector('.mono').textContent.replace(/\D/g, ''), 10);
      if (r <= 3) rankPanel.classList.add('r' + r);
      const tag = r <= 3 ? '' : r <= 10 ? 'TOP 10' : r <= of * .1 ? 'TOP 10%' : ''; // top 3 get a crown on the number instead
      if (tag) rankPanel.querySelector('.mono').insertAdjacentHTML('afterbegin', `<span class="chip done" style="margin:0 8px 0 0">${tag}</span>`);
      if (r <= 3) rankPanel.querySelector('b').insertAdjacentHTML('beforeend', '<span class="crown">♛</span>');
    }

    // --- numbers: remember finals so counting can replay ---
    const counters = $$('.stat b').concat($$('#astro .num')).map(el => {
      const node = el.firstChild && el.firstChild.nodeType === 3 ? el.firstChild : null, txt = node ? node.textContent : '';
      const m = txt.match(/^(\D*?)([\d,]+)(.*)$/); return m && node ? { el, node, pre: m[1], n: +m[2].replace(/,/g, ''), post: m[3], comma: m[2].includes(',') } : null;
    }).filter(Boolean);
    const fmt = (c, v) => c.pre + (c.comma ? Math.round(v).toLocaleString() : Math.round(v)) + c.post;
    const tween = (ms, step, done) => { const t0 = performance.now(); const f = now => { const k = Math.min(1, (now - t0) / ms), e = 1 - (1 - k) ** 3; step(e); if (k < 1) requestAnimationFrame(f); else if (done) done(); }; requestAnimationFrame(f); };
    const countIn = scope => counters.filter(c => scope.contains(c.el)).forEach(c => { if (!on('count')) { c.node.textContent = fmt(c, c.n); return; } c.node.textContent = fmt(c, 0); tween(1100 + Math.min(900, c.n), e => { c.node.textContent = fmt(c, c.n * e); }); });
    const svg = document.getElementById('astro'), prog = svg?.querySelector('.prog'), tipG = svg?.querySelector('.tip'), C = 2 * Math.PI * 76, F = +(svg?.dataset.frac || 0);
    const setGauge = f => { prog?.setAttribute('stroke-dasharray', `${C * f} ${C}`); tipG?.setAttribute('transform', `rotate(${f * 360} 110 110)`); };
    const gaugeIn = () => { if (!on('gauge')) { setGauge(F); return; } setGauge(0); tween(1700, e => setGauge(F * e)); };

    // --- arrival: reveal as things scroll in ---
    const arrive = el => {
      el.classList.add('in');
      if (el.matches('.panel')) { countIn(el); if (el.contains(svg)) gaugeIn(); }
    };
    const IO = { threshold: 0, rootMargin: '0px 0px -12% 0px' };
    let io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); arrive(e.target); } }), IO);
    const watch = () => $$('.panel, .gems').forEach(el => io.observe(el));
    // pre-arm: counters at 0 and gauge empty, so nothing flashes its final value before the reveal
    if (on('count')) counters.forEach(c => { c.node.textContent = fmt(c, 0); }); if (on('gauge')) setGauge(0);
    watch();
    const replay = () => {
      $$('.panel.in, .gems.in').forEach(el => el.classList.remove('in')); counters.forEach(c => { c.node.textContent = fmt(c, on('count') ? 0 : c.n); }); setGauge(on('gauge') ? 0 : F);
      io.disconnect(); io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); arrive(e.target); } }), IO);
      $$('.ach.in').forEach(t => t.classList.remove('in')); watchTiles();
      requestAnimationFrame(() => requestAnimationFrame(watch));
    };

    // --- tilt + sheen ---
    document.addEventListener('pointermove', e => {
      if (!on('tilt')) return;
      const p = e.target.closest && e.target.closest('.panel.in:not(.logbook)'); $$('.panel.hov').forEach(x => { if (x !== p) { x.classList.remove('hov'); x.style.removeProperty('--rx'); x.style.removeProperty('--ry'); } });
      if (!p) return;
      const r = p.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height, amp = 6 * Math.min(1, 260 / Math.max(r.width, r.height));
      p.classList.add('hov'); p.style.setProperty('--rx', ((.5 - y) * amp).toFixed(2) + 'deg'); p.style.setProperty('--ry', ((x - .5) * amp).toFixed(2) + 'deg');
      p.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); p.style.setProperty('--my', (y * 100).toFixed(1) + '%');
    });

    // --- founded row -> its moon grows in the 3D system ---
    $$('.moon[data-i]').forEach(m => {
      m.addEventListener('pointerenter', () => { if (on('moonlink')) { window.profileHooks?.moonHi(+m.dataset.i, 1); m.classList.add('on'); } });
      m.addEventListener('pointerleave', () => { window.profileHooks?.moonHi(+m.dataset.i, 0); m.classList.remove('on'); });
    });

    // --- background canvas: shooting stars + cursor stardust ---
    const cv = document.createElement('canvas'); cv.id = 'fxsky'; document.body.appendChild(cv);
    const ctx = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1); let W = 0, H = 0;
    const size = () => { W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }; size(); addEventListener('resize', size);
    const shots = [], dust = []; let next = performance.now() + 1500;
    const starc = getComputedStyle(root).getPropertyValue('--starc').trim() || '#cfe9ff';
    addEventListener('pointermove', e => { if (on('dust')) for (let i = 0; i < 2; i++) dust.push({ x: e.clientX, y: e.clientY, vx: (Math.random() - .5) * .6, vy: Math.random() * .5 + .1, t: 0, life: 600 + Math.random() * 500, r: Math.random() * 1.6 + .6 }); });
    const loop = now => {
      ctx.clearRect(0, 0, W, H);
      if (on('shooting') && now > next) { const x = Math.random() * W * .8 + W * .1, y = Math.random() * H * .35; shots.push({ x, y, a: Math.PI * (.15 + Math.random() * .2) * (Math.random() < .5 ? 1 : -1) + (Math.random() < .5 ? 0 : Math.PI), t0: now, len: 120 + Math.random() * 120 }); next = now + 3500 + Math.random() * 4000; }
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i], k = (now - s.t0) / 900; if (k < 0) continue; if (k >= 1) { shots.splice(i, 1); continue; }
        const d = 420 * k, hx = s.x + Math.cos(s.a) * d, hy = s.y + Math.sin(s.a) * d, tx = hx - Math.cos(s.a) * s.len, ty = hy - Math.sin(s.a) * s.len;
        const g = ctx.createLinearGradient(tx, ty, hx, hy); g.addColorStop(0, 'rgba(255,241,209,0)'); g.addColorStop(1, `rgba(255,241,209,${.85 * Math.sin(Math.PI * k)})`);
        ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      }
      for (let i = dust.length - 1; i >= 0; i--) {
        const p = dust[i]; p.t += 16; if (p.t > p.life) { dust.splice(i, 1); continue; }
        p.x += p.vx; p.y += p.vy; ctx.globalAlpha = (1 - p.t / p.life) * .9; ctx.fillStyle = i % 3 ? '#ffe1a0' : starc; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(loop);
    };
    if (!still) requestAnimationFrame(loop);

    // --- logbook tiles cascade in as they scroll into view (each batch staggers); redraws re-watch new tiles ---
    const tio = new IntersectionObserver(es => { let k = 0; es.forEach(e => { if (!e.isIntersecting) return; tio.unobserve(e.target); e.target.style.setProperty('--ad', (k++ * .04).toFixed(2) + 's'); e.target.classList.add('in'); }); }, IO);
    function watchTiles() { $$('.ach:not(.in)').forEach(t => tio.observe(t)); }
    watchTiles(); document.addEventListener('logbook:drawn', watchTiles);

    // --- konami: ↑↑↓↓←→←→BA = a meteor shower, every logbook tile flickers gold, and the old 1.0 line ---
    const KON = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']; let ki = 0;
    const toast = document.createElement('div'); toast.className = 'kon-toast'; toast.textContent = "You're asking for it now huh..."; document.body.appendChild(toast);
    addEventListener('keydown', e => {
      ki = e.key.toLowerCase() === KON[ki].toLowerCase() ? ki + 1 : (e.key === KON[0] ? 1 : 0);
      if (ki < KON.length) return; ki = 0; if (!on('konami')) return;
      root.classList.add('konami'); toast.classList.add('on');
      const now = performance.now(); for (let i = 0; i < 28; i++) shots.push({ x: Math.random() * W, y: Math.random() * H * .5 - 60, a: Math.PI * (.22 + Math.random() * .12), t0: now + i * 110, len: 140 + Math.random() * 160 });
      setTimeout(() => { toast.classList.remove('on'); root.classList.remove('konami'); }, 5200);
    });

    // --- the debug panel ---
    const dbg = document.createElement('div'); dbg.className = 'fxdbg';
    const groups = [...new Set(FX.map(f => f[2]))];
    dbg.innerHTML = `<div class="fxpanel" hidden><h4>Effects</h4><p class="fxnote" style="margin:0 0 4px">Turn any of them off. Your choices are remembered on this device.</p>${groups.map(g => `<h5>${g}</h5>` + FX.filter(f => f[2] === g).map(([k, label]) =>
      `<label><input type="checkbox" data-k="${k}" ${state[k] ? 'checked' : ''}> ${label}</label>`).join('')).join('')}
      <div class="fxrow"><button data-act="replay">Replay arrival</button><button data-act="on">All on</button><button data-act="off">All off</button></div>
      ${still ? '<p class="fxnote">Your system asks for reduced motion, so effects stay off.</p>' : ''}</div><button class="fxbtn" type="button" aria-label="Effects settings">✦ Effects</button>`;
    document.body.appendChild(dbg);
    const pnl = dbg.querySelector('.fxpanel');
    dbg.querySelector('.fxbtn').addEventListener('click', () => { pnl.hidden = !pnl.hidden; });
    pnl.addEventListener('change', e => { const k = e.target.dataset.k; if (!k) return; state[k] = e.target.checked; apply(); if (['reveal', 'count', 'gauge', 'meteor', 'gems', 'list', 'cascade'].includes(k)) replay(); });
    pnl.addEventListener('click', e => {
      const a = e.target.dataset.act; if (!a) return;
      if (a === 'on' || a === 'off') { FX.forEach(([k]) => { state[k] = a === 'on'; }); pnl.querySelectorAll('input').forEach(i => { i.checked = a === 'on'; }); apply(); }
      replay();
    });
  }
})();
