import React, { useState, useEffect } from 'react';
import { Palette, Play, Sparkles, RefreshCw, Sliders } from 'lucide-react';
import { PaletteCycleConfig } from '../types';
import { C64_PALETTE_BASE, PALETTE_CYCLE_PRESETS, getCycleColorTable } from '../utils/c64Palette';

interface PaletteCycleStudioProps {
  paletteCycle: PaletteCycleConfig;
  onUpdatePaletteCycle: (updated: PaletteCycleConfig) => void;
}

export const PaletteCycleStudio: React.FC<PaletteCycleStudioProps> = ({
  paletteCycle,
  onUpdatePaletteCycle
}) => {
  const [activeFrame, setActiveFrame] = useState<number>(0);
  const [selectedPreset, setSelectedPreset] = useState<PaletteCycleConfig['type']>(paletteCycle.type);

  // Live cycle animation preview for the swatch bar
  useEffect(() => {
    let animId: number;
    let count = 0;
    const interval = setInterval(() => {
      count++;
      setActiveFrame(count);
    }, 1000 / 60);

    return () => clearInterval(interval);
  }, []);

  const handlePresetSelect = (type: PaletteCycleConfig['type']) => {
    setSelectedPreset(type);
    onUpdatePaletteCycle({
      ...paletteCycle,
      type,
      customColors: type === 'custom' ? [...PALETTE_CYCLE_PRESETS.custom] : []
    });
  };

  const cycleColors = getCycleColorTable(paletteCycle);
  const shift = Math.floor(activeFrame / Math.max(1, paletteCycle.speed));
  const len = cycleColors.length;

  return (
    <div className="bg-[#0f141d] rounded-xl border border-slate-800 overflow-hidden shadow-xl space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-cyan-400" />
          <h3 className="font-semibold text-sm text-slate-100">VIC-II Palette Cycle Engine & DAC Mapper</h3>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={paletteCycle.enabled}
              onChange={(e) => onUpdatePaletteCycle({ ...paletteCycle, enabled: e.target.checked })}
              className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
            />
            <span className="font-medium">Cycle Enabled (DOS Port 03C8h)</span>
          </label>
        </div>
      </div>

      {/* Preset Buttons */}
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-2">Cycle Algorithm Preset</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['raster_bars', 'copper_rainbow', 'plasma_wave', 'water_shimmer'] as const).map((type) => {
            const label = type === 'raster_bars' ? 'Raster Copper Bars' :
                          type === 'copper_rainbow' ? 'Demoscene Rainbow' :
                          type === 'plasma_wave' ? 'Electric Plasma' : 'Shimmering Water';
            const isSelected = paletteCycle.type === type;
            return (
              <button
                key={type}
                onClick={() => handlePresetSelect(type)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition-all ${
                  isSelected
                    ? 'bg-cyan-950/40 border-cyan-500 text-cyan-200 shadow-sm'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="font-semibold mb-1 truncate">{label}</div>
                {/* Mini color strip preview */}
                <div className="flex h-2 rounded overflow-hidden">
                  {PALETTE_CYCLE_PRESETS[type].slice(0, 8).map((hex, i) => (
                    <div key={i} className="flex-1" style={{ backgroundColor: hex }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Animated Live Cycle Ribbon */}
      <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <div className="flex items-center gap-1.5 font-mono">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            <span className="text-slate-300">Live VGA DAC Animation (Indices {paletteCycle.startIndex}..{paletteCycle.startIndex + paletteCycle.count - 1}):</span>
          </div>
          <span className="font-mono text-cyan-300 text-[11px] tabular-nums">
            Shift: {shift % len} / {len}
          </span>
        </div>

        {/* Animated Palette Window Swatches */}
        <div className="grid grid-cols-8 sm:grid-cols-16 gap-1">
          {Array.from({ length: paletteCycle.count }).map((_, i) => {
            let srcIdx: number;
            if (paletteCycle.direction === 'forward') {
              srcIdx = (i + shift) % len;
            } else if (paletteCycle.direction === 'reverse') {
              srcIdx = (i - shift) % len;
              if (srcIdx < 0) srcIdx += len;
            } else {
              const period = (len - 1) * 2;
              const p = (i + shift) % period;
              srcIdx = p < len ? p : period - p;
            }

            const hex = cycleColors[srcIdx % len] || '#000000';
            const dacIndex = paletteCycle.startIndex + i;

            return (
              <div key={i} className="flex flex-col items-center">
                <div
                  className="w-full h-8 rounded border border-black/40 shadow-inner transition-colors duration-75"
                  style={{ backgroundColor: hex }}
                  title={`DAC Register #${dacIndex}: ${hex}`}
                />
                <span className="font-mono text-[9px] text-slate-500 mt-1 tabular-nums">
                  #{dacIndex}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        {/* Speed */}
        <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-slate-400 font-medium">Cycle Shift Rate</span>
            <span className="font-mono text-amber-300 font-bold tabular-nums">
              {paletteCycle.speed} frame{paletteCycle.speed > 1 ? 's' : ''} ({Math.round(60 / paletteCycle.speed)} Hz)
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="16"
            value={paletteCycle.speed}
            onChange={(e) => onUpdatePaletteCycle({ ...paletteCycle, speed: parseInt(e.target.value, 10) })}
            className="w-full accent-amber-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
            <span>Fast (60Hz)</span>
            <span>Slow (3.7Hz)</span>
          </div>
        </div>

        {/* Direction */}
        <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
          <span className="text-slate-400 font-medium block mb-1.5">Cycle Direction</span>
          <div className="grid grid-cols-3 gap-1">
            {(['forward', 'reverse', 'pingpong'] as const).map((dir) => (
              <button
                key={dir}
                onClick={() => onUpdatePaletteCycle({ ...paletteCycle, direction: dir })}
                className={`py-1 rounded text-[11px] font-medium transition-colors ${
                  paletteCycle.direction === dir
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {dir === 'forward' ? 'Forward' : dir === 'reverse' ? 'Reverse' : 'Ping-Pong'}
              </button>
            ))}
          </div>
        </div>

        {/* Synchronization Mode */}
        <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
          <span className="text-slate-400 font-medium block mb-1.5">DOS Hardware Sync</span>
          <select
            value={paletteCycle.syncMode}
            onChange={(e) => onUpdatePaletteCycle({ ...paletteCycle, syncMode: e.target.value as any })}
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs focus:ring-0 focus:outline-none"
          >
            <option value="vsync_retrace">Port 03DAh (Vertical Retrace)</option>
            <option value="timer_pit">PIT Timer 0x40 (18.2Hz DOS)</option>
            <option value="raster_line">VIC-II $D012 Raster Trigger</option>
          </select>
        </div>
      </div>

      {/* C64 Base 16-Color Palette Table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-slate-400">
            Canonical Commodore 64 16-Color DAC Reference (Indices 0..15)
          </label>
          <span className="text-[11px] font-mono text-slate-500">6-bit VGA DAC (0..63 scale)</span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-16 gap-1">
          {C64_PALETTE_BASE.map((col) => (
            <div
              key={col.index}
              className="p-1.5 rounded bg-slate-900/80 border border-slate-800/80 flex flex-col items-center hover:border-slate-600 transition-colors"
              title={`${col.name}: RGB(${col.rgb.join(',')}) -> VGA DAC(${col.vgaDac.join(',')})`}
            >
              <div
                className="w-full h-6 rounded border border-black/50 mb-1"
                style={{ backgroundColor: col.hex }}
              />
              <span className="font-mono text-[10px] text-slate-400 font-bold">#{col.index}</span>
              <span className="font-mono text-[8px] text-slate-500 truncate w-full text-center">
                {col.vgaDac.join(',')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
