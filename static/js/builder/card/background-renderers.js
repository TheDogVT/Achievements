(function () {
    const RENDERER_ATTR = 'data-puppy-background-renderer';
    const IMG_BASE = (window.PUPPY_IMG_BASE !== undefined ? window.PUPPY_IMG_BASE : '/static/resources/backgrounds/');

    function imgPath(filename) { return IMG_BASE + filename; }

    // Each renderer is a named layer recipe: JS builds the DOM stack, then CSS
    // owns the material treatment and animation.
    const RENDERERS = {
        cheer_crt: {
            className: 'pbg-cheer-crt',
            image: imgPath('cheer-synthwave-city-reference.jpg'),
            layers: ['image', 'sun-pulse', 'blooms', 'scanlines', 'sweep', 'vignette', 'glitch', 'lines'],
        },
        gifted_bloom: {
            className: 'pbg-gifted-bloom',
            image: imgPath('Sakura.jpg'),
            layers: ['image', 'scrim', 'sun', 'rays', 'bloom', 'petals', 'sparkle', 'vignette', 'lines'],
            particles: {
                layer: 'petals',
                effect: 'petals',
                knobs: { intensity: 1.0, size: 18, speed: 0.4, color1: '#ffd4e2', range: 320, origin_y: -150, wind: 1 },
            },
        },
        donation_wish: {
            className: 'pbg-donation-wish',
            image: imgPath('stars.jpg'),
            video: imgPath('stars.webm'),
            layers: ['video', 'scrim', 'glow', 'source', 'fog', 'vignette', 'lines'],
        },
        attendance_pillars: {
            className: 'pbg-attendance-pillars',
            image: imgPath('pillars.png'),
            video: imgPath('pillars.webm'),
            layers: ['video', 'lines'],
        },
        attendance_constellation: {
            className: 'pbg-attendance-pillars',
            image: imgPath('pillars.png'),
            video: imgPath('pillars.webm'),
            layers: ['video', 'lines'],
        },
        streak_wr124: {
            className: 'pbg-streak-wr124',
            image: imgPath('WR124.jpg'),
            layers: ['image', 'expansion', 'edge-stars', 'heat', 'core', 'embers', 'vignette', 'lines'],
            particles: [
                {
                    layer: 'embers',
                    effect: 'fire_radial',
                    knobs: {
                        particle_count: 56,
                        speed: 1.18,
                        glow: 0.64,
                        spread: 12,
                        size: 6,
                        range: 150,
                        point_expander: 200,
                        angle_spread: 38,
                        color1: '#ff9a34',
                        origin_x: 0,
                        origin_y: 0,
                        particle_rotation: 0,
                        canvas_rotation: 0,
                    },
                },
                {
                    layer: 'edge-stars',
                    effect: 'floating_stars',
                    knobs: {
                        particle_count: 18,
                        speed: 3.8,
                        intensity: 0.56,
                        range: 210,
                        color1: '#fff0ce',
                        origin_x: 0,
                        origin_y: 0,
                    },
                },
            ],
        },
    };

    function normalizeId(rendererId) {
        return String(rendererId || '').trim().toLowerCase().replace(/-/g, '_');
    }

    function particleDefs(def) {
        if (!def || !def.particles) {
            return [];
        }
        return Array.isArray(def.particles) ? def.particles : [def.particles];
    }

    function clear(target) {
        if (!target) {
            return;
        }
        const def = RENDERERS[normalizeId(target.getAttribute(RENDERER_ATTR))];
        if (window.PARTICLE_ENGINE) {
            particleDefs(def).forEach((particleDef) => {
                const host = target.querySelector(`.pbg-${particleDef.layer}`);
                if (host) {
                    window.PARTICLE_ENGINE.unmount(host);
                }
            });
        }
        target.querySelectorAll(':scope > .pbg-renderer').forEach((node) => node.remove());
        target.removeAttribute(RENDERER_ATTR);
        target.classList.remove('pbg-renderer-mounted');
    }

    function layer(name) {
        const el = document.createElement('span');
        el.className = `pbg-layer pbg-${name}`;
        el.setAttribute('aria-hidden', 'true');
        if (name === 'expansion') {
            const copy = document.createElement('span');
            copy.className = 'pbg-expansion-copy';
            copy.setAttribute('aria-hidden', 'true');
            el.appendChild(copy);
        }
        return el;
    }

    function mountLoopVideo(host, src) {
        if (!host || !src) {
            return null;
        }
        const video = document.createElement('video');
        video.className = 'pbg-video-el';
        video.muted = true;
        video.autoplay = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.setAttribute('aria-hidden', 'true');
        video.src = src;
        host.appendChild(video);
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {});
        }
        return video;
    }

    function mount(target, rendererId, options = {}) {
        if (!target) {
            return null;
        }
        clear(target);
        const id = normalizeId(rendererId);
        const def = RENDERERS[id];
        if (!def) {
            return null;
        }

        const renderer = document.createElement('span');
        renderer.className = `pbg-renderer ${def.className}`;
        renderer.setAttribute('aria-hidden', 'true');
        if (def.image || options.imageUrl) {
            renderer.style.setProperty('--pbg-image-url', `url("${options.imageUrl || def.image}")`);
        }

        def.layers.forEach((name) => renderer.appendChild(layer(name)));

        if (def.video) {
            mountLoopVideo(renderer.querySelector('.pbg-video'), options.videoUrl || def.video);
        }

        target.appendChild(renderer);
        target.setAttribute(RENDERER_ATTR, id);
        target.classList.add('pbg-renderer-mounted');

        if (window.PARTICLE_ENGINE) {
            particleDefs(def).forEach((particleDef) => {
                const host = renderer.querySelector(`.pbg-${particleDef.layer}`);
                if (host) {
                    window.PARTICLE_ENGINE.mount(host, particleDef.effect, particleDef.knobs || {});
                }
            });
        }
        return renderer;
    }

    function mountAll(root = document) {
        root.querySelectorAll('[data-background-renderer]').forEach((target) => {
            mount(target, target.getAttribute('data-background-renderer'), {
                imageUrl: target.getAttribute('data-background-image') || undefined,
            });
        });
    }

    window.PuppyCardBackgrounds = {
        clear,
        mount,
        mountAll,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => mountAll());
    } else {
        mountAll();
    }
}());
