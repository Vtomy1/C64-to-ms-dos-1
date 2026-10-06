import React, { useState, useRef, useMemo } from 'react';
import {
  Upload,
  Download,
  Monitor,
  Binary,
  Palette,
  Gamepad2,
  Code,
  HardDrive,
  Cpu,
  Layers,
  Sparkles,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { C64RomData, PaletteCycleConfig, JoystickConfig, ConversionOptions } from './types';
import { SAMPLE_ROMS } from './utils/c64Samples';
import { parseC64Binary } from './utils/c64Parser';
import { buildMsDosExe, GeneratedExeResult } from './utils/mzExeBuilder';
import { CrtDisplay } from './components/CrtDisplay';
import { MzHeaderInspector } from './components/MzHeaderInspector';
import { PaletteCycleStudio } from './components/PaletteCycleStudio';
import { JoystickConfigurator } from './components/JoystickConfigurator';
import { CodeInspector } from './components/CodeInspector';
import { ExportModal } from './components/ExportModal';

export default function App() {
  // Active ROM
  const [selectedRom, setSelectedRom] = useState<C64RomData>(SAMPLE_ROMS[0]);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'monitor' | 'mz_header' | 'palette' | 'joystick' | 'code'>('monitor');

  // Display aspect ratio (4:3 CRT standard vs 1:1 square)
  const [aspectRatio, setAspectRatio] = useState<'4:3' | '1:1'>('4:3');

  // Palette Cycle Configuration state
  const [paletteCycle, setPaletteCycle] = useState<PaletteCycleConfig>({
    enabled: true,
    type: 'copper_rainbow',
    startIndex: 16,
    count: 16,
    speed: 3,
    direction: 'forward',
    syncMode: 'vsync_retrace',
    customColors: []
  });

  // Joystick Configuration state
  const [joystick, setJoystick] = useState<JoystickConfig>({
    c64Port: 2,
    dosInputMode: 'gameport_201h',
    gameportButtonA: 0,
    gameportButtonB: 1,
    deadzone: 0.2,
    autofire: false,
    autofireRate: 15,
    invertY: false,
    swapAxes: false,
    emulateAnalogViaKeys: true
  });

  // Conversion options
  const [conversionOptions, setConversionOptions] = useState<ConversionOptions>({
    targetResolution: '320x200_MODE13H',
    crtAspectRatio: '4:3',
    preservePaletteCycles: true,
    paletteCycle,
    joystick,
    dosHeaderTune: {
      minAllocParagraphs: 0x1000,
      maxAllocParagraphs: 0xFFFF,
      stackSizeWords: 1024
    },
    embedAsmSourceComments: true
  });

  // Screen buffer reference (64,000 bytes for 320x200 Mode 13h)
  const screenBufferRef = useRef<Uint8Array>(new Uint8Array(64000));

  // Export Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // File Upload input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle ROM selection
  const handleSelectRom = (rom: C64RomData) => {
    setSelectedRom(rom);
    if (rom.detectedCycleType) {
      setPaletteCycle((prev) => ({
        ...prev,
        type: rom.detectedCycleType!
      }));
    }
  };

  // Handle Custom File Upload (.prg, .crt, .d64, .bin)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      if (buffer) {
        const bytes = new Uint8Array(buffer);
        const parsed = parseC64Binary(bytes, file.name);
        setSelectedRom(parsed);
        if (parsed.detectedCycleType) {
          setPaletteCycle((prev) => ({
            ...prev,
            type: parsed.detectedCycleType!
          }));
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Build the MS-DOS Executable output
  const exeResult: GeneratedExeResult = useMemo(() => {
    return buildMsDosExe(selectedRom, screenBufferRef.current, {
      ...conversionOptions,
      paletteCycle,
      joystick
    });
  }, [selectedRom, conversionOptions, paletteCycle, joystick]);

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-100 flex flex-col">
      {/* Top Bar Contract: Zone 1 (Wordmark) - Zone 2 (Nav links) - Zone 3 (Actions) */}
      <header className="flex items-center justify-between px-6 py-3.5 bg-[#0f141d] border-b border-slate-800 shrink-0 sticky top-0 z-40 backdrop-blur-md">
        {/* Zone 1: Single text wordmark */}
        <div className="flex items-center gap-3">
          <a href="/" className="text-base font-bold tracking-tight text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-amber-400" />
            <span>C64 to MS-DOS Converter</span>
          </a>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 border-l border-slate-700 pl-3">
            <span>VGA Mode 13h</span>
            <span aria-hidden="true">·</span>
            <span>320x200 8-Bit</span>
            <span aria-hidden="true">·</span>
            <span>Gameport 0201h</span>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 text-xs font-medium">
          <button
            onClick={() => setActiveTab('monitor')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'monitor'
                ? 'bg-amber-500/20 text-amber-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Live Monitor
          </button>
          <button
            onClick={() => setActiveTab('mz_header')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'mz_header'
                ? 'bg-amber-500/20 text-amber-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            MZ Header
          </button>
          <button
            onClick={() => setActiveTab('palette')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'palette'
                ? 'bg-amber-500/20 text-amber-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Palette Cycles
          </button>
          <button
            onClick={() => setActiveTab('joystick')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'joystick'
                ? 'bg-amber-500/20 text-amber-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Joystick Port
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'code'
                ? 'bg-amber-500/20 text-amber-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Assembly Code
          </button>
        </nav>

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".prg,.crt,.d64,.bin,.rom"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-slate-400" />
            <span>Load ROM / PRG</span>
          </button>

          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-md transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export MS-DOS .EXE</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-4 md:p-6 space-y-6">
        {/* ROM Selection Strip */}
        <section className="bg-[#0f141d] rounded-xl border border-slate-800 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Active Commodore 64 Source Program
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span className="font-mono text-amber-300 font-semibold">{selectedRom.fileName}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-slate-300">${selectedRom.loadAddress.toString(16).toUpperCase()}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{(selectedRom.fileSize / 1024).toFixed(1)} KB</span>
                <span aria-hidden="true">·</span>
                <span>{selectedRom.format} Format</span>
              </div>
            </div>

            {/* Quick Preset Selector Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {SAMPLE_ROMS.map((rom) => {
                const isSelected = selectedRom.fileName === rom.fileName;
                return (
                  <button
                    key={rom.fileName}
                    onClick={() => handleSelectRom(rom)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {rom.title.split(' (')[0]}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            {selectedRom.description}
          </p>
        </section>

        {/* Tab-driven Content Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Visual Display (CRT Monitor) */}
          <div className="lg:col-span-7 space-y-6">
            <CrtDisplay
              romData={selectedRom}
              paletteCycle={paletteCycle}
              joystick={joystick}
              screenBufferRef={screenBufferRef}
              aspectRatio={aspectRatio}
              onAspectRatioToggle={() => setAspectRatio(aspectRatio === '4:3' ? '1:1' : '4:3')}
            />

            {/* Secondary Pane based on active navigation tab for desktop */}
            {activeTab === 'mz_header' && (
              <MzHeaderInspector
                dosHeader={exeResult.dosHeader}
                headerHex={exeResult.headerHex}
                totalFileSize={exeResult.totalFileSize}
                codeOffset={exeResult.codeSegmentOffset}
                dataOffset={exeResult.dataSegmentOffset}
                videoOffset={exeResult.videoBufferOffset}
              />
            )}

            {activeTab === 'code' && (
              <CodeInspector
                romData={selectedRom}
                asmSourceCode={exeResult.asmSourceCode}
              />
            )}
          </div>

          {/* Right Column: Palette & Joystick Configurations */}
          <div className="lg:col-span-5 space-y-6">
            <PaletteCycleStudio
              paletteCycle={paletteCycle}
              onUpdatePaletteCycle={setPaletteCycle}
            />

            <JoystickConfigurator
              joystick={joystick}
              onUpdateJoystick={setJoystick}
            />

            {activeTab !== 'mz_header' && activeTab !== 'code' && (
              <MzHeaderInspector
                dosHeader={exeResult.dosHeader}
                headerHex={exeResult.headerHex}
                totalFileSize={exeResult.totalFileSize}
                codeOffset={exeResult.codeSegmentOffset}
                dataOffset={exeResult.dataSegmentOffset}
                videoOffset={exeResult.videoBufferOffset}
              />
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-[#0c1017] px-6 py-4 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-4 mt-auto">
        <div className="flex items-center gap-2">
          <span>MS-DOS Real Mode 16-Bit Target</span>
          <span aria-hidden="true">·</span>
          <span>VGA Mode 13h (320x200, 256 Colors)</span>
          <span aria-hidden="true">·</span>
          <span>IBM PC Gameport Port 0201h</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-slate-400">MZ Magic: 0x5A4D</span>
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="text-amber-400 hover:text-amber-300 font-medium transition-colors"
          >
            Export .EXE & Instructions
          </button>
        </div>
      </footer>

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        exeResult={exeResult}
        romData={selectedRom}
      />
    </div>
  );
}
