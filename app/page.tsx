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
type Submission = { id: string; team: string; task: number; image_url: string; lat: number; lng: number; };
type Leader = { team: string; score: number; color: string; lastLat?: number; lastLng?: number; };

const TEAM_COLORS = ["#f87171","#60a5fa","#34d399","#facc15","#a78bfa","#fb7185"];

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
  const [needsArrival, setNeedsArrival] = useState(false);
  const [teamTasks, setTeamTasks] = useState<Record<string, Task[]>>({});
  const [currentTaskIndex, setCurrentTaskIndex] = useState<Record<string, number>>({});
  const [playerLat, setPlayerLat] = useState<number | null>(null);
  const [playerLng, setPlayerLng] = useState<number | null>(null);

  // ---------------- TEAM ----------------
  useEffect(() => {
    const saved = localStorage.getItem("team");
    if (saved) {
      setLockedTeam(saved);
      const savedTasks = localStorage.getItem(`tasks_${saved}`);
      const savedIndex = localStorage.getItem(`index_${saved}`);
      setTeamTasks(prev => ({
        ...prev,
        [saved]: savedTasks ? JSON.parse(savedTasks) : shuffleTasks(phaseTasks[phase])
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
    setTeamTasks(prev => ({ ...prev, [team.trim()]: shuffled }));
    setCurrentTaskIndex(prev => ({ ...prev, [team.trim()]: 0 }));
    localStorage.setItem(`tasks_${team.trim()}`, JSON.stringify(shuffled));
    localStorage.setItem(`index_${team.trim()}`, "0");
  };

  // ---------------- FETCH GAME STATE ----------------
  const fetchGameState = async () => {
    const { data: game } = await supabase.from("game_state").select("*").limit(1).maybeSingle();
    if (!game) return;

    setPhase(game.phase || 1);

    if (game.is_active && game.started_at) {
      const elapsed = Math.floor((Date.now() - new Date(game.started_at).getTime()) / 1000);
      const remaining = Math.max(game.duration_sec - elapsed, 0);
      if (remaining <= 0) {
        setNeedsArrival(true);
        setGameActive(false);
        setTimeLeft(0);
      } else {
        setTimeLeft(remaining);
        setGameActive(true);
        setNeedsArrival(false);
      }
    } else {
      setGameActive(false);
      setTimeLeft(0);
    }

    // ---------------- SCORES ----------------
    const { data: submissions } = await supabase.from("submissions").select("*");
    const scores: Record<string, Leader> = {};
    submissions?.forEach((s: Submission) => {
      if (!scores[s.team]) scores[s.team] = { team: s.team, score: 0, color: TEAM_COLORS[s.team.length % TEAM_COLORS.length] };
      scores[s.team].score += phaseTasks[phase][s.task]?.points || 0;
    });

    // ---------------- LOCATIONS ----------------
    const { data: locations } = await supabase.from("locations").select("*");
    locations?.forEach((loc: any) => {
      if (!scores[loc.team]) scores[loc.team] = { team: loc.team, score: 0, color: TEAM_COLORS[loc.team.length % TEAM_COLORS.length] };
      scores[loc.team].lastLat = loc.lat;
      scores[loc.team].lastLng = loc.lng;
    });

    setLeaderboard(Object.values(scores).sort((a,b)=>b.score-b.score));
  };

  // ---------------- TIMER ----------------
  useEffect(() => {
    if (!gameActive || timeLeft <= 0) return;
    const interval = setInterval(() => setTimeLeft(prev => Math.max(prev - 1, 0)), 1000);
    return () => clearInterval(interval);
  }, [gameActive, timeLeft]);

  // ---------------- REALTIME ----------------
  useEffect(() => {
    fetchGameState();
    const channel = supabase.channel("live")
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, fetchGameState)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_state" }, fetchGameState)
      .on("postgres_changes", { event: "*", schema: "public", table: "locations" }, fetchGameState)
      .subscribe();
    const interval = setInterval(fetchGameState, 5000);
    return () => { supabase.removeChannel(channel); clearInterval(interval); clearInterval(interval); };
  }, [lockedTeam]);

  // ---------------- LIVE LOCATION ----------------
  useEffect(() => {
    if (!lockedTeam) return;
    let lastSent = 0;
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        setPlayerLat(pos.coords.latitude);
        setPlayerLng(pos.coords.longitude);
        const now = Date.now();
        if (now - lastSent < 5000) return;
        lastSent = now;
        await supabase.from("locations").upsert({
          team: lockedTeam,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          updated_at: new Date()
        });
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [lockedTeam]);

  // ---------------- UPLOAD ----------------
  const handleUpload = async (file?: File) => {
    if(!file || !lockedTeam || !gameActive) return;
    const taskIdx = currentTaskIndex[lockedTeam];
    await supabase.storage.from("photos").upload(`${lockedTeam}-${taskIdx}-${Date.now()}.jpg`, file);
    const url = supabase.storage.from("photos").getPublicUrl(`${lockedTeam}-${taskIdx}-${Date.now()}.jpg`).data.publicUrl;
    await supabase.from("submissions").insert({ team: lockedTeam, task: taskIdx, image_url: url, lat: playerLat, lng: playerLng });
    setCurrentTaskIndex(prev => ({ ...prev, [lockedTeam]: taskIdx + 1 }));
    localStorage.setItem(`index_${lockedTeam}`, (taskIdx + 1).toString());
    setConfetti(true); setTimeout(()=>setConfetti(false),2000);
  };

  const formatTime = (s: number) => { const m = Math.floor(s/60); const sec = s%60; return `${m.toString().padStart(2,"0")}:${sec.toString().padStart(2,"0")}`; };
  const currentTask = lockedTeam ? teamTasks[lockedTeam]?.[currentTaskIndex[lockedTeam]] : undefined;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {confetti && <Confetti />}
      <h1 className="text-3xl font-bold text-center mb-4">Birthday Challenge - Phase {phase}</h1>

      {needsArrival ? (
        <>
          <p className="text-center text-lg mb-4 font-bold text-red-600">⏱ Phase beendet! Treffpunkt:</p>
          <Map leaderboard={leaderboard} meeting={phaseMeetingPoints[phase]} player={playerLat && playerLng ? { lat: playerLat, lng: playerLng } : undefined} />
        </>
      ) : (
        <>
          <p className="text-center mb-4">⏱ {gameActive && timeLeft > 0 ? formatTime(timeLeft) : "Spiel nicht aktiv"}</p>

          {!lockedTeam ? (
            <>
              <input className="border p-2 w-full mb-2" placeholder="Team Name" value={team} onChange={e=>setTeam(e.target.value)} />
              <button onClick={lockTeam} className="bg-blue-500 text-white w-full p-2 mb-4">Team speichern</button>
            </>
          ) : <p className="text-center mb-4 font-bold">Team: {lockedTeam}</p>}

          {gameActive && timeLeft > 0 && currentTask && (
            <div className="grid gap-3">
              <div className="border p-3">
                {currentTask.text} (+{currentTask.points})
                <input type="file" onChange={e=>handleUpload(e.target.files?.[0])} disabled={!lockedTeam} />
              </div>
            </div>
          )}

          <div className="h-96 mt-6">
            <Map leaderboard={leaderboard} />
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- SHUFFLE ----------------
function shuffleTasks(taskList: Task[]): Task[] {
  const array = [...taskList];
  for (let i=array.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [array[i],array[j]]=[array[j],array[i]];
  }
  return array;
}