import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Play,
  Pause,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  X as XIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

/**
 * Final PreGymTracker component
 *
 * Features:
 * - Full exercise list (18)
 * - Per-exercise durations (default values, editable)
 * - Radial timer in full workout mode
 * - Prev/Next navigation (with limits)
 * - Play / Pause / Reset
 * - Auto-rest between exercises with configurable rest seconds and toggle
 * - LocalStorage persistence for data, timers, running states, settings
 * - Beep and vibration feedback
 * - Progress chart + history quick view
 *
 * Notes:
 * - This file uses your existing button/card/switch primitives.
 * - If you want different durations, edit the `exercises` array durations.
 * - Keep an eye on bundle size for framer-motion / recharts if targeting very small bundles.
 */

type Exercise = {
  name: string;
  instructions: string;
  duration?: number; // seconds
};

const exercises: Exercise[] = [
  { name: "Cat-Cow", instructions: "Start on hands and knees. Alternate arching and rounding your back with breath.", duration: 30 },
  { name: "Ankle Rocking", instructions: "Stand tall and rock forward and back on your ankles, stretching calves and ankles.", duration: 30 },
  { name: "90/90 Hip Stretch", instructions: "Sit with front leg at 90°, back leg at 90°. Lean forward to stretch hips.", duration: 45 },
  { name: "Deep Squat Hold", instructions: "Drop into a deep squat, chest tall, hold position while breathing.", duration: 45 },
  { name: "Hip Flexor Stretch", instructions: "Kneel with one leg forward, press hips gently forward to stretch hip flexors.", duration: 30 },
  { name: "Cossack Squat", instructions: "Spread feet wide, shift into one leg while other leg is straight. Alternate sides.", duration: 30 },
  { name: "Glute Bridge", instructions: "Lie on your back, knees bent, lift hips while squeezing glutes.", duration: 40 },
  { name: "Glute Bridge March", instructions: "From bridge, lift one knee towards chest, alternating legs.", duration: 40 },
  { name: "Dead Bug", instructions: "Lie on back, arms and legs up. Lower opposite arm and leg, return, switch sides.", duration: 40 },
  { name: "Bird Dog", instructions: "On hands and knees, extend opposite arm and leg, hold, return, alternate.", duration: 30 },
  { name: "Plank", instructions: "Forearms down, body straight. Hold core tight without sagging hips.", duration: 60 },
  { name: "Side Plank", instructions: "Lie on side, lift hips, balancing on elbow and feet. Hold position.", duration: 45 },
  { name: "Hollow Hold", instructions: "Lie on back, lift shoulders and legs off floor, lower back pressed down.", duration: 40 },
  { name: "Superman Hold", instructions: "Lie on stomach, lift arms and legs up while squeezing back and glutes.", duration: 30 },
  { name: "Push-Up", instructions: "Hands under shoulders, lower chest to floor, push back up.", duration: 45 },
  { name: "Step-Ups", instructions: "Step onto a stable surface, driving through lead leg. Alternate legs.", duration: 60 },
  { name: "Squat to Chair", instructions: "Stand in front of chair, squat until seated, then stand back up.", duration: 45 },
  { name: "Brisk Walk / Cardio", instructions: "Walk quickly or do light cardio to elevate heart rate.", duration: 120 },
];

const STORAGE_KEY = "pre_gym_tracker_v1_final";

