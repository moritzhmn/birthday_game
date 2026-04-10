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

  { id: 2, text: "Witziges Gruppenfoto an einer Sehnswürdigkeit", points: 2, type: "image" },

  { id: 3, text: "Geburstagslied singen mit mindestens einer fremden Perosn", points: 4, type: "video" },

  { id: 4, text: "Chalk Art am Boden erstellen", points: 2, type: "image" },

  { id: 5, text: "Sammelt 3 verschiedene Blätter und präsentiert sie mit Erklärung", points: 3, type: "video" },


  // 🐻 PEINLICHKEITS-LEVEL BEGINNT

  { id: 6, text: "Fürstenzug: Ein Teammitglied bellt und läuft wie ein Wachhund", points: 5, type: "video" },

  { id: 7, text: "Brühlsche Terrasse: 10 Sekunden peinlich tanzen", points: 3, type: "video" },

  { id: 8, text: "Augustusbrücke: Team schreit 'DER BÄR IST LOS!'", points: 3, type: "video" },

  { id: 9, text: "Frauenkirche: Fremde sollen 'Happy Birthday Bär' sagen", points: 4, type: "video" },

  { id: 10, text: "Zwinger: 2 Minuten als Statue komplett regungslos stehen", points: 4, type: "image" },

  { id: 11, text: "Residenzschloss: Tourist spielen und nach dem 'Schnitzel des Bären' fragen", points: 5, type: "video" },

  { id: 12, text: "Neumarkt: Emotionales Gruppenfoto (jede Person andere Emotion)", points: 2, type: "image" },

  { id: 13, text: "Semperoper: Geburtstagslied in 3 krassen Styles (Oper/Rap/Horror)", points: 5, type: "video" },

  { id: 14, text: "Finale: Mini-Filmszene 'Der Bär findet sein Schnitzel in Dresden'", points: 5, type: "video" }
],
  2: [
    { id: 11, text: "Find a bar or café", points: 1, type: "image" },
    { id: 12, text: "Order a drink together and toast", points: 2, type: "image" },
    { id: 15, text: "Sing a short song together", points: 3, type: "video" },
    { id: 17, text: "Find a colorful mural and take a photo", points: 2, type: "image" },
  ],
};

const phaseMeetingPoints: Record<number, { name: string; url: string }> = {
  1: { name: "", url: "https://maps.app.goo.gl/Vz81YiHdVWwLXryYA" },
  2: { name: "", url: "https://maps.app.goo.gl/DwtD5h2z7r1zEjra6" },
};

