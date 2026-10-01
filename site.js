/* Cosmic Playground v2. Public snapshots only; no bot API or authentication. */
(() => {
  'use strict';
  const app = document.getElementById('site-content');
  const page = document.body.dataset.page;
  const params = new URLSearchParams(location.search);
  const definitions = new Map(), earners = new Map(), profileCache = new Map();
  let users = {}, meta = {}, recent = [], categories = [], saved = null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = value => Number(value || 0).toLocaleString();
  const categoryLabel = value => ({cheer:'Bits',donation:'Donations',gifted:'Gifted subs',redeem:'Redeems',specific:'Special'}[value] || (value[0]?.toUpperCase() + value.slice(1)));
  const symbols = {chat:'✦',attend:'100',attendance:'✧',cheer:'ϟ',donation:'♡',gifted:'✧',redeem:'♡',gamble:'◇'};
  const fmtDate = value => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}) : 'Unknown date';
  const relative = value => {
    const days = Math.max(0,Math.floor((Date.now()-Date.parse(value))/86400000));
    return days === 0 ? 'Today' : days < 30 ? `${days} ${days === 1 ? 'day' : 'days'} ago` : fmtDate(value);
  };
  const href = (file,key,value) => `${file}.html?${key}=${encodeURIComponent(value)}`;
  function name(uid, linked = true) {
    const user = users[uid] || {username:String(uid),legacy:0};
    const tier = Number(user.legacy) >= 2 ? 2 : Number(user.legacy) >= 1 ? 1 : 0;
    const markup = `<span class="name${tier ? ` legacy-${tier}` : ''}">${esc(user.username)}</span>`;
    return linked ? `<a href="${href('profile','user',user.username)}">${markup}</a>` : markup;
  }
  function tier(uid) {
    const value = Number(users[uid]?.legacy || 0);
    return value >= 2 ? '<span class="tier">✧ Legendary Legacy</span>' : value >= 1 ? '<span class="tier legacy">✦ Legacy</span>' : '';
  }
  function earnedCount(uid) {
    return Object.keys({...users[uid].achievements.earned,...users[uid].achievements.founded}).filter(id=>definitions.has(id)).length;
  }
  function avatar(uid) {
    const user = users[uid];
    let url;
    try { url = new URL(user?.pfp_url); } catch { url = null; }
    return url?.protocol === 'https:' ? `<img class="avatar" src="${esc(url.href)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="avatar" aria-hidden="true">${esc(user?.username?.[0]?.toUpperCase() || '?')}</span>`;
  }
  function resolveUser(value) {
    if (!value) return null;
    if (Object.hasOwn(users,value)) return value;
    return Object.keys(users).find(uid => users[uid].username.toLowerCase() === value.trim().toLowerCase()) || null;
  }
  function remember(uid) {
    const user = users[uid];
    const dates = Object.values({...user.achievements.earned,...user.achievements.founded}).filter(t=>Number.isFinite(Date.parse(t))).sort((a,b)=>Date.parse(b)-Date.parse(a));
    saved = {userId:uid,username:user.username,lastAchievementDate:dates[0] || null};
    document.cookie = `myAchievementsUser=${encodeURIComponent(JSON.stringify(saved))};max-age=31536000;path=/;SameSite=Lax`;
    updateProfileNav();
  }
  function loadRemembered() {
    const cookie = document.cookie.split('; ').find(value=>value.startsWith('myAchievementsUser='));
    if (!cookie) return null;
    try { return JSON.parse(decodeURIComponent(cookie.slice(cookie.indexOf('=')+1))); }
    catch (error) { console.error('Could not read remembered profile; choosing a profile again will replace it.',error); return null; }
  }
  function updateProfileNav() {
    const link = document.getElementById('profile-nav');
    const uid = resolveUser(saved?.userId);
    link.href = uid ? href('profile','user',users[uid].username) : 'profile.html';
    link.innerHTML = uid ? name(uid,false) : 'Your profile';
  }
  function fail(error,context='Loading the site') {
    console.error(`${context} failed`,error);
    app.innerHTML = `<div class="error" role="alert"><h2>This section could not load.</h2><p>Your selection has not been changed. Reload to try again.</p><button id="retry" type="button">Reload page</button></div>`;
    document.getElementById('retry').addEventListener('click',()=>location.reload());
  }
  function on(selector,event,handler) {
    const element = app.querySelector(selector);
    if (element) element.addEventListener(event,ev=>{
      try { Promise.resolve(handler(ev)).catch(error=>fail(error,'Updating this section')); }
      catch(error) { fail(error,'Updating this section'); }
    });
  }
  async function json(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  }
  async function profile(uid) {
    if (!profileCache.has(uid)) profileCache.set(uid,await json(`users/${encodeURIComponent(uid)}.json`));
    return profileCache.get(uid);
  }
  function buildIndexes(achievements) {
    categories = Object.keys(achievements);
    for (const [category,items] of Object.entries(achievements)) for (const [id,def] of Object.entries(items)) {
      definitions.set(id,{...def,id,category}); earners.set(id,[]);
    }
    for (const [uid,user] of Object.entries(users)) {
      const records = {...user.achievements?.earned,...user.achievements?.founded};
      for (const [id,date] of Object.entries(records)) {
        if (!definitions.has(id)) continue;
        const row = {uid,id,date,founder:Object.hasOwn(user.achievements?.founded || {},id)};
        earners.get(id).push(row);
        if (Number.isFinite(Date.parse(date))) recent.push(row);
      }
    }
    for (const records of earners.values()) records.sort((a,b)=>(Date.parse(a.date)||0)-(Date.parse(b.date)||0));
    recent.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date) || a.uid.localeCompare(b.uid) || a.id.localeCompare(b.id));
  }
  function finder(label='Find someone in the sky') {
    return `<form id="find-user" class="toolbar"><label for="user-query" class="muted">${esc(label)}</label><input id="user-query" name="user" placeholder="Twitch username or ID" autocomplete="off" list="user-suggestions"><datalist id="user-suggestions"></datalist><button type="submit">Find</button></form><div id="find-status" role="status" class="status"></div>`;
  }
  function wireFinder(destination='profile') {
    on('#user-query','input',event=>{
      const query = event.target.value.toLowerCase().trim();
      const suggestions = query ? Object.values(users).filter(u=>u.username.toLowerCase().includes(query)).slice(0,10) : [];
      app.querySelector('#user-suggestions').innerHTML = suggestions.map(u=>`<option value="${esc(u.username)}"></option>`).join('');
    });
    on('#find-user','submit',event=>{
      event.preventDefault();
      const uid = resolveUser(app.querySelector('#user-query').value);
      if (uid) location.href = href(destination,'user',users[uid].username);
      else app.querySelector('#find-status').textContent = 'No published profile matches that name. Try another username.';
    });
  }
  function card(id,uid=null,event=null) {
    const def = definitions.get(id), records = earners.get(id) || [];
    const user = uid && users[uid], founded = !!user && Object.hasOwn(user.achievements.founded || {},id);
    const date = user?.achievements.founded?.[id] || user?.achievements.earned?.[id];
    const platinum = def.name.startsWith('(Platinum)');
    const status = uid ? founded ? 'Founder' : date ? 'Earned' : 'Not earned' : platinum ? 'Platinum' : categoryLabel(def.category);
    const founder = records.find(record=>record.founder);
    return `<article class="achievement-card${founded ? ' founded' : ''}${platinum ? ' platinum' : ''}"><a href="${href('achievement','ach',id)}" class="achievement-art" aria-label="View ${esc(def.name)}"><span class="seal" aria-hidden="true">${esc(symbols[def.category] || '✦')}</span></a><div class="card-copy"><div class="card-meta"><span class="badge${founded ? ' founder' : ''}">${esc(status)}</span><span>${records.length} earners${records.length ? ` · ${(records.length/Math.max(Object.keys(users).length,1)*100).toFixed(1)}%` : ''}</span></div><h3><a href="${href('achievement','ach',id)}">${esc(def.name.replace(/^\(Platinum\)\s*/,''))}</a></h3><p>${esc(def.desc || '')}</p><div class="card-bottom">${event ? `${name(event.uid)}<small>${esc(relative(event.date))}</small>` : date ? `<small>Unlocked ${esc(fmtDate(date))}</small>` : founder ? `<small>First: ${name(founder.uid)}</small>` : '<small>Discovered achievement</small>'}</div></div></article>`;
  }
  function supporters() {
    return `<section class="supporters" aria-label="Top supporters by highest unlocked achievement milestone">${['cheer','donation','gifted'].map(category=>{
      const winners = [];
      for (const [uid,user] of Object.entries(users)) {
        let best;
        for (const [id,date] of Object.entries({...user.achievements.earned,...user.achievements.founded})) {
          const def = definitions.get(id);
          if (!def || !id.startsWith(category) || !Number.isFinite(Number(def.amount)) || Number(def.amount)<=0) continue;
          if (!best || Number(def.amount)>Number(best.def.amount)) best = {uid,def,date};
        }
        if (best) winners.push(best);
      }
      winners.sort((a,b)=>Number(b.def.amount)-Number(a.def.amount) || (Date.parse(b.date)||0)-(Date.parse(a.date)||0) || a.uid.localeCompare(b.uid));
      const winner = winners[0];
      const amount = row => category === 'donation' ? `$${number(row.def.amount)}` : number(row.def.amount);
      return `<article class="supporter"><div class="supporter-category">${esc(symbols[category])} ${categoryLabel(category)}</div>${winner ? `<div class="champion">${name(winner.uid)}</div>${tier(winner.uid)}<div class="amount">${amount(winner)} <small>${category === 'cheer' ? 'bits' : category === 'gifted' ? 'gifted subs' : 'milestone'}</small></div><a class="milestone" href="${href('achievement','ach',winner.def.id)}">${esc(winner.def.name)}</a>${winners.slice(1,3).map(row=>`<div class="support-next">${name(row.uid)}<small>${amount(row)} milestone</small></div>`).join('')}` : '<p class="muted">No published milestones yet.</p>'}</article>`;
    }).join('')}</section>`;
  }
  function home() {
    const latest = recent[0], def = latest && definitions.get(latest.id);
    const neighbors = Object.keys(users).filter(uid=>uid!==latest?.uid).sort((a,b)=>Number(users[b].legacy)-Number(users[a].legacy)).slice(0,4);
    const uid = resolveUser(saved?.userId);
    app.innerHTML = `<section class="home-hero"><div><h1>Look what we’ve<br>unlocked together.</h1><p>Little moments, first discoveries, and the people who make this corner of the internet ours.</p><div class="actions"><a class="primary" href="${uid ? `${href('community','user',users[uid].username)}#community-sky` : 'community.html'}">Find my star</a><a href="achievements.html">Explore achievements</a></div><div class="home-counts"><b>${definitions.size}</b> discoveries / ${number(meta.total_achievements || definitions.size)} to find · ${number(meta.total_users || Object.keys(users).length)} players tracked</div></div><div class="featured-sky" aria-label="Most recent published achievement unlock"><div class="orbit" aria-hidden="true"></div><div class="orbit" aria-hidden="true"></div>${neighbors.map((id,i)=>`<span class="feature-neighbor ${['first','second','third','fourth'][i]}">${name(id)}</span>`).join('')}${latest ? `<span class="feature-point" aria-hidden="true"></span><div class="feature-user">${name(latest.uid)}</div><div class="feature-peek"><small>Most recent unlock · ${esc(relative(latest.date))}</small><h3><a href="${href('achievement','ach',def.id)}">${esc(def.name)}</a></h3><small>${name(latest.uid)}${latest.founder ? ' · Founder' : ''}</small>${tier(latest.uid)}</div>` : '<p class="muted">The first discovery will light up this sky.</p>'}</div></section><div class="section-head"><h2>The people fuelling the stars</h2><small>Highest unlocked milestones</small></div>${supporters()}<div class="section-head"><h2>Recently unlocked</h2><a href="community.html#activity">View all ↗</a></div><div class="achievement-grid">${recent.slice(0,3).map(row=>card(row.id,null,row)).join('') || '<p class="empty">No published unlocks yet.</p>'}</div><section class="style-teaser"><div><h2>Your achievements look good on you.</h2><p class="muted">Turn your unlocked decorations into a name tag that feels like yours.</p><a href="${uid ? href('builder','user',users[uid].username) : 'builder.html'}">Explore your decorations ↗</a></div><div class="name-preview"><p>Find the look that feels like you.</p>${uid ? name(uid) + tier(uid) : '<a class="primary" href="profile.html">Find your profile</a>'}<small style="display:block;margin-top:10px">Your permanent Legacy treatment follows you across the site.</small></div></section>`;
  }
  function explorer() {
    let uid = params.has('user') ? resolveUser(params.get('user')) : resolveUser(saved?.userId);
    const state = {query:params.get('q') || '',category:params.get('category') || 'all',filter:params.get('filter') || 'all',sort:params.get('sort') || (uid ? 'recent' : 'name'),limit:36};
    app.innerHTML = `<header class="page-head"><h1>Discover the collection.</h1><p class="muted">${definitions.size} achievements have been found by the pack. The rest are still out there.</p></header>${finder('View someone’s achievements')}<div id="viewer"></div><div class="toolbar"><label for="achievement-search">Search achievements</label><input id="achievement-search" type="search" placeholder="Name or description" value="${esc(state.query)}"></div><div class="chips" id="categories"><button data-category="all" type="button">All</button>${categories.map(c=>`<button data-category="${esc(c)}" type="button">${esc(categoryLabel(c))}</button>`).join('')}</div><div class="result-head"><div class="chips" id="filters"><button data-filter="all" type="button">All</button><button data-filter="earned" type="button">Earned</button><button data-filter="founder" type="button">Founder</button></div><label>Sort <select id="sort"><option value="name">Name</option><option value="rarity">Rarest first</option><option value="recent">Recent unlocks</option><option value="founded">Recently founded</option></select></label></div><div class="status" id="result-status" role="status"></div><div class="achievement-grid" id="results"></div><div class="pagination"><button id="more" type="button">Show more achievements</button></div>`;
    function render() {
      const owned = uid && {...users[uid].achievements.earned,...users[uid].achievements.founded};
      let items = [...definitions.values()].filter(d=>(state.category==='all' || d.category===state.category) && `${d.name} ${d.desc || ''}`.toLowerCase().includes(state.query.toLowerCase()) && (state.filter==='all' || uid && (state.filter==='founder' ? Object.hasOwn(users[uid].achievements.founded,d.id) : Object.hasOwn(owned,d.id))));
      const foundedDate = id => (earners.get(id) || []).find(r=>r.founder)?.date;
      const unlockDate = id => uid ? owned[id] : recent.find(r=>r.id===id)?.date;
      items.sort((a,b)=>state.sort==='rarity' ? earners.get(a.id).length-earners.get(b.id).length || a.name.localeCompare(b.name) : ['recent','founded'].includes(state.sort) ? (Date.parse(state.sort==='recent' ? unlockDate(b.id) : foundedDate(b.id))||0)-(Date.parse(state.sort==='recent' ? unlockDate(a.id) : foundedDate(a.id))||0) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
      app.querySelector('#results').innerHTML = items.slice(0,state.limit).map(d=>card(d.id,uid)).join('') || '<p class="empty">No achievements match these choices.</p>';
      app.querySelector('#result-status').textContent = `${items.length} discovered achievements${uid ? ` for ${users[uid].username}` : ''}`;
      app.querySelector('#more').hidden = state.limit>=items.length;
      app.querySelector('#filters').hidden = !uid;
      app.querySelector('#sort').value = state.sort;
      for (const button of app.querySelectorAll('[data-category]')) button.setAttribute('aria-pressed',String(button.dataset.category===state.category));
      for (const button of app.querySelectorAll('[data-filter]')) button.setAttribute('aria-pressed',String(button.dataset.filter===state.filter));
      const url = new URL(location.href);
      for (const key of ['q','category','filter','sort']) url.searchParams.set(key,key==='q' ? state.query : state[key]);
      if (uid) url.searchParams.set('user',users[uid].username); else url.searchParams.delete('user');
      history.replaceState(null,'',url);
    }
    app.querySelector('#viewer').innerHTML = uid ? `<section class="viewer"><div><h2>${name(uid)}</h2>${tier(uid)}<small>${earnedCount(uid)} earned · of ${definitions.size} discovered</small></div><div class="actions"><button id="remember" type="button">This is me</button><a href="achievements.html?user=">Browse everyone’s discoveries</a></div></section>` : params.get('user') ? '<p class="error">That profile is not published. Showing the community collection.</p>' : '';
    wireFinder('achievements');
    on('#remember','click',event=>{remember(uid);event.target.textContent='Remembered ✓';});
    on('#achievement-search','input',event=>{state.query=event.target.value;state.limit=36;render();});
    on('#categories','click',event=>{const b=event.target.closest('[data-category]');if(b){state.category=b.dataset.category;state.limit=36;render();}});
    on('#filters','click',event=>{const b=event.target.closest('[data-filter]');if(b){state.filter=b.dataset.filter;state.limit=36;render();}});
    on('#sort','change',event=>{state.sort=event.target.value;state.limit=36;render();});
    on('#more','click',()=>{state.limit+=36;render();});
    render();
    if (uid && saved?.userId===uid && saved.lastAchievementDate) {
      const fresh = recent.find(row=>row.uid===uid && Date.parse(row.date)>Date.parse(saved.lastAchievementDate));
      if (fresh) { app.querySelector('#find-status').textContent=`New since your last visit: ${definitions.get(fresh.id).name}`;remember(uid); }
    }
  }
  async function detail() {
    const def = definitions.get(params.get('ach'));
    if (!def) { app.innerHTML='<div class="page-head"><h1>Achievement not found.</h1><a class="primary" href="achievements.html">Browse discovered achievements</a></div>';return; }
    document.title = `${def.name} · Cosmic Playground`;
    const records = earners.get(def.id), founder = records.find(r=>r.founder), first = records[0];
    const condition = def.type && def.amount != null ? `${{threshold:'Reach',cumulative:'Accumulate',times:'Complete',exact:'Hit exactly'}[def.type] || 'Milestone:'} ${number(def.amount)}${def.type==='times' ? ' times' : ''}` : '';
    app.innerHTML = `<article class="detail"><header class="page-head"><small>${esc(categoryLabel(def.category))}</small><h1>${esc(def.name)}</h1><p class="muted">${esc(def.desc || '')}</p>${condition ? `<p class="condition">${esc(condition)}</p>` : ''}</header><div class="metrics"><div class="metric"><b>${records.length}</b><small>Earners</small></div><div class="metric"><b>${(records.length/Math.max(Object.keys(users).length,1)*100).toFixed(1)}%</b><small>of published profiles</small></div><div class="metric"><b style="font-size:22px">${first ? esc(fmtDate(first.date)) : '—'}</b><small>First unlocked</small></div></div>${founder ? `<section class="founder-feature"><small>First founder</small><h2>${name(founder.uid)}</h2>${tier(founder.uid)}<small>${esc(fmtDate(founder.date))}</small></section>` : ''}<div id="rewards" aria-live="polite"></div><div class="section-head"><h2>Unlocked by ${number(records.length)} people</h2></div><div id="earners"></div><button id="more-earners" class="pagination" type="button">Show more earners</button><p><a href="achievements.html">← All achievements</a></p></article>`;
    let limit = 30;
    function render() {app.querySelector('#earners').innerHTML=records.slice(0,limit).map(r=>`<div class="list-row"><div class="row-person">${avatar(r.uid)}<div>${name(r.uid)}${tier(r.uid)}${r.founder ? '<small>Founder</small>' : ''}</div></div><small>${esc(fmtDate(r.date))}</small></div>`).join('');app.querySelector('#more-earners').hidden=limit>=records.length;}
    on('#more-earners','click',()=>{limit+=30;render();});render();
    try {
      const catalog = await json('decoration_catalog.json');
      const rewards = Object.values(catalog).filter(item=>item.achievement_id===def.id);
      if (rewards.length) app.querySelector('#rewards').innerHTML=`<div class="section-head"><h2>Decoration rewards</h2></div>${rewards.map(r=>`<a class="reward-link" href="builder.html">${esc(r.display_name)} <small>· ${esc(r.slot.replaceAll('_',' '))} · Preview in Decorations ↗</small></a>`).join('')}`;
    } catch(error) {console.error('Loading decoration rewards failed',error);app.querySelector('#rewards').innerHTML='<p class="error">Decoration rewards could not load. <a href="builder.html">Open Decorations to try again.</a></p>';}
  }
  async function showProfile() {
    const uid = resolveUser(params.get('user') || saved?.userId);
    if (!uid) {app.innerHTML=`<header class="page-head"><h1>Your corner of the cosmos.</h1><p class="muted">Find your Twitch username, then remember your profile on this browser.</p></header>${finder('Find your profile')}`;wireFinder();return;}
    const user = await profile(uid), owned = {...user.achievements.earned,...user.achievements.founded};
    const count = Object.keys(owned).filter(id=>definitions.has(id)).length, founded = Object.keys(user.achievements.founded).filter(id=>definitions.has(id)).length;
    document.title = `${users[uid].username} · Cosmic Playground`;
    const timeline = recent.filter(row=>row.uid===uid);
    const byMonth = new Map();
    for (const row of timeline) {const month=row.date.slice(0,7);byMonth.set(month,(byMonth.get(month)||0)+1);}
    const months = [...byMonth.keys()].sort().slice(-12), max = Math.max(1,...months.map(m=>byMonth.get(m)));
    app.innerHTML=`<header class="profile-hero">${avatar(uid)}<div><h1>${name(uid,false)}</h1>${tier(uid)}<p class="muted">${count} of ${definitions.size} discovered achievements · ${founded} founded</p><div class="actions"><button id="remember" type="button">${saved?.userId===uid ? 'Forget this profile' : 'This is me'}</button><a href="${href('builder','user',users[uid].username)}">Choose your decorations ↗</a><a href="${href('community','user',users[uid].username)}#community-sky">Find this star ↗</a></div></div></header><div class="metrics"><div class="metric"><b>${count}</b><small>Total earned</small></div><div class="metric"><b>${founded}</b><small>Founded</small></div><div class="metric"><b>${Math.round(count/Math.max(definitions.size,1)*100)}%</b><small>of discovered achievements</small></div></div><div class="section-head"><h2>Latest accomplishments</h2><a href="${href('achievements','user',users[uid].username)}">Full collection ↗</a></div><div class="achievement-grid">${timeline.slice(0,3).map(r=>card(r.id,uid)).join('') || '<p class="empty">No discovered achievements yet.</p>'}</div><div class="split"><section><h2>By category</h2>${categories.map(c=>{const ids=[...definitions.values()].filter(d=>d.category===c).map(d=>d.id),earned=ids.filter(id=>Object.hasOwn(owned,id)).length;return `<div class="list-row"><a href="${href('achievements','user',users[uid].username)}&category=${encodeURIComponent(c)}">${esc(categoryLabel(c))}</a><small>${earned} / ${ids.length}</small></div><div class="progress-track" role="img" aria-label="${esc(categoryLabel(c))}: ${earned} of ${ids.length}"><span style="width:${earned/Math.max(ids.length,1)*100}%"></span></div>`;}).join('')}</section><section><h2>Time with the pack</h2>${user.stats ? `<div class="list-row"><span>Messages sent</span><span>${number(user.stats.messages)}</span></div><div class="list-row"><span>Active months</span><span>${number(user.stats.active_months)}</span></div><div class="list-row"><span>First seen</span><span>${esc(user.stats.first_seen?.slice(0,7) || '—')}</span></div>` : '<p class="muted">No stream statistics published.</p>'}<h3 style="margin-top:30px">Achievements by month</h3><div class="monthly-chart" role="img" aria-label="Monthly achievement unlock counts">${months.map(m=>`<div class="month-column"><b>${byMonth.get(m)}</b><div class="month-bar" style="height:${byMonth.get(m)/max*125}px"></div><small>${esc(m)}</small></div>`).join('') || '<p class="muted">No dated unlocks yet.</p>'}</div></section></div>${user.top_months?.length ? `<section><h2>Top of the month</h2>${user.top_months.map(m=>`<div class="list-row"><span>${esc(m.month.slice(0,7))} · ${esc({chat:'Top chatter',cheers:'Top cheerer',gifted:'Top gifter',donations:'Top supporter'}[m.kind] || m.kind)}</span><span>#${number(m.rank)}</span></div>`).join('')}</section>` : ''}<div class="section-head"><h2>Achievement timeline</h2></div><div id="timeline"></div><button id="more-timeline" class="pagination" type="button">Show more history</button>`;
    let limit=20;
    function render(){app.querySelector('#timeline').innerHTML=timeline.slice(0,limit).map(r=>`<div class="list-row"><div><a href="${href('achievement','ach',r.id)}">${esc(definitions.get(r.id).name)}</a>${r.founder ? '<span class="tier">Founder</span>' : ''}</div><small>${esc(fmtDate(r.date))}</small></div>`).join('');app.querySelector('#more-timeline').hidden=limit>=timeline.length;}
    on('#more-timeline','click',()=>{limit+=20;render();});render();
    on('#remember','click',event=>{if(saved?.userId===uid){document.cookie='myAchievementsUser=;max-age=0;path=/';saved=null;event.target.textContent='This is me';updateProfileNav();}else{remember(uid);event.target.textContent='Forget this profile';}});
  }
  function community() {
    let query='',limit=36;
    app.innerHTML=`<header class="page-head"><h1>Everyone has a place here.</h1><p class="muted">Every star is someone from the pack. Find a familiar name, or discover someone new.</p></header>${finder()}<div class="community-sky" id="community-sky" aria-label="Named community stars"></div><div class="status" id="sky-selection" role="status"></div><div class="toolbar"><label for="people-search">Find people</label><input id="people-search" type="search" placeholder="Search usernames"></div><div class="people-grid" id="people"></div><button id="more-people" class="pagination" type="button">Show more people</button><div class="section-head"><h2>Supporter milestones</h2><small>Highest unlocked achievements</small></div>${supporters()}<section id="activity"><div class="section-head"><h2>Recent unlocks</h2><small>Published activity</small></div>${recent.slice(0,30).map(r=>`<div class="list-row"><div>${name(r.uid)} unlocked <a href="${href('achievement','ach',r.id)}">${esc(definitions.get(r.id).name)}</a>${r.founder ? '<span class="badge founder"> · Founder</span>' : ''}</div><small>${esc(relative(r.date))}</small></div>`).join('') || '<p class="empty">No published activity yet.</p>'}</section>`;
    wireFinder('community');
    function render(){const ids=Object.keys(users).filter(id=>users[id].username.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>users[a].username.localeCompare(users[b].username));app.querySelector('#people').innerHTML=ids.slice(0,limit).map(id=>`<article class="person">${avatar(id)}<div>${name(id)}${tier(id)}<small>${earnedCount(id)} earned</small></div></article>`).join('') || '<p class="empty">No published usernames match.</p>';app.querySelector('#more-people').hidden=limit>=ids.length;}
    on('#people-search','input',event=>{query=event.target.value;limit=36;render();});on('#more-people','click',()=>{limit+=36;render();});render();
  }
  async function start() {
    const [achievements,snapshot,metadata] = await Promise.all([json('achievements.json'),json('community.json'),json('meta.json')]);
    if (snapshot.version!==1 || !snapshot.users || typeof snapshot.users!=='object') throw new Error('Unsupported community snapshot');
    users=snapshot.users;meta=metadata;saved=loadRemembered();buildIndexes(achievements);updateProfileNav();
    if(page==='home')home();else if(page==='achievements')explorer();else if(page==='achievement')await detail();else if(page==='profile')await showProfile();else if(page==='community')community();
    window.CosmicSky?.mount({users,name,resolveUser,selected:resolveUser(params.get('user')) || resolveUser(saved?.userId)});
  }
  start().catch(error=>fail(error));
})();
