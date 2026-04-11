"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeCanvas } from "qrcode.react";

type Team = 1 | 2 | 3 | 4;

type TeamData = {
  name: string;
  players: string[];
};

const teams: Record<Team, TeamData> = {
  1: {
    name: "Tiroler Göstl",
    players: ["Paul", "Lara", "Horst"],
  },
  2: {
    name: "Blitze",
    players: ["Spieler 2", "Spieler 6", "Spieler 10"],
  },
  3: {
    name: "Phönix",
    players: ["Spieler 3", "Spieler 7", "Spieler 11"],
  },
  4: {
    name: "Titanen",
    players: ["Spieler 4", "Spieler 8", "Spieler 12"],
  },
};

const spinWords = [
  "IS SCHO LÄSSIG HEROBEN IN SERFAUS",
  "TUX TUX HINTERTUX",
  "GEH MIR NED AN OASCH",
  "BIST DU NARRISCH",
  "GEHST SCHEISSEN OIDA",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function CasinoTeams() {
  const [phase, setPhase] =
    useState<"idle" | "spin" | "reveal" | "qr" | "done">("idle");

  const [teamIndex, setTeamIndex] = useState<Team>(1);
  const [spinText, setSpinText] = useState("BEREIT");

  const [visiblePlayers, setVisiblePlayers] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const startSpin = async (team: Team) => {
    setPhase("spin");
    setVisiblePlayers([]);
    setActiveIndex(null);

    let i = 0;
    const interval = setInterval(() => {
      setSpinText(spinWords[i % spinWords.length]);
      i++;
    }, 110);

    await sleep(2400);
    clearInterval(interval);

    setSpinText("LOCKED");
    await sleep(250);

    setPhase("reveal");

    // ✅ FIX: players korrekt aus TeamData
    for (let i = 0; i < teams[team].players.length; i++) {
      setActiveIndex(i);

      await sleep(220);

      setVisiblePlayers((prev) => [
        ...prev,
        teams[team].players[i],
      ]);

      await sleep(850);
    }

    setActiveIndex(null);

    await sleep(8600);
    setPhase("qr");
  };

  const nextTeam = async () => {
    const next = (teamIndex + 1) as Team;

    if (next > 4) {
      setPhase("done");
      return;
    }

    setTeamIndex(next);
    setPhase("idle");

    await sleep(400);
    startSpin(next);
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center text-white p-6 bg-linear-to-b from-[#0b1337] via-[#0f172a] to-[#0b1337]">

      {/* TITLE */}
      <motion.h1
        initial={{ opacity: 0, y: -25 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-bold mb-10 text-center bg-linear-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
      >
        Bäriger Team Manager
      </motion.h1>

      {/* IDLE */}
      {phase === "idle" && (
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.98 }}
          className="mt-6 px-8 py-3 rounded-xl bg-linear-to-r from-indigo-500 via-purple-500 to-pink-500 font-semibold"
          onClick={() => startSpin(teamIndex)}
        >
          Zufallsgenarator starten 
        </motion.button>
      )}

      {/* SPIN */}
      {phase === "spin" && (
        <div className="relative w-full max-w-md h-40 flex items-center justify-center">

          <motion.div
            className="absolute w-60 h-60 rounded-full bg-purple-500/10 blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{ repeat: Infinity, duration: 1.2 }}
          />

          <motion.div
            animate={{
              scale: [1, 1.03, 0.98, 1.02, 1],
              y: [0, -2, 2, -1, 0],
              filter: ["blur(0px)", "blur(1.5px)", "blur(0px)"],
            }}
            transition={{ repeat: Infinity, duration: 0.18 }}
            className="text-center z-10"
          >
            <div className="text-2xl font-semibold tracking-wide text-white">
              {spinText}
            </div>

            <motion.div
              className="mt-3 h-0.5 w-full bg-linear-to-r from-transparent via-cyan-400 to-transparent"
              animate={{ x: [-220, 220] }}
              transition={{ repeat: Infinity, duration: 0.45 }}
            />

            <motion.div
              className="mt-2 h-0.5 w-full bg-linear-to-r from-transparent via-pink-400 to-transparent"
              animate={{ x: [220, -220] }}
              transition={{ repeat: Infinity, duration: 0.6 }}
            />
          </motion.div>

        </div>
      )}

      {/* REVEAL */}
      {phase === "reveal" && (
        <div className="w-full max-w-md text-center">

          <h2 className="text-2xl font-semibold mb-6">
            Team {teams[teamIndex].name}
          </h2>

          <div className="space-y-4">
            <AnimatePresence>
              {visiblePlayers.map((p, i) => {
                const isLatest = i === activeIndex;

                return (
                  <motion.div
                    key={p}
                    initial={{ opacity: 0, scale: 0.5, y: -40, filter: "blur(10px)" }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      y: 0,
                      filter: "blur(0px)",
                      boxShadow: isLatest
                        ? "0 0 40px rgba(34,211,238,0.7)"
                        : "0 0 10px rgba(255,255,255,0.05)",
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 220,
                      damping: 14,
                    }}
                    className="px-6 py-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 font-medium relative overflow-hidden"
                  >
                    <span className="relative z-10">{p}</span>

                    {isLatest && (
                      <motion.div
                        initial={{ x: "-100%" }}
                        animate={{ x: "200%" }}
                        transition={{ duration: 0.9 }}
                        className="absolute inset-0 bg-linear-to-r from-transparent via-cyan-400/20 to-transparent"
                      />
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* QR */}
      {phase === "qr" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="flex flex-col items-center text-center"
        >
          <div className="mb-5">
            <h2 className="text-2xl font-semibold mb-2">
              Team {teams[teamIndex].name} ist vollständig
            </h2>

            <p className="text-white/60 text-sm">
              QR-Code scannen und Teamnamen erstellen
            </p>
          </div>

          <motion.div
            animate={{
              boxShadow: [
                "0 0 20px rgba(168,85,247,0.3)",
                "0 0 60px rgba(34,211,238,0.4)",
                "0 0 20px rgba(168,85,247,0.3)",
              ],
            }}
            transition={{ repeat: Infinity, duration: 1.4 }}
            className="p-2 bg-white rounded-2xl"
          >
            <QRCodeCanvas
              value={`https://baerige-schnitzeljagd.up.railway.app/`}
              size={190}
              includeMargin={false}
              style={{ display: "block" }}
            />
          </motion.div>

          <button
            onClick={nextTeam}
            className="mt-6 px-8 py-3 rounded-xl bg-linear-to-r from-indigo-500 via-purple-500 to-pink-500 font-semibold"
          >
            Nächstes Team
          </button>
        </motion.div>
      )}

      {/* DONE */}
      {phase === "done" && (
        <div className="text-xl font-semibold">
          Alle Teams erstellt
        </div>
      )}
    </div>
  );
}