function sanitizeCssColor(value) {
    if (typeof value !== 'string') {
        return '';
    }
    const candidate = value.trim();
    if (!candidate) {
        return '';
    }
    if (/^[#a-zA-Z0-9(),.%\s-]+$/.test(candidate) && typeof CSS !== 'undefined' && CSS.supports && CSS.supports('color', candidate)) {
        return candidate;
    }
    return '';
}

function sanitizeLength(value) {
    if (typeof value !== 'string') {
        return '';
    }
    const candidate = value.trim();
    if (/^-?\d+(\.\d+)?(px|em|rem)$/.test(candidate)) {
        return candidate;
    }
    return '';
}

function sanitizeScale(value) {
    if (value === '' || value === null || value === undefined) {
        return '';
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return '';
    }
    return String(Math.min(4, Math.max(0.1, numeric)));
}

function sanitizeOpacity(value) {
    if (value === '' || value === null || value === undefined) {
        return '';
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return '';
    }
    // Primary mode: config stores 1-100, render as 0.01-1
    if (numeric >= 1 && numeric <= 100) {
        const normalized = Math.round((numeric / 100) * 10000) / 10000;
        return String(normalized);
    }
    // Backward compatibility: allow legacy 0-1 values
    if (numeric >= 0 && numeric <= 1) {
        return String(numeric);
    }
    return '';
}

function sanitizeLayerOpacity(value, fallback = '') {
    if (value === '' || value === null || value === undefined) {
        return fallback;
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    if (numeric >= 0 && numeric <= 1) {
        return String(numeric);
    }
    if (numeric >= 1 && numeric <= 100) {
        return String(Math.round((numeric / 100) * 10000) / 10000);
    }
    return fallback;
}

function sanitizeWeight(value) {
    if (typeof value !== 'string' && typeof value !== 'number') {
        return '';
    }
    const candidate = String(value).trim().toLowerCase();
    if (candidate === 'normal' || candidate === 'bold') {
        return candidate;
    }
    if (/^[1-9]00$/.test(candidate)) {
        return candidate;
    }
    return '';
}

function sanitizeFontStyle(value) {
    if (typeof value !== 'string') {
        return '';
    }
    const candidate = value.trim().toLowerCase();
    if (candidate === 'normal' || candidate === 'italic' || candidate === 'oblique') {
        return candidate;
    }
    return '';
}

function sanitizeFontFamily(value) {
    if (typeof value !== 'string') {
        return '';
    }
    const candidate = value.trim();
    if (!candidate) {
        return '';
    }
    if (/^[a-zA-Z0-9\s,\-"']+$/.test(candidate)) {
        // Bare multi-word names (no commas or quotes) must be quoted for CSS.
        if (candidate.includes(' ') && !candidate.includes(',') && !candidate.includes("'") && !candidate.includes('"')) {
            return `'${candidate}'`;
        }
        return candidate;
    }
    return '';
}

function sanitizeGradient(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const stops = [];
    value.forEach((raw) => {
        const colorRaw = (raw && typeof raw === 'object') ? (raw.color || '') : (raw || '');
        const color = sanitizeCssColor(colorRaw);
        if (!color) { return; }
        const posRaw = (raw && typeof raw === 'object') ? raw.pos : null;
        const pos = (posRaw !== null && posRaw !== undefined && posRaw !== '')
            ? Math.min(100, Math.max(0, Number(posRaw)))
            : null;
        stops.push(Number.isFinite(pos) ? `${color} ${pos}%` : color);
    });
    return stops;
}

function sanitizeGradientDirection(value) {
    const candidate = String(value || '').trim();
    if (!candidate) {
        return 'to right';
    }
    if (typeof CSS !== 'undefined' && CSS.supports && CSS.supports('background-image', `linear-gradient(${candidate}, #000, #fff)`)) {
        return candidate;
    }
    return 'to right';
}

function sanitizeGradientDepth(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return '100% 100%';
    }
    const clamped = Math.min(400, Math.max(10, numeric));
    return `${clamped}% 100%`;
}

function sanitizeOutlineThickness(value) {
    if (value === '' || value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value).trim())) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return '';
        }
        const clamped = Math.min(12, Math.max(0, numeric));
        return `${clamped}px`;
    }
    const text = String(value).trim();
    if (/^\d+(\.\d+)?(px|em|rem)$/.test(text)) {
        return text;
    }
    return '';
}

