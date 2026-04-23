"use client";

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";

interface GameProps {
  userName: string;
  onGameOver: (success: boolean) => void;
  onRestart: () => void;
  onGameStart: () => void;
}

export interface BrickBreakerHandle {
  setPaused: (paused: boolean) => void;
  isPaused: boolean;
}

const BrickBreaker = forwardRef<BrickBreakerHandle, GameProps>(({ userName, onGameOver, onRestart, onGameStart }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [redScore, setRedScore] = useState(0);
  const redScoreRef = useRef(0);
  const hasEnded = useRef(false);
  const isDragging = useRef(false);
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(3);
  
  // Refs for event listeners to read latest state without re-binding
  const isPausedRef = useRef(isPaused);
  const countdownRef = useRef(countdown);
  
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);
  
  useEffect(() => {
    countdownRef.current = countdown;
  }, [countdown]);

  const requestRef = useRef<number>(0);

  // Brick settings
  const brickRowCount = 5;
  const brickColumnCount = 8;
  const brickWidth = 80;
  const brickHeight = 25;
  const brickPadding = 10;
  const brickOffsetTop = 60;
  const brickOffsetLeft = 40;

  const targetRed = "#ff595e";
  const brickColors = [targetRed, "#1982c4", "#8ac926", "#ffca3a", "#6a4c93", "#a0522d"];

  const [bricks, setBricks] = useState<any[][]>([]);
  const bricksRef = useRef<any[][]>([]);

  // Paddle settings
  const paddleHeight = 12;
  const paddleWidth = 100;
  const paddleX = useRef((800 - paddleWidth) / 2);
  const rightPressed = useRef(false);
  const leftPressed = useRef(false);

  // Ball settings
  const x = useRef(400);
  const y = useRef(500);
  const dx = useRef(4);
  const dy = useRef(-4);
  const ballRadius = 8;

  // Sound synthesis function
  const playCollisionSound = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const audioCtx = audioCtxRef.current;
      if (audioCtx.state === "suspended") audioCtx.resume();
      
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
      console.log("Audio error:", e);
    }
  };

  useImperativeHandle(ref, () => ({
    setPaused: (paused: boolean) => setIsPaused(paused),
    isPaused
  }));

  // One-time Initialization (Bricks & Listeners)
  useEffect(() => {
    // Bricks init
    const initialBricks: any[][] = [];
    const totalBricks = brickRowCount * brickColumnCount;
    const redTarget = Math.floor(totalBricks * 0.3);
    let redCount = 0;

    for (let c = 0; c < brickColumnCount; c++) {
      initialBricks[c] = [];
      for (let r = 0; r < brickRowCount; r++) {
        let color;
        if (redCount < redTarget && Math.random() < 0.4) {
          color = targetRed;
          redCount++;
        } else {
          const colorsWithoutRed = brickColors.filter(cl => cl !== targetRed);
          color = colorsWithoutRed[Math.floor(Math.random() * colorsWithoutRed.length)];
        }
        initialBricks[c][r] = { x: 0, y: 0, status: 1, color };
      }
    }
    while (redCount < redTarget) {
      const c = Math.floor(Math.random() * brickColumnCount);
      const r = Math.floor(Math.random() * brickRowCount);
      if (initialBricks[c][r].color !== targetRed) {
        initialBricks[c][r].color = targetRed;
        redCount++;
      }
    }
    setBricks(initialBricks);
    bricksRef.current = initialBricks;

    // Listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Right" || e.key === "ArrowRight") rightPressed.current = true;
      else if (e.key === "Left" || e.key === "ArrowLeft") leftPressed.current = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Right" || e.key === "ArrowRight") rightPressed.current = false;
      else if (e.key === "Left" || e.key === "ArrowLeft") leftPressed.current = false;
    };

    // Pointer capture states

    const handlePointerMove = (e: PointerEvent) => {
      // Allow moving unconditionally for touch, for mouse require drag
      if ((e.pointerType === 'mouse' && !isDragging.current) || isPausedRef.current || countdownRef.current !== null) return;
      updatePaddlePositionWithX(e.clientX);
    };

    const handlePointerUp = (e: PointerEvent) => {
      isDragging.current = false;
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (isPausedRef.current || countdownRef.current !== null) return;
      // Ignore clicks on buttons/inputs
      const target = e.target as HTMLElement;
      if (target.tagName.toLowerCase() === 'button' || target.tagName.toLowerCase() === 'input') return;
      
      isDragging.current = true;
      updatePaddlePositionWithX(e.clientX);
    };

    const handleTouch = (e: TouchEvent) => {
      if (isPausedRef.current || countdownRef.current !== null) return;
      const target = e.target as HTMLElement;
      if (target.tagName.toLowerCase() === 'button' || target.tagName.toLowerCase() === 'input') return;
      
      // Stop ALL native scrolling and zooming when touching the game
      e.preventDefault(); 
      updatePaddlePositionWithX(e.touches[0].clientX);
    };

    const updatePaddlePositionWithX = (clientX: number) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = 800 / rect.width;
      const pointerX = (clientX - rect.left) * scaleX;
      
      let newX = pointerX - paddleWidth / 2;
      if (newX < 0) newX = 0;
      if (newX > 800 - paddleWidth) newX = 800 - paddleWidth;
      paddleX.current = newX;
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("touchstart", handleTouch, { passive: false });
    window.addEventListener("touchmove", handleTouch, { passive: false });

    // Audio init
    audioRef.current = new Audio("/Hyper_Speed_Run.mp3");
    audioRef.current.loop = true;
    audioRef.current.volume = 0.2;

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("touchstart", handleTouch);
      window.removeEventListener("touchmove", handleTouch);
      audioRef.current?.pause();
      audioCtxRef.current?.close();
    };
  }, []);

  // Countdown Timer
  useEffect(() => {
    if (countdown === null) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev === 1) {
          clearInterval(timer);
          return null;
        }
        return (prev || 0) - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Effect to trigger onGameStart & BGM when countdown hits null
  useEffect(() => {
    if (countdown === null && !hasEnded.current) {
      onGameStart();
      audioRef.current?.play().catch(() => {});
    }
  }, [countdown, onGameStart]);

  // Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      if (bricksRef.current.length === 0) {
        requestRef.current = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw Logic
      const drawBricks = () => {
        for (let c = 0; c < brickColumnCount; c++) {
          for (let r = 0; r < brickRowCount; r++) {
            const b = bricksRef.current[c][r];
            if (b.status === 1) {
              const bx = c * (brickWidth + brickPadding) + brickOffsetLeft;
              const by = r * (brickHeight + brickPadding) + brickOffsetTop;
              b.x = bx; b.y = by;
              ctx.beginPath(); ctx.roundRect(bx, by, brickWidth, brickHeight, 4); ctx.fillStyle = b.color; ctx.fill(); ctx.closePath();
            }
          }
        }
      };

      if (isPaused || countdown !== null) {
        drawBricks();
        ctx.beginPath(); ctx.arc(x.current, y.current, ballRadius, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.closePath();
        ctx.beginPath(); ctx.rect(paddleX.current, canvas.height - paddleHeight - 10, paddleWidth, paddleHeight); ctx.fillStyle = "#4f46e5"; ctx.fill(); ctx.closePath();
        
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0,0, canvas.width, canvas.height);
        ctx.fillStyle = "#fff"; ctx.textAlign = "center";
        if (countdown !== null) {
          ctx.font = "bold 80px sans-serif"; ctx.fillText(countdown.toString(), canvas.width/2, canvas.height/2 + 30);
        } else {
          ctx.font = "bold 40px sans-serif"; ctx.fillText("PAUSED", canvas.width/2, canvas.height/2 + 15);
        }
        requestRef.current = requestAnimationFrame(draw);
        return;
      }

      // Update Logic
      drawBricks();
      ctx.beginPath(); ctx.arc(x.current, y.current, ballRadius, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.closePath();
      ctx.beginPath(); ctx.rect(paddleX.current, canvas.height - paddleHeight - 10, paddleWidth, paddleHeight); ctx.fillStyle = "#4f46e5"; ctx.fill(); ctx.closePath();

      // Collision
      for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
          const b = bricksRef.current[c][r];
          if (b.status === 1) {
            if (x.current > b.x && x.current < b.x + brickWidth && y.current > b.y && y.current < b.y + brickHeight) {
              dy.current = -dy.current;
              b.status = 0;
              playCollisionSound();
              setScore(s => s + 1);
              if (b.color === targetRed) {
                redScoreRef.current += 1;
                setRedScore(redScoreRef.current);
                if (redScoreRef.current >= 3 && !hasEnded.current) {
                  hasEnded.current = true;
                  onGameOver(true);
                }
              }
            }
          }
        }
      }

      // Physics
      if (x.current + dx.current > canvas.width - ballRadius || x.current + dx.current < ballRadius) dx.current = -dx.current;
      if (y.current + dy.current < ballRadius) dy.current = -dy.current;
      else if (y.current + dy.current > canvas.height - ballRadius - 20) {
        if (x.current > paddleX.current && x.current < paddleX.current + paddleWidth) dy.current = -dy.current;
        else if (y.current + dy.current > canvas.height - ballRadius) {
          setLives(l => {
            if (l <= 1) { 
              if (!hasEnded.current) {
                hasEnded.current = true;
                onGameOver(false); 
              }
              return 0; 
            }
            x.current = 400; y.current = 500; dx.current = 4; dy.current = -4; paddleX.current = (800 - paddleWidth) / 2;
            return l - 1;
          });
        }
      }

      if (rightPressed.current && paddleX.current < canvas.width - paddleWidth) paddleX.current += 7;
      else if (leftPressed.current && paddleX.current > 0) paddleX.current -= 7;

      x.current += dx.current;
      y.current += dy.current;
      requestRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPaused, countdown]);

  return (
    <div className="flex flex-col items-center gap-3 sm:gap-6 w-full">
      <div className="glass-morphism px-4 py-2 sm:px-8 sm:py-4 flex flex-wrap justify-between w-full max-w-[800px] gap-2">
        <div className="flex flex-col">
          <div className="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wider">Player</div>
          <div className="text-lg font-bold text-primary">{userName}</div>
        </div>
        <div className="flex gap-8">
          <div className="flex flex-col items-center">
            <div className="text-slate-400 text-xs">RED BRICKS</div>
            <div className="text-lg font-bold text-accent">{redScore} / 3</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-slate-400 text-xs">LIVES</div>
            <div className="text-lg flex gap-1">
               {Array.from({ length: 3 }).map((_, i) => (
                 <span key={i} className={i < lives ? "text-accent" : "text-slate-700 opacity-30"}>❤️</span>
               ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 sm:gap-3 items-center">
          <button onClick={() => setIsPaused(!isPaused)} className="p-3 sm:p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors text-xl sm:text-base">
            {isPaused ? "▶️" : "⏸️"}
          </button>
          <button onClick={onRestart} className="p-3 sm:p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors text-xl sm:text-base">🔄</button>
          <button onClick={() => onGameOver(false)} className="p-3 sm:p-2 bg-red-500/20 rounded-xl hover:bg-red-500/40 transition-colors text-xl sm:text-base">🛑</button>
        </div>
      </div>
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={600} 
        className="w-full max-w-[800px] max-h-[65vh] object-contain shadow-2xl bg-black/40 border border-white/5 rounded-xl transition-all" 
      />
    </div>
  );
});

BrickBreaker.displayName = "BrickBreaker";
export default BrickBreaker;
