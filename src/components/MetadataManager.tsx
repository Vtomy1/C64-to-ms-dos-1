import React, { useState, useEffect } from 'react';
import { Tag, Calendar, User, Save, RotateCcw, Check, Sparkles, Binary } from 'lucide-react';
import { C64RomData } from '../types';

interface MetadataManagerProps {
  romData: C64RomData;
  onUpdateMetadata: (updated: { title: string; developer: string; releaseYear: number }) => void;
}

export const MetadataManager: React.FC<MetadataManagerProps> = ({
  romData,
  onUpdateMetadata
}) => {
  const [title, setTitle] = useState(romData.title || '');
  const [developer, setDeveloper] = useState(romData.developer || 'Unknown Developer');
  const [releaseYear, setReleaseYear] = useState<number>(romData.releaseYear || 1986);
  const [saved, setSaved] = useState(false);

  // Synchronize when the active ROM changes
  useEffect(() => {
    setTitle(romData.title || '');
    setDeveloper(romData.developer || 'Unknown Developer');
    setReleaseYear(romData.releaseYear || 1986);
    setSaved(false);
  }, [romData.fileName, romData.title, romData.developer, romData.releaseYear]);

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onUpdateMetadata({
      title: title.trim() || 'Untitled ROM',
      developer: developer.trim() || 'Unknown Developer',
      releaseYear: Number(releaseYear) || 1986
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    const defaultTitle = romData.fileName.replace(/\.[^/.]+$/, '').toUpperCase();
    setTitle(defaultTitle);
    setDeveloper('Unknown Developer');
    setReleaseYear(1986);
    onUpdateMetadata({
      title: defaultTitle,
      developer: 'Unknown Developer',
      releaseYear: 1986
    });
  };

  // Pre-generate the 28-byte MZ header string preview
  const metaTitle = (title.trim() || 'UNTITLED').slice(0, 14);
  const metaDev = (developer.trim() || 'UNKNOWN').slice(0, 10);
  const metaYear = (releaseYear || 1986).toString();
  const headerDescriptor = `C64:${metaTitle} (${metaYear}) [${metaDev}]`;

  return (
    <div className="bg-[#0f141d] rounded-xl border border-slate-800 overflow-hidden shadow-xl space-y-4 p-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-amber-400" />
          <h3 className="font-semibold text-sm text-slate-100">C64 ROM Header Metadata Manager</h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono text-[11px] text-slate-400">Target: MZ Reserved (0x0024)</span>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Form Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* ROM Title */}
          <div className="sm:col-span-1">
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1.5">
              <Tag className="w-3.5 h-3.5 text-amber-400/80" />
              <span>Program Title</span>
            </label>
            <input
              type="text"
              value={title}
              maxLength={32}
              onChange={(e) => { setTitle(e.target.value); setSaved(false); }}
              placeholder="e.g. GIANA SISTERS 64"
              className="w-full bg-slate-900/90 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 focus:outline-none"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">Max 32 chars (padded in EXE)</span>
          </div>

          {/* Developer / Studio */}
          <div className="sm:col-span-1">
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1.5">
              <User className="w-3.5 h-3.5 text-cyan-400/80" />
              <span>Developer / Studio</span>
            </label>
            <input
              type="text"
              value={developer}
              maxLength={24}
              onChange={(e) => { setDeveloper(e.target.value); setSaved(false); }}
              placeholder="e.g. Rainbow Arts"
              className="w-full bg-slate-900/90 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40 focus:outline-none"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">Author or demo group</span>
          </div>

          {/* Release Year */}
          <div className="sm:col-span-1">
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400/80" />
              <span>Release Year</span>
            </label>
            <input
              type="number"
              min={1977}
              max={2030}
              value={releaseYear}
              onChange={(e) => { setReleaseYear(parseInt(e.target.value, 10) || 1986); setSaved(false); }}
              className="w-full bg-slate-900/90 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 focus:outline-none"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">1982–1994 classic era</span>
          </div>
        </div>

        {/* Live MZ Header Hex Embedding Preview */}
        <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Binary className="w-3.5 h-3.5 text-amber-400" />
              <span>Live MS-DOS MZ Header ASCII Descriptor (Offset 0x0024 - 0x003F):</span>
            </span>
            <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-1.5 py-0.5 rounded">
              SYNCED TO BINARY
            </span>
          </div>

          <div className="p-2.5 bg-black/60 rounded border border-slate-800 font-mono text-xs flex items-center justify-between overflow-x-auto">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">0000:0024</span>
              <span className="text-amber-300 font-bold tracking-wider">
                {headerDescriptor}
              </span>
            </div>
            <span className="text-slate-500 text-[10px] shrink-0 ml-2">
              {headerDescriptor.length} / 28 bytes
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            These fields are dynamically injected into the reserved paragraph region of the executable's MZ header (preceding the code segment) and embedded as metadata in the exported <span className="font-mono text-slate-300">.EXE</span> and <span className="font-mono text-slate-300">.ASM</span> NASM source comments.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to File Defaults</span>
          </button>

          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-md transition-colors cursor-pointer"
          >
            {saved ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saved ? 'Metadata Applied!' : 'Apply to Header'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
