import { C64RomData } from '../types';

export interface DisassemblyLine {
  address: number;
  hexBytes: string;
  instruction: string;
  comment?: string;
}

// 6502 Opcode table subset for common instructions
const OPCODES_6502: Record<number, { mnemonic: string; bytes: number; mode: string }> = {
  0x00: { mnemonic: 'BRK', bytes: 1, mode: 'implied' },
  0x10: { mnemonic: 'BPL', bytes: 2, mode: 'relative' },
  0x18: { mnemonic: 'CLC', bytes: 1, mode: 'implied' },
  0x20: { mnemonic: 'JSR', bytes: 3, mode: 'absolute' },
  0x29: { mnemonic: 'AND', bytes: 2, mode: 'immediate' },
  0x30: { mnemonic: 'BMI', bytes: 2, mode: 'relative' },
  0x38: { mnemonic: 'SEC', bytes: 1, mode: 'implied' },
  0x4C: { mnemonic: 'JMP', bytes: 3, mode: 'absolute' },
  0x58: { mnemonic: 'CLI', bytes: 1, mode: 'implied' },
  0x60: { mnemonic: 'RTS', bytes: 1, mode: 'implied' },
  0x78: { mnemonic: 'SEI', bytes: 1, mode: 'implied' },
  0x85: { mnemonic: 'STA', bytes: 2, mode: 'zeropage' },
  0x8D: { mnemonic: 'STA', bytes: 3, mode: 'absolute' },
  0x8E: { mnemonic: 'STX', bytes: 3, mode: 'absolute' },
  0x8C: { mnemonic: 'STY', bytes: 3, mode: 'absolute' },
  0x90: { mnemonic: 'BCC', bytes: 2, mode: 'relative' },
  0xA0: { mnemonic: 'LDY', bytes: 2, mode: 'immediate' },
  0xA2: { mnemonic: 'LDX', bytes: 2, mode: 'immediate' },
  0xA5: { mnemonic: 'LDA', bytes: 2, mode: 'zeropage' },
  0xA9: { mnemonic: 'LDA', bytes: 2, mode: 'immediate' },
  0xAC: { mnemonic: 'LDY', bytes: 3, mode: 'absolute' },
  0xAD: { mnemonic: 'LDA', bytes: 3, mode: 'absolute' },
  0xAE: { mnemonic: 'LDX', bytes: 3, mode: 'absolute' },
  0xB0: { mnemonic: 'BCS', bytes: 2, mode: 'relative' },
  0xC9: { mnemonic: 'CMP', bytes: 2, mode: 'immediate' },
  0xD0: { mnemonic: 'BNE', bytes: 2, mode: 'relative' },
  0xE6: { mnemonic: 'INC', bytes: 2, mode: 'zeropage' },
  0xE8: { mnemonic: 'INX', bytes: 1, mode: 'implied' },
  0xEA: { mnemonic: 'NOP', bytes: 1, mode: 'implied' },
  0xEE: { mnemonic: 'INC', bytes: 3, mode: 'absolute' },
  0xF0: { mnemonic: 'BEQ', bytes: 2, mode: 'relative' }
};

export function parseC64Binary(fileData: Uint8Array, fileName: string): C64RomData {
  let loadAddress = 0x0801;
  let rawBytes = fileData;
  let format: C64RomData['format'] = 'PRG';
  let title = fileName.replace(/\.[^/.]+$/, '').toUpperCase();

  const ext = fileName.split('.').pop()?.toLowerCase();

  if (ext === 'crt' && fileData.length >= 64) {
    format = 'CRT';
    // Check CRT signature "C64 CARTRIDGE   "
    const headerStr = String.fromCharCode(...fileData.slice(0, 16));
    if (headerStr.startsWith('C64 CARTRIDGE')) {
      // Find CHIP packet (usually offset 0x40)
      let chipOffset = 0x40;
      while (chipOffset < fileData.length - 16) {
        const chipSig = String.fromCharCode(...fileData.slice(chipOffset, chipOffset + 4));
        if (chipSig === 'CHIP') {
          const loadAddrHigh = fileData[chipOffset + 8];
          const loadAddrLow = fileData[chipOffset + 9];
          loadAddress = (loadAddrHigh << 8) | loadAddrLow;
          const romSize = (fileData[chipOffset + 10] << 8) | fileData[chipOffset + 11];
          rawBytes = fileData.slice(chipOffset + 16, chipOffset + 16 + (romSize > 0 ? romSize : 8192));
          break;
        }
        chipOffset += 16;
      }
    }
  } else if (ext === 'd64') {
    format = 'D64';
    // Standard 174,848 byte D64 disk image
    // Directory is on Track 18, Sector 1 (offset ~0x16600)
    // For convenience extract first file payload if possible, otherwise use sector data
    rawBytes = fileData.slice(0x16600, 0x16600 + Math.min(4096, fileData.length - 0x16600));
    loadAddress = 0x0801;
  } else if (fileData.length >= 2) {
    // Standard PRG has 2-byte header
    loadAddress = fileData[0] | (fileData[1] << 8);
    rawBytes = fileData;
  }

  // Detect BASIC header (0x0801 has line pointers and token 0x9E "SYS")
  let isBasic = false;
  let entryPoint = loadAddress;

  const payload = rawBytes.length > 2 && format === 'PRG' ? rawBytes.slice(2) : rawBytes;

  if (loadAddress === 0x0801 && payload.length > 10) {
    isBasic = true;
    for (let i = 0; i < Math.min(30, payload.length - 4); i++) {
      if (payload[i] === 0x9E) { // SYS token
        let numStr = '';
        for (let j = i + 1; j < i + 10; j++) {
          const ch = String.fromCharCode(payload[j]);
          if (ch >= '0' && ch <= '9') {
            numStr += ch;
          } else if (ch !== ' ') {
            break;
          }
        }
        if (numStr.length > 0) {
          entryPoint = parseInt(numStr, 10);
        }
        break;
      }
    }
  }

  // Scan for VIC-II raster/palette cycling instructions and CIA 1 Joystick reads
  let vicBorder = 0; // Black
  let vicBg = 6;     // Blue
  let rasterDetected = false;
  let cycleType: C64RomData['detectedCycleType'] = 'raster_bars';

  for (let i = 0; i < payload.length - 2; i++) {
    const b0 = payload[i];
    const b1 = payload[i + 1];
    const b2 = payload[i + 2];

    // STA $D020 (border)
    if (b0 === 0x8D && b1 === 0x20 && b2 === 0xD0) {
      rasterDetected = true;
      if (i >= 2 && payload[i - 2] === 0xA9) {
        vicBorder = payload[i - 1] & 0x0F;
      }
    }
    // STA $D021 (background)
    if (b0 === 0x8D && b1 === 0x21 && b2 === 0xD0) {
      if (i >= 2 && payload[i - 2] === 0xA9) {
        vicBg = payload[i - 1] & 0x0F;
      }
    }
    // LDA $D012 (raster line read)
    if (b0 === 0xAD && b1 === 0x12 && b2 === 0xD0) {
      rasterDetected = true;
      cycleType = 'copper_rainbow';
    }
    // LDA $DC00 (CIA1 Port A - Joystick #2)
    if (b0 === 0xAD && b1 === 0x00 && b2 === 0xDC) {
      // Game reads joystick!
    }
  }

  return {
    fileName,
    fileSize: fileData.length,
    format,
    loadAddress,
    entryPoint,
    rawBytes,
    basicProgram: isBasic,
    vicBorderColor: vicBorder,
    vicBgColor: vicBg,
    title,
    description: `Loaded ${format} binary (${(fileData.length / 1024).toFixed(1)} KB) targeting memory address $${loadAddress.toString(16).toUpperCase().padStart(4, '0')}.`,
    rasterCycleDetected: rasterDetected,
    detectedCycleType: cycleType
  };
}