export default function Home() {
  const [team, setTeam] = useState("");
  const [lockedTeam, setLockedTeam] = useState<string | null>(null);
  const [phase, setPhase] = useState(1);
  const [timeLeft, setTimeLeft] = useState(0);
  const [gameActive, setGameActive] = useState(false);
  const [waitingForStart, setWaitingForStart] = useState(false);
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
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data || !data.is_active || !data.started_at) {
      setGameActive(false);
      setTimeLeft(0);
      setWaitingForStart(true); // Warten auf Spielstart
      return;
    }

    setPhase(data.phase);
    setWaitingForStart(false);

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
  <div className="min-h-dvh text-white p-6 flex flex-col items-center relative bg-linear-to-b from-[#0b1337] via-[#0f172a] to-[#0b1337]">
    {confetti && <Confetti />}

    {/* Title */}
    <motion.h1
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-4xl font-bold text-center mb-6 bg-linear-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
    >
      Tiroler Geburtstagsbär auf Schnitzeljagd
    </motion.h1>

    {/* Join */}
    {!lockedTeam && (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md mx-auto bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl p-6 rounded-2xl"
      >
        <input
          className="w-full p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl mb-4"
          placeholder="Team Name"
          value={team}
          onChange={(e) => setTeam(e.target.value)}
        />

        <button
          onClick={lockTeam}
          className="w-full bg-linear-to-rrom-indigo-500 via-purple-500 to-pink-500 p-3 rounded-xl font-semibold hover:brightness-110 transition"
        >
          Beitreten
        </button>
      </motion.div>
    )}

    {/* Waiting */}
    {lockedTeam && waitingForStart && (
      <div className="text-center mt-8 p-6 max-w-md w-full bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl animate-fadeIn">
        <p className="text-xl font-semibold mb-2">
          Warte auf Spielstart...
        </p>
        <p className="text-sm opacity-70">
          Das Spiel wird gestartet, sobald der Host es aktiviert.
        </p>
      </div>
    )}

    {lockedTeam && !waitingForStart && timeLeft === 0 && (
  <>
    <div className="text-5xl font-mono font-bold bg-linear-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
      {formatTime(timeLeft)}
    </div>

    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-md mt-10 bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl p-6 rounded-2xl text-center"
    >
      <h2 className="text-2xl font-bold mb-3 bg-linear-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
        Zeit abgelaufen
      </h2>

      <p className="text-white/70 mb-4">
        Komm so schnell es geht hier in:
      </p>

      <a
        href={phaseMeetingPoints[phase]?.url}
        target="_blank"
        className="inline-block bg-linear-to-r from-indigo-500 via-purple-500 to-pink-500 px-5 py-2 rounded-xl font-semibold hover:brightness-110 transition"
      >
        Route öffnen
      </a>
    </motion.div>
  </>
)}

    {/* Game */}
    {lockedTeam && timeLeft > 0 && !waitingForStart && (
      <div className="relative w-full max-w-md mt-6 flex flex-col items-center">

        {/* Timer */}
        <div className="text-5xl font-mono font-bold bg-linear-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          {formatTime(timeLeft)}
        </div>

        <div className="text-sm opacity-70 mb-4">
          Team {lockedTeam} • Phase {phase}
        </div>
        

        {tasks.length > 0 ? (
          <>
            {/* Carousel */}
            <div className="relative w-full min-h-90 flex items-center justify-center overflow-hidden">

              {tasks.map((task, index) => {
                const offset = index - currentIndex;
                const isActive = offset === 0;

                const isMobile =
                  typeof window !== "undefined" &&
                  window.innerWidth < 500;

                return (
                  <motion.div
                    key={task.id}
                    animate={{
                      x: offset * (isMobile ? 140 : 260),
                      scale: isActive ? 1 : isMobile ? 0.94 : 0.9,
                      opacity:
                        Math.abs(offset) > 1
                          ? 0
                          : isActive
                          ? 1
                          : 0.55,
                      zIndex: isActive ? 10 : 0
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 30
                    }}
                    className="absolute w-[85%] max-w-sm bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl p-6 rounded-2xl flex flex-col items-center"
                  >
                    <div className="font-bold text-lg mb-2 text-center">
                      {task.text}
                    </div>

                    {/* Points */}
                    <div className="bg-linear-to-rrom-indigo-500 to-purple-500 px-3 py-1 rounded-full mb-4 text-sm font-semibold">
                      {task.points}{" "}
                      {task.points === 1
                        ? "Punkt"
                        : "Punkte"}
                    </div>

                    {/* Preview */}
                    {previewUrls[task.id] &&
                      (task.type === "video" ? (
                        <video
                          src={previewUrls[task.id]}
                          controls
                          className="rounded-xl border border-white/10 mb-4"
                        />
                      ) : (
                        <img
                          src={previewUrls[task.id]}
                          className="rounded-xl border border-white/10 mb-4"
                        />
                      ))}
                      

                    {/* Upload */}
                    <label className="w-full py-2 px-4 bg-linear-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl text-center cursor-pointer font-semibold hover:brightness-110 transition">
                      {task.type === "video"
                        ? "Video hochladen"
                        : "Bild hochladen"}

                      <input
                        type="file"
                        accept={
                          task.type === "video"
                            ? "video/*"
                            : "image/*"
                        }
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files)
                            upload(
                              e.target.files[0],
                              task
                            );
                        }}
                      />
                    </label>

                    {/* Progress */}
                    {uploadProgress[task.id] > 0 && (
                      <div className="w-full bg-white/10 rounded-full h-2 mt-2 overflow-hidden">
                        <div
                          className="bg-linear-to-r from-emerald-400 to-teal-400 h-2"
                          style={{
                            width: `${uploadProgress[task.id]}%`
                          }}
                        />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Navigation */}
            {tasks.length > 1 && (
              <div className="flex justify-between w-full mt-4">
                <button
                  onClick={() =>
                    setCurrentIndex((prev) =>
                      prev > 0
                        ? prev - 1
                        : tasks.length - 1
                    )
                  }
                  className="bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-xl px-4 py-2 rounded-xl font-semibold transition"
                >
                  ← Zurück
                </button>

                <button
                  onClick={() =>
                    setCurrentIndex((prev) =>
                      prev < tasks.length - 1
                        ? prev + 1
                        : 0
                    )
                  }
                  className="bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-xl px-4 py-2 rounded-xl font-semibold transition"
                >
                  Nächste →
                </button>
              </div>
            )}

            {/* Dots */}
            <div className="flex space-x-2 mt-3">
              {tasks.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-3 h-3 rounded-full transition ${
                    currentIndex === idx
                      ? "bg-linear-to-r from-indigo-400 to-pink-400"
                      : "bg-white/20"
                  }`}
                />
              ))}
            </div>
          </>
        ) : (
          <p className="text-center text-white text-lg mt-6">
            Alle Aufgaben erledigt! Trink dir ruhig
            schonmal einen rein 🍻
          </p>
        )}
      </div>
    )}

    {/* Reset */}
   {/* Reset */}
<div className="w-full flex justify-center mt-8 opacity-60 hover:opacity-100 transition">
  <button
    onClick={() => {
      let confirmCount = 0;

      const stepConfirm = () => {
        if (
          confirm("Willst du wirklich den Local Storage löschen?")
        ) {
          confirmCount++;

          if (confirmCount < 3) {
            alert(`${3 - confirmCount}x noch bestätigen`);
            stepConfirm();
          } else {
            localStorage.clear();
            alert("Zurückgesetzt!");
            window.location.reload();
          }
        }
      };

      stepConfirm();
    }}
    className="text-[10px] text-white/50 hover:text-white/80 transition "
  >
    Reset Local Storage
  </button>
</div>
  </div>
);
}