import { C64RomData, PaletteCycleConfig, JoystickConfig } from '../types';
import { renderC64Text } from './c64Font';

export interface GameSimulationState {
  playerX: number;
  playerY: number;
  lasers: Array<{ x: number; y: number }>;
  enemies: Array<{ x: number; y: number; hp: number; dir: number }>;
  stars: Array<{ x: number; y: number; speed: number; color: number }>;
  score: number;
  flashCursor: boolean;
  frameCounter: number;
  plasmaPhase: number;
  horizonScroll: number;
}

export function createInitialSimulationState(): GameSimulationState {
  const stars: Array<{ x: number; y: number; speed: number; color: number }> = [];
  for (let i = 0; i < 60; i++) {
    stars.push({
      x: Math.floor(Math.random() * 320),
      y: Math.floor(Math.random() * 200),
      speed: 1 + Math.random() * 2.5,
      color: Math.random() > 0.6 ? 1 : (Math.random() > 0.5 ? 15 : 12)
    });
  }

  const enemies: Array<{ x: number; y: number; hp: number; dir: number }> = [];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 6; col++) {
      enemies.push({
        x: 40 + col * 42,
        y: 35 + row * 24,
        hp: 1,
        dir: 1
      });
    }
  }

  return {
    playerX: 160,
    playerY: 175,
    lasers: [],
    enemies,
    stars,
    score: 0,
    flashCursor: true,
    frameCounter: 0,
    plasmaPhase: 0,
    horizonScroll: 0
  };
}

// Render the 320x200 buffer for the active ROM and simulation state
export function renderScreenBuffer(
  buffer: Uint8Array,
  romData: C64RomData,
  sim: GameSimulationState,
  cycleConfig: PaletteCycleConfig,
  joyState: { up: boolean; down: boolean; left: boolean; right: boolean; fire: boolean }
) {
  const width = 320;
  const height = 200;

  if (romData.fileName.includes('PLASMA')) {
    renderPlasmaDemo(buffer, width, height, sim, cycleConfig, joyState);
  } else if (romData.fileName.includes('SPACE') || romData.fileName.includes('MARAUDER')) {
    renderSpaceMarauder(buffer, width, height, sim, joyState);
  } else if (romData.fileName.includes('HORIZON')) {
    renderHorizonDemo(buffer, width, height, sim, cycleConfig, joyState);
  } else if (romData.fileName.includes('BASIC')) {
    renderCommodoreBasic(buffer, width, height, sim, joyState);
  } else {
    // Custom uploaded ROM
    renderGenericRom(buffer, width, height, romData, sim, cycleConfig, joyState);
  }
}

// 1. Cyber Raster Plasma Demo
function renderPlasmaDemo(
  buffer: Uint8Array,
  width: number,
  height: number,
  sim: GameSimulationState,
  cycleConfig: PaletteCycleConfig,
  joyState: { up: boolean; down: boolean; left: boolean; right: boolean; fire: boolean }
) {
  // Border: 16 pixels top/bottom and 24 pixels left/right like VIC-II border
  const borderCol = 0; // Black
  const cycleBase = cycleConfig.startIndex;
  const cycleCount = cycleConfig.count;

  const t = sim.frameCounter * 0.05 + sim.plasmaPhase;

  // Render 320x200 plasma field
  for (let y = 0; y < height; y++) {
    // Top and bottom border
    const isBorderY = y < 18 || y >= 182;
    for (let x = 0; x < width; x++) {
      const isBorderX = x < 24 || x >= 296;
      if (isBorderY || isBorderX) {
        // Copper raster bar effect in border
        const bar = Math.sin((y + sim.frameCounter * 2) * 0.15);
        if (bar > 0.4) {
          buffer[y * width + x] = cycleBase + (Math.floor((y + sim.frameCounter) / 4) % cycleCount);
        } else {
          buffer[y * width + x] = borderCol;
        }
        continue;
      }

      // Inside screen window: 2D plasma math
      const v1 = Math.sin(x * 0.04 + t);
      const v2 = Math.sin(y * 0.05 - t);
      const v3 = Math.sin((x + y) * 0.03 + t * 1.5);
      const cx = x - 160 + (joyState.left ? -15 : joyState.right ? 15 : 0);
      const cy = y - 100 + (joyState.up ? -15 : joyState.down ? 15 : 0);
      const v4 = Math.sin(Math.sqrt(cx * cx + cy * cy) * 0.05);

      const combined = (v1 + v2 + v3 + v4 + 4) / 8; // 0..1
      const paletteOffset = Math.floor(combined * cycleCount) % cycleCount;
      buffer[y * width + x] = cycleBase + paletteOffset;
    }
  }

  // Draw Demoscene Title text
  renderC64Text(buffer, 'CYBER RASTER DEMO // 1987', 4, 3, 1);
  renderC64Text(buffer, 'VIC-II TO VGA MODE 13H CONVERTED', 4, 5, 7);
  renderC64Text(buffer, 'PALETTE CYCLES: ACTIVE (PORT 03C8H)', 4, 19, 13);
  renderC64Text(buffer, 'JOYSTICK 2: MOVE PLASMA VORTEX', 4, 21, 3);
}

