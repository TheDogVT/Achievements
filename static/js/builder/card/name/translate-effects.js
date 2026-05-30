function effectClassFor(effectId) {
    const explicit = byToken(SPECIAL_EFFECT_CLASS_MAP, effectId || '');
    if (explicit) {
        return explicit;
    }
    const token = normalizeToken(effectId);
    return token ? `tag-fx-${token.replace(/_/g, '-')}` : '';
}

function effectManifestFor(effectId) {
    const effects = (typeof window !== 'undefined' && window.EFFECT_KNOBS) || {};
    return effects[normalizeToken(effectId)] || null;
}

function effectEngineFor(effectId, fallback = 'render') {
    const manifest = effectManifestFor(effectId);
    if (!manifest) {
        return fallback;
    }
    if (manifest.engine === 'particle' || manifest.renderer === 'particle') {
        return 'particle';
    }
    if (manifest.engine === 'text') {
        return 'text';
    }
    return 'render';
}

function normalizeEffectLayer(rawLayer, overlayText) {
    if (!rawLayer || typeof rawLayer !== 'object') {
        return null;
    }
    const effectId = normalizeToken(rawLayer.effect);
    const effectClass = effectClassFor(effectId);
    if (!effectId || !effectClass) {
        return null;
    }
    const manifest = effectManifestFor(effectId);
    const planeToken = normalizeToken(rawLayer.plane);
    const plane = planeToken === 'rear' || planeToken === 'front' ? planeToken : 'text';
    const engine = effectEngineFor(effectId, normalizeToken(rawLayer.engine) || 'render');
    return {
        plane,
        engine,
        effectId,
        effectClass,
        manifest,
        zDepth: sanitizeZDepth(rawLayer.z_index, plane === 'rear' ? 3 : plane === 'front' ? 7 : 6),
        opacity: sanitizeLayerOpacity(rawLayer.opacity, ''),
        blendMode: sanitizeBlendMode(rawLayer.blend_mode),
        duration: sanitizeTimeSeconds(rawLayer.duration, 0.1, 30),
        delay: sanitizeTimeSeconds(rawLayer.delay, -30, 30),
        phase: sanitizeTimeSeconds(rawLayer.phase, -30, 30),
        interval: sanitizeTimeSeconds(rawLayer.interval, 0.2, 60),
        randomRange: sanitizeTimeSeconds(rawLayer.random_range, 0, 30),
        offsetX: sanitizeLength(String(rawLayer.offset_x || '')),
        offsetY: sanitizeLength(String(rawLayer.offset_y || '')),
        scale: sanitizeScale(rawLayer.scale),
        knobs: (rawLayer.knobs && typeof rawLayer.knobs === 'object') ? rawLayer.knobs : {},
        text: engine === 'text' ? overlayText : '',
    };
}

function collectEffectLayers(tag, overlayText) {
    const layers = [];
    if (Array.isArray(tag.effects_layers)) {
        tag.effects_layers.forEach((rawLayer) => {
            const normalized = normalizeEffectLayer(rawLayer, overlayText);
            if (normalized) {
                layers.push(normalized);
            }
        });
    }
    if (layers.length > 0) {
        return layers;
    }

    const legacyEffectId = normalizeToken(tag.special_effect);
    const effectClass = effectClassFor(legacyEffectId);
    if (!legacyEffectId || !effectClass) {
        return layers;
    }
    const legacyKnobs = (tag.special_effect_knobs && typeof tag.special_effect_knobs === 'object')
        ? { ...tag.special_effect_knobs }
        : {};
    const legacyPlane = normalizeToken(legacyKnobs.plane) === 'back'
        ? 'rear'
        : normalizeToken(legacyKnobs.plane) === 'front'
            ? 'front'
            : 'text';
    delete legacyKnobs.plane;
    layers.push({
        plane: legacyPlane,
        engine: effectEngineFor(legacyEffectId),
        effectId: legacyEffectId,
        effectClass,
        manifest: effectManifestFor(legacyEffectId),
        zDepth: legacyPlane === 'rear' ? 3 : legacyPlane === 'front' ? 7 : 6,
        opacity: sanitizeLayerOpacity(legacyKnobs.opacity, ''),
        blendMode: '',
        duration: '',
        delay: '',
        phase: '',
        interval: '',
        randomRange: '',
        offsetX: '',
        offsetY: '',
        scale: '',
        knobs: legacyKnobs,
        text: effectEngineFor(legacyEffectId) === 'text' ? overlayText : '',
    });
    return layers;
}