function sanitizeBlurRadius(value) {
    if (value === '' || value === null || value === undefined) {
        return '';
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return '';
    }
    const clamped = Math.min(16, Math.max(0, numeric));
    return `${fixed(clamped)}px`;
}

function sanitizeOutlinePosition(value) {
    const token = String(value || '').trim().toLowerCase();
    if (token === 'outer_fake') {
        return 'outer_fake';
    }
    return 'center';
}

function sanitizeOutlineOuterMode(value) {
    const token = String(value || '').trim().toLowerCase();
    if (token === 'cast') {
        return 'cast';
    }
    return 'equal';
}

function sanitizeOutlineAngle(value) {
    if (value === '' || value === null || value === undefined) {
        return 270;
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return 270;
    }
    const normalized = ((numeric % 360) + 360) % 360;
    return normalized;
}

function sanitizeOutlineCastDistance(value) {
    const numeric = sanitizeNumberInRange(value, 0, 24);
    return numeric === null ? 0 : numeric;
}

function sanitizeIntensity(value) {
    if (value === '' || value === null || value === undefined) {
        return null;
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return null;
    }
    const clamped = Math.min(5, Math.max(1, Math.round(numeric)));
    return clamped === 1 ? null : String(clamped);
}

function sanitizeZDepth(value, fallback = 5) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    return Math.min(10, Math.max(1, Math.round(numeric)));
}

function sanitizeBlendMode(value) {
    const token = normalizeToken(value);
    const allowed = new Set(['normal', 'screen', 'plus-lighter', 'overlay', 'soft-light', 'color-dodge']);
    return allowed.has(token) ? token : '';
}

function sanitizeTimeSeconds(value, min = -60, max = 60) {
    if (value === '' || value === null || value === undefined) {
        return '';
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return '';
    }
    return `${fixed(Math.min(max, Math.max(min, numeric)))}s`;
}

function outlineLightZIndexFromDepth(depth) {
    const normalized = sanitizeZDepth(depth, 6);
    const map = {
        1: 10,
        2: 20,
        3: 30,
        4: 40,
        5: 45,
        6: 50,
        7: 65,
        8: 80,
        9: 90,
        10: 100,
    };
    return map[normalized] || 50;
}

function sanitizeNumberInRange(value, min, max) {
    if (value === '' || value === null || value === undefined) {
        return null;
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return null;
    }
    return Math.min(max, Math.max(min, numeric));
}

function sanitizeGlowDistance(value) {
    return sanitizeNumberInRange(value, 0, 40);
}

function sanitizeGlowSpread(value) {
    return sanitizeNumberInRange(value, 0, 200);
}

function sanitizeGlowFade(value) {
    return sanitizeNumberInRange(value, 0, 100);
}

function sanitizeKnobValue(value, spec) {
    if (!spec || !spec.type) {
        return null;
    }
    if (spec.type === 'number') {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return null;
        }
        const min = typeof spec.min === 'number' ? spec.min : -Infinity;
        const clamped = Math.max(min, numeric);
        return spec.unit ? `${fixed(clamped)}${spec.unit}` : fixed(clamped);
    }
    if (spec.type === 'color') {
        return sanitizeCssColor(value);
    }
    return null;
}

function fixed(value) {
    return String(Math.round(value * 100) / 100);
}

function byToken(map, token) {
    if (!token || typeof token !== 'string') {
        return '';
    }
    return map[token] || '';
}

function normalizeToken(value) {
    return String(value || '').trim().toLowerCase();
}

const STYLE_CLASS_MAP = {
    flat: 'tag-style-flat',
    etched: 'tag-style-etched',
    foil: 'tag-style-foil',
    neon: 'tag-style-neon',
    inked: 'tag-style-inked'
};

const TEXT_ANIMATION_CLASS_MAP = {
    none: '',
    breathe: 'tag-textanim-breathe',
    drift: 'tag-textanim-drift',
    flicker: 'tag-textanim-flicker',
    kinetic: 'tag-textanim-kinetic',
    bounce: 'tag-textanim-bounce',
    shake: 'tag-textanim-shake',
    glitch: 'tag-textanim-glitch',
    pop: 'tag-textanim-pop',
    // Legacy aliases for existing configs.
    pulse_soft: 'tag-textanim-breathe',
    flicker_soft: 'tag-textanim-flicker',
    wave_slow: 'tag-textanim-drift',
    shimmer_slow: 'tag-textanim-kinetic'
};

