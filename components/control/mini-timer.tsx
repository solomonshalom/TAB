import { useState } from "react";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/components/ui/button";

interface TimerState {
  seconds: number;
  isRunning: boolean;
  setSeconds: (value: number) => void;
  setIsRunning: (value: boolean) => void;
}

export function MiniTimer({ timerState }: { timerState: TimerState }) {
  const { seconds, isRunning, setSeconds, setIsRunning } = timerState;
  const [mode, setMode] = useState<'timer' | 'pomodoro'>('timer');
  const [pomodoroPhase, setPomodoroPhase] = useState<'work' | 'shortBreak' | 'longBreak'>('work');
  const [pomodoroSession, setPomodoroSession] = useState(1);
  
  // Pomodoro settings (in seconds)
  const WORK_TIME = 25 * 60; // 25 minutes
  const SHORT_BREAK_TIME = 5 * 60; // 5 minutes
  const LONG_BREAK_TIME = 15 * 60; // 15 minutes

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTargetTime = () => {
    if (mode === 'timer') return null;
    
    switch (pomodoroPhase) {
      case 'work': return WORK_TIME;
      case 'shortBreak': return SHORT_BREAK_TIME;
      case 'longBreak': return LONG_BREAK_TIME;
      default: return WORK_TIME;
    }
  };

  const getRemainingTime = () => {
    const target = getTargetTime();
    if (!target) return seconds;
    return Math.max(0, target - seconds);
  };

  const getPhaseInfo = () => {
    switch (pomodoroPhase) {
      case 'work': return { label: `Work ${pomodoroSession}`, color: 'text-red-200' };
      case 'shortBreak': return { label: 'Short Break', color: 'text-green-200' };
      case 'longBreak': return { label: 'Long Break', color: 'text-blue-200' };
      default: return { label: 'Work', color: 'text-red-200' };
    }
  };

  const handleToggle = () => {
    if (mode === 'pomodoro' && !isRunning && seconds === 0) {
      // Starting a new pomodoro phase
      const target = getTargetTime();
      if (target) {
        setSeconds(0);
      }
    }
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    setSeconds(0);
    if (mode === 'pomodoro') {
      setPomodoroPhase('work');
      setPomodoroSession(1);
    }
  };

  const handlePomodoroComplete = () => {
    setIsRunning(false);
    
    if (pomodoroPhase === 'work') {
      if (pomodoroSession === 4) {
        // After 4 work sessions, long break
        setPomodoroPhase('longBreak');
      } else {
        // Short break
        setPomodoroPhase('shortBreak');
      }
    } else {
      // After any break, back to work
      setPomodoroPhase('work');
      if (pomodoroPhase === 'longBreak') {
        setPomodoroSession(1); // Reset session count after long break
      } else {
        setPomodoroSession(prev => prev + 1);
      }
    }
    setSeconds(0);
  };

  // Check if pomodoro phase is complete
  if (mode === 'pomodoro' && isRunning) {
    const target = getTargetTime();
    if (target && seconds >= target) {
      handlePomodoroComplete();
    }
  }

  const phaseInfo = getPhaseInfo();
  const displayTime = mode === 'pomodoro' ? getRemainingTime() : seconds;

  return (
    <div className="mt-2 p-3 rounded-lg bg-purple-200/5 border border-purple-200/10">
      {/* Mode Toggle */}
      <div className="flex gap-1 mb-2">
        <button
          onClick={() => setMode('timer')}
          className={cn(
            "text-xs px-2 py-1 rounded transition-colors",
            mode === 'timer' 
              ? "bg-purple-400/20 text-purple-100" 
              : "text-purple-200/60 hover:text-purple-200"
          )}
        >
          Timer
        </button>
        <button
          onClick={() => setMode('pomodoro')}
          className={cn(
            "text-xs px-2 py-1 rounded transition-colors",
            mode === 'pomodoro' 
              ? "bg-purple-400/20 text-purple-100" 
              : "text-purple-200/60 hover:text-purple-200"
          )}
        >
          Pomodoro
        </button>
      </div>

      {/* Timer Display */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex flex-col">
          <span className="text-xs text-purple-200 font-medium">
            {mode === 'timer' ? 'Timer' : phaseInfo.label}
          </span>
          {mode === 'pomodoro' && (
            <div className="flex gap-1 mt-1">
              {[1, 2, 3, 4].map((session) => (
                <div
                  key={session}
                  className={cn(
                    "w-2 h-2 rounded-full",
                    session <= pomodoroSession && pomodoroPhase === 'work'
                      ? "bg-purple-400"
                      : session < pomodoroSession
                      ? "bg-purple-400/60"
                      : "bg-purple-200/20"
                  )}
                />
              ))}
            </div>
          )}
        </div>
        <div className={cn(
          "text-lg font-mono",
          mode === 'pomodoro' ? phaseInfo.color : "text-purple-100"
        )}>
          {formatTime(displayTime)}
        </div>
      </div>

      {/* Progress Bar for Pomodoro */}
      {mode === 'pomodoro' && (
        <div className="mb-2">
          <div className="w-full bg-purple-200/10 rounded-full h-1">
            <div
              className={cn(
                "h-1 rounded-full transition-all",
                pomodoroPhase === 'work' ? "bg-red-400" : 
                pomodoroPhase === 'shortBreak' ? "bg-green-400" : "bg-blue-400"
              )}
              style={{
                width: `${((seconds / (getTargetTime() || 1)) * 100)}%`
              }}
            />
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={handleToggle}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "flex-1 text-xs h-7"
          )}
        >
          {isRunning ? (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-1"
              >
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
              Pause
            </>
          ) : (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-1"
              >
                <polygon points="5,3 19,12 5,21" />
              </svg>
              Start
            </>
          )}
        </button>
        <button
          onClick={handleReset}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "text-xs h-7 px-3"
          )}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
        {mode === 'pomodoro' && (
          <button
            onClick={handlePomodoroComplete}
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "text-xs h-7 px-3"
            )}
            title="Skip to next phase"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="5,4 15,12 5,20" />
              <line x1="19" x2="19" y1="5" y2="19" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}