/**
 * Effect knob manifest.
 *
 * Single source of truth for what each special_effect exposes as a tunable
 * parameter. Consumed by translation.js (sanitises JSON values and injects
 * --fx-* CSS variables on the .tag-special-layer span) and by the builder UI
 * (auto-renders controls via addBuilderKnobRow in app.js).
 *
 * Per-knob field reference:
 *   type     : 'number' | 'color'                 (required — omit to skip UI render)
 *   label    : human-readable label for builder UI (required)
 *   default  : default value (MUST match the CSS var(--fx-<knob>, <default>)
 *              fallback — they live in two places by design and must agree)
 *   min/max  : numeric range  (number type)
 *   step     : numeric granularity (number type)
 *   unit     : appended when setting the CSS var ('s', 'px', 'deg', ...).
 *              Omit for unitless 0-1 ratios / counts.
 *
 * Metadata keys (no 'type') are skipped by the builder UI:
 *   renderer : 'particle' — marks effects that use particle_engine.js
 *
 * Shared positioning knobs (all particle effects):
 *   origin_x        : horizontal offset from element centre (px)
 *   origin_y        : vertical offset from element centre (px)
 *   canvas_rotation : rotates the entire canvas container around element centre (deg)
 *
 * Directional particle effects also expose:
 *   range            : half-width of the spawn line (px) — tighten/widen spread
 *   particle_rotation: rotates each particle's velocity vector (deg)
 *
 * Ambient particle effects expose:
 *   range            : spawn circle radius from origin (px)
 *
 * CSS variable naming: underscores in the knob key become hyphens in CSS, so
 * the knob `line_opacity` is read in CSS as `var(--fx-line-opacity, default)`.
 * Color knobs use `color1`…`colorN` (→ `--fx-color1`…`--fx-colorN`).
 */

