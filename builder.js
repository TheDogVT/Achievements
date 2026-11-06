/* Decoration Workbench (mockup).
 *
 * Same contract as the live builder: reads the published catalog and a user's
 * public unlock list, renders with the shared decoration renderer, and only ever
 * builds a `!deco ...` chat command. Nothing is written back anywhere.
 */
(function () {
    'use strict';

    const DATA = '';
    const PIECES = ['name_prefix', 'name_base', 'name_suffix', 'message_text', 'card_background'];
    const TABS = [
        { key: 'sets', label: 'Sets' },
        { key: 'name_prefix', label: 'Prefix' },
        { key: 'name_base', label: 'Name' },
        { key: 'name_suffix', label: 'Suffix' },
        { key: 'message_text', label: 'Message' },
        { key: 'card_background', label: 'Card' },
        { key: 'washi', label: 'Washi' },
    ];
    const SLOT_NAMES = { name_prefix: 'Prefix', name_base: 'Name', name_suffix: 'Suffix', message_text: 'Message', card_background: 'Card', washi: 'Washi' };
    const CATEGORY_COLORS = {
        attendance: '#5eaee9', chat: '#62ead7', cheer: '#b886ff', donation: '#ffe1a0',
        gifted: '#d878a7', redeems: '#ff9f6b', manual: '#cab98f',
    };
    // Washi is a subscriber flourish that everyone can pick (same as the live builder's fallbacks)
    const WASHI_COLORS = [['washi_pink', 'Pink', 'pink'], ['washi_mint', 'Mint', 'mint'], ['washi_gold', 'Gold', 'gold'], ['washi_lavender', 'Lavender', 'lavender']];
    const WASHI_SPOTS = [['washi_top_left', 'Top left', 'top-left'], ['washi_top_center', 'Top center', 'top-center'], ['washi_top_right', 'Top right', 'top-right'], ['washi_corner_tl', 'Corner', 'corner-tl']];
    const WASHI_CSS = Object.fromEntries([...WASHI_COLORS, ...WASHI_SPOTS].map(([id, , css]) => [id, css]));
    const WASHI_LABEL = Object.fromEntries([...WASHI_COLORS, ...WASHI_SPOTS].map(([id, label]) => [id, label]));

    let catalog = {};
    let usernameMap = null;
    let user = null;
    let unlocked = new Set();
    let wearing = {};
    let pick = {};
    let tab = 'name_prefix';
    let category = '';
    let query = '';
    let founders = {};
    let siteMeta = {}; // meta.json: decoration_total is every earnable decoration
    let sets = [];
    let copyTimer = null;
    let chatFrame = null;
    let chatReady = false;
    let chatSeq = 0;

    const $ = id => document.getElementById(id);
    const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };
    const fetchJSON = path => fetch(DATA + path).then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    });
    // A failed data load must be visible, not a blank page.
    function showLoadFailure() {
      if (document.getElementById('load-failure')) return;
      const bar = document.createElement('div');
      bar.id = 'load-failure'; bar.setAttribute('role', 'alert'); bar.textContent = 'Failed to load. Yell at Dog.';
      bar.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:9999;padding:10px 18px;'
        + 'border-radius:10px;border:1px solid #ffe1a0;background:#2a1418;color:#ffe1a0;font:600 15px/1.3 system-ui,sans-serif;'
        + 'box-shadow:0 6px 24px rgba(0,0,0,.5);max-width:calc(100vw - 32px);text-align:center';
      document.body.append(bar);
    }
    const titleCase = s => String(s || '').replace(/[_-]+/g, ' ').replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
    const username = () => (user && user.username) || 'YourName';

    function textFor(slot, config) {
        if (slot === 'name_base') return username();
        if (slot === 'message_text') return 'Hello chat!';
        return config.text || '';
    }

    function paint(element, id, baseClass, text) {
        const translator = window.DECORATION_NAME_TRANSLATOR;
        if (!translator || !element) return;
        const config = id && catalog[id] ? { ...(catalog[id].config || {}) } : {};
        if (text !== undefined) config.text = text;
        translator.applyTagPresentation(element, config, baseClass);
    }

    // card background: same translation the live builder does (background_mode / class / renderer)
    function mountBackground(card, background, id) {
        card.classList.forEach(c => { if (c.startsWith('bg-card-')) card.classList.remove(c); });
        background.className = 'decor-background';
        background.removeAttribute('style');
        background.replaceChildren();
        if (window.PuppyCardBackgrounds) {
            window.PuppyCardBackgrounds.clear(card);
            window.PuppyCardBackgrounds.clear(background);
        }
        const option = id && catalog[id] ? catalog[id].config || {} : null;
        if (!option) return;
        String(option.background_class || '').split(/\s+/).filter(Boolean).forEach(c => {
            background.classList.add(c);
            if (c.startsWith('bg-chat-')) card.classList.add(c.replace(/^bg-chat-/, 'bg-card-'));
            if (c.startsWith('bg-card-')) card.classList.add(c);
        });
        const opacity = Number(option.opacity);
        background.style.opacity = Number.isFinite(opacity) ? String(opacity > 1 ? opacity / 100 : opacity) : '1';
        const mode = String(option.background_mode || '').toLowerCase();
        if (mode === 'solid' && option.background_solid_color) background.style.backgroundColor = option.background_solid_color;
        if (mode === 'gradient') {
            background.style.backgroundImage = `linear-gradient(${Number(option.background_gradient_angle) || 135}deg, ${option.background_gradient_start || 'rgba(255,255,255,.14)'}, ${option.background_gradient_end || 'rgba(0,0,0,.05)'})`;
        }
        if (option.background_renderer && window.PuppyCardBackgrounds) window.PuppyCardBackgrounds.mount(background, option.background_renderer);
    }

    // ── data ────────────────────────────────────────────────────────────
    // Only unlocked pieces are ever listed: what you haven't earned yet is for chat to tell you about.
    function entriesFor(slot) {
        const needle = query.trim().toLowerCase();
        return Object.entries(catalog)
            .filter(([id, e]) => e.slot === slot && unlocked.has(id))
            .map(([id, e]) => ({ id, e }))
            .filter(item => !category || item.e.achievement_category === category)
            .filter(item => !needle || [item.e.config?.text, item.e.achievement_name, item.e.display_name, founders[item.e.achievement_id]?.founder_name]
                .some(v => String(v || '').toLowerCase().includes(needle)))
            .sort((a, b) => String(a.e.achievement_category).localeCompare(String(b.e.achievement_category))
                || String(a.e.achievement_name).localeCompare(String(b.e.achievement_name)));
    }

    // the first person to earn an achievement; "YOU" when that's the person decorating
    function founderOf(achievementId) {
        const f = achievementId && founders[achievementId];
        if (!f || !f.founder_name) return null;
        return { name: f.founder_name, isYou: Boolean(user && String(f.founder_id) === String(user.id)) };
    }

    function founderLine(founder) {
        const line = el('span', 'tile-founder');
        line.append(document.createTextNode('Founded by '), el('b', '', founder.isYou ? 'YOU' : founder.name));
        line.title = founder.isYou ? 'You were the first to earn this' : `${founder.name} was the first to earn this`;
        return line;
    }

    function buildSets() {
        const byAchievement = new Map();
        Object.entries(catalog).forEach(([id, e]) => {
            if (!unlocked.has(id) || !PIECES.includes(e.slot) || !e.achievement_id) return;
            if (!byAchievement.has(e.achievement_id)) byAchievement.set(e.achievement_id, { key: e.achievement_id, name: e.achievement_name || e.achievement_id, category: e.achievement_category, pieces: {} });
            const group = byAchievement.get(e.achievement_id);
            if (!group.pieces[e.slot]) group.pieces[e.slot] = id;
        });
        sets = [...byAchievement.values()].filter(s => Object.keys(s.pieces).length > 1).sort((a, b) => a.name.localeCompare(b.name));
    }
    const setFor = achievementId => sets.find(s => s.key === achievementId);

    // ── tabs, chips ─────────────────────────────────────────────────────
    function tabCount(key) {
        if (key === 'sets') return sets.length;
        if (key === 'washi') return null;
        return Object.entries(catalog).filter(([id, e]) => e.slot === key && unlocked.has(id)).length;
    }

    function renderTabs() {
        const host = $('slot-tabs');
        host.replaceChildren();
        TABS.forEach(t => {
            const button = el('button', 'slot-tab');
            button.type = 'button';
            button.setAttribute('role', 'tab');
            button.dataset.tab = t.key;
            button.setAttribute('aria-selected', String(t.key === tab));
            button.tabIndex = t.key === tab ? 0 : -1;
            const hasPick = t.key === 'washi' ? Boolean(pick.washi_color) : t.key !== 'sets' && Boolean(pick[t.key]);
            button.classList.toggle('has-pick', hasPick);
            button.append(document.createTextNode(t.label));
            const count = tabCount(t.key);
            if (count !== null) button.append(el('span', 'count', String(count)));
            button.addEventListener('click', () => setTab(t.key));
            host.appendChild(button);
        });
        layoutTabs();
    }

    // hang the tabs on the panel edge only if the whole row fits; otherwise wrap them inside
    function layoutTabs() {
        const picker = document.querySelector('.picker');
        const host = $('slot-tabs');
        picker.classList.remove('tabs-inside');
        const needed = [...host.children].reduce((sum, tab) => sum + tab.offsetWidth, 0) + 4 * (host.children.length - 1);
        picker.classList.toggle('tabs-inside', needed > host.clientWidth);
    }

    function setTab(key) {
        tab = key;
        category = '';
        renderTabs();
        renderChips();
        renderGrid();
        const active = document.querySelector(`.slot-tab[data-tab="${key}"]`);
        if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    function renderChips() {
        const host = $('chips');
        host.replaceChildren();
        const usesCategories = !['washi'].includes(tab);
        host.hidden = !usesCategories;
        document.querySelector('.toolbar').hidden = tab === 'washi';
        if (!usesCategories) return;
        const items = tab === 'sets'
            ? sets.map(s => s.category)
            : Object.entries(catalog).filter(([id, e]) => e.slot === tab && unlocked.has(id)).map(([, e]) => e.achievement_category);
        const counts = items.reduce((acc, c) => { acc[c] = (acc[c] || 0) + 1; return acc; }, {});
        const make = (value, label, count) => {
            const chip = el('button', 'chip');
            chip.type = 'button';
            chip.setAttribute('aria-pressed', String(category === value));
            if (value) chip.style.setProperty('--c', CATEGORY_COLORS[value] || '#c99645');
            if (value) chip.appendChild(el('i'));
            chip.append(document.createTextNode(label));
            chip.append(el('small', '', String(count)));
            chip.addEventListener('click', () => { category = category === value ? '' : value; renderChips(); renderGrid(); });
            return chip;
        };
        host.appendChild(make('', 'All', items.length));
        Object.keys(counts).sort().forEach(c => host.appendChild(make(c, titleCase(c), counts[c])));
    }

    // ── grid ────────────────────────────────────────────────────────────
    function tileShell(slot, id, { label = '', categoryKey = '' } = {}) {
        const button = el('button', 'tile');
        button.type = 'button';
        button.dataset.slot = slot;
        button.dataset.id = id || '';
        if (categoryKey) button.style.setProperty('--c', CATEGORY_COLORS[categoryKey] || '#c99645');
        button.setAttribute('aria-pressed', String((pick[slot] || '') === (id || '')));
        const paper = el('span', 'tile-paper');
        const meta = el('span', 'tile-meta');
        if (categoryKey) {
            const catLine = el('span', 'tile-cat');
            catLine.append(el('i'), document.createTextNode(titleCase(categoryKey)));
            meta.appendChild(catLine);
        }
        meta.appendChild(el('span', 'tile-ach', label));
        button.append(paper, meta);
        button.addEventListener('click', event => {
            if (event.target.closest('.tile-set')) return;
            choose(slot, pick[slot] === id ? '' : id);
        });
        return { button, paper, meta };
    }

    function noneTile(slot) {
        const { button, paper } = tileShell(slot, '', { label: 'Leave this slot empty' });
        button.classList.add('is-none');
        paper.textContent = 'None';
        return button;
    }

    function decorationTile(item) {
        const { id, e } = item;
        const { button, paper, meta } = tileShell(e.slot, id, { label: e.achievement_name || e.display_name || id, categoryKey: e.achievement_category });
        button.title = `${e.achievement_name || ''}${e.config?.text ? ' · "' + e.config.text + '"' : ''}`;
        if (e.slot === 'card_background') {
            paper.classList.add('is-bg');
            const card = el('div', 'decor-card mini-card');
            const background = el('div', 'decor-background');
            card.appendChild(background);
            paper.appendChild(card);
            mountBackground(card, background, id);
        } else {
            if (e.slot === 'message_text') paper.classList.add('is-message');
            const inner = el('span', 'fit-inner');
            const tag = el('span');
            inner.appendChild(tag);
            paper.appendChild(inner);
            paint(tag, id, 'name-tag', textFor(e.slot, e.config || {}));
        }
        const founder = founderOf(e.achievement_id);
        if (founder) {
            meta.appendChild(founderLine(founder));
            button.classList.toggle('is-yours', founder.isYou);
        }
        const set = setFor(e.achievement_id);
        if (set) {
            const wear = el('button', 'tile-set', `Wear set ×${Object.keys(set.pieces).length}`);
            wear.type = 'button';
            wear.addEventListener('click', () => wearSet(set));
            meta.appendChild(wear);
        }
        return button;
    }

    // long prefix + name + suffix combos shrink to fit their strip instead of being cut off
    function fitStrips() {
        document.querySelectorAll('#grid .fit-inner').forEach(inner => {
            inner.style.transform = '';
            const box = inner.parentElement;
            const room = box.clientWidth - 20;
            const scale = Math.min(1, room / inner.scrollWidth);
            if (scale < 1) inner.style.transform = `scale(${scale.toFixed(3)})`;
        });
    }

    function renderGrid() {
        const grid = $('grid');
        grid.classList.toggle('is-sets', tab === 'sets');
        grid.querySelectorAll('.tag-special-layer, .tag-effect-layer').forEach(layer => window.PARTICLE_ENGINE?.unmount(layer));
        grid.replaceChildren();
        if (tab === 'sets') return renderSets(grid);
        if (tab === 'washi') return renderWashi(grid);

        const items = entriesFor(tab);
        if (!query && !category) grid.appendChild(noneTile(tab));
        if (!items.length) {
            grid.appendChild(el('p', 'grid-empty', query ? `Nothing matches “${query}”.` : 'Nothing here yet. Ask chat what unlocks these.'));
            return;
        }
        let lastGroup = null;
        items.forEach(item => {
            const group = category ? null : item.e.achievement_category;
            if (group && group !== lastGroup) {
                const label = el('div', 'rule-label group-label');
                label.appendChild(el('span', '', titleCase(group)));
                grid.appendChild(label);
                lastGroup = group;
            }
            grid.appendChild(decorationTile(item));
        });
        requestAnimationFrame(fitStrips);
    }

    function renderSets(grid) {
        const list = sets.filter(s => !category || s.category === category)
            .filter(s => !query || s.name.toLowerCase().includes(query.trim().toLowerCase()));
        if (!list.length) {
            grid.appendChild(el('p', 'grid-empty', 'No matching sets. Sets are achievements that unlock more than one piece.'));
            return;
        }
        list.forEach(set => {
            const card = el('button', 'set-card');
            card.type = 'button';
            card.setAttribute('aria-pressed', String(Object.entries(set.pieces).every(([slot, id]) => pick[slot] === id)));
            card.style.setProperty('--c', CATEGORY_COLORS[set.category] || '#c99645');
            const strip = el('span', 'set-strip');
            const inner = el('span', 'fit-inner');
            strip.appendChild(inner);
            ['name_prefix', 'name_base', 'name_suffix'].forEach(slot => {
                const span = el('span');
                inner.appendChild(span);
                if (slot === 'name_base' || set.pieces[slot]) paint(span, set.pieces[slot] || '', 'name-tag', slot === 'name_base' ? username() : undefined);
            });
            const pieces = Object.keys(set.pieces).map(s => SLOT_NAMES[s]).join(' · ');
            const cat = el('span', 'tile-cat');
            cat.append(el('i'), document.createTextNode(titleCase(set.category)));
            card.append(strip, el('span', 'set-name', set.name), cat, el('span', 'set-pieces', pieces));
            const founder = founderOf(set.key);
            if (founder) {
                card.appendChild(founderLine(founder));
                card.classList.toggle('is-yours', founder.isYou);
            }
            card.addEventListener('click', () => wearSet(set));
            grid.appendChild(card);
        });
        requestAnimationFrame(fitStrips);
    }


    function renderWashi(grid) {
        grid.appendChild(el('p', 'washi-note', 'Tape needs a colour and a spot. Pick a colour and it starts at the top; move it any time.'));
        const colourLabel = el('div', 'rule-label group-label');
        colourLabel.appendChild(el('span', '', 'Tape colour'));
        grid.appendChild(colourLabel);
        const none = tileShell('washi_color', '', { label: 'No tape' });
        none.button.classList.add('is-none');
        none.paper.textContent = 'None';
        none.button.setAttribute('aria-pressed', String(!pick.washi_color));
        none.button.onclick = () => { pick.washi_color = ''; pick.washi_position = ''; update(); };
        grid.appendChild(none.button);
        WASHI_COLORS.forEach(([id, label, css]) => {
            const { button, paper } = tileShell('washi_color', id, { label });
            button.classList.add('washi-tile');
            paper.appendChild(el('span', 'washi-swatch washi ' + css));
            button.onclick = () => { pick.washi_color = id; if (!pick.washi_position) pick.washi_position = 'washi_top_center'; update(); };
            grid.appendChild(button);
        });
        const spotLabel = el('div', 'rule-label group-label');
        spotLabel.appendChild(el('span', '', 'Where it sticks'));
        grid.appendChild(spotLabel);
        WASHI_SPOTS.forEach(([id, label, css]) => {
            const { button, paper } = tileShell('washi_position', id, { label });
            const spot = el('span', 'washi-spot ' + css);
            const tape = el('b');
            if (pick.washi_color) tape.className = 'washi ' + WASHI_CSS[pick.washi_color];
            spot.appendChild(tape);
            paper.appendChild(spot);
            button.onclick = () => { pick.washi_position = id; if (!pick.washi_color) pick.washi_color = 'washi_pink'; update(); };
            grid.appendChild(button);
        });
    }

    // ── choosing ────────────────────────────────────────────────────────
    function choose(slot, id) {
        pick[slot] = id || '';
        update();
    }

    function wearSet(set) {
        Object.entries(set.pieces).forEach(([slot, id]) => { pick[slot] = id; });
        update();
    }

    function shuffle() {
        const any = (slot, chance) => {
            const ids = Object.keys(catalog).filter(id => catalog[id].slot === slot && unlocked.has(id));
            return ids.length && Math.random() < chance ? ids[Math.floor(Math.random() * ids.length)] : '';
        };
        pick = {
            name_prefix: any('name_prefix', 0.8), name_base: any('name_base', 0.9), name_suffix: any('name_suffix', 0.6),
            message_text: any('message_text', 0.5), card_background: any('card_background', 0.4),
            mini_chat: pick.mini_chat || '',
        };
        if (Math.random() < 0.5) {
            pick.washi_color = WASHI_COLORS[Math.floor(Math.random() * 4)][0];
            pick.washi_position = WASHI_SPOTS[Math.floor(Math.random() * 4)][0];
        }
        update();
    }

    function commandIds() {
        const ids = PIECES.map(slot => pick[slot]).filter(Boolean);
        if (pick.washi_color && pick.washi_position) ids.push(pick.washi_color, pick.washi_position);
        // mini chat colour is a sticky preference: name it only to switch it on, or off again
        if (pick.mini_chat) ids.push('Mini_OPTOUT'); else if (wearing.mini_chat) ids.push('Mini_OPTIN');
        return ids;
    }
    const sameAsWearing = () => {
        const keys = [...PIECES, 'washi_color', 'washi_position', 'mini_chat'];
        return keys.every(k => (pick[k] || '') === (wearing[k] || ''));
    };

    // ── output ──────────────────────────────────────────────────────────
    function update() {
        renderPreview();
        renderLoadout();
        renderDock();
        renderTabs();
        if ($('mini-optout')) $('mini-optout').checked = Boolean(pick.mini_chat);
        // refresh pressed states without re-mounting every tile's effects
        document.querySelectorAll('#grid .tile').forEach(tile => {
            tile.setAttribute('aria-pressed', String((pick[tile.dataset.slot] || '') === tile.dataset.id));
        });
        if (tab === 'sets' || tab === 'washi') renderGrid();
    }

    function renderPreview() {
        const message = $('try-message').value.trim() || 'Do it for them.';
        paint($('pv-prefix'), pick.name_prefix, 'name-prefix name-tag');
        $('pv-dash').hidden = Boolean(pick.name_prefix);
        paint($('pv-name'), pick.name_base, 'name-base name-tag', username());
        paint($('pv-suffix'), pick.name_suffix, 'name-suffix name-tag');
        paint($('pv-message'), pick.message_text, 'message message-text name-tag', message);
        const card = $('decor-card');
        mountBackground(card, $('decor-background'), pick.card_background);
        const tape = $('washi-tape');
        if (pick.washi_color && pick.washi_position) {
            tape.className = 'washi ' + WASHI_CSS[pick.washi_color] + ' ' + WASHI_CSS[pick.washi_position];
            tape.hidden = false;
        } else {
            tape.hidden = true;
        }
        fitCard();
        sendChat();
    }

    // a long username + prefix + suffix shrinks to the card's width instead of spilling off its left edge
    // (same rule as the stream's fullscreen chat: the line is right-aligned, so it scales from its right edge)
    function fitNameLine(line) {
        if (!line) return;
        line.style.transform = '';
        const room = line.clientWidth;
        line.style.width = 'max-content';
        const natural = line.offsetWidth;
        line.style.width = '';
        const scale = room > 0 && natural > 0 ? Math.min(1, room / natural) : 1;
        if (scale < 1) {
            line.style.transformOrigin = 'right center';
            line.style.transform = `scale(${scale.toFixed(4)})`;
        }
    }

    function fitCard() {
        const card = $('decor-card');
        const fit = $('card-fit');
        const desk = $('desk');
        if (!card.offsetWidth) return;
        fitNameLine(card.querySelector('.name-line'));
        const scale = Math.min(1, (desk.clientWidth - 28) / card.offsetWidth, window.innerWidth <= 1060 ? 150 / card.offsetHeight : 1);
        card.style.transform = `scale(${scale.toFixed(4)})`;
        fit.style.width = card.offsetWidth * scale + 'px';
        fit.style.height = card.offsetHeight * scale + 'px';
    }

    function pickLabel(slot) {
        if (slot === 'washi') return pick.washi_color && pick.washi_position ? `${WASHI_LABEL[pick.washi_color]} · ${WASHI_LABEL[pick.washi_position]}` : '';
        const e = catalog[pick[slot]];
        if (!e) return '';
        const text = e.config?.text && ['name_prefix', 'name_suffix'].includes(slot) ? ` · “${e.config.text}”` : '';
        return (e.achievement_name || e.display_name) + text;
    }

    function renderLoadout() {
        const host = $('loadout');
        host.replaceChildren();
        [...PIECES, 'washi'].forEach(slot => {
            const row = el('li');
            const label = pickLabel(slot);
            row.append(el('span', 'lo-slot', SLOT_NAMES[slot]), el('span', 'lo-pick' + (label ? '' : ' is-none'), label || 'None'));
            const clear = el('button', 'lo-x', '×');
            clear.type = 'button';
            clear.setAttribute('aria-label', `Clear ${SLOT_NAMES[slot]}`);
            clear.hidden = !label;
            clear.addEventListener('click', event => {
                event.stopPropagation();
                if (slot === 'washi') { pick.washi_color = ''; pick.washi_position = ''; } else pick[slot] = '';
                update();
            });
            row.appendChild(clear);
            row.addEventListener('click', () => setTab(slot));
            host.appendChild(row);
        });
        $('reset-btn').hidden = sameAsWearing();
    }

    function renderDock() {
        const ids = commandIds();
        const ready = Boolean(user) && ids.length > 0;
        $('dock').classList.toggle('is-ready', ready);
        $('dock-cmd').textContent = ready ? '!deco ' + ids.join(' ') : '!deco …';
        $('copy-btn').disabled = !ready;
        $('dock-note').textContent = !user ? 'Load your name to start.'
            : !ids.length ? 'Pick at least one piece.'
            : sameAsWearing() ? 'This is what you’re wearing now.'
            : 'Paste it in chat while the stream is live.';
    }

    async function copyCommand() {
        const text = $('dock-cmd').textContent;
        const button = $('copy-btn');
        try {
            await navigator.clipboard.writeText(text);
            button.textContent = 'Copied ✓';
            button.classList.add('is-done');
        } catch (error) {
            button.textContent = 'Select it ↑';
            const range = document.createRange();
            range.selectNodeContents($('dock-cmd'));
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }
        clearTimeout(copyTimer);
        copyTimer = setTimeout(() => { button.textContent = 'Copy'; button.classList.remove('is-done'); }, 2200);
    }

    // ── medallion: share of every decoration that exists ───────────────
    function renderMedallion() {
        // real total once the bot publishes it; older meta only knows pieces someone already unlocked
        const total = Number(siteMeta.decoration_total) || Object.values(catalog).filter(e => PIECES.includes(e.slot)).length;
        const have = unlocked.size;
        const pct = total ? Math.min(100, (have / total) * 100) : 0;
        $('medal-count').textContent = String(have);
        $('medal-of').textContent = `of ${total}`;
        $('medallion').setAttribute('aria-label', `${have} of ${total} decorations unlocked (${Math.round(pct)}%)`);
        $('medallion').title = `${Math.round(pct)}% of all decorations`;
        // a full ring has no gap to show the round cap, so stop just short of it
        $('ring-fill').style.strokeDasharray = `${Math.min(pct, 99.4).toFixed(2)} 100`;
        $('ring-tip').style.setProperty('--tip', `${(pct / 100) * 360}deg`);
        $('ring-tip').hidden = have === 0;
    }

    // fixed starfield inside the medallion core (same look as the goal widget's)
    function seedStars() {
        const host = $('medallion-stars');
        const colors = ['#fff1d1', '#62ead7', '#5eaee9', '#b886ff', '#fff1d1'];
        let seed = 7;
        const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
        host.replaceChildren(...Array.from({ length: 16 }, () => {
            const star = el('i');
            const angle = rand() * Math.PI * 2;
            const radius = Math.sqrt(rand()) * 44;
            star.style.left = `${50 + Math.cos(angle) * radius}%`;
            star.style.top = `${50 + Math.sin(angle) * radius}%`;
            star.style.setProperty('--s', `${1 + rand() * 1.6}px`);
            star.style.setProperty('--c', colors[Math.floor(rand() * colors.length)]);
            star.style.setProperty('--o', (0.35 + rand() * 0.55).toFixed(2));
            star.style.setProperty('--d', `${2 + rand() * 3}s`);
            return star;
        }));
    }

    // ── mini stream chat: the real compact chat widget, fed a test message ──
    async function mountChat() {
        if (!window.buildOverlaySrcdoc) return;
        let widget;
        try { widget = await fetchJSON('compact_chat_widget.json'); } catch (error) { return; }
        // On stream the widget asks the bot's local server for chat badges; a public visitor's machine has no such
        // server (and browsers may prompt about local network access), so the preview goes without badges.
        widget = { ...widget, js: String(widget.js || '').replace("fetch('http://localhost:5551/api/badges')", 'Promise.resolve({ ok: false })') };
        chatFrame = document.createElement('iframe');
        chatFrame.setAttribute('sandbox', 'allow-scripts');
        chatFrame.setAttribute('scrolling', 'no');
        chatFrame.title = 'Stream chat preview';
        chatFrame.srcdoc = window.buildOverlaySrcdoc(widget, { ...widget.values, maxMessages: 3, motion: false }, {}, {});
        window.addEventListener('message', event => {
            if (event.source !== chatFrame.contentWindow || event.data?.kind !== 'widget-ready') return;
            chatReady = true;
            sendChat();
        });
        $('chat-window').appendChild(chatFrame);
    }

    function sendChat() {
        if (!chatReady || !chatFrame?.contentWindow) return;
        const post = data => chatFrame.contentWindow.postMessage({ kind: 'stream-event', data }, '*');
        const name = username();
        // the bot sends every active slot; the compact chat uses the name and message styles
        const decorations = {};
        ['name_base', 'message_text'].forEach(slot => {
            if (pick[slot] && catalog[pick[slot]]) decorations[slot] = { ...(catalog[pick[slot]].config || {}) };
        });
        if (pick.mini_chat) decorations.mini_chat = { value: 'Mini_OPTOUT' };
        post({ type: 'burn_user', username: name });
        chatSeq += 1;
        post({
            type: 'chat',
            username: name,
            text: $('try-message').value.trim() || 'Do it for them.',
            color: '#62ead7',
            tier: 'normal',
            legacy: Number(user?.legacy) || 0,
            badge: false,
            badges: {},
            decorations,
            msg_id: `workbench-${chatSeq}`,
        });
    }

    // ── account ─────────────────────────────────────────────────────────
    async function loadUser(name) {
        const raw = String(name || '').trim().replace(/^@/, '');
        if (!raw) return false;
        usernameMap = usernameMap || await fetchJSON('username_map.json');
        const match = Object.keys(usernameMap).find(u => u.toLowerCase() === raw.toLowerCase());
        if (!match) return false;
        const record = await fetchJSON('users/' + encodeURIComponent(usernameMap[match]) + '.json');
        user = { ...record, id: String(usernameMap[match]), username: record.username || match };
        unlocked = new Set((record.decorations?.unlocked || []).filter(id => catalog[id]));
        const active = record.decorations?.active || {};
        wearing = {};
        PIECES.forEach(slot => { if (active[slot] && unlocked.has(active[slot])) wearing[slot] = active[slot]; });
        if (active.washi_color && active.washi_position) { wearing.washi_color = active.washi_color; wearing.washi_position = active.washi_position; }
        if (active.mini_chat === 'Mini_OPTOUT') wearing.mini_chat = 'Mini_OPTOUT';
        pick = { ...wearing };
        buildSets();

        $('bench-name').textContent = user.username;
        renderMedallion();
        const legacy = Number(user.legacy) || 0;
        $('tier').hidden = legacy < 1;
        $('tier').textContent = legacy >= 2 ? 'Legendary Legacy' : 'Legacy';
        $('tier').classList.toggle('legendary', legacy >= 2);
        $('nav-profile').textContent = user.username;
        $('nav-profile').href = 'profile.html?u=' + encodeURIComponent(user.username); // the header link goes to their star
        $('bench-sub').textContent = unlocked.size
            ? `${unlocked.size} pieces unlocked. Tap one to try it on, then copy the command.`
            : 'Nothing unlocked yet. Earn achievements on stream, and ask chat what unlocks what.';
        const url = new URL(location.href);
        url.searchParams.set('user', user.username);
        history.replaceState(null, '', url);
        setTab(tab);
        update();
        return true;
    }

    function wireGate() {
        const dialog = $('gate');
        const input = $('gate-input');
        const list = $('gate-suggest');
        const status = $('gate-status');
        let options = [];
        let active = -1;
        const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; };
        const mark = i => {
            active = i;
            [...list.children].forEach((li, n) => li.setAttribute('aria-selected', String(n === i)));
        };
        input.addEventListener('input', async () => {
            const prefix = input.value.trim().replace(/^@/, '').toLowerCase();
            if (prefix.length < 2) return close();
            usernameMap = usernameMap || await fetchJSON('username_map.json');
            options = Object.keys(usernameMap).filter(u => u.toLowerCase().startsWith(prefix)).sort((a, b) => a.length - b.length || a.localeCompare(b)).slice(0, 8);
            list.replaceChildren(...options.map((u, i) => {
                const li = el('li', '', u);
                li.setAttribute('role', 'option');
                li.addEventListener('pointerdown', ev => { ev.preventDefault(); input.value = u; close(); });
                return li;
            }));
            list.hidden = !options.length;
            input.setAttribute('aria-expanded', String(Boolean(options.length)));
            active = -1;
        });
        input.addEventListener('keydown', ev => {
            if (list.hidden) return;
            if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
                ev.preventDefault();
                mark((active + (ev.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
            } else if (ev.key === 'Enter' && active >= 0) {
                ev.preventDefault();
                input.value = options[active];
                close();
            } else if (ev.key === 'Escape') {
                ev.preventDefault();
                close();
            }
        });
        $('gate-form').addEventListener('submit', async ev => {
            ev.preventDefault();
            status.className = 'gate-status';
            status.textContent = 'Looking you up…';
            try {
                if (await loadUser(input.value)) {
                    try { localStorage.setItem('cosmic.me', user.username); } catch (e) {}
                    status.textContent = '';
                    dialog.close();
                } else {
                    status.className = 'gate-status is-err';
                    status.textContent = 'Can’t find that name. It needs to have chatted on stream at least once.';
                }
            } catch (error) {
                status.className = 'gate-status is-err';
                status.textContent = 'Couldn’t load the public list right now. Try again in a moment.';
            }
        });
        $('switch-user').addEventListener('click', () => {
            input.value = '';
            status.textContent = '';
            dialog.showModal();
            input.focus();
        });
    }

    // ── boot ────────────────────────────────────────────────────────────
    async function init() {
        wireGate();
        $('search').addEventListener('input', e => { query = e.target.value; renderGrid(); });
        $('shuffle').addEventListener('click', shuffle);
        $('reset-btn').addEventListener('click', () => { pick = { ...wearing }; update(); });
        $('mini-optout')?.addEventListener('change', event => { pick.mini_chat = event.target.checked ? 'Mini_OPTOUT' : ''; update(); });
        $('copy-btn').addEventListener('click', copyCommand);
        $('try-message').addEventListener('input', renderPreview);
        $('slot-tabs').addEventListener('keydown', e => {
            if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
            const i = TABS.findIndex(t => t.key === tab);
            const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].key;
            setTab(next);
            document.querySelector(`.slot-tab[data-tab="${next}"]`)?.focus();
        });
        if (window.ResizeObserver) {
            new ResizeObserver(fitCard).observe($('desk'));
            // width only: the tab layout itself changes the picker's height
            let pickerWidth = 0;
            new ResizeObserver(([entry]) => {
                if (Math.abs(entry.contentRect.width - pickerWidth) < 1) return;
                pickerWidth = entry.contentRect.width;
                layoutTabs();
            }).observe(document.querySelector('.picker'));
        }
        window.addEventListener('resize', fitCard);

        [catalog, founders, siteMeta] = await Promise.all([fetchJSON('decoration_catalog.json'), fetchJSON('founders.json').catch(() => ({})), fetchJSON('meta.json').catch(() => ({}))])
            .catch(e => { showLoadFailure(); throw e; });
        seedStars();
        renderMedallion();
        mountChat();
        renderTabs();
        renderChips();
        renderGrid();
        update();
        let remembered = ''; try { remembered = localStorage.getItem('cosmic.me') || ''; } catch (e) {}
        const preset = new URLSearchParams(location.search).get('user') || remembered; // a link from a profile, or whoever this browser remembers
        if (!preset || !(await loadUser(preset).catch(() => false))) $('gate').showModal();
        if (document.fonts) document.fonts.ready.then(() => { fitCard(); fitStrips(); });
        // a newly picked decoration's font arrives after the first fit
        document.fonts?.addEventListener?.('loadingdone', fitCard);
    }

    init();
}());
