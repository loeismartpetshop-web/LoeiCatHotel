import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const logo = await readFile(join(process.cwd(), "public", "loeicathotel-logo.webp"));
  const source = logo.toString("base64");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs><clipPath id="circle"><circle cx="32" cy="32" r="32"/></clipPath></defs>
  <image width="64" height="64" preserveAspectRatio="xMidYMid slice" clip-path="url(#circle)" href="data:image/webp;base64,${source}"/>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800"
    }
  });
}
