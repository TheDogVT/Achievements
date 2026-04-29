// ── BUILD LEADERBOARD ─────────────────────────────────────────────────
function buildLeaderboard() {
    const grid = document.getElementById('leaderboardGrid');
    
    // Define categories and their achievement prefixes
    const categories = [
        { name: 'Bits', prefix: 'cheer', icon: '⚡' },
        { name: 'Donations', prefix: 'donation', icon: '💸' },
        { name: 'Gifted Subs', prefix: 'gifted', icon: '🎁' }
    ];
    
    grid.innerHTML = '';
    
    for (const category of categories) {
        const column = document.createElement('div');
        column.className = 'leaderboard-column';
        
        const title = document.createElement('div');
        title.className = 'leaderboard-category';
        title.textContent = `${category.icon} ${category.name}`;
        column.appendChild(title);
        
        // Find each user's highest achievement amount in this category
        const userMaxAchs = [];
        for (const [userId, userData] of Object.entries(allUserData)) {
            let maxAmount = 0;
            let maxAch = null;
            let maxAchId = null;
            let maxAchTs = null;
            
            for (const cat of Object.keys(achData)) {
                for (const [id, ach] of Object.entries(achData[cat])) {
                    if (id.startsWith(category.prefix) && ach.amount) {
                        const earned = userData.achievements?.earned?.[id];
                        const founded = userData.achievements?.founded?.[id];
                        if (earned || founded) {
                            if (ach.amount > maxAmount) {
                                maxAmount = ach.amount;
                                maxAch = ach;
                                maxAchId = id;
                                maxAchTs = earned || founded;
                            }
                        }
                    }
                }
            }
            
            if (maxAch) {
                userMaxAchs.push({
                    userId,
                    username: userData.username || userId,
                    achId: maxAchId,
                    achName: maxAch.name,
                    achDesc: maxAch.desc,
                    amount: maxAmount,
                    timestamp: maxAchTs,
                    rarity: rarityData[maxAchId]?.percentage || 100
                });
            }
        }
        
        // Sort by amount (desc), then by timestamp (most recent first)
        userMaxAchs.sort((a, b) => {
            if (b.amount !== a.amount) return b.amount - a.amount;
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        // Take top 3
        const top3 = userMaxAchs.slice(0, 3);
        
        // Create leaderboard items
        for (const entry of top3) {
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            
            const userDiv = document.createElement('div');
            userDiv.className = 'leaderboard-user';
            userDiv.style.cursor = 'pointer';
            userDiv.addEventListener('click', () => {
                window.location.href = `achievements.html?user=${encodeURIComponent(entry.username)}`;
            });
            
            const avatar = document.createElement('div');
            avatar.className = 'leaderboard-avatar';
            avatar.dataset.username = entry.username;
            const leaderPfp = pfpByUsername[entry.username.toLowerCase()];
            if (leaderPfp) {
                applyPfp(avatar, leaderPfp);
            } else {
                avatar.textContent = entry.username[0].toUpperCase();
                avatar.style.backgroundSize = 'cover';
                avatar.style.backgroundPosition = 'center';
            }
            
            const username = document.createElement('div');
            username.className = 'leaderboard-username';
            username.textContent = entry.username;
            
            userDiv.appendChild(avatar);
            userDiv.appendChild(username);
            
            const achName = document.createElement('div');
            achName.className = 'leaderboard-ach-name';
            achName.textContent = entry.achName;
            
            const achDesc = document.createElement('div');
            achDesc.className = 'leaderboard-ach-desc';
            achDesc.textContent = entry.achDesc;
            
            const rarity = document.createElement('div');
            rarity.className = 'leaderboard-rarity';
            rarity.textContent = `Top ${entry.rarity.toFixed(1)}%`;
            
            item.appendChild(userDiv);
            item.appendChild(achName);
            item.appendChild(achDesc);
            item.appendChild(rarity);
            column.appendChild(item);
        }
        
        grid.appendChild(column);
    }
    
    // Fetch Twitch pfps for leaderboard after building
    setTimeout(() => fetchTwitchPfps(), 100);
}

document.getElementById('leaderboardHeader').addEventListener('click', () => {
    document.getElementById('leaderboard').classList.toggle('collapsed');
});

// ── HOME STATS ────────────────────────────────────────────────────────
function buildHomeStats() {
    const discovered = Object.values(achData).reduce((s, v) => s + Object.keys(v).length, 0);
    const total      = metaData.total_achievements || discovered;
    const users      = metaData.total_users        || Object.keys(allUserData).length;

    document.getElementById('homeStatRow').innerHTML = `
        <div class="home-stat">
            <span class="home-stat-value">${discovered}</span>
            <span class="home-stat-slash">/</span>
            <span class="home-stat-total">${total}</span>
            <span class="home-stat-label">achievements found</span>
        </div>
        <div class="home-stat-divider"></div>
        <div class="home-stat">
            <span class="home-stat-value">${users}</span>
            <span class="home-stat-label">players tracked</span>
        </div>
    `;
}


// ── RECENTLY UNLOCKED FEED ────────────────────────────────────────────
function getTimeAgo(date) {
    const seconds = Math.floor((Date.now() - date) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildRecentFeed() {
    const allEvents = [];
    for (const [achId, users] of Object.entries(recentByAch)) {
        let achName = achId, achCat = 'specific';
        for (const [cat, achs] of Object.entries(achData)) {
            if (achs[achId]) { achName = achs[achId].name; achCat = cat; break; }
        }
        for (const u of users) {
            allEvents.push({ userId: u.userId, username: u.username, timestamp: u.timestamp, achId, achName, achCat });
        }
    }
    allEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const top = allEvents.slice(0, 20);

    const list = document.getElementById('feedList');
    if (top.length === 0) {
        list.innerHTML = '<div class="feed-empty">No activity yet.</div>';
        return;
    }

    list.innerHTML = top.map(ev => {
        const d = new Date(ev.timestamp);
        const timeAgo = getTimeAgo(d);
        const icon = CAT_ICONS[ev.achCat] || '🔹';
        const pfp = pfpByUsername[ev.username.toLowerCase()];
        const initial = pfp ? '' : ev.username[0].toUpperCase();
        const pfpStyle = pfp ? `background-image:url(${pfp});background-size:cover;background-position:center;` : '';
        return `
            <div class="feed-item" data-username="${ev.username}">
                <div class="feed-avatar" style="${pfpStyle}">${initial}</div>
                <div class="feed-body">
                    <div class="feed-line"><span class="feed-user">${ev.username}</span> unlocked <span class="feed-ach">${ev.achName}</span></div>
                    <div class="feed-time">${timeAgo}</div>
                </div>
                <span class="feed-cat-icon">${icon}</span>
            </div>`;
    }).join('');

    list.querySelectorAll('.feed-item').forEach(item => {
        item.addEventListener('click', () => {
            window.location.href = `achievements.html?user=${encodeURIComponent(item.dataset.username)}`;
        });
    });

    // Apply pfps after rendering
    setTimeout(() => {
        list.querySelectorAll('.feed-avatar[data-username]').forEach(el => {
            const pfp = pfpByUsername[el.dataset.username?.toLowerCase()];
            if (pfp) applyPfp(el, pfp);
        });
    }, 100);
}

// ── STARTUP ───────────────────────────────────────────────────────────
loadAllData().then(() => {
    buildHomeStats();
    buildLeaderboard();
    buildRecentFeed();
});
