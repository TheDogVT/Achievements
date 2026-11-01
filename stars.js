// Shared star rules for the galaxy (bg-u5-gl.html) and the profile (profile.html): blackbody colours
// (Mitchell Charity, "What color is a blackbody?", CIE 1964 10°, D65), the achievement-count bands, and
// category names/tints. Change a band here and both pages follow.
import * as THREE from 'three';

export const BB = [[1000, 0xff3800], [1500, 0xff6d00], [2000, 0xff8912], [2500, 0xffa148], [3000, 0xffb46b], [3500, 0xffc489], [4000, 0xffd1a3], [4500, 0xffdbba], [5000, 0xffe4ce],
  [5500, 0xffecdf], [6000, 0xfff3ef], [6500, 0xfff9fd], [7000, 0xf5f3ff], [8000, 0xe3e9ff], [9000, 0xd6e1ff], [10000, 0xccdbff], [12000, 0xbfd3ff], [15000, 0xb3ccff], [20000, 0xa8c5ff]];
export const kelvin = K => { // sRGB colour of a blackbody, interpolated in the table
  let i = BB.findIndex(([k]) => k >= K); if (i <= 0) return new THREE.Color(BB[Math.max(0, i)][1]);
  const [k0, c0] = BB[i - 1], [k1, c1] = BB[i]; return new THREE.Color(c0).lerp(new THREE.Color(c1), (K - k0) / (k1 - k0));
};
// galaxy: core px, sprite span px, HDR brightness (white/blue bloom), diffraction spikes
// profile: R = sphere radius, heat = surface HDR multiplier
export const BANDS = [
  { key: 'proto', name: 'Protostar', range: '0', min: 0, K: 1000, core: 1, span: 16, b: .5, spike: 0, R: .6, heat: .55 },
  { key: 'ember', name: 'Ember', range: '1', min: 1, K: 1600, core: .85, span: 12, b: .38, spike: 0, R: .68, heat: .75 },
  { key: 'red', name: 'Red', range: '2–4', min: 2, K: 2300, core: 1, span: 14, b: .62, spike: 0, R: .76, heat: .95 },
  { key: 'orange', name: 'Orange', range: '5–19', min: 5, K: 3400, core: 1.25, span: 16, b: .95, spike: 0, R: .86, heat: 1.15 },
  { key: 'yellow', name: 'Yellow', range: '20–49', min: 20, K: 5200, core: 1.55, span: 22, b: 1.2, spike: .25, R: 1, heat: 1.35 },
  { key: 'white', name: 'White', range: '50–89', min: 50, K: 7000, core: 1.9, span: 40, b: 1.7, spike: .6, R: 1.14, heat: 1.7 },
  { key: 'blue', name: 'Blue-white', range: '90+', min: 90, K: 13000, core: 2.3, span: 52, b: 2.2, spike: .9, R: 1.3, heat: 2.1 },
];
export const bandOf = e => BANDS.reduce((b, x, i) => e >= x.min ? i : b, 0);
// achievement categories as the published data names them
export const CATS = {
  chat: ['Chat', '#3df5c8'], cheer: ['Bits', '#b65cff'], redeems: ['Redeems', '#ff9f43'], gifted: ['Gifted', '#ff4fa3'], donation: ['Donations', '#ffd25e'],
  gamble: ['Gamble', '#ff6b6b'], attendance: ['Attendance', '#3fa4ff'], quotes: ['Quotes', '#c9d2ff'], manual: ['Special', '#9aa3b8'],
};

