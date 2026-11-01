// The pack galaxy: every published player is a star. Colour = achievement-count band (blackbody), distance
// from the core = count (fewer = farther out), Legendary Legacy players are runaways on their own fast orbits,
// the player with the most achievements is the quasar at the core. WebGL draws the galaxy; a 2D overlay canvas
// draws names, the find reticle, the replay pin wire and unlock flashes. Ported from directions/bg-u5-gl.html
// (NOTES.md rounds 10-21).
//
// Modes: 'ui' (content on top: no names, only pins and flashes; galaxy shifted right on wide screens) and
// 'explore' (names pop up round the cursor, click empty sky to hold them, click a pill to fly into that star).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { kelvin, BANDS, bandOf, starMat, coronaMat } from './stars.js';

const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = seed => { let a = seed | 0 || 1; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

// HUD name tags: a dark pill with a band-coloured dot, pushed out from (cx, cy) along a leader line until it finds
// free sky. Call in priority order. memory keeps each name's last spot so moving tags don't hop; put.boxes = clicks.
function tagger(ctx, cx, cy, W, H, avoid, memory) {
  const placed = avoid.map(r => [r.left, r.top, r.width, r.height]), TH = 20, seen = new Set(), boxes = [];
  const hits = b => placed.some(o => b[0] < o[0] + o[2] + 4 && o[0] < b[0] + b[2] + 4 && b[1] < o[1] + o[3] + 3 && o[1] < b[1] + b[3] + 3);
  const put = (sx, sy, text, o = {}) => {
    if (seen.has(text)) return true;
    const sub = o.sub || '', font = `${o.bold ? 700 : 600} 12px Lora, Georgia, serif`, subFont = '500 9px "DM Mono", monospace';
    ctx.font = font; const tw = ctx.measureText(text).width; ctx.font = subFont; const sw = sub ? ctx.measureText(sub).width + 6 : 0;
    const w = 26 + tw + sw;
    let dx = sx - cx, dy = sy - cy, L = Math.hypot(dx, dy);
    if (L < 6) { dx = 1; dy = -.45; L = Math.hypot(dx, dy); }
    dx /= L; dy /= L;
    const tries = [];
    for (const k of o.reach || [14, 34, 58, 86, 120]) for (const turn of [0, .4, -.4, .8, -.8]) tries.push([k, turn]);
    if (memory.has(text)) tries.unshift(memory.get(text));
    for (const [k, turn] of tries) {
      const c = Math.cos(turn), s = Math.sin(turn), ux = dx * c - dy * s, uy = dx * s + dy * c;
      const ax = sx + ux * k, ay = sy + uy * k, x = ux >= 0 ? ax : ax - w, y = ay - TH / 2, box = [x, y, w, TH];
      if (x < 6 || x + w > W - 6 || y < 6 || y + TH > H - 6 || hits(box)) continue;
      placed.push(box); seen.add(text); boxes.push({ x, y, w, h: TH, id: o.id ?? text }); memory.set(text, [k, turn]);
      ctx.save(); ctx.globalAlpha = o.alpha ?? 1; ctx.textBaseline = 'middle';
      ctx.strokeStyle = o.line || 'rgba(255,225,160,.45)'; ctx.lineWidth = 1;
      if (k > 16) { ctx.beginPath(); ctx.moveTo(sx + ux * 5, sy + uy * 5); ctx.lineTo(ax, ay); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(sx, sy, 4.5, 0, 6.283); ctx.stroke();
      ctx.fillStyle = 'rgba(28,12,15,.86)'; ctx.beginPath(); ctx.roundRect(x, y, w, TH, 10); ctx.fill();
      ctx.strokeStyle = o.hot ? '#fff1d1' : o.edge || 'rgba(201,150,69,.55)'; ctx.lineWidth = o.hot ? 1.6 : 1; ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = o.dot || '#cfe9ff'; ctx.beginPath(); ctx.arc(x + 11, y + TH / 2, 3, 0, 6.283); ctx.fill();
      ctx.fillStyle = o.color || '#fff1d1'; ctx.font = font; ctx.fillText(text, x + 19, y + TH / 2 + .5);
      if (sub) { ctx.fillStyle = o.subColor || '#d9b98a'; ctx.font = subFont; ctx.fillText(sub, x + 19 + tw + 6, y + TH / 2 + .5); }
      ctx.restore();
      return true;
    }
    return false;
  };
  put.boxes = boxes;
  return put;
}

export function createGalaxy({ gl, overlay, flash, rows, onDive }) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = innerWidth < 700, PR = Math.min(devicePixelRatio || 1, small ? 1.5 : 2);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: false, powerPreference: 'high-performance' }); } catch (e) { return null; }
  const ELEV = Math.asin(.44), ROLL = .42, SPIN = -.008 /* arms trail like a real spiral */, RG = 100, FOV = 20, FAR = Math.log1p(150);
  renderer.setPixelRatio(PR); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x020309);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 4000);
  const tilt = new THREE.Group(), disk = new THREE.Group(); tilt.rotation.set(-(Math.PI / 2 - ELEV), 0, ROLL, 'ZYX'); tilt.add(disk); scene.add(tilt);
  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .7, .5, 1);
  const zoomPass = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uCenter: { value: new THREE.Vector2(.5, .5) }, uAmt: { value: 0 } }, // warp streaks for the dive
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uCenter; uniform float uAmt; varying vec2 vUv;
      void main(){ if (uAmt < .001) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
        vec2 d = vUv - uCenter; vec4 acc = vec4(0.); float w = 0.;
        for (int i = 0; i < 28; i++) { float t = float(i) / 27., wt = 1. - t * .7; acc += texture2D(tDiffuse, uCenter + d * (1. - uAmt * t)) * wt; w += wt; }
        gl_FragColor = acc / w; }` });
  composer.addPass(bloom); composer.addPass(zoomPass); composer.addPass(new OutputPass());
  const U = { uTime: { value: 0 }, uScale: { value: 1 }, uPR: { value: PR }, uClip: { value: .001 }, uBig: { value: 0 } };
  const rnd = rng(77), gauss = () => rnd() + rnd() + rnd() - 1.5;
  const addOne = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor };

  // far backdrop: real catalogue stars (NASA/Goddard SVS Deep Star Maps), faint, behind everything
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x6f7590, depthWrite: false }));
  back.position.z = -900; scene.add(back);
  new THREE.TextureLoader().load('static/resources/sky/stars_patch.jpg', tx => { tx.colorSpace = THREE.SRGBColorSpace; back.material.map = tx; back.material.needsUpdate = true; kick(); });

  // soft points: dust and knots (additive), dark dust lanes (normal blend). In flight, near or swollen dust fades.
  const softVert = `attribute float size; attribute float alpha; attribute vec3 color; uniform float uScale, uClip, uBig; varying vec3 vC; varying float vA;
  void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; float px = size * uScale / -mv.z;
    gl_PointSize = max(1., px); vC = color; vA = alpha * min(1., px) * smoothstep(uClip * .5, uClip, -mv.z) * (1. - uBig * smoothstep(6., 30., px)); }`;
  const softFrag = `varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - .5; float a = exp(-dot(d, d) * 11.) * vA; if (a < .002) discard; gl_FragColor = vec4(vC, a); }`;
  function soft(n, fill, blending) {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n), c = new THREE.Color();
    for (let i = 0; i < n; i++) { const o = fill(i, c); pos.set(o.p, i * 3); col.set([c.r, c.g, c.b], i * 3); size[i] = o.s; alpha[i] = o.a; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1)); g.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
    return new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: U, vertexShader: softVert, fragmentShader: softFrag, transparent: true, depthWrite: false, blending }));
  }
  const armAngle = (rr, arm, spread) => arm * 2.094 + rr * 3.4 + gauss() * spread * (1 - .35 * rr);
  const WARM = new THREE.Color(0xffd6a0), ARM = new THREE.Color(0xb4c4ff), YOUNG = new THREE.Color(0x8fb0ff), PINK = new THREE.Color(0xff7ab8);
  disk.add(soft(small ? 60000 : 150000, (i, c) => {
    const k = rnd();
    if (k < .16) { // bulge: a warm, puffy spheroid
      const r = Math.abs(gauss()) * 14 + rnd() * 3, a = rnd() * 6.283, z = gauss() * r * .7;
      c.copy(WARM).lerp(new THREE.Color(0xfff0d8), rnd() * .5); return { p: [Math.cos(a) * r, Math.sin(a) * r, z], s: .14 + rnd() * .18, a: .12 + rnd() * .22 };
    }
    const inter = k > .62, rr = .05 + .95 * rnd() ** .75, a = inter ? rnd() * 6.283 : armAngle(rr, i % 3, .5), r = rr * RG;
    c.copy(inter ? WARM : rnd() < .25 ? YOUNG : ARM).lerp(WARM, Math.max(0, .5 - rr));
    return { p: [Math.cos(a) * r, Math.sin(a) * r, gauss() * (1 + 3 * (1 - rr))], s: .1 + rnd() ** 3 * .35, a: (inter ? .07 : .16 + rnd() * .24) * (1.1 - rr * .6) };
  }, THREE.AdditiveBlending));
  disk.add(soft(small ? 50 : 90, (i, c) => {
    const rr = .25 + .45 * rnd(), a = armAngle(rr, i % 3, .22), r = rr * RG; c.copy(PINK);
    return { p: [Math.cos(a) * r, Math.sin(a) * r, gauss()], s: 1.8 + rnd() * 2.5, a: .015 + rnd() * .02 };
  }, THREE.AdditiveBlending));
  disk.add(soft(small ? 2500 : 6000, (i, c) => { // big faint puffs: the smooth glow under the grain
    const rr = .04 + .9 * rnd() ** .9, a = rnd() < .25 ? rnd() * 6.283 : armAngle(rr, i % 3, .45), r = rr * RG;
    c.copy(ARM).lerp(WARM, Math.max(0, .7 - rr * 1.4));
    return { p: [Math.cos(a) * r, Math.sin(a) * r, gauss() * (1 + 2 * (1 - rr))], s: 5 + rnd() * 9, a: (.004 + rnd() * .006) * (1.2 - rr * .7) };
  }, THREE.AdditiveBlending));
  disk.add(soft(small ? 14000 : 30000, (i, c) => { // dark dust trailing the inner edge of each arm
    const rr = .22 + .7 * rnd() ** .8, a = armAngle(rr, i % 3, .16) - .16, r = rr * RG * .97; c.set(0x020308);
    return { p: [Math.cos(a) * r, Math.sin(a) * r, gauss() * .8], s: 1.2 + rnd() * 1.8, a: (.03 + rnd() * .05) * Math.min(1, (rr - .22) * 5) };
  }, THREE.NormalBlending)).children.at(-1).userData.under = true; // drawn under the arms: shades the gaps, keeps the arms dense

  // bulge glow in the disk plane; quasar nucleus (camera-facing) + two particle jets along the disk axis
  const glowFrag = `uniform vec3 uC; uniform float uK; uniform float uA; varying vec2 vUv; void main(){ float d = length(vUv - .5) * 2.;
    float a = (exp(-d * d * uK) * .8 + exp(-d * 6.) * .25) * uA; gl_FragColor = vec4(uC * a, 1.); }`;
  const uvVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
  tilt.add(new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(0xffc890) }, uK: { value: 12 }, uA: { value: .14 } }, vertexShader: uvVert, fragmentShader: glowFrag, ...addOne })));
  const nucleus = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(0xdfe8ff) }, uK: { value: 260 }, uA: { value: 1.4 } }, vertexShader: uvVert, fragmentShader: glowFrag, ...addOne }));
  scene.add(nucleus);
  const NJ = small ? 1400 : 3000, jseed = new Float32Array(NJ), jside = new Float32Array(NJ), jjit = new Float32Array(NJ * 2);
  for (let i = 0; i < NJ; i++) { jseed[i] = rnd(); jside[i] = i % 2 ? 1 : -1; const knot = rnd() < .3 ? .25 : 1; jjit[i * 2] = gauss() * .5 * knot; jjit[i * 2 + 1] = gauss() * .5 * knot; }
  const jg = new THREE.BufferGeometry(); jg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NJ * 3), 3));
  jg.setAttribute('seed', new THREE.BufferAttribute(jseed, 1)); jg.setAttribute('side', new THREE.BufferAttribute(jside, 1)); jg.setAttribute('jit', new THREE.BufferAttribute(jjit, 2));
  const JU = { ...U, uLen: { value: 50 }, uStr: { value: 1 } };
  const jets = new THREE.Points(jg, new THREE.ShaderMaterial({ uniforms: JU, ...addOne,
    vertexShader: `attribute float seed; attribute float side; attribute vec2 jit; uniform float uTime, uLen, uStr, uScale; varying float vA; varying float vF;
    void main(){ float f = fract(seed + uTime * .04); vec3 p = vec3(jit * (.25 + f * f * 5.), side * f * uLen);
      vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv; float px = (.18 + f * .8) * uScale / -mv.z;
      gl_PointSize = max(1., px); vA = uStr * pow(1. - f, 1.8) * .32 * min(1., px); vF = f; }`,
    fragmentShader: `varying float vA; varying float vF; void main(){ vec2 d = gl_PointCoord - .5; float a = exp(-dot(d, d) * 14.) * vA; if (a < .002) discard;
      gl_FragColor = vec4(mix(vec3(1.2, 1.25, 1.4), vec3(.45, .55, 1.), vF) * a, 1.); }` }));
  jets.frustumCulled = false; tilt.add(jets);

  // ---- players -------------------------------------------------------------------------------------
  const users = rows.map(([name, earned, legacy]) => ({ name, earned, tier: legacy, h: hash(name) }));
  const ranked = users.slice().sort((a, b) => b.earned - a.earned), N = ranked.length;
  const pts = ranked.map((u, i) => { const r = rng(u.h ^ 0x5bd1); return { u, rank: i, b: bandOf(u.earned), runaway: u.tier === 2, ph: r() * 6.28, jit: .85 + r() * .3, x: -1e4, y: -1e4 }; });
  const byName = new Map(pts.map(p => [p.u.name.toLowerCase(), p])), quasar = pts[0]?.u.earned > 0 ? pts[0] : null; // no quasar until someone has earned something (achievements reset on debut)
  if (quasar) quasar.runaway = false;
  function place(p) {
    if (p === quasar) return [0, 0, 0];
    const r = rng(p.u.h), g = () => r() + r() + r() - 1.5, arm = Math.floor(r() * 3);
    // fewer achievements = farther out; protostars (none yet) spread over a wide outer band, a ring of embers round the galaxy
    const rr = p.u.earned > 0 ? .06 + .66 * (1 - Math.log1p(Math.min(149, p.u.earned) + r() * .999) / FAR) : .72 + .16 * Math.sqrt(r()); // kept inside the visible window
    const a = arm * 2.094 + rr * 3.4 + g() * .32 * (1 - .4 * rr);
    return [Math.cos(a) * rr * RG, Math.sin(a) * rr * RG, g() * (.6 + 1.6 * (1 - rr))];
  }
  const geo = new THREE.BufferGeometry(), F = n => new Float32Array(N * n);
  const pos = F(3), col = F(3), core = F(1), span = F(1), br = F(1), ph = F(1), spike = F(1), vis = F(1);
  pts.forEach((p, i) => {
    const B = BANDS[p.b], c = kelvin(B.K * (.94 + p.jit * .06)).convertSRGBToLinear(); p.local = place(p); p.col = c;
    pos.set(p.local, i * 3); col.set([c.r, c.g, c.b], i * 3); core[i] = B.core * p.jit; span[i] = B.span; br[i] = B.b; ph[i] = p.ph; spike[i] = B.spike; vis[i] = 1;
  });
  for (const [k, a, n] of [['position', pos, 3], ['color', col, 3], ['core', core, 1], ['span', span, 1], ['bright', br, 1], ['phase', ph, 1], ['spike', spike, 1], ['vis', vis, 1]]) geo.setAttribute(k, new THREE.BufferAttribute(a, n));
  const starPts = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: U, ...addOne,
    vertexShader: `attribute vec3 color; attribute float core, span, bright, phase, spike, vis; uniform float uTime, uPR;
    varying vec3 vC; varying float vB, vCore, vSpan, vSpike;
    void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      vB = bright * (.84 + .16 * sin(uTime * 1.2 + phase)) * vis; vSpan = span; gl_PointSize = span * uPR; vC = color; vCore = core; vSpike = spike; }`,
    fragmentShader: `varying vec3 vC; varying float vB, vCore, vSpan, vSpike;
    void main(){ vec2 p = (gl_PointCoord - .5) * vSpan; float d = length(p);
      float a = exp(-d * d / (vCore * vCore)) + exp(-d / (vCore * 2.2)) * .3;
      if (vSpike > 0.) { vec2 q = mat2(.956, -.292, .292, .956) * p; float L = vSpan * .16;
        a += (exp(-abs(q.y) / .7) * exp(-abs(q.x) / L) + exp(-abs(q.x) / .7) * exp(-abs(q.y) / L)) * vSpike; }
      a *= vB * smoothstep(vSpan * .5, vSpan * .3, d); if (a < .003) discard; gl_FragColor = vec4(vC * a, 1.); }` }));
  starPts.frustumCulled = false; disk.add(starPts);

  // runaways: Legendary Legacy players on their own fast Kepler orbits, bow shock driven by their real 3D velocity
  const TRAIL = 90, LAG = .05, runners = pts.filter(p => p.runaway);
  function orbitAt(o, t, out) {
    const M = o.ph + o.w * t; let E = M;
    for (let k = 0; k < 6; k++) E -= (E - o.e * Math.sin(E) - M) / (1 - o.e * Math.cos(E));
    const x = o.a * (Math.cos(E) - o.e), y = o.b * Math.sin(E), y1 = y * Math.cos(o.inc), z1 = y * Math.sin(o.inc);
    out[0] = x * Math.cos(o.node) - y1 * Math.sin(o.node); out[1] = x * Math.sin(o.node) + y1 * Math.cos(o.node); out[2] = z1; return out;
  }
  runners.forEach(p => {
    const r = rng(p.u.h ^ 0x77), [x, y] = place(p), e = .55 + r() * .2, apo = Math.max(.45 * RG, Math.hypot(x, y) * 1.1), a = apo / (1 + e);
    const P = Math.min(110, Math.max(30, 70 * (a / 45) ** 1.5));
    p.orbit = { a, e, b: a * Math.sqrt(1 - e * e), inc: .55 + r() * .6, node: r() * 6.283, ph: r() * 6.283, w: (r() < .5 ? -1 : 1) * 6.283 / P, mean: 6.283 * a / P };
  });
  const vRef = runners.map(p => p.orbit.mean).sort((m, n) => m - n)[Math.floor(runners.length / 2)] || 1;
  const nR = runners.length, headGeo = new THREE.BufferGeometry(), rcol = new Float32Array(nR * 3), rcore = new Float32Array(nR);
  runners.forEach((p, i) => { rcol.set([p.col.r, p.col.g, p.col.b], i * 3); rcore[i] = BANDS[p.b].core * 1.15; });
  for (const [k, a, m] of [['position', new Float32Array(nR * 3), 3], ['color', rcol, 3], ['core', rcore, 1], ['dir', new Float32Array(nR * 2), 2], ['shock', new Float32Array(nR * 3), 3], ['vis', new Float32Array(nR).fill(1), 1]]) headGeo.setAttribute(k, new THREE.BufferAttribute(a, m));
  const heads = new THREE.Points(headGeo, new THREE.ShaderMaterial({ uniforms: U, ...addOne,
    vertexShader: `attribute vec3 color, shock; attribute float core, vis; attribute vec2 dir; uniform float uPR; varying vec3 vC, vSh; varying float vCore, vVis; varying vec2 vDir;
    void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_PointSize = 72. * uPR; vC = color; vCore = core; vDir = dir; vVis = vis; vSh = shock; }`,
    fragmentShader: `uniform float uTime; varying vec3 vC, vSh; varying float vCore, vVis; varying vec2 vDir;
    void main(){ vec2 p = (gl_PointCoord - .5) * 72.; float d = length(p);
      float a = (exp(-d * d / (vCore * vCore)) + exp(-d / (vCore * 2.4)) * .35) * 2.;
      float fs = vSh.x, sp = max(vSh.y, .2), away = vSh.z, R0 = clamp(9. / sp, 5., 15.);
      vec2 f = normalize(vDir + vec2(1e-5)); float ahead = dot(p, f) / max(fs, .2), side = dot(p, vec2(-f.y, f.x));
      float sh = ahead - (R0 - side * side * clamp(sp, .5, 2.5) / (2.4 * R0));
      float cres = exp(-sh * sh / 2.) * smoothstep(-R0 * 1.8, R0 * .2, ahead) * exp(-abs(side) / (R0 * 1.4));
      float ring = exp(-(d - R0 * 1.1) * (d - R0 * 1.1) / 3.) * .7;
      float bow = mix(ring, cres, smoothstep(.15, .75, fs)) * (1. - .35 * away) * clamp(.25 + .75 * sp * sp, .2, 2.4);
      vec3 c = vC * a + vec3(.5, .85, 1.15) * bow * (1. + .15 * sin(uTime * 3.));
      gl_FragColor = vec4(c * vVis * smoothstep(36., 24., d), 1.); }` }));
  heads.frustumCulled = false; tilt.add(heads);
  const trailBase = new Float32Array(nR * TRAIL), white = new THREE.Color(1, 1, 1);
  const trail = soft(nR * TRAIL, (i, c) => { const p = runners[Math.floor(i / TRAIL)], k = (i % TRAIL) / TRAIL; c.copy(p.col).lerp(white, .35 * (1 - k)); trailBase[i] = .5 * (1 - k) ** 1.7; return { p: [0, 0, 0], s: .8 - .55 * k, a: trailBase[i] }; }, THREE.AdditiveBlending);
  trail.frustumCulled = false; tilt.add(trail);
  const o3 = [0, 0, 0], a3 = new THREE.Vector3(), b3 = new THREE.Vector3(), mv4 = new THREE.Matrix4();
  function moveRunners(ts) {
    const hp = headGeo.attributes.position.array, tp = trail.geometry.attributes.position.array;
    runners.forEach((p, i) => { p.local = orbitAt(p.orbit, ts, [0, 0, 0]); hp.set(p.local, i * 3); for (let k = 0; k < TRAIL; k++) tp.set(orbitAt(p.orbit, ts - k * LAG, o3), (i * TRAIL + k) * 3); });
    headGeo.attributes.position.needsUpdate = trail.geometry.attributes.position.needsUpdate = true;
  }
  function aimShocks(ts) {
    camera.updateMatrixWorld(); mv4.multiplyMatrices(camera.matrixWorldInverse, tilt.matrixWorld);
    const dir = headGeo.attributes.dir.array, sk = headGeo.attributes.shock.array, dt = .05;
    runners.forEach((p, i) => {
      const next = orbitAt(p.orbit, ts + dt, o3);
      a3.set(...p.local).applyMatrix4(tilt.matrixWorld).project(camera); b3.set(...next).applyMatrix4(tilt.matrixWorld).project(camera);
      dir[i * 2] = (b3.x - a3.x) * W; dir[i * 2 + 1] = -(b3.y - a3.y) * H;
      a3.set(...p.local).applyMatrix4(mv4); b3.set(...next).applyMatrix4(mv4); b3.sub(a3);
      const v = b3.length(); p.speed = v / dt / vRef;
      sk.set([Math.hypot(b3.x, b3.y) / (v || 1), p.speed, Math.max(0, -b3.z / (v || 1))], i * 3);
    });
    headGeo.attributes.dir.needsUpdate = headGeo.attributes.shock.needsUpdate = true;
  }

  // Draw in a fixed order: dust lanes first, then arms, player stars and the rest in build order. Left alone,
  // three.js sorts see-through layers by their bounding-sphere centres; those sit a little off the core and swap
  // depth as the disk turns, so the look changed the longer the page stayed open.
  let order = 0; scene.traverse(o => { o.renderOrder = o.userData.under ? -1 : order++; });

  // ---- state -------------------------------------------------------------------------------------
  const ctx = overlay.getContext('2d'), LR = 140, tagMemory = new Map(), bandHex = BANDS.map(B => '#' + kelvin(B.K).getHexString());
  let W = 0, H = 0, D = 160, camX = 0, camY = 0, mx = -1e4, my = -1e4, mode = 'ui', shift = 0, solo = null, found = null;
  let pin = null, flashes = [], lock = null, boxes = [], hot = null, dive = null, rise = null, diveStar = null, diveP = null, diveAmt = 0, t0 = performance.now(), dirty = true;
  const shown = p => solo == null || solo === BANDS[p.b].key || (solo === 'runaway' && p.runaway) || (solo === 'quasar' && p === quasar);
  const spriteFade = p => p === diveP ? 1 - Math.min(1, Math.max(0, (diveAmt - .05) / .2)) : 1;
  function refreshVis() {
    const v = geo.attributes.vis; pts.forEach((p, i) => { v.array[i] = p.orbit ? 0 : (shown(p) ? 1 : .1) * spriteFade(p); }); v.needsUpdate = true;
    const hv = headGeo.attributes.vis, ta = trail.geometry.attributes.alpha;
    runners.forEach((p, i) => { const k = (shown(p) ? 1 : .1) * spriteFade(p); hv.array[i] = k; for (let j = 0; j < TRAIL; j++) ta.array[i * TRAIL + j] = trailBase[i * TRAIL + j] * k; });
    hv.needsUpdate = ta.needsUpdate = true;
  }
  const shiftTarget = () => mode === 'ui' && W >= 900 && !dive && !rise ? W * .17 : 0; // UI mode: galaxy sits right of the copy

  function resize() {
    W = innerWidth; H = innerHeight;
    renderer.setSize(W, H, false); composer.setSize(W, H); camera.aspect = W / H;
    const tanH = Math.tan(FOV * Math.PI / 360), hv = RG * H / (.62 * Math.max(W, H)); D = hv / (2 * tanH);
    camera.updateProjectionMatrix(); U.uScale.value = H * PR / (2 * tanH);
    const bh = 2 * (D + 900) * tanH * 1.25, bw = Math.max(bh * W / H, bh * 1200 / 860) * 1.15; back.scale.set(bw, bw * 860 / 1200, 1);
    const dpr = Math.min(2, devicePixelRatio || 1); overlay.width = W * dpr; overlay.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (shift === 0 || still) shift = shiftTarget();
    kick();
  }

  // ---- the dive (punch in) and the rise (coming back from a profile) ------------------------------
  const w3 = new THREE.Vector3(), up3 = new THREE.Vector3(), dir3 = new THREE.Vector3(), look3 = new THREE.Vector3(), c3 = new THREE.Vector3(), v3 = new THREE.Vector3();
  const SPOTS = [.8, .7, .6, .4, .25, .1, 0];
  const profileUrl = p => `profile.html?u=${encodeURIComponent(p.u.name)}&from=galaxy`;
  function makeDiveStar(p, RW) {
    const q = p === quasar, B = BANDS[p.b], c = kelvin(q ? 16000 : B.K), heat = q ? 2.4 : B.heat, g = new THREE.Group();
    const corona = new THREE.Mesh(new THREE.PlaneGeometry(RW / .3 * 2, RW / .3 * 2), coronaMat(U.uTime, c, c, heat));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(RW, 64, 48), starMat(U.uTime, c, .7 + heat * .38, SPOTS[p.b])), corona); scene.add(g);
    g.traverse(o => { o.renderOrder = 1e6; }); // the star you dive into draws over the galaxy
    diveStar = { g, corona, R: q ? 1.2 : B.R };
  }
  function flyCam(t) {
    const f = dive || rise;
    if (!f) { zoomPass.uniforms.uAmt.value = 0; U.uClip.value = .001; U.uBig.value = 0; bloom.strength = .7; bloom.threshold = 1; diveP = null; diveAmt = 0; if (diveStar) { scene.remove(diveStar.g); diveStar = null; } return; }
    const st = w3.set(...f.p.local).applyMatrix4(f.p.orbit ? tilt.matrixWorld : disk.matrixWorld);
    const proj = H / (2 * Math.tan(FOV * Math.PI / 360)), d0 = camera.position.distanceTo(st);
    if (f.t0 == null) { f.t0 = t; const cr = f.p === quasar ? 2.5 : BANDS[f.p.b].core * (f.p.orbit ? 1.15 : 1); f.rw = cr * .9 * d0 / proj; makeDiveStar(f.p, f.rw); }
    // dive: rush through the galaxy, then a long slow final approach (ease-out); rise: leave gently, then speed up
    const k = Math.min(1, (t - f.t0) / (dive ? 2200 : 2400)), amt = dive ? 1 - (1 - k) ** 3 : 1 - k * k * (3 - 2 * k);
    const dEnd = f.rw * proj / (Math.min(H * .13, W * .2) * diveStar.R), dist = d0 * Math.pow(dEnd / d0, amt);
    dir3.copy(camera.position).sub(st).normalize(); camera.position.copy(st).addScaledVector(dir3, dist);
    look3.set(0, 0, 0).lerp(st, Math.min(1, amt * 1.6)); camera.lookAt(look3); camera.updateMatrixWorld();
    up3.setFromMatrixColumn(camera.matrixWorld, 1); // end with the star where the profile puts it (~a third down)
    look3.addScaledVector(up3, -(.5 - (W < 860 ? .3 : .32)) * H * dist / proj * Math.max(0, (amt - .4) / .6)); camera.lookAt(look3); camera.updateMatrixWorld();
    diveStar.g.position.copy(st); diveStar.g.visible = amt > .04; diveStar.corona.quaternion.copy(camera.quaternion);
    c3.copy(st).project(camera); zoomPass.uniforms.uCenter.value.set((c3.x + 1) / 2, (c3.y + 1) / 2);
    zoomPass.uniforms.uAmt.value = dive ? .2 * Math.min(1, k * 8) * (1 - k) ** 2 : .16 * Math.sin(Math.PI * k) ** 2;
    U.uClip.value = amt > .01 ? dist * .8 : .001; U.uBig.value = Math.min(1, amt * 2);
    bloom.strength = .7 - amt * .2; bloom.threshold = 1 + amt * .05; diveP = f.p; diveAmt = amt;
    if (flash) flash.style.opacity = dive ? Math.max(0, (k - .9) / .1) : Math.max(0, 1 - k / .1);
    if (k < 1) return;
    if (dive) { if (!f.gone) { f.gone = true; location.href = profileUrl(f.p); } } else rise = null;
  }

  // ---- overlay: reticle, pin wire, flashes, names ------------------------------------------------
  const nearest = (x, y) => pts.map(p => [Math.hypot(p.x - x, p.y - y), p]).filter(([d, p]) => d < LR && p !== quasar && !p.runaway && p !== found && shown(p))
    .sort((a, b) => a[0] - b[0]).slice(0, 8);
  function drawPin(t) {
    if (!pin || dive || rise) return;
    const r = pin.el.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > H) return;
    const p = pin.p, sx = p.x, sy = p.y; if (sx < -50 || sx > W + 50 || sy < -50 || sy > H + 50) return;
    const ex = Math.max(r.left, Math.min(sx, r.right)), ey = Math.max(r.top, Math.min(sy, r.bottom));
    const age = Math.min(1, (t - pin.t0) / 700), len = Math.hypot(ex - sx, ey - sy);
    ctx.save();
    if (len > 12) {
      const k = 1 - (1 - age) ** 3, hx = ex + (sx - ex) * k, hy = ey + (sy - ey) * k; // the wire shoots out from the card to the star
      const g = ctx.createLinearGradient(ex, ey, hx, hy); g.addColorStop(0, 'rgba(255,225,160,.85)'); g.addColorStop(1, 'rgba(255,225,160,.25)');
      ctx.strokeStyle = g; ctx.lineWidth = 1.2; ctx.setLineDash([5, 5]); ctx.lineDashOffset = -t * .03; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#ffe1a0'; ctx.beginPath(); ctx.arc(ex, ey, 3, 0, 6.283); ctx.fill();
    }
    if (age >= 1 || len <= 12) {
      const pulse = .5 + .5 * Math.sin(t * .005);
      ctx.strokeStyle = 'rgba(255,225,160,.95)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx, sy, 9 + pulse * 2, 0, 6.283); ctx.stroke();
      ctx.globalAlpha = .4 * (1 - pulse); ctx.beginPath(); ctx.arc(sx, sy, 14 + pulse * 10, 0, 6.283); ctx.stroke();
    }
    ctx.restore();
  }
  function drawFlashes(t) {
    flashes = flashes.filter(f => t - f.t0 < 1600);
    for (const f of flashes) {
      const k = (t - f.t0) / 1600, p = f.p, c = f.gold ? '255,214,140' : '207,233,255';
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 40); g.addColorStop(0, `rgba(${c},${.9 * (1 - k)})`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 40, 0, 6.283); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = `rgba(${c},${.8 * (1 - k)})`; ctx.lineWidth = 2 * (1 - k) + .5;
      ctx.beginPath(); ctx.arc(p.x, p.y, 8 + k * 70, 0, 6.283); ctx.stroke();
      ctx.restore();
    }
  }
  function drawFound(t) {
    if (!found || dive || rise) return;
    ctx.save(); ctx.globalAlpha = .95; ctx.strokeStyle = '#ffc53d'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]); ctx.lineDashOffset = -t * .01;
    ctx.beginPath(); ctx.arc(found.x, found.y, 13 + 2 * Math.sin(t * .003), 0, 6.283); ctx.stroke(); ctx.restore();
  }
  function labels() {
    boxes = [];
    if (mode !== 'explore' || dive || rise) { lock = null; return; }
    const avoid = [...document.querySelectorAll('[data-avoid]')].filter(e => e.offsetParent || getComputedStyle(e).position === 'fixed').map(e => e.getBoundingClientRect()).filter(r => r.width);
    const put = tagger(ctx, quasar ? quasar.x : W / 2, quasar ? quasar.y : H / 2, W, H, avoid, tagMemory), tag = (p, o) => put(p.x, p.y, p.u.name, { id: p.u.name, hot: hot === p.u.name, ...o });
    if (lock) {
      ctx.save(); ctx.beginPath(); ctx.arc(lock.x, lock.y, LR, 0, 6.283); ctx.fillStyle = 'rgba(255,225,160,.05)'; ctx.fill();
      ctx.globalAlpha = .85; ctx.strokeStyle = '#ffe1a0'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]); ctx.lineDashOffset = -performance.now() * .008; ctx.stroke(); ctx.restore();
    }
    if (found) tag(found, { sub: `#${found.rank + 1}`, color: '#ffc53d', dot: '#ffc53d', edge: 'rgba(255,197,61,.85)', line: 'rgba(255,197,61,.75)', bold: true, reach: [40, 64, 90, 120, 160, 220, 300] });
    if (quasar && shown(quasar)) tag(quasar, { sub: 'QUASAR', dot: '#ffffff', edge: 'rgba(207,233,255,.65)', subColor: '#cfe9ff', bold: true, reach: [70, 100, 130] });
    for (const p of runners) if (shown(p)) tag(p, { sub: 'LEGENDARY', dot: '#9fdcff', edge: 'rgba(159,220,255,.55)', subColor: '#9fdcff', reach: [24, 44, 70, 100] });
    const pop = lock ? lock.set.map(p => [0, p]) : nearest(mx, my);
    for (const [d, p] of pop) tag(p, { sub: `#${p.rank + 1}`, dot: bandHex[p.b], alpha: lock ? 1 : Math.min(1, 1.4 * (1 - d / LR)), bold: d < 14 });
    boxes = put.boxes;
    if (lock) { const ids = new Set(lock.set.map(p => p.u.name)); lock.boxes = boxes.filter(b => ids.has(b.id)); }
  }
  function inLock(x, y) {
    if (Math.hypot(x - lock.x, y - lock.y) <= LR) return true;
    return lock.boxes.some(b => {
      const nx = Math.max(b.x, Math.min(x, b.x + b.w)), ny = Math.max(b.y, Math.min(y, b.y + b.h)); if (Math.hypot(x - nx, y - ny) < 18) return true;
      const ex = b.x + b.w / 2 - lock.x, ey = b.y + b.h / 2 - lock.y, k = Math.max(0, Math.min(1, ((x - lock.x) * ex + (y - lock.y) * ey) / (ex * ex + ey * ey || 1)));
      return Math.hypot(x - lock.x - ex * k, y - lock.y - ey * k) < 26;
    });
  }
  const pillAt = (x, y) => boxes.find(b => x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4); // a little slack: pills drift with the spin

  // ---- frame -------------------------------------------------------------------------------------
  function frame(now) {
    const t = still ? 8000 : now - t0;
    U.uTime.value = t / 1000; disk.rotation.z = t / 1000 * SPIN;
    const tx = mx > -1e3 ? (mx / W - .5) : 0, ty = my > -1e3 ? (my / H - .5) : 0, par = mode === 'explore' ? 1 : .5;
    camX += (tx * 7 * par - camX) * .04; camY += (ty * -4 * par - camY) * .04;
    camera.position.set(camX, camY, D); camera.lookAt(0, 0, 0);
    const st = shiftTarget(); shift += (st - shift) * (still ? 1 : .06);
    if (Math.abs(shift) > .5) camera.setViewOffset(W, H, -shift, 0, W, H); else camera.clearViewOffset();
    flyCam(t); nucleus.quaternion.copy(camera.quaternion);
    const qv = !quasar ? 0 : solo == null || solo === 'quasar' ? 1 : .12;
    JU.uStr.value = qv; nucleus.material.uniforms.uA.value = 1.4 * qv; refreshVis();
    moveRunners(t / 1000); scene.updateMatrixWorld(); aimShocks(t / 1000);
    composer.render();
    for (const p of pts) { v3.set(...p.local).applyMatrix4(p.orbit ? tilt.matrixWorld : disk.matrixWorld).project(camera); p.x = (v3.x + 1) / 2 * W; p.y = (1 - v3.y) / 2 * H; }
    ctx.clearRect(0, 0, W, H);
    drawFound(t); drawFlashes(t); drawPin(t); labels();
    dirty = false;
    if (!still || dive || rise) requestAnimationFrame(frame);
  }
  function kick() { if (still && !dirty) { dirty = true; requestAnimationFrame(frame); } } // reduced motion: draw on demand

  // ---- input (explore mode only) -------------------------------------------------------------------
  addEventListener('pointermove', e => {
    mx = e.clientX; my = e.clientY;
    if (mode !== 'explore') return;
    if (lock && !inLock(mx, my)) lock = null;
    const b = e.target === overlay ? pillAt(mx, my) : null; hot = b ? b.id : null; overlay.style.cursor = b ? 'pointer' : '';
    kick();
  });
  overlay.addEventListener('pointerleave', () => { if (!lock) { mx = my = -1e4; kick(); } });
  overlay.addEventListener('click', e => {
    if (mode !== 'explore' || dive || rise) return;
    const b = pillAt(e.clientX, e.clientY); if (b) return api.punch(b.id);
    const set = nearest(e.clientX, e.clientY).map(([, p]) => p); lock = set.length ? { x: e.clientX, y: e.clientY, set, boxes: [] } : null; kick();
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') { lock = null; kick(); } });
  addEventListener('resize', resize);
  addEventListener('pageshow', e => { if (e.persisted) { dive = null; if (flash) flash.style.opacity = 0; bloom.strength = .7; kick(); } });

  const info = p => p && {
    name: p.u.name, rank: p.rank + 1, of: N, earned: p.u.earned, band: BANDS[p.b], color: bandHex[p.b], quasar: p === quasar, runaway: p.runaway,
    next: p === quasar || p.b >= BANDS.length - 1 ? null : { band: BANDS[p.b + 1], more: BANDS[p.b + 1].min - p.u.earned },
  };
  const api = {
    get mode() { return mode; },
    setMode(m) { mode = m; overlay.style.pointerEvents = m === 'explore' ? 'auto' : 'none'; if (m !== 'explore') { lock = null; overlay.style.cursor = ''; } kick(); },
    get(name) { return info(byName.get(String(name || '').trim().replace(/^@/, '').toLowerCase())); },
    names() { return pts.map(p => p.u.name); },
    find(name) { const p = byName.get(String(name || '').trim().replace(/^@/, '').toLowerCase()) || null; found = p; kick(); return info(p); },
    flash(name, gold = false) { const p = !still && byName.get(String(name).toLowerCase()); if (p) flashes.push({ p, t0: performance.now() - t0, gold }); }, // reduced motion: no bursts
    pin(name, el) { const p = name && byName.get(String(name).toLowerCase()); pin = p && el ? { p, el, t0: still ? 0 : performance.now() - t0 } : null; kick(); },
    solo(key) { solo = solo === key ? null : key; kick(); return solo; },
    counts() { const c = BANDS.map((B, i) => ({ ...B, color: bandHex[i], n: pts.filter(p => p.b === i).length })); return { bands: c, runaways: runners.length, quasar: info(quasar), total: N }; },
    punch(name) {
      const p = byName.get(String(name).toLowerCase()); if (!p) return false;
      onDive?.(info(p));
      if (still) { location.href = profileUrl(p); return true; }
      found = p; lock = null; pin = null; dive = { p, t0: null }; return true;
    },
    rise(name) { const p = byName.get(String(name).toLowerCase()); if (!p) return; found = p; if (still) { if (flash) flash.style.opacity = 0; kick(); return; } rise = { p, t0: null }; if (flash) flash.style.opacity = 1; },
    kick,
    debug: () => ({ mode, boxes: boxes.map(b => ({ ...b })), lock: lock && { x: lock.x, y: lock.y }, hot }),
  };
  resize();
  requestAnimationFrame(frame);
  return api;
}