// 2. Space Marauder 64 - Playable arcade shooter
function renderSpaceMarauder(
  buffer: Uint8Array,
  width: number,
  height: number,
  sim: GameSimulationState,
  joyState: { up: boolean; down: boolean; left: boolean; right: boolean; fire: boolean }
) {
  // Clear screen to deep space black
  buffer.fill(0);

  // Update starfield
  for (let s of sim.stars) {
    s.y += s.speed;
    if (s.y >= 200) {
      s.y = 0;
      s.x = Math.floor(Math.random() * 320);
    }
    const px = Math.floor(s.x);
    const py = Math.floor(s.y);
    if (px >= 0 && px < width && py >= 0 && py < height) {
      buffer[py * width + px] = s.color;
    }
  }

  // Update & Draw Enemies
  for (let e of sim.enemies) {
    if (e.hp <= 0) continue;
    e.x += e.dir * 0.8;
    if (e.x > 280) { e.dir = -1; e.y += 4; }
    if (e.x < 30) { e.dir = 1; e.y += 4; }

    // Draw 8x8 Alien Sprite (Yellow/Red)
    const ex = Math.floor(e.x);
    const ey = Math.floor(e.y);
    drawAlienSprite(buffer, ex, ey, 7, 2);
  }

  // Player ship movement via Joystick
  const speed = 2.5;
  if (joyState.left) sim.playerX = Math.max(16, sim.playerX - speed);
  if (joyState.right) sim.playerX = Math.min(304, sim.playerX + speed);
  if (joyState.up) sim.playerY = Math.max(24, sim.playerY - speed);
  if (joyState.down) sim.playerY = Math.min(185, sim.playerY + speed);

  // Fire laser on fire button
  if (joyState.fire && sim.frameCounter % 6 === 0) {
    sim.lasers.push({ x: sim.playerX - 6, y: sim.playerY - 8 });
    sim.lasers.push({ x: sim.playerX + 6, y: sim.playerY - 8 });
  }

  // Update & Draw Lasers
  for (let i = sim.lasers.length - 1; i >= 0; i--) {
    const laser = sim.lasers[i];
    laser.y -= 5;
    if (laser.y < 0) {
      sim.lasers.splice(i, 1);
      continue;
    }
    // Check collision with enemies
    let hit = false;
    for (let e of sim.enemies) {
      if (e.hp > 0 && Math.abs(laser.x - e.x) < 10 && Math.abs(laser.y - e.y) < 8) {
        e.hp = 0;
        sim.score += 100;
        hit = true;
        break;
      }
    }
    if (hit) {
      sim.lasers.splice(i, 1);
      continue;
    }
    // Draw laser beam (Light Red/Cyan)
    const lx = Math.floor(laser.x);
    const ly = Math.floor(laser.y);
    if (lx >= 0 && lx < width && ly >= 0 && ly < height - 4) {
      buffer[ly * width + lx] = 1; // White tip
      buffer[(ly + 1) * width + lx] = 3; // Cyan core
      buffer[(ly + 2) * width + lx] = 14; // Light blue tail
    }
  }

  // Draw Player Ship (Sprite at playerX, playerY)
  drawPlayerSpaceship(buffer, Math.floor(sim.playerX), Math.floor(sim.playerY), sim.frameCounter);

  // Draw HUD Banner
  renderC64Text(buffer, `SCORE:${sim.score.toString().padStart(6, '0')}`, 1, 1, 1);
  renderC64Text(buffer, 'SPACE MARAUDER 64', 12, 1, 7);
  renderC64Text(buffer, 'JOY:PORT2', 30, 1, 14);
}

