// ── CONFIG ────────────────────────────────────────────────────────────
const BASE_URL = 'https://raw.githubusercontent.com/TheDogVT/Achievements/main';

// ── UTIL ──────────────────────────────────────────────────────────────
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ── COOKIE HELPERS ────────────────────────────────────────────────────
function setCookie(name, value, days = 365) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${JSON.stringify(value)};expires=${date.toUTCString()};path=/`;
}

function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    if (match) {
        try {
            return JSON.parse(match[2]);
        } catch {
            return null;
        }
    }
    return null;
}

// ── DATA ──────────────────────────────────────────────────────────────
let achData        = {};
let foundersData   = {};
let usernameMap    = {};
let allUserData    = {};
let rarityData     = {};
let recentByAch    = {};  // achId → [{userId, username, timestamp}] sorted desc, top 5
let pfpByUsername  = {};  // username.toLowerCase() → pfp_url, built after load
let currentUserId   = null;
let currentCategory = 'all';
let currentFilter   = 'all';
let currentSort     = 'recent';

// ── LOADING ───────────────────────────────────────────────────────────
function setLoadProgress(pct, msg) {
    document.getElementById('loadingBarFill').style.width = pct + '%';
    document.getElementById('loadingStatus').textContent  = msg;
}

async function loadAllData() {
    setLoadProgress(5, 'Loading achievements…');
    const [achRes, mapRes] = await Promise.all([
        fetch(`${BASE_URL}/achievements.json`),
        fetch(`${BASE_URL}/username_map.json`),
    ]);
    achData     = await achRes.json();
    usernameMap = mapRes.ok ? await mapRes.json() : {};

    setLoadProgress(20, 'Loading user data…');

    const uniqueIds  = [...new Set(Object.values(usernameMap))];
    const BATCH_SIZE = 50;
    let loaded = 0;

    for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
        const batch = uniqueIds.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (id) => {
            try {
                const res = await fetch(`${BASE_URL}/users/${id}.json`);
                if (res.ok) allUserData[id] = await res.json();
            } catch (_) { }
            loaded++;
        }));
        const pct = 20 + Math.round((loaded / uniqueIds.length) * 70);
        setLoadProgress(pct, `Loading users… ${loaded} / ${uniqueIds.length}`);
    }

    setLoadProgress(92, 'Building founder data…');
    for (const [userId, userData] of Object.entries(allUserData)) {
        const founded = userData?.achievements?.founded || {};
        for (const [achId, timestamp] of Object.entries(founded)) {
            const existing = foundersData[achId];
            if (!existing || timestamp < existing.founded_at) {
                foundersData[achId] = {
                    founder_id:   userId,
                    founder_name: userData.username || userId,
                    founded_at:   timestamp,
                };
            }
        }
    }

    setLoadProgress(96, 'Computing rarity…');
    const totalUsers = Object.keys(allUserData).length;
    const achCounts  = {};

    for (const userData of Object.values(allUserData)) {
        const earned  = Object.keys(userData?.achievements?.earned  || {});
        const founded = Object.keys(userData?.achievements?.founded || {});
        const all = new Set([...earned, ...founded]);
        for (const achId of all) {
            achCounts[achId] = (achCounts[achId] || 0) + 1;
        }
    }

    for (const achId of Object.keys(achCounts)) {
        const count = achCounts[achId];
        rarityData[achId] = {
            count: count,
            percentage: totalUsers > 0 ? ((count / totalUsers) * 100) : 0,
            total: totalUsers
        };
    }

    setLoadProgress(98, 'Building recent users index…');
    const recentBuilder = {};
    for (const [uid, udata] of Object.entries(allUserData)) {
        const earned  = udata.achievements?.earned  || {};
        const founded = udata.achievements?.founded || {};
        const username = udata.username || uid;
        for (const [achId, ts] of Object.entries(earned)) {
            (recentBuilder[achId] ||= []).push({ userId: uid, username, timestamp: ts });
        }
        for (const [achId, ts] of Object.entries(founded)) {
            (recentBuilder[achId] ||= []).push({ userId: uid, username, timestamp: ts });
        }
    }
    for (const [achId, users] of Object.entries(recentBuilder)) {
        users.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        recentByAch[achId] = users.slice(0, 5);
    }

    setLoadProgress(100, 'Done!');

    for (const data of Object.values(allUserData)) {
        if (data.pfp_url && data.username) {
            pfpByUsername[data.username.toLowerCase()] = data.pfp_url;
        }
    }

    await new Promise(r => setTimeout(r, 300));

    const screen = document.getElementById('loadingScreen');
    screen.classList.add('fade-out');
    setTimeout(() => screen.remove(), 400);
    document.getElementById('appContent').style.display = 'block';
}

// ── CATEGORY ICONS ────────────────────────────────────────────────────
const CAT_ICONS = {
    chat:     '💬',
    gamble:   '🎲',
    cheer:    '⚡',
    donation: '💸',
    gifted:   '🎁',
    redeem:   '🔑',
    specific: '⭐',
};

// ── TOAST ─────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, isError = false, variant = 'default') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    let className = 'show';
    if (isError) className += ' error';
    if (variant === 'gold') className += ' gold';
    el.className = className;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = ''; }, 4000); // Longer for unlock messages
}
// ── FETCH TWITCH PFPS ─────────────────────────────────────────────────
function applyPfp(el, url) {
    el.style.backgroundImage = `url(${url})`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.textContent = '';
}

function fetchTwitchPfps() {
    document.querySelectorAll('.leaderboard-avatar[data-username], .recent-user-avatar[data-username]').forEach(avatar => {
        const username = avatar.dataset.username;
        if (!username) return;
        const cached = pfpByUsername[username.toLowerCase()];
        if (cached) {
            applyPfp(avatar, cached);
        }
    });
}
// ── CHECK NEW ACHIEVEMENTS ────────────────────────────────────────────
function checkNewAchievements(savedUser) {
    const userData = allUserData[savedUser.userId];
    if (!userData) return;
    
    const lastCheck = savedUser.lastAchievementDate ? new Date(savedUser.lastAchievementDate) : null;
    
    // Check for new founded achievements
    const founded = userData.achievements?.founded || {};
    const newFounded = [];
    for (const [achId, timestamp] of Object.entries(founded)) {
        const achDate = new Date(timestamp);
        if (!lastCheck || achDate > lastCheck) {
            // Find achievement details
            for (const cat of Object.keys(achData)) {
                if (achData[cat][achId]) {
                    newFounded.push({ id: achId, ach: achData[cat][achId], date: achDate });
                    break;
                }
            }
        }
    }
    
    // Check for new earned achievements
    const earned = userData.achievements?.earned || {};
    const newEarned = [];
    for (const [achId, timestamp] of Object.entries(earned)) {
        const achDate = new Date(timestamp);
        if (!lastCheck || achDate > lastCheck) {
            for (const cat of Object.keys(achData)) {
                if (achData[cat][achId]) {
                    newEarned.push({ id: achId, ach: achData[cat][achId], date: achDate });
                    break;
                }
            }
        }
    }
    
    // Sort by date (most recent first)
    newFounded.sort((a, b) => b.date - a.date);
    newEarned.sort((a, b) => b.date - a.date);
    
    // Show notifications
    if (newFounded.length > 0) {
        setTimeout(() => {
            showCongratsToast(newFounded[0].ach.name, true);
        }, 500);
    } else if (newEarned.length > 0) {
        setTimeout(() => {
            showCongratsToast(newEarned[0].ach.name, false);
        }, 500);
    }
}

function showCongratsToast(achName, isFounder) {
    const el = document.getElementById('toast');
    if (isFounder) {
        el.textContent = `🌟 Congrats on founding "${achName}"! 🌟`;
        el.className = 'show founder-toast';
    } else {
        el.textContent = `✨ Congrats on earning "${achName}"! ✨`;
        el.className = 'show';
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = ''; }, 5000);
}
