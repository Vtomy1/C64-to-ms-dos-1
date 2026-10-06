export interface C64Color {
  index: number;
  name: string;
  hex: string;
  rgb: [number, number, number];
  vgaDac: [number, number, number]; // 0-63 scale for VGA DAC
}

export interface PaletteCycleConfig {
  enabled: boolean;
  type: 'raster_bars' | 'plasma_wave' | 'copper_rainbow' | 'water_shimmer' | 'custom';
  startIndex: number; // VGA DAC index start (typically 16-31 or 1-15)
  count: number; // Number of colors in cycle window
  speed: number; // Frames per cycle shift (1 = fast 60/50Hz, 8 = slow)
  direction: 'forward' | 'reverse' | 'pingpong';
  syncMode: 'vsync_retrace' | 'timer_pit' | 'raster_line';
  customColors: string[]; // Hex codes for custom cycle
}

export interface JoystickConfig {
  c64Port: 1 | 2; // Usually Port 2 for standard C64 games
  dosInputMode: 'gameport_201h' | 'bios_keyboard' | 'dual_hybrid';
  gameportButtonA: number; // Gamepad button index for Fire 1
  gameportButtonB: number; // Gamepad button index for Fire 2 / Jump
  deadzone: number; // 0.05 to 0.5
  autofire: boolean;
  autofireRate: number; // shots per sec (e.g. 15, 30)
  invertY: boolean;
  swapAxes: boolean;
  emulateAnalogViaKeys: boolean;
}

export interface MzDosHeader {
  magic: number; // 0x5A4D ('MZ')
  cblp: number; // Bytes on last 512-byte page
  cp: number; // Pages in file
  crlc: number; // Relocations
  cparhdr: number; // Header size in 16-byte paragraphs
  minalloc: number; // Minimum extra paragraphs
  maxalloc: number; // Maximum extra paragraphs
  ss: number; // Initial SS relative to load segment
  sp: number; // Initial SP
  csum: number; // Checksum
  ip: number; // Initial IP
  cs: number; // Initial CS relative to load segment
  lfarlc: number; // Relocation table address
  ovno: number; // Overlay number
}

export interface C64RomData {
  fileName: string;
  fileSize: number;
  format: 'PRG' | 'CRT' | 'D64' | 'BIN';
  loadAddress: number;
  entryPoint: number;
  rawBytes: Uint8Array;
  basicProgram: boolean;
  vicBorderColor: number;
  vicBgColor: number;
  title: string;
  description: string;
  rasterCycleDetected: boolean;
  detectedCycleType?: PaletteCycleConfig['type'];
}

export interface ConversionOptions {
  targetResolution: '320x200_MODE13H';
  crtAspectRatio: '4:3' | '1:1';
  preservePaletteCycles: boolean;
  paletteCycle: PaletteCycleConfig;
  joystick: JoystickConfig;
  dosHeaderTune: {
    minAllocParagraphs: number;
    maxAllocParagraphs: number;
    stackSizeWords: number;
  };
  embedAsmSourceComments: boolean;
}
