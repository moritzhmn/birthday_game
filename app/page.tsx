"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@supabase/supabase-js";

const Map = dynamic(() => import("./components/Map"), { ssr: false });
const Confetti = dynamic(() => import("react-confetti"), { ssr: false });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_KEY!
);

type Task = { text: string; points: number };

type Submission = {
  id: string;
  team: string;
  task: number;
  image_url: string;
  lat: number;
  lng: number;
};

type Leader = {
  team: string;
  score: number;
  color: string;
  lastLat?: number;
  lastLng?: number;
};

const TEAM_COLORS = [
  "#f87171",
  "#60a5fa",
  "#34d399",
  "#facc15",
  "#a78bfa",
  "#fb7185"
];


// ---------------- TASKS ----------------

const phaseTasks: Record<number, Task[]> = {
  1: [
    { text: "Find a public landmark", points: 1 },
    { text: "Take a team photo", points: 2 },
    { text: "Record a short video", points: 1 }
  ],
  2: [
    { text: "Find a bar or café", points: 1 },
    { text: "Group challenge with strangers", points: 2 },
    { text: "Creative team photo", points: 1 }
  ],
  3: [
    { text: "Final group photo", points: 2 },
    { text: "Team performance", points: 3 },
    { text: "Final location check-in", points: 2 }
  ]
};


// ---------------- MEETING POINTS ----------------

const phaseMeetingPoints: Record<number, { lat: number; lng: number }> = {
  1: { lat: 53.5511, lng: 9.9937 },
  2: { lat: 53.5500, lng: 9.9900 },
  3: { lat: 53.5480, lng: 9.9870 }
};


