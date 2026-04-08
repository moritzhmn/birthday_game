"use client";

import { useState, useEffect } from "react";

const ADMIN_KEY = process.env.NEXT_PUBLIC_GAME_ADMIN_KEY!;

export default function AdminPanel() {
  const [game, setGame] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/game-control");
      const data = await res.json();
      setGame(data.game);
      if (data.timeLeft !== undefined) setTimeLeft(data.timeLeft);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const startGame = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/game-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", key: ADMIN_KEY }),
      });
      await res.json();
      fetchStatus();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const stopGame = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/game-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop", key: ADMIN_KEY }),
      });
      await res.json();
      fetchStatus();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="p-4 max-w-md mx-auto border rounded shadow">
      <h2 className="text-2xl font-bold mb-4">🎮 Admin Panel</h2>
      <p>Status: {game?.is_active ? "Aktiv" : "Inaktiv"}</p>
      {game?.is_active && <p>Timer: {formatTime(timeLeft)}</p>}

      <div className="flex gap-2 mt-4">
        <button
          className="bg-green-500 text-white p-2 rounded flex-1"
          onClick={startGame}
          disabled={loading || game?.is_active}
        >
          Spiel starten
        </button>
        <button
          className="bg-red-500 text-white p-2 rounded flex-1"
          onClick={stopGame}
          disabled={loading || !game?.is_active}
        >
          Spiel stoppen
        </button>
      </div>
    </div>
  );
}