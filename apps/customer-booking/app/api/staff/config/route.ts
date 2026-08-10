import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const url = process.env.SUPABASE_URL
    ?? process.env.NEXT_PUBLIC_SUPABASE_URL
    ?? process.env.PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    return NextResponse.json({ error: "Staff authentication is not configured" }, { status: 503 });
  }

  return NextResponse.json({
    supabaseUrl: url.replace(/\/$/, ""),
    supabasePublishableKey: publishableKey
  });
}