// 3. Neon Copper Horizon Demo
function renderHorizonDemo(
  buffer: Uint8Array,
  width: number,
  height: number,
  sim: GameSimulationState,
  cycleConfig: PaletteCycleConfig,
  joyState: { up: boolean; down: boolean; left: boolean; right: boolean; fire: boolean }
) {
  // Joystick pans camera
  if (joyState.left) sim.horizonScroll -= 2;
  if (joyState.right) sim.horizonScroll += 2;

  const horizonY = 110;
  const cycleBase = cycleConfig.startIndex;
  const cycleCount = cycleConfig.count;

  // Sky with gradient raster bars
  for (let y = 0; y < horizonY; y++) {
    const t = y / horizonY;
    let colorIdx: number;
    if (t < 0.25) colorIdx = 0; // Black space
    else if (t < 0.5) colorIdx = 6; // Blue
    else if (t < 0.75) colorIdx = 4; // Purple
    else colorIdx = 2; // Red

    const rowStart = y * width;
    for (let x = 0; x < width; x++) {
      buffer[rowStart + x] = colorIdx;
    }
  }

  // Draw Retro Sun
  const sunX = 160 + Math.sin(sim.horizonScroll * 0.01) * 20;
  const sunY = 75;
  const sunRadius = 32;
  for (let dy = -sunRadius; dy <= sunRadius; dy++) {
    const py = sunY + dy;
    if (py < 0 || py >= horizonY) continue;
    // Horizontal retro grill lines
    if (dy > 0 && dy % 5 < 2) continue;
    const dxMax = Math.floor(Math.sqrt(sunRadius * sunRadius - dy * dy));
    for (let dx = -dxMax; dx <= dxMax; dx++) {
      const px = Math.floor(sunX + dx);
      if (px >= 0 && px < width) {
        buffer[py * width + px] = dy < 0 ? 7 : (dy < 15 ? 8 : 10);
      }
    }
  }

  // Water Grid with Shimmering Palette Cycle
  for (let y = horizonY; y < height; y++) {
    const depth = (y - horizonY) / (height - horizonY); // 0..1
    const cycleOffset = Math.floor((depth * 30 + sim.frameCounter * 0.8 + sim.horizonScroll * 0.1)) % cycleCount;
    const waterColor = cycleBase + cycleOffset;

    const rowStart = y * width;
    for (let x = 0; x < width; x++) {
      // Perspective grid lines
      const centeredX = x - 160;
      const perspX = centeredX / (depth * 2.5 + 0.1);
      const isGridLine = Math.abs((perspX + sim.horizonScroll) % 30) < 1.5;
      const isHLine = (y - horizonY) % Math.max(3, Math.floor(depth * 18)) === 0;

      if (isGridLine || isHLine) {
        buffer[rowStart + x] = 3; // Cyan grid line
      } else {
        buffer[rowStart + x] = waterColor; // Shimmering water cycle
      }
    }
  }

  renderC64Text(buffer, 'NEON COPPER HORIZON', 10, 2, 7);
  renderC64Text(buffer, 'JOYSTICK 2: PAN HORIZON', 9, 23, 1);
}

// 4. Commodore 64 BASIC V2 Shell
function renderCommodoreBasic(
  buffer: Uint8Array,
  width: number,
  height: number,
  sim: GameSimulationState,
  joyState: { up: boolean; down: boolean; left: boolean; right: boolean; fire: boolean }
) {
  const borderColor = 14; // Light Blue
  const bgColor = 6;      // Blue
  const textColor = 14;   // Light Blue

  // Fill border & background
  for (let y = 0; y < height; y++) {
    const isBorderY = y < 24 || y >= 176;
    for (let x = 0; x < width; x++) {
      const isBorderX = x < 32 || x >= 288;
      buffer[y * width + x] = (isBorderY || isBorderX) ? borderColor : bgColor;
    }
  }

  // Standard C64 BASIC Boot Messages
  renderC64Text(buffer, '    **** COMMODORE 64 BASIC V2 ****', 4, 3, textColor);
  renderC64Text(buffer, ' 64K RAM SYSTEM  38911 BASIC BYTES FREE', 4, 5, textColor);
  renderC64Text(buffer, 'READY.', 4, 7, textColor);

  // Command prompt text
  renderC64Text(buffer, 'LOAD "MSDOS.EXE",8,1', 4, 9, 1);
  renderC64Text(buffer, 'SEARCHING FOR MSDOS.EXE', 4, 11, textColor);
  renderC64Text(buffer, 'LOADING VGA MODE 13H (320X200)', 4, 12, 7);
  renderC64Text(buffer, 'READY.', 4, 14, textColor);

  // Joystick diagnostic line
  const joyStatus = `JOY2: U:${joyState.up ? '1' : '0'} D:${joyState.down ? '1' : '0'} L:${joyState.left ? '1' : '0'} R:${joyState.right ? '1' : '0'} FIRE:${joyState.fire ? 'PRESS' : '----'}`;
  renderC64Text(buffer, joyStatus, 4, 16, 13);
  renderC64Text(buffer, 'SYS 64738 (TRANSLATED TO INT 21H)', 4, 18, 3);

  // Blinking Commodore Cursor
  if (Math.floor(sim.frameCounter / 15) % 2 === 0) {
    const curX = 4;
    const curY = 20;
    for (let dy = 0; dy < 8; dy++) {
      for (let dx = 0; dx < 8; dx++) {
        buffer[(curY * 8 + dy) * width + (curX * 8 + dx)] = 14;
      }
    }
  }
}