window.EFFECT_KNOBS = {

    /* ---- Particle: floating_stars ---- */
    floating_stars: {
        engine:          'particle',
        renderer:        'particle',
        particle_count:  { type: 'number', label: 'Particle count', allow_over_max: true,   min: 0,   max: 22,   step: 1,    default: 22 },
        speed:           { type: 'number', label: 'Pulse speed',      min: 1.0, max: 6.0,  step: 0.1,  default: 2.6, unit: 's'  },
        intensity:       { type: 'number', label: 'Brightness',       min: 0.3, max: 1.0,  step: 0.05, default: 0.85 },
        range:           { type: 'number', label: 'Spawn radius',     min: 0,   max: 300,  step: 5,    default: 60,  unit: 'px' },
        color1:          { type: 'color',  label: 'Star color',       default: '#ffe8a8' },
        origin_x:        { type: 'number', label: 'Origin X',         min: -200, max: 200, step: 5,    default: 0,   unit: 'px' },
        origin_y:        { type: 'number', label: 'Origin Y',         min: -200, max: 200, step: 5,    default: 0,   unit: 'px' },
        canvas_rotation: { type: 'number', label: 'Canvas rotation',  min: -180, max: 180, step: 5,    default: 0,   unit: '°'  },
    },

    /* ---- Particle: constellation ---- */
    constellation: {
        engine:          'particle',
        renderer:        'particle',
        particle_count:  { type: 'number', label: 'Particle count', allow_over_max: true,   min: 0,   max: 14,   step: 1,    default: 14 },
        star_count:      { type: 'number', label: 'Stars',            min: 3,   max: 14,   step: 1,    default: 7 },
        star_size:       { type: 'number', label: 'Star size',        min: 1,   max: 8,    step: 0.5,  default: 3,   unit: 'px' },
        speed:           { type: 'number', label: 'Twinkle speed',    min: 0.8, max: 8.0,  step: 0.1,  default: 3.4, unit: 's'  },
        twinkle:         { type: 'number', label: 'Twinkle strength', min: 0,   max: 1.0,  step: 0.05, default: 0.78 },
        intensity:       { type: 'number', label: 'Brightness',       min: 0.2, max: 1.0,  step: 0.05, default: 0.9 },
        drift:           { type: 'number', label: 'Drift',            min: 0,   max: 3.0,  step: 0.05, default: 0.35 },
        range:           { type: 'number', label: 'Spread',           min: 20,  max: 300,  step: 5,    default: 90,  unit: 'px' },
        line_width:      { type: 'number', label: 'Line width',       min: 0.2, max: 5.0,  step: 0.1,  default: 1.1, unit: 'px' },
        line_opacity:    { type: 'number', label: 'Line opacity',     min: 0,   max: 1.0,  step: 0.05, default: 0.55 },
        color1:          { type: 'color',  label: 'Star color',       default: '#fff7d0' },
        color2:          { type: 'color',  label: 'Twinkle color',    default: '#ffffff' },
        color3:          { type: 'color',  label: 'Line color',       default: '#8fd7ff' },
        origin_x:        { type: 'number', label: 'Origin X',         min: -200, max: 200, step: 5,    default: 0,   unit: 'px' },
        origin_y:        { type: 'number', label: 'Origin Y',         min: -200, max: 200, step: 5,    default: 0,   unit: 'px' },
        canvas_rotation: { type: 'number', label: 'Canvas rotation',  min: -180, max: 180, step: 5,    default: 0,   unit: '°'  },
    },

    /* ---- Particle: spark_trail ---- */
    spark_trail: {
        engine:           'particle',
        renderer:         'particle',
        particle_count:   { type: 'number', label: 'Particle count', allow_over_max: true,    min: 0,   max: 70,  step: 1,    default: 70 },
        speed:            { type: 'number', label: 'Pulse speed',       min: 1.0, max: 5.0, step: 0.1,  default: 2.3, unit: 's'  },
        length:           { type: 'number', label: 'Trail length',      min: 6,   max: 40,  step: 1,    default: 16,  unit: 'px' },
        intensity:        { type: 'number', label: 'Brightness',        min: 0.2, max: 1.0, step: 0.05, default: 0.8 },
        range:            { type: 'number', label: 'Spawn height',      min: 0,   max: 300, step: 5,    default: 80,  unit: 'px' },
        color1:           { type: 'color',  label: 'Spark color',       default: '#ff9040' },
        origin_x:         { type: 'number', label: 'Origin X',          min: -200, max: 200, step: 5,  default: 0,   unit: 'px' },
        origin_y:         { type: 'number', label: 'Origin Y',          min: -200, max: 200, step: 5,  default: 0,   unit: 'px' },
        particle_rotation:{ type: 'number', label: 'Particle rotation', min: -180, max: 180, step: 5,  default: 0,   unit: '°'  },
        canvas_rotation:  { type: 'number', label: 'Canvas rotation',   min: -180, max: 180, step: 5,  default: 0,   unit: '°'  },
        opacity:          { type: 'number', label: 'Opacity',            min: 0,    max: 1,   step: 0.05, default: 1 },
    },

    /* ---- Particle: fire_embers ---- */
    fire_embers: {
        engine:           'particle',
        renderer:         'particle',
        particle_count:   { type: 'number', label: 'Particle count', allow_over_max: true,    min: 0,   max: 50,  step: 1,    default: 50 },
        speed:            { type: 'number', label: 'Rise speed',        min: 0.8, max: 4.0, step: 0.1,  default: 1.9, unit: 's'  },
        glow:             { type: 'number', label: 'Glow strength',     min: 0.0, max: 1.0, step: 0.05, default: 0.42 },
        spread:           { type: 'number', label: 'Glow spread',       min: 0,   max: 30,  step: 1,    default: 18,  unit: 'px' },
        size:             { type: 'number', label: 'Ember size',        min: 6,   max: 20,  step: 1,    default: 12,  unit: 'px' },
        range:            { type: 'number', label: 'Spawn width',       min: 0,   max: 300, step: 5,    default: 80,  unit: 'px' },
        color1:           { type: 'color',  label: 'Ember color',       default: '#ff6820' },
        origin_x:         { type: 'number', label: 'Origin X',          min: -200, max: 200, step: 5,  default: 0,   unit: 'px' },
        origin_y:         { type: 'number', label: 'Origin Y',          min: -200, max: 200, step: 5,  default: 0,   unit: 'px' },
        particle_rotation:{ type: 'number', label: 'Particle rotation', min: -180, max: 180, step: 5,  default: 0,   unit: '°'  },
        canvas_rotation:  { type: 'number', label: 'Canvas rotation',   min: -180, max: 180, step: 5,  default: 0,   unit: '°'  },
    },

    /* ---- Particle: fire_radial ---- */
    fire_radial: {
        engine:           'particle',
        renderer:         'particle',
        particle_count:   { type: 'number', label: 'Particle count', allow_over_max: true,    min: 0,   max: 70,  step: 1,    default: 70 },
        speed:            { type: 'number', label: 'Expansion speed',    min: 0.5, max: 4.0, step: 0.1,  default: 1.5, unit: 's'  },
        glow:             { type: 'number', label: 'Glow strength',      min: 0.0, max: 1.0, step: 0.05, default: 0.58 },
        spread:           { type: 'number', label: 'Glow spread',        min: 0,   max: 30,  step: 1,    default: 16,  unit: 'px' },
        size:             { type: 'number', label: 'Ember size',         min: 4,   max: 20,  step: 1,    default: 10,  unit: 'px' },
        range:            { type: 'number', label: 'Fade radius',        min: 20,  max: 300, step: 5,    default: 110, unit: 'px' },
        point_expander:   { type: 'number', label: 'Point expander',     min: 0,   max: 120, step: 1,    default: 0,   unit: 'px' },
        angle_spread:     { type: 'number', label: 'Angle spread',       min: 5,   max: 360, step: 5,    default: 360, unit: 'deg' },
        color1:           { type: 'color',  label: 'Ember color',        default: '#ff8a2a' },
        origin_x:         { type: 'number', label: 'Origin X',           min: -200, max: 200, step: 5,  default: 0,   unit: 'px' },
        origin_y:         { type: 'number', label: 'Origin Y',           min: -200, max: 200, step: 5,  default: 0,   unit: 'px' },
        particle_rotation:{ type: 'number', label: 'Direction',          min: -180, max: 180, step: 5,  default: 0,   unit: 'deg' },
        canvas_rotation:  { type: 'number', label: 'Canvas rotation',    min: -180, max: 180, step: 5,  default: 0,   unit: 'deg' },
    },

    /* ---- Particle: bubble_drift ---- */
    bubble_drift: {
        engine:           'particle',
        renderer:         'particle',
        particle_count:   { type: 'number', label: 'Particle count', allow_over_max: true,    min: 0,   max: 40,  step: 1,   default: 40 },
        speed:            { type: 'number', label: 'Rise speed',        min: 1.5, max: 6.0, step: 0.1, default: 3.2, unit: 's'  },
        size:             { type: 'number', label: 'Bubble size',       min: 4,   max: 18,  step: 1,   default: 9,   unit: 'px' },
        range:            { type: 'number', label: 'Spawn width',       min: 0,   max: 300, step: 5,   default: 100, unit: 'px' },
        color1:           { type: 'color',  label: 'Bubble tint',       default: '#b7f1ff' },
        origin_x:         { type: 'number', label: 'Origin X',          min: -200, max: 200, step: 5,  default: 0,   unit: 'px' },
        origin_y:         { type: 'number', label: 'Origin Y',          min: -200, max: 200, step: 5,  default: 0,   unit: 'px' },
        particle_rotation:{ type: 'number', label: 'Particle rotation', min: -180, max: 180, step: 5,  default: 0,   unit: '°'  },
        canvas_rotation:  { type: 'number', label: 'Canvas rotation',   min: -180, max: 180, step: 5,  default: 0,   unit: '°'  },
        opacity:          { type: 'number', label: 'Opacity',            min: 0,    max: 1,   step: 0.05, default: 1 },
    },

    /* ---- Overlay: synth_scanlines ---- */
    synth_scanlines: {
        engine:        'render',
        speed:        { type: 'number', label: 'Scan speed',   min: 1.0, max: 5.0, step: 0.1,  default: 2.1,  unit: 's' },
        line_opacity: { type: 'number', label: 'Line opacity', min: 0.2, max: 1.0, step: 0.05, default: 0.58 },
        sweep_speed:  { type: 'number', label: 'Sweep speed',  min: 1.5, max: 6.0, step: 0.1,  default: 2.7,  unit: 's' },
    },

    /* ---- Particle: snow_fall ---- */
    snow_fall: {
        engine:           'particle',
        renderer:         'particle',
        particle_count:   { type: 'number', label: 'Particle count', allow_over_max: true,    min: 0,   max: 70,  step: 1,    default: 70 },
        speed:            { type: 'number', label: 'Fall speed',        min: 2.0, max: 8.0, step: 0.1,  default: 4.2, unit: 's'  },
        size:             { type: 'number', label: 'Flake size',        min: 3,   max: 10,  step: 1,    default: 5,   unit: 'px' },
        intensity:        { type: 'number', label: 'Brightness',        min: 0.4, max: 1.0, step: 0.05, default: 0.85 },
        range:            { type: 'number', label: 'Spawn width',       min: 0,   max: 300, step: 5,    default: 150, unit: 'px' },
        color1:           { type: 'color',  label: 'Flake tint',        default: '#ffffff' },
        origin_x:         { type: 'number', label: 'Origin X',          min: -200, max: 200, step: 5,  default: 0,   unit: 'px' },
        origin_y:         { type: 'number', label: 'Origin Y',          min: -200, max: 200, step: 5,  default: 0,   unit: 'px' },
        particle_rotation:{ type: 'number', label: 'Particle rotation', min: -180, max: 180, step: 5,  default: 0,   unit: '°'  },
        canvas_rotation:  { type: 'number', label: 'Canvas rotation',   min: -180, max: 180, step: 5,  default: 0,   unit: '°'  },
        opacity:          { type: 'number', label: 'Opacity',            min: 0,    max: 1,   step: 0.05, default: 1 },
    },

    /* ---- Intermittent: lightning ---- */
    lightning: {
        engine:    'render',
        intensity: { type: 'number', label: 'Flash brightness',     min: 0.3, max: 1.0, step: 0.05, default: 0.9 },
        color1:    { type: 'color',  label: 'Flash color',          default: '#ffffff' },
    },

    /* ---- Particle: firefly ---- */
    firefly: {
        engine:          'particle',
        renderer:        'particle',
        particle_count:  { type: 'number', label: 'Particle count', allow_over_max: true,   min: 0,   max: 14,   step: 1,    default: 14 },
        speed:           { type: 'number', label: 'Float speed',      min: 2.0, max: 8.0,  step: 0.1,  default: 4.0, unit: 's'  },
        intensity:       { type: 'number', label: 'Brightness',       min: 0.3, max: 1.0,  step: 0.05, default: 0.75 },
        range:           { type: 'number', label: 'Spawn radius',     min: 0,   max: 300,  step: 5,    default: 60,  unit: 'px' },
        color1:          { type: 'color',  label: 'Light color',      default: '#ffe48a' },
        origin_x:        { type: 'number', label: 'Origin X',         min: -200, max: 200, step: 5,    default: 0,   unit: 'px' },
        origin_y:        { type: 'number', label: 'Origin Y',         min: -200, max: 200, step: 5,    default: 0,   unit: 'px' },
        canvas_rotation: { type: 'number', label: 'Canvas rotation',  min: -180, max: 180, step: 5,    default: 0,   unit: '°'  },
    },

    /* ---- Particle: petals ---- */
    petals: {
        engine:           'particle',
        renderer:         'particle',
        particle_count:   { type: 'number', label: 'Particle count', allow_over_max: true,    min: 0,   max: 40,  step: 1,   default: 40 },
        speed:            { type: 'number', label: 'Fall speed',        min: 2.5, max: 7.0, step: 0.1, default: 4.8, unit: 's'  },
        size:             { type: 'number', label: 'Petal size',        min: 4,   max: 12,  step: 1,   default: 7,   unit: 'px' },
        range:            { type: 'number', label: 'Spawn width',       min: 0,   max: 300, step: 5,   default: 150, unit: 'px' },
        color1:           { type: 'color',  label: 'Petal tint',        default: '#ffc4d8' },
        origin_x:         { type: 'number', label: 'Origin X',          min: -200, max: 200, step: 5,  default: 0,   unit: 'px' },
        origin_y:         { type: 'number', label: 'Origin Y',          min: -200, max: 200, step: 5,  default: 0,   unit: 'px' },
        particle_rotation:{ type: 'number', label: 'Particle rotation', min: -180, max: 180, step: 5,  default: 0,   unit: '°'  },
        canvas_rotation:  { type: 'number', label: 'Canvas rotation',   min: -180, max: 180, step: 5,  default: 0,   unit: '°'  },
        opacity:          { type: 'number', label: 'Opacity',            min: 0,    max: 1,   step: 0.05, default: 1 },
    },

    /* ---- Overlay: glitch_bars ---- */
    glitch_bars: {
        engine:          'render',
        speed:          { type: 'number', label: 'Burst interval', min: 0.5, max: 8.0, step: 0.1,  default: 2.5, unit: 's'  },
        shift_distance: { type: 'number', label: 'Slice shift',    min: 0,   max: 20,  step: 0.5,  default: 6,   unit: 'px' },
        intensity:      { type: 'number', label: 'Intensity',      min: 0.1, max: 1.0, step: 0.05, default: 0.6 },
        color1:         { type: 'color',  label: 'Channel A',      default: '#20e0ff' },
        color2:         { type: 'color',  label: 'Channel B',      default: '#ff2080' },
    },

    /* ---- Overlay: holo_shimmer ---- */
    holo_shimmer: {
        engine:     'render',
        speed:     { type: 'number', label: 'Sweep speed', min: 2.0, max: 8.0, step: 0.1,  default: 4.5, unit: 's' },
        intensity: { type: 'number', label: 'Brightness',  min: 0.2, max: 1.0, step: 0.05, default: 0.55 },
        color1:    { type: 'color',  label: 'Stripe A',    default: '#ff80c0' },
        color2:    { type: 'color',  label: 'Stripe B',    default: '#a0b0ff' },
        color3:    { type: 'color',  label: 'Stripe C',    default: '#80ffe0' },
        color4:    { type: 'color',  label: 'Stripe D',    default: '#ffe080' },
    },

    /* ---- Particle: dust_motes ---- */
    dust_motes: {
        engine:          'particle',
        renderer:        'particle',
        particle_count:  { type: 'number', label: 'Particle count', allow_over_max: true,   min: 0,   max: 40,   step: 1,    default: 40 },
        speed:           { type: 'number', label: 'Drift speed',      min: 4.0, max: 12.0, step: 0.2,  default: 7.5, unit: 's'  },
        intensity:       { type: 'number', label: 'Visibility',       min: 0.2, max: 0.8,  step: 0.05, default: 0.45 },
        range:           { type: 'number', label: 'Spawn radius',     min: 0,   max: 300,  step: 5,    default: 60,  unit: 'px' },
        color1:          { type: 'color',  label: 'Mote tint',        default: '#fff2c4' },
        origin_x:        { type: 'number', label: 'Origin X',         min: -200, max: 200, step: 5,    default: 0,   unit: 'px' },
        origin_y:        { type: 'number', label: 'Origin Y',         min: -200, max: 200, step: 5,    default: 0,   unit: 'px' },
        canvas_rotation: { type: 'number', label: 'Canvas rotation',  min: -180, max: 180, step: 5,    default: 0,   unit: '°'  },
    },

    /* ---- Particle: flakes ---- */
    flakes: {
        engine:           'particle',
        renderer:         'particle',
        particle_count:   { type: 'number', label: 'Particle count', allow_over_max: true,    min: 0,   max: 45,  step: 1,    default: 45 },
        speed:            { type: 'number', label: 'Fall speed',        min: 2.0, max: 7.0, step: 0.1,  default: 3.8, unit: 's'  },
        size:             { type: 'number', label: 'Flake size',        min: 3,   max: 10,  step: 1,    default: 5,   unit: 'px' },
        intensity:        { type: 'number', label: 'Shimmer',           min: 0.4, max: 1.0, step: 0.05, default: 0.85 },
        range:            { type: 'number', label: 'Spawn width',       min: 0,   max: 300, step: 5,    default: 120, unit: 'px' },
        color1:           { type: 'color',  label: 'Flake A',           default: '#fff1a8' },
        color2:           { type: 'color',  label: 'Flake B',           default: '#ffd86b' },
        color3:           { type: 'color',  label: 'Flake C',           default: '#d4a526' },
        color4:           { type: 'color',  label: 'Flake D',           default: '#b8810a' },
        origin_x:         { type: 'number', label: 'Origin X',          min: -200, max: 200, step: 5,  default: 0,   unit: 'px' },
        origin_y:         { type: 'number', label: 'Origin Y',          min: -200, max: 200, step: 5,  default: 0,   unit: 'px' },
        particle_rotation:{ type: 'number', label: 'Particle rotation', min: -180, max: 180, step: 5,  default: 0,   unit: '°'  },
        canvas_rotation:  { type: 'number', label: 'Canvas rotation',   min: -180, max: 180, step: 5,  default: 0,   unit: '°'  },
        opacity:          { type: 'number', label: 'Opacity',            min: 0,    max: 1,   step: 0.05, default: 1 },
    },

    /* ---- Overlay: magic_circle ---- */
    magic_circle: {
        engine:     'render',
        speed:     { type: 'number', label: 'Pulse speed', min: 1.5, max: 6.0, step: 0.1,  default: 3.2, unit: 's' },
        intensity: { type: 'number', label: 'Brightness',  min: 0.3, max: 1.0, step: 0.05, default: 0.65 },
    },

    /* ---- Text: heat_haze ---- */
    heat_haze: {
        engine:     'text',
        speed:      { type: 'number', label: 'Drift speed', min: 1.2, max: 6.0, step: 0.1,  default: 2.8, unit: 's' },
        intensity:  { type: 'number', label: 'Warp strength', min: 0.15, max: 1.0, step: 0.05, default: 0.52 },
        color1:     { type: 'color', label: 'Tint', default: '#ffd29b' },
    },

    /* ---- Text: chroma_echo ---- */
    chroma_echo: {
        engine:      'text',
        speed:       { type: 'number', label: 'Pulse speed', min: 1.5, max: 7.0, step: 0.1,  default: 3.6, unit: 's' },
        intensity:   { type: 'number', label: 'Split strength', min: 0.15, max: 1.0, step: 0.05, default: 0.45 },
        color1:      { type: 'color', label: 'Echo A', default: '#68d7ff' },
        color2:      { type: 'color', label: 'Echo B', default: '#ff6fad' },
    },

    /* ---- Rear / ambient render ---- */
    smoke_haze: {
        engine:     'render',
        speed:      { type: 'number', label: 'Drift speed', min: 2.0, max: 12.0, step: 0.1, default: 6.2, unit: 's' },
        intensity:  { type: 'number', label: 'Density', min: 0.15, max: 1.0, step: 0.05, default: 0.42 },
        effect_opacity: { type: 'number', label: 'Effect opacity', min: 0.05, max: 1.0, step: 0.05, default: 0.9 },
        color1:     { type: 'color', label: 'Haze color', default: '#d7e1f0' },
        color2:     { type: 'color', label: 'Shadow tint', default: '#7482a2' },
    },
    mist_roll: {
        engine:     'render',
        speed:      { type: 'number', label: 'Roll speed', min: 2.0, max: 12.0, step: 0.1, default: 7.4, unit: 's' },
        intensity:  { type: 'number', label: 'Mist strength', min: 0.1, max: 1.0, step: 0.05, default: 0.36 },
        effect_opacity: { type: 'number', label: 'Effect opacity', min: 0.05, max: 1.0, step: 0.05, default: 0.85 },
        color1:     { type: 'color', label: 'Mist color', default: '#dff6ff' },
    },
    dust_field: {
        engine:     'render',
        speed:      { type: 'number', label: 'Drift speed', min: 3.0, max: 14.0, step: 0.1, default: 8.8, unit: 's' },
        intensity:  { type: 'number', label: 'Visibility', min: 0.1, max: 0.9, step: 0.05, default: 0.34 },
        effect_opacity: { type: 'number', label: 'Effect opacity', min: 0.05, max: 1.0, step: 0.05, default: 0.8 },
        color1:     { type: 'color', label: 'Dust color', default: '#fff4d2' },
    },
    halo_ring: {
        engine:     'render',
        speed:      { type: 'number', label: 'Pulse speed', min: 1.0, max: 8.0, step: 0.1, default: 4.6, unit: 's' },
        intensity:  { type: 'number', label: 'Glow strength', min: 0.1, max: 1.0, step: 0.05, default: 0.44 },
        effect_opacity: { type: 'number', label: 'Effect opacity', min: 0.05, max: 1.0, step: 0.05, default: 0.95 },
        color1:     { type: 'color', label: 'Ring color', default: '#ffe8a6' },
    },

    /* ---- Front accents / micro life ---- */
    glint_pass: {
        engine:     'render',
        intensity:  { type: 'number', label: 'Brightness', min: 0.1, max: 1.0, step: 0.05, default: 0.72 },
        effect_opacity: { type: 'number', label: 'Effect opacity', min: 0.05, max: 1.0, step: 0.05, default: 1 },
        color1:     { type: 'color', label: 'Glint color', default: '#ffffff' },
    },
    star_ping: {
        engine:     'render',
        intensity:  { type: 'number', label: 'Brightness', min: 0.1, max: 1.0, step: 0.05, default: 0.75 },
        effect_opacity: { type: 'number', label: 'Effect opacity', min: 0.05, max: 1.0, step: 0.05, default: 1 },
        color1:     { type: 'color', label: 'Star color', default: '#fff7d0' },
    },
    prism_flash: {
        engine:     'render',
        intensity:  { type: 'number', label: 'Brightness', min: 0.1, max: 1.0, step: 0.05, default: 0.68 },
        effect_opacity: { type: 'number', label: 'Effect opacity', min: 0.05, max: 1.0, step: 0.05, default: 1 },
        color1:     { type: 'color', label: 'Prism A', default: '#ffb6e7' },
        color2:     { type: 'color', label: 'Prism B', default: '#98ebff' },
    },
    spark_arc: {
        engine:     'render',
        intensity:  { type: 'number', label: 'Spark strength', min: 0.1, max: 1.0, step: 0.05, default: 0.72 },
        effect_opacity: { type: 'number', label: 'Effect opacity', min: 0.05, max: 1.0, step: 0.05, default: 1 },
        color1:     { type: 'color', label: 'Spark color', default: '#ffe18f' },
    },
    shard_flick: {
        engine:     'render',
        intensity:  { type: 'number', label: 'Brightness', min: 0.1, max: 1.0, step: 0.05, default: 0.66 },
        effect_opacity: { type: 'number', label: 'Effect opacity', min: 0.05, max: 1.0, step: 0.05, default: 1 },
        color1:     { type: 'color', label: 'Shard color', default: '#d1f4ff' },
    },
    lens_fleck: {
        engine:     'render',
        intensity:  { type: 'number', label: 'Brightness', min: 0.1, max: 1.0, step: 0.05, default: 0.52 },
        effect_opacity: { type: 'number', label: 'Effect opacity', min: 0.05, max: 1.0, step: 0.05, default: 1 },
        color1:     { type: 'color', label: 'Fleck color', default: '#ffeccb' },
    },

    /* ---- Text material finishes ---- */
    glass: {
        engine:     'text',
        speed:      { type: 'number', label: 'Shine speed', min: 1.2, max: 8.0, step: 0.1, default: 3.4, unit: 's' },
        intensity:  { type: 'number', label: 'Gloss strength', min: 0.1, max: 1.0, step: 0.05, default: 0.52 },
        color1:     { type: 'color', label: 'Glass tint', default: '#d8f6ff' },
    },
    chrome: {
        engine:     'text',
        speed:      { type: 'number', label: 'Sweep speed', min: 1.0, max: 8.0, step: 0.1, default: 2.6, unit: 's' },
        intensity:  { type: 'number', label: 'Reflectivity', min: 0.1, max: 1.0, step: 0.05, default: 0.64 },
        color1:     { type: 'color', label: 'Chrome tint', default: '#f2f7ff' },
    },
    pearlescent: {
        engine:     'text',
        speed:      { type: 'number', label: 'Shift speed', min: 1.0, max: 8.0, step: 0.1, default: 3.8, unit: 's' },
        intensity:  { type: 'number', label: 'Color shift', min: 0.1, max: 1.0, step: 0.05, default: 0.58 },
        color1:     { type: 'color', label: 'Pearl A', default: '#ffe8f6' },
        color2:     { type: 'color', label: 'Pearl B', default: '#c7fff8' },
    },
    frosted: {
        engine:     'text',
        speed:      { type: 'number', label: 'Shimmer speed', min: 1.2, max: 8.0, step: 0.1, default: 4.1, unit: 's' },
        intensity:  { type: 'number', label: 'Frost strength', min: 0.1, max: 1.0, step: 0.05, default: 0.46 },
        color1:     { type: 'color', label: 'Frost tint', default: '#e9fbff' },
    },
    burnt_metal: {
        engine:     'text',
        speed:      { type: 'number', label: 'Heat drift', min: 1.0, max: 8.0, step: 0.1, default: 3.1, unit: 's' },
        intensity:  { type: 'number', label: 'Burn strength', min: 0.1, max: 1.0, step: 0.05, default: 0.62 },
        color1:     { type: 'color', label: 'Burn tint', default: '#ff8d4a' },
        color2:     { type: 'color', label: 'Steel tint', default: '#aab7c7' },
    },
    glitter: {
        engine:     'text',
        speed:      { type: 'number', label: 'Sparkle speed', min: 1.0, max: 8.0, step: 0.1, default: 2.3, unit: 's' },
        intensity:  { type: 'number', label: 'Sparkle strength', min: 0.1, max: 1.0, step: 0.05, default: 0.7 },
        color1:     { type: 'color', label: 'Glitter color', default: '#fff4bd' },
    },
    cracked_enamel: {
        engine:     'text',
        speed:      { type: 'number', label: 'Sheen speed', min: 1.0, max: 8.0, step: 0.1, default: 4.8, unit: 's' },
        intensity:  { type: 'number', label: 'Crack depth', min: 0.1, max: 1.0, step: 0.05, default: 0.54 },
        color1:     { type: 'color', label: 'Enamel tint', default: '#fff7ef' },
        color2:     { type: 'color', label: 'Crack tint', default: '#54391f' },
    },

    /* ---- Text deformations ---- */
    liquid_wobble: {
        engine:     'text',
        speed:      { type: 'number', label: 'Wobble speed', min: 0.8, max: 6.0, step: 0.1, default: 2.2, unit: 's' },
        intensity:  { type: 'number', label: 'Wobble strength', min: 0.1, max: 1.0, step: 0.05, default: 0.42 },
        color1:     { type: 'color', label: 'Tint', default: '#baf6ff' },
    },
    heat_warp: {
        engine:     'text',
        speed:      { type: 'number', label: 'Warp speed', min: 0.8, max: 6.0, step: 0.1, default: 2.6, unit: 's' },
        intensity:  { type: 'number', label: 'Warp strength', min: 0.1, max: 1.0, step: 0.05, default: 0.48 },
        color1:     { type: 'color', label: 'Heat tint', default: '#ffbf83' },
    },
    rune_jitter: {
        engine:     'text',
        speed:      { type: 'number', label: 'Jitter speed', min: 0.4, max: 6.0, step: 0.1, default: 1.7, unit: 's' },
        intensity:  { type: 'number', label: 'Jitter strength', min: 0.1, max: 1.0, step: 0.05, default: 0.34 },
        color1:     { type: 'color', label: 'Rune glow', default: '#b7efff' },
    },
    flag_wave: {
        engine:     'text',
        speed:      { type: 'number', label: 'Wave speed', min: 0.8, max: 6.0, step: 0.1, default: 2.9, unit: 's' },
        intensity:  { type: 'number', label: 'Wave strength', min: 0.1, max: 1.0, step: 0.05, default: 0.36 },
        color1:     { type: 'color', label: 'Tint', default: '#ffffff' },
    },

};
