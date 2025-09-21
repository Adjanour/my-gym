import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const exercises = [
  "Cat-Cow",
  "Ankle Rocking",
  "90/90 Hip Stretch",
  "Deep Squat Hold",
  "Hip Flexor Stretch",
  "Cossack Squat",
  "Glute Bridge",
  "Glute Bridge March",
  "Dead Bug",
  "Bird Dog",
  "Plank",
  "Side Plank",
  "Hollow Hold",
  "Superman Hold",
  "Push-Up",
  "Step-Ups",
  "Squat to Chair",
  "Brisk Walk / Cardio",
];

const STORAGE_KEY = "pre_gym_tracker_v1";

export default function PreGymTracker() {
  const [day, setDay] = useState(1);
  const [data, setData] = useState<Record<number, Record<string, boolean>>>({});
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [timers, setTimers] = useState<Record<string, number>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const intervalsRef = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      setData(parsed.data || {});
      setTimers(parsed.timers || {});
      setRunning(parsed.running || {});
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ data, timers, running })
    );
  }, [data, timers, running]);

  const toggleComplete = (exercise: string) => {
    setData((prev) => {
      const dayData = prev[day] ? { ...prev[day] } : {};
      dayData[exercise] = !dayData[exercise];
      return { ...prev, [day]: dayData };
    });
  };

  const nextExercise = () => {
    if (currentExerciseIndex < exercises.length - 1) {
      stopTimer(exercises[currentExerciseIndex]);
      setCurrentExerciseIndex(currentExerciseIndex + 1);
    }
  };

  const handleTimer = (exercise: string) => {
    if (running[exercise]) {
      stopTimer(exercise);
    } else {
      const interval = setInterval(() => {
        setTimers((prev) => ({ ...prev, [exercise]: (prev[exercise] || 0) + 1 }));
      }, 1000);
      intervalsRef.current[exercise] = interval;
      setRunning((prev) => ({ ...prev, [exercise]: true }));
    }
  };

  const stopTimer = (exercise: string) => {
    clearInterval(intervalsRef.current[exercise]);
    setRunning((prev) => ({ ...prev, [exercise]: false }));
  };

  const resetTimer = (exercise: string) => {
    stopTimer(exercise);
    setTimers((prev) => ({ ...prev, [exercise]: 0 }));
  };

  const dayCompletionCount = (d: number) => {
    const dayData = data[d] || {};
    return exercises.reduce((acc, ex) => (dayData[ex] ? acc + 1 : acc), 0);
  };

  const percentComplete = (d: number) => {
    return Math.round((dayCompletionCount(d) / exercises.length) * 100);
  };

  const makeWeeklyData = () => {
    const weeks = [] as { name: string; completed: number }[];
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

  const resetDay = (d: number) => {
    setData((prev) => {
      const copy = { ...prev };
      delete copy[d];
      return copy;
    });
  };

  const weeklyData = makeWeeklyData();
  const streak = computeStreak();
  const currentExercise = exercises[currentExerciseIndex];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-center">30-Day Pre-Gym Tracker</h1>
      <p className="text-center">Day {day} of 30 — {percentComplete(day)}% complete</p>

      <div className="grid grid-cols-1 gap-4">
        <Card className="p-4">
          <CardContent className="space-y-4 text-center">
            <h2 className="text-xl font-semibold">{currentExercise}</h2>
            <p className="text-3xl">⏱ {timers[currentExercise] || 0}s</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => handleTimer(currentExercise)}>
                {running[currentExercise] ? "Pause" : "Start"}
              </Button>
              <Button variant="outline" onClick={() => resetTimer(currentExercise)}>Reset</Button>
              <Button onClick={nextExercise}>Next ▶</Button>
            </div>
            <div className="mt-2">
              <input
                type="checkbox"
                checked={data[day]?.[currentExercise] || false}
                onChange={() => toggleComplete(currentExercise)}
              /> <span className="ml-2">Mark Complete</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <CardContent>
            <h2 className="text-lg font-semibold mb-2">Daily Checklist</h2>
            <ul className="space-y-2 max-h-64 overflow-auto">
              {exercises.map((ex, idx) => (
                <li
                  key={ex}
                  className={`flex items-center justify-between border-b pb-1 ${idx === currentExerciseIndex ? "bg-yellow-100" : ""}`}
                  onClick={() => setCurrentExerciseIndex(idx)}
                >
                  <span>{ex}</span>
                  <input
                    type="checkbox"
                    checked={data[day]?.[ex] || false}
                    onChange={() => toggleComplete(ex)}
                  />
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2 justify-center">
              <Button variant="outline" onClick={() => resetDay(day)}>Clear Day</Button>
              <Button onClick={() => setDay((d) => Math.max(1, d - 1))}>Prev Day</Button>
              <Button onClick={() => setDay((d) => Math.min(30, d + 1))}>Next Day</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardContent>
            <h2 className="text-lg font-semibold">Progress</h2>
            <p>Full completions: {Object.keys(data).filter(d => dayCompletionCount(Number(d)) === exercises.length).length}</p>
            <p>Current streak: {streak} day(s)</p>
            <div style={{ width: "100%", height: 180 }} className="mt-3">
              <ResponsiveContainer>
                <BarChart data={weeklyData}>
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="completed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="p-4">
        <CardContent>
          <h2 className="text-lg font-semibold">History Quick View</h2>
          <div className="grid grid-cols-5 gap-2 mt-3">
            {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
              <button
                key={d}
                onClick={() => setDay(d)}
                className={`p-2 rounded ${day === d ? "bg-blue-200" : data[d] ? "bg-green-200" : "bg-gray-100"}`}
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
