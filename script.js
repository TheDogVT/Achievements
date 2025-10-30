let achData = {};
let foundersData = {};
let allUserData = {}; // cache loaded user data

async function renderAchievements(userId=null, showAll=false) {
    const container = document.getElementById("achievementsContainer");
    container.innerHTML = "";

    let userData = null;
    if (userId) userData = allUserData[userId];

    // Iterate categories
    for (const category of Object.keys(achData)) {
        const catDiv = document.createElement("div");
        const catHeader = document.createElement("h2");
        catHeader.textContent = category;
        catHeader.style.color = "#ffcc00"; // optional styling
        catDiv.appendChild(catHeader);

        const catGrid = document.createElement("div");
        catGrid.style.display = "grid";
        catGrid.style.gridTemplateColumns = "repeat(auto-fit, minmax(250px, 1fr))";
        catGrid.style.gap = "1rem";

        for (const id of Object.keys(achData[category])) {
            const ach = achData[category][id];

            const isEarned = userData ? (userData.achievements.earned[id] || userData.achievements.founded[id]) : false;
            const isFounder = userData ? userData.achievements.founded[id] : false;

            if (!showAll && !isEarned) continue;

            const div = document.createElement("div");
            div.className = "achievement";

            if (isFounder) div.classList.add("founded");
            else if (showAll && isEarned) div.classList.add("highlighted");

            let formattedDate = "Not earned yet";
            if (isEarned) {
                const dateObj = new Date(isEarned);
                formattedDate = dateObj.toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });
            }

            let founderText = "";
            if (foundersData[id]) {
                founderText = `Founder: ${foundersData[id].founder_name}`;
            }

            div.innerHTML = `
                <strong>${ach.name}</strong><br>
                ${ach.Desc}<br>
                <em>Unlocked: ${formattedDate}<br> ${founderText}</em>
            `;

            catGrid.appendChild(div);
        }

        catDiv.appendChild(catGrid);
        container.appendChild(catDiv);
    }
}

async function loadUser(usernameOrId) {
    if (!usernameOrId) return;

    let userId = usernameOrId;

    if (isNaN(Number(usernameOrId))) {
        const mapResp = await fetch('./username_map.json');
        const usernameMap = await mapResp.json();
        userId = usernameMap[usernameOrId.toLowerCase()];
        if (!userId) return alert("Username not found");
    }

    const userResp = await fetch(`users/${userId}.json`);
    if (!userResp.ok) return alert("User not found");
    const userData = await userResp.json();
    allUserData[userId] = userData;

    await renderAchievements(userId, false);
}

async function initPage() {
    const achResp = await fetch('./achievements.json');
    achData = await achResp.json();

    const foundersResp = await fetch('./founders.json');
    foundersData = foundersResp.ok ? await foundersResp.json() : {};

    await renderAchievements(null, true); // default: show all

    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get("user");
    if (userParam) await loadUser(userParam);
}

initPage();

// Button events
document.getElementById("loadBtn").addEventListener("click", () => {
    const input = document.getElementById("userIdInput").value.trim();
    loadUser(input);
});

document.getElementById("showAllBtn").addEventListener("click", async () => {
    const input = document.getElementById("userIdInput").value.trim();
    let userId = null;

    if (input) {
        if (isNaN(Number(input))) {
            const mapResp = await fetch('./username_map.json');
            const usernameMap = await mapResp.json();
            userId = usernameMap[input.toLowerCase()];
        } else {
            userId = input;
        }
        if (userId && !allUserData[userId]) {
            const userResp = await fetch(`users/${userId}.json`);
            if (userResp.ok) allUserData[userId] = await userResp.json();
        }
    }

    await renderAchievements(userId, true);
});
