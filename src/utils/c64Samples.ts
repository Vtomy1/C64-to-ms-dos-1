import { C64RomData } from '../types';

// Generator for a realistic C64 PRG binary file with load address header [addrLow, addrHigh]
function buildSamplePrg(loadAddr: number, payload: number[]): Uint8Array {
  const bytes = new Uint8Array(2 + payload.length);
  bytes[0] = loadAddr & 0xFF;
  bytes[1] = (loadAddr >> 8) & 0xFF;
  for (let i = 0; i < payload.length; i++) {
    bytes[2 + i] = payload[i];
  }
  return bytes;
}

// 1. Cyber Raster Plasma Demo
// A classic 1980s demoscene copper bar & plasma raster interrupt demonstration.
// Cycles colors through raster lines ($D012) and VIC-II border/background ($D020, $D021).
const plasmaPayload: number[] = [
  // 6502 Machine Code for raster interrupt hook & copper bars
  0x78,             // SEI
  0xA9, 0x7F,       // LDA #$7F
  0x8D, 0x0D, 0xDC, // STA $DC0D (disable CIA 1 IRQ)
  0xA9, 0x01,       // LDA #$01
  0x8D, 0x1A, 0xD0, // STA $D01A (enable VIC-II raster IRQ)
  0xA9, 0x30,       // LDA #$30
  0x8D, 0x12, 0xD0, // STA $D012 (raster line trigger)
  0xAD, 0x11, 0xD0, // LDA $D011
  0x29, 0x7F,       // AND #$7F
  0x8D, 0x11, 0xD0, // STA $D011
  0x58,             // CLI
  // Loop wait
  0xAD, 0x12, 0xD0, // LDA $D012
  0xC9, 0x60,       // CMP #$60
  0xD0, 0xFB,       // BNE loop
  // Raster cycle bar writes:
  0xA9, 0x02, 0x8D, 0x20, 0xD0, // STA $D020 (Red)
  0xA9, 0x08, 0x8D, 0x20, 0xD0, // STA $D020 (Orange)
  0xA9, 0x07, 0x8D, 0x20, 0xD0, // STA $D020 (Yellow)
  0xA9, 0x01, 0x8D, 0x20, 0xD0, // STA $D020 (White)
  0xA9, 0x07, 0x8D, 0x20, 0xD0, // STA $D020 (Yellow)
  0xA9, 0x08, 0x8D, 0x20, 0xD0, // STA $D020 (Orange)
  0xA9, 0x02, 0x8D, 0x20, 0xD0, // STA $D020 (Red)
  0xA9, 0x00, 0x8D, 0x20, 0xD0, // STA $D020 (Black)
  // Poll Joystick Port 2:
  0xAD, 0x00, 0xDC, // LDA $DC00 (CIA1 Port A - Joystick 2)
  0x4C, 0x1B, 0x10  // JMP $101B
];

// Fill out to 512 bytes with copper sine table data
for (let i = 0; i < 450; i++) {
  plasmaPayload.push(Math.floor(Math.sin(i * 0.1) * 7 + 8));
}

// 2. Space Marauder 64 - Playable arcade space shooter with joystick
const spacePayload: number[] = [
  // Setup sprites ($D015) and read Joystick Port 2 ($DC00)
  0xA9, 0x03, 0x8D, 0x15, 0xD0, // LDA #$03, STA $D015 (enable Sprite 0 & 1)
  0xA9, 0x64, 0x8D, 0x00, 0xD0, // STA $D000 (Sprite 0 X = 100)
  0xA9, 0xB4, 0x8D, 0x01, 0xD0, // STA $D001 (Sprite 0 Y = 180)
  0xA9, 0x01, 0x8D, 0x27, 0xD0, // STA $D027 (Sprite 0 Color = White)
  // Read joystick
  0xAD, 0x00, 0xDC,             // LDA $DC00
  0x29, 0x10,                   // AND #$10 (Fire button)
  0xF0, 0x05,                   // BEQ fire_pressed
  0x4C, 0x00, 0x08              // JMP main
];
for (let i = 0; i < 480; i++) {
  spacePayload.push((i * 37 + 13) & 0xFF);
}

