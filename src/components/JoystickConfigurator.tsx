import React, { useState, useEffect } from 'react';
import { Gamepad2, Sliders, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import { JoystickConfig } from '../types';

interface JoystickConfiguratorProps {
  joystick: JoystickConfig;
  onUpdateJoystick: (updated: JoystickConfig) => void;
}

export const JoystickConfigurator: React.FC<JoystickConfiguratorProps> = ({
  joystick,
  onUpdateJoystick
}) => {
  const [gamepads, setGamepads] = useState<Gamepad[]>([]);
  const [activePadIndex, setActivePadIndex] = useState<number>(0);
  const [padState, setPadState] = useState<{
    axes: number[];
    buttons: boolean[];
  }>({ axes: [0, 0], buttons: [] });

  // Poll connected gamepads
  useEffect(() => {
    let animId: number;
    const poll = () => {
      animId = requestAnimationFrame(poll);
      const list = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) as Gamepad[] : [];
      setGamepads(list);

      const target = list[activePadIndex] || list[0];
      if (target) {
        setPadState({
          axes: target.axes ? Array.from(target.axes).map((v) => Number(v.toFixed(3))) : [0, 0],
          buttons: target.buttons ? target.buttons.map((b) => b.pressed) : []
        });
      }
    };

    animId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animId);
  }, [activePadIndex]);

  const activePad = gamepads[activePadIndex] || gamepads[0];

  return (
    <div className="bg-[#0f141d] rounded-xl border border-slate-800 overflow-hidden shadow-xl space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-4 h-4 text-emerald-400" />
          <h3 className="font-semibold text-sm text-slate-100">MS-DOS Gameport & C64 Joystick Mapper</h3>
        </div>
        <div className="flex items-center gap-2">
          {activePad ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2 py-0.5 rounded font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Connected: {activePad.id.slice(0, 20)}...
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded font-mono">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              No Physical Gamepad Detected (Keyboard active)
            </span>
          )}
        </div>
      </div>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        {/* C64 CIA Target Port */}
        <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
          <span className="text-slate-400 font-medium block mb-1.5">C64 Target Port</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onUpdateJoystick({ ...joystick, c64Port: 2 })}
              className={`py-1.5 px-2 rounded text-xs font-semibold transition-all ${
                joystick.c64Port === 2
                  ? 'bg-emerald-950/50 border border-emerald-500 text-emerald-300'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Port 2 ($DC00)
              <span className="block text-[10px] font-normal text-slate-400">Standard for 95% Games</span>
            </button>
            <button
              onClick={() => onUpdateJoystick({ ...joystick, c64Port: 1 })}
              className={`py-1.5 px-2 rounded text-xs font-semibold transition-all ${
                joystick.c64Port === 1
                  ? 'bg-emerald-950/50 border border-emerald-500 text-emerald-300'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Port 1 ($DC01)
              <span className="block text-[10px] font-normal text-slate-400">Secondary / 2-Player</span>
            </button>
          </div>
        </div>

        {/* DOS Hardware Input Emulation Mode */}
        <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
          <span className="text-slate-400 font-medium block mb-1.5">DOS Hardware Mode</span>
          <select
            value={joystick.dosInputMode}
            onChange={(e) => onUpdateJoystick({ ...joystick, dosInputMode: e.target.value as any })}
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-0 focus:outline-none"
          >
            <option value="gameport_201h">IBM PC Gameport (Port 0201h / INT 15h)</option>
            <option value="bios_keyboard">BIOS Scancodes (INT 16h Keyboard)</option>
            <option value="dual_hybrid">Dual Hybrid (Port 0201h + Keyboard fallback)</option>
          </select>
          <p className="text-[10px] text-slate-500 mt-2">
            Generates 8086 x86 opcodes for polling standard 15-pin D-sub analog PC gameports.
          </p>
        </div>

        {/* Autofire & Rate */}
        <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Autofire Circuit
            </span>
            <label className="cursor-pointer">
              <input
                type="checkbox"
                checked={joystick.autofire}
                onChange={(e) => onUpdateJoystick({ ...joystick, autofire: e.target.checked })}
                className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
              />
            </label>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-slate-400 text-[11px]">Rate:</span>
            {[15, 30].map((rate) => (
              <button
                key={rate}
                disabled={!joystick.autofire}
                onClick={() => onUpdateJoystick({ ...joystick, autofireRate: rate })}
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors ${
                  joystick.autofire && joystick.autofireRate === rate
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-800 text-slate-500 hover:text-slate-300 disabled:opacity-40'
                }`}
              >
                {rate} Hz
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live Controller Monitor / Test Pad */}
      <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span className="font-mono text-slate-300">Live Hardware Telemetry:</span>
          <span className="font-mono text-[11px] text-cyan-400">
            Deadzone: {(joystick.deadzone * 100).toFixed(0)}%
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          {/* Virtual Analog Stick Visualization */}
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-full border border-slate-700 bg-black/60 flex items-center justify-center">
              {/* Center reticle */}
              <div className="absolute w-full h-[1px] bg-slate-800" />
              <div className="absolute h-full w-[1px] bg-slate-800" />

              {/* Stick thumb pointer */}
              <div
                className="w-5 h-5 rounded-full bg-emerald-500 border border-emerald-300 shadow-md transition-all duration-75"
                style={{
                  transform: `translate(${padState.axes[0] * 28}px, ${padState.axes[1] * 28}px)`
                }}
              />
            </div>

            <div className="font-mono text-[11px] space-y-1 text-slate-400">
              <div>Axis X (0): <span className="text-emerald-400 tabular-nums">{padState.axes[0]?.toFixed(3) || '0.000'}</span></div>
              <div>Axis Y (1): <span className="text-emerald-400 tabular-nums">{padState.axes[1]?.toFixed(3) || '0.000'}</span></div>
              <div>CIA1 Bit 4: <span className="text-red-400">{padState.buttons[0] ? 'FIRE (0)' : 'IDLE (1)'}</span></div>
            </div>
          </div>

          {/* Button Indicators */}
          <div>
            <span className="text-[11px] text-slate-500 block mb-1.5 font-mono">Digital Button States (0..7):</span>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 8 }).map((_, i) => {
                const pressed = padState.buttons[i] || false;
                return (
                  <div
                    key={i}
                    className={`w-8 h-8 rounded flex items-center justify-center text-xs font-mono font-bold transition-all ${
                      pressed
                        ? 'bg-red-500 text-white shadow-[0_0_8px_rgba(239,68,68,0.6)] scale-95'
                        : 'bg-slate-800 border border-slate-700 text-slate-400'
                    }`}
                  >
                    B{i}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
