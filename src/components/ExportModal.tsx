import React from 'react';
import { Download, Terminal, X, CheckCircle, HardDrive, FileCode } from 'lucide-react';
import { GeneratedExeResult } from '../utils/mzExeBuilder';
import { C64RomData } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  exeResult: GeneratedExeResult;
  romData: C64RomData;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  exeResult,
  romData
}) => {
  if (!isOpen) return null;

  const baseFileName = romData.fileName.replace(/\.[^/.]+$/, '').toUpperCase();

  // Helper to trigger file download in browser
  const downloadBlob = (data: Uint8Array | string, filename: string, mime: string) => {
    const blob = typeof data === 'string'
      ? new Blob([data], { type: mime })
      : new Blob([data.buffer as ArrayBuffer], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadExe = () => {
    downloadBlob(exeResult.exeBytes, `${baseFileName}.EXE`, 'application/x-msdownload');
  };

  const handleDownloadAsm = () => {
    downloadBlob(exeResult.asmSourceCode, `${baseFileName}.ASM`, 'text/plain');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0f141d] border border-slate-800 rounded-xl shadow-2xl max-w-xl w-full overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#131a26] border-b border-slate-800">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-base text-slate-100">Export MS-DOS Executable</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4">
          <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-semibold text-emerald-200">Binary MS-DOS MZ Executable Assembled Successfully!</span>
              <p className="text-slate-400 mt-1">
                Formatted with 64-byte MZ header, VGA Mode 13h entry code, 18-bit DAC palette cycles, and Port 0201h gameport joystick support.
              </p>
            </div>
          </div>

          {/* Download Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleDownloadExe}
              className="p-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-left flex flex-col justify-between shadow-lg transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm tracking-wide font-mono">{baseFileName}.EXE</span>
                <Download className="w-4 h-4" />
              </div>
              <span className="text-xs text-emerald-100 opacity-90">
                Binary Executable ({(exeResult.totalFileSize / 1024).toFixed(1)} KB)
              </span>
            </button>

            <button
              onClick={handleDownloadAsm}
              className="p-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-left flex flex-col justify-between border border-slate-700 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm tracking-wide font-mono">{baseFileName}.ASM</span>
                <FileCode className="w-4 h-4 text-amber-400" />
              </div>
              <span className="text-xs text-slate-400">
                NASM Source Code (Compile with NASM/TASM)
              </span>
            </button>
          </div>

          {/* Quick DOSBox Run Instructions */}
          <div className="p-3.5 bg-black/60 rounded-lg border border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span>How to test in DOSBox / FreeDOS / Vintage PC:</span>
            </div>
            <pre className="p-2.5 bg-black rounded font-mono text-xs text-amber-300 leading-relaxed overflow-x-auto">
              {`# In your DOSBox terminal:
mount c ~/dosgames
c:
${baseFileName}.EXE

# Controls:
# - Joystick: IBM PC Gameport (Port 0201h) or Arrow Keys
# - Fire: Button 1 or Spacebar
# - Exit: ESC key (Restores 80x25 text mode)`}
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-[#111723] border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
