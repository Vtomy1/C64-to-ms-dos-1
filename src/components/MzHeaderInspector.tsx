import React, { useState } from 'react';
import { MzDosHeader } from '../types';
import { FileCode, Binary, Layers, Info } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'fields' | 'hex' | 'memory'>('fields');
  const [hoveredField, setHoveredField] = useState<string | null>(null);

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
          <h3 className="font-semibold text-sm text-slate-100">MS-DOS MZ Executable Header Inspector</h3>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-900/90 rounded-lg border border-slate-800">
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
          <button
            onClick={() => setActiveTab('memory')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'memory'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Segment Layout
          </button>
        </div>
      </div>

      {/* Content Panes */}
      <div className="p-4">
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

        {activeTab === 'memory' && (
          <div className="space-y-3 text-xs">
            <p className="text-slate-400">
              Executable binary memory map layout when loaded into conventional DOS memory by <span className="font-mono text-slate-200">INT 21h, AH=4Bh (EXEC)</span>:
            </p>

            <div className="space-y-1.5 font-mono text-[11px]">
              {/* DOS PSP */}
              <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 mr-3">PSP:0000</span>
                  <span className="text-slate-400">DOS Program Segment Prefix</span>
                </div>
                <span className="text-slate-500">256 bytes (0x100)</span>
              </div>

              {/* MZ Header */}
              <div className="p-2.5 rounded bg-amber-950/30 border border-amber-800/50 flex items-center justify-between">
                <div>
                  <span className="text-amber-400 mr-3">FILE:0000</span>
                  <span className="text-amber-200 font-semibold">MS-DOS MZ Header (4 Paragraphs)</span>
                </div>
                <span className="text-amber-300 font-bold">64 bytes (0x0040)</span>
              </div>

              {/* Code Segment */}
              <div className="p-2.5 rounded bg-cyan-950/30 border border-cyan-800/50 flex items-center justify-between">
                <div>
                  <span className="text-cyan-400 mr-3">CS:0000</span>
                  <span className="text-cyan-200 font-semibold">Real-Mode 16-Bit Entry Code (VGA Mode 13h / Gameport loop)</span>
                </div>
                <span className="text-cyan-300">Offset +0x{codeOffset.toString(16).toUpperCase()}</span>
              </div>

              {/* Data / Palette Block */}
              <div className="p-2.5 rounded bg-purple-950/30 border border-purple-800/50 flex items-center justify-between">
                <div>
                  <span className="text-purple-400 mr-3">DS:0200h</span>
                  <span className="text-purple-200 font-semibold">VGA DAC 256-Color Palette & Cycle Table</span>
                </div>
                <span className="text-purple-300">Offset +0x{dataOffset.toString(16).toUpperCase()}</span>
              </div>

              {/* Video Screen Buffer */}
              <div className="p-2.5 rounded bg-emerald-950/30 border border-emerald-800/50 flex items-center justify-between">
                <div>
                  <span className="text-emerald-400 mr-3">ES:A000h</span>
                  <span className="text-emerald-200 font-semibold">320x200 Linear 8-Bit Chunky Screen Buffer</span>
                </div>
                <span className="text-emerald-300 font-bold">64,000 bytes (0xFA00)</span>
              </div>

              {/* Total size */}
              <div className="p-2.5 rounded bg-slate-900 border border-slate-700 flex items-center justify-between font-bold text-slate-200">
                <span>TOTAL GENERATED EXECUTABLE SIZE</span>
                <span className="text-amber-400 tabular-nums">
                  {(totalFileSize / 1024).toFixed(2)} KB ({totalFileSize.toLocaleString()} bytes)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
