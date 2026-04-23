"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gamepad2, User, GraduationCap, Hash, Trophy, AlertCircle, RefreshCw } from "lucide-react";
import BrickBreaker from "@/components/BrickBreaker";
import Image from "next/image";
import confetti from "canvas-confetti";

export default function Home() {
  const [userName, setUserName] = useState("");
  const [gameStarted, setGameStarted] = useState(false);
  const [gameState, setGameState] = useState<"start" | "playing" | "success" | "fail">("start");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState("00:00");
  const [rankings, setRankings] = useState<{name: string, time: string}[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // 구글 앱스 스크립트 웹 앱 URL을 여기에 입력하세요.
  const SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL || ""; 

  const fetchRankings = async () => {
    if (!SCRIPT_URL) return;
    try {
      const response = await fetch(SCRIPT_URL);
      const data = await response.json();
      // data: [{name, finishtime}]
      const formattedRankings = data.map((item: any) => ({
        name: String(item.name || "Unknown"),
        time: String(item.finishtime).includes("초") ? String(item.finishtime) : `${item.finishtime}초`
      }));
      setRankings(formattedRankings);
    } catch (error) {
      console.error("Failed to fetch rankings:", error);
    }
  };

  const saveScore = async (time: string) => {
    if (!SCRIPT_URL || isSaving) return;
    setIsSaving(true);
    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({ name: userName, finishtime: time }),
      });
      fetchRankings(); // 저장 후 랭킹 새로고침
    } catch (error) {
      console.error("Failed to save score:", error);
    } finally {
      // isSaving stays true until game is reset to prevent double post on the same win
    }
  };

  useEffect(() => {
    fetchRankings();
  }, []);

  useEffect(() => {
    let interval: any;
    if (gameState === "playing" && startTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const diff = ((now - startTime) / 1000).toFixed(1);
        setElapsedTime(`${diff}초`);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [gameState, startTime]);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim()) {
      // Resume AudioContext for browsers
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const dummyCtx = new AudioContext();
        dummyCtx.resume();
      }
      
      setStartTime(Date.now());
      setGameState("playing");
      setGameStarted(true);
    }
  };

  const handleGameOver = useCallback((success: boolean) => {
    if (success && startTime) {
      const finalDiff = ((Date.now() - startTime) / 1000).toFixed(1);
      const finalTimeStr = `${finalDiff}초`;
      
      setElapsedTime(finalTimeStr);
      setGameState("success");
      
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#ff595e", "#1982c4", "#8ac926", "#ffca3a", "#6a4c93"]
      });
      
      saveScore(finalTimeStr);
    } else {
      setGameState("fail");
      setElapsedTime("--:--"); 
    }
  }, [startTime, userName, isSaving]); // Added dependencies for clarity

  const resetToStart = useCallback(() => {
    setGameState("start");
    setGameStarted(false);
    setElapsedTime("00:00");
    setIsSaving(false);
  }, []);

  const restartGame = useCallback(() => {
    resetToStart();
  }, [resetToStart]);

  const startActualGame = useCallback(() => {
    setStartTime(Date.now());
  }, []);

  return (
    <main className="min-h-screen bg-gradient-mesh flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden touch-none select-none">
      <AnimatePresence mode="wait">
        {gameState === "start" && (
          <motion.div
            key="start-screen"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-lg glass-morphism p-10 flex flex-col items-center gap-8 shadow-2xl relative overflow-hidden"
          >
            {/* Title */}
            <div className="flex flex-col items-center gap-2 z-10">
              <h1 className="text-4xl font-bold tracking-tight text-gradient">INU 벽돌깨기</h1>
              <p className="text-slate-400 text-sm">인천대학교 마스코트 횃불이와 함께하는 게임</p>
            </div>

            {/* Mascot */}
            <div className="relative w-48 h-48 drop-shadow-2xl">
              <Image 
                src="/mascot.jpg" 
                alt="INU Mascot Torch-i" 
                fill 
                className="object-contain hover:scale-105 transition-transform duration-500"
                priority
              />
            </div>

            <div className="grid grid-cols-1 gap-3 w-full bg-white/5 p-4 rounded-xl border border-white/10 text-sm">
              <div className="flex items-center gap-3 text-slate-300">
                <GraduationCap className="w-4 h-4 text-primary" />
                <span>학과: 물리학과</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <Hash className="w-4 h-4 text-secondary" />
                <span>학번: 202600305</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <User className="w-4 h-4 text-accent" />
                <span>이름: 최연우</span>
              </div>
            </div>

            {/* Input & Form */}
            <form onSubmit={handleStart} className="w-full flex flex-col gap-4">
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="플레이어 이름을 입력하세요"
                  className="w-full !pl-14 py-4 text-lg"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-primary to-secondary py-4 rounded-xl font-bold text-lg hover:shadow-[0_0_20px_rgba(79,70,229,0.5)] flex items-center justify-center gap-2"
              >
                <Gamepad2 className="w-5 h-5" />
                게임 시작
              </button>
            </form>
          </motion.div>
        )}

        {gameState === "playing" && (
          <motion.div
            key="game-screen"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-4xl flex flex-col gap-2 sm:gap-4"
          >
            <div className="flex justify-between items-center px-4">
               <h2 className="text-2xl font-bold text-gradient">INU 벽돌깨기</h2>
               <div className="glass-morphism px-6 py-2 flex items-center gap-3">
                 <span className="text-slate-400 text-sm">TIME</span>
                 <span className="text-xl font-mono font-bold text-primary">{elapsedTime}</span>
               </div>
            </div>
            <BrickBreaker 
              userName={userName} 
              onGameOver={handleGameOver} 
              onRestart={restartGame} 
              onGameStart={startActualGame} 
            />
          </motion.div>
        )}

        {(gameState === "success" || gameState === "fail") && (
          <motion.div
            key="result-screen"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md glass-morphism p-12 flex flex-col items-center gap-8 text-center"
          >
            {gameState === "success" ? (
              <>
                <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center">
                  <Trophy className="w-12 h-12 text-green-400" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-green-400 mb-2">축하합니다!</h2>
                  <p className="text-slate-300">모든 벽돌을 제거했습니다.</p>
                </div>
                <div className="text-5xl font-mono font-black text-white">{elapsedTime}</div>

                {/* 랭킹 섹션 */}
                <div className="w-full mt-4 flex flex-col gap-3">
                  <div className="flex items-center justify-center gap-2 text-primary font-bold">
                    <Trophy className="w-4 h-4" />
                    <span>실시간 Top 3 랭킹</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {rankings.length > 0 ? (
                      rankings.map((rank, index) => (
                        <div key={index} className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/10">
                          <div className="flex items-center gap-3">
                            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                              index === 0 ? "bg-yellow-500 text-black" : 
                              index === 1 ? "bg-slate-300 text-black" : 
                              "bg-orange-600 text-white"
                            }`}>
                              {index + 1}
                            </span>
                            <span className="font-medium text-slate-200">{rank.name}</span>
                          </div>
                          <span className="font-mono text-primary">{rank.time}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 text-xs italic">
                        {SCRIPT_URL ? "랭킹을 불러오는 중..." : "구글 시트 URL을 설정해주세요."}
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-12 h-12 text-red-400" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-red-500 mb-2">게임 미션 실패</h2>
                  <p className="text-slate-300">다시 도전해보세요!</p>
                </div>
              </>
            )}

            <button
              onClick={resetToStart}
              className="mt-4 px-10 py-4 bg-white/10 rounded-xl hover:bg-white/20 transition-colors flex items-center gap-2 font-bold"
            >
              <RefreshCw className="w-5 h-5" />
              다시 시작하기
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="fixed bottom-6 text-slate-600 text-xs tracking-widest uppercase">
        © 2026 INU PHYSICS - CHOI YEON WOO
      </footer>
    </main>
  );
}
