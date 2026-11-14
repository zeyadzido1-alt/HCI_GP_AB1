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

  const SPEED = 3; // Grid tiles per second
  const WALK_FRAME_MS = 180; // ms per walk frame alternation
  const SKY_INTERVAL_MS = 40000; // 40 seconds for Day & Sunset phases
  const NIGHT_SPEED_MULTIPLIER = 1.75; // Night passes 1.75x faster (~22.86s)

  const CHAR_SCALE = 1.5; // 1.5x character size multiplier
  const CHAR_WIDTH_PX = 60 * CHAR_SCALE; // 90px standing/walking/fallen width
  const SLEEP_SIZES = {
    sofa: 150 * CHAR_SCALE, // 225px sleeping on sofa
    bed: 120 * CHAR_SCALE,  // 180px sleeping on bed
  };
  // Standing/walking/fallen rendered width in scene px


  const SLEEP_SPOTS = {
    sofa: { x: 3.5, y: 7.2 },
    bed: { x: 9.5, y: 9.0 },
  };

  const START_POS = { x: 2.0, y: 5.5 }; // Hallway starting position
  const COLLISION_RADIUS = 0.25; // Character circle radius in grid tiles
  const WALL_THICKNESS = 0.15; // Partition wall thickness in grid tiles
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

      // y = 6.5 from x 7–12 with doorway gap x 7–8
      { id: 'wall-kitchen-bedroom', x1: 8, y1: 6.5, x2: 12, y2: 6.5 },

      // x = 6.5 from y 8–12 (living room / bedroom divider)
      { id: 'wall-living-bedroom', x1: 6.5, y1: 8.7, x2: 6.5, y2: 12 },
    ],

    // Furniture footprints (blocked axis-aligned boxes in grid space)
    footprints: [
      // Bathroom (x0-6, y0-4.5)
      { id: 'bathtub', x1: 0.5, y1: 0.3, x2: 3.5, y2: 1.5 },
      { id: 'sink', x1: 4.5, y1: 0.3, x2: 5.5, y2: 1.2 },
      { id: 'toilet', x1: 5.0, y1: 2.5, x2: 5.8, y2: 3.3 },

      // Kitchen (x6-12, y0-6.5)
      { id: 'fridge', x1: 6.2, y1: 0.3, x2: 7.2, y2: 1.5 },
      { id: 'kitchen-counter', x1: 7.5, y1: 0.2, x2: 11.8, y2: 1.3 },
      { id: 'kitchen-table', x1: 9.3, y1: 3.4, x2: 11.0, y2: 4.6 },

      // Hallway (x0-7, y4.5-6.5)
      { id: 'shoe-cabinet', x1: 0.3, y1: 4.7, x2: 1.2, y2: 5.4 },

      // Living Room (x0-6, y6.5-12)
      { id: 'sofa', x1: 1.5, y1: 6.6, x2: 5.5, y2: 7.8, interactive: 'sofa' },
      { id: 'coffee-table', x1: 2.5, y1: 9.0, x2: 4.5, y2: 10.0 },
      { id: 'tv-frame', x1: 1.5, y1: 11.3, x2: 5.5, y2: 11.7 },
      { id: 'floor-lamp', x1: 0.3, y1: 11.3, x2: 0.7, y2: 11.7 },

      // Bedroom (x7-12, y6.5-12)
      { id: 'wardrobe', x1: 7.0, y1: 7.0, x2: 8.0, y2: 8.0 },
      { id: 'bed', x1: 8.5, y1: 7.0, x2: 10.5, y2: 11.0, interactive: 'bed' },
      { id: 'nightstand', x1: 11.0, y1: 7.2, x2: 11.8, y2: 8.0 },

      // Balcony (x0-6, y12-15)
      { id: 'balcony-table', x1: 1.6, y1: 13.1, x2: 2.4, y2: 13.9 },
    ],
  };

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

    // Sky placeholders
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

    // Structure placeholder: isometric floor rooms + balcony
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
        .map((r) => {
          return `<polygon points="${isoPolyPoints(r.x1, r.y1, r.x2, r.y2)}" fill="${r.fill}" stroke="#b9ad9e" stroke-width="1.5"/>`;
        })
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

    // Partitions placeholder: back partition groups + front-walls + balcony-railing
    if (key === 'partitions') {
      const makeWallQuad = (x1, y1, x2, y2, h = 58, fill = '#ede6dc') => {
        const a = gridToScreen(x1, y1);
        const b = gridToScreen(x2, y2);
        return `<polygon points="${a.x},${a.y} ${b.x},${b.y} ${b.x},${b.y - h} ${a.x},${a.y - h}" fill="${fill}" fill-opacity="0.92" stroke="#8f8377" stroke-width="2"/>`;
      };
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1300 1040">
        <g id="interior-partitions">
          ${makeWallQuad(0, 4.5, 4, 4.5, 56, '#ebe3d8')}
          ${makeWallQuad(5, 4.5, 6, 4.5, 56, '#ebe3d8')}
          ${makeWallQuad(6, 0, 6, 4.5, 56, '#e0d7ca')}
          ${makeWallQuad(0, 6.5, 6, 6.5, 56, '#ebe3d8')}
          ${makeWallQuad(8, 6.5, 12, 6.5, 56, '#ebe3d8')}
          ${makeWallQuad(6.5, 8.7, 6.5, 12, 56, '#e0d7ca')}
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

    // Furniture placeholders split across the 3 furniture files
    if (key.startsWith('furniture')) {
      const groupsByFile = {
        furniture1: [
          { id: 'bathtub', x1: 0.5, y1: 0.3, x2: 3.5, y2: 1.5, h: 24, color: '#9ed5e8', label: 'Bathtub' },
          { id: 'sink', x1: 4.5, y1: 0.3, x2: 5.5, y2: 1.2, h: 28, color: '#b7e2f0', label: 'Sink' },
          { id: 'toilet', x1: 5.0, y1: 2.5, x2: 5.8, y2: 3.3, h: 26, color: '#ccebf5', label: 'Toilet' },
          { id: 'fridge', x1: 6.2, y1: 0.3, x2: 7.2, y2: 1.5, h: 58, color: '#d7e0e6', label: 'Fridge' },
          { id: 'kitchen-counter', x1: 7.5, y1: 0.2, x2: 11.8, y2: 1.3, h: 30, color: '#e8c89b', label: 'Counter' },
        ],
        furniture2: [
          { id: 'kitchen-table', x1: 9.3, y1: 3.4, x2: 11.0, y2: 4.6, h: 26, color: '#d9a46c', label: 'Table' },
          { id: 'shoe-cabinet', x1: 0.3, y1: 4.7, x2: 1.2, y2: 5.4, h: 28, color: '#c48f65', label: 'Shoes' },
          { id: 'sofa', x1: 1.5, y1: 6.6, x2: 5.5, y2: 7.8, h: 30, color: '#e67e73', label: 'Sofa' },
          { id: 'coffee-table', x1: 2.5, y1: 9.0, x2: 4.5, y2: 10.0, h: 16, color: '#c9935b', label: 'Coffee Tbl' },
          { id: 'tv-frame', x1: 1.5, y1: 11.3, x2: 5.5, y2: 11.7, h: 38, color: '#5c607a', label: 'TV' },
        ],
        furniture3: [
          { id: 'floor-lamp', x1: 0.3, y1: 11.3, x2: 0.7, y2: 11.7, h: 52, color: '#f2c96d', label: 'Lamp', bulb: true },
          { id: 'wardrobe', x1: 7.0, y1: 7.0, x2: 8.0, y2: 8.0, h: 62, color: '#a87d56', label: 'Wardrobe' },
          { id: 'bed', x1: 8.5, y1: 7.0, x2: 10.5, y2: 11.0, h: 24, color: '#9c8be0', label: 'Bed' },
          { id: 'nightstand', x1: 11.0, y1: 7.2, x2: 11.8, y2: 8.0, h: 24, color: '#c4966a', label: 'Lamp', bulb: true },
          { id: 'balcony-table', x1: 1.6, y1: 13.1, x2: 2.4, y2: 13.9, h: 22, color: '#8ac288', label: 'Balcony Tbl' },
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

    // Grandma pose placeholders (coloured box + filename + clear pose visual)
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

    // Standing / Walk 1 / Walk 2 placeholders
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

  // Scope internal <defs> IDs (gradients, clips, masks, filters) and <style>
  // classes (except .bulb) per file so combining 13 SVGs never causes collisions.
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
      const response = await fetch(filename, { cache: 'default' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      svgText = await response.text();
      const testDoc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
      if (testDoc.querySelector('parsererror') || !testDoc.documentElement || testDoc.documentElement.tagName.toLowerCase() !== 'svg') {
        throw new Error('Invalid SVG markup');
      }
    } catch (err) {
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

  // Extract individual furniture <g id="..."> items from a furniture SVG.
  // Rugs/mats/doormats go to carpetsLayer (below partitions and furniture),
  // bedroom plants are skipped, and everything else goes to depthLayer.
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

    // If an editor exported a single outer wrapper <g> containing multiple <g id="..."> items, unwrap it
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

      // Remove any nested bedroom plant elements if present
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

  function findFurnitureGroup(depthLayer, type) {
    const children = Array.from(depthLayer.children).filter((el) => el.id !== 'grandma-character');
    const regex = type === 'sofa' ? /sofa/i : /\bbed\b|^bed$|bed(?!side|room)/i;
    const byId = children.find((el) => el.id && regex.test(el.id));
    if (byId) return byId;

    const spot = gridToScreen(SLEEP_SPOTS[type].x, SLEEP_SPOTS[type].y);
    let best = null;
    let bestDist = Infinity;
    for (const el of children) {
      try {
        const b = el.getBBox();
        const cx = b.x + b.width / 2;
        const cy = b.y + b.height / 2;
        const d = Math.hypot(cx - spot.x, cy - spot.y);
        if (d < bestDist) {
          bestDist = d;
          best = el;
        }
      } catch {
        // Ignore unmeasurable groups
      }
    }
    return best;
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

  function resolveCircleCollisions(cx, cy) {
    const r = COLLISION.charRadius;
    const halfWall = COLLISION.wallThickness / 2;
    let x = cx;
    let y = cy;

    for (let iter = 0; iter < 5; iter++) {
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
      if (isPositionFree(c.x, c.y)) {
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
          fill: 'rgba(255, 68, 138, 0.25)',
          stroke: '#ff448a',
          'stroke-width': 2,
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
    { id: 'day', label: 'Day', icon: '☀️', className: 'time-day', durationMs: SKY_INTERVAL_MS },
    { id: 'sunset', label: 'Sunset', icon: '🌇', className: 'time-sunset', durationMs: SKY_INTERVAL_MS },
    {
      id: 'night',
      label: 'Night',
      icon: '🌙',
      className: 'time-night',
      durationMs: Math.round(SKY_INTERVAL_MS / NIGHT_SPEED_MULTIPLIER),
    },
  ];

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

    // 1. Load & preload all 13 SVGs
    const assets = await loadAllAssets((done, total) => {
      loadingBarFill.style.width = `${Math.round((done / total) * 100)}%`;
      loadingStatus.textContent = `Loaded SVG layers (${done} / ${total})`;
    });

    const failedAssets = Object.values(assets).filter((a) => a.isPlaceholder);

    // 2. Assemble ONE master <svg viewBox="0 0 1300 1040">
    // Layer order inside #house-layer:
    // structure -> carpets -> partition walls -> depth layer (furniture + grandma) -> front layer (pergola arch, front-walls, balcony-railing)
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

    const houseLayer = createSvgEl('g', { id: 'house-layer' });
    const structureLayer = createSvgEl('g', { id: 'structure-layer' });
    const carpetsLayer = createSvgEl('g', { id: 'carpets-layer' });
    const partitionsLayer = createSvgEl('g', { id: 'partitions-layer' });
    const depthLayer = createSvgEl('g', { id: 'depth-layer' });
    const frontLayer = createSvgEl('g', { id: 'front-layer' });

    importVisualChildren(assets.structure.svgRoot, masterDefs, structureLayer);
    importVisualChildren(assets.partitions.svgRoot, masterDefs, partitionsLayer);

    // Delete white room title bubbles (#room-labels / .room-pill)
    structureLayer.querySelectorAll('#room-labels, .room-pill').forEach((el) => el.remove());

    // Keep partition blocks exclusively in #partitions-layer (above #carpets-layer)
    const hasPartitionsInLayer = Boolean(
      partitionsLayer.querySelector('#partition-walls, .partition-block, #interior-partitions')
    );
    structureLayer.querySelectorAll('.partition-block').forEach((block) => {
      if (hasPartitionsInLayer) {
        block.remove();
      } else {
        partitionsLayer.appendChild(block);
      }
    });

    // Move balcony pergola arch (brown entrance), front-walls, and balcony-railing above depthLayer
    for (const id of ['balcony-pergola-arch', 'front-walls', 'balcony-railing']) {
      const fromPartitions = partitionsLayer.querySelector(`#${id}`);
      const fromStructure = structureLayer.querySelector(`#${id}`);
      const found = fromPartitions || fromStructure;
      if (found) {
        frontLayer.appendChild(found);
      }
    }

    // Move carpets/rugs/doormats into carpetsLayer (below partitions & furniture)
    // and remaining furniture <g id> into depthLayer (removing any bedroom plant)
    extractFurnitureGroups(assets.furniture1.svgRoot, masterDefs, depthLayer, carpetsLayer, 'furniture1');
    extractFurnitureGroups(assets.furniture2.svgRoot, masterDefs, depthLayer, carpetsLayer, 'furniture2');
    extractFurnitureGroups(assets.furniture3.svgRoot, masterDefs, depthLayer, carpetsLayer, 'furniture3');

    // 3. Pre-load all 5 character pose SVGs inside #grandma-character (zero flicker)
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

    houseLayer.append(structureLayer, carpetsLayer, partitionsLayer, depthLayer, frontLayer);
    masterSvg.appendChild(houseLayer);

    // Night radial glow layer sits above #house-layer so mix-blend-mode: screen shines brightly
    masterSvg.appendChild(buildNightGlowLayer(masterDefs));

    // Debug layer sits on top of everything
    const debugLayer = buildDebugLayer();
    masterSvg.appendChild(debugLayer);

    // 4. Cache furniture bboxes once after loading
    const furnitureSortYCache = new Map();
    for (const child of Array.from(depthLayer.children)) {
      if (child === characterGroup) continue;
      furnitureSortYCache.set(child, computeElementSortY(child, depthLayer));
    }

    const sofaGroup = findFurnitureGroup(depthLayer, 'sofa');
    const bedGroup = findFurnitureGroup(depthLayer, 'bed');

    // 5. Game State
    const state = {
      x: START_POS.x,
      y: START_POS.y,
      facingLeft: false,
      pose: 'standing',
      walkFrameIndex: 0,
      walkTimerMs: 0,
      sleepingTarget: null, // null | 'sofa' | 'bed'
      preSleepPos: { x: START_POS.x, y: START_POS.y },
      activeZone: null, // null | 'sofa' | 'bed'
      debug: false,
      skyIndex: 0,
      skyElapsedMs: 0,
      paused: false,
      depthDirty: true,
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
      state.depthDirty = true;
    }

    window.setPose = setPose;
    window.GrandmaGame = { setPose, state, COLLISION };

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

    function sortDepthLayer(charScreenY) {
      let charSortY = charScreenY;
      if (state.sleepingTarget) {
        const targetGroup = state.sleepingTarget === 'sofa' ? sofaGroup : bedGroup;
        if (targetGroup && furnitureSortYCache.has(targetGroup)) {
          charSortY = furnitureSortYCache.get(targetGroup) + 0.5;
        }
      }

      const children = Array.from(depthLayer.children);
      const sorted = children.slice().sort((a, b) => {
        const ya = a === characterGroup ? charSortY : (furnitureSortYCache.get(a) ?? 0);
        const yb = b === characterGroup ? charSortY : (furnitureSortYCache.get(b) ?? 0);
        return ya - yb;
      });

      let changed = false;
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i] !== children[i]) {
          changed = true;
          break;
        }
      }
      if (changed) {
        for (const el of sorted) {
          depthLayer.appendChild(el);
        }
      }
      state.depthDirty = false;
    }

    // ======================================================================
    // SOFA & BED INTERACTION
    // ======================================================================

    const interactiveFootprints = COLLISION.footprints.filter((f) => f.interactive);

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
      const screen = gridToScreen(spot.x, spot.y);
      const yOffsetPx = target === 'sofa' ? 62 : 52;

      floatingPrompt.style.left = `${(screen.x / SCENE_WIDTH) * 100}%`;
      floatingPrompt.style.top = `${((screen.y - yOffsetPx) / SCENE_HEIGHT) * 100}%`;

      const desiredText = state.sleepingTarget ? '⎵ Space · Wake up' : '⎵ Space · Sleep';
      if (floatingPrompt.textContent !== desiredText) {
        floatingPrompt.textContent = desiredText;
      }
      if (floatingPrompt.classList.contains('hidden')) {
        floatingPrompt.classList.remove('hidden');
      }

      touchActionBtn.disabled = false;
      touchActionBtn.textContent = state.sleepingTarget ? 'Wake up' : 'Sleep';
    }

    function startSleeping(target) {
      state.preSleepPos = { x: state.x, y: state.y };
      state.sleepingTarget = target;
      setPose('sleeping');
      const screen = renderCharacterPosition();
      sortDepthLayer(screen.y);
      updatePromptUI();
    }

    function wakeUp() {
      if (!state.sleepingTarget) return;
      const target = state.sleepingTarget;
      const freeSpot = findNearestFreeSpotOutside(target, state.preSleepPos.x, state.preSleepPos.y);
      state.x = freeSpot.x;
      state.y = freeSpot.y;
      state.sleepingTarget = null;
      setPose('standing');
      state.activeZone = detectInteractionZone(state.x, state.y);
      const screen = renderCharacterPosition();
      sortDepthLayer(screen.y);
      updatePromptUI();
    }

    function triggerSleepOrWake() {
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
    }

    function updateSky(dtMs) {
      state.skyElapsedMs += dtMs;
      let currentPhase = SKY_PHASES[state.skyIndex];
      while (state.skyElapsedMs >= currentPhase.durationMs) {
        state.skyElapsedMs -= currentPhase.durationMs;
        state.skyIndex = (state.skyIndex + 1) % SKY_PHASES.length;
        currentPhase = SKY_PHASES[state.skyIndex];
        applySkyPhase(state.skyIndex);
      }
      const pct = clamp((state.skyElapsedMs / currentPhase.durationMs) * 100, 0, 100);
      skyProgressFill.style.width = `${pct.toFixed(1)}%`;
    }

    // ======================================================================
    // INPUT HANDLING (Keyboard + Touch D-pad)
    // ======================================================================

    const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

    window.addEventListener('keydown', (e) => {
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
        if (!e.repeat) {
          if (!loadingScreen.classList.contains('hidden')) {
            dismissLoadingScreen();
          } else {
            triggerSleepOrWake();
          }
        }
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

    function getMovementInputVector() {
      const up = keysDown.has('ArrowUp') || touchDirs.up;
      const down = keysDown.has('ArrowDown') || touchDirs.down;
      const left = keysDown.has('ArrowLeft') || touchDirs.left;
      const right = keysDown.has('ArrowRight') || touchDirs.right;

      let gx = 0;
      let gy = 0;
      if (up) {
        gx -= 1;
        gy -= 1;
      }
      if (down) {
        gx += 1;
        gy += 1;
      }
      if (right) {
        gx += 1;
        gy -= 1;
      }
      if (left) {
        gx -= 1;
        gy += 1;
      }

      const len = Math.hypot(gx, gy);
      if (len === 0) return { gx: 0, gy: 0, movingLeftOnScreen: null };

      const screenDx = (gx - gy) * 40;
      let movingLeftOnScreen = null;
      if (Math.abs(screenDx) > 0.01) {
        movingLeftOnScreen = screenDx < 0;
      }

      return {
        gx: gx / len,
        gy: gy / len,
        movingLeftOnScreen,
      };
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

      if (!state.paused) {
        updateSky(dtMs);

        if (!state.sleepingTarget) {
          const input = getMovementInputVector();
          const isTryingToMove = input.gx !== 0 || input.gy !== 0;

          if (isTryingToMove) {
            if (input.movingLeftOnScreen !== null && input.movingLeftOnScreen !== state.facingLeft) {
              state.facingLeft = input.movingLeftOnScreen;
              applyPoseTransform(state.pose);
            }

            const nextX = state.x + input.gx * SPEED * dtSec;
            const nextY = state.y + input.gy * SPEED * dtSec;
            const resolved = resolveCircleCollisions(nextX, nextY);

            const movedDist = Math.hypot(resolved.x - state.x, resolved.y - state.y);
            state.x = resolved.x;
            state.y = resolved.y;

            if (movedDist > 1e-5) {
              const screen = renderCharacterPosition();
              sortDepthLayer(screen.y);
            }

            state.walkTimerMs += dtMs;
            if (state.walkTimerMs >= WALK_FRAME_MS || (state.pose !== 'walk-1' && state.pose !== 'walk-2')) {
              if (state.walkTimerMs >= WALK_FRAME_MS) {
                state.walkTimerMs %= WALK_FRAME_MS;
                state.walkFrameIndex = 1 - state.walkFrameIndex;
              }
              setPose(state.walkFrameIndex === 0 ? 'walk-1' : 'walk-2');
            }

            const newZone = detectInteractionZone(state.x, state.y);
            if (newZone !== state.activeZone) {
              state.activeZone = newZone;
              updatePromptUI();
            }
          } else if (state.pose === 'walk-1' || state.pose === 'walk-2') {
            state.walkTimerMs = 0;
            setPose('standing');
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

    function dismissLoadingScreen() {
      loadingScreen.classList.add('fade-out');
      setTimeout(() => loadingScreen.classList.add('hidden'), 420);
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