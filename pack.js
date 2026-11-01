// Everything the site knows about the pack, worked out in the browser from what the bot already publishes
// (community.json, achievements.json, meta.json), so there are no extra generated files to keep in sync.
// The release build rewrites '' to the site root.
export const get = f => fetch('' + f).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); });

// A failed data load must be visible, not a blank page.
export function showLoadFailure() {
  if (document.getElementById('load-failure')) return;
  const bar = document.createElement('div');
  bar.id = 'load-failure'; bar.setAttribute('role', 'alert'); bar.textContent = 'Failed to load. Yell at Dog.';
  bar.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:9999;padding:10px 18px;'
    + 'border-radius:10px;border:1px solid #ffe1a0;background:#2a1418;color:#ffe1a0;font:600 15px/1.3 system-ui,sans-serif;'
    + 'box-shadow:0 6px 24px rgba(0,0,0,.5);max-width:calc(100vw - 32px);text-align:center';
  document.body.append(bar);
}

let cached = null;
export function loadPack() {
  return cached || (cached = (async () => {
    const [community, achDefs, meta] = await Promise.all([get('community.json'), get('achievements.json'), get('meta.json').catch(() => ({}))]);
    const defs = new Map();
    for (const [cat, items] of Object.entries(achDefs)) for (const [id, d] of Object.entries(items))
      defs.set(id, { ...d, id, cat, plat: /^\(Platinum\)/.test(d.name), name: d.name.replace(/^\(Platinum\)\s*/, '') });
    const users = community.users || {}, earners = new Map(), rows = [];
    for (const u of Object.values(users)) {
      const ids = new Set([...Object.keys(u.achievements?.earned || {}), ...Object.keys(u.achievements?.founded || {})].filter(id => defs.has(id)));
      ids.forEach(id => earners.set(id, (earners.get(id) || 0) + 1));
      rows.push([u.username, ids.size, Number(u.legacy) || 0]); // a star: [name, achievements, legacy tier]
    }
    const starmap = {
      total: meta.total_achievements || defs.size, discovered: defs.size, players: meta.total_users || rows.length, profiles: rows.length,
      categories: Object.entries(achDefs).map(([cat, items]) => ({ cat, stars: Object.entries(items).map(([id, d]) => [id, d.name, earners.get(id) || 0]) })),
    };
    return { achDefs, meta, defs, users, earners, rows, starmap };
  })());
}
