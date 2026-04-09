"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import Confetti from "react-confetti";
import { motion } from "framer-motion";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_KEY!
);

type Task = { id: number; text: string; points: number; type?: "image" | "video" };

const phaseTasks: Record<number, Task[]> = {
  1: [
    { id: 1, text: "Find a public landmark", points: 1, type: "image" },
    { id: 2, text: "Take a team photo in the park", points: 2, type: "image" },
    { id: 3, text: "Record a short video of your team", points: 1, type: "video" },
    { id: 4, text: "Draw a chalk art on the sidewalk", points: 2, type: "image" },
    { id: 5, text: "Collect 3 different leaves", points: 1, type: "image" },
  ],
  2: [
    { id: 11, text: "Find a bar or café", points: 1, type: "image" },
    { id: 12, text: "Order a drink together and toast", points: 2, type: "image" },
    { id: 15, text: "Sing a short song together", points: 3, type: "video" },
    { id: 17, text: "Find a colorful mural and take a photo", points: 2, type: "image" },
  ],
  3: [
    { id: 24, text: "Make a short funny video skit", points: 3, type: "video" },
    { id: 25, text: "Draw a team logo in chalk", points: 1, type: "image" },
    { id: 29, text: "Record a short thank-you message", points: 1, type: "video" },
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
  const [confetti, setConfetti] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<number[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<number, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ---------------- Load Team ----------------
  useEffect(() => {
    const savedTeam = localStorage.getItem("team");
    if (savedTeam) setLockedTeam(savedTeam);
  }, []);

  // ---------------- Load Completed Tasks ----------------
  useEffect(() => {
    if (!lockedTeam) return;

    const fetchCompletedTasks = async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("task, image_url")
        .eq("team", lockedTeam)
        .eq("phase", phase);

      if (error) {
        console.error("Failed to fetch completed tasks:", error);
        return;
      }

      const ids = data?.map((s) => s.task) || [];
      const preview: Record<number, string> = {};
      data?.forEach((s) => {
        if (s.image_url) preview[s.task] = s.image_url;
      });

      setCompletedTasks(ids);
      setPreviewUrls(preview);
    };

    fetchCompletedTasks();
  }, [lockedTeam, phase]);

  // ---------------- Fetch Game State ----------------
  const fetchGameState = async () => {
    if (!lockedTeam) return;

    const { data, error } = await supabase
      .from("game_state")
      .select("id,is_active,started_at,duration_sec,phase")
      .eq("is_active", true)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data || !data.is_active || !data.started_at) {
      setGameActive(false);
      setTimeLeft(0);
      return;
    }

    setPhase(data.phase);

    const elapsed = Math.floor((Date.now() - new Date(data.started_at).getTime()) / 1000);
    const remaining = Math.max(data.duration_sec - elapsed, 0);

    setTimeLeft(remaining);
    setGameActive(remaining > 0);
  };

  // ---------------- Timer ----------------
  useEffect(() => {
    fetchGameState();
    fetchIntervalRef.current = setInterval(fetchGameState, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (fetchIntervalRef.current) clearInterval(fetchIntervalRef.current);
    };
  }, [lockedTeam, phase]);

  useEffect(() => {
    if (!gameActive) return;

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [gameActive]);

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${min}:${sec}`;
  };

  const lockTeam = () => {
    if (!team) return;
    localStorage.setItem("team", team);
    setLockedTeam(team);
  };

  // ---------------- Upload Funktion ----------------
  const upload = async (file: File, task: Task) => {
    setUploadProgress((p) => ({ ...p, [task.id]: 0 }));

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "ml_default");

    const endpoint =
      task.type === "video"
        ? "https://api.cloudinary.com/v1_1/du23icjcr/video/upload"
        : "https://api.cloudinary.com/v1_1/du23icjcr/image/upload";

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", endpoint);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress((p) => ({ ...p, [task.id]: percent }));
        }
      };

      xhr.onload = async () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          await supabase.from("submissions").insert({
            team: lockedTeam,
            task: task.id,
            phase,
            image_url: data.secure_url,
          });

          setPreviewUrls((p) => ({ ...p, [task.id]: data.secure_url }));
          setCompletedTasks((p) => (p.includes(task.id) ? p : [...p, task.id]));
          setConfetti(true);
          setTimeout(() => setConfetti(false), 2000);
          setUploadProgress((p) => ({ ...p, [task.id]: 0 }));
          resolve();
        } else {
          reject(xhr.responseText);
        }
      };

      xhr.onerror = () => reject("Upload failed");
      xhr.send(formData);
    });
  };

  const tasks = lockedTeam
    ? phaseTasks[phase].filter((t) => !completedTasks.includes(t.id))
    : [];

  // --- Reset currentIndex bei Tasks-Änderung ---
  useEffect(() => {
    if (currentIndex >= tasks.length) setCurrentIndex(Math.max(tasks.length - 1, 0));
  }, [tasks]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 flex flex-col items-center">
      {confetti && <Confetti />}

      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-bold text-center mb-6"
      >
        Birthday Challenge
      </motion.h1>

      {lockedTeam && (
  <div className="text-center mb-6">
    {timeLeft > 0 ? (
      <>
        <div className="text-5xl font-mono font-bold">{formatTime(timeLeft)}</div>
        <div className="text-sm opacity-70">
          Team {lockedTeam} • Phase {phase}
        </div>
      </>
    ) : (
      // Karte immer anzeigen, wenn Timer abgelaufen
      phaseMeetingPoints[phase] && (
        <div className= "max-w-md w-full bg-gradient-to-r from-purple-600 to-pink-500 p-6 rounded-2xl shadow-2xl text-white flex flex-col items-center mt-4 animate-fadeIn">
          <p className="flex items-center gap-2 text-xl font-bold mb-2">
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-yellow-300"
  >
    <path d="M12 21C12 21 7 14 7 10C7 7.79086 8.79086 6 11 6C13.2091 6 15 7.79086 15 10C15 14 12 21 12 21Z" />
    <circle cx="12" cy="10" r="2" />
  </svg>
  Treffpunkt
</p>
          <a
            href={phaseMeetingPoints[phase].url}
            target="_blank"
            className="text-white text-lg font-semibold underline hover:text-yellow-300 transition-colors"
          >
            {phaseMeetingPoints[phase].name}
          </a>
          <p className="mt-2 text-sm opacity-80 text-center">
            Gehe zum Treffpunkt, sobald der Timer abgelaufen ist.
          </p>
        </div>
      )
    )}
  </div>
)}

      {!lockedTeam && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md mx-auto bg-white/10 backdrop-blur-lg p-6 rounded-2xl"
        >
          <input
            className="w-full p-3 rounded-xl bg-white/20 border border-white/20 mb-4"
            placeholder="Team Name"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
          />
          <button
            onClick={lockTeam}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 p-3 rounded-xl font-semibold"
          >
            Join Game
          </button>
        </motion.div>
      )}

      {timeLeft >  0 && (
        <div className="relative w-full max-w-md mt-6 flex flex-col items-center">
          {tasks[currentIndex] ? (
            <>
              <motion.div
                key={tasks[currentIndex].id}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl w-full flex flex-col items-center"
              >
                <div className="font-bold text-lg mb-2 text-center">{tasks[currentIndex].text}</div>
                <div className="bg-purple-600 text-white px-3 py-1 rounded-full mb-4 text-sm font-semibold">
                  {tasks[currentIndex].points} Punkte
                </div>

                {previewUrls[tasks[currentIndex].id] &&
                  (tasks[currentIndex].type === "video" ? (
                    <video
                      src={previewUrls[tasks[currentIndex].id]}
                      controls
                      className="rounded-xl border border-white/20 mb-4"
                    />
                  ) : (
                    <img
                      src={previewUrls[tasks[currentIndex].id]}
                      className="rounded-xl border border-white/20 mb-4"
                    />
                  ))}

                <label className="w-full py-2 px-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-center cursor-pointer font-semibold hover:brightness-110 transition">
                  {tasks[currentIndex].type === "video" ? "Video hochladen" : "Bild hochladen"}
                  <input
                    type="file"
                    accept={tasks[currentIndex].type === "video" ? "video/*" : "image/*"}
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) upload(e.target.files[0], tasks[currentIndex]);
                    }}
                  />
                </label>
              </motion.div>

              {uploadProgress[tasks[currentIndex].id] > 0 && (
                <div className="w-full bg-white/20 rounded-full h-2 mt-2 overflow-hidden">
                  <div
                    className="bg-green-500 h-2"
                    style={{ width: `${uploadProgress[tasks[currentIndex].id]}%` }}
                  />
                </div>
              )}

              {tasks.length > 1 && (
                <div className="flex justify-between w-full mt-4">
                  <button
                    onClick={() =>
                      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : tasks.length - 1))
                    }
                    className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl font-semibold transition"
                  >
                    ← Zurück
                  </button>
                  <button
                    onClick={() =>
                      setCurrentIndex((prev) => (prev < tasks.length - 1 ? prev + 1 : 0))
                    }
                    className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl font-semibold transition"
                  >
                    Nächste →
                  </button>
                </div>
              )}

              <div className="flex space-x-2 mt-3">
                {tasks.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-3 h-3 rounded-full ${
                      currentIndex === idx ? "bg-white" : "bg-white/30"
                    }`}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="text-center text-white text-lg mt-6">Alle Aufgaben erledigt! Trink dir ruhig schonmal einen rein und warte bis der Timer abgelaufen ist. Dann gehts weiter odia!</p>
          )}
        </div>
      )}
    </div>
  );
}