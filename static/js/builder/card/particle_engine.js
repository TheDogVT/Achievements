// Custom canvas particle engine — zero external dependencies.
// Powers name-tag particle effects (fire, bubbles, snow, etc.).
//
// API:
//   PARTICLE_ENGINE.mount(specialLayerElement, effectId, rawKnobs)
//   PARTICLE_ENGINE.unmount(specialLayerElement)
//
// Rendering notes:
//   - All particles use createRadialGradient (soft blobs, no hard circle edges).
//   - fire_embers / firefly / spark_trail use globalCompositeOperation='lighter'
//     so overlapping particles additively brighten — dense cores bloom to white
//     while sparse edges stay dim. Same physics the CSS gooey-filter trick fakes.

(function () {
    'use strict';

    var MAX_INSTANCES = 8;
    var instances     = new WeakMap();
    var activeEls     = [];

    // Single symmetric overflow so W/2 and H/2 are always the element centre.
    // origin_x / origin_y knobs offset the spawn point from that centre in px.
    var OVERFLOW = { top: 200, bottom: 200, sides: 200 };

    // ── Utilities ─────────────────────────────────────────────────────────────

    function rand(a, b) { return a + Math.random() * (b - a); }
    function pick(arr)  { return arr[Math.floor(Math.random() * arr.length)]; }
    function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

    // Rotate a velocity vector [vx, vy] by rot radians (clockwise).
    function rotateVel(vx, vy, rot) {
        if (!rot) { return [vx, vy]; }
        var c = Math.cos(rot), s = Math.sin(rot);
        return [vx * c - vy * s, vx * s + vy * c];
    }

    // Spawn a point uniformly inside a circle of radius r centred on (cx, cy).
    function spawnCircle(cx, cy, r) {
        var a = rand(0, Math.PI * 2);
        var d = Math.sqrt(Math.random()) * r;
        return [cx + Math.cos(a) * d, cy + Math.sin(a) * d];
    }

    function spawnEmitterCircle(cx, cy, diameter) {
        return spawnCircle(cx, cy, Math.max(0, diameter || 0) / 2);
    }

    // Smooth opacity envelope: 0–20% of life = fade in, 60–100% = fade out.
    // life runs 1.0 (born) → 0.0 (dead).
    function lifeAlpha(life) {
        var age = 1 - life;
        if (age < 0.2) { return age * 5.0; }
        if (age > 0.6) { return (1 - age) * 2.5; }
        return 1;
    }

    // Format a float as a fixed-decimal string for rgba() color stops.
    function fa(v) { return v.toFixed(3); }

    // Parse common CSS color strings to [r, g, b]. Falls back to warm gold on bad input.
    function hexRgb(hex) {
        if (!hex) { return [255, 200, 100]; }
        var s = String(hex).trim();
        if (s[0] === '#') {
            if (s.length === 4) {
                var r = parseInt(s[1] + s[1], 16);
                var g = parseInt(s[2] + s[2], 16);
                var b = parseInt(s[3] + s[3], 16);
                if (isFinite(r) && isFinite(g) && isFinite(b)) { return [r, g, b]; }
            }
            if (s.length >= 7) {
                var n = parseInt(s.slice(1, 7), 16);
                if (isFinite(n)) { return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
            }
        }
        var m = s.match(/^rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/i);
        if (m) {
            return [
                clamp(Math.round(parseFloat(m[1])), 0, 255),
                clamp(Math.round(parseFloat(m[2])), 0, 255),
                clamp(Math.round(parseFloat(m[3])), 0, 255),
            ];
        }
        return [255, 200, 100];
    }

    // Build an rgba() string from an [r,g,b] array and an alpha float.
    function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + fa(a) + ')'; }

    // 4-pointed star path centered at canvas origin, outer radius r.
    function star4(ctx, r) {
        var ir = r * 0.3;
        ctx.beginPath();
        for (var i = 0; i < 8; i++) {
            var ang = i * Math.PI / 4;
            var ri  = (i % 2 === 0) ? r : ir;
            if (i === 0) { ctx.moveTo(ri * Math.sin(ang), -ri * Math.cos(ang)); }
            else         { ctx.lineTo(ri * Math.sin(ang), -ri * Math.cos(ang)); }
        }
        ctx.closePath();
    }

    function parseKnobs(raw) {
        if (!raw || typeof raw !== 'object') { return {}; }
        var out = {};
        Object.keys(raw).forEach(function (k) {
            var s = String(raw[k] == null ? '' : raw[k]).trim();
            var n = parseFloat(s);
            out[k] = isFinite(n) ? n : s;
        });
        return out;
    }

    // ── Effect Registry ───────────────────────────────────────────────────────
    // Shape: { maxParticles, preSpawn, spawnRate(k), spawn(W,H,k,ox,oy), update(p,dt,W,H), draw(ctx,p) }

    var EFFECTS = {};

    // ── fire_embers ───────────────────────────────────────────────────────────
    // Radial gradient blobs + additive blending.
    // Dense-core areas bloom to white/yellow; sparse edges stay orange/red.
    EFFECTS.fire_embers = {
        maxParticles: 50,
        preSpawn: 0,
        spawnRate: function (k) { return (k.intensity || 0.85) * 42; },
        spawn: function (W, H, k, ox, oy) {
            var sz  = k.size  || 12;
            var spd = k.speed || 1.9;
            var cx  = ox + (k.origin_x || 0);
            var cy  = oy + (k.origin_y || 0);
            var rot = ((k.particle_rotation || 0) * Math.PI) / 180;
            var rv  = rotateVel(rand(-0.55, 0.55), -rand(0.8, 1.4) * (sz * 2.5 / spd) / 60, rot);
            var sr  = k.range !== undefined ? k.range : 80;
            return {
                x:    cx + rand(-sr, sr),
                y:    cy,
                vx:   rv[0],
                vy:   rv[1],
                wob:   rand(0, Math.PI * 2), wobSpd: rand(1.5, 4.0),
                sz:    rand(sz * 0.7, sz * 1.5),
                glow:  clamp(k.glow !== undefined ? k.glow : 0.42, 0, 1),
                spread: Math.max(0, k.spread !== undefined ? k.spread : 18),
                life:  1, maxLife: rand(0.9, 2.0),
                color: k.color1 || '#ff6820',
            };
        },
        update: function (p, dt) {
            p.wob  += p.wobSpd * dt;
            p.x    += (p.vx + Math.sin(p.wob) * 0.4) * dt * 60;
            p.y    += p.vy * dt * 60;
            p.sz   *= Math.pow(0.96, dt * 60);
            p.life -= dt / p.maxLife;
        },
        draw: function (ctx, p) {
            var al = lifeAlpha(p.life);
            if (al <= 0 || p.sz < 0.3) { return; }
            var c  = hexRgb(p.color);
            var glow = p.glow !== undefined ? p.glow : 0.42;
            var ch = [Math.min(255, Math.round(c[0] + (255 - c[0]) * 0.8)),
                      Math.min(255, Math.round(c[1] + (255 - c[1]) * 0.8)),
                      Math.min(255, Math.round(c[2] + (255 - c[2]) * 0.8))];
            var cd = [Math.round(c[0] * 0.65), Math.round(c[1] * 0.12), 0];
            var r  = p.sz * (1.8 + glow * 1.8) + (p.spread || 0) * 0.18;
            var g  = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
            g.addColorStop(0,    rgba(ch, al * (0.55 + glow * 0.45)));
            g.addColorStop(0.25, rgba(c,  al * (0.38 + glow * 0.40)));
            g.addColorStop(0.55, rgba(cd, al * (0.16 + glow * 0.24)));
            g.addColorStop(1,    rgba(cd, 0));
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        },
    };

    EFFECTS.fire_radial = {
        maxParticles: 70,
        preSpawn: 0,
        spawnRate: function (k) { return (k.intensity || 0.85) * 48; },
        spawn: function (W, H, k, ox, oy) {
            var sz = k.size || 10;
            var spd = Math.max(0.2, k.speed || 1.5);
            var cx = ox + (k.origin_x || 0);
            var cy = oy + (k.origin_y || 0);
            var origin = spawnEmitterCircle(cx, cy, k.point_expander || 0);
            var odx = origin[0] - cx;
            var ody = origin[1] - cy;
            var hasSpawnVector = Math.sqrt(odx * odx + ody * ody) > 0.01;
            var base = hasSpawnVector ? Math.atan2(ody, odx) : rand(0, Math.PI * 2);
            base += ((k.particle_rotation || 0) * Math.PI) / 180;
            var spread = ((k.angle_spread !== undefined ? k.angle_spread : 45) * Math.PI) / 180;
            var angle = base + rand(-spread / 2, spread / 2);
            var force = rand(0.75, 1.35) * (sz * 2.7 / spd) / 60;
            var travel = k.range !== undefined ? k.range : 110;
            return {
                x: origin[0],
                y: origin[1],
                bx: cx,
                by: cy,
                vx: Math.cos(angle) * force,
                vy: Math.sin(angle) * force,
                wob: rand(0, Math.PI * 2),
                wobSpd: rand(1.0, 3.0),
                sz: rand(sz * 0.65, sz * 1.42),
                glow: clamp(k.glow !== undefined ? k.glow : 0.58, 0, 1),
                spread: Math.max(0, k.spread !== undefined ? k.spread : 16),
                travel: Math.max(20, travel),
                life: 1,
                maxLife: rand(0.72, 1.35),
                color: k.color1 || '#ff8a2a',
            };
        },
        update: function (p, dt) {
            p.wob += p.wobSpd * dt;
            p.x += (p.vx + Math.cos(p.wob) * 0.10) * dt * 60;
            p.y += (p.vy + Math.sin(p.wob) * 0.10) * dt * 60;
            p.sz *= Math.pow(0.965, dt * 60);
            var dx = p.x - p.bx;
            var dy = p.y - p.by;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > p.travel * 0.72) {
                p.life -= dt / Math.max(0.22, p.maxLife * 0.36);
            } else {
                p.life -= dt / p.maxLife;
            }
        },
        draw: function (ctx, p) {
            var dx = p.x - p.bx;
            var dy = p.y - p.by;
            var distFade = 1 - clamp((Math.sqrt(dx * dx + dy * dy) - p.travel * 0.52) / Math.max(1, p.travel * 0.48), 0, 1);
            var al = lifeAlpha(p.life) * distFade;
            if (al <= 0 || p.sz < 0.3) { return; }
            var c = hexRgb(p.color);
            var glow = p.glow !== undefined ? p.glow : 0.58;
            var ch = [Math.min(255, Math.round(c[0] + (255 - c[0]) * 0.9)),
                      Math.min(255, Math.round(c[1] + (255 - c[1]) * 0.72)),
                      Math.min(255, Math.round(c[2] + (255 - c[2]) * 0.28))];
            var cd = [Math.round(c[0] * 0.58), Math.round(c[1] * 0.10), 0];
            var r = p.sz * (1.8 + glow * 2.2) + (p.spread || 0) * 0.20;
            var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
            g.addColorStop(0, rgba(ch, al * (0.50 + glow * 0.46)));
            g.addColorStop(0.24, rgba(c, al * (0.34 + glow * 0.36)));
            g.addColorStop(0.58, rgba(cd, al * (0.12 + glow * 0.22)));
            g.addColorStop(1, rgba(cd, 0));
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        },
    };

    // ── bubble_drift ──────────────────────────────────────────────────────────
    // Hollow circle outline with a faint inner fill and a glint highlight.
    // Bubbles are translucent, not solid — radial fill used for the body, not a blob.
    EFFECTS.bubble_drift = {
        maxParticles: 40,
        preSpawn: 0,
        spawnRate: function (k) { return (k.intensity || 0.85) * 25; },
        spawn: function (W, H, k, ox, oy) {
            var sz  = k.size  || 9;
            var spd = k.speed || 3.2;
            var cx  = ox + (k.origin_x || 0);
            var cy  = oy + (k.origin_y || 0);
            var rot = ((k.particle_rotation || 0) * Math.PI) / 180;
            var rv  = rotateVel(rand(-0.7, 0.7) / 60, -rand(0.7, 1.3) * (sz * 1.8 / spd) / 60, rot);
            var sr  = k.range !== undefined ? k.range : 100;
            return {
                x:    cx + rand(-sr, sr),
                y:    cy,
                vx:   rv[0],
                vy:   rv[1],
                wob:  rand(0, Math.PI * 2), wobSpd: rand(1.5, 3.0),
                r:    rand(sz * 0.55, sz * 1.1),
                life: 1, maxLife: rand(1.2, 2.6),
                color: k.color1 || '#b7f1ff',
            };
        },
        update: function (p, dt) {
            p.wob  += p.wobSpd * dt;
            p.x    += (p.vx + Math.sin(p.wob) * 0.4 / 60) * dt * 60;
            p.y    += p.vy * dt * 60;
            p.life -= dt / p.maxLife;
        },
        draw: function (ctx, p) {
            var al = lifeAlpha(p.life) * 0.72;
            if (al <= 0) { return; }
            // faint translucent body
            var c  = hexRgb(p.color);
            var bg = ctx.createRadialGradient(p.x, p.y, p.r * 0.3, p.x, p.y, p.r);
            bg.addColorStop(0,   rgba(c, 0));
            bg.addColorStop(0.7, rgba(c, al * 0.10));
            bg.addColorStop(1,   rgba(c, al * 0.42));
            ctx.save();
            ctx.fillStyle = bg;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            // outline ring
            ctx.save();
            ctx.globalAlpha  = al;
            ctx.strokeStyle  = p.color;
            ctx.lineWidth    = 1.2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.stroke();
            // glint
            ctx.globalAlpha = al * 0.5;
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.beginPath();
            ctx.arc(p.x - p.r * 0.28, p.y - p.r * 0.28, p.r * 0.22, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        },
    };

    // ── snow_fall ─────────────────────────────────────────────────────────────
    // Soft white radial gradient blobs with gentle lateral drift.
    EFFECTS.snow_fall = {
        maxParticles: 70,
        preSpawn: 0,
        spawnRate: function (k) { return (k.intensity || 0.85) * 55; },
        spawn: function (W, H, k, ox, oy) {
            var sz  = k.size  || 5;
            var spd = k.speed || 4.2;
            var cx  = ox + (k.origin_x || 0);
            var cy  = oy + (k.origin_y || 0);
            var rot = ((k.particle_rotation || 0) * Math.PI) / 180;
            var rv  = rotateVel(rand(-0.45, 0.45) / 60, rand(0.7, 1.3) * (sz * 1.6 / spd) / 60, rot);
            var sr  = k.range !== undefined ? k.range : 150;
            return {
                x:    cx + rand(-sr, sr),
                y:    cy,
                vx:   rv[0],
                vy:   rv[1],
                wob:   rand(0, Math.PI * 2), wobSpd: rand(0.8, 2.0),
                r:     rand(sz * 0.4, sz * 0.9),
                life:  1, maxLife: rand(1.5, 3.0),
                maxA:  k.intensity || 0.85,
                color: k.color1 || '#ffffff',
            };
        },
        update: function (p, dt) {
            p.wob  += p.wobSpd * dt;
            p.x    += (p.vx + Math.sin(p.wob) * 0.25 / 60) * dt * 60;
            p.y    += p.vy * dt * 60;
            p.life -= dt / p.maxLife;
        },
        draw: function (ctx, p) {
            var al = lifeAlpha(p.life) * p.maxA;
            if (al <= 0) { return; }
            var c  = hexRgb(p.color);
            var r  = p.r * 2.0;
            var g  = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
            g.addColorStop(0,   rgba(c, al));
            g.addColorStop(0.5, rgba(c, al * 0.6));
            g.addColorStop(1,   rgba(c, 0));
            ctx.save();
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        },
    };

    // ── floating_stars ────────────────────────────────────────────────────────
    // Soft radial glow bloom behind a spinning star4 shape.
    EFFECTS.floating_stars = {
        maxParticles: 22,
        preSpawn: 12,
        spawnRate: function (k) { return 3 + (k.intensity || 0.85) * 4; },
        spawn: function (W, H, k, ox, oy) {
            var cx  = ox + (k.origin_x || 0);
            var cy  = oy + (k.origin_y || 0);
            var pt  = spawnCircle(cx, cy, k.range || 60);
            var cycle = Math.max(0.5, k.speed || 2.6);
            return {
                x:    pt[0], y: pt[1],
                vx:   rand(-0.3, 0.3) / 60,
                vy:   rand(-0.25, 0.25) / 60,
                r:    rand(1.5, 3.5),
                ang:  rand(0, Math.PI * 2), spin: rand(-0.9, 0.9),
                pulse: rand(0, Math.PI * 2),
                pulseSpd: (Math.PI * 2) / cycle,
                intensity: clamp(k.intensity || 0.85, 0, 1),
                life: 1, maxLife: rand(cycle * 1.25, cycle * 2.5),
                color: k.color1 || '#ffe8a8',
            };
        },
        update: function (p, dt, W, H) {
            p.x    += p.vx * dt * 60;
            p.y    += p.vy * dt * 60;
            p.ang  += p.spin * dt;
            p.pulse += p.pulseSpd * dt;
            p.life -= dt / p.maxLife;
            if (p.x < 0) { p.x = 0; p.vx =  Math.abs(p.vx); }
            if (p.x > W) { p.x = W; p.vx = -Math.abs(p.vx); }
            if (p.y < 0) { p.y = 0; p.vy =  Math.abs(p.vy); }
            if (p.y > H) { p.y = H; p.vy = -Math.abs(p.vy); }
        },
        draw: function (ctx, p) {
            var pulse = 0.62 + 0.38 * (0.5 + 0.5 * Math.sin(p.pulse));
            var al = lifeAlpha(p.life) * (p.intensity || 0.85) * pulse;
            if (al <= 0) { return; }
            // soft radial glow bloom
            var c  = hexRgb(p.color);
            var gr = p.r * 5;
            var g  = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gr);
            g.addColorStop(0, rgba(c, al * 0.45));
            g.addColorStop(1, rgba(c, 0));
            ctx.save();
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.x, p.y, gr, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            // crisp star shape on top
            ctx.save();
            ctx.globalAlpha = al;
            ctx.fillStyle   = p.color;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.ang);
            star4(ctx, p.r);
            ctx.fill();
            ctx.restore();
        },
    };

    // Particle: constellation
    // Prior-art check: MIT canvas constellation/starfield effects exist, but this
    // renderer is custom for PuppyBot's existing canvas engine (no copied code).
    EFFECTS.constellation = {
        maxParticles: 14,
        preSpawn: 14,
        spawnRate: function () { return 0; },
        spawn: function (W, H, k, ox, oy, idx) {
            var pattern = [
                [-0.78, -0.10], [-0.52, -0.42], [-0.22, -0.22], [0.02, -0.50],
                [0.30, -0.28], [0.58, -0.44], [0.78, -0.08], [0.42, 0.08],
                [0.14, 0.36], [-0.12, 0.12], [-0.42, 0.32], [-0.66, 0.10],
                [-0.02, -0.04], [0.56, 0.34],
            ];
            var n      = idx || 0;
            var slot   = pattern[n % pattern.length];
            var ring   = Math.floor(n / pattern.length);
            var turn   = ring * 0.47;
            var scale  = 1 + ring * 0.18;
            var px     = slot[0] * Math.cos(turn) - slot[1] * Math.sin(turn);
            var py     = slot[0] * Math.sin(turn) + slot[1] * Math.cos(turn);
            var spread = k.range !== undefined ? k.range : 90;
            var jx     = rand(-0.06, 0.06) * spread * (1 + ring * 0.05);
            var jy     = rand(-0.06, 0.06) * spread * (1 + ring * 0.05);
            var cx     = ox + (k.origin_x || 0);
            var cy     = oy + (k.origin_y || 0);
            var x      = cx + px * spread * scale + jx;
            var y      = cy + py * spread * 0.72 * scale + jy;
            return {
                x: x, y: y,
                bx: x, by: y,
                r: rand(0.82, 1.22) * (k.star_size || 3),
                ang: rand(0, Math.PI * 2),
                spin: rand(-0.22, 0.22),
                twPh: rand(0, Math.PI * 2),
                twBias: rand(0.82, 1.18),
                driftPh: rand(0, Math.PI * 2),
                driftSpd: rand(0.22, 0.48),
                linePulse: rand(0, Math.PI * 2),
                life: 1,
                maxLife: 999999,
                color: k.color1 || '#fff7d0',
            };
        },
        update: function (p, dt) {
            p.twPh += dt;
            p.driftPh += p.driftSpd * dt;
            p.ang += p.spin * dt;
            p.life = 1;
        },
        draw: function () {},
        drawAll: function (ctx, particles, W, H, k) {
            var maxStars = particles.length;
            var count = Math.min(maxStars, Math.max(3, Math.round(k.star_count || 7)));
            var stars = particles.slice(0, count);
            if (!stars.length) { return; }

            var starColor = hexRgb(k.color1 || '#fff7d0');
            var twColor   = hexRgb(k.color2 || '#ffffff');
            var lineColor = hexRgb(k.color3 || '#8fd7ff');
            var intensity = clamp(k.intensity || 0.9, 0, 1);
            var twinkle   = clamp(k.twinkle !== undefined ? k.twinkle : 0.78, 0, 1);
            var cycle     = Math.max(0.25, k.speed || 3.4);
            var lineA     = clamp(k.line_opacity !== undefined ? k.line_opacity : 0.55, 0, 1);
            var lineW     = Math.max(0.1, k.line_width || 1.1);
            var driftPx   = (k.drift !== undefined ? k.drift : 0.35) * 7;

            function twinkleValue(star, offset) {
                return 0.5 + 0.5 * Math.sin(((star.twPh * star.twBias + offset) / cycle) * Math.PI * 2);
            }

            for (var d = 0; d < stars.length; d++) {
                var s = stars[d];
                if (driftPx) {
                    s.x = s.bx + Math.cos(s.driftPh + d * 0.37) * driftPx;
                    s.y = s.by + Math.sin(s.driftPh * 1.3 + d * 0.23) * driftPx;
                }
            }

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            function connect(a, b, boost) {
                if (!stars[a] || !stars[b]) { return; }
                var s1 = stars[a];
                var s2 = stars[b];
                var midTw = (twinkleValue(s1, s1.linePulse) + twinkleValue(s2, s2.linePulse)) * 0.5;
                var al = lineA * intensity * (0.58 + 0.42 * midTw) * (boost || 1);
                var grad = ctx.createLinearGradient(s1.x, s1.y, s2.x, s2.y);
                grad.addColorStop(0, rgba(lineColor, al * 0.22));
                grad.addColorStop(0.5, rgba(twColor, al * 0.56));
                grad.addColorStop(1, rgba(lineColor, al * 0.22));
                ctx.globalAlpha = 1;
                ctx.strokeStyle = grad;
                ctx.lineWidth = lineW;
                ctx.beginPath();
                ctx.moveTo(s1.x, s1.y);
                ctx.lineTo(s2.x, s2.y);
                ctx.stroke();
            }

            for (var i = 0; i < stars.length - 1; i++) { connect(i, i + 1, 1); }
            connect(1, 9, 0.72);
            connect(3, 12, 0.62);
            connect(4, 8, 0.66);
            connect(7, 13, 0.66);

            for (var j = 0; j < stars.length; j++) {
                var p = stars[j];
                var tw = twinkleValue(p, 0);
                var al = intensity * ((1 - twinkle * 0.56) + twinkle * 0.56 * tw);
                var hot = [
                    Math.round(starColor[0] + (twColor[0] - starColor[0]) * tw),
                    Math.round(starColor[1] + (twColor[1] - starColor[1]) * tw),
                    Math.round(starColor[2] + (twColor[2] - starColor[2]) * tw),
                ];
                var glowR = p.r * (6.2 + tw * 3.4);
                var gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
                gr.addColorStop(0, rgba(hot, al * 0.50));
                gr.addColorStop(0.35, rgba(starColor, al * 0.20));
                gr.addColorStop(1, rgba(starColor, 0));
                ctx.fillStyle = gr;
                ctx.beginPath();
                ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
                ctx.fill();

                ctx.save();
                ctx.globalAlpha = clamp(al + tw * 0.18, 0, 1);
                ctx.fillStyle = rgba(hot, 1);
                ctx.translate(p.x, p.y);
                ctx.rotate(p.ang);
                star4(ctx, p.r * (1 + tw * 0.18));
                ctx.fill();
                ctx.restore();
            }

            ctx.restore();
        },
    };

    // ── firefly ───────────────────────────────────────────────────────────────
    // Large additive glow blob + bright center dot + blink pulse.
    EFFECTS.firefly = {
        maxParticles: 14,
        preSpawn: 8,
        spawnRate: function (k) { return 2.5; },
        spawn: function (W, H, k, ox, oy) {
            var cx  = ox + (k.origin_x || 0);
            var cy  = oy + (k.origin_y || 0);
            var pt  = spawnCircle(cx, cy, k.range || 60);
            return {
                x:    pt[0], y: pt[1],
                vx:   rand(-0.55, 0.55) / 60,
                vy:   rand(-0.45, 0.45) / 60,
                r:    rand(1.8, 3.2),
                glPh: rand(0, Math.PI * 2), glSpd: rand(1.5, 3.5),
                life: 1, maxLife: rand(3.5, 8.0),
                color: k.color1 || '#ffe48a',
            };
        },
        update: function (p, dt, W, H) {
            p.vx += rand(-0.012, 0.012);
            p.vy += rand(-0.012, 0.012);
            var mv = 0.7 / 60;
            if (p.vx >  mv) { p.vx =  mv; }
            if (p.vx < -mv) { p.vx = -mv; }
            if (p.vy >  mv) { p.vy =  mv; }
            if (p.vy < -mv) { p.vy = -mv; }
            p.x    += p.vx * dt * 60;
            p.y    += p.vy * dt * 60;
            p.glPh += p.glSpd * dt;
            p.life -= dt / p.maxLife;
            if (p.x < 0) { p.x = 0; p.vx =  Math.abs(p.vx); }
            if (p.x > W) { p.x = W; p.vx = -Math.abs(p.vx); }
            if (p.y < 0) { p.y = 0; p.vy =  Math.abs(p.vy); }
            if (p.y > H) { p.y = H; p.vy = -Math.abs(p.vy); }
        },
        draw: function (ctx, p) {
            var blink = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(p.glPh));
            var al    = lifeAlpha(p.life) * blink;
            if (al <= 0) { return; }
            // outer additive glow
            var c      = hexRgb(p.color);
            var cb     = [Math.min(255, c[0] + 40), Math.min(255, c[1] + 30), Math.min(255, c[2])];
            var outerR = p.r * 7;
            var g      = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, outerR);
            g.addColorStop(0,   rgba(cb, al * 0.55));
            g.addColorStop(0.3, rgba(c,  al * 0.28));
            g.addColorStop(1,   rgba(c,  0));
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.x, p.y, outerR, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            // bright center dot (source-over so it stays opaque)
            ctx.save();
            ctx.globalAlpha = al * 0.95;
            ctx.fillStyle   = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        },
    };

    // ── petals ────────────────────────────────────────────────────────────────
    // Rotating ellipses with a soft linear-gradient highlight.
    EFFECTS.petals = {
        maxParticles: 40,
        preSpawn: 0,
        spawnRate: function (k) { return (k.intensity || 0.85) * 20; },
        spawn: function (W, H, k, ox, oy) {
            var sz  = k.size  || 7;
            var spd = k.speed || 4.8;
            var cx  = ox + (k.origin_x || 0);
            var cy  = oy + (k.origin_y || 0);
            var rot = ((k.particle_rotation || 0) * Math.PI) / 180;
            var rv  = rotateVel(rand(0.2, 0.6) / 60, rand(0.7, 1.4) * (sz * 1.6 / spd) / 60, rot);
            var sr  = k.range !== undefined ? k.range : 150;
            return {
                x:    cx + rand(-sr, sr),
                y:    cy,
                vx:   rv[0],
                vy:   rv[1],
                wob:  rand(0, Math.PI * 2), wobSpd: rand(1.5, 3.5),
                rw:   rand(sz * 0.5, sz * 1.0),
                rh:   rand(sz * 0.28, sz * 0.55),
                ang:  rand(0, Math.PI * 2), spin: rand(-2.0, 2.0),
                life: 1, maxLife: rand(1.8, 3.5),
                color: k.color1 || '#ffc4d8',
                wind:  (k.wind ? +k.wind : 0),
            };
        },
        update: function (p, dt) {
            p.wob += p.wobSpd * dt;
            var windX = 0, lift = 0;
            if (p.wind) {
                // Global gusting wind (opt-in via the `wind` knob): long calm
                // spells where petals fall, punctuated by gusts that blow them
                // sideways + lift them, then ease off so they settle back down
                // before the next gust. Two frequencies => irregular, non-constant.
                var t = performance.now() / 1000;
                var g = Math.sin(t * 0.5) * 0.6 + Math.sin(t * 0.23 + 1.3) * 0.4;
                var gust = Math.pow(Math.max(0, g), 2.5) * p.wind;
                windX = gust * 75;  // px/s sideways at peak gust
                lift  = gust * 42;  // px/s upward at peak gust (nearly halts the fall)
                p.ang += gust * 0.04;
            }
            p.x    += (p.vx + Math.sin(p.wob) * 0.4 / 60 + windX / 60) * dt * 60;
            p.y    += (p.vy - lift / 60) * dt * 60;
            p.ang  += p.spin * dt;
            p.life -= dt / p.maxLife;
        },
        draw: function (ctx, p) {
            var al = lifeAlpha(p.life) * 0.88;
            if (al <= 0) { return; }
            ctx.save();
            ctx.globalAlpha = al;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.ang);
            // petal body
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, p.rw / 2, p.rh / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            // soft highlight across top face
            var hg = ctx.createLinearGradient(0, -p.rh / 2, 0, p.rh / 2);
            hg.addColorStop(0, 'rgba(255,255,255,0.32)');
            hg.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = hg;
            ctx.beginPath();
            ctx.ellipse(0, 0, p.rw / 2, p.rh / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        },
    };

    // ── dust_motes ────────────────────────────────────────────────────────────
    // Tiny, very slow soft gradient blobs. Almost invisible — ambient texture only.
    EFFECTS.dust_motes = {
        maxParticles: 40,
        preSpawn: 28,
        spawnRate: function (k) { return 14; },
        spawn: function (W, H, k, ox, oy) {
            var cx  = ox + (k.origin_x || 0);
            var cy  = oy + (k.origin_y || 0);
            var pt  = spawnCircle(cx, cy, k.range || 60);
            return {
                x:    pt[0], y: pt[1],
                vx:   rand(-0.12, 0.12) / 60,
                vy:   rand(-0.07, 0.10) / 60,
                r:     rand(0.7, 2.0),
                life:  1, maxLife: rand(5.0, 11.0),
                maxA:  (k.intensity || 0.45) * 0.55,
                color: k.color1 || '#fff2c4',
            };
        },
        update: function (p, dt, W, H) {
            p.x    += p.vx * dt * 60;
            p.y    += p.vy * dt * 60;
            p.life -= dt / p.maxLife;
            if (p.x < 0) { p.x = 0; p.vx = -p.vx; }
            if (p.x > W) { p.x = W; p.vx = -p.vx; }
            if (p.y < 0) { p.y = 0; p.vy = -p.vy; }
            if (p.y > H) { p.y = H; p.vy = -p.vy; }
        },
        draw: function (ctx, p) {
            var al = lifeAlpha(p.life) * p.maxA;
            if (al <= 0) { return; }
            var c  = hexRgb(p.color);
            var r  = p.r * 2.5;
            var g  = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
            g.addColorStop(0, rgba(c, al));
            g.addColorStop(1, rgba(c, 0));
            ctx.save();
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        },
    };

    // ── flakes ────────────────────────────────────────────────────────────────
    // Soft radial glow halo behind a rotating star4 shape.
    EFFECTS.flakes = {
        maxParticles: 45,
        preSpawn: 0,
        spawnRate: function (k) { return (k.intensity || 0.85) * 30; },
        spawn: function (W, H, k, ox, oy) {
            var sz  = k.size  || 5;
            var spd = k.speed || 3.8;
            var cx  = ox + (k.origin_x || 0);
            var cy  = oy + (k.origin_y || 0);
            var rot = ((k.particle_rotation || 0) * Math.PI) / 180;
            var rv  = rotateVel(rand(-0.4, 0.4) / 60, rand(0.7, 1.3) * (sz * 1.3 / spd) / 60, rot);
            var sr  = k.range !== undefined ? k.range : 120;
            return {
                x:    cx + rand(-sr, sr),
                y:    cy,
                vx:   rv[0],
                vy:   rv[1],
                r:    rand(sz * 0.35, sz * 0.7),
                ang:  rand(0, Math.PI * 2), spin: rand(-1.8, 1.8),
                life: 1, maxLife: rand(1.5, 3.2),
                color: pick([k.color1 || '#fff1a8', k.color2 || '#ffd86b', k.color3 || '#d4a526', k.color4 || '#b8810a']),
                maxA:  k.intensity || 0.85,
            };
        },
        update: function (p, dt) {
            p.x    += p.vx * dt * 60;
            p.y    += p.vy * dt * 60;
            p.ang  += p.spin * dt;
            p.life -= dt / p.maxLife;
        },
        draw: function (ctx, p) {
            var al = lifeAlpha(p.life) * p.maxA;
            if (al <= 0) { return; }
            // glow halo derived from particle color
            var c  = hexRgb(p.color);
            var ch = [Math.min(255, Math.round(c[0] + (255 - c[0]) * 0.7)),
                      Math.min(255, Math.round(c[1] + (255 - c[1]) * 0.7)),
                      Math.min(255, Math.round(c[2] + (255 - c[2]) * 0.7))];
            var gr = p.r * 3.5;
            var g  = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gr);
            g.addColorStop(0, rgba(ch, al * 0.5));
            g.addColorStop(1, rgba(c,  0));
            ctx.save();
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.x, p.y, gr, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            // spinning star4 shape
            ctx.save();
            ctx.globalAlpha = al;
            ctx.fillStyle   = p.color;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.ang);
            star4(ctx, p.r);
            ctx.fill();
            ctx.restore();
        },
    };

    // ── spark_trail ───────────────────────────────────────────────────────────
    // Short-lived additive radial gradient sparks. Color shifts white→yellow→orange
    // as each spark ages, simulating cooling embers flying off.
    EFFECTS.spark_trail = {
        maxParticles: 70,
        preSpawn: 0,
        spawnRate: function (k) { return (k.intensity || 0.8) * 80; },
        spawn: function (W, H, k, ox, oy) {
            var len = k.length || 16;
            var spd = k.speed  || 2.3;
            var cx  = ox + (k.origin_x || 0);
            var cy  = oy + (k.origin_y || 0);
            var rot = ((k.particle_rotation || 0) * Math.PI) / 180;
            var rv  = rotateVel(rand(0.5, 1.5) * (len / spd * 0.9) / 60, rand(-0.3, 0.3) / 60, rot);
            var sr  = k.range !== undefined ? k.range : 80;
            return {
                x:    cx,
                y:    cy + rand(-sr, sr),
                vx:   rv[0],
                vy:   rv[1],
                r:     rand(1.2, 3.0),
                life:  1, maxLife: rand(0.25, 0.65),
                maxA:  k.intensity || 0.8,
                color: k.color1 || '#ff9040',
            };
        },
        update: function (p, dt) {
            p.x    += p.vx * dt * 60;
            p.y    += p.vy * dt * 60;
            p.r    *= Math.pow(0.88, dt * 60);
            p.life -= dt / p.maxLife;
        },
        draw: function (ctx, p) {
            var al = p.life * p.maxA;
            if (al <= 0 || p.r < 0.1) { return; }
            // start white-hot, cool toward color1 as life drains
            var c  = hexRgb(p.color);
            var t  = 1 - p.life;
            var rr = Math.round(255 + (c[0] - 255) * Math.min(1, t * 1.2));
            var gg = Math.round(255 + (c[1] - 255) * Math.min(1, t * 1.4));
            var bb = Math.round(255 + (c[2] - 255) * Math.min(1, t * 1.6));
            var ct = [rr, gg, bb];
            var r  = p.r * 3.0;
            var g  = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
            g.addColorStop(0, rgba(ct, al * 0.92));
            g.addColorStop(1, rgba(ct, 0));
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        },
    };

    // ── Engine Core ───────────────────────────────────────────────────────────

    function currentDpr() {
        return Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    }

    function applyCanvasSize(state, w, h) {
        var dpr = currentDpr();
        var cssW = Math.round(w) || 120;
        var cssH = Math.round(h) || 60;
        var pxW = Math.max(1, Math.round(cssW * dpr));
        var pxH = Math.max(1, Math.round(cssH * dpr));

        state.cssW = cssW;
        state.cssH = cssH;
        state.dpr = dpr;

        if (state.canvas.width !== pxW || state.canvas.height !== pxH) {
            state.canvas.width = pxW;
            state.canvas.height = pxH;
        }
        if (typeof state.ctx.setTransform === 'function') {
            state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
    }

    function measureAndResize(state) {
        var r = state.container.getBoundingClientRect();
        applyCanvasSize(state, r.width, r.height);
    }

    function particleLimit(eff, knobs) {
        var requested = knobs && knobs.particle_count;
        if (requested === undefined || requested === '') { return eff.maxParticles; }
        var n = Math.round(Number(requested));
        if (!isFinite(n)) { return eff.maxParticles; }
        return Math.max(0, n);
    }

    function hasParticleCount(knobs) {
        return !!(knobs && knobs.particle_count !== undefined && knobs.particle_count !== '');
    }

    function particleCountScale(eff, knobs) {
        if (!hasParticleCount(knobs) || !eff.maxParticles) { return 1; }
        return particleLimit(eff, knobs) / eff.maxParticles;
    }

    function tick(state) {
        var now = performance.now();
        var dt  = Math.min((now - state.lastTs) / 1000, 0.1);
        state.lastTs = now;

        if (state.needsMeasure || state.dpr !== currentDpr()) {
            state.needsMeasure = false;
            measureAndResize(state);
        }

        var W   = state.cssW || 120;
        var H   = state.cssH || 60;
        var eff = state.effect;
        var ps  = state.particles;
        var maxParticles = particleLimit(eff, state.knobs);

        // Origin is always canvas centre — symmetric overflow guarantees this.
        var ox = Math.round(W / 2);
        var oy = Math.round(H / 2);

        while (ps.length > maxParticles) { ps.shift(); }

        // Spawn
        state.acc += eff.spawnRate(state.knobs) * particleCountScale(eff, state.knobs) * dt;
        while (state.acc >= 1 && ps.length < maxParticles) {
            ps.push(eff.spawn(W, H, state.knobs, ox, oy, ps.length));
            state.acc -= 1;
        }
        if (state.acc > maxParticles) { state.acc = 0; }

        // Update + cull
        for (var i = ps.length - 1; i >= 0; i--) {
            eff.update(ps[i], dt, W, H);
            if (ps[i].life <= 0) { ps.splice(i, 1); }
        }

        // Draw
        var ctx = state.ctx;
        ctx.clearRect(0, 0, W, H);
        if (typeof eff.drawAll === 'function') {
            eff.drawAll(ctx, ps, W, H, state.knobs);
        } else {
            for (var j = 0; j < ps.length; j++) { eff.draw(ctx, ps[j]); }
        }

        state.rafId = requestAnimationFrame(state.tickFn);
    }

    function evictOldest() {
        if (activeEls.length >= MAX_INSTANCES) { unmountEl(activeEls[0]); }
    }

    function unmountEl(el) {
        if (!el) { return; }
        var s = instances.get(el);
        if (s) {
            cancelAnimationFrame(s.rafId);
            if (s.resizeObserver) {
                try { s.resizeObserver.disconnect(); } catch (_) {}
            }
            if (s.resizeFallback && typeof window.removeEventListener === 'function') {
                try { window.removeEventListener('resize', s.resizeFallback); } catch (_) {}
            }
            try { if (s.container.parentNode) { s.container.remove(); } } catch (_) {}
            instances.delete(el);
        }
        var i = activeEls.indexOf(el);
        if (i !== -1) { activeEls.splice(i, 1); }
        el.classList.remove('has-particle-engine');
    }

    function mount(element, effectId, rawKnobs) {
        var eff = EFFECTS[effectId];
        if (!eff) { return; }

        unmountEl(element); // replace any existing engine on this element
        evictOldest();

        var knobs = parseKnobs(rawKnobs);
        var ov    = OVERFLOW;

        var container = document.createElement('div');
        var cRot = knobs.canvas_rotation || 0;
        var containerStyles = [
            'position:absolute',
            'top:-'    + ov.top    + 'px',
            'bottom:-' + ov.bottom + 'px',
            'left:-'   + ov.sides  + 'px',
            'right:-'  + ov.sides  + 'px',
            'pointer-events:none',
            'overflow:visible',
        ];
        if (cRot) { containerStyles.push('transform:rotate(' + cRot + 'deg)', 'transform-origin:50% 50%'); }
        var opac = knobs.opacity;
        if (opac !== undefined && opac !== 1) { containerStyles.push('opacity:' + opac); }
        container.style.cssText = containerStyles.join(';');
        element.appendChild(container);

        if (!document.contains(element)) {
            container.remove();
            return;
        }

        element.classList.add('has-particle-engine');

        var canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
        container.appendChild(canvas);

        var ctx = canvas.getContext('2d');

        var state = {
            canvas: canvas, ctx: ctx,
            effect: eff, knobs: knobs,
            particles: [], acc: 0,
            lastTs: performance.now(),
            rafId: null, tickFn: null,
            container: container,
            cssW: 120, cssH: 60, dpr: currentDpr(),
            needsMeasure: false,
            resizeObserver: null,
            resizeFallback: null,
        };
        measureAndResize(state);
        var W = state.cssW;
        var H = state.cssH;
        state.tickFn = function () { tick(state); };

        if (window.ResizeObserver) {
            state.resizeObserver = new ResizeObserver(function (entries) {
                var entry = entries && entries[0];
                if (!entry) { state.needsMeasure = true; return; }
                var r = entry.contentRect;
                applyCanvasSize(state, r.width, r.height);
            });
            state.resizeObserver.observe(container);
        } else if (typeof window.addEventListener === 'function') {
            state.resizeFallback = function () { state.needsMeasure = true; };
            window.addEventListener('resize', state.resizeFallback);
        }

        // Pre-seed ambient effects so the canvas is populated on the first frame.
        if (eff.preSpawn > 0) {
            var ox0 = Math.round(W / 2);
            var oy0 = Math.round(H / 2);
            var n = hasParticleCount(knobs) ? particleLimit(eff, knobs) : eff.preSpawn;
            for (var i = 0; i < n; i++) {
                var p = eff.spawn(W, H, knobs, ox0, oy0, i);
                p.life = rand(0.2, 0.9);
                state.particles.push(p);
            }
        }

        instances.set(element, state);
        activeEls.push(element);
        state.rafId = requestAnimationFrame(state.tickFn);
    }

    function unmount(element) { unmountEl(element); }

    window.PARTICLE_ENGINE = { mount: mount, unmount: unmount };
}());
