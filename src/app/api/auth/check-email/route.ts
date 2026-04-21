import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ exists: false }, { status: 400 });
    }

    const { rows } = await pool.query(
      "SELECT id FROM users WHERE email = $1 LIMIT 1",
      [email.toLowerCase().trim()]
    );

    return NextResponse.json({ exists: rows.length > 0 });
  } catch (err) {
    console.error("check-email error:", err);
    return NextResponse.json({ exists: false }, { status: 500 });
  }
}
