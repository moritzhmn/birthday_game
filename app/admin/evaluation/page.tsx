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
  phase: number;
};

type Rating = {
  id: string;
  submission_id: string;
  team: string;
  points: number;
};

type Task = {
  id: number;
  text: string;
  points: number;
  type: "image" | "video";
};

const phaseTasks: Record<number, Task[]> = {
  1: [
    // 🏰 ALTSTADT

    {
      id: 1,
      text: "Singt ein Geburtstagslied für mich zusammen mit mindestens zwei fremden Personen",
      points: 5,
      type: "video",
    },

    {
      id: 2,
      text: "Fürstenzug: Macht ein süßes Gruppen-Selfie hintereinander in einer Reihe",
      points: 1,
      type: "image",
    },

    {
      id: 3,
      text: "Tanzt mindestens 10 Sekunden zu einem Straßenmusiker",
      points: 5,
      type: "video",
    },

    {
      id: 4,
      text: "Stellt einen lauten Streit nach, weil ihr zu unterschiedlichen Sehenswürdigkeiten wollt",
      points: 3,
      type: "video",
    },

    {
      id: 5,
      text: "Macht ein Foto von einem frisch gezapften Bier",
      points: 1,
      type: "image",
    },

    {
      id: 6,
      text: "Fragt eine fremde Person nach dem Weg zum 'Schnitzelmuseum Dresden'",
      points: 5,
      type: "video",
    },

    {
      id: 7,
      text: "Macht ein Foto von der 'Dicken' (große Straßenbahn)",
      points: 1,
      type: "image",
    },

    {
      id: 8,
      text: "Bestellt an einer Bar ein Bier und trinkt es schnell (Beweisfoto)",
      points: 5,
      type: "image",
    },

    {
      id: 9,
      text: "Altmarkt: Dreht ein übertriebenes Influencer-Reisevideo",
      points: 1,
      type: "video",
    },

    {
      id: 10,
      text: "Macht ein Selfie mit mindestens einer fremden Person",
      points: 3,
      type: "image",
    },
  ],

  2: [
    // 🎨 NEUSTADT

    {
      id: 11,
      text: "Kunsthofpassage: Findet die verrückteste Street-Art und macht ein Foto",
      points: 1,
      type: "image",
    },

    {
      id: 12,
      text: "Alaunpark: Versucht gemeinsam einen Handstand",
      points: 3,
      type: "video",
    },

    {
      id: 13,
      text: "Interview: Fragt eine fremde Person 'Wie viel ist dein Outfit wert?'",
      points: 5,
      type: "video",
    },

    {
      id: 14,
      text: "Singt an einer belebten Ecke einen Song wie Straßenmusiker",
      points: 5,
      type: "video",
    },

    {
      id: 15,
      text: "Macht ein Selfie mit einem fremden Hund (vorher fragen!)",
      points: 3,
      type: "image",
    },

    {
      id: 16,
      text: "Findet das bunteste Haus in der Neustadt",
      points: 1,
      type: "image",
    },

    {
      id: 17,
      text: "Findet ein SGD-Graffiti oder Sticker",
      points: 1,
      type: "image",
    },

    {
      id: 18,
      text: "Setzt euch zu einer fremden Gruppe und unterhaltet euch (Beweisvideo)",
      points: 5,
      type: "video",
    },

    {
      id: 19,
      text: "Findet einen 'The Länd'-Sticker",
      points: 1,
      type: "image",
    },

    {
      id: 20,
      text: "Trinkt in einer Bar schnell einen Shot (Beweisfoto)",
      points: 5,
      type: "image",
    },
  ],
};

