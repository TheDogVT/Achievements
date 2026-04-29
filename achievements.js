// ── BUILD TABS ────────────────────────────────────────────────────────
function buildTabs(cats) {
    const header = document.getElementById('tabsHeader');
    header.innerHTML = '';
    const allBtn = makeTabBtn('all', '🏆', 'All');
    header.appendChild(allBtn);
    for (const cat of cats) {
        header.appendChild(makeTabBtn(cat, CAT_ICONS[cat] || '🔹', capitalize(cat)));
    }
    updateTabBadges();
}

function makeTabBtn(cat, icon, label) {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (cat === currentCategory ? ' active' : '');
    btn.dataset.cat = cat;
    btn.innerHTML = `${icon} ${label} <span class="badge" id="badge-${cat}">0</span>`;
    btn.addEventListener('click', () => {
        currentCategory = cat;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderAchievements();
    });
    return btn;
}

function updateTabBadges() {
    const userData = currentUserId ? allUserData[currentUserId] : null;
    const allCats = ['all', ...Object.keys(achData)];

    for (const cat of allCats) {
        const badge = document.getElementById(`badge-${cat}`);
        if (!badge) continue;

        if (!userData) {
            if (cat === 'all') {
                badge.textContent = Object.values(achData).reduce((s, v) => s + Object.keys(v).length, 0);
            } else {
                badge.textContent = Object.keys(achData[cat] || {}).length;
            }
        } else {
            const earned  = userData.achievements?.earned  || {};
            const founded = userData.achievements?.founded || {};
            const userAchs = new Set([...Object.keys(earned), ...Object.keys(founded)]);

            if (cat === 'all') {
                badge.textContent = userAchs.size;
            } else {
                const catAchs = Object.keys(achData[cat] || {});
                const count = catAchs.filter(id => userAchs.has(id)).length;
                badge.textContent = count;
            }
        }
    }
}

// ── BUILD SORT DROPDOWN ───────────────────────────────────────────────
function buildSortOptions() {
    const select = document.getElementById('sortSelect');
    select.innerHTML = '';

    if (!currentUserId) {
        select.innerHTML = `
            <option value="name">Name (A-Z)</option>
            <option value="rarity">Rarity (Rarest first)</option>
            <option value="founded">Most recently founded</option>
        `;
        currentSort = 'name';
    } else {
        select.innerHTML = `
            <option value="recent">Most recently unlocked</option>
            <option value="rarity">Rarity (Rarest first)</option>
            <option value="name">Name (A-Z)</option>
        `;
        currentSort = 'recent';
    }
    select.value = currentSort;
}
// ── AUTOCOMPLETE ──────────────────────────────────────────────────────
let autocompleteIndex = -1;
let autocompleteMatches = [];

function updateAutocomplete(query) {
    const dropdown = document.getElementById('autocomplete');
    
    if (!query || query.length < 2) {
        dropdown.classList.remove('visible');
        autocompleteMatches = [];
        return;
    }

    const lowerQuery = query.toLowerCase();
    const matches = Object.entries(usernameMap)
        .filter(([username, id]) => 
            username.toLowerCase().includes(lowerQuery) || 
            id.includes(query)
        )
        .sort((a, b) => a[0].length - b[0].length) // Sort by shortest name first
        .slice(0, 10);

    autocompleteMatches = matches;
    autocompleteIndex = -1;

    if (matches.length === 0) {
        dropdown.innerHTML = '<div class="autocomplete-empty">No users found</div>';
        dropdown.classList.add('visible');
        return;
    }

    dropdown.innerHTML = matches.map(([username, id], idx) => {
        const highlight = username.toLowerCase().indexOf(lowerQuery);
        let displayName = username;
        
        if (highlight >= 0) {
            const before = username.slice(0, highlight);
            const match = username.slice(highlight, highlight + query.length);
            const after = username.slice(highlight + query.length);
            displayName = `${before}<strong>${match}</strong>${after}`;
        }
        
        return `
            <div class="autocomplete-item" data-index="${idx}">
                <span class="username">${displayName}</span>
                <span class="id">${id}</span>
            </div>
        `;
    }).join('');

    dropdown.classList.add('visible');
}