const GRADIENT_ANIMATION_CLASS_MAP = {
    none: '',
    sheen: 'tag-gradanim-sheen',
    aurora: 'tag-gradanim-aurora',
    prism: 'tag-gradanim-prism',
    tide: 'tag-gradanim-tide',
    hue: 'tag-gradanim-hue',
    burn: 'tag-gradanim-burn',
    // Legacy alias.
    shimmer_slow: 'tag-gradanim-sheen'
};

const OUTLINE_CLASS_MAP = {
    none: '',
    basic: 'tag-outline-basic',
    ink_soft: 'tag-outline-ink-soft',
    ink_strong: 'tag-outline-ink-strong',
    light_edge: 'tag-outline-light-edge',
    neon_edge: 'tag-outline-neon-edge'
};

const EDGE_ANIMATION_CLASS_MAP = {
    none: '',
    pulse: 'tag-edgeanim-pulse',
    flicker: 'tag-edgeanim-flicker',
    shimmer: 'tag-edgeanim-shimmer',
    ripple: 'tag-edgeanim-ripple'
};

const BACK_GLOW_CLASS_MAP = {
    none: '',
    soft_halo: 'tag-backglow-soft-halo',
    cool_halo: 'tag-backglow-cool-halo',
    edge_bloom: 'tag-backglow-edge-bloom',
    neon_aura: 'tag-backglow-neon-aura',
    warm_soft: 'tag-backglow-soft-halo',
    cool_soft: 'tag-backglow-cool-halo',
    gold_aura: 'tag-backglow-edge-bloom'
};

const FRONT_GLOW_CLASS_MAP = {
    none: '',
    mist: 'tag-frontglow-mist',
    shimmer: 'tag-frontglow-shimmer',
    prism: 'tag-frontglow-prism'
};

const GLOW_ANIMATION_CLASS_MAP = {
    none: '',
    pulse: 'tag-glowanim-pulse',
    flicker: 'tag-glowanim-flicker',
    breathe: 'tag-glowanim-breathe',
    orbit: 'tag-glowanim-orbit',
    surge: 'tag-glowanim-surge',
    chain: 'tag-glowanim-chain',
    // Legacy aliases.
    pulse_soft: 'tag-glowanim-pulse',
    flicker_soft: 'tag-glowanim-flicker',
    breathing: 'tag-glowanim-breathe'
};

const SPECIAL_EFFECT_CLASS_MAP = {
    none: '',
    // Particle
    floating_stars:  'tag-fx-floating-stars',
    spark_trail:     'tag-fx-spark-trail',
    fire_embers:     'tag-fx-fire-embers',
    bubble_drift:    'tag-fx-bubble-drift',
    snow_fall:       'tag-fx-snow-fall',
    firefly:         'tag-fx-firefly',
    petals:          'tag-fx-petals',
    dust_motes:      'tag-fx-dust-motes',
    flakes:          'tag-fx-flakes',
    // Overlay / filter
    synth_scanlines: 'tag-fx-synth-scanlines',
    glitch_bars:     'tag-fx-glitch-bars',
    holo_shimmer:    'tag-fx-holo-shimmer',
    magic_circle:    'tag-fx-magic-circle',
    heat_haze:       'tag-fx-heat-haze',
    chroma_echo:     'tag-fx-chroma-echo',
    // Intermittent
    lightning:       'tag-fx-lightning'
};