export default function EvaluationPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [temp, setTemp] = useState<Record<string, number>>({});

  useEffect(() => {
    const load = async () => {
      const [{ data: subs }, { data: rat }] = await Promise.all([
        supabase.from("submissions").select("*"),
        supabase.from("ratings").select("*"),
      ]);

      setSubmissions(subs || []);
      setRatings(rat || []);
    };

    load();
  }, []);

  // ---------------- BASIS ----------------
  const getBase = (sub: Submission) =>
    phaseTasks[sub.phase]?.find((t) => t.id === sub.task)?.points || 0;

  // ---------------- SAVE ----------------
  const saveRating = async (sub: Submission) => {
    const base = getBase(sub);
    const bonus = temp[sub.id] || 0;
    const points = base + bonus;

    const { error } = await supabase.from("ratings").upsert({
      submission_id: sub.id,
      team: sub.team,
      points,
    });

    if (!error) {
      setRatings((prev) => [
        ...prev.filter((r) => r.submission_id !== sub.id),
        { id: sub.id, submission_id: sub.id, team: sub.team, points },
      ]);
    }
  };

  // ---------------- RANKING ----------------
  const ranking: Record<string, number> = {};

  ratings.forEach((r) => {
    ranking[r.team] = (ranking[r.team] || 0) + r.points;
  });

  const sorted = Object.entries(ranking).sort((a, b) => b[1] - a[1]);
  const winner = sorted[0]?.[0];

  const ratedSet = new Set(ratings.map((r) => r.submission_id));
  const remaining = submissions.filter((s) => !ratedSet.has(s.id));
  const allRated = submissions.length > 0 && remaining.length === 0;

  const glass =
    "bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl";

  // ---------------- MEDIA ----------------
  const renderMedia = (sub: Submission, task?: Task) => {
    if (!sub.image_url) return null;

    const url = sub.image_url;
    const isVideo =
      task?.type === "video" ||
      url.includes("/video/") ||
      /\.(mp4|mov|webm)/i.test(url);

    return isVideo ? (
      <video
        src={url}
        controls
        className="rounded-xl border border-white/10 w-full max-h-105"
      />
    ) : (
      <img
        src={url}
        className="rounded-xl border border-white/10 w-full max-h-105 object-contain"
      />
    );
  };

  return (
    <div className="min-h-dvh text-white p-6 flex flex-col items-center relative bg-linear-to-b from-[#0b1337] via-[#0f172a] to-[#0b1337]">

      {/* TITLE (wie Game) */}
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-bold text-center mb-8 bg-linear-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
      >
        Bewertungs Dashboard
      </motion.h1>

      {/* ---------------- RANKING ---------------- */}
      {allRated && (
        <motion.div className={`w-full max-w-3xl p-6 mb-8 ${glass}`}>
          <h2 className="text-xl mb-4 opacity-80 font-bold">Rangliste</h2>

          <div className="space-y-3">
            {sorted.map(([team, score], idx) => {
              const isWinner = team === winner;

              return (
                <div
                  key={team}
                  className={`flex justify-between p-4 rounded-xl border transition
                    ${
                      isWinner
                        ? "bg-linear-to-r from-yellow-500/20 to-orange-500/10 border-yellow-400/40"
                        : "bg-white/5 border-white/10"
                    }`}
                >
                  <div className="flex gap-3 items-center">
                    <span className="opacity-50 w-6">{idx + 1}</span>

                    <span className="font-semibold">{team}</span>

                    {isWinner && (
                      <span className="text-xs px-2 py-1 rounded-full bg-yellow-400/20 border border-yellow-400/30">
                        Sieger
                      </span>
                    )}
                  </div>

                  <span className="font-bold">{score} P</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ---------------- SUBMISSIONS ---------------- */}
      <div className="w-full max-w-3xl space-y-5">
        {submissions
          .filter((s) => !ratedSet.has(s.id))
          .map((sub) => {
            const task = phaseTasks[sub.phase]?.find(
              (t) => t.id === sub.task
            );

            const base = getBase(sub);

            return (
              <div key={sub.id} className={`p-5 ${glass}`}>
                <div className="mb-3">
                  <div className="font-semibold">{sub.team}</div>

                  <div className="text-white/40 text-sm">
                    {task?.text}
                  </div>

                  <div className="text-indigo-300 text-sm mt-1">
                    Basispunkte: {base}
                  </div>
                </div>

                {renderMedia(sub, task)}

                {/* CONTROLS */}
                <div className="flex items-center gap-3 mt-4">
                  <button
                    onClick={() =>
                      setTemp((p) => ({
                        ...p,
                        [sub.id]: (p[sub.id] || 0) + 1,
                      }))
                    }
                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10"
                  >
                    +1
                  </button>

                  <button
                    onClick={() =>
                      setTemp((p) => ({
                        ...p,
                        [sub.id]: (p[sub.id] || 0) - 1,
                      }))
                    }
                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10"
                  >
                    -1
                  </button>

                  <span className="text-white/60">
                    Bonus: {temp[sub.id] || 0}
                  </span>

                  <button
                    onClick={() => saveRating(sub)}
                    className="ml-auto bg-linear-to-r from-indigo-500 via-purple-500 to-pink-500 px-5 py-2 rounded-xl font-semibold hover:brightness-110 transition"
                  >
                    Speichern
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}