/* Decoration Builder — static GitHub Pages loader */
(function () {
    const BASE = document.location.origin + document.location.pathname.replace(/\/[^/]*$/, '/');
    const SLOT_IDS = {
        name_prefix:    'prefix-select',
        name_base:      'name-select',
        name_suffix:    'suffix-select',
        message_text:   'message-select',
        card_background:'bg-select',
    };
    const SLOT_LABELS = {
        name_prefix:    'Prefix',
        name_base:      'Name Style',
        name_suffix:    'Suffix',
        message_text:   'Message',
        card_background:'Background',
    };

    let catalog = {};       // id → { slot, display_name, achievement_name, achievement_category, achievement_id, config }
    let userRecord = null;  // { decorations: { unlocked: [...], active: {slot→id} }, username, ... }
    let unlockedSet = new Set();

    // ── Utilities ──────────────────────────────────────────────────────────

    function $(id) { return document.getElementById(id); }

    function setStatus(id, msg, type) {
        const el = $(id);
        el.textContent = msg;
        el.className = 'status-line ' + (type || 'info');
    }

    function toTitleCase(s) {
        return s.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
    }

    // ── Data loading ───────────────────────────────────────────────────────

    async function fetchJSON(path) {
        const r = await fetch(BASE + path + '?_=' + Date.now());
        if (!r.ok) throw new Error(r.status);
        return r.json();
    }

    async function loadCatalog() {
        if (Object.keys(catalog).length) return;
        catalog = await fetchJSON('decoration_catalog.json');
    }

    window.loadUser = async function () {
        const raw = $('username-input').value.trim();
        if (!raw) return;
        setStatus('load-status', 'Loading…', 'info');
        try {
            await loadCatalog();
            const map = await fetchJSON('username_map.json');
            const uid = map[raw.toLowerCase()];
            if (!uid) { setStatus('load-status', 'Username not found.', 'err'); return; }
            userRecord = await fetchJSON('users/' + uid + '.json');
            unlockedSet = new Set((userRecord.decorations || {}).unlocked || []);
            const active = (userRecord.decorations || {}).active || {};
            setStatus('load-status', `Loaded — ${unlockedSet.size} decoration(s) unlocked.`, 'ok');
            $('preview-name').textContent = userRecord.username || raw;
            $('preview-hint').style.display = 'none';
            populateDropdowns(active);
            renderPreview();
        } catch (e) {
            setStatus('load-status', 'Failed to load: ' + e.message, 'err');
        }
    };

    // ── Dropdown population ────────────────────────────────────────────────

    function populateDropdowns(active) {
        // Group unlocked catalog entries by slot
        const bySlot = {};
        for (const [id, entry] of Object.entries(catalog)) {
            if (!unlockedSet.has(id)) continue;
            if (!bySlot[entry.slot]) bySlot[entry.slot] = [];
            bySlot[entry.slot].push({ id, entry });
        }

        // Populate slot dropdowns
        for (const [slot, selectId] of Object.entries(SLOT_IDS)) {
            const sel = $(selectId);
            sel.innerHTML = '<option value="">None</option>';
            const items = bySlot[slot] || [];
            items.sort((a, b) => a.entry.display_name.localeCompare(b.entry.display_name));
            for (const { id, entry } of items) {
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = entry.display_name + (entry.achievement_name ? ` (${entry.achievement_name})` : '');
                if (active[slot] === id) opt.selected = true;
                sel.appendChild(opt);
            }
            sel.disabled = false;
        }

        // Populate category dropdown
        const categories = new Set();
        for (const id of unlockedSet) {
            const entry = catalog[id];
            if (entry && entry.achievement_category) categories.add(entry.achievement_category);
        }
        const catSel = $('cat-select');
        catSel.innerHTML = '<option value="">— All slots —</option>';
        for (const cat of [...categories].sort()) {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = toTitleCase(cat);
            catSel.appendChild(opt);
        }
        catSel.disabled = false;
        $('ach-select').disabled = false;
        $('ach-select').innerHTML = '<option value="">— pick a category —</option>';
    }

    window.onCategoryChange = function () {
        const cat = $('cat-select').value;
        const achSel = $('ach-select');
        achSel.innerHTML = '<option value="">— pick an achievement —</option>';

        if (!cat) { achSel.disabled = true; return; }

        // Collect achievements in this category that have at least one unlocked deco
        const achMap = new Map(); // ach_id → ach_name
        for (const id of unlockedSet) {
            const entry = catalog[id];
            if (!entry || entry.achievement_category !== cat) continue;
            if (entry.achievement_id) achMap.set(entry.achievement_id, entry.achievement_name || entry.achievement_id);
        }

        for (const [achId, achName] of [...achMap.entries()].sort((a, b) => a[1].localeCompare(b[1]))) {
            const opt = document.createElement('option');
            opt.value = achId;
            opt.textContent = achName;
            achSel.appendChild(opt);
        }
        achSel.disabled = false;
    };

    window.onAchievementChange = function () {
        const achId = $('ach-select').value;
        if (!achId) return;

        // Find all unlocked decos linked to this achievement and apply them
        for (const id of unlockedSet) {
            const entry = catalog[id];
            if (!entry || entry.achievement_id !== achId) continue;
            const sel = $(SLOT_IDS[entry.slot]);
            if (sel) sel.value = id;
        }
        onSlotChange();
    };

    window.onSlotChange = function () {
        renderPreview();
        updateCommand();
    };

    // ── Preview rendering ──────────────────────────────────────────────────

    function applySlot(el, decoId, baseClass) {
        const translator = window.DECORATION_NAME_TRANSLATOR;
        if (!translator) return;
        if (!decoId) {
            translator.applyTagPresentation(el, {}, baseClass);
            return;
        }
        const entry = catalog[decoId];
        if (!entry) return;
        translator.applyTagPresentation(el, entry.config || {}, baseClass);
    }

    function renderPreview() {
        const msg = $('message-input').value || 'This is my chat message!';
        $('preview-message').textContent = msg;

        const prefixId  = $('prefix-select').value;
        const nameId    = $('name-select').value;
        const suffixId  = $('suffix-select').value;
        const messageId = $('message-select').value;
        const bgId      = $('bg-select').value;

        applySlot($('preview-prefix'),  prefixId,  'name-prefix name-tag');
        applySlot($('preview-name'),    nameId,    'name-base name-tag');
        applySlot($('preview-suffix'),  suffixId,  'name-suffix name-tag');
        applySlot($('preview-message'), messageId, 'message message-text name-tag');

        // Background
        const card = $('decor-card');
        const bgEl = $('decor-background');
        // Clear previous bg classes/renderers
        card.className = 'decor-card';
        bgEl.innerHTML = '';
        if (window.PuppyCardBackgrounds) window.PuppyCardBackgrounds.clear(card);

        if (bgId && catalog[bgId]) {
            const bgCfg = catalog[bgId].config || {};
            if (bgCfg.background_class) {
                bgCfg.background_class.trim().split(/\s+/).filter(Boolean).forEach(c => card.classList.add(c));
            }
            if (bgCfg.background_renderer && window.PuppyCardBackgrounds) {
                window.PuppyCardBackgrounds.mount(card, bgCfg.background_renderer);
            }
        }

        updateCommand();
    }

    // ── Command generation ─────────────────────────────────────────────────

    function updateCommand() {
        const ids = [
            $('prefix-select').value,
            $('name-select').value,
            $('suffix-select').value,
            $('message-select').value,
            $('bg-select').value,
        ].filter(Boolean);

        $('command-value').textContent = ids.length ? '!deco ' + ids.join(' ') : '!deco';
    }

    window.copyCommand = function () {
        const text = $('command-value').textContent;
        navigator.clipboard.writeText(text).then(() => {
            const s = $('copy-status');
            s.classList.add('show');
            setTimeout(() => s.classList.remove('show'), 2000);
        });
    };

    // ── Init ──────────────────────────────────────────────────────────────

    function init() {
        // Wire message input to live-update preview text
        $('message-input').addEventListener('input', () => {
            $('preview-message').textContent = $('message-input').value || 'This is my chat message!';
        });

        // Support ?user=Name param
        const params = new URLSearchParams(window.location.search);
        const preload = params.get('user');
        if (preload) {
            $('username-input').value = preload;
            loadUser();
        }

        // Enter key on username field
        $('username-input').addEventListener('keydown', e => {
            if (e.key === 'Enter') loadUser();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