export default function PreGymTracker(): JSX.Element {
  // day / progress state
  const [day, setDay] = useState<number>(1);
  const [data, setData] = useState<Record<number, Record<string, boolean>>>({});

  // exercise / timers
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState<number>(0);
  const [timers, setTimers] = useState<Record<string, number>>(() =>
    Object.fromEntries(exercises.map((e) => [e.name, 0]))
  );
  const [running, setRunning] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(exercises.map((e) => [e.name, false]))
  );

  // workout UI
  const [workoutMode, setWorkoutMode] = useState<boolean>(false);
  const [autoRest, setAutoRest] = useState<boolean>(true);
  const [restSeconds, setRestSeconds] = useState<number>(20);
  const [isResting, setIsResting] = useState<boolean>(false);
  const [restTimer, setRestTimer] = useState<number>(0);

  const intervalsRef = useRef<Record<string, number | null>>(
    Object.fromEntries(exercises.map((e) => [e.name, null]))
  );
  const restIntervalRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // load from storage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.data) setData(parsed.data);
        if (parsed.timers) setTimers((t) => ({ ...t, ...parsed.timers }));
        if (parsed.running) setRunning((r) => ({ ...r, ...parsed.running }));
        if (typeof parsed.autoRest === "boolean") setAutoRest(parsed.autoRest);
        if (typeof parsed.restSeconds === "number") setRestSeconds(parsed.restSeconds);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // persist state
  useEffect(() => {
    const payload = { data, timers, running, autoRest, restSeconds };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [data, timers, running, autoRest, restSeconds]);

  // beep + vibrate feedback
  const playBeep = () => {
    if (!audioRef.current) {
      // small base64 beep; replace if you prefer a different sound
      audioRef.current = new Audio(
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="
      );
    }
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
    if (navigator.vibrate) navigator.vibrate(160);
  };

  // toggle completion for a day-exercise
  const toggleComplete = (exercise: string) => {
    setData((prev) => {
      const dayData = prev[day] ? { ...prev[day] } : {};
      dayData[exercise] = !dayData[exercise];
      return { ...prev, [day]: dayData };
    });
  };

  // helpers: counts, percent, weekly data, streak
  const dayCompletionCount = (d: number) => {
    const dayData = data[d] || {};
    return exercises.reduce((acc, ex) => (dayData[ex.name] ? acc + 1 : acc), 0);
  };

  const percentComplete = (d: number) => {
    return Math.round((dayCompletionCount(d) / exercises.length) * 100);
  };

  const makeWeeklyData = () => {
    const weeks: { name: string; completed: number }[] = [];
    for (let w = 0; w < 4; w++) {
      const start = w * 7 + 1;
      const end = Math.min(start + 6, 30);
      let completedDays = 0;
      for (let d = start; d <= end; d++) {
        if (data[d] && dayCompletionCount(d) > 0) completedDays++;
      }
      weeks.push({ name: `W${w + 1}`, completed: completedDays });
    }
    return weeks;
  };

  const computeStreak = () => {
    let streak = 0;
    for (let d = day; d >= 1; d--) {
      if (data[d] && dayCompletionCount(d) === exercises.length) streak++;
      else break;
    }
    return streak;
  };

  const weeklyData = makeWeeklyData();
  const streak = computeStreak();
  const currentExercise = exercises[currentExerciseIndex];

  // Timer core: start/stop interval per exercise (counts up to duration)
  const startIntervalFor = (exercise: Exercise) => {
    const name = exercise.name;
    if (intervalsRef.current[name]) return;
    // use window.setInterval to get a numeric id (works across environments)
    const id = window.setInterval(() => {
      setTimers((prev) => {
        const elapsed = (prev[name] || 0) + 1;
        // when reaches duration -> complete, beep, auto-advance + rest
        const finished = elapsed >= (exercise.duration || 30);
        if (finished) {
          playBeep();
          // mark complete for current day
          setData((prevData) => {
            const dayData = prevData[day] ? { ...prevData[day] } : {};
            dayData[name] = true;
            return { ...prevData, [day]: dayData };
          });
        }
        return { ...prev, [name]: finished ? (exercise.duration || 30) : elapsed };
      });
    }, 1000);
    intervalsRef.current[name] = id;
    setRunning((prev) => ({ ...prev, [name]: true }));
  };

  const stopIntervalFor = (exerciseName: string) => {
    const id = intervalsRef.current[exerciseName];
    if (id) {
      clearInterval(id as number);
      intervalsRef.current[exerciseName] = null;
    }
    setRunning((prev) => ({ ...prev, [exerciseName]: false }));
  };

  // handle play/pause toggles and auto-advance logic
  useEffect(() => {
    // watch timers & auto-advance: if current exercise reached duration, auto-advance + handle rest
    const name = currentExercise.name;
    const duration = currentExercise.duration ?? 30;
    const elapsed = timers[name] ?? 0;
    if (elapsed >= duration) {
      // stop current interval (if any)
      stopIntervalFor(name);

      // if autoRest is enabled and not the last exercise -> start rest timer and move to next after rest
      if (autoRest && currentExerciseIndex < exercises.length - 1) {
        setIsResting(true);
        setRestTimer(restSeconds);
        playBeep(); // short cue at start of rest
        restIntervalRef.current = window.setInterval(() => {
          setRestTimer((r) => {
            if (r <= 1) {
              // end rest
              if (restIntervalRef.current) {
                clearInterval(restIntervalRef.current as number);
                restIntervalRef.current = null;
              }
              setIsResting(false);
              // advance and auto-start next exercise
              setCurrentExerciseIndex((i) => {
                const nextIdx = Math.min(i + 1, exercises.length - 1);
                // optionally start next automatically
                const nextName = exercises[nextIdx].name;
                setTimers((t) => ({ ...t, [nextName]: 0 }));
                // start next immediately
                startIntervalFor(exercises[nextIdx]);
                return nextIdx;
              });
              return 0;
            }
            return r - 1;
          });
        }, 1000);
      } else {
        // if no auto rest: just auto-advance to next and stop
        if (currentExerciseIndex < exercises.length - 1) {
          setCurrentExerciseIndex((i) => i + 1);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timers, currentExerciseIndex, autoRest, restSeconds]);

  // cleanup on unmount: clear all intervals
  useEffect(() => {
    return () => {
      Object.values(intervalsRef.current).forEach((id) => {
        if (id) clearInterval(id as number);
      });
      if (restIntervalRef.current) clearInterval(restIntervalRef.current as number);
    };
  }, []);

  const handleTimerToggle = (exercise: Exercise) => {
    const name = exercise.name;
    // if currently running => pause
    if (running[name]) {
      stopIntervalFor(name);
      return;
    }
    // if not running, start it
    // reset to 0 if already finished
    const duration = exercise.duration ?? 30;
    if ((timers[name] || 0) >= duration) {
      setTimers((prev) => ({ ...prev, [name]: 0 }));
    }
    startIntervalFor(exercise);
  };

  const handleResetTimer = (exercise: Exercise) => {
    stopIntervalFor(exercise.name);
    setTimers((prev) => ({ ...prev, [exercise.name]: 0 }));
    playBeep();
  };

  const handlePrev = () => {
    if (currentExerciseIndex > 0) {
      stopIntervalFor(currentExercise.name);
      setCurrentExerciseIndex((i) => i - 1);
    }
  };

  const handleNext = () => {
    if (currentExerciseIndex < exercises.length - 1) {
      stopIntervalFor(currentExercise.name);
      setCurrentExerciseIndex((i) => i + 1);
    }
  };

  const resetDay = (d: number) => {
    setData((prev) => {
      const copy = { ...prev };
      delete copy[d];
      return copy;
    });
  };

  // UI helpers
  const completedFullDays = Object.keys(data).filter((d) => dayCompletionCount(Number(d)) === exercises.length).length;

  // render workout full screen
  if (workoutMode) {
    const name = currentExercise.name;
    const duration = currentExercise.duration ?? 30;
    const elapsed = Math.min(timers[name] ?? 0, duration);
    const percent = Math.round((elapsed / duration) * 100);

    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-between p-6 z-50">
        {/* Top bar: prev / index / next */}
        <div className="w-full flex items-center justify-between text-gray-700">
          <Button variant="ghost" onClick={handlePrev} disabled={currentExerciseIndex === 0}>
            <ArrowLeft className="w-5 h-5" /> Prev
          </Button>

          <div className="text-sm text-center">
            <div>Exercise {currentExerciseIndex + 1} of {exercises.length}</div>
            {isResting ? <div className="text-xs text-gray-500">Resting — {restTimer}s</div> : null}
          </div>

          <Button variant="ghost" onClick={handleNext} disabled={currentExerciseIndex === exercises.length - 1}>
            Next <ArrowRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Center: radial timer + exercise */}
        <motion.div
          key={name + (isResting ? "-rest" : "")}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32 }}
          className="flex flex-col items-center space-y-4"
        >
          <div className="w-48 h-48">
            <CircularProgressbar
              value={percent}
              text={isResting ? `${restTimer}s` : `${elapsed}s`}
              styles={buildStyles({
                textSize: "18px",
                textColor: "#111827",
                pathColor: isResting ? "#6b7280" : "#2563eb",
                trailColor: "#e5e7eb",
                pathTransitionDuration: 0.5,
              })}
            />
          </div>

          <h2 className="text-2xl font-bold text-center max-w-xs">{isResting ? "Rest" : currentExercise.name}</h2>
          <p className="text-gray-600 text-center max-w-md text-sm">
            {isResting ? "Use this time to recover briefly." : currentExercise.instructions}
          </p>
        </motion.div>

        {/* Controls */}
        <div className="flex gap-4 items-center">
          {/* Play / Pause */}
          <Button size="lg" onClick={() => { if (!isResting) handleTimerToggle(currentExercise); }}>
            {running[name] ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </Button>

          {/* Reset */}
          <Button variant="outline" size="lg" onClick={() => { if (!isResting) handleResetTimer(currentExercise); }}>
            <RotateCcw className="w-5 h-5" />
          </Button>
        </div>

        {/* Footer: exit workout */}
        <div className="w-full flex justify-center">
          <Button variant="destructive" onClick={() => {
            // stop all running intervals for safety
            Object.keys(running).forEach((n) => stopIntervalFor(n));
            if (restIntervalRef.current) {
              clearInterval(restIntervalRef.current as number);
              restIntervalRef.current = null;
            }
            setIsResting(false);
            setWorkoutMode(false);
          }}>
            <XIcon className="w-4 h-4 mr-2" /> Exit Workout
          </Button>
        </div>
      </div>
    );
  }

  // main app view
  return (
    <div className="px-4 py-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-center">30-Day Pre-Gym Tracker</h1>
      <p className="text-center text-gray-500">Day {day} of 30 — {percentComplete(day)}% complete</p>

      {/* Current exercise card */}
      <Card className="p-4">
        <CardContent className="space-y-4 text-center">
          <h2 className="text-xl font-semibold">{currentExercise.name}</h2>
          <p className="text-sm text-gray-500">{currentExercise.instructions}</p>
          <p className="text-3xl font-mono">{timers[currentExercise.name] || 0}s</p>

          <div className="flex items-center gap-3 justify-center">
            <Button size="icon" variant="outline" onClick={() => handleTimerToggle(currentExercise)}>
              {running[currentExercise.name] ? <Pause /> : <Play />}
            </Button>

            <Button size="icon" variant="outline" onClick={() => handleResetTimer(currentExercise)}>
              <RotateCcw className="w-5 h-5" />
            </Button>

            <Button size="icon" onClick={handleNext}>
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2">
            <Switch
              checked={!!data[day]?.[currentExercise.name]}
              onCheckedChange={() => toggleComplete(currentExercise.name)}
            />
            <span className="text-sm">Mark Complete</span>
          </div>

          <div className="mt-3">
            <Button onClick={() => setWorkoutMode(true)}>Start Guided Workout</Button>
          </div>
        </CardContent>
      </Card>

      {/* Checklist & progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Daily Checklist</h2>
              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <span className="text-gray-600">Auto-rest</span>
                  <Switch checked={autoRest} onCheckedChange={(v) => setAutoRest(!!v)} />
                </label>
                <div className="text-xs text-gray-500">Rest {restSeconds}s</div>
              </div>
            </div>

            <ul className="space-y-2 max-h-64 overflow-auto">
              {exercises.map((ex, idx) => (
                <li
                  key={ex.name}
                  className={`flex items-center justify-between rounded px-2 py-2 cursor-pointer ${idx === currentExerciseIndex ? "bg-blue-50" : ""}`}
                  onClick={() => setCurrentExerciseIndex(idx)}
                >
                  <div className="flex flex-col text-left">
                    <span className="font-medium text-sm">{ex.name}</span>
                    <span className="text-xs text-gray-500">{(ex.duration ?? 30)}s</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch checked={!!data[day]?.[ex.name]} onCheckedChange={() => toggleComplete(ex.name)} />
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex gap-2 justify-center">
              <Button variant="outline" onClick={() => resetDay(day)}>Clear Day</Button>
              <Button variant="outline" onClick={() => setDay((d) => Math.max(1, d - 1))}>Prev Day</Button>
              <Button onClick={() => setDay((d) => Math.min(30, d + 1))}>Next Day</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardContent>
            <h2 className="text-lg font-semibold">Progress</h2>
            <p className="text-sm text-gray-600">Full completions: {completedFullDays}</p>
            <p className="text-sm text-gray-600">Current streak: {streak} day(s)</p>

            <div style={{ width: "100%", height: 180 }} className="mt-3">
              <ResponsiveContainer>
                <BarChart data={weeklyData}>
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="completed" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History quick view */}
      <Card className="p-4">
        <CardContent>
          <h2 className="text-lg font-semibold">History Quick View</h2>
          <div className="grid grid-cols-6 gap-2 mt-3">
            {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
              <button
                key={d}
                onClick={() => setDay(d)}
                className={`p-2 rounded-lg text-sm font-medium ${day === d ? "bg-blue-200" : data[d] ? "bg-green-200" : "bg-gray-100"}`}
                title={`Day ${d} — ${dayCompletionCount(d)} completed`}
              >
                {d}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