function selectAutocompleteItem(index) {
    if (index < 0 || index >= autocompleteMatches.length) return;
    const [username] = autocompleteMatches[index];
    document.getElementById('userIdInput').value = username;
    document.getElementById('autocomplete').classList.remove('visible');
    loadUser(username);
}

function highlightAutocompleteItem(index) {
    const items = document.querySelectorAll('.autocomplete-item');
    items.forEach((item, idx) => {
        item.classList.toggle('selected', idx === index);
    });
    
    if (index >= 0 && items[index]) {
        items[index].scrollIntoView({ block: 'nearest' });
    }
}

function renderAchievements() {
    const container = document.getElementById('achievementsContainer');
    const userData  = currentUserId ? allUserData[currentUserId] : null;
    container.innerHTML = '';

    const catsToShow = currentCategory === 'all'
        ? Object.keys(achData)
        : [currentCategory];

    let items = [];

    for (const cat of catsToShow) {
        for (const [id, ach] of Object.entries(achData[cat] || {})) {
            const earnedTs  = userData?.achievements?.earned?.[id];
            const foundedTs = userData?.achievements?.founded?.[id];
            const isEarned  = !!(earnedTs || foundedTs);
            const isFounder = !!foundedTs;
            const rarity    = rarityData[id] || { count: 0, percentage: 0, total: 0 };

            if (currentFilter === 'all'      && userData && !isEarned) continue;
            if (currentFilter === 'unlocked' && (!isEarned || isFounder)) continue;
            if (currentFilter === 'founder'  && !isFounder) continue;

            items.push({
                id, ach, cat, isEarned, isFounder,
                earnedTs: earnedTs || foundedTs,
                rarity,
            });
        }
    }

    // Sort
    if (currentSort === 'name') {
        items.sort((a, b) => a.ach.name.localeCompare(b.ach.name));
    } else if (currentSort === 'rarity') {
        items.sort((a, b) => a.rarity.percentage - b.rarity.percentage);
    } else if (currentSort === 'recent') {
        items.sort((a, b) => {
            if (!a.earnedTs) return 1;
            if (!b.earnedTs) return -1;
            return new Date(b.earnedTs) - new Date(a.earnedTs);
        });
    } else if (currentSort === 'founded') {
        items.sort((a, b) => {
            const aFounder = foundersData[a.id];
            const bFounder = foundersData[b.id];
            if (!aFounder) return 1;
            if (!bFounder) return -1;
            return new Date(bFounder.founded_at) - new Date(aFounder.founded_at);
        });
    }

    items.forEach((item, idx) => {
        const card = buildCard(item, userData);
        card.style.animationDelay = `${idx * 20}ms`;
        container.appendChild(card);
    });
    
    // Normalize card heights within each row after rendering
    setTimeout(() => normalizeCardHeights(), 100);

    if (items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        const msg = userData
            ? 'No achievements match this filter.'
            : 'Search for a user to see their achievements.';
        empty.innerHTML = `<div class="icon">🎯</div><p>${msg}</p>`;
        container.appendChild(empty);
    }

    updateStatus(items.length);
    
    // Fetch Twitch pfps for recent users after rendering
    setTimeout(() => fetchTwitchPfps(), 100);
}

// ── NORMALIZE CARD HEIGHTS ────────────────────────────────────────────
function normalizeCardHeights() {
    const container = document.getElementById('achievementsContainer');
    const cards = Array.from(container.querySelectorAll('.achievement'));
    
    if (cards.length === 0) return;
    
    // Group cards by row based on their offsetTop
    const rows = new Map();
    cards.forEach(card => {
        const top = card.offsetTop;
        if (!rows.has(top)) rows.set(top, []);
        rows.get(top).push(card);
    });
    
    // Set min-height for each row to match the tallest card
    rows.forEach(rowCards => {
        const maxHeight = Math.max(...rowCards.map(c => c.offsetHeight));
        rowCards.forEach(c => {
            c.style.minHeight = maxHeight + 'px';
            c.dataset.rowHeight = maxHeight;
        });
    });
}