export default function Home() {
  const [team, setTeam] = useState("");
  const [lockedTeam, setLockedTeam] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<Leader[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [gameActive, setGameActive] = useState(false);
  const [phase, setPhase] = useState(1);
  const [confetti, setConfetti] = useState(false);
  const [teamTasks, setTeamTasks] = useState<Record<string, Task[]>>({});
  const [currentTaskIndex, setCurrentTaskIndex] =
    useState<Record<string, number>>({});
  const [needsArrival, setNeedsArrival] = useState(false);

  // ---------------- TEAM ----------------

  useEffect(() => {
    const saved = localStorage.getItem("team");
    if (saved) {
      setLockedTeam(saved);

      const savedTasks = localStorage.getItem(`tasks_${saved}`);
      const savedIndex = localStorage.getItem(`index_${saved}`);

      setTeamTasks(prev => ({
        ...prev,
        [saved]: savedTasks
          ? JSON.parse(savedTasks)
          : shuffleTasks(phaseTasks[phase])
      }));

      setCurrentTaskIndex(prev => ({
        ...prev,
        [saved]: savedIndex ? parseInt(savedIndex) : 0
      }));
    }
  }, [phase]);


  const lockTeam = () => {
    if (!team.trim()) return;

    localStorage.setItem("team", team.trim());
    setLockedTeam(team.trim());

    const shuffled = shuffleTasks(phaseTasks[phase]);

    setTeamTasks(prev => ({
      ...prev,
      [team.trim()]: shuffled
    }));

    setCurrentTaskIndex(prev => ({
      ...prev,
      [team.trim()]: 0
    }));

    localStorage.setItem(`tasks_${team.trim()}`, JSON.stringify(shuffled));
    localStorage.setItem(`index_${team.trim()}`, "0");
  };


  // ---------------- FETCH ----------------

  const fetchGameState = async () => {
    const { data: game } = await supabase
      .from("game_state")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!game) return;

    setPhase(game.phase || 1);

    if (game.is_active && game.started_at) {
      const elapsed =
        (Date.now() -
          new Date(game.started_at).getTime()) / 1000;

      const remaining =
        Math.max(game.duration_sec - elapsed, 0);

      setTimeLeft(remaining);
      setGameActive(remaining > 0);

      if (remaining <= 0) {
        setNeedsArrival(true);
      }
    }

    const { data: submissions } =
      await supabase.from("submissions").select("*");

    const scores: Record<string, Leader> = {};

    submissions?.forEach((s: Submission) => {
      if (!scores[s.team]) {
        scores[s.team] = {
          team: s.team,
          score: 0,
          color:
            TEAM_COLORS[
              s.team.length %
                TEAM_COLORS.length
            ]
        };
      }

      scores[s.team].score +=
        phaseTasks[phase][s.task]?.points || 0;
    });

    const { data: locations } =
      await supabase.from("locations").select("*");

    locations?.forEach((loc: any) => {
      if (!scores[loc.team]) return;
      scores[loc.team].lastLat = loc.lat;
      scores[loc.team].lastLng = loc.lng;
    });

    setLeaderboard(
      Object.values(scores).sort(
        (a, b) => b.score - a.score
      )
    );
  };


  useEffect(() => {
    fetchGameState();
    const interval =
      setInterval(fetchGameState, 5000);
    return () => clearInterval(interval);
  }, [phase]);


  // ---------------- TIMER ----------------

  useEffect(() => {
    if (!gameActive) return;

    const timer =
      setInterval(() => {
        setTimeLeft(t => Math.max(t - 1, 0));
      }, 1000);

    return () => clearInterval(timer);
  }, [gameActive]);


  // ---------------- UPLOAD ----------------

  const handleUpload = async (file?: File) => {
    if (!file || !lockedTeam) return;

    const taskIdx =
      currentTaskIndex[lockedTeam];

    const fileName =
      `${lockedTeam}-${taskIdx}-${Date.now()}.jpg`;

    await supabase.storage
      .from("photos")
      .upload(fileName, file);

    const url =
      supabase.storage
        .from("photos")
        .getPublicUrl(fileName)
        .data.publicUrl;

    await supabase
      .from("submissions")
      .insert({
        team: lockedTeam,
        task: taskIdx,
        image_url: url
      });

    setCurrentTaskIndex(prev => ({
      ...prev,
      [lockedTeam]: taskIdx + 1
    }));

    setConfetti(true);
    setTimeout(() => setConfetti(false), 2000);
  };


  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m
      .toString()
      .padStart(2, "0")}:${sec
      .toString()
      .padStart(2, "0")}`;
  };


  const currentTask =
    lockedTeam &&
    teamTasks[lockedTeam]?.[
      currentTaskIndex[lockedTeam]
    ];


  return (
    <div className="min-h-screen bg-gray-50">
      {confetti && <Confetti />}

      <div className="max-w-md mx-auto p-4">

        <h1 className="text-xl font-semibold mb-2">
          Team Challenge
        </h1>

        <p className="text-sm text-gray-500 mb-4">
          Phase {phase}
        </p>

        <div className="bg-white p-4 rounded-xl mb-4 shadow-sm">
          <p className="text-sm text-gray-500">
            Time
          </p>
          <p className="text-2xl font-semibold">
            {gameActive
              ? formatTime(timeLeft)
              : "Waiting"}
          </p>
        </div>

        {!lockedTeam && (
          <div className="bg-white p-4 rounded-xl mb-4 shadow-sm">
            <input
              className="w-full border p-3 rounded-lg mb-3"
              placeholder="Team name"
              value={team}
              onChange={e =>
                setTeam(e.target.value)
              }
            />

            <button
              onClick={lockTeam}
              className="w-full bg-black text-white p-3 rounded-lg"
            >
              Join Team
            </button>
          </div>
        )}

        {currentTask && gameActive && (
          <div className="bg-white p-4 rounded-xl mb-4 shadow-sm">
            <p className="mb-2">
              {currentTask.text}
            </p>

            <p className="text-sm text-gray-500 mb-3">
              {currentTask.points} Points
            </p>

            <input
              type="file"
              onChange={e =>
                handleUpload(
                  e.target.files?.[0]
                )
              }
            />
          </div>
        )}

        {needsArrival && (
          <div className="bg-white p-4 rounded-xl mb-4 shadow-sm">
            Meeting Point

            <Map
              leaderboard={leaderboard}
              meeting={
                phaseMeetingPoints[phase]
              }
            />
          </div>
        )}

        <div className="h-72 bg-white rounded-xl shadow-sm overflow-hidden">
          <Map leaderboard={leaderboard} />
        </div>

      </div>
    </div>
  );
}


// ---------------- SHUFFLE ----------------

function shuffleTasks(
  taskList: Task[]
): Task[] {
  const array = [...taskList];

  for (
    let i = array.length - 1;
    i > 0;
    i--
  ) {
    const j = Math.floor(
      Math.random() * (i + 1)
    );

    [array[i], array[j]] =
      [array[j], array[i]];
  }

  return array;
}