function styleFromTag(tag) {
    const wrapperClasses = [];
    const motionClasses = [];
    const fillClasses = [];
    const styles = {};
    const outlineThickness = sanitizeOutlineThickness(tag.outline_thickness);
    const outlineLightThickness = sanitizeOutlineThickness(tag.outline_light_thickness);
    const outlineLightBlur = sanitizeBlurRadius(tag.outline_light_blur);
    const outlineLightZDepth = sanitizeZDepth(tag.outline_light_z_index, 6);
    const outlinePosition = sanitizeOutlinePosition(tag.outline_position || 'center');
    const outlineOuterMode = sanitizeOutlineOuterMode(tag.outline_outer_mode);
    const outlineCastAngle = sanitizeOutlineAngle(tag.outline_cast_angle);
    const outlineCastDistance = sanitizeOutlineCastDistance(tag.outline_cast_distance);

    const styleClass = byToken(STYLE_CLASS_MAP, tag.style || '');
    if (styleClass) {
        fillClasses.push(styleClass);
    }

    const textAnimationClass = byToken(TEXT_ANIMATION_CLASS_MAP, normalizeToken(tag.animation));
    if (textAnimationClass) {
        motionClasses.push(textAnimationClass);
    }
    if (normalizeToken(tag.animation) === 'glitch') {
        const dur = 44 + Math.random() * 6;
        styles['--tag-glitch-duration'] = `${dur.toFixed(2)}s`;
        styles['--tag-glitch-delay'] = `-${(Math.random() * dur).toFixed(2)}s`;
    }

    const outlineToken = String(tag.outline || '').trim().toLowerCase();
    const outlineClass = byToken(OUTLINE_CLASS_MAP, outlineToken);
    const edgeAnimationClass = byToken(EDGE_ANIMATION_CLASS_MAP, normalizeToken(tag.edge_animation));

    const textColor = sanitizeCssColor(tag.text_color);
    const glowColor = sanitizeCssColor(tag.glow_color) || textColor;
    const glowLayers = collectGlowLayers(tag, glowColor, tag.glow_animation);
    const effectLayers = collectEffectLayers(tag, String(tag.text || ''));
    const outlineColor = sanitizeCssColor(tag.outline_color);
    const outlineLightColor = sanitizeCssColor(tag.outline_light_color) || outlineColor || glowColor || textColor;
    const outlineLightOpacity = sanitizeLayerOpacity(tag.outline_light_opacity, '1');
    if (textColor) {
        styles['--tag-text-color'] = textColor;
        styles.color = textColor;
    }

    const gradient = sanitizeGradient(tag.text_gradient);
    if (gradient.length >= 2) {
        const direction = sanitizeGradientDirection(tag.text_gradient_direction);
        const depth = sanitizeGradientDepth(tag.text_gradient_depth);
        wrapperClasses.push('tag-uses-gradient');
        fillClasses.push('tag-has-gradient');
        const gradientAnimationClass = byToken(GRADIENT_ANIMATION_CLASS_MAP, normalizeToken(tag.gradient_animation));
        if (gradientAnimationClass) {
            fillClasses.push(gradientAnimationClass);
        }
        styles['--tag-gradient'] = `linear-gradient(${direction}, ${gradient.join(', ')})`;
        styles['--tag-gradient-size'] = depth;
    }

    if (textColor) {
        styles['--tag-outline-color'] = textColor;
        styles['--tag-glow-color'] = textColor;
    }
    if (outlineColor) {
        styles['--tag-outline-color'] = outlineColor;
    }
    if (glowColor) {
        styles['--tag-glow-color'] = glowColor;
    }

    const letterSpacing = sanitizeLength(tag.letter_spacing);
    if (letterSpacing) {
        styles['letter-spacing'] = letterSpacing;
    }

    if (outlineClass) {
        styles['--tag-outline-thickness'] = outlineThickness || '0px';
    } else if (outlineThickness) {
        styles['--tag-outline-thickness'] = outlineThickness;
    }
    if (outlineLightThickness) {
        styles['--tag-outline-light-thickness'] = outlineLightThickness;
    }
    if (outlineLightBlur) {
        styles['--tag-outline-light-blur'] = outlineLightBlur;
    }
    if (outlineLightColor) {
        styles['--tag-outline-light-color'] = outlineLightColor;
    }
    if (outlineLightOpacity) {
        styles['--tag-outline-light-opacity'] = outlineLightOpacity;
    }
    styles['--tag-outline-light-z-index'] = String(outlineLightZIndexFromDepth(outlineLightZDepth));

    let outlineOffsetX = '0px';
    let outlineOffsetY = '0px';
    const outlineCastActive = outlinePosition === 'outer_fake' && outlineOuterMode === 'cast' && outlineCastDistance > 0;
    if (outlineCastActive) {
        const radians = outlineCastAngle * (Math.PI / 180);
        outlineOffsetX = `${fixed(Math.cos(radians) * outlineCastDistance)}px`;
        outlineOffsetY = `${fixed(Math.sin(radians) * outlineCastDistance)}px`;
    }
    styles['--tag-outline-offset-x'] = outlineOffsetX;
    styles['--tag-outline-offset-y'] = outlineOffsetY;

    const fontWeight = sanitizeWeight(tag.font_weight);
    if (fontWeight) {
        styles['font-weight'] = fontWeight;
    }

    const fontStyle = sanitizeFontStyle(tag.font_style);
    if (fontStyle) {
        styles['font-style'] = fontStyle;
    }

    const fontFamily = sanitizeFontFamily(tag.font_family);
    if (fontFamily) {
        styles['font-family'] = fontFamily;
    }

    const fontSize = sanitizeLength(tag.font_size);
    if (fontSize) {
        styles['font-size'] = fontSize;
    }

    const offsetX = sanitizeLength(tag.offset_x);
    const offsetY = sanitizeLength(tag.offset_y);
    if (offsetX || offsetY) {
        styles['position'] = 'relative';
        if (offsetX) styles['left'] = offsetX;
        if (offsetY) styles['top'] = offsetY;
    }

    const opacity = sanitizeOpacity(tag.opacity);
    if (opacity) {
        styles.opacity = opacity;
    }

    const intensity = sanitizeIntensity(tag.intensity);
    if (intensity !== null) {
        styles['--tag-anim-intensity'] = intensity;
    }

    const outlineLightActive = !!(outlineLightThickness && outlineLightColor);

    return {
        wrapperClasses,
        motionClasses,
        fillClasses,
        styles,
        outlineClass,
        outlinePosition,
        outlineCastActive,
        glowLayers,
        effectLayers,
        edgeAnimationClass,
        outlineLightActive,
        outlineLightZDepth,
    };
}

