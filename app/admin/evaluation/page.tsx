"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion } from "framer-motion";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_KEY!
);

type Submission = {
  id: string;
  team: string;
  task: number;
  image_url: string | null;
  lat: string | null;
  lng: string | null;
  created_at: string;
  phase: number;
  bonus?: number;
  points?: number;
};

type Task = {
  id: number;
  text: string;
  points: number;
  type: "image" | "video";
};

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

export default function EvaluationPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSubmissions = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .order("team", { ascending: true })
        .order("phase", { ascending: true })
        .order("task", { ascending: true });

      if (error) console.error("Fehler beim Laden:", error);
      else {
        setSubmissions(data || []);
        setAllSubmissions(data || []);
      }
      setLoading(false);
    };

    fetchSubmissions();
  }, []);

  const updateBonus = (id: string, value: number) => {
    setSubmissions((subs) =>
      subs.map((sub) =>
        sub.id === id ? { ...sub, bonus: Math.max(-1, Math.min(1, value)) } : sub
      )
    );
  };

  const saveRating = async (id: string) => {
    const sub = submissions.find((s) => s.id === id);
    if (!sub) return;

    await supabase.from("submissions").update({ bonus: sub.bonus || 0 }).eq("id", id);

    setSubmissions((subs) => subs.filter((s) => s.id !== id));
    setAllSubmissions((subs) =>
      subs.map((s) => (s.id === id ? { ...s, bonus: sub.bonus || 0 } : s))
    );
  };

  // --- Rangliste ---
  const ranking: Record<string, number> = {};
  allSubmissions.forEach((sub) => {
    const task = phaseTasks[sub.phase]?.find((t) => t.id === sub.task);
    const basePoints = task?.points || 0;
    ranking[sub.team] = (ranking[sub.team] || 0) + basePoints + (sub.bonus || 0);
  });

  const sortedRanking = Object.entries(ranking).sort((a, b) => b[1] - a[1]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 flex flex-col items-center">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-bold text-center mb-6"
      >
        🎯 Auswertung
      </motion.h1>

      {/* --- Rangliste --- */}
      {sortedRanking.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full max-w-3xl mb-6 bg-white/10 backdrop-blur-lg p-6 rounded-2xl shadow-lg"
        >
          <h2 className="text-2xl font-semibold mb-4 text-center">🏆 Rangliste</h2>
          <ol className="list-decimal ml-6 space-y-1">
            {sortedRanking.map(([team, score], idx) => (
              <li key={idx} className="text-lg">
                {team}: {score} Punkte
              </li>
            ))}
          </ol>
        </motion.div>
      )}

      {/* --- Submissions --- */}
      {submissions.map((sub) => {
        const task = phaseTasks[sub.phase]?.find((t) => t.id === sub.task);
        const type = task?.type || "image";

        return (
          <motion.div
            key={sub.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-3xl bg-white/10 backdrop-blur-lg p-6 rounded-2xl shadow-lg mb-4"
          >
            <p className="font-semibold">
              Team: {sub.team} | Phase: {sub.phase} | Aufgabe: {task?.text || sub.task} | Punkte:{" "}
              {task?.points || 0}
            </p>

            {sub.image_url && (
              <div className="mt-4 flex justify-center">
                {type === "video" ? (
                  <video
                    src={sub.image_url}
                    controls
                    className="w-full max-w-2xl max-h-[500px] rounded-xl shadow-md object-contain"
                  />
                ) : (
                  <img
                    src={sub.image_url}
                    className="w-full max-w-2xl max-h-[500px] rounded-xl shadow-md object-contain"
                  />
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-4">
              <button
                onClick={() => updateBonus(sub.id, (sub.bonus || 0) + 1)}
                className="flex-1 min-w-[120px] bg-green-500 px-3 py-2 rounded-xl font-semibold hover:bg-green-600 text-center"
              >
                +1 Bonus
              </button>
              <button
                onClick={() => updateBonus(sub.id, (sub.bonus || 0) - 1)}
                className="flex-1 min-w-[120px] bg-red-500 px-3 py-2 rounded-xl font-semibold hover:bg-red-600 text-center"
              >
                -1 Punkt
              </button>
              <span className="flex-1 min-w-[120px] text-center self-center">
                Bewertung: {sub.bonus || 0}
              </span>

              <button
                onClick={() => saveRating(sub.id)}
                className="flex-1 min-w-[120px] bg-blue-500 px-3 py-2 rounded-xl font-semibold hover:bg-blue-600 text-center"
              >
                ✅ Bewertung bestätigen
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}