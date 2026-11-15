/* ==========================================================================
   Grandma's Apartment — 2D Isometric SVG Game
   Plain vanilla JavaScript · No external dependencies · Static-host ready
   ========================================================================== */

(() => {
  'use strict';

  // ========================================================================
  // 1. TUNABLE GAME CONSTANTS
  // ========================================================================

  const SCENE_WIDTH = 1300;
  const SCENE_HEIGHT = 1040;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // House placement inside the 1300x1040 stage (sky stays full-size behind it).
  // The house is scaled down and shifted left so it never overlaps the right side panel.
  const HOUSE_SCALE = 0.86; // 1 = original size
  const HOUSE_NATIVE_CENTER = { x: 590, y: 505 }; // Center of the apartment drawing (unscaled)
  const HOUSE_TARGET_CENTER = { x: 540, y: 520 }; // Where that center sits on the stage
  const HOUSE_OFFSET = {
    x: HOUSE_TARGET_CENTER.x - HOUSE_NATIVE_CENTER.x * HOUSE_SCALE,
    y: HOUSE_TARGET_CENTER.y - HOUSE_NATIVE_CENTER.y * HOUSE_SCALE,
  };

  // Converts house-space coordinates (gridToScreen output) to stage coordinates
  function houseToStage(p) {
    return {
      x: p.x * HOUSE_SCALE + HOUSE_OFFSET.x,
      y: p.y * HOUSE_SCALE + HOUSE_OFFSET.y,
    };
  }

  // Movement is defined in SCREEN pixels so every direction feels equally fast on screen
  const SCREEN_SPEED_PX = 150; // Horizontal on-screen walking speed (px / second)
  const VERTICAL_SCREEN_FACTOR = 0.78; // Up/down on-screen speed relative to left/right (isometric feel)
  const ACCEL_RATE = 14; // Velocity ramp-up responsiveness (higher = snappier)
  const DECEL_RATE = 20; // Velocity stop responsiveness
  const MAX_COLLISION_SUBSTEP = 0.04; // Prevents tunneling through partitions
  const WALK_FRAME_MS = 175; // ms per walk frame alternation
  const WALK_GRACE_MS = 110; // Keeps walk pose briefly when sliding along walls (prevents flicker)
  const SKY_INTERVAL_MS = 20000; // Every sky (Day, Sunset, Night) lasts 20 seconds
  const TOTAL_DAYS = 3; // One session = 3 full day/sunset/night cycles (3 min total)

  // Session storage (browser localStorage). Sessions are kept so players can review them.
  const STORAGE_KEY = 'grandma-apartment.sessions.v1';
  const LAST_PLAYER_KEY = 'grandma-apartment.last-player';
  const MAX_STORED_SESSIONS = 50;
  const AUTOSAVE_INTERVAL_MS = 3000;

  const CHAR_SCALE = 1.5; // 1.5x character size multiplier
  const CHAR_WIDTH_PX = 60 * CHAR_SCALE; // 90px standing/walking/fallen width
  const SLEEP_SIZES = {
    sofa: 150 * CHAR_SCALE, // 225px sleeping on sofa
    bed: 120 * CHAR_SCALE,  // 180px sleeping on bed
  };

  const SLEEP_SPOTS = {
    sofa: { x: 3.5, y: 7.2 },
    bed: { x: 9.4, y: 8.0 },
  };

  const START_POS = { x: 2.0, y: 5.5 }; // Hallway starting position
  const COLLISION_RADIUS = 0.25; // Character circle radius in grid tiles
  const WALL_THICKNESS = 0.2; // Partition wall thickness in grid tiles
  const INTERACTION_EXPAND = 0.6; // Furniture interaction zone expansion (tiles)

  // Night radial glow coordinates (grid space + vertical screen lift in px)
  const NIGHT_GLOW_LOCATIONS = {
    bedsideLamp: { x: 11.4, y: 7.6, offsetY: -28, radius: 115 },
    floorLamp: { x: 0.5, y: 11.5, offsetY: -42, radius: 130 },
    balconyLights: [
      { x: 0.0, y: 13.5, offsetY: -18, radius: 68 },
      { x: 0.0, y: 15.0, offsetY: -18, radius: 68 },
      { x: 1.5, y: 15.0, offsetY: -18, radius: 68 },
      { x: 3.0, y: 15.0, offsetY: -18, radius: 68 },
      { x: 4.5, y: 15.0, offsetY: -18, radius: 68 },
      { x: 6.0, y: 15.0, offsetY: -18, radius: 68 },
      { x: 6.0, y: 13.5, offsetY: -18, radius: 68 },
    ],
  };

  // ========================================================================
  // 2. ASSET FILENAMES (/assets folder)
  // Update these paths if your apartment/sky/furniture SVGs have different names.
  // ========================================================================

  const ASSET_FILES = {
    // Sky layers
    skyDay: 'assets/01-sky-day.svg',
    skySunset: 'assets/02-sky-sunset.svg',
    skyNight: 'assets/03-sky-night.svg',

    // Apartment structure & partition walls
    structure: 'assets/04-structure.svg',
    partitions: 'assets/05-partitions.svg',

    // 3 furniture SVG files (all <g id> groups are moved into #depth-layer / #carpets-layer)
    furniture1: 'assets/08-bedroom-balcony.svg',
    furniture2: 'assets/lh.svg',
    furniture3: 'assets/06-bathroom-kitchen.svg',

    // 5 Grandma character pose SVGs
    grandmaStanding: 'assets/09-grandma-standing.svg',
    grandmaWalk1: 'assets/grandma-walk-1.svg',
    grandmaWalk2: 'assets/grandma-walk-2.svg',
    grandmaSleeping: 'assets/10-grandma-sleeping.svg',
    grandmaFallen: 'assets/grandma-fallen.svg',
  };

  // ========================================================================
  // 3. EDITABLE COLLISION CONFIGURATION (GRID COORDINATES)
  // ========================================================================

  const COLLISION = {
    charRadius: COLLISION_RADIUS,
    wallThickness: WALL_THICKNESS,

    // Outer boundary edges (floor diamond x0-12, y0-12 + balcony x0-6, y12-15;
    // open between Living Room and Balcony at y=12, x0-6)
    outerWalls: [
      { id: 'outer-left', x1: 0, y1: 0, x2: 0, y2: 15 },
      { id: 'outer-top', x1: 0, y1: 0, x2: 12, y2: 0 },
      { id: 'outer-right', x1: 12, y1: 0, x2: 12, y2: 12 },
      { id: 'outer-bedroom-bottom', x1: 6, y1: 12, x2: 12, y2: 12 },
      { id: 'outer-balcony-right', x1: 6, y1: 12, x2: 6, y2: 15 },
      { id: 'outer-balcony-bottom', x1: 0, y1: 15, x2: 6, y2: 15 },
    ],

    // Interior partition walls (treated as WALL_THICKNESS = 0.15 tiles thick)
    partitionWalls: [
      // y = 4.5 from x 0–6 with doorway gap x 4–5
      { id: 'wall-bath-left', x1: 0, y1: 4.5, x2: 4, y2: 4.5 },
      { id: 'wall-bath-right', x1: 5, y1: 4.5, x2: 6, y2: 4.5 },

      // x = 6 from y 0–4.5 (bathroom / kitchen divider)
      { id: 'wall-bath-kitchen', x1: 6, y1: 0, x2: 6, y2: 4.5 },

      // y = 6.5 from x 0–6 (hallway / living room divider)
      { id: 'wall-hall-living', x1: 0, y1: 6.5, x2: 6, y2: 6.5 },

      // y = 6.5 from x 8–12 with doorway gap x 7–8 (kitchen / bedroom divider)
      { id: 'wall-kitchen-bedroom', x1: 8, y1: 6.5, x2: 12, y2: 6.5 },

      // x = 6.5 from y 8.7–12 (living room / bedroom divider)
      { id: 'wall-living-bedroom', x1: 6.5, y1: 8.7, x2: 6.5, y2: 12 },
    ],

    // Furniture footprints (blocked axis-aligned boxes in grid space).
    // Entries with `blocker: true` are invisible collision-only zones (not used for depth sorting).
    // All footprints include the furniture's floor border so the character never steps onto it.
    footprints: [
      // Bathroom (x0-6, y0-4.5)
      // Tub: flush to y=0 wall, only the left corner (x < 0.65) behind it is reachable.
      { id: 'bathtub', x1: 0.65, y1: 0.0, x2: 3.75, y2: 1.8 },
      // Seals the slot between tub and sink so the character can't squeeze behind either.
      { id: 'bath-gap-blocker', x1: 3.75, y1: 0.0, x2: 4.1, y2: 1.72, blocker: true },
      // Sink: flush to y=0 wall incl. floor border; only the right corner (x > 5.3) is reachable.
      { id: 'sink', x1: 4.1, y1: 0.0, x2: 5.3, y2: 1.65 },
      { id: 'toilet', x1: 5.0, y1: 2.5, x2: 5.85, y2: 3.35 },

      // Kitchen (x6-12, y0-6.5) — flush to walls & expanded for chairs/floor borders
      { id: 'fridge', x1: 6.0, y1: 0.0, x2: 7.35, y2: 1.85 },
      { id: 'kitchen-counter', x1: 7.3, y1: 0.0, x2: 12.0, y2: 1.75 },
      { id: 'kitchen-table', x1: 8.55, y1: 2.75, x2: 11.65, y2: 5.15 },
      // Dead notch between table and right wall
      { id: 'kitchen-table-right-blocker', x1: 11.65, y1: 2.75, x2: 12.0, y2: 5.15, blocker: true },
      // Strip along the kitchen side of the kitchen/bedroom wall: keeps the character from
      // appearing squeezed between the kitchen wall and the bed / wardrobe.
      { id: 'bed-back-blocker', x1: 7.25, y1: 5.15, x2: 12.0, y2: 6.5, blocker: true },

      // Hallway (x0-7, y4.5-6.5)
      { id: 'shoe-cabinet', x1: 0.25, y1: 4.65, x2: 1.25, y2: 5.45 },

      // Living Room (x0-6, y6.5-12)
      { id: 'sofa', x1: 1.5, y1: 6.6, x2: 5.5, y2: 7.8, interactive: 'sofa' },
      { id: 'coffee-table', x1: 2.5, y1: 9.0, x2: 4.5, y2: 10.0 },
      { id: 'tv-frame', x1: 1.5, y1: 11.3, x2: 5.5, y2: 11.7 },
      { id: 'floor-lamp', x1: 0.3, y1: 11.3, x2: 0.7, y2: 11.7 },

      // Bedroom (x7-12, y6.5-12)
      // Bed sealed to the y=6.5 kitchen partition; left-side blocker stops the character from
      // standing behind the bed (between the kitchen wall, the corridor and the bed).
      { id: 'bed', x1: 8.15, y1: 6.5, x2: 10.65, y2: 9.25, interactive: 'bed' },
      { id: 'bed-left-blocker', x1: 7.25, y1: 6.5, x2: 8.15, y2: 9.25, blocker: true },
      { id: 'wardrobe', x1: 10.65, y1: 6.5, x2: 12.0, y2: 7.85 },

      // Balcony (x0-6, y12-15)
      { id: 'balcony-table', x1: 1.6, y1: 13.1, x2: 2.4, y2: 13.9 },
    ],
  };

  // Matches furniture <g id> / class names to footprints (used for accurate depth sorting).
  const FOOTPRINT_MATCHERS = [
    { id: 'kitchen-counter', re: /counter|stove|oven|cooktop|kitchen[-_ ]?(sink|cabinet|unit)/i },
    { id: 'sink', re: /sink|vanity|wash.?basin|basin/i, not: /kitchen/i },
    { id: 'bathtub', re: /bath.?tub|(^|[-_ ])tub($|[-_ ])/i },
    { id: 'toilet', re: /toilet|(^|[-_ ])wc($|[-_ ])/i },
    { id: 'fridge', re: /fridge|refrigerator/i },
    { id: 'kitchen-table', re: /kitchen[-_ ]?table|dining|chairs?/i },
    { id: 'shoe-cabinet', re: /shoe/i },
    { id: 'sofa', re: /sofa|couch/i },
    { id: 'coffee-table', re: /coffee/i },
    { id: 'tv-frame', re: /(^|[-_ ])tv($|[-_ ])|television/i },
    { id: 'floor-lamp', re: /floor[-_ ]?lamp/i },
    { id: 'wardrobe', re: /wardrobe|closet|armoire/i },
    { id: 'bed', re: /(^|[-_ ])bed($|[-_ ])/i, not: /bedside|bedroom|nightstand/i },
    { id: 'balcony-table', re: /bistro|balcony[-_ ]?table/i },
  ];

  // ========================================================================
  // 4. COORDINATE HELPERS
  // ========================================================================

  function gridToScreen(gx, gy) {
    return {
      x: 650 + (gx - gy) * 40,
      y: 300 + (gx + gy) * 20,
    };
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function isoPolyPoints(x1, y1, x2, y2) {
    const p1 = gridToScreen(x1, y1);
    const p2 = gridToScreen(x2, y1);
    const p3 = gridToScreen(x2, y2);
    const p4 = gridToScreen(x1, y2);
    return `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`;
  }

  // ========================================================================
  // 5. PLACEHOLDER SVG GENERATOR (Used when /assets/*.svg fails to load)
  // ========================================================================

  function createSvgEl(tag, attrs = {}, textContent = null) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, String(v));
    }
    if (textContent !== null) el.textContent = textContent;
    return el;
  }

  function buildPlaceholderSvgText(key, filename) {
    const shortName = filename.split('/').pop();

    if (key.startsWith('sky')) {
      const palette = {
        skyDay: ['#9fd8ff', '#dff4ff', '#62a9df'],
        skySunset: ['#ff886b', '#ffd08a', '#6d4b92'],
        skyNight: ['#0f1333', '#232859', '#090b20'],
      }[key];
      const stars =
        key === 'skyNight'
          ? `
          <circle cx="140" cy="95" r="2.2" fill="#fff8c9" opacity="0.9"/>
          <circle cx="310" cy="60" r="1.8" fill="#fff8c9" opacity="0.8"/>
          <circle cx="520" cy="120" r="2.4" fill="#fff8c9" opacity="0.85"/>
          <circle cx="880" cy="70" r="2.0" fill="#fff8c9" opacity="0.9"/>
          <circle cx="1120" cy="140" r="2.5" fill="#fff8c9" opacity="0.85"/>
          <circle cx="1190" cy="65" r="1.7" fill="#fff8c9" opacity="0.7"/>`
          : '';
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1300 1040">
        <defs>
          <linearGradient id="ph-${key}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${palette[2]}"/>
            <stop offset="55%" stop-color="${palette[0]}"/>
            <stop offset="100%" stop-color="${palette[1]}"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="1300" height="1040" fill="url(#ph-${key})"/>
        ${stars}
        <g id="${key}-placeholder-badge">
          <rect x="18" y="992" width="190" height="32" rx="8" fill="rgba(255,255,255,0.75)" stroke="#2A2547" stroke-width="2"/>
          <text x="113" y="1013" text-anchor="middle" font-family="monospace" font-size="13" font-weight="700" fill="#2A2547">${shortName}</text>
        </g>
      </svg>`;
    }

    if (key === 'structure') {
      const rooms = [
        { name: 'BATHROOM', x1: 0, y1: 0, x2: 6, y2: 4.5, fill: '#dceff5' },
        { name: 'KITCHEN', x1: 6, y1: 0, x2: 12, y2: 6.5, fill: '#f7ead6' },
        { name: 'HALLWAY', x1: 0, y1: 4.5, x2: 7, y2: 6.5, fill: '#ebe1d0' },
        { name: 'CORRIDOR', x1: 6, y1: 6.5, x2: 7, y2: 8, fill: '#ebe1d0' },
        { name: 'LIVING ROOM', x1: 0, y1: 6.5, x2: 6, y2: 12, fill: '#f5dec9' },
        { name: 'BEDROOM', x1: 7, y1: 6.5, x2: 12, y2: 12, fill: '#e8dff5' },
        { name: 'BALCONY', x1: 0, y1: 12, x2: 6, y2: 15, fill: '#d6e4c8' },
      ];
      const roomPolys = rooms
        .map((r) => `<polygon points="${isoPolyPoints(r.x1, r.y1, r.x2, r.y2)}" fill="${r.fill}" stroke="#b9ad9e" stroke-width="1.5"/>`)
        .join('');

      const topLeftWall = `${gridToScreen(0, 0).x},${gridToScreen(0, 0).y} ${gridToScreen(0, 12).x},${gridToScreen(0, 12).y} ${gridToScreen(0, 12).x},${gridToScreen(0, 12).y - 78} ${gridToScreen(0, 0).x},${gridToScreen(0, 0).y - 78}`;
      const topRightWall = `${gridToScreen(0, 0).x},${gridToScreen(0, 0).y} ${gridToScreen(12, 0).x},${gridToScreen(12, 0).y} ${gridToScreen(12, 0).x},${gridToScreen(12, 0).y - 78} ${gridToScreen(0, 0).x},${gridToScreen(0, 0).y - 78}`;

      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1300 1040">
        <g id="apartment-floor">
          ${roomPolys}
          <polygon points="${topLeftWall}" fill="#f1ece6" stroke="#c4bab0" stroke-width="2"/>
          <polygon points="${topRightWall}" fill="#e6dfd7" stroke="#c4bab0" stroke-width="2"/>
        </g>
        <g id="structure-placeholder-box">
          <rect x="230" y="992" width="170" height="32" rx="8" fill="#dceff5" stroke="#2A2547" stroke-width="2"/>
          <text x="315" y="1013" text-anchor="middle" font-family="monospace" font-size="13" font-weight="700" fill="#2A2547">${shortName}</text>
        </g>
      </svg>`;
    }

    if (key === 'partitions') {
      const makeWallQuad = (x1, y1, x2, y2, h = 58, fill = '#ede6dc', id = '') => {
        const a = gridToScreen(x1, y1);
        const b = gridToScreen(x2, y2);
        return `<polygon ${id ? `id="${id}"` : ''} points="${a.x},${a.y} ${b.x},${b.y} ${b.x},${b.y - h} ${a.x},${a.y - h}" fill="${fill}" fill-opacity="0.92" stroke="#8f8377" stroke-width="2"/>`;
      };
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1300 1040">
        <g id="interior-partitions">
          ${makeWallQuad(0, 4.5, 4, 4.5, 56, '#ebe3d8', 'wall-bath-left')}
          ${makeWallQuad(5, 4.5, 6, 4.5, 56, '#ebe3d8', 'wall-bath-right')}
          ${makeWallQuad(6, 0, 6, 4.5, 56, '#e0d7ca', 'wall-bath-kitchen')}
          ${makeWallQuad(0, 6.5, 6, 6.5, 56, '#ebe3d8', 'wall-hall-living')}
          ${makeWallQuad(8, 6.5, 12, 6.5, 56, '#ebe3d8', 'wall-kitchen-bedroom')}
          ${makeWallQuad(6.5, 8.7, 6.5, 12, 56, '#e0d7ca', 'wall-living-bedroom')}
        </g>
        <g id="front-walls">
          ${makeWallQuad(12, 0, 12, 12, 24, '#dfd6ca')}
          ${makeWallQuad(6, 12, 12, 12, 24, '#e8dfd3')}
        </g>
        <g id="balcony-railing">
          ${makeWallQuad(0, 12, 0, 15, 22, 'rgba(180,210,220,0.45)')}
          ${makeWallQuad(0, 15, 6, 15, 22, 'rgba(180,210,220,0.45)')}
          ${makeWallQuad(6, 12, 6, 15, 22, 'rgba(180,210,220,0.45)')}
          <circle class="bulb" cx="${gridToScreen(0, 13.5).x}" cy="${gridToScreen(0, 13.5).y - 20}" r="4" fill="#ffe799"/>
          <circle class="bulb" cx="${gridToScreen(0, 15).x}" cy="${gridToScreen(0, 15).y - 20}" r="4" fill="#ffe799"/>
          <circle class="bulb" cx="${gridToScreen(1.5, 15).x}" cy="${gridToScreen(1.5, 15).y - 20}" r="4" fill="#ffe799"/>
          <circle class="bulb" cx="${gridToScreen(3.0, 15).x}" cy="${gridToScreen(3.0, 15).y - 20}" r="4" fill="#ffe799"/>
          <circle class="bulb" cx="${gridToScreen(4.5, 15).x}" cy="${gridToScreen(4.5, 15).y - 20}" r="4" fill="#ffe799"/>
          <circle class="bulb" cx="${gridToScreen(6, 15).x}" cy="${gridToScreen(6, 15).y - 20}" r="4" fill="#ffe799"/>
          <circle class="bulb" cx="${gridToScreen(6, 13.5).x}" cy="${gridToScreen(6, 13.5).y - 20}" r="4" fill="#ffe799"/>
        </g>
        <g id="partitions-placeholder-box">
          <rect x="415" y="992" width="175" height="32" rx="8" fill="#ebe3d8" stroke="#2A2547" stroke-width="2"/>
          <text x="502" y="1013" text-anchor="middle" font-family="monospace" font-size="13" font-weight="700" fill="#2A2547">${shortName}</text>
        </g>
      </svg>`;
    }

    if (key.startsWith('furniture')) {
      const groupsByFile = {
        furniture1: [
          { id: 'bed', x1: 8.2, y1: 6.9, x2: 10.6, y2: 9.1, h: 24, color: '#9c8be0', label: 'Bed' },
          { id: 'wardrobe', x1: 10.7, y1: 6.6, x2: 11.9, y2: 7.8, h: 62, color: '#a87d56', label: 'Wardrobe' },
          { id: 'bistro-set', x1: 1.6, y1: 13.1, x2: 2.4, y2: 13.9, h: 22, color: '#8ac288', label: 'Balcony Tbl' },
        ],
        furniture2: [
          { id: 'shoe-cabinet', x1: 0.3, y1: 4.7, x2: 1.2, y2: 5.4, h: 28, color: '#c48f65', label: 'Shoes' },
          { id: 'sofa', x1: 1.5, y1: 6.6, x2: 5.5, y2: 7.8, h: 30, color: '#e67e73', label: 'Sofa' },
          { id: 'coffee-table', x1: 2.5, y1: 9.0, x2: 4.5, y2: 10.0, h: 16, color: '#c9935b', label: 'Coffee Tbl' },
          { id: 'tv-frame', x1: 1.5, y1: 11.3, x2: 5.5, y2: 11.7, h: 38, color: '#5c607a', label: 'TV' },
          { id: 'floor-lamp', x1: 0.3, y1: 11.3, x2: 0.7, y2: 11.7, h: 52, color: '#f2c96d', label: 'Lamp', bulb: true },
        ],
        furniture3: [
          { id: 'bathtub', x1: 0.7, y1: 0.1, x2: 3.6, y2: 1.6, h: 24, color: '#9ed5e8', label: 'Bathtub' },
          { id: 'sink', x1: 4.3, y1: 0.1, x2: 5.3, y2: 1.4, h: 28, color: '#b7e2f0', label: 'Sink' },
          { id: 'toilet', x1: 5.0, y1: 2.5, x2: 5.8, y2: 3.3, h: 26, color: '#ccebf5', label: 'Toilet' },
          { id: 'fridge', x1: 6.1, y1: 0.1, x2: 7.3, y2: 1.55, h: 58, color: '#d7e0e6', label: 'Fridge' },
          { id: 'kitchen-counter', x1: 7.4, y1: 0.1, x2: 11.9, y2: 1.45, h: 30, color: '#e8c89b', label: 'Counter' },
          { id: 'kitchen-table', x1: 9.0, y1: 3.2, x2: 11.2, y2: 4.8, h: 26, color: '#d9a46c', label: 'Table' },
        ],
      };

      const makeIsoBox = (item) => {
        const pTop = gridToScreen(item.x1, item.y1);
        const pRight = gridToScreen(item.x2, item.y1);
        const pBottom = gridToScreen(item.x2, item.y2);
        const pLeft = gridToScreen(item.x1, item.y2);
        const h = item.h;

        const topFace = `${pTop.x},${pTop.y - h} ${pRight.x},${pRight.y - h} ${pBottom.x},${pBottom.y - h} ${pLeft.x},${pLeft.y - h}`;
        const leftFace = `${pLeft.x},${pLeft.y - h} ${pBottom.x},${pBottom.y - h} ${pBottom.x},${pBottom.y} ${pLeft.x},${pLeft.y}`;
        const rightFace = `${pBottom.x},${pBottom.y - h} ${pRight.x},${pRight.y - h} ${pRight.x},${pRight.y} ${pBottom.x},${pBottom.y}`;
        const center = gridToScreen((item.x1 + item.x2) / 2, (item.y1 + item.y2) / 2);

        const bulbMarkup = item.bulb
          ? `<circle class="bulb" cx="${center.x}" cy="${center.y - h - 6}" r="7" fill="#ffe680" stroke="#2A2547" stroke-width="1.5"/>`
          : '';

        return `<g id="${item.id}">
          <polygon points="${leftFace}" fill="${item.color}" filter="brightness(0.88)" stroke="#2A2547" stroke-width="1.5"/>
          <polygon points="${rightFace}" fill="${item.color}" filter="brightness(0.76)" stroke="#2A2547" stroke-width="1.5"/>
          <polygon points="${topFace}" fill="${item.color}" stroke="#2A2547" stroke-width="1.5"/>
          ${bulbMarkup}
          <text x="${center.x}" y="${center.y - h + 4}" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="700" fill="#2A2547">${item.label} (${shortName})</text>
        </g>`;
      };

      const items = groupsByFile[key] || [];
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1300 1040">${items.map(makeIsoBox).join('')}</svg>`;
    }

    if (key === 'grandmaSleeping') {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 100">
        <rect x="6" y="34" width="168" height="58" rx="14" fill="#c7b8ff" stroke="#2A2547" stroke-width="3"/>
        <circle cx="38" cy="58" r="16" fill="#ffd9c2" stroke="#2A2547" stroke-width="2.5"/>
        <circle cx="24" cy="48" r="9" fill="#eef1f6" stroke="#2A2547" stroke-width="2"/>
        <text x="108" y="60" text-anchor="middle" font-family="monospace" font-size="11" font-weight="700" fill="#2A2547">${shortName}</text>
        <text x="108" y="77" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="700" fill="#2A2547">SLEEPING</text>
        <g id="zzz">
          <text x="64" y="28" font-family="sans-serif" font-size="16" font-weight="900" fill="#ffffff" stroke="#2A2547" stroke-width="1">Z</text>
          <text x="80" y="18" font-family="sans-serif" font-size="13" font-weight="900" fill="#ffffff" stroke="#2A2547" stroke-width="1">z</text>
          <text x="93" y="11" font-family="sans-serif" font-size="10" font-weight="900" fill="#ffffff" stroke="#2A2547" stroke-width="0.8">z</text>
        </g>
      </svg>`;
    }

    if (key === 'grandmaFallen') {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 90">
        <rect x="6" y="14" width="128" height="68" rx="12" fill="#ffb8b8" stroke="#2A2547" stroke-width="3"/>
        <text x="70" y="45" text-anchor="middle" font-family="monospace" font-size="10" font-weight="700" fill="#2A2547">${shortName}</text>
        <text x="70" y="64" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="800" fill="#2A2547">FALLEN</text>
      </svg>`;
    }

    const poseColor = {
      grandmaStanding: '#ffe29a',
      grandmaWalk1: '#a8f0c6',
      grandmaWalk2: '#9cd8ff',
    }[key] || '#ffe29a';

    const leftFootY = key === 'grandmaWalk1' ? 124 : key === 'grandmaWalk2' ? 132 : 130;
    const rightFootY = key === 'grandmaWalk1' ? 132 : key === 'grandmaWalk2' ? 124 : 130;
    const poseTag =
      key === 'grandmaWalk1' ? 'WALK 1' : key === 'grandmaWalk2' ? 'WALK 2' : 'STAND';

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140">
      <ellipse cx="50" cy="133" rx="22" ry="6" fill="rgba(42,37,71,0.22)"/>
      <rect x="10" y="42" width="80" height="78" rx="14" fill="${poseColor}" stroke="#2A2547" stroke-width="3"/>
      <circle cx="50" cy="24" r="15" fill="#ffd9c2" stroke="#2A2547" stroke-width="3"/>
      <circle cx="42" cy="11" r="8" fill="#eef1f6" stroke="#2A2547" stroke-width="2.5"/>
      <circle cx="55" cy="23" r="2.2" fill="#2A2547"/>
      <polygon points="56,26 63,24 56,29" fill="#ff9f87"/>
      <rect x="28" y="118" width="12" height="${leftFootY - 114}" rx="4" fill="#2A2547"/>
      <rect x="60" y="118" width="12" height="${rightFootY - 114}" rx="4" fill="#2A2547"/>
      <text x="50" y="74" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="800" fill="#2A2547">${poseTag}</text>
      <text x="50" y="92" text-anchor="middle" font-family="monospace" font-size="7.2" font-weight="700" fill="#2A2547">${shortName}</text>
    </svg>`;
  }

  // ========================================================================
  // 6. SVG LOADER, ID DISCOVERY & SAFE IMPORT
  // ========================================================================

  function getSvgViewBox(svgEl, fallbackW = 100, fallbackH = 140) {
    const vb = svgEl.getAttribute('viewBox');
    if (vb) {
      const parts = vb.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) {
        return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
      }
    }
    const w = parseFloat(svgEl.getAttribute('width')) || fallbackW;
    const h = parseFloat(svgEl.getAttribute('height')) || fallbackH;
    return { x: 0, y: 0, w, h };
  }

  function discoverElementIds(svgEl) {
    return Array.from(svgEl.querySelectorAll('[id]')).map((el) => ({
      tag: el.tagName.toLowerCase(),
      id: el.id,
    }));
  }

  function scopeSvgInternals(svgRoot, prefix) {
    const reservedIds = new Set(['front-walls', 'balcony-railing', 'balcony-pergola-arch', 'zzz']);
    const idMap = new Map();

    svgRoot.querySelectorAll('defs [id], linearGradient[id], radialGradient[id], clipPath[id], mask[id], pattern[id], filter[id]').forEach((el) => {
      if (!reservedIds.has(el.id)) {
        const nextId = `${prefix}__${el.id}`;
        idMap.set(el.id, nextId);
        el.id = nextId;
      }
    });

    if (idMap.size > 0) {
      const urlAttrs = ['fill', 'stroke', 'clip-path', 'mask', 'filter', 'style'];
      const allEls = svgRoot.querySelectorAll('*');
      allEls.forEach((el) => {
        for (const attr of urlAttrs) {
          const val = el.getAttribute(attr);
          if (val && val.includes('url(#')) {
            const updated = val.replace(/url\(#([^)]+)\)/g, (m, id) =>
              idMap.has(id) ? `url(#${idMap.get(id)})` : m
            );
            el.setAttribute(attr, updated);
          }
        }
        for (const hrefAttr of ['href', 'xlink:href']) {
          const href = el.getAttribute(hrefAttr);
          if (href && href.startsWith('#')) {
            const target = href.slice(1);
            if (idMap.has(target)) el.setAttribute(hrefAttr, `#${idMap.get(target)}`);
          }
        }
      });
    }

    const classMap = new Map();
    svgRoot.querySelectorAll('style').forEach((styleEl) => {
      let css = styleEl.textContent || '';
      css = css.replace(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g, (match, cls) => {
        if (cls === 'bulb') return match;
        const scoped = `${prefix}__${cls}`;
        classMap.set(cls, scoped);
        return `.${scoped}`;
      });
      styleEl.textContent = css;
    });

    if (classMap.size > 0) {
      svgRoot.querySelectorAll('[class]').forEach((el) => {
        const clsAttr = el.getAttribute('class');
        if (!clsAttr) return;
        const next = clsAttr
          .split(/\s+/)
          .map((c) => (classMap.has(c) ? classMap.get(c) : c))
          .join(' ');
        el.setAttribute('class', next);
      });
    }
  }

  async function loadSingleSvg(key, filename) {
    let svgText = null;
    let isPlaceholder = false;

    try {
      const response = await fetch(filename, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      svgText = await response.text();
      const testDoc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
      if (testDoc.querySelector('parsererror') || !testDoc.documentElement || testDoc.documentElement.tagName.toLowerCase() !== 'svg') {
        throw new Error('Invalid SVG markup');
      }
    } catch (err) {
      console.warn(`[Assets] Failed to load "${filename}" (${err.message}); using placeholder.`);
      isPlaceholder = true;
      svgText = buildPlaceholderSvgText(key, filename);
    }

    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const svgRoot = doc.documentElement;
    const discoveredIds = discoverElementIds(svgRoot);
    scopeSvgInternals(svgRoot, key);

    return {
      key,
      filename,
      isPlaceholder,
      svgRoot,
      viewBox: getSvgViewBox(svgRoot),
      discoveredIds,
    };
  }

  async function loadAllAssets(onProgress) {
    const entries = Object.entries(ASSET_FILES);
    const total = entries.length;
    let completed = 0;

    const results = await Promise.all(
      entries.map(async ([key, filename]) => {
        const asset = await loadSingleSvg(key, filename);
        completed += 1;
        onProgress(completed, total, asset);
        return [key, asset];
      })
    );

    const assets = Object.fromEntries(results);

    const idSummary = {};
    for (const [, asset] of Object.entries(assets)) {
      idSummary[asset.filename] = asset.discoveredIds.map((item) => `${item.tag}#${item.id}`);
    }
    console.log('[Assets] Discovered element IDs via querySelectorAll("[id]"):', idSummary);

    return assets;
  }

  // ========================================================================
  // 7. MASTER SVG ASSEMBLY & DEPTH SORTING
  // ========================================================================

  const CARPET_ID_REGEX = /^(?:.*[-_])?(?:rug|mat|carpet|doormat)(?:[-_].*)?$/i;

  function isCarpetElement(el) {
    return Boolean(el && el.id && CARPET_ID_REGEX.test(el.id));
  }

  function isBedroomPlantElement(el, sourceKey) {
    if (!el) return false;
    const id = el.id || '';
    if (/bedroom.*plant|plant.*bedroom/i.test(id)) return true;
    if (sourceKey === 'furniture1') {
      if (/plant/i.test(id) && !/balcony/i.test(id)) return true;
      if (el.classList && el.classList.contains('potted-plant') && id !== 'balcony-plants') {
        return true;
      }
    }
    return false;
  }

  function importVisualChildren(svgRoot, masterDefs, targetParent) {
    for (const child of Array.from(svgRoot.children)) {
      const tag = child.tagName.toLowerCase();
      if (tag === 'defs' || tag === 'style' || tag === 'title' || tag === 'desc' || tag === 'metadata') {
        if (tag === 'defs' || tag === 'style') {
          masterDefs.appendChild(document.importNode(child, true));
        }
        continue;
      }
      targetParent.appendChild(document.importNode(child, true));
    }
  }

  function extractFurnitureGroups(svgRoot, masterDefs, depthLayer, carpetsLayer, sourceKey) {
    const visualChildren = [];
    for (const child of Array.from(svgRoot.children)) {
      const tag = child.tagName.toLowerCase();
      if (tag === 'defs' || tag === 'style') {
        masterDefs.appendChild(document.importNode(child, true));
        continue;
      }
      if (tag === 'title' || tag === 'desc' || tag === 'metadata') continue;
      visualChildren.push(child);
    }

    let itemsToMove = visualChildren;
    if (
      visualChildren.length === 1 &&
      visualChildren[0].tagName.toLowerCase() === 'g' &&
      Array.from(visualChildren[0].children).some((c) => c.tagName.toLowerCase() === 'g' && (c.id || c.classList.length > 0))
    ) {
      itemsToMove = Array.from(visualChildren[0].children);
    }

    for (const item of itemsToMove) {
      if (isBedroomPlantElement(item, sourceKey)) {
        continue;
      }
      const imported = document.importNode(item, true);

      imported.querySelectorAll('[id*="bedroom"][id*="plant"], [id*="plant"][id*="bedroom"], #bedroom-plant').forEach((n) => n.remove());
      if (sourceKey === 'furniture1') {
        imported.querySelectorAll('.potted-plant').forEach((n) => {
          if (!n.closest('#balcony-plants')) n.remove();
        });
      }

      if (isCarpetElement(imported)) {
        carpetsLayer.appendChild(imported);
      } else {
        depthLayer.appendChild(imported);
      }
    }
  }

  // Split interior partitions into backPartitionsLayer (bedroom partitions only,
  // rendered BELOW character/furniture) and frontPartitionsLayer (bathroom, hallway,
  // living, kitchen & all other partitions, rendered ABOVE bathtub, furniture and character).
  // Nested wall groups are flattened when they mix bedroom and non-bedroom walls, and
  // their parent transforms are preserved so nothing shifts visually.
  const BEDROOM_PARTITION_MIN_SCREEN_Y = 578; // Lowest floor point of a wall at/after this Y => bedroom wall

  function classifyPartitionById(el) {
    const label = `${el.id || ''} ${el.getAttribute('class') || ''}`;
    if (/bedroom/i.test(label)) return 'back';
    if (/bath|hall|living|kitchen|toilet|wc/i.test(label)) return 'front';
    return null;
  }

  function getBoxInLayer(el, layer) {
    try {
      const bbox = el.getBBox();
      if (!bbox || (bbox.width === 0 && bbox.height === 0)) return null;
      const elCtm = el.getCTM();
      const layerCtm = layer.getCTM();
      if (elCtm && layerCtm) {
        const rel = layerCtm.inverse().multiply(elCtm);
        const pts = [
          new DOMPoint(bbox.x, bbox.y).matrixTransform(rel),
          new DOMPoint(bbox.x + bbox.width, bbox.y).matrixTransform(rel),
          new DOMPoint(bbox.x, bbox.y + bbox.height).matrixTransform(rel),
          new DOMPoint(bbox.x + bbox.width, bbox.y + bbox.height).matrixTransform(rel),
        ];
        return {
          minX: Math.min(...pts.map((p) => p.x)),
          maxX: Math.max(...pts.map((p) => p.x)),
          minY: Math.min(...pts.map((p) => p.y)),
          maxY: Math.max(...pts.map((p) => p.y)),
        };
      }
      return { minX: bbox.x, maxX: bbox.x + bbox.width, minY: bbox.y, maxY: bbox.y + bbox.height };
    } catch {
      return null;
    }
  }

  function classifyPartition(el, houseLayer) {
    const byId = classifyPartitionById(el);
    if (byId) return byId;
    const box = getBoxInLayer(el, houseLayer);
    if (!box) return 'front';
    return box.maxY >= BEDROOM_PARTITION_MIN_SCREEN_Y ? 'back' : 'front';
  }

  function hasGroupEffects(el) {
    if (el.hasAttribute('clip-path') || el.hasAttribute('mask') || el.hasAttribute('filter')) return true;
    const op = el.getAttribute('opacity');
    if (op !== null && parseFloat(op) < 1) return true;
    const style = el.getAttribute('style') || '';
    return /clip-path|mask|filter|opacity/i.test(style);
  }

  function splitPartitionsIntoBackAndFront(sourceLayer, backPartitionsLayer, frontPartitionsLayer, houseLayer) {
    const SKIP_TAGS = new Set(['defs', 'style', 'title', 'desc', 'metadata']);
    const pieces = []; // { el, cls, parent }

    const collect = (el, depth) => {
      const tag = el.tagName.toLowerCase();
      if (SKIP_TAGS.has(tag)) return;

      const ownCls = classifyPartition(el, houseLayer);
      const canFlatten =
        tag === 'g' &&
        depth < 6 &&
        el.children.length > 0 &&
        !hasGroupEffects(el) &&
        !classifyPartitionById(el);

      if (canFlatten) {
        const kids = Array.from(el.children).filter((c) => !SKIP_TAGS.has(c.tagName.toLowerCase()));
        const kidClasses = kids.map((k) => classifyPartition(k, houseLayer));
        const mixed = kidClasses.some((c) => c !== kidClasses[0]);
        const isContainer = /^(interior-partitions|partition-walls|partitions?|walls?|interior-walls)$/i.test(el.id || '');
        if (mixed || (isContainer && kids.length > 0)) {
          kids.forEach((k) => collect(k, depth + 1));
          return;
        }
      }
      pieces.push({ el, cls: ownCls, parent: el.parentNode });
    };

    Array.from(sourceLayer.children).forEach((c) => collect(c, 0));

    // Pre-compute parent transforms (relative to sourceLayer) while still in the DOM
    const sourceCtm = sourceLayer.getCTM();
    for (const p of pieces) {
      p.matrix = null;
      if (p.parent !== sourceLayer && p.parent && p.parent.getCTM && sourceCtm) {
        try {
          const parentCtm = p.parent.getCTM();
          if (parentCtm) p.matrix = sourceCtm.inverse().multiply(parentCtm);
        } catch {
          p.matrix = null;
        }
      }
    }

    for (const p of pieces) {
      const target = p.cls === 'back' ? backPartitionsLayer : frontPartitionsLayer;
      if (p.matrix) {
        const m = p.matrix;
        const isIdentity = Math.abs(m.a - 1) < 1e-6 && Math.abs(m.b) < 1e-6 && Math.abs(m.c) < 1e-6 &&
          Math.abs(m.d - 1) < 1e-6 && Math.abs(m.e) < 1e-6 && Math.abs(m.f) < 1e-6;
        if (!isIdentity) {
          const wrap = createSvgEl('g', {
            class: 'partition-piece-wrap',
            transform: `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`,
          });
          wrap.appendChild(p.el);
          target.appendChild(wrap);
          continue;
        }
      }
      target.appendChild(p.el);
    }

    sourceLayer.innerHTML = '';
  }

  function buildNightGlowLayer(masterDefs) {
    const glowGrad = createSvgEl('radialGradient', { id: 'warm-lamp-glow', cx: '50%', cy: '50%', r: '50%' });
    glowGrad.appendChild(createSvgEl('stop', { offset: '0%', 'stop-color': '#ffe794', 'stop-opacity': '0.92' }));
    glowGrad.appendChild(createSvgEl('stop', { offset: '42%', 'stop-color': '#ffb04f', 'stop-opacity': '0.45' }));
    glowGrad.appendChild(createSvgEl('stop', { offset: '100%', 'stop-color': '#ff8a2b', 'stop-opacity': '0' }));
    masterDefs.appendChild(glowGrad);

    const glowLayer = createSvgEl('g', { id: 'night-glow-layer' });

    const addGlow = (loc) => {
      const p = gridToScreen(loc.x, loc.y);
      glowLayer.appendChild(
        createSvgEl('circle', {
          cx: p.x,
          cy: p.y + (loc.offsetY || 0),
          r: loc.radius,
          fill: 'url(#warm-lamp-glow)',
        })
      );
    };

    addGlow(NIGHT_GLOW_LOCATIONS.bedsideLamp);
    addGlow(NIGHT_GLOW_LOCATIONS.floorLamp);
    for (const pt of NIGHT_GLOW_LOCATIONS.balconyLights) {
      addGlow(pt);
    }

    return glowLayer;
  }

  function computeElementSortY(el, depthLayer) {
    try {
      const bbox = el.getBBox();
      if (!bbox || (bbox.width === 0 && bbox.height === 0)) return 0;

      const elCtm = el.getCTM();
      const layerCtm = depthLayer.getCTM();
      if (elCtm && layerCtm) {
        const rel = layerCtm.inverse().multiply(elCtm);
        const corners = [
          new DOMPoint(bbox.x, bbox.y).matrixTransform(rel),
          new DOMPoint(bbox.x + bbox.width, bbox.y).matrixTransform(rel),
          new DOMPoint(bbox.x, bbox.y + bbox.height).matrixTransform(rel),
          new DOMPoint(bbox.x + bbox.width, bbox.y + bbox.height).matrixTransform(rel),
        ];
        return Math.max(...corners.map((p) => p.y));
      }
      return bbox.y + bbox.height;
    } catch {
      return 0;
    }
  }

  // Links each furniture group in #depth-layer to a collision footprint (by id/class name,
  // otherwise by on-screen position), so depth can be decided with real isometric geometry.
  function matchFootprintForElement(el, box) {
    const label = `${el.id || ''} ${el.getAttribute('class') || ''}`;
    for (const m of FOOTPRINT_MATCHERS) {
      if (m.re.test(label) && !(m.not && m.not.test(label))) {
        return COLLISION.footprints.find((f) => f.id === m.id) || null;
      }
    }
    if (!box) return null;

    let best = null;
    let bestDist = Infinity;
    const cx = (box.minX + box.maxX) / 2;
    const width = box.maxX - box.minX;
    for (const f of COLLISION.footprints) {
      if (f.blocker) continue;
      const bottom = gridToScreen(f.x2, f.y2);
      const left = gridToScreen(f.x1, f.y2).x;
      const right = gridToScreen(f.x2, f.y1).x;
      const fcx = (left + right) / 2;
      if (width > (right - left) * 1.8 + 30) continue;
      const d = Math.hypot(cx - fcx, box.maxY - bottom.y);
      if (d < bestDist && d < 48) {
        bestDist = d;
        best = f;
      }
    }
    return best;
  }

  // Isometric depth relation between the character point (px, py) and a footprint box.
  // Returns +1 when the character is in front of the box, -1 when behind.
  function relationToFootprint(px, py, f) {
    const front = px >= f.x2 || py >= f.y2;
    const behind = px <= f.x1 || py <= f.y1;
    if (front && !behind) return 1;
    if (behind && !front) return -1;
    return px + py >= (f.x1 + f.x2 + f.y1 + f.y2) / 2 ? 1 : -1;
  }

  // ========================================================================
  // 8. COLLISION MATH (Circle vs Segments & Footprints with Wall Sliding)
  // ========================================================================

  function closestPointOnSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return { x: x1, y: y1 };
    const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
    return { x: x1 + t * dx, y: y1 + t * dy };
  }

  function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
    const ccw = (p1x, p1y, p2x, p2y, p3x, p3y) =>
      (p3y - p1y) * (p2x - p1x) > (p2y - p1y) * (p3x - p1x);
    return (
      ccw(ax, ay, cx, cy, dx, dy) !== ccw(bx, by, cx, cy, dx, dy) &&
      ccw(ax, ay, bx, by, cx, cy) !== ccw(ax, ay, bx, by, dx, dy)
    );
  }

  function doesSegmentCrossPartition(x1, y1, x2, y2) {
    for (const w of COLLISION.partitionWalls) {
      if (segmentsIntersect(x1, y1, x2, y2, w.x1, w.y1, w.x2, w.y2)) {
        return true;
      }
    }
    return false;
  }

  function resolveCircleCollisions(cx, cy) {
    const r = COLLISION.charRadius;
    const halfWall = COLLISION.wallThickness / 2;
    let x = cx;
    let y = cy;

    for (let iter = 0; iter < 6; iter++) {
      x = clamp(x, r, 12 - r);
      y = clamp(y, r, 15 - r);
      if (y > 12 && x > 6) {
        if (x - 6 < y - 12) x = 6 - r;
        else y = 12 - r;
      }

      for (const seg of COLLISION.outerWalls) {
        const pt = closestPointOnSegment(x, y, seg.x1, seg.y1, seg.x2, seg.y2);
        const dx = x - pt.x;
        const dy = y - pt.y;
        const dist = Math.hypot(dx, dy);
        if (dist < r) {
          if (dist > 1e-6) {
            const push = r - dist;
            x += (dx / dist) * push;
            y += (dy / dist) * push;
          } else {
            x += r;
          }
        }
      }

      const wallMinDist = r + halfWall;
      for (const wall of COLLISION.partitionWalls) {
        const pt = closestPointOnSegment(x, y, wall.x1, wall.y1, wall.x2, wall.y2);
        const dx = x - pt.x;
        const dy = y - pt.y;
        const dist = Math.hypot(dx, dy);
        if (dist < wallMinDist) {
          if (dist > 1e-6) {
            const push = wallMinDist - dist;
            x += (dx / dist) * push;
            y += (dy / dist) * push;
          } else {
            if (Math.abs(wall.x2 - wall.x1) >= Math.abs(wall.y2 - wall.y1)) {
              y += wallMinDist;
            } else {
              x += wallMinDist;
            }
          }
        }
      }

      for (const box of COLLISION.footprints) {
        const px = clamp(x, box.x1, box.x2);
        const py = clamp(y, box.y1, box.y2);
        const dx = x - px;
        const dy = y - py;
        const dist = Math.hypot(dx, dy);
        if (dist < r) {
          if (dist > 1e-6) {
            const push = r - dist;
            x += (dx / dist) * push;
            y += (dy / dist) * push;
          } else {
            const dl = Math.abs(x - box.x1);
            const dr = Math.abs(box.x2 - x);
            const dt = Math.abs(y - box.y1);
            const db = Math.abs(box.y2 - y);
            const m = Math.min(dl, dr, dt, db);
            if (m === dl) x = box.x1 - r;
            else if (m === dr) x = box.x2 + r;
            else if (m === dt) y = box.y1 - r;
            else y = box.y2 + r;
          }
        }
      }
    }

    return { x, y };
  }

  // Sub-stepped movement so the character glides smoothly along walls and can never cross a partition
  function moveWithSubsteps(startX, startY, dx, dy) {
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-7) return { x: startX, y: startY };

    const steps = Math.max(1, Math.ceil(dist / MAX_COLLISION_SUBSTEP));
    const stepDx = dx / steps;
    const stepDy = dy / steps;

    let x = startX;
    let y = startY;
    for (let i = 0; i < steps; i++) {
      // Try the full step, then each axis alone, so the character slides along walls
      // instead of stopping dead — but never crosses a partition.
      const attempts = [
        [stepDx, stepDy],
        [stepDx, 0],
        [0, stepDy],
      ];
      let moved = false;
      for (const [ax, ay] of attempts) {
        if (Math.abs(ax) < 1e-9 && Math.abs(ay) < 1e-9) continue;
        const next = resolveCircleCollisions(x + ax, y + ay);
        if (doesSegmentCrossPartition(x, y, next.x, next.y)) continue;
        if (Math.hypot(next.x - x, next.y - y) < 1e-7) continue;
        x = next.x;
        y = next.y;
        moved = true;
        break;
      }
      if (!moved) break;
    }
    return { x, y };
  }

  function isPositionFree(x, y) {
    const resolved = resolveCircleCollisions(x, y);
    return Math.hypot(resolved.x - x, resolved.y - y) < 0.015;
  }

  function findNearestFreeSpotOutside(footprintId, refX, refY) {
    const box = COLLISION.footprints.find((f) => f.id === footprintId);
    if (!box) return { x: refX, y: refY };

    const margin = COLLISION.charRadius + 0.14;
    const candidates = [];
    const step = 0.25;

    for (let gx = box.x1 - margin; gx <= box.x2 + margin + 1e-4; gx += step) {
      candidates.push({ x: gx, y: box.y1 - margin });
      candidates.push({ x: gx, y: box.y2 + margin });
    }
    for (let gy = box.y1; gy <= box.y2 + 1e-4; gy += step) {
      candidates.push({ x: box.x1 - margin, y: gy });
      candidates.push({ x: box.x2 + margin, y: gy });
    }

    candidates.sort((a, b) => Math.hypot(a.x - refX, a.y - refY) - Math.hypot(b.x - refX, b.y - refY));

    for (const c of candidates) {
      if (isPositionFree(c.x, c.y) && !doesSegmentCrossPartition(refX, refY, c.x, c.y)) {
        return c;
      }
    }

    return resolveCircleCollisions(refX, refY);
  }

  // ========================================================================
  // 9. DEBUG OVERLAY BUILDER (Toggled with D key)
  // ========================================================================

  function buildDebugLayer() {
    const layer = createSvgEl('g', { id: 'debug-layer', class: 'hidden' });

    for (let i = 0; i <= 12; i++) {
      const a = gridToScreen(i, 0);
      const b = gridToScreen(i, i <= 6 ? 15 : 12);
      layer.appendChild(createSvgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: 'rgba(255,255,255,0.16)', 'stroke-width': 1 }));
      const c = gridToScreen(0, i);
      const d = gridToScreen(12, i);
      layer.appendChild(createSvgEl('line', { x1: c.x, y1: c.y, x2: d.x, y2: d.y, stroke: 'rgba(255,255,255,0.16)', 'stroke-width': 1 }));
    }
    for (let y = 13; y <= 15; y++) {
      const c = gridToScreen(0, y);
      const d = gridToScreen(6, y);
      layer.appendChild(createSvgEl('line', { x1: c.x, y1: c.y, x2: d.x, y2: d.y, stroke: 'rgba(255,255,255,0.16)', 'stroke-width': 1 }));
    }

    for (const seg of COLLISION.outerWalls) {
      const a = gridToScreen(seg.x1, seg.y1);
      const b = gridToScreen(seg.x2, seg.y2);
      layer.appendChild(createSvgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: '#3fe0ff', 'stroke-width': 3, 'stroke-dasharray': '6 4' }));
    }

    const hw = COLLISION.wallThickness / 2;
    for (const w of COLLISION.partitionWalls) {
      const isHoriz = Math.abs(w.y2 - w.y1) < Math.abs(w.x2 - w.x1);
      const x1 = isHoriz ? w.x1 : w.x1 - hw;
      const x2 = isHoriz ? w.x2 : w.x2 + hw;
      const y1 = isHoriz ? w.y1 - hw : w.y1;
      const y2 = isHoriz ? w.y2 + hw : w.y2;
      layer.appendChild(
        createSvgEl('polygon', {
          points: isoPolyPoints(x1, y1, x2, y2),
          fill: 'rgba(255, 110, 64, 0.38)',
          stroke: '#ff6e40',
          'stroke-width': 2,
        })
      );
    }

    for (const f of COLLISION.footprints) {
      if (f.interactive) {
        layer.appendChild(
          createSvgEl('polygon', {
            points: isoPolyPoints(
              f.x1 - INTERACTION_EXPAND,
              f.y1 - INTERACTION_EXPAND,
              f.x2 + INTERACTION_EXPAND,
              f.y2 + INTERACTION_EXPAND
            ),
            fill: 'rgba(89, 240, 194, 0.14)',
            stroke: '#59f0c2',
            'stroke-width': 2,
            'stroke-dasharray': '7 5',
          })
        );
      }

      layer.appendChild(
        createSvgEl('polygon', {
          points: isoPolyPoints(f.x1, f.y1, f.x2, f.y2),
          fill: f.blocker ? 'rgba(170, 120, 255, 0.22)' : 'rgba(255, 68, 138, 0.25)',
          stroke: f.blocker ? '#aa78ff' : '#ff448a',
          'stroke-width': 2,
          'stroke-dasharray': f.blocker ? '4 3' : 'none',
        })
      );

      const center = gridToScreen((f.x1 + f.x2) / 2, (f.y1 + f.y2) / 2);
      layer.appendChild(
        createSvgEl(
          'text',
          {
            x: center.x,
            y: center.y + 4,
            'text-anchor': 'middle',
            'font-family': 'monospace',
            'font-size': 10,
            'font-weight': 700,
            fill: '#ffffff',
            stroke: '#18162b',
            'stroke-width': 2.5,
            'paint-order': 'stroke',
          },
          f.id
        )
      );
    }

    const charCircle = createSvgEl('polygon', {
      id: 'debug-char-circle',
      fill: 'rgba(255, 232, 92, 0.28)',
      stroke: '#ffe85c',
      'stroke-width': 2.2,
    });
    const charDot = createSvgEl('circle', {
      id: 'debug-char-dot',
      r: 3.5,
      fill: '#ffe85c',
      stroke: '#18162b',
      'stroke-width': 1.2,
    });

    layer.appendChild(charCircle);
    layer.appendChild(charDot);
    return layer;
  }

  function updateDebugCharacter(x, y) {
    const poly = document.getElementById('debug-char-circle');
    const dot = document.getElementById('debug-char-dot');
    const coordsLabel = document.getElementById('debug-coords');
    if (!poly || !dot) return;

    const pts = [];
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const p = gridToScreen(
        x + Math.cos(a) * COLLISION.charRadius,
        y + Math.sin(a) * COLLISION.charRadius
      );
      pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    }
    poly.setAttribute('points', pts.join(' '));

    const feet = gridToScreen(x, y);
    dot.setAttribute('cx', feet.x.toFixed(1));
    dot.setAttribute('cy', feet.y.toFixed(1));

    if (coordsLabel) {
      coordsLabel.textContent = `x: ${x.toFixed(2)}, y: ${y.toFixed(2)}`;
    }
  }

  // ========================================================================
  // 10. MAIN GAME CONTROLLER
  // ========================================================================

  const SKY_PHASES = [
    { id: 'day', label: 'Daytime', icon: '☀️', className: 'time-day', durationMs: SKY_INTERVAL_MS },
    { id: 'sunset', label: 'Sunset', icon: '🌇', className: 'time-sunset', durationMs: SKY_INTERVAL_MS },
    { id: 'night', label: 'Night', icon: '🌙', className: 'time-night', durationMs: SKY_INTERVAL_MS },
  ];

  // ========================================================================
  // 10b. SESSION STORAGE HELPERS (localStorage, fail-safe)
  // ========================================================================

  function loadSessions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveSessions(arr) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(-MAX_STORED_SESSIONS)));
      return true;
    } catch (err) {
      console.warn('[Session] Could not save to localStorage:', err);
      return false;
    }
  }

  function readLastPlayer() {
    try {
      return localStorage.getItem(LAST_PLAYER_KEY) || '';
    } catch {
      return '';
    }
  }

  function writeLastPlayer(name) {
    try {
      localStorage.setItem(LAST_PLAYER_KEY, name);
    } catch {
      /* ignore */
    }
  }

  function formatDuration(ms) {
    const totalSec = Math.round((ms || 0) / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
  }

  function formatClock(ms) {
    const totalSec = Math.floor((ms || 0) / 1000);
    return `${String(Math.floor(totalSec / 60)).padStart(2, '0')}:${String(totalSec % 60).padStart(2, '0')}`;
  }

  // Room lookup in grid space (matches the apartment layout used by the collision map)
  function roomAt(x, y) {
    if (y >= 12) return 'Balcony';
    if (y < 4.5 && x < 6) return 'Bathroom';
    if (y >= 4.5 && y < 6.5 && x < 7) return 'Hallway';
    if (x >= 6 && y < 6.5) return 'Kitchen';
    if (x >= 6 && x < 7.25 && y < 8.7) return 'Hallway';
    if (x < 6.5) return 'Living Room';
    return 'Bedroom';
  }

  const SLEEP_ROOM = { sofa: 'Living Room', bed: 'Bedroom' };

  async function initGame() {
    const loadingScreen = document.getElementById('loading-screen');
    const loadingBarFill = document.getElementById('loading-bar-fill');
    const loadingStatus = document.getElementById('loading-status');
    const loadingErrors = document.getElementById('loading-errors');
    const loadingErrorList = document.getElementById('loading-error-list');
    const continueBtn = document.getElementById('continue-placeholder-btn');
    const placeholderToast = document.getElementById('placeholder-toast');
    const dismissToastBtn = document.getElementById('dismiss-toast-btn');

    const masterSvg = document.getElementById('master-svg');
    const floatingPrompt = document.getElementById('floating-prompt');
    const skyHudIcon = document.getElementById('sky-hud-icon');
    const skyHudLabel = document.getElementById('sky-hud-label');
    const skyProgressFill = document.getElementById('sky-progress-fill');
    const skyHudDay = document.getElementById('sky-hud-day');
    const debugHud = document.getElementById('debug-hud');
    const touchActionBtn = document.getElementById('touch-action-btn');

    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      document.body.classList.add('is-touch');
    }
    window.addEventListener(
      'touchstart',
      () => document.body.classList.add('is-touch'),
      { once: true, passive: true }
    );

    const assets = await loadAllAssets((done, total) => {
      loadingBarFill.style.width = `${Math.round((done / total) * 100)}%`;
      loadingStatus.textContent = `Loaded SVG layers (${done} / ${total})`;
    });

    const failedAssets = Object.values(assets).filter((a) => a.isPlaceholder);

    const masterDefs = createSvgEl('defs');
    masterSvg.appendChild(masterDefs);

    const skyLayer = createSvgEl('g', { id: 'sky-layer' });
    const skyDayGroup = createSvgEl('g', { id: 'sky-day', class: 'sky-variant' });
    const skySunsetGroup = createSvgEl('g', { id: 'sky-sunset', class: 'sky-variant' });
    const skyNightGroup = createSvgEl('g', { id: 'sky-night', class: 'sky-variant' });
    importVisualChildren(assets.skyDay.svgRoot, masterDefs, skyDayGroup);
    importVisualChildren(assets.skySunset.svgRoot, masterDefs, skySunsetGroup);
    importVisualChildren(assets.skyNight.svgRoot, masterDefs, skyNightGroup);
    skyLayer.append(skyDayGroup, skySunsetGroup, skyNightGroup);
    masterSvg.appendChild(skyLayer);

    // Layer order inside #house-layer:
    // structure -> carpets -> back-partitions (bedroom only, BELOW grandma) -> depth-layer (furniture + grandma)
    // -> front-partitions (bathroom, hallway, living, kitchen walls: ALWAYS ABOVE grandma & bathtub) -> front-layer
    const houseLayer = createSvgEl('g', { id: 'house-layer' });
    const structureLayer = createSvgEl('g', { id: 'structure-layer' });
    const carpetsLayer = createSvgEl('g', { id: 'carpets-layer' });
    const rawPartitionsLayer = createSvgEl('g', { id: 'partitions-raw-layer' });
    const backPartitionsLayer = createSvgEl('g', { id: 'back-partitions-layer' });
    const depthLayer = createSvgEl('g', { id: 'depth-layer' });
    const frontPartitionsLayer = createSvgEl('g', { id: 'front-partitions-layer' });
    const frontLayer = createSvgEl('g', { id: 'front-layer' });

    importVisualChildren(assets.structure.svgRoot, masterDefs, structureLayer);
    importVisualChildren(assets.partitions.svgRoot, masterDefs, rawPartitionsLayer);

    // Delete white room title bubbles (#room-labels / .room-pill)
    structureLayer.querySelectorAll('#room-labels, .room-pill').forEach((el) => el.remove());

    // Keep partition blocks exclusively from partitions SVG unless structure had the only ones
    const hasPartitionsInLayer = Boolean(
      rawPartitionsLayer.querySelector('#partition-walls, .partition-block, #interior-partitions')
    );
    structureLayer.querySelectorAll('.partition-block').forEach((block) => {
      if (hasPartitionsInLayer) {
        block.remove();
      } else {
        rawPartitionsLayer.appendChild(block);
      }
    });

    // Move balcony pergola arch, front-walls, and balcony-railing to frontLayer
    for (const id of ['balcony-pergola-arch', 'front-walls', 'balcony-railing']) {
      const fromPartitions = rawPartitionsLayer.querySelector(`#${id}`);
      const fromStructure = structureLayer.querySelector(`#${id}`);
      const found = fromPartitions || fromStructure;
      if (found) {
        frontLayer.appendChild(found);
      }
    }

    extractFurnitureGroups(assets.furniture1.svgRoot, masterDefs, depthLayer, carpetsLayer, 'furniture1');
    extractFurnitureGroups(assets.furniture2.svgRoot, masterDefs, depthLayer, carpetsLayer, 'furniture2');
    extractFurnitureGroups(assets.furniture3.svgRoot, masterDefs, depthLayer, carpetsLayer, 'furniture3');

    // Pre-load all 5 character pose SVGs inside #grandma-character (zero flicker)
    const characterGroup = createSvgEl('g', { id: 'grandma-character' });
    const characterPoseWrap = createSvgEl('g', { id: 'grandma-pose-wrap' });
    const characterBreatheWrap = createSvgEl('g', { id: 'grandma-breathe-wrap', class: 'breathe-target' });
    characterPoseWrap.appendChild(characterBreatheWrap);
    characterGroup.appendChild(characterPoseWrap);
    depthLayer.appendChild(characterGroup);

    const poseMap = {
      standing: assets.grandmaStanding,
      'walk-1': assets.grandmaWalk1,
      'walk-2': assets.grandmaWalk2,
      sleeping: assets.grandmaSleeping,
      fallen: assets.grandmaFallen,
    };

    const poseNodes = {};
    for (const [poseName, asset] of Object.entries(poseMap)) {
      const g = createSvgEl('g', {
        class: 'pose-group',
        'data-pose': poseName,
        style: 'display: none',
      });
      importVisualChildren(asset.svgRoot, masterDefs, g);

      if (poseName === 'sleeping') {
        const zzzEl = g.querySelector('#zzz');
        if (zzzEl && zzzEl.parentNode) {
          const zzzWrap = createSvgEl('g', {
            class: 'zzz-float-wrap',
            style: `--zzz-rise: ${(-0.26 * asset.viewBox.h).toFixed(1)}px`,
          });
          zzzEl.parentNode.insertBefore(zzzWrap, zzzEl);
          zzzWrap.appendChild(zzzEl);
        }
      }

      characterBreatheWrap.appendChild(g);
      poseNodes[poseName] = { node: g, viewBox: asset.viewBox };
    }

    houseLayer.append(
      structureLayer,
      carpetsLayer,
      rawPartitionsLayer,
      backPartitionsLayer,
      depthLayer,
      frontPartitionsLayer,
      frontLayer
    );
    // Scaled wrapper for everything that belongs to the house (house, night glows, debug overlay)
    const sceneWrap = createSvgEl('g', {
      id: 'scene-wrap',
      transform: `translate(${HOUSE_OFFSET.x.toFixed(2)}, ${HOUSE_OFFSET.y.toFixed(2)}) scale(${HOUSE_SCALE})`,
    });
    masterSvg.appendChild(sceneWrap);
    sceneWrap.appendChild(houseLayer);

    // Now that #house-layer is in the DOM, split partitions accurately via getBBox()
    splitPartitionsIntoBackAndFront(rawPartitionsLayer, backPartitionsLayer, frontPartitionsLayer, houseLayer);
    rawPartitionsLayer.remove();

    sceneWrap.appendChild(buildNightGlowLayer(masterDefs));

    const debugLayer = buildDebugLayer();
    sceneWrap.appendChild(debugLayer);

    // Cache furniture depth data once after loading: screen box, sort Y and matched footprint.
    // Furniture is put into a fixed back-to-front order; only the character moves within it.
    const furnitureItems = [];
    for (const child of Array.from(depthLayer.children)) {
      if (child === characterGroup) continue;
      const box = getBoxInLayer(child, depthLayer);
      furnitureItems.push({
        el: child,
        box,
        sortY: box ? box.maxY : computeElementSortY(child, depthLayer),
        footprint: matchFootprintForElement(child, box),
      });
    }
    furnitureItems.sort((a, b) => a.sortY - b.sortY);
    for (const item of furnitureItems) depthLayer.appendChild(item.el);
    depthLayer.appendChild(characterGroup);
    console.log(
      '[Depth] Furniture ↔ footprint links:',
      furnitureItems.map((i) => `${i.el.id || '(no id)'} → ${i.footprint ? i.footprint.id : 'screen-Y'}`)
    );

    const findItemFor = (footprintId) => furnitureItems.find((i) => i.footprint && i.footprint.id === footprintId) || null;
    const sofaItem = findItemFor('sofa');
    const bedItem = findItemFor('bed');

    // Character on-screen size (for overlap tests during depth sorting)
    const standingVb = assets.grandmaStanding.viewBox;
    const CHAR_HEIGHT_PX = CHAR_WIDTH_PX * (standingVb.h / standingVb.w);

    const state = {
      x: START_POS.x,
      y: START_POS.y,
      vx: 0,
      vy: 0,
      facingLeft: false,
      pose: 'standing',
      walkFrameIndex: 0,
      walkTimerMs: 0,
      walkGraceMs: 0,
      sleepingTarget: null, // null | 'sofa' | 'bed'
      preSleepPos: { x: START_POS.x, y: START_POS.y },
      activeZone: null, // null | 'sofa' | 'bed'
      debug: false,
      skyIndex: 0,
      skyElapsedMs: 0,
      dayIndex: 0, // 0-based day of the current session
      paused: false,
      phase: 'loading', // 'loading' | 'start' | 'playing' | 'results'
      currentRoom: null,
    };

    const keysDown = new Set();
    const touchDirs = { up: false, down: false, left: false, right: false };

    // ======================================================================
    // POSE & CHARACTER RENDERING
    // ======================================================================

    function applyPoseTransform(poseName) {
      const entry = poseNodes[poseName];
      if (!entry) return;
      const vb = entry.viewBox;

      if (poseName === 'sleeping') {
        const target = state.sleepingTarget || 'sofa';
        const targetWidth = SLEEP_SIZES[target] || 150;
        const scale = targetWidth / vb.w;
        const cx = vb.x + vb.w / 2;
        const cy = vb.y + vb.h / 2;
        characterPoseWrap.setAttribute(
          'transform',
          `scale(${scale.toFixed(4)}, ${scale.toFixed(4)}) translate(${(-cx).toFixed(2)}, ${(-cy).toFixed(2)})`
        );
      } else {
        const scale = CHAR_WIDTH_PX / vb.w;
        const flipX = state.facingLeft ? -1 : 1;
        const footX = vb.x + vb.w / 2;
        const footY = vb.y + vb.h;
        characterPoseWrap.setAttribute(
          'transform',
          `scale(${(flipX * scale).toFixed(4)}, ${scale.toFixed(4)}) translate(${(-footX).toFixed(2)}, ${(-footY).toFixed(2)})`
        );
      }
    }

    function setPose(poseName) {
      const normalized = poseMap[poseName] ? poseName : 'standing';
      state.pose = normalized;
      for (const [name, entry] of Object.entries(poseNodes)) {
        entry.node.style.display = name === normalized ? '' : 'none';
      }
      characterGroup.classList.toggle('is-sleeping', normalized === 'sleeping');
      applyPoseTransform(normalized);
    }

    // ======================================================================
    // RIGHT SIDE PANEL (Alerts & Tasks) — empty for now, ready for entries
    // ======================================================================

    const sidePanel = document.getElementById('side-panel');
    const panelLists = {
      alerts: {
        list: document.getElementById('alerts-list'),
        count: document.getElementById('alerts-count'),
      },
      tasks: {
        list: document.getElementById('tasks-list'),
        count: document.getElementById('tasks-count'),
      },
    };

    function refreshPanelCount(section) {
      const entry = panelLists[section];
      if (!entry || !entry.count) return;
      const n = entry.list.querySelectorAll('.panel-item:not(.is-leaving)').length;
      if (entry.count.textContent !== String(n)) {
        entry.count.textContent = String(n);
        entry.count.classList.remove('bump');
        void entry.count.offsetWidth; // restart bump animation
        entry.count.classList.add('bump');
      }
    }

    function addPanelItem(section, text) {
      const entry = panelLists[section];
      if (!entry || !entry.list) return null;
      const li = document.createElement('li');
      li.className = 'panel-item';
      li.textContent = text;
      entry.list.appendChild(li);
      refreshPanelCount(section);
      return li;
    }

    function removePanelItem(section, li) {
      if (!li || !li.parentNode) return;
      li.classList.add('is-leaving');
      refreshPanelCount(section);
      li.addEventListener('animationend', () => li.remove(), { once: true });
    }

    function clearPanelSection(section) {
      const entry = panelLists[section];
      if (!entry || !entry.list) return;
      entry.list.querySelectorAll('.panel-item').forEach((li) => removePanelItem(section, li));
    }

    function showSidePanel() {
      if (sidePanel) sidePanel.classList.add('is-visible');
    }

    const panelApi = {
      addAlert: (text) => addPanelItem('alerts', text),
      addTask: (text) => addPanelItem('tasks', text),
      removeAlert: (li) => removePanelItem('alerts', li),
      removeTask: (li) => removePanelItem('tasks', li),
      clearAlerts: () => clearPanelSection('alerts'),
      clearTasks: () => clearPanelSection('tasks'),
    };

    // ======================================================================
    // SESSION LOGGING (player login, per-day stats, event log → localStorage)
    // ======================================================================

    let session = null;
    let autosaveTimerMs = 0;

    function newDayStats(dayNumber) {
      return {
        day: dayNumber,
        sleepMs: 0,
        nightSleepMs: 0,
        sleepByMs: { sofa: 0, bed: 0 },
        sleeps: 0,
        distanceTiles: 0,
        roomMs: {},
      };
    }

    function currentDayStats() {
      return session ? session.days[session.days.length - 1] : null;
    }

    function logEvent(type, detail) {
      if (!session) return;
      session.events.push({
        t: Math.round(session.elapsedMs),
        day: state.dayIndex + 1,
        sky: SKY_PHASES[state.skyIndex].id,
        type,
        detail,
        x: Number(state.x.toFixed(2)),
        y: Number(state.y.toFixed(2)),
      });
    }

    function persistSession() {
      if (!session) return false;
      const all = loadSessions();
      const i = all.findIndex((s) => s.id === session.id);
      if (i >= 0) all[i] = session;
      else all.push(session);
      return saveSessions(all);
    }

    function startSession(player) {
      session = {
        id: `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        player,
        startedAt: new Date().toISOString(),
        endedAt: null,
        completed: false,
        config: { totalDays: TOTAL_DAYS, skySeconds: SKY_INTERVAL_MS / 1000 },
        elapsedMs: 0,
        days: [newDayStats(1)],
        events: [],
      };
      state.currentRoom = roomAt(state.x, state.y);
      logEvent('session-start', `${player} logged in and started the session`);
      logEvent('day-start', 'Day 1 began');
      persistSession();
    }

    function trackSessionFrame(dtMs) {
      const day = currentDayStats();
      if (!day) return;
      session.elapsedMs += dtMs;

      if (state.sleepingTarget) {
        day.sleepMs += dtMs;
        day.sleepByMs[state.sleepingTarget] += dtMs;
        if (SKY_PHASES[state.skyIndex].id === 'night') day.nightSleepMs += dtMs;
      }

      const room = state.sleepingTarget ? SLEEP_ROOM[state.sleepingTarget] : roomAt(state.x, state.y);
      day.roomMs[room] = (day.roomMs[room] || 0) + dtMs;
      if (room !== state.currentRoom) {
        state.currentRoom = room;
        logEvent('enter-room', `Entered the ${room}`);
      }

      autosaveTimerMs += dtMs;
      if (autosaveTimerMs >= AUTOSAVE_INTERVAL_MS) {
        autosaveTimerMs = 0;
        persistSession();
      }
    }

    window.addEventListener('beforeunload', () => {
      if (session && !session.completed) persistSession();
    });

    window.setPose = setPose;
    window.GrandmaGame = {
      setPose,
      state,
      COLLISION,
      panel: panelApi,
      getSession: () => session,
      getAllSessions: loadSessions,
    };

    function renderCharacterPosition() {
      let drawX = state.x;
      let drawY = state.y;

      if (state.sleepingTarget) {
        const spot = SLEEP_SPOTS[state.sleepingTarget];
        drawX = spot.x;
        drawY = spot.y;
      }

      const screen = gridToScreen(drawX, drawY);
      characterGroup.setAttribute(
        'transform',
        `translate(${screen.x.toFixed(2)}, ${screen.y.toFixed(2)})`
      );
      updateDebugCharacter(state.x, state.y);
      return screen;
    }

    // Bathroom special rules on top of the geometric relation:
    // - Bathtub: character is only ever behind it in the LEFT corner (x < tub.x1, y < tub.y2).
    // - Sink: character is only ever behind it in the RIGHT corner (x > sink.x2, y < sink.y2);
    //   everywhere else in the bathroom she is always in front of the sink.
    function relationForItem(item, px, py, charScreenY) {
      const f = item.footprint;
      if (!f) {
        return charScreenY >= item.sortY ? 1 : -1;
      }
      if (f.id === 'sink') {
        const inRightCorner = px >= f.x2 - 0.02 && py <= f.y2 + 0.05;
        return inRightCorner ? -1 : 1;
      }
      if (f.id === 'bathtub') {
        const inLeftCorner = px <= f.x1 + 0.02 && py <= f.y2 + 0.05;
        return inLeftCorner ? -1 : 1;
      }
      return relationToFootprint(px, py, f);
    }

    let lastCharIndex = -1;

    function placeCharacterAt(index) {
      if (index === lastCharIndex && characterGroup.parentNode === depthLayer) return;
      const before = furnitureItems[index] ? furnitureItems[index].el : null;
      if (characterGroup.nextSibling !== before || characterGroup.parentNode !== depthLayer) {
        depthLayer.insertBefore(characterGroup, before);
      }
      lastCharIndex = index;
    }

    function sortDepthLayer(charScreenY) {
      const n = furnitureItems.length;

      if (state.sleepingTarget) {
        const target = state.sleepingTarget === 'sofa' ? sofaItem : bedItem;
        placeCharacterAt(target ? furnitureItems.indexOf(target) + 1 : n);
        return;
      }

      const px = state.x;
      const py = state.y;
      const feet = gridToScreen(px, py);
      const cMinX = feet.x - CHAR_WIDTH_PX * 0.42;
      const cMaxX = feet.x + CHAR_WIDTH_PX * 0.42;
      const cMinY = feet.y - CHAR_HEIGHT_PX;
      const cMaxY = feet.y + 4;

      // Only furniture that visually overlaps the character constrains her slot:
      // lo = after every overlapping item she's in front of, hi = before every one she's behind.
      let lo = 0;
      let hi = n;
      for (let i = 0; i < n; i++) {
        const item = furnitureItems[i];
        const b = item.box;
        if (!b) continue;
        const overlaps = b.maxX > cMinX && b.minX < cMaxX && b.maxY > cMinY && b.minY < cMaxY;
        if (!overlaps) continue;
        if (relationForItem(item, px, py, charScreenY) > 0) {
          lo = Math.max(lo, i + 1);
        } else {
          hi = Math.min(hi, i);
        }
      }

      // Default slot from plain screen depth, clamped into the allowed range
      let k = 0;
      while (k < n && furnitureItems[k].sortY <= charScreenY) k++;
      if (lo > hi) {
        k = lo; // Being in front of nearby furniture wins (prevents "walking over" it)
      } else {
        k = clamp(k, lo, hi);
      }
      placeCharacterAt(k);
    }

    // ======================================================================
    // SOFA & BED INTERACTION
    // ======================================================================

    const interactiveFootprints = COLLISION.footprints.filter((f) => f.interactive);

    // Compact "Space · Sleep" popup (inline !important so it overrides the stylesheet)
    const compactPromptStyles = {
      'font-size': '10px',
      'line-height': '1.2',
      padding: '2px 7px',
      'border-radius': '7px',
      'border-width': '1px',
      'min-width': '0',
      'min-height': '0',
      width: 'auto',
      height: 'auto',
      'letter-spacing': '0.02em',
      'font-weight': '700',
      'white-space': 'nowrap',
      'box-shadow': '0 1px 4px rgba(0, 0, 0, 0.25)',
    };
    for (const [prop, val] of Object.entries(compactPromptStyles)) {
      floatingPrompt.style.setProperty(prop, val, 'important');
    }

    function detectInteractionZone(x, y) {
      for (const f of interactiveFootprints) {
        if (
          x >= f.x1 - INTERACTION_EXPAND &&
          x <= f.x2 + INTERACTION_EXPAND &&
          y >= f.y1 - INTERACTION_EXPAND &&
          y <= f.y2 + INTERACTION_EXPAND
        ) {
          return f.interactive;
        }
      }
      return null;
    }

    function updatePromptUI() {
      const target = state.sleepingTarget || state.activeZone;
      if (!target) {
        if (!floatingPrompt.classList.contains('hidden')) {
          floatingPrompt.classList.add('hidden');
        }
        touchActionBtn.disabled = true;
        touchActionBtn.textContent = 'Sleep';
        return;
      }

      const spot = SLEEP_SPOTS[target];
      const screen = houseToStage(gridToScreen(spot.x, spot.y));
      const yOffsetPx = (target === 'sofa' ? 40 : 34) * HOUSE_SCALE;

      floatingPrompt.style.left = `${(screen.x / SCENE_WIDTH) * 100}%`;
      floatingPrompt.style.top = `${((screen.y - yOffsetPx) / SCENE_HEIGHT) * 100}%`;

      const desiredText = state.sleepingTarget ? 'Space · Wake' : 'Space · Sleep';
      if (floatingPrompt.textContent !== desiredText) {
        floatingPrompt.textContent = desiredText;
      }
      if (floatingPrompt.classList.contains('hidden')) {
        floatingPrompt.classList.remove('hidden');
      }

      touchActionBtn.disabled = false;
      touchActionBtn.textContent = state.sleepingTarget ? 'Wake' : 'Sleep';
    }

    function startSleeping(target) {
      state.preSleepPos = { x: state.x, y: state.y };
      state.vx = 0;
      state.vy = 0;
      state.sleepingTarget = target;
      const day = currentDayStats();
      if (day) day.sleeps += 1;
      logEvent('sleep', `Fell asleep on the ${target}`);
      setPose('sleeping');
      const screen = renderCharacterPosition();
      sortDepthLayer(screen.y);
      updatePromptUI();
    }

    function wakeUp() {
      if (!state.sleepingTarget) return;
      const target = state.sleepingTarget;
      logEvent('wake', `Woke up from the ${target}`);
      const freeSpot = findNearestFreeSpotOutside(target, state.preSleepPos.x, state.preSleepPos.y);
      state.x = freeSpot.x;
      state.y = freeSpot.y;
      state.vx = 0;
      state.vy = 0;
      state.sleepingTarget = null;
      setPose('standing');
      state.activeZone = detectInteractionZone(state.x, state.y);
      const screen = renderCharacterPosition();
      sortDepthLayer(screen.y);
      updatePromptUI();
    }

    function triggerSleepOrWake() {
      if (state.phase !== 'playing') return;
      if (state.sleepingTarget) {
        wakeUp();
      } else if (state.activeZone) {
        startSleeping(state.activeZone);
      }
    }

    floatingPrompt.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerSleepOrWake();
    });

    touchActionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerSleepOrWake();
    });

    // ======================================================================
    // SKY / TIME OF DAY
    // ======================================================================

    function applySkyPhase(index) {
      const phase = SKY_PHASES[index];
      masterSvg.classList.remove('time-day', 'time-sunset', 'time-night');
      masterSvg.classList.add(phase.className);
      skyHudIcon.textContent = phase.icon;
      skyHudLabel.textContent = phase.label;
      if (skyHudDay) skyHudDay.textContent = `Day ${state.dayIndex + 1}/${TOTAL_DAYS}`;
    }

    function updateSky(dtMs) {
      state.skyElapsedMs += dtMs;
      let currentPhase = SKY_PHASES[state.skyIndex];
      while (state.skyElapsedMs >= currentPhase.durationMs) {
        state.skyElapsedMs -= currentPhase.durationMs;
        state.skyIndex += 1;

        if (state.skyIndex >= SKY_PHASES.length) {
          // A full Day → Sunset → Night cycle finished
          if (state.dayIndex + 1 >= TOTAL_DAYS) {
            state.skyIndex = SKY_PHASES.length - 1;
            state.skyElapsedMs = currentPhase.durationMs;
            skyProgressFill.style.width = '100%';
            endSession();
            return;
          }
          state.skyIndex = 0;
          state.dayIndex += 1;
          if (session) session.days.push(newDayStats(state.dayIndex + 1));
          logEvent('day-start', `Day ${state.dayIndex + 1} began`);
          panelApi.clearAlerts();
          panelApi.addAlert(`☀️ Day ${state.dayIndex + 1} of ${TOTAL_DAYS} has started`);
        }

        currentPhase = SKY_PHASES[state.skyIndex];
        applySkyPhase(state.skyIndex);
        if (state.skyIndex !== 0) logEvent('sky', `Sky changed to ${currentPhase.label}`);
      }
      const pct = clamp((state.skyElapsedMs / currentPhase.durationMs) * 100, 0, 100);
      skyProgressFill.style.width = `${pct.toFixed(1)}%`;
    }

    // ======================================================================
    // INPUT HANDLING (Keyboard + Touch D-pad)
    // ======================================================================

    const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

    window.addEventListener('keydown', (e) => {
      // Let form fields (player name) receive normal typing
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) {
        return;
      }

      if (state.phase !== 'playing') {
        if ((e.code === 'Space' || e.key === ' ') && !e.repeat && state.phase === 'loading' &&
            !loadingScreen.classList.contains('hidden')) {
          e.preventDefault();
          dismissLoadingScreen();
        }
        return;
      }

      if (ARROW_KEYS.has(e.key) || e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
      }

      if (e.key === 'd' || e.key === 'D') {
        if (!e.repeat) {
          state.debug = !state.debug;
          debugLayer.classList.toggle('hidden', !state.debug);
          debugHud.classList.toggle('hidden', !state.debug);
        }
        return;
      }

      if (e.code === 'Space' || e.key === ' ') {
        if (!e.repeat) triggerSleepOrWake();
        return;
      }

      if (ARROW_KEYS.has(e.key)) {
        if (state.sleepingTarget) {
          wakeUp();
        }
        keysDown.add(e.key);
      }
    });

    window.addEventListener('keyup', (e) => {
      keysDown.delete(e.key);
    });

    window.addEventListener('blur', () => {
      keysDown.clear();
      touchDirs.up = touchDirs.down = touchDirs.left = touchDirs.right = false;
      document.querySelectorAll('.dpad-btn.active').forEach((b) => b.classList.remove('active'));
    });

    document.querySelectorAll('.dpad-btn').forEach((btn) => {
      const dir = btn.dataset.dir;
      const setActive = (isActive) => {
        if (isActive && state.phase !== 'playing') return;
        if (isActive && state.sleepingTarget) {
          wakeUp();
        }
        touchDirs[dir] = isActive;
        btn.classList.toggle('active', isActive);
      };

      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        setActive(true);
      });
      btn.addEventListener('pointerup', () => setActive(false));
      btn.addEventListener('pointercancel', () => setActive(false));
      btn.addEventListener('lostpointercapture', () => setActive(false));
    });

    // Converts arrow input (screen directions) into a grid-space velocity (tiles / second)
    // so the character moves at a consistent ON-SCREEN speed in every direction.
    function getMovementInputVector() {
      const up = keysDown.has('ArrowUp') || touchDirs.up;
      const down = keysDown.has('ArrowDown') || touchDirs.down;
      const left = keysDown.has('ArrowLeft') || touchDirs.left;
      const right = keysDown.has('ArrowRight') || touchDirs.right;

      const sx = (right ? 1 : 0) - (left ? 1 : 0);
      const sy = (down ? 1 : 0) - (up ? 1 : 0);
      if (sx === 0 && sy === 0) {
        return { gx: 0, gy: 0, movingLeftOnScreen: null };
      }

      const len = Math.hypot(sx, sy);
      const vxPx = (sx / len) * SCREEN_SPEED_PX;
      const vyPx = (sy / len) * SCREEN_SPEED_PX * VERTICAL_SCREEN_FACTOR;

      // Inverse of gridToScreen: screenX = (gx - gy) * 40, screenY = (gx + gy) * 20
      return {
        gx: (vxPx / 40 + vyPx / 20) / 2,
        gy: (vyPx / 20 - vxPx / 40) / 2,
        movingLeftOnScreen: sx !== 0 ? sx < 0 : null,
      };
    }

    function gridVelocityToScreenSpeed(vx, vy) {
      return Math.hypot((vx - vy) * 40, (vx + vy) * 20);
    }

    // ======================================================================
    // INITIAL RENDER & GAME LOOP
    // ======================================================================

    applySkyPhase(0);
    setPose('standing');
    const initialScreen = renderCharacterPosition();
    sortDepthLayer(initialScreen.y);
    updatePromptUI();

    let lastTimestamp = null;

    function tick(timestamp) {
      if (lastTimestamp === null) {
        lastTimestamp = timestamp;
      }
      const rawDtMs = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      const dtMs = Math.min(rawDtMs, 100);
      const dtSec = dtMs / 1000;

      if (!state.paused && state.phase === 'playing') {
        trackSessionFrame(dtMs);
        updateSky(dtMs);

        if (state.phase === 'playing' && !state.sleepingTarget) {
          const input = getMovementInputVector();
          const isTryingToMove = input.gx !== 0 || input.gy !== 0;

          if (isTryingToMove && input.movingLeftOnScreen !== null && input.movingLeftOnScreen !== state.facingLeft) {
            state.facingLeft = input.movingLeftOnScreen;
            applyPoseTransform(state.pose);
          }

          // Frame-rate independent exponential smoothing toward the target velocity
          const rate = isTryingToMove ? ACCEL_RATE : DECEL_RATE;
          const blend = 1 - Math.exp(-rate * dtSec);
          state.vx += (input.gx - state.vx) * blend;
          state.vy += (input.gy - state.vy) * blend;

          if (!isTryingToMove && gridVelocityToScreenSpeed(state.vx, state.vy) < 4) {
            state.vx = 0;
            state.vy = 0;
          }

          const stepDx = state.vx * dtSec;
          const stepDy = state.vy * dtSec;
          const prevX = state.x;
          const prevY = state.y;

          if (Math.hypot(stepDx, stepDy) > 1e-6) {
            const next = moveWithSubsteps(state.x, state.y, stepDx, stepDy);
            state.x = next.x;
            state.y = next.y;
          }

          const realVx = dtSec > 0 ? (state.x - prevX) / dtSec : 0;
          const realVy = dtSec > 0 ? (state.y - prevY) / dtSec : 0;

          // When blocked/sliding, keep only the velocity that actually happened so no
          // "stored" momentum pushes into walls and direction changes feel instant.
          if (Math.hypot(stepDx, stepDy) > 1e-6) {
            const intended = Math.hypot(state.vx, state.vy);
            const actual = Math.hypot(realVx, realVy);
            if (actual < intended * 0.98) {
              state.vx = realVx;
              state.vy = realVy;
            }
          }

          const movedDist = Math.hypot(state.x - prevX, state.y - prevY);
          const screenSpeed = gridVelocityToScreenSpeed(realVx, realVy);

          if (movedDist > 1e-5) {
            const dayStats = currentDayStats();
            if (dayStats) dayStats.distanceTiles += movedDist;
            const screen = renderCharacterPosition();
            sortDepthLayer(screen.y);
          }

          const isWalkPose = state.pose === 'walk-1' || state.pose === 'walk-2';
          if (isTryingToMove && screenSpeed > 18) {
            state.walkGraceMs = WALK_GRACE_MS;
            const speedFactor = clamp(screenSpeed / SCREEN_SPEED_PX, 0.55, 1.25);
            state.walkTimerMs += dtMs * speedFactor;
            if (state.walkTimerMs >= WALK_FRAME_MS) {
              state.walkTimerMs %= WALK_FRAME_MS;
              state.walkFrameIndex = 1 - state.walkFrameIndex;
              setPose(state.walkFrameIndex === 0 ? 'walk-1' : 'walk-2');
            } else if (!isWalkPose) {
              setPose(state.walkFrameIndex === 0 ? 'walk-1' : 'walk-2');
            }
          } else if (isWalkPose) {
            state.walkGraceMs -= dtMs;
            if (state.walkGraceMs <= 0) {
              state.walkTimerMs = 0;
              setPose('standing');
            }
          }

          const newZone = detectInteractionZone(state.x, state.y);
          if (newZone !== state.activeZone) {
            state.activeZone = newZone;
            updatePromptUI();
          }
        }
      }

      requestAnimationFrame(tick);
    }

    document.addEventListener('visibilitychange', () => {
      state.paused = document.hidden;
      if (!document.hidden) {
        lastTimestamp = null;
      }
    });

    // ======================================================================
    // START SCREEN → PLAY → RESULTS FLOW
    // ======================================================================

    const startScreen = document.getElementById('start-screen');
    const startForm = document.getElementById('start-form');
    const playerInput = document.getElementById('player-name');
    const playBtn = document.getElementById('play-btn');
    const historyWrap = document.getElementById('history-wrap');
    const historyList = document.getElementById('history-list');

    const resultsScreen = document.getElementById('results-screen');
    const resultsPlayer = document.getElementById('results-player');
    const resultsStats = document.getElementById('results-stats');
    const resultsDays = document.getElementById('results-days');
    const resultsLogCount = document.getElementById('results-log-count');
    const resultsLogList = document.getElementById('results-log-list');
    const resultsStorage = document.getElementById('results-storage');
    const againBtn = document.getElementById('again-btn');
    const changePlayerBtn = document.getElementById('change-player-btn');
    const downloadBtn = document.getElementById('download-btn');

    function el(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }

    function renderHistory() {
      const sessions = loadSessions().slice().reverse().slice(0, 5);
      historyList.replaceChildren();
      historyWrap.classList.toggle('hidden', sessions.length === 0);
      for (const s of sessions) {
        const totalSleep = (s.days || []).reduce((sum, d) => sum + (d.sleepMs || 0), 0);
        const when = new Date(s.startedAt);
        const li = el('li');
        li.append(
          el('span', 'h-name', s.player || 'Unknown'),
          el(
            'span',
            'h-meta',
            `${when.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} · ` +
              (s.completed ? `slept ${formatDuration(totalSleep)}` : `left on day ${(s.days || []).length}`)
          )
        );
        historyList.appendChild(li);
      }
    }

    function showStartScreen(prefillLastPlayer = true) {
      state.phase = 'start';
      resultsScreen.classList.add('hidden');
      renderHistory();
      if (prefillLastPlayer && !playerInput.value) playerInput.value = readLastPlayer();
      playBtn.disabled = playerInput.value.trim().length === 0;
      startScreen.classList.remove('hidden');
      setTimeout(() => playerInput.focus(), 50);
    }

    playerInput.addEventListener('input', () => {
      playBtn.disabled = playerInput.value.trim().length === 0;
    });

    // Puts Grandma and the sky back to the start of day 1
    function resetWorld() {
      keysDown.clear();
      touchDirs.up = touchDirs.down = touchDirs.left = touchDirs.right = false;
      document.querySelectorAll('.dpad-btn.active').forEach((b) => b.classList.remove('active'));
      state.x = START_POS.x;
      state.y = START_POS.y;
      state.vx = 0;
      state.vy = 0;
      state.sleepingTarget = null;
      state.activeZone = null;
      state.walkTimerMs = 0;
      state.walkGraceMs = 0;
      state.facingLeft = false;
      state.skyIndex = 0;
      state.skyElapsedMs = 0;
      state.dayIndex = 0;
      autosaveTimerMs = 0;
      applySkyPhase(0);
      skyProgressFill.style.width = '0%';
      setPose('standing');
      const screen = renderCharacterPosition();
      sortDepthLayer(screen.y);
      updatePromptUI();
      panelApi.clearAlerts();
      panelApi.clearTasks();
    }

    function beginPlaying(player) {
      writeLastPlayer(player);
      resetWorld();
      startSession(player);
      startScreen.classList.add('hidden');
      resultsScreen.classList.add('hidden');
      showSidePanel();
      panelApi.addAlert(`👋 Welcome, ${player}! Day 1 of ${TOTAL_DAYS}`);
      lastTimestamp = null;
      state.phase = 'playing';
      if (document.activeElement) document.activeElement.blur();
    }

    startForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = playerInput.value.trim();
      if (!name) return;
      beginPlaying(name);
    });

    function endSession() {
      state.phase = 'results';
      keysDown.clear();
      floatingPrompt.classList.add('hidden');
      touchActionBtn.disabled = true;
      if (session) {
        logEvent('session-end', `${TOTAL_DAYS} days completed`);
        session.completed = true;
        session.endedAt = new Date().toISOString();
        const saved = persistSession();
        showResults(session, saved);
      }
    }

    function statTile(value, label) {
      const tile = el('div', 'stat-tile');
      tile.append(el('div', 'stat-value', value), el('div', 'stat-label', label));
      return tile;
    }

    function topRoom(roomMs) {
      let best = '—';
      let bestMs = -1;
      for (const [room, ms] of Object.entries(roomMs || {})) {
        if (ms > bestMs) {
          best = room;
          bestMs = ms;
        }
      }
      return best;
    }

    function showResults(s, saved) {
      const totals = { sleep: 0, night: 0, dist: 0, sleeps: 0, rooms: {} };
      for (const d of s.days) {
        totals.sleep += d.sleepMs;
        totals.night += d.nightSleepMs;
        totals.dist += d.distanceTiles;
        totals.sleeps += d.sleeps;
        for (const [room, ms] of Object.entries(d.roomMs)) {
          totals.rooms[room] = (totals.rooms[room] || 0) + ms;
        }
      }

      resultsPlayer.textContent = `${s.player} · ${new Date(s.startedAt).toLocaleString()}`;

      resultsStats.replaceChildren(
        statTile(formatDuration(totals.sleep), 'Total sleep'),
        statTile(formatDuration(totals.night), 'Slept at night'),
        statTile(`${totals.dist.toFixed(1)}`, 'Tiles walked'),
        statTile(topRoom(totals.rooms), 'Favourite room')
      );

      resultsDays.replaceChildren();
      for (const d of s.days) {
        const tr = el('tr');
        tr.append(
          el('td', '', `Day ${d.day}`),
          el('td', '', formatDuration(d.sleepMs)),
          el('td', '', formatDuration(d.nightSleepMs)),
          el('td', '', `${formatDuration(d.sleepByMs.sofa)} / ${formatDuration(d.sleepByMs.bed)}`),
          el('td', '', `${d.distanceTiles.toFixed(1)} tiles`),
          el('td', '', topRoom(d.roomMs))
        );
        resultsDays.appendChild(tr);
      }

      resultsLogCount.textContent = String(s.events.length);
      resultsLogList.replaceChildren();
      for (const ev of s.events) {
        const li = el('li');
        li.append(el('span', 'log-time', `${formatClock(ev.t)} · D${ev.day} ${ev.sky} `), document.createTextNode(`— ${ev.detail}`));
        resultsLogList.appendChild(li);
      }

      const storedCount = loadSessions().length;
      resultsStorage.textContent = saved
        ? `Saved in this browser (localStorage) · ${storedCount} session${storedCount === 1 ? '' : 's'} stored`
        : 'Could not save to this browser’s storage. Use “Download data” to keep a copy.';

      resultsScreen.classList.remove('hidden');
      againBtn.focus();
    }

    againBtn.addEventListener('click', () => {
      beginPlaying(session ? session.player : readLastPlayer() || 'Player');
    });

    changePlayerBtn.addEventListener('click', () => {
      playerInput.value = '';
      showStartScreen(false);
    });

    downloadBtn.addEventListener('click', () => {
      const payload = {
        exportedAt: new Date().toISOString(),
        currentSessionId: session ? session.id : null,
        sessions: loadSessions(),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `grandma-sessions-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    let loadingDismissed = false;

    function dismissLoadingScreen() {
      if (loadingDismissed) return;
      loadingDismissed = true;
      loadingScreen.classList.add('fade-out');
      setTimeout(() => loadingScreen.classList.add('hidden'), 420);
      setTimeout(() => showStartScreen(true), 260); // Start screen appears as the loading screen fades
      if (failedAssets.length > 0) {
        placeholderToast.classList.remove('hidden');
      }
    }

    dismissToastBtn.addEventListener('click', () => {
      placeholderToast.classList.add('hidden');
    });

    if (failedAssets.length > 0) {
      loadingStatus.textContent = `Loaded ${Object.keys(assets).length - failedAssets.length} / ${Object.keys(assets).length} SVGs (${failedAssets.length} placeholder${failedAssets.length > 1 ? 's' : ''} active)`;
      for (const a of failedAssets) {
        const li = document.createElement('li');
        li.textContent = a.filename;
        loadingErrorList.appendChild(li);
      }
      loadingErrors.classList.remove('hidden');
      continueBtn.addEventListener('click', dismissLoadingScreen, { once: true });
    } else {
      loadingStatus.textContent = 'Ready!';
      setTimeout(dismissLoadingScreen, 250);
    }

    requestAnimationFrame(tick);
  }

  window.addEventListener('DOMContentLoaded', initGame);
})();