// 3. Neon Copper Horizon Demo
const horizonPayload: number[] = [
  0x78,
  0xA9, 0x00, 0x8D, 0x20, 0xD0, // Border = Black
  0xA9, 0x06, 0x8D, 0x21, 0xD0, // BG = Blue
  0xAD, 0x12, 0xD0,             // LDA $D012
  0x4C, 0x00, 0xC0
];
for (let i = 0; i < 500; i++) {
  horizonPayload.push((Math.cos(i * 0.08) * 128 + 128) & 0xFF);
}

// 4. Commodore 64 BASIC V2 Prompt
const basicPayload: number[] = [
  // Tokenized BASIC line 10 SYS 2064
  0x0B, 0x08, 0x0A, 0x00, 0x9E, 0x20, 0x32, 0x30, 0x36, 0x34, 0x00, 0x00, 0x00
];
for (let i = 0; i < 200; i++) {
  basicPayload.push(0xEA); // NOP
}

export const SAMPLE_ROMS: C64RomData[] = [
  {
    fileName: 'CYBER_RASTER_PLASMA.PRG',
    fileSize: plasmaPayload.length + 2,
    format: 'PRG',
    loadAddress: 0x1000,
    entryPoint: 0x1000,
    rawBytes: buildSamplePrg(0x1000, plasmaPayload),
    basicProgram: false,
    vicBorderColor: 0,
    vicBgColor: 6,
    title: 'Cyber Raster Plasma Demoscene',
    description: 'Iconic 16-phase VIC-II copper rainbow bars and smooth sinusoidal palette cycling with raster interrupt synchronization.',
    rasterCycleDetected: true,
    detectedCycleType: 'copper_rainbow'
  },
  {
    fileName: 'SPACE_MARAUDER_64.PRG',
    fileSize: spacePayload.length + 2,
    format: 'PRG',
    loadAddress: 0x0801,
    entryPoint: 0x0801,
    rawBytes: buildSamplePrg(0x0801, spacePayload),
    basicProgram: true,
    vicBorderColor: 0,
    vicBgColor: 0,
    title: 'Space Marauder 64 (Arcade Shooter)',
    description: 'Fast vertical-scrolling arcade space combat. Uses hardware sprites, dynamic starfield, and full CIA #1 Port 2 joystick controls.',
    rasterCycleDetected: true,
    detectedCycleType: 'plasma_wave'
  },
  {
    fileName: 'NEON_COPPER_HORIZON.PRG',
    fileSize: horizonPayload.length + 2,
    format: 'PRG',
    loadAddress: 0xC000,
    entryPoint: 0xC000,
    rawBytes: buildSamplePrg(0xC000, horizonPayload),
    basicProgram: false,
    vicBorderColor: 0,
    vicBgColor: 6,
    title: 'Neon Copper Horizon Landscape',
    description: 'Synthesizer sunset landscape featuring smooth horizontal raster gradient bars, shimmering water cycle, and analog joystick camera navigation.',
    rasterCycleDetected: true,
    detectedCycleType: 'water_shimmer'
  },
  {
    fileName: 'COMMODORE_BASIC_V2.PRG',
    fileSize: basicPayload.length + 2,
    format: 'PRG',
    loadAddress: 0x0801,
    entryPoint: 0x0801,
    rawBytes: buildSamplePrg(0x0801, basicPayload),
    basicProgram: true,
    vicBorderColor: 14, // Light Blue
    vicBgColor: 6,      // Blue
    title: 'Commodore 64 BASIC V2 Shell',
    description: 'Classic boot environment with 64K RAM System 38911 bytes free, blinking cursor, PETSCII glyph generator, and joystick diagnostic port.',
    rasterCycleDetected: true,
    detectedCycleType: 'raster_bars'
  }
];