function buildCard(item, userData) {
    const { id, ach, cat, isEarned, isFounder, earnedTs, rarity } = item;

    const isRare = rarity.percentage > 0 && rarity.percentage <= 5;
    const isPlat = ach.name.startsWith('(Platinum)');

    const div = document.createElement('div');
    let classList = 'achievement';
    if (isPlat) classList += ' plat';
    if (isFounder) {
        classList += ' founded';
        if (isRare) classList += ' rare';
        else classList += ' common';
    } else if (isEarned) {
        classList += ' unlocked';
    }
    div.className = classList;

    const icon = CAT_ICONS[cat] || '🔹';

    let badgeHTML = '';
    if (isPlat) badgeHTML += `<span class="ach-badge badge-plat">PLATINUM</span>`;
    if (isFounder) {
        const founderClass = isRare ? 'badge-founder rare' : 'badge-founder common';
        badgeHTML += `<span class="ach-badge ${founderClass}">FOUNDER</span>`;
    }
    if (isEarned && !isFounder) badgeHTML += `<span class="ach-badge badge-earned">EARNED</span>`;
    if (!isEarned) badgeHTML += `<span class="ach-badge badge-locked">LOCKED</span>`;
    
    // Rarity badge
    if (rarity.count > 0) {
        if (userData && isEarned) {
            // User context: show percentage with rare class if top 5%
            const pct = rarity.percentage.toFixed(1);
            const rarityClass = isRare ? 'badge-rarity rare' : 'badge-rarity';
            badgeHTML += `<span class="ach-badge ${rarityClass}">Top ${pct}%</span>`;
        } else if (!userData) {
            // No user context: show count
            badgeHTML += `<span class="ach-badge badge-rarity">${rarity.count}/${rarity.total}</span>`;
        }
    }

    let metaHTML = '';
    if (isEarned && earnedTs) {
        const d = new Date(earnedTs);
        const formatted = d.toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true
        });
        const dotClass = isFounder ? 'dot-bright' : 'dot-cyan';
        const label    = isFounder ? 'Founded' : 'Unlocked';
        metaHTML += `<div class="ach-meta-row"><span class="dot ${dotClass}"></span>${label}: ${formatted}</div>`;
    }

    if (foundersData[id]) {
        const founderUserId = foundersData[id].founder_id;
        const founderName   = foundersData[id].founder_name;
        if (!userData || currentUserId !== founderUserId) {
            metaHTML += `<div class="ach-meta-row"><span class="dot dot-cyan"></span>First: ${founderName}</div>`;
        }
    }

    // Last 5 users to unlock this achievement (precomputed in loadAllData)
    let recentHTML = '';
    const last5 = recentByAch[id] || [];

    if (last5.length > 0) {
        recentHTML = last5.map(u => {
            const d = new Date(u.timestamp);
            const formatted = d.toLocaleString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            });
            const recentPfp = pfpByUsername[u.username.toLowerCase()];
            const initial = recentPfp ? '' : u.username[0].toUpperCase();
            const recentPfpStyle = recentPfp ? `background-image:url(${recentPfp});background-size:cover;background-position:center;` : '';
            return `
                <div class="recent-user-item" data-userid="${u.userId}">
                    <div class="recent-user-avatar" data-username="${u.username}" style="${recentPfpStyle}">${initial}</div>
                    <div class="recent-user-info">
                        <div class="recent-user-name">${u.username}</div>
                        <div class="recent-user-date">${formatted}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    div.innerHTML = `
        <div class="ach-header">
            <div class="ach-icon">${icon}</div>
            <div class="ach-title-wrap">
                <div class="ach-name">${ach.name}</div>
                <div class="ach-badges">${badgeHTML}</div>
            </div>
        </div>
        <p class="ach-desc">${ach.desc}</p>
        ${metaHTML ? `<div class="ach-meta">${metaHTML}</div>` : ''}
        <div class="ach-spacer"></div>
        ${recentHTML ? `
            <button class="ach-expand-btn">
                <span class="arrow">▼</span>
                <span>Recently Unlocked</span>
                <span class="arrow">▼</span>
            </button>
            <div class="ach-recent-users">
                <div class="ach-recent-title">Last 5 Users</div>
                ${recentHTML}
            </div>
        ` : ''}
    `;
    
    // Add click handler for expand button
    const expandBtn = div.querySelector('.ach-expand-btn');
    if (expandBtn) {
        expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            div.classList.toggle('expanded');
        });
    }

    return div;
}
// ── PROFILE BANNER ────────────────────────────────────────────────────
function showProfile(userId) {
    const userData = allUserData[userId];
    if (!userData) return;

    const earned  = Object.keys(userData.achievements?.earned  || {}).length;
    const founded = Object.keys(userData.achievements?.founded || {}).length;
    const total   = Object.values(achData).reduce((s, v) => s + Object.keys(v).length, 0);
    const pct     = total > 0 ? Math.round(((earned + founded) / total) * 100) : 0;

    const name = userData.username || userId;
    document.getElementById('profileName').textContent   = name;
    document.getElementById('profileStats').textContent  =
        `${earned + founded} / ${total} found (${pct}% of discovered)${founded > 0 ? ` · ${founded} founded` : ''}`;
    document.getElementById('progressFill').style.width  = pct + '%';
    document.getElementById('profileBanner').classList.add('visible');
    
    // Update claim button state (with small delay to ensure DOM is ready)
    const claimBtn = document.getElementById('claimBtn');
    const savedUser = getCookie('myAchievementsUser');
    setTimeout(() => {
        if (savedUser && savedUser.userId === userId) {
            claimBtn.classList.add('claimed');
            claimBtn.textContent = 'Saved ✓';
        } else {
            claimBtn.classList.remove('claimed');
            claimBtn.textContent = 'This is me!';
        }
    }, 50);
    
    const avatarEl = document.getElementById('avatarEl');
    avatarEl.style.backgroundImage = 'none';
    avatarEl.textContent = name[0].toUpperCase();

    if (userData.username) {
        const cached = pfpByUsername[userData.username.toLowerCase()];
        if (cached) {
            applyPfp(avatarEl, cached);
        }
    }
}

function hideProfile() {
    document.getElementById('profileBanner').classList.remove('visible');
}

// ── STATUS BAR ────────────────────────────────────────────────────────
function updateStatus(count) {
    const bar = document.getElementById('statusBar');
    bar.textContent = `SHOWING ${count} DISCOVERED ACHIEVEMENT${count !== 1 ? 'S' : ''}`;
}

// ── LOAD USER ────────────────────────────────────────────────────────
function loadUser(usernameOrId) {
    if (!usernameOrId) return;
    let userId = usernameOrId.trim();

    if (isNaN(Number(userId))) {
        const resolved = usernameMap[userId.toLowerCase()];
        if (!resolved) { showToast('Username not found', true); return; }
        userId = resolved;
    }

    if (!allUserData[userId]) {
        showToast('No data found for that user', true);
        return;
    }

    currentUserId = userId;
    currentFilter = 'all';
    updateFilterChips();
    buildSortOptions();
    document.getElementById('filterRow').classList.add('visible');
    showProfile(userId);
    updateTabBadges();
    renderAchievements();
    
    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── FILTER CHIPS ──────────────────────────────────────────────────────
function updateFilterChips() {
    document.querySelectorAll('.filter-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.filter === currentFilter);
    });
}


// ── EVENTS ────────────────────────────────────────────────────────────
document.getElementById('loadBtn').addEventListener('click', () => {
    const v = document.getElementById('userIdInput').value.trim();
    if (v) {
        document.getElementById('autocomplete').classList.remove('visible');
        loadUser(v);
    }
});

document.getElementById('userIdInput').addEventListener('input', e => {
    updateAutocomplete(e.target.value);
});

document.getElementById('userIdInput').addEventListener('keydown', e => {
    const dropdown = document.getElementById('autocomplete');
    const isOpen = dropdown.classList.contains('visible');

    if (e.key === 'ArrowDown' && isOpen) {
        e.preventDefault();
        autocompleteIndex = Math.min(autocompleteIndex + 1, autocompleteMatches.length - 1);
        highlightAutocompleteItem(autocompleteIndex);
    } else if (e.key === 'ArrowUp' && isOpen) {
        e.preventDefault();
        autocompleteIndex = Math.max(autocompleteIndex - 1, -1);
        highlightAutocompleteItem(autocompleteIndex);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (isOpen && autocompleteIndex >= 0) {
            selectAutocompleteItem(autocompleteIndex);
        } else {
            const v = e.target.value.trim();
            if (v) {
                dropdown.classList.remove('visible');
                loadUser(v);
            }
        }
    } else if (e.key === 'Escape' && isOpen) {
        dropdown.classList.remove('visible');
    }
});

document.getElementById('autocomplete').addEventListener('click', e => {
    const item = e.target.closest('.autocomplete-item');
    if (item) {
        const index = parseInt(item.dataset.index);
        selectAutocompleteItem(index);
    }
});

document.addEventListener('click', e => {
    const input = document.getElementById('userIdInput');
    const dropdown = document.getElementById('autocomplete');
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('visible');
    }
});

function clearUser() {
    currentUserId = null;
    currentFilter = 'all';
    updateFilterChips();
    buildSortOptions();
    hideProfile();
    document.getElementById('filterRow').classList.remove('visible');
    document.getElementById('userIdInput').value = '';
    document.getElementById('autocomplete').classList.remove('visible');
    updateTabBadges();
    renderAchievements();
}

document.getElementById('showAllBtn').addEventListener('click', clearUser);
document.getElementById('clearBtn').addEventListener('click', clearUser);

document.getElementById('claimBtn').addEventListener('click', () => {
    if (!currentUserId) return;
    
    const userData = allUserData[currentUserId];
    if (!userData) return;
    
    // Find most recent achievement
    const earned = userData.achievements?.earned || {};
    const founded = userData.achievements?.founded || {};
    const all = { ...earned, ...founded };
    
    let mostRecentDate = null;
    for (const timestamp of Object.values(all)) {
        const date = new Date(timestamp);
        if (!mostRecentDate || date > mostRecentDate) {
            mostRecentDate = date;
        }
    }
    
    // Save to cookie
    setCookie('myAchievementsUser', {
        userId: currentUserId,
        username: userData.username || currentUserId,
        lastAchievementDate: mostRecentDate ? mostRecentDate.toISOString() : null
    });
    
    // Update button state immediately
    const claimBtn = document.getElementById('claimBtn');
    claimBtn.classList.add('claimed');
    claimBtn.textContent = 'Saved ✓';
    
    showToast('Saved! Your achievements will auto-load next time.');
});

document.getElementById('achievementsContainer').addEventListener('click', (e) => {
    const recentItem = e.target.closest('.recent-user-item');
    if (recentItem && recentItem.dataset.userid) {
        loadUser(recentItem.dataset.userid);
        document.getElementById('userIdInput').value = recentItem.querySelector('.recent-user-name').textContent;
    }
});

document.getElementById('filterRow').addEventListener('click', e => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    currentFilter = chip.dataset.filter;
    updateFilterChips();
    renderAchievements();
});

document.getElementById('sortSelect').addEventListener('change', e => {
    currentSort = e.target.value;
    renderAchievements();
});

// ── INIT ──────────────────────────────────────────────────────────────
async function initPage() {
    buildTabs(Object.keys(achData));
    buildSortOptions();

    const userParam = new URLSearchParams(window.location.search).get('user');
    const savedUser = getCookie('myAchievementsUser');

    if (userParam) {
        loadUser(userParam);
    } else if (savedUser && savedUser.userId) {
        loadUser(savedUser.userId);
        checkNewAchievements(savedUser);
    } else {
        currentFilter = 'all';
        updateFilterChips();
        renderAchievements();
    }
}

// ── STARTUP ───────────────────────────────────────────────────────────
loadAllData().then(() => { initPage(); });