// --- the star itself (profile hero, and the galaxy's punch-in dive): additive one/one blending for glows
const addOne = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor };
export const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;} vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);} vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){ const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx); vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy; i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx; vec4 j=p-49.*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y); vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.)); vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3))); p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m; return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3))); }`;

// a star: boiling granulated surface, darker limb, cool stars get spots; plus a camera-facing corona
export const starMat = (uTime, col, heat, spots) => new THREE.ShaderMaterial({
  uniforms: { uTime, uColor: { value: col }, uHeat: { value: heat }, uSpots: { value: spots } },
  vertexShader: `varying vec3 vN, vP, vV; void main(){ vN = normalize(normalMatrix * normal); vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: NOISE + `uniform float uTime, uHeat, uSpots; uniform vec3 uColor; varying vec3 vN, vP, vV;
    void main(){ vec3 p = normalize(vP); float mu = clamp(dot(vN, vV), 0., 1.);
      float g = snoise(p * 5. + vec3(0., 0., uTime * .18)) * .55 + snoise(p * 12. - uTime * .3) * .3 + snoise(p * 26. + uTime * .5) * .15;
      float spot = smoothstep(.5, .72, snoise(p * 1.6 + uTime * .02)) * uSpots;
      float I = (1. + g * .38) * (1. - spot * .7) * (.32 + .68 * pow(mu, .55));
      gl_FragColor = vec4(uColor * I * uHeat + uColor * pow(1. - mu, 4.) * .5 * uHeat, 1.); }` });
export const coronaMat = (uTime, col, tint, heat) => new THREE.ShaderMaterial({ ...addOne,
  uniforms: { uTime, uColor: { value: col }, uTint: { value: tint }, uHeat: { value: heat } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: NOISE + `uniform float uTime, uHeat; uniform vec3 uColor, uTint; varying vec2 vUv;
    void main(){ vec2 p = (vUv - .5) * 2.; float d = length(p), r0 = .3, a = atan(p.y, p.x);
      float rays = .55 + .45 * snoise(vec3(cos(a) * 2.2, sin(a) * 2.2, uTime * .12)); rays *= .75 + .25 * snoise(vec3(a * 4., d * 3. - uTime * .25, 3.));
      float glow = smoothstep(r0 * .97, r0 * 1.02, d) * (exp(-(d - r0) / .045) * .8 + exp(-(d - r0) / .16) * .22 * rays) * (1. - smoothstep(.8, 1., d));
      vec3 c = mix(uColor, uTint, smoothstep(r0, .7, d) * .8) * glow * (.45 + .3 * uHeat);
      gl_FragColor = vec4(c, 1.); }` });

// --- category icons: achievements are never drawn as stars (people are the stars). 24px line icons in
// currentColor, so callers tint them with the category colour.
const PAW = 'fill="currentColor" stroke="none"';
export const ICONS = {
  chat: '<path d="M4 5h16v11H11l-5 4v-4H4z"/>',
  cheer: '<path d="M7 4h10l4 5-9 11L3 9z"/><path d="M3 9h18M12 20L8.5 9 12 4l3.5 5z"/>',
  redeems: '<path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z"/><path d="M15 7v10" stroke-dasharray="2 2.5"/>',
  gifted: '<path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13"/><path d="M12 7C10 3 6 4 8 7M12 7c2-4 6-3 4 0"/>',
  donation: '<path d="M12 20s-7.5-4.6-9-9.3C2 7 5.5 4 9 5.6c1.3.6 2.3 1.6 3 2.7.7-1.1 1.7-2.1 3-2.7C18.5 4 22 7 21 10.7 19.5 15.4 12 20 12 20z"/>',
  gamble: `<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.4" ${PAW}/><circle cx="15" cy="9" r="1.4" ${PAW}/><circle cx="12" cy="12" r="1.4" ${PAW}/><circle cx="9" cy="15" r="1.4" ${PAW}/><circle cx="15" cy="15" r="1.4" ${PAW}/>`,
  attendance: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4M9 15l2 2 4-4"/>',
  quotes: '<path d="M5 18c2.2-1.2 3.3-3.2 3.3-5.5H5V7h5.5v5.5C10.5 15.6 8.6 17.9 5 18zM13.5 18c2.2-1.2 3.3-3.2 3.3-5.5h-3.3V7H19v5.5c0 3.1-1.9 5.4-5.5 5.5z"/>',
  manual: `<ellipse cx="12" cy="16.2" rx="4.3" ry="3.5" ${PAW}/><circle cx="6.3" cy="10.6" r="1.9" ${PAW}/><circle cx="9.8" cy="6.8" r="1.9" ${PAW}/><circle cx="14.2" cy="6.8" r="1.9" ${PAW}/><circle cx="17.7" cy="10.6" r="1.9" ${PAW}/>`,
};
export const catIcon = cat => `<svg class="cico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[cat] || ICONS.manual}</svg>`;
