"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import Confetti from "react-confetti";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_KEY!
);

type Task = { id: number; text: string; points: number };

const phaseTasks: Record<number, Task[]> = {
  1: [
    { id: 1, text: "Find a public landmark", points: 1 },
    { id: 2, text: "Take a team photo", points: 2 },
    { id: 3, text: "Record a short video", points: 1 },
  ],
  2: [
    { id: 4, text: "Find a bar or café", points: 1 },
    { id: 5, text: "Group challenge with strangers", points: 2 },
    { id: 6, text: "Creative team photo", points: 1 },
  ],
  3: [
    { id: 7, text: "Final group photo", points: 2 },
    { id: 8, text: "Team performance", points: 3 },
    { id: 9, text: "Final location check-in", points: 2 },
  ],
};

const phaseMeetingPoints: Record<number, { name: string; url: string }> = {
  1: { name: "Stadtpark Hamburg", url: "https://goo.gl/maps/xyz1" },
  2: { name: "Marktplatz Hamburg", url: "https://goo.gl/maps/xyz2" },
  3: { name: "Hafen Hamburg", url: "https://goo.gl/maps/xyz3" },
};

export default function Home() {
  const [team, setTeam] = useState("");
  const [lockedTeam, setLockedTeam] = useState<string | null>(null);
  const [phase, setPhase] = useState(1);
  const [timeLeft, setTimeLeft] = useState(0);
  const [gameActive, setGameActive] = useState(false);
  const [needsArrival, setNeedsArrival] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<number[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<number, string>>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ---------------- Load Team from localStorage ----------------
  useEffect(() => {
    const savedTeam = localStorage.getItem("team");
    if (savedTeam) {
      console.log("[TEAM] Loaded from localStorage:", savedTeam);
      setLockedTeam(savedTeam);
    }
  }, []);

  // ---------------- Load completed tasks ----------------
  useEffect(() => {
    if (!lockedTeam) return;

    const fetchCompletedTasks = async () => {
      try {
        const { data: submissions, error } = await supabase
          .from("submissions")
          .select("task, image_url")
          .eq("team", lockedTeam)
          .eq("phase", phase);

        if (error) {
          console.error("[LOAD] Supabase error:", error);
          return;
        }

        const taskIds = submissions?.map(s => s.task) || [];

        const preview: Record<number, string> = {};
        submissions?.forEach(s => {
          if (s.image_url) preview[s.task] = s.image_url;
        });

        setCompletedTasks(taskIds);
        setPreviewUrls(preview);

        console.log("[LOAD] Completed tasks:", taskIds);

      } catch (err) {
        console.error("[LOAD] Exception:", err);
      }
    };

    fetchCompletedTasks();
    startPhaseTimer(false);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (fetchIntervalRef.current) clearInterval(fetchIntervalRef.current);
    };

  }, [lockedTeam, phase]);

  // ---------------- Lock team ----------------
  const lockTeam = () => {
    if (!team.trim()) return;

    localStorage.setItem("team", team.trim());
    setLockedTeam(team.trim());

    console.log("[TEAM] Saved:", team);

    startPhaseTimer(true);
  };

  // ---------------- Fetch Game State ----------------
  const fetchGameStateAndUpdateTimer = async () => {
    try {
      const { data: game, error } = await supabase
        .from("game_state")
        .select("*")
        .eq("phase", phase)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[GAME] fetch error:", error);
        return;
      }

      console.log("[GAME] fetched:", game);

      if (!game || !game.is_active || !game.started_at) {
        setGameActive(false);
        setTimeLeft(0);
        setNeedsArrival(false);
        return;
      }

      const elapsed = Math.floor(
        (Date.now() - new Date(game.started_at).getTime()) / 1000
      );

      const remaining = Math.max(game.duration_sec - elapsed, 0);

      setTimeLeft(remaining);
      setGameActive(remaining > 0);
      setNeedsArrival(remaining === 0);

    } catch (err) {
      console.error("[GAME] Exception:", err);
    }
  };

  // ---------------- Timer ----------------
  const startPhaseTimer = (reset: boolean) => {

    if (intervalRef.current) clearInterval(intervalRef.current);
    if (fetchIntervalRef.current) clearInterval(fetchIntervalRef.current);

    if (reset) {
      const duration = 10 * 60;
      setTimeLeft(duration);
      setGameActive(true);
      setNeedsArrival(false);
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;

        if (next <= 0) {
          clearInterval(intervalRef.current!);
          setGameActive(false);
          setNeedsArrival(true);
          return 0;
        }

        return next;
      });
    }, 1000);

    fetchGameStateAndUpdateTimer();
    fetchIntervalRef.current = setInterval(fetchGameStateAndUpdateTimer, 5000);
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, "0")}:${(s % 60)
      .toString()
      .padStart(2, "0")}`;

  // ---------------- Upload ----------------
  const uploadToCloudinary = async (file: File, taskId: number) => {
    if (!lockedTeam || !gameActive) return;

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "ml_default");

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/du23icjcr/image/upload`,
        { method: "POST", body: formData }
      );

      if (!res.ok) return;

      const data = await res.json();
      const publicUrl = data.secure_url;

      setPreviewUrls(prev => ({ ...prev, [taskId]: publicUrl }));

      const { error } = await supabase.from("submissions").insert({
        team: lockedTeam,
        task: taskId, // FIXED
        phase,
        image_url: publicUrl,
      });

      if (!error) {
        setConfetti(true);
        setTimeout(() => setConfetti(false), 2000);

        setCompletedTasks(prev =>
          [...new Set([...prev, taskId])]
        );
      }

    } catch (err) {
      console.error("[UPLOAD] Error:", err);
    }
  };

  const currentTasks = gameActive
    ? (phaseTasks[phase] || []).filter(
        t => !completedTasks.includes(t.id)
      )
    : [];

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-gray-900">
      {confetti && <Confetti />}

      <h1 className="text-4xl font-bold text-center mb-6">
        Birthday Challenge - Phase {phase}
      </h1>

      {gameActive && (
        <p className="text-center text-lg mb-4">
          ⏱ Zeit: {formatTime(timeLeft)}
        </p>
      )}

      {!lockedTeam ? (
        <div className="max-w-md mx-auto bg-white shadow-lg p-6 rounded-xl">
          <input
            className="border p-3 w-full mb-4 rounded text-gray-900"
            placeholder="Team Name"
            value={team}
            onChange={e => setTeam(e.target.value)}
          />

          <button
            onClick={lockTeam}
            className="bg-blue-600 text-white w-full p-3 rounded hover:bg-blue-700 transition"
          >
            Team speichern & Phase starten
          </button>
        </div>
      ) : (
        <p className="text-center text-xl font-semibold mb-6">
          Team: {lockedTeam}
        </p>
      )}

      {needsArrival ? (
        <div className="p-4 border rounded-lg bg-red-100 text-center mb-6">
          <p className="font-bold mb-2">
            ⏱ Phase beendet! Treffpunkt:
          </p>

          {phaseMeetingPoints[phase] && (
            <a
              href={phaseMeetingPoints[phase].url}
              target="_blank"
              className="text-blue-600 underline"
            >
              {phaseMeetingPoints[phase].name}
            </a>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {currentTasks.map(task => (
            <div
              key={task.id}
              className="bg-white rounded-xl shadow-lg p-5 flex flex-col justify-between hover:shadow-2xl transition"
            >
              <div>
                <p className="font-bold text-lg mb-2">
                  {task.text}
                </p>

                <p className="text-sm text-gray-500 mb-2">
                  {task.points} Punkte
                </p>

                {previewUrls[task.id] && (
                  <img
                    src={previewUrls[task.id]}
                    className="mt-2 rounded-lg border"
                  />
                )}
              </div>

              <input
                type="file"
                accept="image/*"
                disabled={!gameActive}
                onChange={e =>
                  e.target.files &&
                  uploadToCloudinary(
                    e.target.files[0],
                    task.id
                  )
                }
                className="mt-3"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}