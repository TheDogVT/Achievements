/* Decoration Builder - static GitHub Pages loader.
 *
 * This page deliberately builds a chat command only. It never writes a
 * decoration back to the bot or to the published data set.
 */
(function () {
    'use strict';

    const BASE = document.location.origin + document.location.pathname.replace(/\/[^/]*$/, '/');
    const SLOT_IDS = {
        name_prefix:     'prefix-select',
        name_base:       'name-select',
        name_suffix:     'suffix-select',
        message_text:    'message-select',
        card_background: 'bg-select',
    };
    const SLOT_ORDER = ['name_prefix', 'name_base', 'name_suffix', 'message_text', 'card_background'];
    const SLOT_LABELS = {
        name_prefix:     'Prefix',
        name_base:       'Name style',
        name_suffix:     'Suffix',
        message_text:    'Message style',
        card_background: 'Card background',
        washi_color:     'Washi color',
        washi_position:  'Washi position',
    };
    const WASHI_FALLBACKS = {
        washi_color: [
            { id: 'washi_pink', label: 'Pink', css: 'pink' },
            { id: 'washi_mint', label: 'Mint', css: 'mint' },
            { id: 'washi_gold', label: 'Gold', css: 'gold' },
            { id: 'washi_lavender', label: 'Lavender', css: 'lavender' },
        ],
        washi_position: [
            { id: 'washi_top_left', label: 'Top Left', css: 'top-left' },
            { id: 'washi_top_right', label: 'Top Right', css: 'top-right' },
            { id: 'washi_top_center', label: 'Top Center', css: 'top-center' },
            { id: 'washi_corner_tl', label: 'Corner', css: 'corner-tl' },
        ],
    };

    let catalog = {};
    let userRecord = null;
    let unlockedSet = new Set();
    let quickGroups = [];
    let currentCategory = '';
    let currentAchievement = '';
    let mode = 'quick';
    let quickApplying = false;
    let loadToken = 0;
    let copyTimer = null;
    const washiValueMap = {};

    function $(id) {
        return document.getElementById(id);
    }

    function setStatus(id, message, type) {
        const element = $(id);
        if (!element) return;
        element.textContent = message;
        element.className = 'status-line ' + (type || 'info');
    }

    function toTitleCase(value) {
        return String(value || '')
            .replace(/[_-]+/g, ' ')
            .replace(/\w\S*/g, word => word[0].toUpperCase() + word.slice(1).toLowerCase());
    }

    function appendOption(select, label, value, selected) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        if (selected) option.selected = true;
        select.appendChild(option);
        return option;
    }

    function fetchJSON(path) {
        return fetch(BASE + path + '?_=' + Date.now()).then(response => {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        });
    }

    async function loadCatalog() {
        if (Object.keys(catalog).length) return;
        catalog = await fetchJSON('decoration_catalog.json');
    }

    function availableEntries() {
        return [...unlockedSet]
            .map(id => catalog[id] ? { id, entry: catalog[id] } : null)
            .filter(item => item && SLOT_ORDER.includes(item.entry.slot));
    }

    function entryLabel(item) {
        return item.entry.display_name || item.entry.config?.label || item.id;
    }

    function setGateState(state, message) {
        const gate = $('account-gate');
        const messageElement = $('gate-message');
        const actions = $('gate-actions');
        const builder = $('builder-workbench');
        const summary = $('account-summary');
        if (!gate || !builder) return;

        gate.dataset.state = state;
        const ready = state === 'ready';
        builder.hidden = !ready;
        builder.setAttribute('aria-hidden', String(!ready));
        if (summary) summary.hidden = !ready;
        if (messageElement) {
            messageElement.textContent = message || '';
            messageElement.hidden = !message;
        }
        if (actions) actions.hidden = ready || state === 'idle' || state === 'loading';
        if (state === 'loading') {
            setStatus('load-status', 'Loading your public unlock list...', 'info');
        } else if (state === 'ready') {
            setStatus('load-status', 'Account loaded. Your builder is ready.', 'ok');
        } else if (state === 'unknown') {
            setStatus('load-status', 'Username not found.', 'err');
        } else if (state === 'empty') {
            setStatus('load-status', 'Account loaded, but no usable decorations were found.', 'err');
        } else if (state === 'error') {
            setStatus('load-status', 'Could not load that account right now.', 'err');
        } else {
            setStatus('load-status', 'Enter your username to begin.', 'info');
        }
    }

    function resetControls() {
        [...SLOT_ORDER.map(slot => SLOT_IDS[slot]), 'washi-color-select', 'washi-pos-select', 'cat-select', 'ach-select']
            .forEach(id => {
                const select = $(id);
                if (!select) return;
                select.disabled = true;
                select.replaceChildren();
                appendOption(select, 'None', '');
            });
        $('quick-achievements').replaceChildren();
        $('quick-empty').hidden = true;
    }

    function showUsernameGate({ keepValue = true } = {}) {
        loadToken += 1;
        userRecord = null;
        unlockedSet = new Set();
        quickGroups = [];
        currentCategory = '';
        currentAchievement = '';
        mode = 'quick';
        if (!keepValue) $('username-input').value = '';
        $('account-name').textContent = '-';
        $('preview-user-label').textContent = 'Waiting for username';
        $('preview-mode-label').textContent = 'Account not loaded';
        $('preview-hint').hidden = false;
        resetControls();
        setGateState('idle');
        setMode('quick');
        renderPreview();
    }

    function showLoadError(state, message) {
        $('preview-hint').hidden = false;
        setGateState(state, message);
        resetControls();
        renderPreview();
    }

    function populateSlotSelect(slot, active) {
        const select = $(SLOT_IDS[slot]);
        const items = availableEntries()
            .filter(item => item.entry.slot === slot)
            .sort((a, b) => entryLabel(a).localeCompare(entryLabel(b)));
        select.replaceChildren();
        if (!items.length) {
            appendOption(select, 'No unlocked choices', '');
            select.disabled = true;
            return;
        }
        appendOption(select, 'None', '');
        items.forEach(item => appendOption(
            select,
            item.entry.achievement_name ? `${entryLabel(item)} - ${item.entry.achievement_name}` : entryLabel(item),
            item.id,
            active[slot] === item.id,
        ));
        select.disabled = false;
    }

    function washiSourceOptions(slot) {
        const dynamic = Object.entries(catalog)
            .filter(([id, entry]) => unlockedSet.has(id) && entry && entry.slot === slot)
            .map(([id, entry]) => {
                const config = entry.config || {};
                return {
                    id,
                    label: entry.display_name || config.label || id,
                    css: String(config.value || id).replace(/^washi_/, '').replace(/_/g, '-'),
                };
            });
        const merged = [];
        const seen = new Set();
        [...dynamic, ...(WASHI_FALLBACKS[slot] || [])].forEach(option => {
            if (seen.has(option.id)) return;
            seen.add(option.id);
            merged.push(option);
            washiValueMap[option.id] = option.css;
        });
        return merged;
    }

    function populateWashiOptions(active) {
        [['washi_color', 'washi-color-select'], ['washi_position', 'washi-pos-select']].forEach(([slot, selectId]) => {
            const select = $(selectId);
            const options = washiSourceOptions(slot);
            select.replaceChildren();
            appendOption(select, 'None', '');
            options.forEach(option => appendOption(select, option.label, option.id, active[slot] === option.id));
            if (active[slot] && !options.some(option => option.id === active[slot])) {
                const fallbackCss = String(active[slot]).replace(/^washi_/, '').replace(/_/g, '-');
                washiValueMap[active[slot]] = fallbackCss;
                appendOption(select, 'Current selection', active[slot], true);
            }
            select.disabled = false;
        });
    }

    function groupQuickEntries() {
        const grouped = new Map();
        availableEntries().forEach(item => {
            const category = item.entry.achievement_category || 'other';
            const achievementId = item.entry.achievement_id;
            if (!achievementId) return;
            const key = `${category}::${achievementId}`;
            if (!grouped.has(key)) {
                grouped.set(key, {
                    key,
                    category,
                    achievementId,
                    name: item.entry.achievement_name || achievementId,
                    entries: [],
                });
            }
            grouped.get(key).entries.push(item);
        });
        quickGroups = [...grouped.values()].map(group => {
            const bySlot = new Map();
            group.entries
                .sort((a, b) => {
                    const slotDelta = SLOT_ORDER.indexOf(a.entry.slot) - SLOT_ORDER.indexOf(b.entry.slot);
                    return slotDelta || entryLabel(a).localeCompare(entryLabel(b));
                })
                .forEach(item => {
                    if (!bySlot.has(item.entry.slot)) bySlot.set(item.entry.slot, item);
                });
            group.coherentEntries = [...bySlot.values()];
            return group;
        }).sort((a, b) => a.name.localeCompare(b.name));
    }

    function groupsForCurrentCategory() {
        return currentCategory
            ? quickGroups.filter(group => group.category === currentCategory)
            : quickGroups;
    }

    function renderAchievementSelect() {
        const select = $('ach-select');
        const groups = groupsForCurrentCategory();
        select.replaceChildren();
        appendOption(select, groups.length ? 'Choose an achievement' : 'No achievements in this category', '');
        groups.forEach(group => appendOption(select, group.name, group.key, group.key === currentAchievement));
        select.disabled = !groups.length;
        if (!groups.some(group => group.key === currentAchievement)) {
            currentAchievement = '';
            select.value = '';
        }
    }

    function createAchievementCard(group) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'achievement-card';
        button.dataset.achievement = group.key;
        button.setAttribute('aria-pressed', String(group.key === currentAchievement));
        button.addEventListener('click', () => applyQuickAchievement(group.key));

        const top = document.createElement('div');
        top.className = 'achievement-card-top';
        const name = document.createElement('span');
        name.className = 'achievement-card-name';
        name.textContent = group.name;
        const category = document.createElement('span');
        category.className = 'achievement-card-category';
        category.textContent = toTitleCase(group.category);
        top.append(name, category);
        button.appendChild(top);

        const meta = document.createElement('div');
        meta.className = 'achievement-card-meta';
        meta.textContent = `${group.coherentEntries.length} slot${group.coherentEntries.length === 1 ? '' : 's'} available`;
        button.appendChild(meta);

        const chips = document.createElement('div');
        chips.className = 'achievement-card-chips';
        group.coherentEntries.forEach(item => {
            const chip = document.createElement('span');
            chip.className = 'chip';
            chip.textContent = `${SLOT_LABELS[item.entry.slot]}: ${entryLabel(item)}`;
            chips.appendChild(chip);
        });
        button.appendChild(chips);
        return button;
    }

    function renderQuickCards() {
        const list = $('quick-achievements');
        const empty = $('quick-empty');
        const groups = groupsForCurrentCategory();
        list.replaceChildren();
        groups.forEach(group => list.appendChild(createAchievementCard(group)));
        empty.hidden = groups.length > 0;
        if (!groups.length) empty.textContent = quickGroups.length
            ? 'No unlocked decorations are linked to an achievement in this category.'
            : 'No unlocked decorations are linked to an achievement yet. Use Build manually to inspect your available slots.';
        renderAchievementSelect();
    }

    function populateQuickAchievements() {
        groupQuickEntries();
        const categories = [...new Set(quickGroups.map(group => group.category))].sort();
        const categorySelect = $('cat-select');
        categorySelect.replaceChildren();
        appendOption(categorySelect, categories.length ? 'All categories' : 'No achievement groups', '');
        categories.forEach(category => appendOption(categorySelect, toTitleCase(category), category));
        categorySelect.disabled = !categories.length;
        if (!categories.includes(currentCategory)) currentCategory = '';
        categorySelect.value = currentCategory;
        renderQuickCards();
    }

    function populateDropdowns(active) {
        SLOT_ORDER.forEach(slot => populateSlotSelect(slot, active));
        populateWashiOptions(active);
        populateQuickAchievements();
        $('unlock-summary').textContent = `${availableEntries().length} unlocked`;
        $('account-name').textContent = userRecord.username || $('username-input').value.trim();
        $('preview-user-label').textContent = userRecord.username || $('username-input').value.trim();
        $('preview-mode-label').textContent = mode === 'quick' ? 'Quick Load mode' : 'Manual mode';
        $('preview-hint').hidden = true;
        renderPreview();
    }

    function getSelectedId(slot) {
        const select = $(SLOT_IDS[slot]);
        return select ? select.value : '';
    }

    function selectedIds() {
        const ids = SLOT_ORDER.map(getSelectedId).filter(Boolean);
        const color = $('washi-color-select').value;
        const position = $('washi-pos-select').value;
        if (color) ids.push(color);
        if (position) ids.push(position);
        return ids;
    }

    function selectedLabel(slot, id) {
        if (!id) return '';
        if (slot === 'washi_color') return $('washi-color-select').selectedOptions[0]?.textContent || id;
        if (slot === 'washi_position') return $('washi-pos-select').selectedOptions[0]?.textContent || id;
        const item = catalog[id];
        return item?.display_name || item?.config?.label || id;
    }

    function validateSelection() {
        if (!userRecord) {
            return { valid: false, message: 'Load a Twitch username before choosing decorations.', command: '' };
        }
        const color = $('washi-color-select').value;
        const position = $('washi-pos-select').value;
        if ((color || position) && (!color || !position)) {
            const missing = [];
            if (!color) missing.push('Tape color');
            if (!position) missing.push('Tape position');
            return {
                valid: false,
                message: `Complete Washi Tape: choose ${missing.join(' and ')}, or clear both Washi fields.`,
                command: '',
            };
        }
        const ids = selectedIds();
        if (!ids.length) {
            return {
                valid: false,
                message: 'Choose at least one unlocked decoration to create a chat command.',
                command: '',
            };
        }
        return { valid: true, message: 'Ready to use in chat while the stream is live.', command: '!deco ' + ids.join(' ') };
    }

    function renderSelectionSummary() {
        const summary = $('selection-summary');
        const selected = [];
        SLOT_ORDER.forEach(slot => {
            const id = getSelectedId(slot);
            if (id) selected.push({ slot, id, label: selectedLabel(slot, id) });
        });
        const color = $('washi-color-select').value;
        const position = $('washi-pos-select').value;
        if (color) selected.push({ slot: 'washi_color', id: color, label: selectedLabel('washi_color', color) });
        if (position) selected.push({ slot: 'washi_position', id: position, label: selectedLabel('washi_position', position) });

        summary.replaceChildren();
        if (!selected.length) {
            const chip = document.createElement('span');
            chip.className = 'chip chip-muted';
            chip.textContent = 'Nothing selected yet';
            summary.appendChild(chip);
        } else {
            selected.forEach(item => {
                const chip = document.createElement('span');
                chip.className = 'chip';
                chip.textContent = `${SLOT_LABELS[item.slot]}: ${item.label}`;
                summary.appendChild(chip);
            });
        }
        $('selection-count').textContent = `${selected.length} choice${selected.length === 1 ? '' : 's'}`;
        $('preview-selection-count').textContent = `${selected.length} selected`;
    }

    function renderWashi() {
        const colorId = $('washi-color-select').value;
        const positionId = $('washi-pos-select').value;
        const element = $('washi-tape');
        if (!element) return;
        const color = washiValueMap[colorId];
        const position = washiValueMap[positionId];
        if (color && position) {
            element.className = 'washi ' + color + ' ' + position;
            element.style.display = '';
        } else {
            element.style.display = 'none';
        }
    }

    function backgroundCssFromOption(option) {
        const style = { opacity: '', className: '', renderer: '', backgroundColor: '', backgroundImage: '', boxShadow: '', border: '' };
        if (!option) return style;
        const opacity = Number(option.opacity);
        if (Number.isFinite(opacity)) {
            style.opacity = opacity >= 1 && opacity <= 100
                ? String(opacity / 100)
                : String(Math.max(0, Math.min(1, opacity)));
        }
        const mode = String(option.background_mode || '').trim().toLowerCase();
        const solid = String(option.background_solid_color || option.text_color || '').trim();
        style.className = String(option.background_class || '').trim();
        style.renderer = String(option.background_renderer || '').trim();
        if (mode === 'solid' && solid) {
            style.backgroundColor = solid;
        } else if (mode === 'gradient') {
            const angle = Number(option.background_gradient_angle);
            const start = String(option.background_gradient_start || 'rgba(255,255,255,0.14)');
            const end = String(option.background_gradient_end || 'rgba(0,0,0,0.05)');
            style.backgroundImage = `linear-gradient(${Number.isFinite(angle) ? angle : 135}deg, ${start}, ${end})`;
        }
        if (String(option.outline_color || '').trim() && Number(option.outline_thickness) > 0) {
            style.border = `${Number(option.outline_thickness)}px solid ${String(option.outline_color).trim()}`;
        }
        if (String(option.glow_color || '').trim()) {
            style.boxShadow = `inset 0 0 18px ${String(option.glow_color).trim()}`;
        }
        return style;
    }

    function applySlot(element, decoId, baseClass, textOverride) {
        const translator = window.DECORATION_NAME_TRANSLATOR;
        if (!translator || !element) return;
        const config = decoId && catalog[decoId] ? { ...(catalog[decoId].config || {}) } : {};
        if (textOverride !== undefined) config.text = textOverride;
        translator.applyTagPresentation(element, config, baseClass);
    }

    function renderPreview() {
        const message = $('message-input').value || 'This is my chat message!';
        const username = (userRecord && userRecord.username) || $('username-input').value.trim() || 'YourName';
        const prefixId = getSelectedId('name_prefix');
        const nameId = getSelectedId('name_base');
        const suffixId = getSelectedId('name_suffix');
        const messageId = getSelectedId('message_text');
        const backgroundId = getSelectedId('card_background');

        applySlot($('preview-prefix'), prefixId, 'name-prefix name-tag');
        $('preview-dash').style.display = prefixId ? 'none' : '';
        applySlot($('preview-name'), nameId, 'name-base name-tag', username);
        applySlot($('preview-suffix'), suffixId, 'name-suffix name-tag');
        applySlot($('preview-message'), messageId, 'message message-text name-tag', message);

        const card = $('decor-card');
        const background = $('decor-background');
        card.className = 'decor-card';
        background.className = 'decor-background';
        background.removeAttribute('style');
        background.replaceChildren();
        if (window.PuppyCardBackgrounds) {
            window.PuppyCardBackgrounds.clear(card);
            window.PuppyCardBackgrounds.clear(background);
        }

        if (backgroundId && catalog[backgroundId]) {
            const styles = backgroundCssFromOption(catalog[backgroundId].config || {});
            if (styles.className) {
                styles.className.split(/\s+/).filter(Boolean).forEach(className => {
                    background.classList.add(className);
                    if (className.startsWith('bg-chat-')) card.classList.add(className.replace(/^bg-chat-/, 'bg-card-'));
                    if (className.startsWith('bg-card-')) card.classList.add(className);
                });
            }
            background.style.opacity = styles.opacity || '1';
            if (styles.backgroundColor) background.style.backgroundColor = styles.backgroundColor;
            if (styles.backgroundImage) background.style.backgroundImage = styles.backgroundImage;
            if (styles.boxShadow) background.style.boxShadow = styles.boxShadow;
            if (styles.border) background.style.border = styles.border;
            if (styles.renderer && window.PuppyCardBackgrounds) {
                window.PuppyCardBackgrounds.mount(background, styles.renderer);
            }
        }

        renderWashi();
        updateCommand();
        scalePreviewCard();
    }

    function updateCommand() {
        renderSelectionSummary();
        const validation = validateSelection();
        const commandValue = $('command-value');
        const commandState = $('command-state');
        const feedback = $('command-feedback');
        const save = $('save-btn');
        const copy = $('copy-btn');
        const color = $('washi-color-select').value;
        const position = $('washi-pos-select').value;
        const washiStatus = $('washi-status');

        commandValue.textContent = validation.valid ? validation.command : validation.message;
        commandValue.classList.toggle('is-placeholder', !validation.valid);
        commandState.textContent = validation.valid ? 'Ready' : 'Waiting for a valid selection';
        commandState.classList.toggle('is-ready', validation.valid);
        feedback.textContent = validation.message;
        feedback.classList.toggle('is-error', !validation.valid && Boolean(color || position));
        save.disabled = !validation.valid;
        copy.disabled = !validation.valid;

        if (color && position) {
            washiStatus.textContent = 'Washi complete. Both values will be included in the command.';
            washiStatus.className = 'washi-status is-ok';
        } else if (color || position) {
            const missing = [];
            if (!color) missing.push('Tape color');
            if (!position) missing.push('Tape position');
            washiStatus.textContent = `Complete Washi Tape: choose ${missing.join(' and ')}, or clear both Washi fields.`;
            washiStatus.className = 'washi-status is-error';
        } else {
            washiStatus.textContent = 'No Washi selected.';
            washiStatus.className = 'washi-status';
        }
    }

    function scalePreviewCard() {
        const card = $('decor-card');
        const scaler = $('card-scaler');
        const stage = $('preview-stage');
        if (!card || !scaler || !stage || !card.offsetWidth) return;
        const naturalWidth = card.offsetWidth;
        const naturalHeight = card.offsetHeight;
        const availableWidth = Math.max(120, stage.clientWidth - 32);
        const scale = Math.min(1, availableWidth / naturalWidth);
        card.style.transform = 'scale(' + scale.toFixed(4) + ')';
        scaler.style.width = (naturalWidth * scale) + 'px';
        scaler.style.height = (naturalHeight * scale) + 'px';
    }

    function applyQuickAchievement(key) {
        const group = quickGroups.find(candidate => candidate.key === key);
        if (!group) return;
        currentAchievement = group.key;
        $('ach-select').value = group.key;
        quickApplying = true;
        SLOT_ORDER.forEach(slot => { $(SLOT_IDS[slot]).value = ''; });
        group.coherentEntries.forEach(item => {
            const select = $(SLOT_IDS[item.entry.slot]);
            if (select && !select.disabled) select.value = item.id;
        });
        quickApplying = false;
        renderQuickCards();
        renderPreview();
    }

    function setMode(nextMode) {
        mode = nextMode === 'manual' ? 'manual' : 'quick';
        const quick = mode === 'quick';
        $('quick-tab').setAttribute('aria-selected', String(quick));
        $('manual-tab').setAttribute('aria-selected', String(!quick));
        $('quick-tab').tabIndex = quick ? 0 : -1;
        $('manual-tab').tabIndex = quick ? -1 : 0;
        $('quick-panel').hidden = !quick;
        $('manual-panel').hidden = quick;
        $('preview-mode-label').textContent = userRecord
            ? (quick ? 'Quick Load mode' : 'Manual mode')
            : 'Account not loaded';
        if (!quick) {
            currentAchievement = '';
            $('ach-select').value = '';
            renderQuickCards();
        }
    }

    function onCategoryChange() {
        currentCategory = $('cat-select').value;
        currentAchievement = '';
        renderQuickCards();
    }

    function onAchievementChange() {
        const key = $('ach-select').value;
        if (key) applyQuickAchievement(key);
    }

    function onSlotChange() {
        if (!quickApplying) {
            currentAchievement = '';
            $('ach-select').value = '';
            document.querySelectorAll('.achievement-card[aria-pressed="true"]').forEach(card => card.setAttribute('aria-pressed', 'false'));
        }
        renderPreview();
    }

    function onWashiChange() {
        renderPreview();
    }

    function stepSelect(selectId, callbackName, direction) {
        const select = $(selectId);
        if (!select || select.disabled || !select.options.length) return;
        const next = select.selectedIndex + direction;
        if (next < 0 || next >= select.options.length) return;
        select.selectedIndex = next;
        if (typeof window[callbackName] === 'function') window[callbackName]();
    }

    function copyText(text) {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            return navigator.clipboard.writeText(text);
        }
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const copied = document.execCommand('copy');
        area.remove();
        return copied ? Promise.resolve() : Promise.reject(new Error('Clipboard unavailable'));
    }

    function setCopyFeedback(message, isError, targetId) {
        const target = $(targetId);
        if (!target) return;
        target.textContent = message;
        target.style.color = isError ? 'var(--danger)' : 'var(--success)';
        if (copyTimer) clearTimeout(copyTimer);
        copyTimer = setTimeout(() => {
            target.textContent = '';
            target.style.color = '';
        }, 2600);
    }

    async function copyCommand(text, targetId = 'copy-status') {
        const command = text || validateSelection().command;
        if (!command) {
            updateCommand();
            return false;
        }
        try {
            await copyText(command);
            setCopyFeedback('Copied.', false, targetId);
            return true;
        } catch (error) {
            setCopyFeedback('Copy failed. Select the command and copy it manually.', true, targetId);
            return false;
        }
    }

    function closeCommandDialog() {
        const dialog = $('command-dialog');
        if (!dialog) return;
        if (typeof dialog.close === 'function' && dialog.open) dialog.close();
        else dialog.removeAttribute('open');
        $('save-btn').focus();
    }

    function saveCommand() {
        const validation = validateSelection();
        if (!validation.valid) {
            updateCommand();
            return;
        }
        const dialog = $('command-dialog');
        const commandInput = $('modal-command-input');
        commandInput.value = validation.command;
        $('modal-copy-status').textContent = '';
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
        commandInput.focus();
        commandInput.select();
    }

    function wireModeTabs() {
        const tabs = [$('quick-tab'), $('manual-tab')];
        tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => setMode(index === 0 ? 'quick' : 'manual'));
            tab.addEventListener('keydown', event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                let next = index;
                if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
                if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
                if (event.key === 'Home') next = 0;
                if (event.key === 'End') next = tabs.length - 1;
                setMode(next === 0 ? 'quick' : 'manual');
                tabs[next].focus();
            });
        });
    }

    function wireControls() {
        $('username-form').addEventListener('submit', event => {
            event.preventDefault();
            window.loadUser();
        });
        $('cat-select').addEventListener('change', onCategoryChange);
        $('ach-select').addEventListener('change', onAchievementChange);
        SLOT_ORDER.forEach(slot => $(SLOT_IDS[slot]).addEventListener('change', onSlotChange));
        $('washi-color-select').addEventListener('change', onWashiChange);
        $('washi-pos-select').addEventListener('change', onWashiChange);
        $('save-btn').addEventListener('click', saveCommand);
        $('copy-btn').addEventListener('click', () => copyCommand());
        $('modal-copy-btn').addEventListener('click', () => copyCommand($('modal-command-input').value, 'modal-copy-status'));
        $('modal-close-btn').addEventListener('click', closeCommandDialog);
        $('modal-back-btn').addEventListener('click', closeCommandDialog);
        $('change-user-btn').addEventListener('click', () => {
            showUsernameGate();
            $('username-input').focus();
            $('username-input').select();
        });
        $('change-user-header').addEventListener('click', () => {
            showUsernameGate();
            $('username-input').focus();
            $('username-input').select();
        });
        $('retry-btn').addEventListener('click', () => {
            window.loadUser();
        });
        $('edit-user-btn').addEventListener('click', () => {
            showUsernameGate();
            $('username-input').focus();
            $('username-input').select();
        });
    }

    window.loadUser = async function () {
        const input = $('username-input');
        const raw = input.value.trim().replace(/^@/, '');
        if (!raw) {
            setStatus('load-status', 'Enter a Twitch username first.', 'err');
            input.focus();
            return;
        }

        const requestToken = ++loadToken;
        setGateState('loading');
        input.disabled = true;
        $('load-btn').disabled = true;
        try {
            await loadCatalog();
            const usernameMap = await fetchJSON('username_map.json');
            const userId = usernameMap[raw.toLowerCase()];
            if (!userId) {
                if (requestToken !== loadToken) return;
                userRecord = null;
                showLoadError('unknown', 'Check the spelling, then try again. The builder uses the published Twitch username list.');
                return;
            }
            const record = await fetchJSON('users/' + encodeURIComponent(userId) + '.json');
            if (requestToken !== loadToken) return;
            userRecord = record;
            unlockedSet = new Set(Array.isArray(record.decorations?.unlocked) ? record.decorations.unlocked : []);
            const entries = availableEntries();
            if (!entries.length) {
                showLoadError('empty', 'This account is known, but it has no published decoration unlocks to build from yet.');
                return;
            }
            populateDropdowns(record.decorations?.active || {});
            setGateState('ready');
        } catch (error) {
            if (requestToken !== loadToken) return;
            userRecord = null;
            showLoadError('error', 'The public data could not be loaded. Try again in a moment.');
        } finally {
            if (requestToken === loadToken) {
                input.disabled = false;
                $('load-btn').disabled = false;
            }
        }
    };

    window.onCategoryChange = onCategoryChange;
    window.onAchievementChange = onAchievementChange;
    window.onSlotChange = onSlotChange;
    window.onWashiChange = onWashiChange;
    window.stepSelect = stepSelect;
    window.copyCommand = copyCommand;
    window.saveCommand = saveCommand;

    function init() {
        resetControls();
        setMode('quick');
        wireModeTabs();
        wireControls();
        renderPreview();

        const params = new URLSearchParams(window.location.search);
        const preload = params.get('user');
        if (preload) {
            $('username-input').value = preload;
            window.loadUser();
        }

        const stage = $('preview-stage');
        if (stage && window.ResizeObserver) {
            new ResizeObserver(scalePreviewCard).observe(stage);
        } else {
            window.addEventListener('resize', scalePreviewCard);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
}());
