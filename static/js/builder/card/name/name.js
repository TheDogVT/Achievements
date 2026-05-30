(function () {
    function toTitleCase(value) {
        return String(value || '').replace(/\w\S*/g, (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
    }

    function applyTransform(value, transform) {
        const text = String(value || '');
        if (transform === 'upper') {
            return text.toUpperCase();
        }
        if (transform === 'lower') {
            return text.toLowerCase();
        }
        if (transform === 'title') {
            return toTitleCase(text);
        }
        return text;
    }

    function optionEntries(rawOptions) {
        if (Array.isArray(rawOptions)) {
            return rawOptions
                .filter((option) => option && typeof option === 'object')
                .map((option, index) => [option.id || `option_${index + 1}`, option]);
        }
        if (rawOptions && typeof rawOptions === 'object') {
            return Object.entries(rawOptions).filter(([, option]) => option && typeof option === 'object');
        }
        return [];
    }

    function normalizeOptions(rawOptions, slot, textMode = 'tag') {
        return optionEntries(rawOptions)
            .filter(([, option]) => option.enabled !== false)
            .map(([id, option]) => {
                const text = applyTransform(option.text || '', option.transform);
                return {
                    id,
                    slot,
                    label: option.label || id,
                    text,
                    style: option.style || '',
                    animation: option.animation || '',
                    font_family: option.font_family || '',
                    font_size: option.font_size || '',
                    font_weight: option.font_weight || '',
                    font_style: option.font_style || '',
                    letter_spacing: option.letter_spacing || '',
                    offset_x: option.offset_x || '',
                    offset_y: option.offset_y || '',
                    outline_thickness: option.outline_thickness || '',
                    outline_position: option.outline_position || 'center',
                    outline_outer_mode: option.outline_outer_mode || 'equal',
                    outline_cast_angle: option.outline_cast_angle ?? '270',
                    outline_cast_distance: option.outline_cast_distance ?? '0',
                    outline_light_thickness: option.outline_light_thickness || '',
                    outline_light_blur: option.outline_light_blur || '',
                    outline_light_z_index: option.outline_light_z_index ?? '6',
                    text_color: option.text_color || '',
                    glow_color: option.glow_color || '',
                    outline_color: option.outline_color || '',
                    outline_light_color: option.outline_light_color || '',
                    outline_light_opacity: option.outline_light_opacity ?? '100',
                    text_gradient: Array.isArray(option.text_gradient) ? option.text_gradient : [],
                    text_gradient_direction: option.text_gradient_direction || 'to right',
                    text_gradient_depth: option.text_gradient_depth || '100',
                    gradient_animation: option.gradient_animation || '',
                    edge_animation: option.edge_animation || '',
                    glow_layers: Array.isArray(option.glow_layers) ? option.glow_layers : [],
                    effects_layers: Array.isArray(option.effects_layers) ? option.effects_layers : [],
                    outline: option.outline || '',
                    background_mode: option.background_mode || 'none',
                    background_class: option.background_class || '',
                    background_renderer: option.background_renderer || '',
                    background_solid_color: option.background_solid_color || '',
                    background_gradient_start: option.background_gradient_start || '',
                    background_gradient_end: option.background_gradient_end || '',
                    background_gradient_angle: option.background_gradient_angle ?? '135',
                    opacity: option.opacity ?? '',
                    intensity: option.intensity ?? '1',
                    theme: option.theme || ''
                };
            });
    }

    function buildNameDecorations(cfg) {
        const localCfg = cfg || {};
        const prefixCfg = localCfg.prefix || {};
        const nameCfg = localCfg.name || {};
        const messageCfg = localCfg.message || {};
        const backgroundCfg = localCfg.background || {};
        const suffixCfg = localCfg.suffix || {};

        const prefixOptions = normalizeOptions(prefixCfg.options, 'name_prefix', 'tag');
        const nameOptions = normalizeOptions(nameCfg.options, 'name_base', 'name');
        const messageOptions = normalizeOptions(messageCfg.options, 'message_text', 'message');
        const backgroundOptions = normalizeOptions(backgroundCfg.options, 'card_background', 'background');
        const suffixOptions = normalizeOptions(suffixCfg.options, 'name_suffix', 'tag');

        const safePrefixOptions = prefixOptions.length > 0
            ? prefixOptions
            : [{ id: 'prefix_none', slot: 'name_prefix', label: 'None', text: '' }];
        const safeNameOptions = nameOptions.length > 0
            ? nameOptions
            : [{ id: 'name_none', slot: 'name_base', label: 'None', text: '' }];
        const safeBackgroundOptions = backgroundOptions.length > 0
            ? backgroundOptions
            : [{ id: 'background_none', slot: 'card_background', label: 'None', text: '' }];
        const safeMessageOptions = messageOptions.length > 0
            ? messageOptions
            : [{ id: 'message_none', slot: 'message_text', label: 'None', text: '' }];
        const safeSuffixOptions = suffixOptions.length > 0
            ? suffixOptions
            : [{ id: 'suffix_none', slot: 'name_suffix', label: 'None', text: '' }];

        return [
            ...safePrefixOptions,
            ...safeNameOptions,
            ...safeBackgroundOptions,
            ...safeMessageOptions,
            ...safeSuffixOptions,
        ];
    }

    window.DECORATION_NAME_BUILD = buildNameDecorations;
    window.DECORATION_NAME_DECORATIONS = buildNameDecorations(window.DECORATION_NAME_CONFIG || {});
}());
