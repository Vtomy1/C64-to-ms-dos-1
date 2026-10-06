import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Monitor, Gamepad2, Maximize2 } from 'lucide-react';
import { C64RomData, PaletteCycleConfig, JoystickConfig } from '../types';
import { generateFullVgaPalette, vgaDacToRgb } from '../utils/c64Palette';
import { createInitialSimulationState, renderScreenBuffer, GameSimulationState } from '../utils/screenRenderer';

interface CrtDisplayProps {
  romData: C64RomData;
  paletteCycle: PaletteCycleConfig;
  joystick: JoystickConfig;
  screenBufferRef: React.MutableRefObject<Uint8Array>;
  aspectRatio: '4:3' | '1:1';
  onAspectRatioToggle: () => void;
}

export const CrtDisplay: React.FC<CrtDisplayProps> = ({
  romData,
  paletteCycle,
  joystick,
  screenBufferRef,
  aspectRatio,
  onAspectRatioToggle
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [crtFilter, setCrtFilter] = useState<boolean>(true);
  const [fps, setFps] = useState<number>(60);
  const [scanlineY, setScanlineY] = useState<number>(0);
  const [gamepadConnected, setGamepadConnected] = useState<boolean>(false);
  const [gamepadName, setGamepadName] = useState<string>('');

  // Joystick state
  const joyStateRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
    fire: false
  });
  const [activeJoyDisplay, setActiveJoyDisplay] = useState(joyStateRef.current);

  // Simulation state
  const simStateRef = useRef<GameSimulationState>(createInitialSimulationState());

  // Reset simulation when ROM changes
  useEffect(() => {
    simStateRef.current = createInitialSimulationState();
  }, [romData.fileName]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = joyStateRef.current;
      let changed = false;

      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { state.up = true; changed = true; }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { state.down = true; changed = true; }
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { state.left = true; changed = true; }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { state.right = true; changed = true; }
      if (e.key === ' ' || e.key === 'Control' || e.key === 'Enter') { state.fire = true; changed = true; }

      if (changed) {
        setActiveJoyDisplay({ ...state });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const state = joyStateRef.current;
      let changed = false;

      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { state.up = false; changed = true; }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { state.down = false; changed = true; }
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { state.left = false; changed = true; }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { state.right = false; changed = true; }
      if (e.key === ' ' || e.key === 'Control' || e.key === 'Enter') { state.fire = false; changed = true; }

      if (changed) {
        setActiveJoyDisplay({ ...state });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Web Gamepad API Polling
  useEffect(() => {
    const handleGamepadConnected = (e: GamepadEvent) => {
      setGamepadConnected(true);
      setGamepadName(e.gamepad.id || 'USB Game Controller');
    };
    const handleGamepadDisconnected = () => {
      setGamepadConnected(false);
      setGamepadName('');
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
    };
  }, []);

  // Main 60 FPS Emulation Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsTimer = performance.now();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create ImageData for 320x200 32-bit RGBA
    const imgData = ctx.createImageData(320, 200);
    const data32 = new Uint32Array(imgData.data.buffer);

    const loop = (now: number) => {
      animId = requestAnimationFrame(loop);

      if (!isPlaying) return;

      // 1. Poll Gamepads if connected
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = gamepads[0] || gamepads[1];
      if (gp) {
        const deadzone = joystick.deadzone || 0.2;
        const axisX = gp.axes[0] || 0;
        const axisY = gp.axes[1] || 0;
        const btnFire = gp.buttons[joystick.gameportButtonA]?.pressed || gp.buttons[0]?.pressed || false;

        const dpadUp = gp.buttons[12]?.pressed || false;
        const dpadDown = gp.buttons[13]?.pressed || false;
        const dpadLeft = gp.buttons[14]?.pressed || false;
        const dpadRight = gp.buttons[15]?.pressed || false;

        joyStateRef.current.up = axisY < -deadzone || dpadUp;
        joyStateRef.current.down = axisY > deadzone || dpadDown;
        joyStateRef.current.left = axisX < -deadzone || dpadLeft;
        joyStateRef.current.right = axisX > deadzone || dpadRight;
        joyStateRef.current.fire = btnFire;

        setActiveJoyDisplay({ ...joyStateRef.current });
      }

      // 2. Advance simulation state
      const sim = simStateRef.current;
      sim.frameCounter++;
      sim.plasmaPhase += 0.02;

      // 3. Render 320x200 8-bit chunky buffer
      const buffer = screenBufferRef.current;
      renderScreenBuffer(buffer, romData, sim, paletteCycle, joyStateRef.current);

      // 4. Generate dynamic VGA DAC palette with active cycles
      const dacPalette = generateFullVgaPalette(paletteCycle, sim.frameCounter);

      // 5. Convert 8-bit pixel indices to RGBA32
      for (let i = 0; i < 64000; i++) {
        const colorIdx = buffer[i];
        const r6 = dacPalette[colorIdx * 3 + 0];
        const g6 = dacPalette[colorIdx * 3 + 1];
        const b6 = dacPalette[colorIdx * 3 + 2];
        const [r, g, b] = vgaDacToRgb(r6, g6, b6);

        // ABGR 32-bit integer for fast canvas blit
        data32[i] = (255 << 24) | (b << 16) | (g << 8) | r;
      }

      ctx.putImageData(imgData, 0, 0);

      // Raster line indicator
      const scanY = (sim.frameCounter * 3) % 200;
      setScanlineY(scanY);

      // FPS calculation
      frameCount++;
      if (now - fpsTimer >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - fpsTimer)));
        frameCount = 0;
        fpsTimer = now;
      }
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, romData, paletteCycle, joystick, screenBufferRef]);

  const handleReset = () => {
    simStateRef.current = createInitialSimulationState();
  };

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // On-screen touch/mouse directional buttons
  const triggerStick = (dir: 'up' | 'down' | 'left' | 'right', active: boolean) => {
    joyStateRef.current[dir] = active;
    setActiveJoyDisplay({ ...joyStateRef.current });
  };

  const triggerFire = (active: boolean) => {
    joyStateRef.current.fire = active;
    setActiveJoyDisplay({ ...joyStateRef.current });
  };

  return (
    <div ref={containerRef} className="flex flex-col bg-[#0c1017] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* Top Display Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#121824] border-b border-slate-800 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium text-slate-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono uppercase tracking-wide">VGA Mode 13h (320x200)</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="font-mono text-slate-300">
            {aspectRatio === '4:3' ? '4:3 CRT Display' : '1:1 Square Pixel'}
          </span>
          <span className="text-slate-600">|</span>
          <span className="font-mono text-amber-300 tabular-nums">
            FPS: {fps}
          </span>
          <span className="text-slate-600">|</span>
          <span className="font-mono text-cyan-300 tabular-nums">
            Raster $D012: #{scanlineY.toString().padStart(3, '0')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {gamepadConnected ? (
            <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2 py-0.5 rounded text-[11px]">
              <Gamepad2 className="w-3.5 h-3.5" />
              <span className="truncate max-w-[120px]">{gamepadName || 'Gamepad Active'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-slate-500 text-[11px]">
              <Gamepad2 className="w-3.5 h-3.5 opacity-60" />
              <span>Keyboard: Arrows/WASD + Space</span>
            </div>
          )}

          <button
            onClick={() => setCrtFilter(!crtFilter)}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              crtFilter
                ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-700/50'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            CRT Filter: {crtFilter ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={onAspectRatioToggle}
            className="px-2 py-1 rounded text-[11px] font-medium bg-slate-800/60 text-slate-300 hover:text-white transition-colors"
          >
            {aspectRatio}
          </button>

          <button
            onClick={handleFullscreen}
            title="Toggle Fullscreen"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Screen Canvas Area */}
      <div className="relative bg-[#05070a] flex items-center justify-center p-4 min-h-[340px] md:min-h-[440px] overflow-hidden">
        {/* Vintage Monitor Bezel Frame */}
        <div
          className={`relative transition-all rounded-lg overflow-hidden border-4 border-[#222938] shadow-[0_0_50px_rgba(0,0,0,0.8)] ${
            crtFilter ? 'crt-screen crt-glow' : ''
          }`}
          style={{
            width: aspectRatio === '4:3' ? 'min(100%, 640px)' : 'min(100%, 540px)',
            aspectRatio: aspectRatio === '4:3' ? '4 / 3' : '16 / 10'
          }}
        >
          <canvas
            ref={canvasRef}
            width={320}
            height={200}
            className="w-full h-full object-fill [image-rendering:pixelated]"
          />

          {/* Pause overlay */}
          {!isPlaying && (
            <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px] flex items-center justify-center">
              <div className="text-center font-mono">
                <p className="text-amber-400 font-bold tracking-widest text-lg">EMULATION PAUSED</p>
                <p className="text-slate-400 text-xs mt-1">Press Play to resume execution</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Control Bar & Interactive Touch Joystick */}
      <div className="px-4 py-3 bg-[#111723] border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
        {/* Transport buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-colors"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pause' : 'Resume'}</span>
          </button>

          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          {/* Active CIA1 / Gameport status */}
          <div className="hidden lg:flex items-center gap-2 text-xs font-mono bg-slate-900/80 px-3 py-1 rounded border border-slate-800">
            <span className="text-slate-500">CIA1 $DC00:</span>
            <span className={activeJoyDisplay.up ? 'text-emerald-400 font-bold' : 'text-slate-600'}>U</span>
            <span className={activeJoyDisplay.down ? 'text-emerald-400 font-bold' : 'text-slate-600'}>D</span>
            <span className={activeJoyDisplay.left ? 'text-emerald-400 font-bold' : 'text-slate-600'}>L</span>
            <span className={activeJoyDisplay.right ? 'text-emerald-400 font-bold' : 'text-slate-600'}>R</span>
            <span className={activeJoyDisplay.fire ? 'text-red-400 font-bold' : 'text-slate-600'}>[FIRE]</span>
          </div>
        </div>

        {/* On-screen Retro D-Pad & Fire Button for quick testing / touch devices */}
        <div className="flex items-center gap-4">
          <span className="text-[11px] text-slate-500 hidden sm:inline">Port 2 Arcade Pad:</span>

          {/* Tactical D-Pad */}
          <div className="grid grid-cols-3 gap-1 w-24 h-16">
            <div />
            <button
              onMouseDown={() => triggerStick('up', true)}
              onMouseUp={() => triggerStick('up', false)}
              onTouchStart={() => triggerStick('up', true)}
              onTouchEnd={() => triggerStick('up', false)}
              className={`h-7 rounded flex items-center justify-center text-xs font-bold transition-all select-none ${
                activeJoyDisplay.up ? 'bg-amber-500 text-black scale-95 shadow-inner' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              ▲
            </button>
            <div />
            <button
              onMouseDown={() => triggerStick('left', true)}
              onMouseUp={() => triggerStick('left', false)}
              onTouchStart={() => triggerStick('left', true)}
              onTouchEnd={() => triggerStick('left', false)}
              className={`h-7 rounded flex items-center justify-center text-xs font-bold transition-all select-none ${
                activeJoyDisplay.left ? 'bg-amber-500 text-black scale-95 shadow-inner' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              ◀
            </button>
            <button
              onMouseDown={() => triggerStick('down', true)}
              onMouseUp={() => triggerStick('down', false)}
              onTouchStart={() => triggerStick('down', true)}
              onTouchEnd={() => triggerStick('down', false)}
              className={`h-7 rounded flex items-center justify-center text-xs font-bold transition-all select-none ${
                activeJoyDisplay.down ? 'bg-amber-500 text-black scale-95 shadow-inner' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              ▼
            </button>
            <button
              onMouseDown={() => triggerStick('right', true)}
              onMouseUp={() => triggerStick('right', false)}
              onTouchStart={() => triggerStick('right', true)}
              onTouchEnd={() => triggerStick('right', false)}
              className={`h-7 rounded flex items-center justify-center text-xs font-bold transition-all select-none ${
                activeJoyDisplay.right ? 'bg-amber-500 text-black scale-95 shadow-inner' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              ▶
            </button>
          </div>

          {/* QuickJoy Red Fire Button */}
          <button
            onMouseDown={() => triggerFire(true)}
            onMouseUp={() => triggerFire(false)}
            onTouchStart={() => triggerFire(true)}
            onTouchEnd={() => triggerFire(false)}
            className={`w-14 h-14 rounded-full flex flex-col items-center justify-center text-xs font-black shadow-lg transition-transform select-none ${
              activeJoyDisplay.fire
                ? 'bg-red-500 text-white scale-90 shadow-red-500/50'
                : 'bg-red-600 hover:bg-red-500 text-white border-2 border-red-700 shadow-md'
            }`}
          >
            <span>FIRE</span>
          </button>
        </div>
      </div>
    </div>
  );
};
