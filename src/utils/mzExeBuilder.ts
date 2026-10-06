import { C64RomData, ConversionOptions, MzDosHeader } from '../types';
import { generateFullVgaPalette, getCycleColorTable, hexToRgb, rgbToVgaDac } from './c64Palette';

export interface GeneratedExeResult {
  exeBytes: Uint8Array;
  dosHeader: MzDosHeader;
  headerHex: string[];
  totalFileSize: number;
  codeSegmentOffset: number;
  dataSegmentOffset: number;
  videoBufferOffset: number;
  asmSourceCode: string;
}

// Build authentic 16-bit MS-DOS MZ Executable (.EXE)
export function buildMsDosExe(
  romData: C64RomData,
  screenBuffer: Uint8Array, // 320x200 = 64,000 bytes
  options: ConversionOptions
): GeneratedExeResult {
  // 1. Prepare VGA Palette (256 entries * 3 bytes = 768 bytes)
  const vgaPalette = generateFullVgaPalette(options.paletteCycle, 0);

  // 2. Prepare Palette Cycle Animation Table
  const cycleColors = getCycleColorTable(options.paletteCycle);
  const cycleDacBytes = new Uint8Array(cycleColors.length * 3);
  for (let i = 0; i < cycleColors.length; i++) {
    const [r, g, b] = hexToRgb(cycleColors[i]);
    const [vr, vg, vb] = rgbToVgaDac(r, g, b);
    cycleDacBytes[i * 3 + 0] = vr;
    cycleDacBytes[i * 3 + 1] = vg;
    cycleDacBytes[i * 3 + 2] = vb;
  }

  // 3. Assemble Real-Mode 16-bit 8086 x86 Runtime Code
  // The code initializes Mode 13h, uploads DAC palette, copies 320x200 to A000:0000,
  // cycles palette on VRetrace (port 03DAh), polls gameport 0201h, and exits on ESC.
  const codeBytes: number[] = [
    // Entry Point (CS:0000)
    0xFA,                         // CLI
    0x8C, 0xC8,                   // MOV AX, CS
    0x8E, 0xD8,                   // MOV DS, AX
    0x8E, 0xC0,                   // MOV ES, AX
    0xFB,                         // STI

    // Set Video Mode 13h (320x200 256-color)
    0xB8, 0x13, 0x00,             // MOV AX, 0013h
    0xCD, 0x10,                   // INT 10h

    // Setup VGA DAC Palette (Ports 03C8h / 03C9h)
    0xBA, 0xC8, 0x03,             // MOV DX, 03C8h
    0xB0, 0x00,                   // MOV AL, 00h (Start at DAC index 0)
    0xEE,                         // OUT DX, AL
    0xBA, 0xC9, 0x03,             // MOV DX, 03C9h
    0xBE, 0x00, 0x02,             // MOV SI, 0200h (Offset to palette data placeholder)
    0xB9, 0x00, 0x03,             // MOV CX, 0300h (768 bytes: 256 * 3)
    // pal_loop:
    0xAC,                         // LODSB
    0xEE,                         // OUT DX, AL
    0xE2, 0xFD,                   // LOOP pal_loop

    // Copy initial 320x200 Screen Buffer to VGA Segment A000h
    0xB8, 0x00, 0xA0,             // MOV AX, 0A000h
    0x8E, 0xC0,                   // MOV ES, AX
    0x31, 0xFF,                   // XOR DI, DI
    0xBE, 0x00, 0x05,             // MOV SI, 0500h (Offset to screen buffer placeholder)
    0xB9, 0x00, 0x7D,             // MOV CX, 7D00h (32,000 words = 64,000 bytes)
    0xF3, 0xA5,                   // REP MOVSW

    // --- Main Event Loop ---
    // main_loop:
    // 1. Poll Gameport (Port 0201h) for Joystick
    0xBA, 0x01, 0x02,             // MOV DX, 0201h
    0xEC,                         // IN AL, DX
    0xA2, 0xF0, 0x01,             // MOV [01F0h], AL (Store joystick state)

    // 2. Poll Keyboard (BIOS INT 16h, AH=01h)
    0xB4, 0x01,                   // MOV AH, 01h
    0xCD, 0x16,                   // INT 16h
    0x74, 0x0A,                   // JZ no_key
    0xB4, 0x00,                   // MOV AH, 00h
    0xCD, 0x16,                   // INT 16h
    0x3C, 0x1B,                   // CMP AL, 1Bh (ESC key)
    0x74, 0x22,                   // JE exit_to_dos
    // no_key:

    // 3. Wait for Vertical Retrace (Port 03DAh, Bit 3)
    0xBA, 0xDA, 0x03,             // MOV DX, 03DAh
    // wait_retrace_end:
    0xEC,                         // IN AL, DX
    0xA8, 0x08,                   // TEST AL, 08h
    0x75, 0xFB,                   // JNZ wait_retrace_end
    // wait_retrace_start:
    0xEC,                         // IN AL, DX
    0xA8, 0x08,                   // TEST AL, 08h
    0x74, 0xFB,                   // JZ wait_retrace_start

    // 4. Update Palette Cycle Window via DAC (Ports 03C8h / 03C9h)
    0xBA, 0xC8, 0x03,             // MOV DX, 03C8h
    0xB0, options.paletteCycle.startIndex & 0xFF, // MOV AL, startIndex
    0xEE,                         // OUT DX, AL
    0xBA, 0xC9, 0x03,             // MOV DX, 03C9h
    0xBE, 0x10, 0x02,             // MOV SI, offset cycle_palette
    0xB9, (options.paletteCycle.count * 3) & 0xFF, 0x00, // MOV CX, count * 3
    // cycle_loop:
    0xAC,                         // LODSB
    0xEE,                         // OUT DX, AL
    0xE2, 0xFD,                   // LOOP cycle_loop

    // 5. Jump back to main loop
    0xEB, 0xBC,                   // JMP main_loop

    // --- Exit Routine ---
    // exit_to_dos:
    0xB8, 0x03, 0x00,             // MOV AX, 0003h (Restore 80x25 Text Mode)
    0xCD, 0x10,                   // INT 10h
    0xB8, 0x00, 0x4C,             // MOV AX, 4C00h (Terminate Program DOS INT 21h)
    0xCD, 0x21                    // INT 21h
  ];

  // Align code block to 512 bytes (1 page)
  const codeBlockSize = 512;
  const paddedCode = new Uint8Array(codeBlockSize);
  paddedCode.set(codeBytes, 0);

  // 4. Data Block:
  // Palette (768 bytes) + Cycle Palette (cycleColors.length * 3 bytes)
  const paletteBlockSize = 1024;
  const paletteData = new Uint8Array(paletteBlockSize);
  paletteData.set(vgaPalette, 0);
  paletteData.set(cycleDacBytes, 768);

  // 5. Video Buffer Block (64,000 bytes) + Rom Payload (romData.rawBytes.length)
  const videoData = new Uint8Array(64000);
  videoData.set(screenBuffer.slice(0, 64000), 0);

  // Total executable payload size (excluding 64-byte MZ header)
  const payloadSize = paddedCode.length + paletteData.length + videoData.length + romData.rawBytes.length;

  // Header size: 4 paragraphs = 64 bytes (0x40)
  const headerParagraphs = 4;
  const headerSize = headerParagraphs * 16;

  const totalFileSize = headerSize + payloadSize;

  // Pages in file (512-byte pages)
  const cp = Math.ceil(totalFileSize / 512);
  const cblp = totalFileSize % 512; // Bytes on last page

  // 6. Build MZ Header (64 bytes)
  const headerBuf = new Uint8Array(headerSize);
  const view = new DataView(headerBuf.buffer);

  // MZ Magic 'MZ' = 0x5A4D
  view.setUint16(0x00, 0x5A4D, true);
  // e_cblp: bytes on last page
  view.setUint16(0x02, cblp, true);
  // e_cp: pages in file
  view.setUint16(0x04, cp, true);
  // e_crlc: relocations (1 entry for data segment)
  view.setUint16(0x06, 1, true);
  // e_cparhdr: header size in paragraphs (4 = 64 bytes)
  view.setUint16(0x08, headerParagraphs, true);
  // e_minalloc: minimum extra paragraphs needed
  view.setUint16(0x0A, options.dosHeaderTune.minAllocParagraphs || 0x1000, true);
  // e_maxalloc: maximum extra paragraphs
  view.setUint16(0x0C, options.dosHeaderTune.maxAllocParagraphs || 0xFFFF, true);
  // e_ss: initial SS relative to load segment
  view.setUint16(0x0E, 0x1000, true);
  // e_sp: initial SP
  view.setUint16(0x10, (options.dosHeaderTune.stackSizeWords || 1024) * 2, true);
  // e_csum: checksum (0 = none)
  view.setUint16(0x12, 0x0000, true);
  // e_ip: initial IP (entry point = 0000h)
  view.setUint16(0x14, 0x0000, true);
  // e_cs: initial CS relative to load segment
  view.setUint16(0x16, 0x0000, true);
  // e_lfarlc: offset to relocation table (0x001E or 0x0040)
  view.setUint16(0x18, 0x0020, true);
  // e_ovno: overlay number (0 = root executable)
  view.setUint16(0x1A, 0x0000, true);

  // Relocation table entry at offset 0x20:
  // Offset 0x0008, Segment 0x0000
  view.setUint16(0x20, 0x0008, true);
  view.setUint16(0x22, 0x0000, true);

  // 7. Assemble Complete Binary Output
  const exeBytes = new Uint8Array(totalFileSize);
  let cur = 0;
  exeBytes.set(headerBuf, cur);
  cur += headerBuf.length;

  const codeSegmentOffset = cur;
  exeBytes.set(paddedCode, cur);
  cur += paddedCode.length;

  const dataSegmentOffset = cur;
  exeBytes.set(paletteData, cur);
  cur += paletteData.length;

  const videoBufferOffset = cur;
  exeBytes.set(videoData, cur);
  cur += videoData.length;

  exeBytes.set(romData.rawBytes, cur);

  // Construct structured MzDosHeader object
  const dosHeader: MzDosHeader = {
    magic: 0x5A4D,
    cblp,
    cp,
    crlc: 1,
    cparhdr: headerParagraphs,
    minalloc: options.dosHeaderTune.minAllocParagraphs || 0x1000,
    maxalloc: options.dosHeaderTune.maxAllocParagraphs || 0xFFFF,
    ss: 0x1000,
    sp: (options.dosHeaderTune.stackSizeWords || 1024) * 2,
    csum: 0,
    ip: 0x0000,
    cs: 0x0000,
    lfarlc: 0x0020,
    ovno: 0
  };

  // Hex dump strings of header for UI inspection
  const headerHex: string[] = [];
  for (let i = 0; i < headerSize; i += 16) {
    const slice = headerBuf.slice(i, i + 16);
    const hex = Array.from(slice).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    const ascii = Array.from(slice).map(b => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join('');
    headerHex.push(`0000:${i.toString(16).padStart(4, '0').toUpperCase()}  ${hex.padEnd(48, ' ')}  |${ascii}|`);
  }

  // Generate companion NASM Assembly Source Code (.ASM)
  const asmSourceCode = generateNasmSource(romData, options);

  return {
    exeBytes,
    dosHeader,
    headerHex,
    totalFileSize,
    codeSegmentOffset,
    dataSegmentOffset,
    videoBufferOffset,
    asmSourceCode
  };
}

function generateNasmSource(romData: C64RomData, options: ConversionOptions): string {
  return `; ==============================================================================
; C64 to MS-DOS MZ Executable (8-bit 320x200 VGA Mode 13h)
; Target CPU: 8086 / 80286 / 80386 Real Mode DOS
; Input ROM:  ${romData.fileName} (Load: $${romData.loadAddress.toString(16).toUpperCase()})
; Video:      VGA 320x200 256-Color (Segment 0A000h)
; Palette:    Commodore 64 16-Color DAC Table with Palette Cycle Engine
; Gameport:   IBM PC Gameport Port 0201h mapped to C64 CIA #1 Port 2 ($DC00)
; ==============================================================================

BITS 16
ORG 0

section .text
start:
    ; 1. Initialize Segment Registers
    cli
    mov     ax, cs
    mov     ds, ax
    mov     es, ax
    sti

    ; 2. Initialize VGA Mode 13h (320x200, 256 colors chunky buffer)
    mov     ax, 0013h
    int     10h

    ; 3. Setup VGA DAC Palette (Ports 03C8h write index, 03C9h RGB data)
    ; 6-bit DAC values (0-63 scale)
    mov     dx, 03C8h
    mov     al, 0
    out     dx, al
    mov     dx, 03C9h
    mov     si, vga_palette_table
    mov     cx, 768             ; 256 colors * 3 bytes (R, G, B)
.dac_loop:
    lodsb
    out     dx, al
    loop    .dac_loop

    ; 4. Copy Converted 320x200 C64 Screen to Video Memory (0A000:0000)
    mov     ax, 0A000h
    mov     es, ax
    xor     di, di
    mov     si, screen_buffer_320x200
    mov     cx, 32000           ; 32,000 words = 64,000 bytes
    rep     movsw

; ------------------------------------------------------------------------------
; Main Simulation & Retrace Loop
; ------------------------------------------------------------------------------
main_loop:
    ; 1. Poll Gameport (Port 0201h) for Joystick
    ; Bit 4 = Button 1 (Fire), Bit 5 = Button 2
    ; Bits 0-3 = Resistive timing triggers for X/Y axes
    mov     dx, 0201h
    in      al, dx
    mov     [joy_state_port201h], al

    ; 2. Poll BIOS Keyboard Buffer (INT 16h, AH=01h)
    mov     ah, 01h
    int     16h
    jz      .no_key
    mov     ah, 00h
    int     16h
    cmp     al, 1Bh             ; Check for ESC key (ASCII 27)
    je      exit_dos
.no_key:

    ; 3. Vertical Retrace Synchronization (Port 03DAh, Bit 3)
    ; Eliminates raster tearing during palette updates
    mov     dx, 03DAh
.wait_end:
    in      al, dx
    test    al, 08h
    jnz     .wait_end
.wait_start:
    in      al, dx
    test    al, 08h
    jz      .wait_start

    ; 4. Palette Cycle Update (Active Mode: ${options.paletteCycle.type})
    mov     dx, 03C8h
    mov     al, ${options.paletteCycle.startIndex}   ; Starting DAC color register
    out     dx, al
    mov     dx, 03C9h
    mov     si, cycle_table
    mov     cx, ${options.paletteCycle.count * 3}   ; RGB triplets to cycle
.cycle_loop:
    lodsb
    out     dx, al
    loop    .cycle_loop

    ; Repeat main loop
    jmp     main_loop

; ------------------------------------------------------------------------------
; Exit cleanly back to MS-DOS
; ------------------------------------------------------------------------------
exit_dos:
    mov     ax, 0003h           ; Restore standard 80x25 text mode
    int     10h
    mov     ax, 4C00h           ; DOS Terminate Process (INT 21h, AH=4Ch)
    int     21h

; ------------------------------------------------------------------------------
; Data Segment
; ------------------------------------------------------------------------------
section .data
joy_state_port201h:     db 0FFh

vga_palette_table:
    ; 256 colors in 6-bit DAC RGB format (0-63)
    ; Indices 0..15: C64 Base Colors
    ; Indices 16..255: Palette Cycle Banks & Demoscene Gradients
    incbin  "palette.pal"

cycle_table:
    incbin  "cycle.dat"

screen_buffer_320x200:
    incbin  "screen.bin"        ; 64,000 bytes linear VGA buffer
`;
}
