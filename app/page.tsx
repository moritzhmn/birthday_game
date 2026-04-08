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

export default function Home() {
  const [team, setTeam] = useState("");
  const [lockedTeam, setLockedTeam] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<Leader[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [gameActive, setGameActive] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [teamTasks, setTeamTasks] = useState<Record<string, Task[]>>({});
  const [currentTaskIndex, setCurrentTaskIndex] = useState<Record<string, number>>({});
  const [playerLat, setPlayerLat] = useState<number | null>(null);
  const [playerLng, setPlayerLng] = useState<number | null>(null);
  const [needsArrival, setNeedsArrival] = useState(false);

  const tasks: Task[] = [
    { text: "🍺 Bier vor Augustiner", points: 1 },
    { text: "📸 Gruppenfoto mit 3 Fremden", points: 2 },
    { text: "🥃 Shot in einer Bar", points: 1 },
    { text: "😂 Meme nachstellen", points: 1 },
    { text: "🌅 Foto an der Elbe", points: 1 },
    { text: "🎤 Fremde singen Geburtstagslied", points: 2 },
  ];

  // ---------------- TEAM ----------------
  useEffect(() => {
    const saved = localStorage.getItem("team");
    if (saved) {
      setLockedTeam(saved);
      const savedTasks = localStorage.getItem(`tasks_${saved}`);
      const savedIndex = localStorage.getItem(`index_${saved}`);
      setTeamTasks(prev => ({
        ...prev,
        [saved]: savedTasks ? JSON.parse(savedTasks) : shuffleTasks(tasks)
      }));
      setCurrentTaskIndex(prev => ({
        ...prev,
        [saved]: savedIndex ? parseInt(savedIndex) : 0
      }));
    }
  }, []);

  const lockTeam = () => {
    if (!team.trim()) return;
    localStorage.setItem("team", team.trim());
    setLockedTeam(team.trim());

    const shuffled = shuffleTasks(tasks);
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

  // ---------------- FETCH GAME STATE ----------------
  const fetchGameState = async () => {
    try {
      const { data: game } = await supabase
        .from("game_state")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (!game) {
        setGameActive(false);
        setTimeLeft(0);
        return;
      }

      if (game.is_active && game.started_at) {
        const elapsed = Math.floor((Date.now() - new Date(game.started_at).getTime()) / 1000);
        const remaining = Math.max(game.duration_sec - elapsed, 0);

        // --- 30 Minuten Restzeit Check ---
        if (remaining <= 1800 && !needsArrival) {
          setNeedsArrival(true);   // Aktiviert die Komm-hierher-Karte
          setTimeLeft(1800);       // Timer auf 30 Minuten setzen
        } else {
          setTimeLeft(remaining);
        }

        setGameActive(remaining > 0);
      } else {
        setTimeLeft(0);
        setGameActive(false);
      }

      // --- Leaderboard Scores ---
      const { data: submissionsRaw } = await supabase.from("submissions").select("*");
      const scores: Record<string, Leader> = {};
      if (submissionsRaw) {
        submissionsRaw.forEach((item: Submission) => {
          if (!scores[item.team]) {
            scores[item.team] = {
              team: item.team,
              score: 0,
              color: TEAM_COLORS[item.team.length % TEAM_COLORS.length]
            };
          }
          scores[item.team].score += tasks[item.task]?.points || 0;
        });
      }

      // --- Live Locations ---
      const { data: locations } = await supabase.from("locations").select("*");
      if (locations) {
        locations.forEach((loc: any) => {
          if (!scores[loc.team]) {
            scores[loc.team] = {
              team: loc.team,
              score: 0,
              color: TEAM_COLORS[loc.team.length % TEAM_COLORS.length]
            };
          }
          scores[loc.team].lastLat = loc.lat;
          scores[loc.team].lastLng = loc.lng;
        });
      }

      setLeaderboard(Object.values(scores).sort((a,b)=>b.score-a.score));
    } catch (err) {
      console.error(err);
    }
  };

  // ---------------- TIMER ----------------
  useEffect(() => {
    if (!gameActive || timeLeft <= 0 || needsArrival) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [gameActive, timeLeft, needsArrival]);

  // ---------------- RESET TEAM AFTER GAME ----------------
  const [gameWasActive, setGameWasActive] = useState(false);
  useEffect(() => {
    if (gameActive) setGameWasActive(true);
    if (!gameActive && gameWasActive && lockedTeam) {
      localStorage.removeItem("team");
      localStorage.removeItem(`tasks_${lockedTeam}`);
      localStorage.removeItem(`index_${lockedTeam}`);
      setLockedTeam(null);
      setTeam("");
      setGameWasActive(false);
    }
  }, [gameActive, lockedTeam, gameWasActive]);

  // ---------------- REALTIME ----------------
  useEffect(() => {
    fetchGameState();
    const channel = supabase.channel("live")
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, fetchGameState)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_state" }, fetchGameState)
      .subscribe();
    const interval = setInterval(fetchGameState, 5000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [lockedTeam]);

// ---------------- LIVE LOCATION ----------------
// ---------------- LIVE LOCATION ----------------
// ---------------- LIVE LOCATION ----------------
useEffect(() => {
  if (!lockedTeam) {
    alert("❌ Kein Team gesetzt");
    return;
  }

  alert("🚀 Geolocation startet für: " + lockedTeam);

  let lastSent = 0;

  const watchId = navigator.geolocation.watchPosition(
    async (pos) => {

      setPlayerLat(pos.coords.latitude);
      setPlayerLng(pos.coords.longitude);

      const now = Date.now();

      if (now - lastSent < 5000) return;
      lastSent = now;


      const { error } = await supabase
        .from("locations")
        .upsert({
          team: lockedTeam,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          updated_at: new Date()
        });

      if (error) {
        alert("❌ Supabase Fehler: " + error.message);
      }
    },
    (err) => {
      alert("❌ Geolocation Fehler: " + err.message);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 20000
    }
  );

  return () => {
    alert("🛑 Tracking gestoppt");
    navigator.geolocation.clearWatch(watchId);
  };

}, [lockedTeam]);

  // ---------------- UPLOAD ----------------
  const handleUpload = async (file?:File) => {
    if(!file || !lockedTeam || !gameActive) return;
    const teamTaskList = teamTasks[lockedTeam];
    const taskIdx = currentTaskIndex[lockedTeam];
    if(!teamTaskList || taskIdx >= teamTaskList.length) return;

    const fileName=`${lockedTeam}-${taskIdx}-${Date.now()}.jpg`;
    const pos = await new Promise<{lat:number,lng:number}>(res=>{
      navigator.geolocation.getCurrentPosition(
        p => res({lat:p.coords.latitude, lng:p.coords.longitude}),
        () => res({lat:0, lng:0})
      );
    });
    await supabase.storage.from("photos").upload(fileName,file);
    const url = supabase.storage.from("photos").getPublicUrl(fileName).data.publicUrl;
    await supabase.from("submissions").insert({
      team: lockedTeam,
      task: taskIdx,
      image_url: url,
      lat: pos.lat,
      lng: pos.lng
    });

    const nextIndex = taskIdx + 1;
    setCurrentTaskIndex(prev => ({ ...prev, [lockedTeam]: nextIndex }));
    localStorage.setItem(`index_${lockedTeam}`, nextIndex.toString());
    setConfetti(true);
    setTimeout(()=>setConfetti(false),2000);
  };

  const formatTime = (s:number)=> {
    const m = Math.floor(s/60);
    const sec = s % 60;
    return `${m.toString().padStart(2,"0")}:${sec.toString().padStart(2,"0")}`;
  };

  const currentTask = lockedTeam ? teamTasks[lockedTeam]?.[currentTaskIndex[lockedTeam]] : undefined;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {confetti && <Confetti />}
      <h1 className="text-3xl font-bold text-center mb-4">🎯 Birthday Challenge</h1>

      {needsArrival ? (
        <>
          <p className="text-center text-lg mb-4 font-bold text-red-600">
            ⏱ 30 Minuten Restzeit erreicht! Komm hierher:
          </p>
          {playerLat && playerLng ? (
            <Map leaderboard={leaderboard} player={{ lat: playerLat, lng: playerLng }} />
          ) : (
            <p className="text-center">Lade aktuelle Position…</p>
          )}
        </>
      ) : (
        <>
          <p className="text-center mb-4">
            ⏱ {gameActive && timeLeft > 0 ? formatTime(timeLeft) : "Spiel nicht aktiv"}
          </p>

          {!lockedTeam ? (
            <>
              <input
                className="border p-2 w-full mb-2"
                placeholder="Team Name"
                value={team}
                onChange={e=>setTeam(e.target.value)}
              />
              <button onClick={lockTeam} className="bg-blue-500 text-white w-full p-2 mb-4">Team speichern</button>
            </>
          ) : <p className="text-center mb-4 font-bold">Team: {lockedTeam}</p>}

          {gameActive && timeLeft > 0 && currentTask && (
            <div className="grid gap-3">
              <div className="border p-3">
                {currentTask.text} (+{currentTask.points})
                <input type="file" onChange={e=>handleUpload(e.target.files?.[0])} disabled={!lockedTeam}/>
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

// ---------------- Utility: shuffle ----------------
function shuffleTasks(taskList: Task[]): Task[] {
  const array = [...taskList];
  for (let i = array.length -1; i>0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}