function applyTagPresentation(element, tag, baseClass) {
    element.querySelectorAll('.tag-special-layer, .tag-effect-layer').forEach((layer) => {
        if (window.PARTICLE_ENGINE) { window.PARTICLE_ENGINE.unmount(layer); }
    });
    element.className = baseClass;
    element.removeAttribute('style');
    element.removeAttribute('data-tag-text');
    element.replaceChildren();
    const overlayText = tag ? String(tag.text || '') : '';

    if (!tag || !tag.text) {
        return;
    }

    element.setAttribute('data-tag-text', overlayText);

    const presentation = styleFromTag(tag);
    if (presentation.wrapperClasses.length > 0) {
        element.classList.add(...presentation.wrapperClasses);
    }

    Object.entries(presentation.styles).forEach(([prop, value]) => {
        if (!value) {
            return;
        }
        element.style.setProperty(prop, value);
    });

    const motionLayer = document.createElement('span');
    motionLayer.className = 'tag-motion-layer';
    if (presentation.motionClasses.length > 0) {
        motionLayer.classList.add(...presentation.motionClasses);
    }

    const fillLayer = document.createElement('span');
    fillLayer.className = 'tag-fill-layer';
    if (presentation.fillClasses.length > 0) {
        fillLayer.classList.add(...presentation.fillClasses);
    }
    fillLayer.textContent = overlayText;

    if (Array.isArray(presentation.glowLayers) && presentation.glowLayers.length > 0) {
        presentation.glowLayers.forEach((layer) => {
            const glowLayer = document.createElement('span');
            glowLayer.className = `tag-glow-layer is-${layer.plane}`;
            if (layer.animationClass) {
                glowLayer.classList.add(layer.animationClass);
            }
            glowLayer.textContent = overlayText;
            glowLayer.setAttribute('aria-hidden', 'true');
            glowLayer.style.setProperty('--tag-glow-color', layer.color);
            glowLayer.style.setProperty('--tag-glow-near-radius', layer.metrics.nearRadius);
            glowLayer.style.setProperty('--tag-glow-far-radius', layer.metrics.farRadius);
            glowLayer.style.setProperty('--tag-frontglow-blur', layer.metrics.frontBlur);
            glowLayer.style.setProperty('--tag-glow-near-transparent', layer.metrics.nearTransparent);
            glowLayer.style.setProperty('--tag-glow-far-transparent', layer.metrics.farTransparent);
            glowLayer.style.setProperty('--tag-glow-near-transparent-boost', layer.metrics.nearBoostTransparent);
            glowLayer.style.setProperty('--tag-glow-far-transparent-boost', layer.metrics.farBoostTransparent);
            glowLayer.style.setProperty('--tag-glow-near-transparent-dim', layer.metrics.nearDimTransparent);
            glowLayer.style.setProperty('--tag-glow-far-transparent-dim', layer.metrics.farDimTransparent);
            glowLayer.style.setProperty('--tag-frontglow-opacity', layer.metrics.frontOpacity);
            if (layer.plane === 'back') {
                motionLayer.insertBefore(glowLayer, motionLayer.firstChild);
            } else {
                motionLayer.appendChild(glowLayer);
            }
        });
    }

    if (presentation.outlineClass) {
        if (presentation.outlinePosition === 'outer_fake') {
            element.classList.add('tag-outline-outer-fake');
        }
        const outlineLayer = document.createElement('span');
        outlineLayer.className = `tag-outline-layer ${presentation.outlineClass}`;
        if (presentation.edgeAnimationClass) {
            outlineLayer.classList.add(presentation.edgeAnimationClass);
        }
        if (presentation.outlineCastActive) {
            outlineLayer.classList.add('tag-outline-cast');
        }
        outlineLayer.textContent = overlayText;
        outlineLayer.setAttribute('aria-hidden', 'true');
        motionLayer.insertBefore(outlineLayer, motionLayer.firstChild);
    }

    let outlineLightLayer = null;
    if (presentation.outlineLightActive) {
        outlineLightLayer = document.createElement('span');
        outlineLightLayer.className = 'tag-outline-light-layer';
        if (presentation.outlinePosition === 'outer_fake') {
            outlineLightLayer.classList.add('tag-outline-light-outer-fake');
        }
        if (presentation.outlineCastActive) {
            outlineLightLayer.classList.add('tag-outline-cast');
        }
        outlineLightLayer.textContent = overlayText;
        outlineLightLayer.setAttribute('aria-hidden', 'true');
        if (presentation.outlinePosition === 'outer_fake') {
            motionLayer.appendChild(outlineLightLayer);
        }
    }

    motionLayer.appendChild(fillLayer);
    if (outlineLightLayer && presentation.outlinePosition !== 'outer_fake') {
        motionLayer.appendChild(outlineLightLayer);
    }
    element.appendChild(motionLayer);

    if (Array.isArray(presentation.effectLayers) && presentation.effectLayers.length > 0) {
        presentation.effectLayers.forEach((layer) => {
            const effectLayer = document.createElement('span');
            effectLayer.className = `tag-effect-layer tag-effect-plane-${layer.plane} tag-effect-engine-${layer.engine} ${layer.effectClass}`;
            effectLayer.setAttribute('aria-hidden', 'true');
            effectLayer.style.zIndex = String(layer.zDepth * 10);
            if (layer.opacity) {
                effectLayer.style.opacity = layer.opacity;
            }
            if (layer.blendMode) {
                effectLayer.style.mixBlendMode = layer.blendMode;
            }
            if (layer.duration) {
                effectLayer.style.setProperty('--fx-duration', layer.duration);
            }
            if (layer.delay) {
                effectLayer.style.setProperty('--fx-delay', layer.delay);
            }
            if (layer.phase) {
                effectLayer.style.setProperty('--fx-phase', layer.phase);
            }
            if (layer.interval) {
                effectLayer.style.setProperty('--fx-interval', layer.interval);
            }
            if (layer.randomRange) {
                effectLayer.style.setProperty('--fx-random-range', layer.randomRange);
            }
            if (layer.offsetX) {
                effectLayer.style.setProperty('--fx-offset-x', layer.offsetX);
            }
            if (layer.offsetY) {
                effectLayer.style.setProperty('--fx-offset-y', layer.offsetY);
            }
            if (layer.scale) {
                effectLayer.style.setProperty('--fx-scale', layer.scale);
            }
            effectLayer.style.setProperty('--fx-seed-a', fixed(Math.random()));
            effectLayer.style.setProperty('--fx-seed-b', fixed(Math.random()));
            effectLayer.style.setProperty('--fx-seed-c', fixed(Math.random()));
            effectLayer.style.setProperty('--fx-seed-d', fixed(Math.random()));
            if (layer.engine === 'text' || layer.plane === 'text') {
                effectLayer.textContent = layer.text;
            }

            if (layer.manifest && layer.knobs) {
                Object.entries(layer.manifest).forEach(([knobName, spec]) => {
                    if (!spec || !spec.type) {
                        return;
                    }
                    const raw = layer.knobs[knobName];
                    if (raw === undefined || raw === null || raw === '') {
                        return;
                    }
                    const sanitized = sanitizeKnobValue(raw, spec);
                    if (sanitized === null || sanitized === '') {
                        return;
                    }
                    const cssVarName = `--fx-${knobName.replace(/_/g, '-')}`;
                    effectLayer.style.setProperty(cssVarName, sanitized);
                });
            }

            motionLayer.appendChild(effectLayer);

            if (layer.manifest && layer.manifest.renderer === 'particle' && window.PARTICLE_ENGINE) {
                window.PARTICLE_ENGINE.mount(effectLayer, layer.effectId, layer.knobs || {});
            }
        });
    }
}

window.DECORATION_NAME_TRANSLATOR = {
    applyTagPresentation
};
