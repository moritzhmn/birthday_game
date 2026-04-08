import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// -------------------- Supabase Client --------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // serverseitig geheim
);

// -------------------- Admin-Key --------------------
const ADMIN_KEY = process.env.GAME_ADMIN_KEY;

// -------------------- GET → Status --------------------
export async function GET(req: NextRequest) {
  try {
    const { data: game, error } = await supabase
      .from("game_state")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ error }, { status: 500 });
    if (!game) return NextResponse.json({ message: "No game yet" }, { status: 404 });

    let timeLeft = 0;
    if (game.is_active && game.started_at) {
      const elapsed = Math.floor((Date.now() - new Date(game.started_at).getTime()) / 1000);
      timeLeft = Math.max(game.duration_sec - elapsed, 0);
    }

    return NextResponse.json({ game, timeLeft });
  } catch (err) {
    return NextResponse.json({ error: err }, { status: 500 });
  }
}

// -------------------- POST → Start/Stop --------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, key } = body;

    // Auth check
    if (key !== ADMIN_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Game-State abrufen
    let { data: game, error } = await supabase
      .from("game_state")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ error }, { status: 500 });

    // Falls kein Game vorhanden → erstellen
    let gameId = game?.id;
    if (!game) {
      const { data: newGame, error: insertError } = await supabase
        .from("game_state")
        .insert({ is_active: false, started_at: null, duration_sec: 3600 })
        .select()
        .maybeSingle();

      if (insertError) return NextResponse.json({ error: insertError }, { status: 500 });
      gameId = newGame?.id;
      game = newGame!;
    }

    if (!gameId) return NextResponse.json({ error: "Game ID missing" }, { status: 500 });

    // -------------------- Action --------------------
    if (action === "start") {
      const now = new Date().toISOString();
      await supabase.from("game_state").update({ is_active: true, started_at: now }).eq("id", gameId);
      return NextResponse.json({ message: "Game started", started_at: now });
    }

    if (action === "stop") {
      await supabase.from("game_state").update({ is_active: false }).eq("id", gameId);
      return NextResponse.json({ message: "Game stopped" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err }, { status: 500 });
  }
}