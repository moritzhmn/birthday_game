"use client";

import { useState, useEffect } from "react";
import Confetti from "react-confetti";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_KEY!
);

type Task = { text: string; points: number };
type Submission = { id: string; team: string; task: number };

const phaseTasks: Record<number, Task[]> = {
  1: [
    { text: "Find a public landmark", points: 1 },
    { text: "Take a team photo", points: 2 },
    { text: "Record a short video", points: 1 },
  ],
  2: [
    { text: "Find a bar or café", points: 1 },
    { text: "Group challenge with strangers", points: 2 },
    { text: "Creative team photo", points: 1 },
  ],
  3: [
    { text: "Final group photo", points: 2 },
    { text: "Team performance", points: 3 },
    { text: "Final check-in", points: 2 },
  ],
};

export default function Home() {
  const [team, setTeam] = useState("");
  const [lockedTeam, setLockedTeam] = useState<string | null>(null);
  const [phase, setPhase] = useState(1);
  const [tasks, setTasks] = useState<Task[]>(phaseTasks[1]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [confetti, setConfetti] = useState(false);

  // ---------------- TEAM ----------------
  useEffect(() => {
    const saved = localStorage.getItem("team");
    if (saved) {
      setLockedTeam(saved);
      const savedIndex = localStorage.getItem(`index_${saved}`);
      setCurrentTaskIndex(savedIndex ? parseInt(savedIndex) : 0);
      setTasks(phaseTasks[phase]);
    }
  }, [phase]);

  const lockTeam = () => {
    if (!team.trim()) return;
    localStorage.setItem("team", team.trim());
    setLockedTeam(team.trim());
    setTasks(phaseTasks[phase]);
    setCurrentTaskIndex(0);
    localStorage.setItem(`index_${team.trim()}`, "0");
  };

  // ---------------- UPLOAD ----------------
  const handleCompleteTask = async () => {
    if (!lockedTeam) return;
    const taskIdx = currentTaskIndex;
    const currentTask = tasks[taskIdx];

    // Speichern in Supabase
    await supabase.from("submissions").insert({
      team: lockedTeam,
      task: taskIdx,
    });

    // Confetti
    setConfetti(true);
    setTimeout(() => setConfetti(false), 2000);

    // Nächste Aufgabe
    const nextIndex = taskIdx + 1 < tasks.length ? taskIdx + 1 : taskIdx;
    setCurrentTaskIndex(nextIndex);
    localStorage.setItem(`index_${lockedTeam}`, nextIndex.toString());
  };

  const nextTask = () => {
    setCurrentTaskIndex((prev) => (prev + 1 < tasks.length ? prev + 1 : prev));
  };

  const prevTask = () => {
    setCurrentTaskIndex((prev) => (prev - 1 >= 0 ? prev - 1 : prev));
  };

  const currentTask = tasks[currentTaskIndex];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4">
      {confetti && <Confetti />}
      <h1 className="text-3xl font-bold mb-6">🎯 Birthday Challenge</h1>

      {!lockedTeam ? (
        <div className="w-full max-w-md flex flex-col gap-3">
          <input
            className="border p-3 rounded-lg w-full text-center"
            placeholder="Team Name"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
          />
          <button
            onClick={lockTeam}
            className="bg-black text-white p-3 rounded-lg w-full font-semibold hover:bg-gray-800 transition"
          >
            Join Team
          </button>
        </div>
      ) : (
        <>
          <p className="text-center mb-4 font-bold text-gray-700">Team: {lockedTeam}</p>

          <div className="relative w-full max-w-md h-64 flex items-center justify-center">
            <button
              onClick={prevTask}
              className="absolute left-0 bg-gray-200 hover:bg-gray-300 rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg"
            >
              ◀
            </button>

            <div className="bg-white rounded-2xl shadow-xl p-6 w-72 flex flex-col items-center justify-center text-center transition-transform duration-300">
              <p className="text-xl font-semibold mb-2">{currentTask.text}</p>
              <p className="text-gray-500">{currentTask.points} Punkte</p>
              <button
                onClick={handleCompleteTask}
                className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 transition"
              >
                Done
              </button>
            </div>

            <button
              onClick={nextTask}
              className="absolute right-0 bg-gray-200 hover:bg-gray-300 rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg"
            >
              ▶
            </button>
          </div>

          <p className="mt-4 text-gray-500">
            Aufgabe {currentTaskIndex + 1} / {tasks.length}
          </p>
        </>
      )}
    </div>
  );
}