// 5. Generic Custom Uploaded ROM
function renderGenericRom(
  buffer: Uint8Array,
  width: number,
  height: number,
  romData: C64RomData,
  sim: GameSimulationState,
  cycleConfig: PaletteCycleConfig,
  joyState: { up: boolean; down: boolean; left: boolean; right: boolean; fire: boolean }
) {
  // Border & background
  const border = romData.vicBorderColor || 0;
  const bg = romData.vicBgColor || 11;
  buffer.fill(bg);

  // Borders
  for (let y = 0; y < 16; y++) buffer.subarray(y * width, (y + 1) * width).fill(border);
  for (let y = 184; y < 200; y++) buffer.subarray(y * width, (y + 1) * width).fill(border);
  for (let y = 16; y < 184; y++) {
    buffer.subarray(y * width, y * width + 20).fill(border);
    buffer.subarray(y * width + 300, (y + 1) * width).fill(border);
  }

  // Draw Hex memory grid visualization
  const payload = romData.rawBytes;
  let byteOffset = 0;
  for (let y = 30; y < 130; y += 2) {
    for (let x = 30; x < 290; x += 2) {
      if (byteOffset < payload.length) {
        const val = payload[byteOffset++];
        buffer[y * width + x] = val % 16;
        buffer[y * width + x + 1] = val % 16;
        buffer[(y + 1) * width + x] = val % 16;
        buffer[(y + 1) * width + x + 1] = val % 16;
      }
    }
  }

  // Information text
  renderC64Text(buffer, `ROM: ${romData.fileName.substring(0, 24)}`, 4, 18, 1);
  renderC64Text(buffer, `ADDR: $${romData.loadAddress.toString(16).toUpperCase()} SIZE: ${romData.fileSize}B`, 4, 19, 7);
  renderC64Text(buffer, `JOYSTICK 2: ${joyState.fire ? '[FIRE ACTIVE]' : '[STANDBY]'}`, 4, 21, 13);
}

// Helpers for drawing game sprites
function drawPlayerSpaceship(buffer: Uint8Array, x: number, y: number, frame: number) {
  // 15x13 Space Fighter Sprite
  const spriteRows = [
    '       #       ',
    '      ###      ',
    '      ###      ',
    '     #####     ',
    '    ## # ##    ',
    '    ## # ##    ',
    '   ### # ###   ',
    '  #### # ####  ',
    ' ########### # ',
    '#############',
    '##  #####  ##',
    '    #   #    ',
    '    *   *    '
  ];

  for (let r = 0; r < spriteRows.length; r++) {
    const row = spriteRows[r];
    const py = y + r - 6;
    if (py < 0 || py >= 200) continue;
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      const px = x + c - 7;
      if (px < 0 || px >= 320) continue;
      if (ch === '#') {
        buffer[py * 320 + px] = 1; // White hull
      } else if (ch === '*') {
        // Cycling rocket thruster exhaust
        buffer[py * 320 + px] = frame % 2 === 0 ? 8 : 7; // Orange / Yellow
      }
    }
  }
}

function drawAlienSprite(buffer: Uint8Array, x: number, y: number, color1: number, color2: number) {
  const spriteRows = [
    '  #     #  ',
    '   #   #   ',
    '  #######  ',
    ' ## ### ## ',
    '###########',
    '# ####### #',
    '# #     # #',
    '   ## ##   '
  ];

  for (let r = 0; r < spriteRows.length; r++) {
    const row = spriteRows[r];
    const py = y + r;
    if (py < 0 || py >= 200) continue;
    for (let c = 0; c < row.length; c++) {
      if (row[c] === '#') {
        const px = x + c;
        if (px >= 0 && px < 320) {
          buffer[py * 320 + px] = (r === 3 && (c === 3 || c === 7)) ? color2 : color1;
        }
      }
    }
  }
}
