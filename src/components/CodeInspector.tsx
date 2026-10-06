import React, { useState } from 'react';
import { Code, Terminal, Copy, Check } from 'lucide-react';
import { C64RomData } from '../types';
import { disassemble6502, DisassemblyLine } from '../utils/c64Parser';

interface CodeInspectorProps {
  romData: C64RomData;
  asmSourceCode: string;
}

export const CodeInspector: React.FC<CodeInspectorProps> = ({
  romData,
  asmSourceCode
}) => {
  const [activeTab, setActiveTab] = useState<'x86_asm' | 'c64_6502'>('x86_asm');
  const [copied, setCopied] = useState<boolean>(false);

  // Disassemble 6502 code
  const payload = romData.rawBytes.length > 2 && romData.format === 'PRG'
    ? romData.rawBytes.slice(2)
    : romData.rawBytes;
  const disassemblyLines: DisassemblyLine[] = disassemble6502(payload, romData.loadAddress, 150);

  const handleCopy = () => {
    const textToCopy = activeTab === 'x86_asm'
      ? asmSourceCode
      : disassemblyLines.map(l => `${l.address.toString(16).padStart(4, '0').toUpperCase()}  ${l.hexBytes}  ${l.instruction}${l.comment ? ` ; ${l.comment}` : ''}`).join('\n');

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#0f141d] rounded-xl border border-slate-800 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#131a26] border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-amber-400" />
          <h3 className="font-semibold text-sm text-slate-100">Disassembly & Target Real-Mode x86 ASM</h3>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-0.5 bg-slate-900 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab('x86_asm')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'x86_asm'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              16-Bit x86 MS-DOS ASM
            </button>
            <button
              onClick={() => setActiveTab('c64_6502')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'c64_6502'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              C64 6502 Disassembly
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Source'}</span>
          </button>
        </div>
      </div>

      {/* Code Editor Pane */}
      <div className="p-4">
        {activeTab === 'x86_asm' ? (
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-mono text-slate-300">Generated NASM 16-Bit Real Mode DOS Assembly:</span>
              <span className="font-mono text-[11px] text-slate-500">Mode 13h (320x200) + Port 201h</span>
            </div>
            <pre className="p-4 bg-black/80 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto max-h-[380px] leading-relaxed selection:bg-amber-900 selection:text-white">
              <code>{asmSourceCode}</code>
            </pre>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-mono text-slate-300">
                Original 6502 Bytecode from ${romData.loadAddress.toString(16).toUpperCase()}:
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                {disassemblyLines.length} instructions decoded
              </span>
            </div>
            <div className="p-4 bg-black/80 rounded-lg border border-slate-800 font-mono text-xs overflow-x-auto max-h-[380px] space-y-1">
              {disassemblyLines.map((line, idx) => (
                <div key={idx} className="flex items-baseline hover:bg-slate-800/40 px-1 py-0.5 rounded">
                  <span className="text-cyan-400 mr-4 font-bold select-none">
                    ${line.address.toString(16).padStart(4, '0').toUpperCase()}
                  </span>
                  <span className="text-slate-500 mr-4 select-none">
                    {line.hexBytes.padEnd(8, ' ')}
                  </span>
                  <span className="text-emerald-300 font-medium mr-4">
                    {line.instruction}
                  </span>
                  {line.comment && (
                    <span className="text-amber-400/90 text-[11px] italic">
                      ; {line.comment}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
