import React, { useState } from 'react';
import { MzDosHeader } from '../types';
import { Binary, Layers, Info, Cpu, Database, HardDrive, ShieldAlert, ArrowDown } from 'lucide-react';

interface MzHeaderInspectorProps {
  dosHeader: MzDosHeader;
  headerHex: string[];
  totalFileSize: number;
  codeOffset: number;
  dataOffset: number;
  videoOffset: number;
}

export const MzHeaderInspector: React.FC<MzHeaderInspectorProps> = ({
  dosHeader,
  headerHex,
  totalFileSize,
  codeOffset,
  dataOffset,
  videoOffset
}) => {
  const [activeTab, setActiveTab] = useState<'memory' | 'fields' | 'hex'>('memory');
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  // Compute memory segment metrics
  const headerSize = dosHeader.cparhdr * 16; // 64 bytes
  const codeSize = dataOffset - codeOffset; // 512 bytes
  const dataSize = totalFileSize - dataOffset; // palette + video + rom payload (~65 KB)
  const stackSizeBytes = dosHeader.sp; // e.g. 2048 bytes
  const minAllocBytes = dosHeader.minalloc * 16; // e.g. 64KB
  const videoBufferSize = 64000; // 320x200 bytes

  // Estimated total conventional memory footprint when loaded in DOS
  const totalDosFootprint = 256 + totalFileSize + stackSizeBytes + minAllocBytes;

  const fields = [
    {
      name: 'e_magic',
      label: 'Signature Magic',
      value: `0x${dosHeader.magic.toString(16).toUpperCase()}`,
      decoded: '"MZ" (Mark Zbikowski / MS-DOS Executable)',
      offset: '0x0000',
      size: '2 bytes',
      desc: 'The identifying 16-bit word that all MS-DOS 2.0+ loaders check before executing.'
    },
    {
      name: 'e_cblp',
      label: 'Bytes on Last Page',
      value: `${dosHeader.cblp} (0x${dosHeader.cblp.toString(16).toUpperCase()})`,
      decoded: `${dosHeader.cblp} bytes`,
      offset: '0x0002',
      size: '2 bytes',
      desc: 'Number of bytes used in the final 512-byte block of the executable file.'
    },
    {
      name: 'e_cp',
      label: 'Pages in File',
      value: `${dosHeader.cp} (0x${dosHeader.cp.toString(16).toUpperCase()})`,
      decoded: `${dosHeader.cp * 512} bytes total allocation`,
      offset: '0x0004',
      size: '2 bytes',
      desc: 'Total number of 512-byte pages needed to contain the entire file.'
    },
    {
      name: 'e_crlc',
      label: 'Relocations Count',
      value: `${dosHeader.crlc}`,
      decoded: `${dosHeader.crlc} entry in table`,
      offset: '0x0006',
      size: '2 bytes',
      desc: 'Number of relocation pointers required by the DOS loader to fixup segment addresses.'
    },
    {
      name: 'e_cparhdr',
      label: 'Header Paragraphs',
      value: `${dosHeader.cparhdr}`,
      decoded: `${dosHeader.cparhdr * 16} bytes header size`,
      offset: '0x0008',
      size: '2 bytes',
      desc: 'Size of the header formatted in 16-byte paragraphs. Entry code starts immediately after.'
    },
    {
      name: 'e_minalloc',
      label: 'Min Extra Paragraphs',
      value: `0x${dosHeader.minalloc.toString(16).toUpperCase()}`,
      decoded: `${dosHeader.minalloc * 16} bytes RAM`,
      offset: '0x000A',
      size: '2 bytes',
      desc: 'Minimum extra memory paragraphs DOS must allocate beyond the program image.'
    },
    {
      name: 'e_maxalloc',
      label: 'Max Extra Paragraphs',
      value: `0x${dosHeader.maxalloc.toString(16).toUpperCase()}`,
      decoded: 'All available conventional memory',
      offset: '0x000C',
      size: '2 bytes',
      desc: 'Maximum extra paragraphs requested. 0xFFFF requests all remaining DOS conventional RAM.'
    },
    {
      name: 'e_ss',
      label: 'Initial SS (Stack Segment)',
      value: `0x${dosHeader.ss.toString(16).toUpperCase()}`,
      decoded: 'Relative to program load segment',
      offset: '0x000E',
      size: '2 bytes',
      desc: 'Initial SS register value relative to the start of the program.'
    },
    {
      name: 'e_sp',
      label: 'Initial SP (Stack Pointer)',
      value: `0x${dosHeader.sp.toString(16).toUpperCase()}`,
      decoded: `${dosHeader.sp} bytes stack top`,
      offset: '0x0010',
      size: '2 bytes',
      desc: 'Initial SP register value pointing to the top of the stack segment.'
    },
    {
      name: 'e_csum',
      label: 'Checksum',
      value: `0x${dosHeader.csum.toString(16).toUpperCase()}`,
      decoded: '0 (Unused by MS-DOS)',
      offset: '0x0012',
      size: '2 bytes',
      desc: 'Complement checksum. Most compilers and DOS versions set this to 0 and ignore it.'
    },
    {
      name: 'e_ip',
      label: 'Initial IP (Entry Point)',
      value: `0x${dosHeader.ip.toString(16).padStart(4, '0').toUpperCase()}`,
      decoded: 'Entry instruction offset',
      offset: '0x0014',
      size: '2 bytes',
      desc: 'Offset of the first real-mode machine code instruction inside the code segment.'
    },
    {
      name: 'e_cs',
      label: 'Initial CS (Code Segment)',
      value: `0x${dosHeader.cs.toString(16).padStart(4, '0').toUpperCase()}`,
      decoded: 'Relative CS:0000',
      offset: '0x0016',
      size: '2 bytes',
      desc: 'Code segment register relative to the load segment assigned by the DOS EXEC call.'
    },
    {
      name: 'e_lfarlc',
      label: 'Relocation Table Offset',
      value: `0x${dosHeader.lfarlc.toString(16).padStart(4, '0').toUpperCase()}`,
      decoded: 'Offset 32 (0x0020)',
      offset: '0x0018',
      size: '2 bytes',
      desc: 'File offset pointing to the beginning of the relocation table.'
    },
    {
      name: 'e_ovno',
      label: 'Overlay Number',
      value: `${dosHeader.ovno}`,
      decoded: 'Main executable program',
      offset: '0x001A',
      size: '2 bytes',
      desc: 'Identifies overlay index. 0 represents the resident main executable program.'
    }
  ];

  return (
    <div className="bg-[#0f141d] rounded-xl border border-slate-800 overflow-hidden shadow-xl">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#131a26] border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Binary className="w-4 h-4 text-amber-400" />
          <h3 className="font-semibold text-sm text-slate-100">MS-DOS MZ Executable Header & Memory Inspector</h3>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-900/90 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('memory')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'memory'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Memory Map
          </button>
          <button
            onClick={() => setActiveTab('fields')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'fields'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Structure Fields
          </button>
          <button
            onClick={() => setActiveTab('hex')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'hex'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Hex Header Dump
          </button>
        </div>
      </div>

      {/* Content Panes */}
      <div className="p-4">
        {/* NEW: Visual Memory Map Section */}
        {activeTab === 'memory' && (
          <div className="space-y-5">
            {/* Visual Footprint Proportion Bar */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
                <span className="font-semibold flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Executable Memory Footprint Visualization (MS-DOS Conventional RAM)</span>
                </span>
                <span className="font-mono text-amber-300 tabular-nums text-[11px]">
                  Total Runtime Footprint: {(totalDosFootprint / 1024).toFixed(1)} KB ({totalDosFootprint.toLocaleString()} B)
                </span>
              </div>

              {/* Multi-segment visual memory strip */}
              <div className="h-7 w-full rounded-lg bg-black/60 border border-slate-700/80 overflow-hidden flex shadow-inner">
                {/* DOS PSP */}
                <div
                  onMouseEnter={() => setHoveredSegment('psp')}
                  onMouseLeave={() => setHoveredSegment(null)}
                  className="bg-slate-700 hover:brightness-125 transition-all relative group cursor-pointer flex items-center justify-center text-[10px] font-mono text-slate-200 font-bold border-r border-black/40"
                  style={{ width: '4%' }}
                  title="DOS PSP: 256 bytes"
                >
                  PSP
                </div>

                {/* MZ Header */}
                <div
                  onMouseEnter={() => setHoveredSegment('header')}
                  onMouseLeave={() => setHoveredSegment(null)}
                  className="bg-amber-600 hover:brightness-125 transition-all relative group cursor-pointer flex items-center justify-center text-[10px] font-mono text-amber-100 font-bold border-r border-black/40"
                  style={{ width: '3%' }}
                  title="MZ Header: 64 bytes"
                >
                  MZ
                </div>

                {/* Code Segment */}
                <div
                  onMouseEnter={() => setHoveredSegment('code')}
                  onMouseLeave={() => setHoveredSegment(null)}
                  className="bg-cyan-600 hover:brightness-125 transition-all relative group cursor-pointer flex items-center justify-center text-[10px] font-mono text-cyan-100 font-bold border-r border-black/40"
                  style={{ width: '6%' }}
                  title="Code Segment (CS): 512 bytes"
                >
                  CS
                </div>

                {/* Data Segment & Video Buffer */}
                <div
                  onMouseEnter={() => setHoveredSegment('data')}
                  onMouseLeave={() => setHoveredSegment(null)}
                  className="bg-purple-600 hover:brightness-125 transition-all relative group cursor-pointer flex items-center justify-center text-[10px] font-mono text-purple-100 font-bold border-r border-black/40"
                  style={{ width: '45%' }}
                  title={`Data Segment (DS) & Video Buffer: ${(dataSize / 1024).toFixed(1)} KB`}
                >
                  DATA (DS) & 320x200 VRAM ({((dataSize / totalDosFootprint) * 100).toFixed(0)}%)
                </div>

                {/* Stack Space */}
                <div
                  onMouseEnter={() => setHoveredSegment('stack')}
                  onMouseLeave={() => setHoveredSegment(null)}
                  className="bg-rose-600 hover:brightness-125 transition-all relative group cursor-pointer flex items-center justify-center text-[10px] font-mono text-rose-100 font-bold border-r border-black/40"
                  style={{ width: '12%' }}
                  title={`Stack Space (SS:SP): ${(stackSizeBytes / 1024).toFixed(1)} KB`}
                >
                  STACK (SS)
                </div>

                {/* Dynamic Free Memory Allocation */}
                <div
                  onMouseEnter={() => setHoveredSegment('extra')}
                  onMouseLeave={() => setHoveredSegment(null)}
                  className="bg-emerald-800/60 hover:brightness-125 transition-all relative group cursor-pointer flex items-center justify-center text-[10px] font-mono text-emerald-200 border-dashed"
                  style={{ width: '30%' }}
                  title={`Min Alloc Reserve (e_minalloc): ${(minAllocBytes / 1024).toFixed(0)} KB`}
                >
                  RESERVE (e_minalloc)
                </div>
              </div>

              {/* Segment legend chips */}
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-2">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-cyan-500 inline-block" />
                  <span>Code Segment (CS)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-purple-500 inline-block" />
                  <span>Data Segment (DS)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block" />
                  <span>Stack Space (SS:SP)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" />
                  <span>MZ Header (64B)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-600 inline-block" />
                  <span>Min Extra Heap</span>
                </span>
              </div>
            </div>

            {/* Structured Segment Breakdown Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 1. CODE SEGMENT */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  hoveredSegment === 'code'
                    ? 'bg-cyan-950/50 border-cyan-400 shadow-lg'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <span className="font-semibold text-xs text-cyan-200">Code Segment (CS)</span>
                  </div>
                  <span className="font-mono text-[10px] text-cyan-300 font-bold bg-cyan-950/70 border border-cyan-800/80 px-2 py-0.5 rounded">
                    CS:0000h
                  </span>
                </div>

                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Entry Point (IP):</span>
                    <span className="text-slate-200 font-bold">0x{dosHeader.ip.toString(16).padStart(4, '0').toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>File Offset:</span>
                    <span className="text-slate-200">0x{codeOffset.toString(16).padStart(4, '0').toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Segment Size:</span>
                    <span className="text-cyan-300 font-bold tabular-nums">{codeSize} bytes</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Target Arch:</span>
                    <span className="text-slate-300">8086 Real Mode</span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-400 leading-snug">
                  Contains VGA Mode 13h switch (<span className="font-mono text-cyan-300">INT 10h, AX=0013h</span>), Gameport poller (<span className="font-mono text-cyan-300">Port 0201h</span>), VRetrace sync (<span className="font-mono text-cyan-300">Port 03DAh</span>), and palette cycle engine.
                </div>
              </div>

              {/* 2. DATA SEGMENT */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  hoveredSegment === 'data'
                    ? 'bg-purple-950/50 border-purple-400 shadow-lg'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-purple-400" />
                    <span className="font-semibold text-xs text-purple-200">Data Segment (DS)</span>
                  </div>
                  <span className="font-mono text-[10px] text-purple-300 font-bold bg-purple-950/70 border border-purple-800/80 px-2 py-0.5 rounded">
                    DS:0200h
                  </span>
                </div>

                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>File Offset:</span>
                    <span className="text-slate-200">0x{dataOffset.toString(16).padStart(4, '0').toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Palette DAC Block:</span>
                    <span className="text-slate-200 font-bold tabular-nums">768 bytes (256x3)</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>320x200 VRAM Target:</span>
                    <span className="text-emerald-300 font-bold">ES:A000h</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Total Data Size:</span>
                    <span className="text-purple-300 font-bold tabular-nums">{(dataSize / 1024).toFixed(1)} KB</span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-400 leading-snug">
                  Encodes 18-bit DAC palette cycle registers (<span className="font-mono text-purple-300">03C8h/03C9h</span>), linear Mode 13h buffer, and embedded C64 program bytecode.
                </div>
              </div>

              {/* 3. STACK SPACE */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  hoveredSegment === 'stack'
                    ? 'bg-rose-950/50 border-rose-400 shadow-lg'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-rose-400" />
                    <span className="font-semibold text-xs text-rose-200">Stack Space (SS:SP)</span>
                  </div>
                  <span className="font-mono text-[10px] text-rose-300 font-bold bg-rose-950/70 border border-rose-800/80 px-2 py-0.5 rounded">
                    SS:0x{dosHeader.ss.toString(16).toUpperCase()}
                  </span>
                </div>

                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Initial SP (Top):</span>
                    <span className="text-rose-300 font-bold">0x{dosHeader.sp.toString(16).padStart(4, '0').toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Stack Capacity:</span>
                    <span className="text-slate-200 tabular-nums">{stackSizeBytes} bytes ({stackSizeBytes / 2} words)</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Min Allocation:</span>
                    <span className="text-slate-200 font-bold tabular-nums">{(minAllocBytes / 1024).toFixed(0)} KB (e_minalloc)</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Growth Direction:</span>
                    <span className="text-rose-400 flex items-center gap-1 font-bold">
                      <ArrowDown className="w-3 h-3" /> Downward
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-400 leading-snug">
                  Allocates initial real-mode call stack for BIOS interrupt dispatching (<span className="font-mono text-rose-300">INT 10h/16h/21h</span>) and hardware raster timing routines.
                </div>
              </div>
            </div>

            {/* Memory Address Space Layout Table */}
            <div className="p-3 bg-black/50 rounded-xl border border-slate-800 overflow-x-auto">
              <div className="text-xs font-semibold text-slate-300 mb-2.5 flex items-center justify-between">
                <span>MS-DOS Real-Mode Segment Address Table</span>
                <span className="text-[11px] text-slate-500 font-mono">Paragraph alignment (16-byte boundaries)</span>
              </div>
              <table className="w-full text-left font-mono text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] text-slate-500 uppercase">
                    <th className="pb-2 font-medium">Memory Region</th>
                    <th className="pb-2 font-medium">Segment Register</th>
                    <th className="pb-2 font-medium">Base Address</th>
                    <th className="pb-2 font-medium text-right">Size</th>
                    <th className="pb-2 font-medium text-right">Permissions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-[11px]">
                  <tr className="hover:bg-slate-800/40">
                    <td className="py-2 text-slate-400 font-sans">Program Segment Prefix (PSP)</td>
                    <td className="py-2 text-slate-500">DS / ES (Initial)</td>
                    <td className="py-2 text-slate-400">PSP:0000h</td>
                    <td className="py-2 text-right text-slate-400 tabular-nums">256 B</td>
                    <td className="py-2 text-right text-amber-400/80">Read / Write</td>
                  </tr>
                  <tr className="hover:bg-slate-800/40">
                    <td className="py-2 text-amber-300 font-sans font-medium">MS-DOS MZ Header</td>
                    <td className="py-2 text-amber-400">FILE:0000h</td>
                    <td className="py-2 text-slate-400">CS:0000h (File)</td>
                    <td className="py-2 text-right text-amber-300 font-bold tabular-nums">{headerSize} B</td>
                    <td className="py-2 text-right text-slate-400">Read Only</td>
                  </tr>
                  <tr className="hover:bg-slate-800/40">
                    <td className="py-2 text-cyan-300 font-sans font-medium">Executable Machine Code</td>
                    <td className="py-2 text-cyan-400 font-bold">CS (Code Segment)</td>
                    <td className="py-2 text-cyan-300">CS:0000h</td>
                    <td className="py-2 text-right text-cyan-300 font-bold tabular-nums">{codeSize} B</td>
                    <td className="py-2 text-right text-cyan-400">Execute / Read</td>
                  </tr>
                  <tr className="hover:bg-slate-800/40">
                    <td className="py-2 text-purple-300 font-sans font-medium">Palette DAC & Program Data</td>
                    <td className="py-2 text-purple-400 font-bold">DS (Data Segment)</td>
                    <td className="py-2 text-purple-300">DS:0200h</td>
                    <td className="py-2 text-right text-purple-300 font-bold tabular-nums">{(dataSize / 1024).toFixed(1)} KB</td>
                    <td className="py-2 text-right text-purple-400">Read / Write</td>
                  </tr>
                  <tr className="hover:bg-slate-800/40">
                    <td className="py-2 text-emerald-300 font-sans font-medium">VGA Mode 13h Framebuffer</td>
                    <td className="py-2 text-emerald-400 font-bold">ES:A000h (VRAM)</td>
                    <td className="py-2 text-emerald-300">A000:0000h</td>
                    <td className="py-2 text-right text-emerald-300 font-bold tabular-nums">64.0 KB</td>
                    <td className="py-2 text-right text-emerald-400">Video I/O Chunky</td>
                  </tr>
                  <tr className="hover:bg-slate-800/40">
                    <td className="py-2 text-rose-300 font-sans font-medium">Application Stack Space</td>
                    <td className="py-2 text-rose-400 font-bold">SS:SP (Stack)</td>
                    <td className="py-2 text-rose-300">SS:0000h - {dosHeader.sp.toString(16).toUpperCase()}h</td>
                    <td className="py-2 text-right text-rose-300 font-bold tabular-nums">{(stackSizeBytes / 1024).toFixed(1)} KB</td>
                    <td className="py-2 text-right text-rose-400">Push / Pop LIFO</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Structure Fields Tab */}
        {activeTab === 'fields' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {fields.map((f) => (
                <div
                  key={f.name}
                  onMouseEnter={() => setHoveredField(f.name)}
                  onMouseLeave={() => setHoveredField(null)}
                  className={`p-2.5 rounded-lg border transition-all ${
                    hoveredField === f.name
                      ? 'bg-slate-800/80 border-amber-500/50 shadow'
                      : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-cyan-300 font-semibold">{f.name}</span>
                    <span className="font-mono text-[10px] text-slate-500">{f.offset} ({f.size})</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-slate-300 font-medium">{f.label}</span>
                    <span className="font-mono font-bold text-amber-300 tabular-nums">{f.value}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 truncate">{f.decoded}</div>
                </div>
              ))}
            </div>

            {hoveredField && (
              <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-mono font-bold text-amber-300 mr-2">{hoveredField}:</span>
                  {fields.find((f) => f.name === hoveredField)?.desc}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hex Dump Tab */}
        {activeTab === 'hex' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              Raw 64-byte MS-DOS MZ header (first 4 paragraphs) containing magic <span className="font-mono text-amber-300">4D 5A ("MZ")</span>, page sizes, and relocation pointer:
            </p>
            <div className="p-3 bg-black/70 rounded-lg border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto leading-relaxed selection:bg-emerald-900 selection:text-white">
              {headerHex.map((line, idx) => (
                <div key={idx} className="whitespace-pre hover:bg-slate-800/50 px-1 rounded">
                  {line}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-500/30 border border-amber-500 inline-block" />
                <span>0x0000: 'MZ' Signature (5A 4D)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-cyan-500/30 border border-cyan-500 inline-block" />
                <span>0x0014: Entry Point CS:IP (0000:0000)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-purple-500/30 border border-purple-500 inline-block" />
                <span>0x0020: Relocation Table</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
