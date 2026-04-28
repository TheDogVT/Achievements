// ── CONSTELLATION BACKGROUND ──────────────────────────────────────────
const TWINKLING_STARS_COUNT = 30; // Adjust this to control how many twinkling stars

// ── STAR GAME STATE ───────────────────────────────────────────────────
let starGameActive = false;
let starGameScore = 0;
let modeRecords = getCookie('starGameModeRecords') || { normal: 0, twinkle: 0, comet: 0, starclear: 0 };
let fastTwinklers = []; // 5-point fast stars
let starGameTimeLeft = 60; // 60 second timer
let starGameTimerInterval = null;
let starGameStats = { regular: 0, twinkle: 0, bonus: 0, comet: 0 }; // Track star types collected
let particles = []; // Particle effects for star collection
let clickTimes = []; // Track click timestamps for anti-cheat
const MAX_CPS = 10; 
let shootingStar = null; // Shooting star object
let shootingStars = []; // Array of shooting stars for comet rush mode
let shootingStarTimer = null; // Timer for spawning shooting stars
let lastTickTime = 0; // Prevent tick from playing too frequently
let gameMode = 'normal'; // Current game mode
let accessibilitySettings = getCookie('accessibilitySettings') || { mode: 'none', shownNotice: false };

// Save the Stars mode variables
let saveStarsActive = false;
let blackHoles = [];
let redBlackHoles = [];
let playerHP = 500;
let survivalTime = 0;
let saveStarsTimer = null;
let saveStarsInterval = null;
let blackHoleSpawnTimer = null;
let nextBlackHoleDelay = 1500; // Start at 1.5 seconds

const canvas = document.getElementById('constellation');
const ctx = canvas.getContext('2d');

let stars = [];
let twinklingStars = [];
let mouse = { x: null, y: null };
let w, h;

function initConstellation() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    
    // Create stars
    stars = [];
    let starCount;
    if (gameMode === 'starclear') {
        starCount = Math.floor((w * h) / 2000); // 4x more stars in star clear mode!
    } else {
        starCount = Math.floor((w * h) / 8000);
    }
    
    for (let i = 0; i < starCount; i++) {
        stars.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            radius: Math.random() * 1.5 + 0.5,
            brightness: Math.random() * 0.5 + 0.5,
        });
    }
    
    // Initialize twinkling stars array
    twinklingStars = [];
}

function spawnTwinklingStar() {
    // Mode-specific spawning
    if (gameMode === 'comet') return; // No twinkle stars in comet mode
    if (gameMode === 'starclear') return; // No twinkle stars in star clear mode
    
    let isFast;
    if (gameMode === 'twinkle') {
        isFast = Math.random() < 0.3; // 30% chance in twinkle mode (more bonus stars)
    } else {
        isFast = Math.random() < 0.2; // 20% chance normally
    }
    
    const lifetime = isFast ? 2.5 : (5 + Math.random() * 5); // Fast: 2.5s, Normal: 5-10s
    const star = {
        x: Math.random() * w,
        y: Math.random() * h,
        radius: isFast ? (Math.random() * 2.5 + 2) : (Math.random() * 2 + 1), // Fast stars bigger
        lifetime: lifetime,
        age: 0,
        fadeIn: isFast ? 0.5 : 2, // Fast: 0.5s, Normal: 2s
        fadeOut: isFast ? 0.5 : 2, // Fast: 0.5s, Normal: 2s
        points: isFast ? 5 : 2,
        isFast: isFast
    };
    twinklingStars.push(star);
    if (isFast) fastTwinklers.push(star);
}

