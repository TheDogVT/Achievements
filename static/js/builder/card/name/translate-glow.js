function glowMetrics(distanceValue, spreadValue, fadeValue) {
    const glowDistance = sanitizeGlowDistance(distanceValue);
    const glowSpread = sanitizeGlowSpread(spreadValue);
    const glowFade = sanitizeGlowFade(fadeValue);

    const baseDistance = glowDistance !== null ? glowDistance : 8;
    const spreadPercent = glowSpread !== null ? glowSpread : 100;
    const nearScale = 0.7 + (spreadPercent * 0.003);
    const farScale = 1.0 + (spreadPercent * 0.011);
    const blurScale = 0.1 + (spreadPercent * 0.0008);
    const nearRadius = Math.max(0.8, baseDistance * nearScale);
    const farRadius = Math.max(1.6, baseDistance * farScale);
    const frontBlur = Math.max(0.35, baseDistance * blurScale);

    let nearTransparent = 44;
    let farTransparent = 64;
    let nearBoostTransparent = 30;
    let farBoostTransparent = 50;
    let nearDimTransparent = 68;
    let farDimTransparent = 84;
    let frontOpacity = 0.55;

    if (glowFade !== null) {
        nearTransparent = Math.min(92, Math.max(12, 15 + (glowFade * 0.55)));
        farTransparent = Math.min(98, Math.max(28, nearTransparent + 18));
        nearBoostTransparent = Math.max(0, nearTransparent - 14);
        farBoostTransparent = Math.max(8, farTransparent - 14);
        nearDimTransparent = Math.min(98, nearTransparent + 24);
        farDimTransparent = Math.min(99, farTransparent + 20);
        frontOpacity = Math.max(0.14, Math.min(0.86, ((100 - glowFade) / 100) + 0.08));
    }

    return {
        nearRadius: `${fixed(nearRadius)}px`,
        farRadius: `${fixed(farRadius)}px`,
        frontBlur: `${fixed(frontBlur)}px`,
        nearTransparent: `${fixed(nearTransparent)}%`,
        farTransparent: `${fixed(farTransparent)}%`,
        nearBoostTransparent: `${fixed(nearBoostTransparent)}%`,
        farBoostTransparent: `${fixed(farBoostTransparent)}%`,
        nearDimTransparent: `${fixed(nearDimTransparent)}%`,
        farDimTransparent: `${fixed(farDimTransparent)}%`,
        frontOpacity: fixed(frontOpacity),
    };
}

function normalizeGlowLayer(rawLayer, fallbackColor, fallbackAnimation) {
    if (!rawLayer || typeof rawLayer !== 'object') {
        return null;
    }
    const plane = normalizeToken(rawLayer.plane) === 'front' ? 'front' : 'back';
    const color = sanitizeCssColor(rawLayer.color) || fallbackColor;
    if (!color) {
        return null;
    }
    const animationClass = byToken(
        GLOW_ANIMATION_CLASS_MAP,
        normalizeToken(rawLayer.animation || fallbackAnimation),
    );
    return {
        plane,
        color,
        animationClass,
        metrics: glowMetrics(rawLayer.distance, rawLayer.spread, rawLayer.fade),
    };
}

function collectGlowLayers(tag, fallbackColor, fallbackAnimation) {
    const layers = [];
    if (Array.isArray(tag.glow_layers)) {
        tag.glow_layers.forEach((rawLayer) => {
            const normalized = normalizeGlowLayer(rawLayer, fallbackColor, fallbackAnimation);
            if (normalized) {
                layers.push(normalized);
            }
        });
    }
    if (layers.length > 0) {
        return layers;
    }

    // Legacy fallback: old single-glow fields become one back layer.
    const legacyHasBack = !!normalizeToken(tag.glow_background || tag.glow);
    const legacyHasFront = !!normalizeToken(tag.glow_foreground);
    const hasLegacyGlowFields = legacyHasBack
        || legacyHasFront
        || String(tag.glow_color || '').trim() !== ''
        || String(tag.glow_distance || '').trim() !== ''
        || String(tag.glow_spread || '').trim() !== ''
        || String(tag.glow_fade || '').trim() !== ''
        || String(tag.glow_animation || '').trim() !== '';
    if (!hasLegacyGlowFields || !fallbackColor) {
        return layers;
    }

    const legacyBase = {
        color: fallbackColor,
        distance: tag.glow_distance,
        spread: tag.glow_spread,
        fade: tag.glow_fade,
        animation: tag.glow_animation || fallbackAnimation,
    };

    if (legacyHasBack || !legacyHasFront) {
        const normalizedBack = normalizeGlowLayer({ plane: 'back', ...legacyBase }, fallbackColor, fallbackAnimation);
        if (normalizedBack) {
            layers.push(normalizedBack);
        }
    }
    if (legacyHasFront) {
        const normalizedFront = normalizeGlowLayer({ plane: 'front', ...legacyBase }, fallbackColor, fallbackAnimation);
        if (normalizedFront) {
            layers.push(normalizedFront);
        }
    }
    return layers;
}