export function disassemble6502(bytes: Uint8Array, startAddress: number, maxLines = 100): DisassemblyLine[] {
  const lines: DisassemblyLine[] = [];
  let offset = 0;
  let currentAddress = startAddress;

  while (offset < bytes.length && lines.length < maxLines) {
    const opcode = bytes[offset];
    const info = OPCODES_6502[opcode];

    if (!info) {
      // Unknown or raw data byte
      lines.push({
        address: currentAddress,
        hexBytes: opcode.toString(16).padStart(2, '0').toUpperCase(),
        instruction: `.BYTE $${opcode.toString(16).padStart(2, '0').toUpperCase()}`
      });
      offset += 1;
      currentAddress += 1;
      continue;
    }

    let hexStr = opcode.toString(16).padStart(2, '0').toUpperCase();
    let operandStr = '';
    let comment: string | undefined;

    if (info.bytes === 1) {
      operandStr = '';
    } else if (info.bytes === 2) {
      const b1 = offset + 1 < bytes.length ? bytes[offset + 1] : 0;
      hexStr += ` ${b1.toString(16).padStart(2, '0').toUpperCase()}`;
      if (info.mode === 'immediate') {
        operandStr = `#$${b1.toString(16).padStart(2, '0').toUpperCase()}`;
      } else if (info.mode === 'zeropage') {
        operandStr = `$${b1.toString(16).padStart(2, '0').toUpperCase()}`;
      } else if (info.mode === 'relative') {
        const signedOffset = b1 > 127 ? b1 - 256 : b1;
        const target = currentAddress + 2 + signedOffset;
        operandStr = `$${(target & 0xFFFF).toString(16).padStart(4, '0').toUpperCase()}`;
      }
    } else if (info.bytes === 3) {
      const b1 = offset + 1 < bytes.length ? bytes[offset + 1] : 0;
      const b2 = offset + 2 < bytes.length ? bytes[offset + 2] : 0;
      const addr = (b2 << 8) | b1;
      hexStr += ` ${b1.toString(16).padStart(2, '0').toUpperCase()} ${b2.toString(16).padStart(2, '0').toUpperCase()}`;
      operandStr = `$${addr.toString(16).padStart(4, '0').toUpperCase()}`;

      // Meaningful C64 memory hardware labels
      if (addr === 0xD020) comment = 'VIC-II Border Color';
      else if (addr === 0xD021) comment = 'VIC-II Background Color';
      else if (addr === 0xD012) comment = 'VIC-II Raster Line Trigger';
      else if (addr === 0xD011) comment = 'VIC-II Control Register 1';
      else if (addr === 0xD015) comment = 'VIC-II Sprite Enable Register';
      else if (addr === 0xDC00) comment = 'CIA1 Port A (Joystick 2)';
      else if (addr === 0xDC01) comment = 'CIA1 Port B (Joystick 1)';
      else if (addr === 0x0400) comment = 'C64 Screen Text RAM';
    }

    lines.push({
      address: currentAddress,
      hexBytes: hexStr.padEnd(8, ' '),
      instruction: `${info.mnemonic} ${operandStr}`.trim(),
      comment
    });

    offset += info.bytes;
    currentAddress += info.bytes;
  }

  return lines;
}