function drawConstellation() {
    ctx.clearRect(0, 0, w, h);
    
    // Draw connections first (skip on mobile during game mode for performance)
    const isMobile = window.innerWidth < 768;
    const skipConnections = isMobile && starGameActive;
    
    if (!skipConnections) {
        ctx.strokeStyle = 'rgba(198, 232, 232, 0.15)';
        ctx.lineWidth = 0.5;
        
        for (let i = 0; i < stars.length; i++) {
            const star = stars[i];
            
            // Connect to nearby stars
            for (let j = i + 1; j < stars.length; j++) {
                const other = stars[j];
                const dx = star.x - other.x;
                const dy = star.y - other.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < 120) {
                    const opacity = (1 - dist / 120) * 0.3;
                    ctx.strokeStyle = `rgba(198, 232, 232, ${opacity})`;
                    ctx.beginPath();
                    ctx.moveTo(star.x, star.y);
                    ctx.lineTo(other.x, other.y);
                    ctx.stroke();
                }
            }
            
            // Connect to mouse if nearby
            if (mouse.x && mouse.y) {
                const dx = star.x - mouse.x;
                const dy = star.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < 150) {
                    const opacity = (1 - dist / 150) * 0.5;
                    ctx.strokeStyle = `rgba(198, 232, 232, ${opacity})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(star.x, star.y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.stroke();
                    ctx.lineWidth = 0.5;
                    
                    // Pull star toward mouse gently (1/10th original force)
                    const force = (1 - dist / 150) * 0.5;
                    star.vx += (mouse.x - star.x) * force * 0.00001;
                    star.vy += (mouse.y - star.y) * force * 0.00001;
                }
            }
        }
    }
    
    // Draw permanent stars (skip in twinkle mode - only show twinkle/bonus stars)
    if (gameMode !== 'twinkle') {
        for (const star of stars) {
            // Update position
            star.x += star.vx;
            star.y += star.vy;
            
            // Damping
            star.vx *= 0.99;
            star.vy *= 0.99;
            
            // Wrap around edges
            if (star.x < 0) star.x = w;
            if (star.x > w) star.x = 0;
            if (star.y < 0) star.y = h;
            if (star.y > h) star.y = 0;
            
            // Draw star
            const alpha = star.brightness * 0.8;
            const glow = star.radius * 2;
            
            // Change color based on danger level (Save the Stars mode)
            const dangerLevel = star.danger || 0;
            const r = 198 + (255 - 198) * dangerLevel;
            const g = 232 * (1 - dangerLevel);
            const b = 232 * (1 - dangerLevel);
            
            // Glow
            const gradient = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, glow);
            gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha * 0.8})`);
            gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
            ctx.fillStyle = gradient;
            ctx.fillRect(star.x - glow, star.y - glow, glow * 2, glow * 2);
            
            // Core
            const coreR = 224 + (255 - 224) * dangerLevel;
            const coreG = 245 * (1 - dangerLevel);
            const coreB = 245 * (1 - dangerLevel);
            ctx.fillStyle = `rgba(${coreR}, ${coreG}, ${coreB}, ${alpha})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Update and draw twinkling stars (only in game modes)
    if (starGameActive || saveStarsActive) {
        const dt = 1/60; // Assume 60fps
        for (let i = twinklingStars.length - 1; i >= 0; i--) {
            const star = twinklingStars[i];
            star.age += dt;
            
            // Remove if expired
            if (star.age >= star.lifetime) {
                twinklingStars.splice(i, 1);
                const fastIdx = fastTwinklers.indexOf(star);
                if (fastIdx >= 0) fastTwinklers.splice(fastIdx, 1);
                continue;
            }
            
            // Calculate opacity based on age
            let alpha = 1;
            if (star.age < star.fadeIn) {
                // Fading in
                alpha = star.age / star.fadeIn;
            } else if (star.age > star.lifetime - star.fadeOut) {
                // Fading out
                alpha = (star.lifetime - star.age) / star.fadeOut;
            }
            
            // Draw twinkling star - bright cyan for fast stars, normal for regular
            const glow = star.radius * 3;
            const gradient = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, glow);
            
            if (star.isFast) {
                // Bright cyan for 5-point fast stars
                gradient.addColorStop(0, `rgba(224, 245, 245, ${alpha})`);
                gradient.addColorStop(0.5, `rgba(142, 216, 216, ${alpha * 0.7})`);
                gradient.addColorStop(1, 'rgba(198, 232, 232, 0)');
            } else {
                // Normal color for 2-point stars
                gradient.addColorStop(0, `rgba(224, 245, 245, ${alpha * 0.9})`);
                gradient.addColorStop(0.5, `rgba(198, 232, 232, ${alpha * 0.5})`);
                gradient.addColorStop(1, 'rgba(198, 232, 232, 0)');
            }
            
            ctx.fillStyle = gradient;
            ctx.fillRect(star.x - glow, star.y - glow, glow * 2, glow * 2);
            
            // Core - brighter for fast stars
            if (star.isFast) {
                ctx.fillStyle = `rgba(142, 216, 216, ${alpha})`;
            } else {
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            }
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Spawn new twinkling stars to maintain count (only in game mode)
        if (twinklingStars.length < TWINKLING_STARS_COUNT && Math.random() < 0.05) {
            spawnTwinklingStar();
        }
    }
    
    // Draw particles (only in game modes)
    if (starGameActive) {
        updateAndDrawParticles();
        updateAndDrawShootingStar();
    }
    
    // Draw Save the Stars mode
    if (saveStarsActive) {
        updateAndDrawBlackHoles();
        updateAndDrawParticles(); // Draw particles for black hole destruction
    }
    
    requestAnimationFrame(drawConstellation);
}

window.addEventListener('resize', initConstellation);
window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
window.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
});

initConstellation();
drawConstellation();

// ── GAME MODE SELECT ──────────────────────────────────────────────────
let unlockedDuringGame = { twinkle: false, comet: false, starclear: false }; // Track what's been unlocked this session

function checkUnlocks() {
    return {
        twinkle: getCookie('twinkleUnlocked') || false,
        comet: getCookie('cometUnlocked') || false,
        starclear: getCookie('starclearUnlocked') || false
    };
}

function checkForUnlocksDuringGame() {
    // Check unlocks based on THIS game's stats (not lifetime)
    
    // Check Twinkle mode unlock (20 bonus stars in one game)
    if (!unlockedDuringGame.twinkle && !getCookie('twinkleUnlocked') && starGameStats.bonus >= 20) {
        unlockedDuringGame.twinkle = true;
        setCookie('twinkleUnlocked', true);
        playUnlockSound();
        showToast('🎉 Unlocked: Twinkle Twinkle mode! 🎉', false, 'gold');
    }
    
    // Check Comet Rush unlock (3 comets in one game)
    if (!unlockedDuringGame.comet && !getCookie('cometUnlocked') && starGameStats.comet >= 3) {
        unlockedDuringGame.comet = true;
        setCookie('cometUnlocked', true);
        playUnlockSound();
        showToast('🎉 Unlocked: Comet Rush mode! 🎉', false, 'gold');
    }
    
    // Check Star Clear unlock (150 total stars in one game)
    const totalStarsThisGame = starGameStats.regular + starGameStats.twinkle + starGameStats.bonus + starGameStats.comet;
    if (!unlockedDuringGame.starclear && !getCookie('starclearUnlocked') && totalStarsThisGame >= 150) {
        unlockedDuringGame.starclear = true;
        setCookie('starclearUnlocked', true);
        playUnlockSound();
        showToast('🎉 Unlocked: Star Clear mode! 🎉', false, 'gold');
    }
}

function showModeSelect() {
    // Show accessibility notice if first time
    if (!accessibilitySettings.shownNotice) {
        document.getElementById('accessibilityNoticeModal').classList.add('visible');
        return; // Don't show mode select yet
    }
    
    const modal = document.getElementById('modeSelectModal');
    const unlocks = checkUnlocks();
    
    // Update lock states
    document.getElementById('modeTwinkle').classList.toggle('locked', !unlocks.twinkle);
    document.getElementById('lockTwinkle').style.display = unlocks.twinkle ? 'none' : 'block';
    
    document.getElementById('modeComet').classList.toggle('locked', !unlocks.comet);
    document.getElementById('lockComet').style.display = unlocks.comet ? 'none' : 'block';
    
    document.getElementById('modeStarclear').classList.toggle('locked', !unlocks.starclear);
    document.getElementById('lockStarclear').style.display = unlocks.starclear ? 'none' : 'block';
    
    // Update high scores
    document.querySelectorAll('.mode-card').forEach(card => {
        const mode = card.dataset.mode;
        let scoreEl = card.querySelector('.mode-highscore');
        if (!scoreEl) {
            scoreEl = document.createElement('div');
            scoreEl.className = 'mode-highscore';
            card.appendChild(scoreEl);
        }
        scoreEl.textContent = `Best: ${modeRecords[mode] || 0}`;
    });
    
    modal.classList.add('visible');
}

function startGameWithMode(mode) {
    gameMode = mode;
    document.getElementById('modeSelectModal').classList.remove('visible');
    initConstellation(); // Reinitialize stars for the mode
    toggleStarGame();
}

// ── STAR GAME ─────────────────────────────────────────────────────────
function toggleStarGame() {
    starGameActive = !starGameActive;
    document.body.classList.toggle('star-game-active', starGameActive);
    
    const btn = document.getElementById('starGameBtn');
    if (starGameActive) {
        starGameScore = 0;
        starGameTimeLeft = 60;
        starGameStats = { regular: 0, twinkle: 0, bonus: 0, comet: 0 };
        clickTimes = [];
        shootingStar = null;
        shootingStars = []; // Clear comet array
        unlockedDuringGame = { twinkle: false, comet: false, starclear: false }; // Reset unlock tracking
        updateGameScore();
        showToast('⭐ Click stars to collect them! Bright cyan = 5pts ⭐', false);
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>`;
        btn.title = 'Exit Game';
        
        // Start countdown timer
        starGameTimerInterval = setInterval(() => {
            starGameTimeLeft--;
            
            // Play tick sound in last 10 seconds
            if (starGameTimeLeft <= 10 && starGameTimeLeft > 0) {
                playTickSound();
            }
            
            updateGameScore();
            if (starGameTimeLeft <= 0) {
                toggleStarGame(); // End game when time runs out
            }
        }, 1000);
        
        // Start shooting star spawner
        scheduleNextShootingStar();
    } else {
        // Stop timer
        if (starGameTimerInterval) {
            clearInterval(starGameTimerInterval);
            starGameTimerInterval = null;
        }
        
        // Stop shooting star timer
        if (shootingStarTimer) {
            clearTimeout(shootingStarTimer);
            shootingStarTimer = null;
        }
        
        // Clear particles and shooting star
        particles = [];
        shootingStar = null;
        shootingStars = []; // Clear comet array too
        
        // Save current mode before resetting (for game over modal)
        const playedMode = gameMode;
        
        // Reset game mode and stars to normal
        gameMode = 'normal';
        initConstellation();
        
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" fill="rgba(198, 232, 232, 0.2)" stroke="#C6E8E8"/>
        </svg>`;
        btn.title = 'Star Hunt Game';
        
        // Show game over modal with the mode that was played
        showGameOverModal(playedMode);
    }
}

function showGameOverModal(playedMode) {
    const modal = document.getElementById('gameOverModal');
    const currentModeRecord = modeRecords[playedMode] || 0;
    const isNewRecord = starGameScore > currentModeRecord;
    
    // Update record if new high score
    if (isNewRecord) {
        modeRecords[playedMode] = starGameScore;
        // Create fresh object to ensure proper cookie serialization
        setCookie('starGameModeRecords', { ...modeRecords });
        playNewRecordSound();
    } else {
        playGameOverSound();
    }
    
    // Get the final record to display (either the new score or the old record)
    const displayRecord = isNewRecord ? starGameScore : currentModeRecord;
    
    // Update modal content
    document.getElementById('gameOverScore').textContent = starGameScore;
    document.getElementById('statRegular').textContent = starGameStats.regular;
    document.getElementById('statTwinkle').textContent = starGameStats.twinkle;
    document.getElementById('statBonus').textContent = starGameStats.bonus;
    document.getElementById('statComet').textContent = starGameStats.comet;
    
    const recordEl = document.getElementById('gameOverRecord');
    if (isNewRecord) {
        recordEl.textContent = `🏆 NEW ${playedMode.toUpperCase()} RECORD! 🏆`;
        recordEl.style.color = 'var(--gold)';
    } else {
        // Show the current mode's name and best score
        const modeName = playedMode.charAt(0).toUpperCase() + playedMode.slice(1);
        const modeNameFormatted = modeName === 'Starclear' ? 'Star Clear' : modeName;
        recordEl.textContent = `${modeNameFormatted} Best: ${displayRecord}`;
        recordEl.style.color = 'var(--muted)';
    }
    
    modal.classList.add('visible');
}

function updateGameScore(animateScore = false) {
    const scoreEl = document.getElementById('gameScore');
    const labelEl = document.querySelector('.star-game-score .label');
    
    // Only animate score if explicitly requested (on star collection)
    if (animateScore) {
        scoreEl.classList.add('pop');
        setTimeout(() => scoreEl.classList.remove('pop'), 150);
    }
    
    scoreEl.textContent = starGameScore;
    
    // Show current mode's record
    const currentModeRecord = modeRecords[gameMode] || 0;
    document.getElementById('gameRecord').textContent = `Record: ${currentModeRecord}`;
    
    // Update label to show time remaining
    if (starGameActive && labelEl) {
        labelEl.textContent = `TIME: ${starGameTimeLeft}s`;
        
        // Make timer red in last 10 seconds (tick sound handled in timer interval)
        if (starGameTimeLeft <= 10) {
            labelEl.classList.add('danger');
        } else {
            labelEl.classList.remove('danger');
        }
    } else if (labelEl) {
        labelEl.textContent = 'STARS COLLECTED';
        labelEl.classList.remove('danger');
    }
}

// ── SOUND GENERATION ──────────────────────────────────────────────────
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playPopSound(type = 'regular') {
    if (!starGameActive) return;
    
    const now = audioContext.currentTime;
    
    if (type === 'comet') {
        // Epic explosion sound for comets - deep and powerful
        // Bass explosion layer
        const bass = audioContext.createOscillator();
        const bassGain = audioContext.createGain();
        bass.connect(bassGain);
        bassGain.connect(audioContext.destination);
        
        bass.type = 'sine';
        bass.frequency.setValueAtTime(150, now);
        bass.frequency.exponentialRampToValueAtTime(40, now + 0.3);
        
        bassGain.gain.setValueAtTime(0, now);
        bassGain.gain.linearRampToValueAtTime(0.4, now + 0.02);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        
        bass.start(now);
        bass.stop(now + 0.4);
        
        // Mid-range crackle
        const mid = audioContext.createOscillator();
        const midGain = audioContext.createGain();
        const midFilter = audioContext.createBiquadFilter();
        
        mid.connect(midFilter);
        midFilter.connect(midGain);
        midGain.connect(audioContext.destination);
        
        mid.type = 'sawtooth';
        mid.frequency.setValueAtTime(300, now);
        mid.frequency.exponentialRampToValueAtTime(100, now + 0.2);
        
        midFilter.type = 'lowpass';
        midFilter.frequency.setValueAtTime(800, now);
        midFilter.frequency.exponentialRampToValueAtTime(200, now + 0.2);
        
        midGain.gain.setValueAtTime(0, now);
        midGain.gain.linearRampToValueAtTime(0.25, now + 0.01);
        midGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        
        mid.start(now);
        mid.stop(now + 0.25);
        
        // High impact "crash"
        const bufferSize = audioContext.sampleRate * 0.15;
        const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / bufferSize * 8);
        }
        const noise = audioContext.createBufferSource();
        const noiseGain = audioContext.createGain();
        const noiseFilter = audioContext.createBiquadFilter();
        
        noise.buffer = buffer;
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(audioContext.destination);
        
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(400, now);
        noiseGain.gain.setValueAtTime(0.2, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        
        noise.start(now);
        
    } else if (type === 'bonus') {
        // Magical "power-up" sound for bonus stars - lower and warmer
        const osc1 = audioContext.createOscillator();
        const osc2 = audioContext.createOscillator();
        const gain1 = audioContext.createGain();
        const gain2 = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        
        osc1.connect(gain1);
        osc2.connect(gain2);
        gain1.connect(filter);
        gain2.connect(filter);
        filter.connect(audioContext.destination);
        
        // Two oscillators for a richer sound
        osc1.type = 'sine';
        osc2.type = 'sine';
        
        // Lower frequency range - more pleasant
        osc1.frequency.setValueAtTime(400, now);
        osc1.frequency.exponentialRampToValueAtTime(600, now + 0.15);
        
        osc2.frequency.setValueAtTime(500, now); // Fifth above
        osc2.frequency.exponentialRampToValueAtTime(750, now + 0.15);
        
        // Gentle lowpass filter for smoothness
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1500, now);
        filter.frequency.exponentialRampToValueAtTime(2500, now + 0.1);
        filter.Q.setValueAtTime(2, now);
        
        // Volume envelopes
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.15, now + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        
        gain2.gain.setValueAtTime(0, now);
        gain2.gain.linearRampToValueAtTime(0.1, now + 0.02);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        
        osc1.start(now);
        osc1.stop(now + 0.25);
        osc2.start(now);
        osc2.stop(now + 0.25);
        
    } else if (type === 'twinkle') {
        // Warmer pop with slight pitch wobble for twinkle stars
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'triangle'; // Warmer than sine
        oscillator.frequency.setValueAtTime(700, now);
        oscillator.frequency.exponentialRampToValueAtTime(500, now + 0.08);
        
        // Bandpass for character
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, now);
        filter.Q.setValueAtTime(3, now);
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.18, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        
        oscillator.start(now);
        oscillator.stop(now + 0.12);
        
    } else {
        // Snappy bass pop for regular stars
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(300, now);
        oscillator.frequency.exponentialRampToValueAtTime(80, now + 0.04);
        
        // Punchy envelope
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.005);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        
        oscillator.start(now);
        oscillator.stop(now + 0.06);
    }
}

function playGameOverSound() {
    const now = audioContext.currentTime;
    
    // Sad descending arpeggio
    const notes = [600, 550, 500, 400, 350];
    notes.forEach((freq, i) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(freq, now);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000 - (i * 100), now);
        
        const startTime = now + (i * 0.12);
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + 0.25);
    });
    
    // Add low "thud" at the end
    const bass = audioContext.createOscillator();
    const bassGain = audioContext.createGain();
    bass.connect(bassGain);
    bassGain.connect(audioContext.destination);
    
    bass.type = 'sine';
    bass.frequency.setValueAtTime(100, now + 0.5);
    bass.frequency.exponentialRampToValueAtTime(40, now + 0.7);
    
    bassGain.gain.setValueAtTime(0, now + 0.5);
    bassGain.gain.linearRampToValueAtTime(0.3, now + 0.52);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    
    bass.start(now + 0.5);
    bass.stop(now + 0.8);
}

function playNewRecordSound() {
    const now = audioContext.currentTime;
    
    // Epic victory fanfare with chord progressions
    const melody = [
        { freq: 523, time: 0 },      // C
        { freq: 659, time: 0.15 },   // E
        { freq: 784, time: 0.3 },    // G
        { freq: 1047, time: 0.45 }   // C (high)
    ];
    
    melody.forEach((note, i) => {
        // Main melody
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(note.freq, now + note.time);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, now + note.time);
        filter.Q.setValueAtTime(1, now + note.time);
        
        gain.gain.setValueAtTime(0, now + note.time);
        gain.gain.linearRampToValueAtTime(0.12, now + note.time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + 0.2);
        
        osc.start(now + note.time);
        osc.stop(now + note.time + 0.2);
        
        // Harmony (third above)
        const harm = audioContext.createOscillator();
        const harmGain = audioContext.createGain();
        
        harm.connect(harmGain);
        harmGain.connect(audioContext.destination);
        
        harm.type = 'sine';
        harm.frequency.setValueAtTime(note.freq * 1.25, now + note.time);
        
        harmGain.gain.setValueAtTime(0, now + note.time);
        harmGain.gain.linearRampToValueAtTime(0.06, now + note.time + 0.01);
        harmGain.gain.exponentialRampToValueAtTime(0.001, now + note.time + 0.2);
        
        harm.start(now + note.time);
        harm.stop(now + note.time + 0.2);
    });
    
    // Add shimmer at the end
    for (let i = 0; i < 5; i++) {
        const shimmer = audioContext.createOscillator();
        const shimmerGain = audioContext.createGain();
        
        shimmer.connect(shimmerGain);
        shimmerGain.connect(audioContext.destination);
        
        shimmer.type = 'sine';
        shimmer.frequency.setValueAtTime(2000 + (i * 400), now + 0.5 + (i * 0.05));
        
        shimmerGain.gain.setValueAtTime(0.05, now + 0.5 + (i * 0.05));
        shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7 + (i * 0.05));
        
        shimmer.start(now + 0.5 + (i * 0.05));
        shimmer.stop(now + 0.7 + (i * 0.05));
    }
}

function playUnlockSound() {
    const now = audioContext.currentTime;
    
    // Three ascending arpeggios - C major, D major, E major
    const arpeggios = [
        [261.63, 329.63, 392.00, 523.25], // C major arpeggio (C-E-G-C)
        [293.66, 369.99, 440.00, 587.33], // D major arpeggio (D-F#-A-D)
        [329.63, 415.30, 493.88, 659.25]  // E major arpeggio (E-G#-B-E)
    ];
    
    let timeOffset = 0;
    
    arpeggios.forEach((arpeggio, arpeggioIndex) => {
        arpeggio.forEach((freq, noteIndex) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            const filter = audioContext.createBiquadFilter();
            
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(audioContext.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + timeOffset);
            
            // Bright filter
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(3000, now + timeOffset);
            filter.Q.setValueAtTime(2, now + timeOffset);
            
            // Quick attack, sustain
            gain.gain.setValueAtTime(0, now + timeOffset);
            gain.gain.linearRampToValueAtTime(0.15, now + timeOffset + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.25);
            
            osc.start(now + timeOffset);
            osc.stop(now + timeOffset + 0.25);
            
            timeOffset += 0.1; // 100ms between notes
        });
        
        timeOffset += 0.1; // Extra gap between arpeggios
    });
}

function playTickSound() {
    if (!starGameActive) return;
    
    // Prevent tick from playing more than once per second
    const now = Date.now();
    if (now - lastTickTime < 900) return; // 900ms cooldown
    lastTickTime = now;
    
    const audioNow = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioNow);
    
    gain.gain.setValueAtTime(0.1, audioNow);
    gain.gain.exponentialRampToValueAtTime(0.001, audioNow + 0.05);
    
    osc.start(audioNow);
    osc.stop(audioNow + 0.05);
}

// ── PARTICLE EFFECTS ──────────────────────────────────────────────────
function createParticles(x, y, color, count = 8) {
    if (!starGameActive && !saveStarsActive) return;
    
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const speed = 2 + Math.random() * 3;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            decay: 0.02 + Math.random() * 0.02,
            size: 2 + Math.random() * 2,
            color: color
        });
    }
}

function updateAndDrawParticles() {
    if (!starGameActive || particles.length === 0) return;
    
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        
        // Update
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // Gravity
        p.life -= p.decay;
        
        // Remove dead particles
        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }
        
        // Draw
        const alpha = p.life;
        ctx.fillStyle = `rgba(${p.color}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Glow
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
        gradient.addColorStop(0, `rgba(${p.color}, ${alpha * 0.5})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(p.x - p.size * 2, p.y - p.size * 2, p.size * 4, p.size * 4);
    }
}

// ── SHOOTING STAR ─────────────────────────────────────────────────────
function spawnShootingStar() {
    // In comet mode, allow multiple comets
    if (gameMode === 'comet') {
        if (shootingStars.length >= 5) return; // Max 5 comets at once
    } else {
        if (shootingStar) return; // Only one in other modes
    }
    
    if (!starGameActive) return;
    
    // Detect mobile
    const isMobile = window.innerWidth < 768;
    
    // Random starting position
    let x, y, vx, vy;
    
    if (isMobile) {
        // On mobile: spawn from left/right edges, always go through middle, faster
        const fromLeft = Math.random() < 0.5;
        const verticalPos = h * 0.3 + Math.random() * h * 0.4; // 30-70% of screen height
        
        // Speed multiplier based on mode
        let speedMult = 1.0;
        if (gameMode === 'comet') speedMult = 1.2; // 20% faster in comet rush on mobile (since it's already more intense)
        else if (gameMode === 'normal') speedMult = 1; // normal speed on mobile, smaller screen leaves less reaction time
        
        if (fromLeft) {
            x = -20;
            y = verticalPos;
            vx = (7 + Math.random() * 3) * speedMult; // Increased range: 8-10
            vy = (Math.random() - 0.5) * 3 * speedMult;
        } else {
            x = w + 20;
            y = verticalPos;
            vx = -(7 + Math.random() * 3) * speedMult;
            vy = (Math.random() - 0.5) * 3 * speedMult;
        }
    } else {
        // Desktop: original behavior from any edge
        const side = Math.floor(Math.random() * 4);
        
        // Speed multiplier based on mode
        let speedMult = 1.0;
        if (gameMode === 'comet') speedMult = 1.4; // 40% faster in comet rush
        else if (gameMode === 'normal') speedMult = 1.2; // 20% faster in normal
        
        if (side === 0) { // Top
            x = Math.random() * w;
            y = -20;
            vx = (Math.random() - 0.5) * 7 * speedMult; // Increased range
            vy = (4.8 + Math.random() * 4) * speedMult; // 4.8-8.8
        } else if (side === 1) { // Right
            x = w + 20;
            y = Math.random() * h;
            vx = -(4.8 + Math.random() * 4) * speedMult;
            vy = (Math.random() - 0.5) * 7 * speedMult;
        } else if (side === 2) { // Bottom
            x = Math.random() * w;
            y = h + 20;
            vx = (Math.random() - 0.5) * 7 * speedMult;
            vy = -(4.8 + Math.random() * 4) * speedMult;
        } else { // Left
            x = -20;
            y = Math.random() * h;
            vx = (4.8 + Math.random() * 4) * speedMult;
            vy = (Math.random() - 0.5) * 7 * speedMult;
        }
    }
    
    const newComet = {
        x: x,
        y: y,
        vx: vx,
        vy: vy,
        trail: [],
        radius: 6,
        points: 15
    };
    
    // In comet mode, add to array; otherwise use single comet
    if (gameMode === 'comet') {
        shootingStars.push(newComet);
    } else {
        shootingStar = newComet;
    }
    
    // Schedule next shooting star
    scheduleNextShootingStar();
}

function scheduleNextShootingStar() {
    if (!starGameActive) return;
    
    let delay;
    if (gameMode === 'comet') {
        delay = (0.2 + Math.random() * 2) * 1000; // 0.2-2 seconds in comet rush for more intensity
    } else if (gameMode === 'twinkle' || gameMode === 'starclear') {
        return; // No comets in these modes
    } else {
        delay = (3 + Math.random() * 7) * 1000; // 3-10 seconds in normal mode
    }
    
    shootingStarTimer = setTimeout(spawnShootingStar, delay);
}

function updateAndDrawShootingStar() {
    // Handle single comet (normal modes)
    if (shootingStar) {
        updateSingleComet(shootingStar);
        
        // Remove if offscreen
        if (shootingStar.x < -50 || shootingStar.x > w + 50 ||
            shootingStar.y < -50 || shootingStar.y > h + 50) {
            shootingStar = null;
        }
    }
    
    // Handle multiple comets (comet rush mode)
    for (let i = shootingStars.length - 1; i >= 0; i--) {
        const comet = shootingStars[i];
        updateSingleComet(comet);
        
        // Remove if offscreen
        if (comet.x < -50 || comet.x > w + 50 ||
            comet.y < -50 || comet.y > h + 50) {
            shootingStars.splice(i, 1);
        }
    }
}

function updateSingleComet(star) {
    // Update position
    star.x += star.vx;
    star.y += star.vy;
    
    // Add to trail
    star.trail.push({ x: star.x, y: star.y });
    if (star.trail.length > 15) {
        star.trail.shift();
    }
    
    // Draw trail
    for (let i = 0; i < star.trail.length; i++) {
        const t = star.trail[i];
        const alpha = (i / star.trail.length) * 0.8;
        const size = (i / star.trail.length) * star.radius;
        
        // Red gradient trail
        const gradient = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, size * 3);
        gradient.addColorStop(0, `rgba(255, 100, 100, ${alpha})`);
        gradient.addColorStop(0.5, `rgba(255, 150, 100, ${alpha * 0.5})`);
        gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(t.x - size * 3, t.y - size * 3, size * 6, size * 6);
    }
    
    // Draw shooting star core
    const coreGradient = ctx.createRadialGradient(
        star.x, star.y, 0,
        star.x, star.y, star.radius * 3
    );
    coreGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    coreGradient.addColorStop(0.3, 'rgba(255, 100, 100, 0.8)');
    coreGradient.addColorStop(1, 'rgba(255, 100, 100, 0)');
    ctx.fillStyle = coreGradient;
    ctx.fillRect(
        star.x - star.radius * 3,
        star.y - star.radius * 3,
        star.radius * 6,
        star.radius * 6
    );
    
    // Draw star core
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
}

// ── ANTI-CHEAT ────────────────────────────────────────────────────────
function showCheatWarning() {
    const modal = document.getElementById('cheatWarningModal');
    modal.classList.add('visible');
    
    // Pause game but don't end it
    if (starGameTimerInterval) {
        clearInterval(starGameTimerInterval);
        starGameTimerInterval = null;
    }
}

function checkStarClick(x, y) {
    if (!starGameActive) return;
    
    // Anti-cheat: Check click rate
    const now = Date.now();
    clickTimes.push(now);
    
    // Keep only clicks from the last second
    clickTimes = clickTimes.filter(time => now - time < 1000);
    
    // If too many clicks per second, show warning
    if (clickTimes.length > MAX_CPS) {
        showCheatWarning();
        return false;
    }
    
    const clickRadius = 25; // Increased from 20 for easier comet clicking
    
    // Check single shooting star first (normal modes)
    if (shootingStar) {
        const dx = shootingStar.x - x;
        const dy = shootingStar.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < clickRadius + 5) { // Extra 5px for comets
            starGameScore += shootingStar.points;
            starGameStats.comet++;
            createParticles(shootingStar.x, shootingStar.y, '255, 100, 100', 30);
            playPopSound('comet');
            updateGameScore(true);
            
            // Check for unlocks during gameplay (only in normal mode)
            if (gameMode === 'normal') {
                checkForUnlocksDuringGame();
            }
            
            shootingStar = null;
            return true;
        }
    }
    
    // Check multiple shooting stars (comet rush mode)
    for (let i = shootingStars.length - 1; i >= 0; i--) {
        const star = shootingStars[i];
        const dx = star.x - x;
        const dy = star.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < clickRadius + 5) {
            starGameScore += star.points;
            starGameStats.comet++;
            createParticles(star.x, star.y, '255, 100, 100', 30);
            playPopSound('comet');
            updateGameScore(true);
            
            // Check for unlocks during gameplay (only in normal mode)
            if (gameMode === 'normal') {
                checkForUnlocksDuringGame();
            }
            
            shootingStars.splice(i, 1);
            return true;
        }
    }
    
    // Check twinkling stars
    for (let i = twinklingStars.length - 1; i >= 0; i--) {
        const star = twinklingStars[i];
        const dx = star.x - x;
        const dy = star.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < clickRadius) {
            starGameScore += star.points;
            
            // Track star type and create effects
            if (star.isFast) {
                starGameStats.bonus++;
                createParticles(star.x, star.y, '142, 216, 216', 12); // Bright cyan, more particles
                playPopSound('bonus');
                
                // Check for unlocks during gameplay (only in normal mode)
                if (gameMode === 'normal') {
                    checkForUnlocksDuringGame();
                }
            } else {
                starGameStats.twinkle++;
                createParticles(star.x, star.y, '198, 232, 232', 8); // Normal cyan
                playPopSound('twinkle');
            }
            
            updateGameScore(true); // Animate score
            twinklingStars.splice(i, 1);
            
            // Remove from fastTwinklers if present
            const fastIdx = fastTwinklers.indexOf(star);
            if (fastIdx >= 0) fastTwinklers.splice(fastIdx, 1);
            
            // Spawn replacement
            spawnTwinklingStar();
            return true;
        }
    }
    
    // Check constellation stars (skip in twinkle mode - only twinkle/bonus stars there)
    if (gameMode === 'twinkle') return false;
    
    // Check constellation stars (1 point, respawn immediately except in star clear mode)
    for (const star of stars) {
        const dx = star.x - x;
        const dy = star.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < clickRadius) {
            starGameScore += 1;
            starGameStats.regular++;
            createParticles(star.x, star.y, '255, 255, 255', 6); // White particles
            playPopSound('regular');
            updateGameScore(true); // Animate score
            
            // Check for unlocks during gameplay (only in normal mode)
            if (gameMode === 'normal') {
                checkForUnlocksDuringGame();
            }
            
            // In star clear mode, remove the star permanently
            if (gameMode === 'starclear') {
                const index = stars.indexOf(star);
                if (index > -1) stars.splice(index, 1);
            } else {
                // In other modes, respawn star at new position
                star.x = Math.random() * w;
                star.y = Math.random() * h;
            }
            return true;
        }
    }
    
    return false;
}

// Star game button - show mode select
document.getElementById('starGameBtn').addEventListener('click', () => {
    if (starGameActive) {
        toggleStarGame(); // If game is active, end it
    } else {
        showModeSelect(); // Otherwise show mode select
    }
});

// Game over modal buttons
document.getElementById('tryAgainBtn').addEventListener('click', () => {
    document.getElementById('gameOverModal').classList.remove('visible');
    toggleStarGame(); // Start a new game
});

document.getElementById('closeGameBtn').addEventListener('click', () => {
    document.getElementById('gameOverModal').classList.remove('visible');
});

document.getElementById('changeModeBtn').addEventListener('click', () => {
    document.getElementById('gameOverModal').classList.remove('visible');
    showModeSelect();
});

// Cheat warning modal button
document.getElementById('cheatOkBtn').addEventListener('click', () => {
    document.getElementById('cheatWarningModal').classList.remove('visible');
    clickTimes = []; // Reset click tracking
    
    // Resume timer if game is still active
    if (starGameActive && !starGameTimerInterval) {
        starGameTimerInterval = setInterval(() => {
            starGameTimeLeft--;
            updateGameScore();
            if (starGameTimeLeft <= 0) {
                toggleStarGame();
            }
        }, 1000);
    }
});

// Mode select cards
document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => {
        if (card.classList.contains('locked')) {
            showToast('Complete the challenge to unlock this mode!', true);
            return;
        }
        const mode = card.dataset.mode;
        startGameWithMode(mode);
    });
});

// Mode select settings button
document.getElementById('modeSelectSettingsBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('modeSelectModal').classList.remove('visible');
    openAccessibilitySettings();
});

// Accessibility notice OK button
document.getElementById('accessibilityOkBtn').addEventListener('click', () => {
    accessibilitySettings.shownNotice = true;
    setCookie('accessibilitySettings', accessibilitySettings);
    document.getElementById('accessibilityNoticeModal').classList.remove('visible');
    showModeSelect(); // Now show the mode select
});

// Accessibility settings
function openAccessibilitySettings() {
    const modal = document.getElementById('accessibilitySettingsModal');
    // Set current selection
    document.querySelector(`input[name="accessMode"][value="${accessibilitySettings.mode}"]`).checked = true;
    modal.classList.add('visible');
}

document.getElementById('saveAccessibilityBtn').addEventListener('click', () => {
    const selected = document.querySelector('input[name="accessMode"]:checked').value;
    accessibilitySettings.mode = selected;
    setCookie('accessibilitySettings', accessibilitySettings);
    applyAccessibilitySettings();
    document.getElementById('accessibilitySettingsModal').classList.remove('visible');
    showToast('Accessibility settings saved!');
    showModeSelect(); // Return to mode select
});

// Apply accessibility settings
function applyAccessibilitySettings() {
    // Clear any existing intervals
    if (window.accessibilityInterval) {
        clearInterval(window.accessibilityInterval);
        window.accessibilityInterval = null;
    }
    
    // Remove previous spacebar handler if exists
    if (window.spaceHandler) {
        document.removeEventListener('keydown', window.spaceHandler);
        window.spaceHandler = null;
    }
    
    // Abort previous canvas click listeners
    if (window.canvasAbortController) {
        window.canvasAbortController.abort();
    }
    window.canvasAbortController = new AbortController();
    
    if (accessibilitySettings.mode === 'spacebar') {
        // Spacebar click mode
        window.spaceHandler = (e) => {
            if (e.code === 'Space' && (starGameActive || saveStarsActive)) {
                e.preventDefault();
                if (saveStarsActive) {
                    checkBlackHoleClick(mouse.x, mouse.y);
                } else {
                    checkStarClick(mouse.x, mouse.y);
                }
            }
        };
        document.addEventListener('keydown', window.spaceHandler);
        
        // Still allow mouse clicks
        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            if (saveStarsActive) {
                checkBlackHoleClick(x, y);
            } else {
                checkStarClick(x, y);
            }
        }, { signal: window.canvasAbortController.signal });
        
    } else if (accessibilitySettings.mode === 'alwayson') {
        // Always-on cursor mode - 4 clicks per second (every 250ms)
        window.accessibilityInterval = setInterval(() => {
            if (starGameActive && mouse.x && mouse.y) {
                checkStarClick(mouse.x, mouse.y);
            } else if (saveStarsActive && mouse.x && mouse.y) {
                checkBlackHoleClick(mouse.x, mouse.y);
            }
        }, 250); // 4 times per second
        
        // Still allow manual clicks
        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            if (saveStarsActive) {
                checkBlackHoleClick(x, y);
            } else {
                checkStarClick(x, y);
            }
        }, { signal: window.canvasAbortController.signal });
        
    } else {
        // Default mouse-only mode
        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            if (saveStarsActive) {
                checkBlackHoleClick(x, y);
            } else {
                checkStarClick(x, y);
            }
        }, { signal: window.canvasAbortController.signal });
    }
}

// Initialize accessibility on load
applyAccessibilitySettings();

// Easter egg hint for the nerds
console.log('%c↑↑↓↓←→←→BA', 'font-size: 20px; color: #C6E8E8; font-weight: bold;');
console.log('%cClassic gamers know... 🎮', 'color: #999; font-style: italic;');

// ── KONAMI CODE ───────────────────────────────────────────────────────
const konamiSequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 
                        'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 
                        'KeyB', 'KeyA'];
let konamiIndex = 0;

function playKonamiChime(isCorrect, isFirst = false) {
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    if (isCorrect) {
        // Ascending chime for correct keys
        const freq = 400 + (konamiIndex * 100); // Gets higher with each correct key
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        
        osc.start(now);
        osc.stop(now + 0.2);
    } else {
        // Womp womp for wrong key
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
        
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        
        osc.start(now);
        osc.stop(now + 0.3);
    }
}

function playKonamiFanfare() {
    const now = audioContext.currentTime;
    
    // Epic ascending fanfare
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C-E-G-C octave
    
    notes.forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + (i * 0.15));
        
        gain.gain.setValueAtTime(0.2, now + (i * 0.15));
        gain.gain.exponentialRampToValueAtTime(0.001, now + (i * 0.15) + 0.3);
        
        osc.start(now + (i * 0.15));
        osc.stop(now + (i * 0.15) + 0.3);
    });
}

document.addEventListener('keydown', (e) => {
    // Only listen when not in active game
    if (starGameActive || saveStarsActive) return;
    
    if (e.code === konamiSequence[konamiIndex]) {
        konamiIndex++;
        playKonamiChime(true, konamiIndex === 1);
        
        if (konamiIndex === konamiSequence.length) {
            // Code complete!
            playKonamiFanfare();
            setTimeout(() => {
                showKonamiModal();
            }, 600);
            konamiIndex = 0;
        }
    } else if (konamiSequence.includes(e.code)) {
        // Wrong key in sequence
        playKonamiChime(false);
        konamiIndex = 0;
    }
});

function showKonamiModal() {
    document.getElementById('konamiModal').classList.add('visible');
}

// ── SAVE THE STARS MODE ───────────────────────────────────────────────

// Konami start button
document.getElementById('konamiStartBtn').addEventListener('click', () => {
    document.getElementById('konamiModal').classList.remove('visible');
    startSaveTheStarsMode();
});

function startSaveTheStarsMode() {
    // Make sure star game is off
    if (starGameActive) {
        toggleStarGame();
    }
    
    // Hide profile banner if visible
    document.getElementById('profileBanner').classList.remove('visible');
    document.getElementById('filterRow').classList.remove('visible');
    
    // Set up Save the Stars mode
    saveStarsActive = true;
    playerHP = 500;
    survivalTime = 0;
    blackHoles = [];
    redBlackHoles = [];
    nextBlackHoleDelay = 1500;
    
    // Add body class for game mode
    document.body.classList.add('save-stars-active');
    
    // Update game timer display
    updateSaveStarsUI();
    
    // Start survival timer (counts seconds)
    saveStarsTimer = setInterval(() => {
        survivalTime++;
        updateSaveStarsUI();
    }, 1000);
    
    // Start black hole spawning
    scheduleNextBlackHole();
    
    showToast('Save the stars from the black holes!');
}

function updateSaveStarsUI() {
    // Update HP and time display (will create UI elements)
    const hpDisplay = document.getElementById('saveStarsHP');
    const timeDisplay = document.getElementById('saveStarsTime');
    
    if (hpDisplay) hpDisplay.textContent = playerHP;
    if (timeDisplay) timeDisplay.textContent = survivalTime;
}

function scheduleNextBlackHole() {
    if (!saveStarsActive) return;
    
    // Difficulty scaling - much slower now
    
    nextBlackHoleDelay = Math.max(650, nextBlackHoleDelay * 0.995); 
    

    blackHoleSpawnTimer = setTimeout(() => {
        spawnBlackHole();
        scheduleNextBlackHole();
    }, nextBlackHoleDelay);
}

function spawnBlackHole() {
    const isRed = survivalTime >= 60 && (survivalTime < 90 ? Math.random() < 0.3 : Math.random() < 0.7);
    
    // Fixed center size - only grows for red holes when consuming
    const centerSize = 12; // Fixed small clickable target
    
    // Determine event horizon size based on time
    let minEventSize, maxEventSize;
    if (survivalTime < 10) {
        minEventSize = 40;
        maxEventSize = 60;
    } else if (survivalTime < 30) {
        minEventSize = 50;
        maxEventSize = 80;
    } else {
        minEventSize = 60;
        maxEventSize = 100;
    }
    
    const targetEventSize = minEventSize + Math.random() * (maxEventSize - minEventSize);
    
    // Safe boundaries for spawning (account for mobile, leave 100px margin)
    const margin = 100;
    const safeMinX = margin;
    const safeMaxX = w - margin;
    const safeMinY = margin;
    const safeMaxY = h - margin;
    
    // Try to find a position away from stars (up to 10 attempts)
    let x, y, tooClose;
    let attempts = 0;
    do {
        x = safeMinX + Math.random() * (safeMaxX - safeMinX);
        y = safeMinY + Math.random() * (safeMaxY - safeMinY);
        
        // Check if too close to any star
        tooClose = false;
        const minDistanceFromStar = 80; // Stay at least 80px from stars
        for (const star of stars) {
            const dx = star.x - x;
            const dy = star.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDistanceFromStar) {
                tooClose = true;
                break;
            }
        }
        attempts++;
    } while (tooClose && attempts < 10);
    
    const blackHole = {
        x: x,
        y: y,
        centerRadius: 0, // Start at 0 for spawn animation
        eventRadius: 0, // Start at 0 for spawn animation
        targetCenterRadius: centerSize, // Target size
        targetEventRadius: targetEventSize, // Target size
        growthRate: 0.5, // pixels per frame for center
        eventGrowthRate: 2, // Event horizon grows 2x faster
        hp: isRed ? centerSize * 3 : 0, // Red holes have HP (increased since center is smaller)
        maxHP: isRed ? centerSize * 3 : 0,
        isRed: isRed,
        age: 0,
        spawning: true, // Flag for spawn animation
        spawnProgress: 0 // 0 to 1
    };
    
    if (isRed) {
        redBlackHoles.push(blackHole);
    } else {
        blackHoles.push(blackHole);
    }
}

function updateAndDrawBlackHoles() {
    const allBlackHoles = [...blackHoles, ...redBlackHoles];
    
    for (const bh of allBlackHoles) {
        bh.age++;
        
        // Handle spawn animation
        if (bh.spawning) {
            bh.spawnProgress += 0.022; // Fast spawn animation
            if (bh.spawnProgress >= 1) {
                bh.spawnProgress = 1;
                bh.spawning = false;
            }
            // Ease-in cubic for smooth spawn
            const easeProgress = bh.spawnProgress * bh.spawnProgress * bh.spawnProgress;
            bh.centerRadius = bh.targetCenterRadius * easeProgress;
            bh.eventRadius = bh.targetEventRadius * easeProgress;
        } else {
            // Normal growth after spawn
            // Event horizon grows faster after 60 seconds for purple holes
            let eventGrowthMultiplier = 1;
            if (!bh.isRed && survivalTime >= 30 && survivalTime <= 60) {
                eventGrowthMultiplier = 2; // 4) Double speed after 60s for purple
            }
            if (!bh.isRed && survivalTime >= 60 && survivalTime <= 120) {
                eventGrowthMultiplier = 4; // 4) Double speed after 60s for purple
            }
            if (!bh.isRed && survivalTime >= 120) {
                eventGrowthMultiplier = 6; // 4) Double speed after 60s for purple
            }
            if(bh.isRed && survivalTime >= 90 && survivalTime <= 120){
                eventGrowthMultiplier = 2;
            }
            if(bh.isRed && survivalTime >= 120){
                eventGrowthMultiplier = 4;
            }
            bh.eventRadius += bh.eventGrowthRate * 0.016 * eventGrowthMultiplier;
            // Center only grows for red holes when consuming (handled in consumeStar)
        }
        
        // Draw event horizon (transparent purple/red circle with swirl)
        const gradient = ctx.createRadialGradient(bh.x, bh.y, 0, bh.x, bh.y, Math.max(1, bh.eventRadius));
        if (bh.isRed) {
            gradient.addColorStop(0, 'rgba(150, 0, 50, 0.8)');
            gradient.addColorStop(0.5, 'rgba(100, 0, 50, 0.4)');
            gradient.addColorStop(1, 'rgba(50, 0, 30, 0)');
        } else {
            gradient.addColorStop(0, 'rgba(100, 0, 150, 0.8)');
            gradient.addColorStop(0.5, 'rgba(80, 0, 120, 0.4)');
            gradient.addColorStop(1, 'rgba(50, 0, 80, 0)');
        }
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(bh.x, bh.y, bh.eventRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw swirl effect - each arc spins at different speed
        ctx.save();
        ctx.translate(bh.x, bh.y);
        ctx.strokeStyle = bh.isRed ? 'rgba(255, 50, 100, 0.3)' : 'rgba(150, 100, 255, 0.3)';
        ctx.lineWidth = 2;
        
        const speeds = [0.05, 0.08, 0.12]; // Different rotation speeds for each arc
        for (let i = 0; i < 3; i++) {
            ctx.save();
            ctx.rotate(bh.age * speeds[i]); // Each arc rotates at different speed
            const swirlRadius = Math.max(1, bh.eventRadius * 0.7 - (i * 10)); // Prevent negative
            ctx.beginPath();
            ctx.arc(0, 0, swirlRadius, 0, Math.PI * 1.5);
            ctx.stroke();
            ctx.restore();
        }
        ctx.restore();
        
        // Draw center (clickable death zone)
        const centerGradient = ctx.createRadialGradient(bh.x, bh.y, 0, bh.x, bh.y, bh.centerRadius);
        if (bh.isRed) {
            centerGradient.addColorStop(0, 'rgba(200, 0, 50, 1)');
            centerGradient.addColorStop(1, 'rgba(100, 0, 50, 0.8)');
        } else {
            centerGradient.addColorStop(0, 'rgba(150, 0, 200, 1)');
            centerGradient.addColorStop(1, 'rgba(100, 0, 150, 0.8)');
        }
        ctx.fillStyle = centerGradient;
        ctx.beginPath();
        ctx.arc(bh.x, bh.y, bh.centerRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Apply gravity to stars
        applyBlackHoleGravity(bh);
    }
}

function applyBlackHoleGravity(bh) {
    for (const star of stars) {
        const dx = bh.x - star.x;
        const dy = bh.y - star.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Check if in event horizon
        if (dist < bh.eventRadius) {
            // Check for consumption (center collision)
            if (dist < bh.centerRadius) {
                consumeStar(star, bh);
                continue;
            }
            
            // Apply gravity pull (inverse square, stronger near center)
            const pullStrength = (bh.eventRadius / dist) * 0.5;
            const normalizedDist = dist / bh.eventRadius; // 0-1, where 0 is center
            const gravityMultiplier = Math.pow(1 - normalizedDist, 2); // Quadratic falloff
            
            star.vx += (dx / dist) * pullStrength * gravityMultiplier * 0.05;
            star.vy += (dy / dist) * pullStrength * gravityMultiplier * 0.05;
            
            // Turn red as they get closer
            star.danger = 1 - normalizedDist; // 0-1, where 1 is most danger
        } else {
            star.danger = 0;
        }
    }
}

function consumeStar(star, bh) {
    // Determine star HP value
    let starHP = 1; // Default small star
    
    // Check if it's a twinkle star
    const isTwinkle = twinklingStars.some(ts => 
        Math.abs(ts.x - star.x) < 5 && Math.abs(ts.y - star.y) < 5
    );
    
    if (isTwinkle) {
        const twinkleStar = twinklingStars.find(ts => 
            Math.abs(ts.x - star.x) < 5 && Math.abs(ts.y - star.y) < 5
        );
        if (twinkleStar) {
            starHP = twinkleStar.isFast ? 5 : 2;
            // Remove from twinkle array
            const idx = twinklingStars.indexOf(twinkleStar);
            if (idx > -1) twinklingStars.splice(idx, 1);
        }
    }
    
    // Damage player
    playerHP = Math.max(0, playerHP - starHP);
    
    // Red black holes grow when consuming
    if (bh.isRed) {
        const growthAmount = starHP * 0.02; // 2% per HP
        bh.centerRadius *= (1 + growthAmount);
        bh.eventRadius *= (1 + growthAmount);
        bh.hp += starHP * 5; // Gain HP too
        bh.maxHP += starHP * 5;
        
        // Red pulse effect
        playRedBlackHoleConsume();
    } else {
        playBlackHoleConsume();
    }
    
    // Respawn star
    star.x = Math.random() * w;
    star.y = Math.random() * h;
    star.vx = (Math.random() - 0.5) * 0.3;
    star.vy = (Math.random() - 0.5) * 0.3;
    star.danger = 0;
    
    updateSaveStarsUI();
    
    // Check game over
    if (playerHP <= 0) {
        endSaveTheStarsMode();
    }
}

function playBlackHoleConsume() {
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
    
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    osc.start(now);
    osc.stop(now + 0.3);
}

function playRedBlackHoleConsume() {
    const now = audioContext.currentTime;
    
    // More aggressive sound
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.4);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 0.4);
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    
    osc.start(now);
    osc.stop(now + 0.4);
}

function endSaveTheStarsMode() {
    saveStarsActive = false;
    document.body.classList.remove('save-stars-active');
    
    clearInterval(saveStarsTimer);
    clearTimeout(blackHoleSpawnTimer);
    
    blackHoles = [];
    redBlackHoles = [];
    
    // Reset all stars
    for (const star of stars) {
        star.danger = 0;
    }
    
    showToast(`Game Over! You survived ${survivalTime} seconds!`);
}

function checkBlackHoleClick(x, y) {
    const clickRadius = 25; // Increased from 10 for easier clicking
    
    // Check red black holes first (priority)
    for (let i = redBlackHoles.length - 1; i >= 0; i--) {
        const bh = redBlackHoles[i];
        const dx = bh.x - x;
        const dy = bh.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < bh.centerRadius + clickRadius) {
            console.log('Red black hole clicked!', 'HP:', bh.hp, 'Radius:', bh.centerRadius);
            if (bh.hp > 20) {
                // Damage the black hole
                bh.hp -= 10;
                bh.centerRadius = Math.max(5, bh.centerRadius * 0.95); // Shrink but minimum 5px
                bh.eventRadius = Math.max(10, bh.eventRadius * 0.95); // Minimum 10px
                playBlackHoleHit();
            } else {
                // Destroy it
                redBlackHoles.splice(i, 1);
                playBlackHoleDestroy();
                createParticles(bh.x, bh.y, '255, 0, 100', 25); // Bright red/pink particles
            }
            return;
        }
    }
    
    // Check normal black holes
    for (let i = blackHoles.length - 1; i >= 0; i--) {
        const bh = blackHoles[i];
        const dx = bh.x - x;
        const dy = bh.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < bh.centerRadius + clickRadius) {
            console.log('Normal black hole clicked! Destroying...');
            blackHoles.splice(i, 1);
            playBlackHoleDestroy();
            createParticles(bh.x, bh.y, '180, 100, 255', 20); // Bright purple particles
            return;
        }
    }
    
    console.log('No black hole hit at', x, y, 'Normal holes:', blackHoles.length, 'Red holes:', redBlackHoles.length);
}

function playBlackHoleHit() {
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, now);
    
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    
    osc.start(now);
    osc.stop(now + 0.1);
}

function playBlackHoleDestroy() {
    const now = audioContext.currentTime;
    
    // Satisfying pop
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    
    osc.start(now);
    osc.stop(now + 0.2);
}

// Click outside mode select to close it
document.getElementById('modeSelectModal').addEventListener('click', (e) => {
    if (e.target.id === 'modeSelectModal') {
        document.getElementById('modeSelectModal').classList.remove('visible');
    }
});

// Click outside mode select to close it
document.getElementById('modeSelectModal').addEventListener('click', (e) => {
    if (e.target.id === 'modeSelectModal') {
        document.getElementById('modeSelectModal').classList.remove('visible');
    }
});

