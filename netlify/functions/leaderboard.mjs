import { getDatabase } from "@netlify/database";

const LIMIT = 100;
/** Keep in sync with js/leaderboard-rules.js MIN_PUBLIC_CLICKS. */
const MIN_PUBLIC_CLICKS = 1;

/**
 * @param {unknown} value
 */
function fixMojibake(value) {
  const s = String(value ?? "");
  if (!s) return s;
  for (const ch of s) {
    if (ch.charCodeAt(0) > 0xff) return s;
  }
  if (!/[ÐÑÂÃ]/.test(s)) return s;
  try {
    const fixed = Buffer.from(s, "latin1").toString("utf8");
    if (fixed.includes("\uFFFD") || fixed === s) return s;
    return fixed;
  } catch {
    return s;
  }
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method !== "GET") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  const db = getDatabase();
  // Hygiene: hide never-engaged (0) and idle-drain negatives from the public top.
  // total = engaged scorers (clicks≥1); totalPlayers = all score rows (incl. 0/neg).
  const [rows, countRows, allCountRows] = await Promise.all([
    db.sql`
      SELECT
        display_name,
        avatar_url,
        clicks,
        (updated_at >= NOW() - INTERVAL '5 minutes') AS online
      FROM scores
      WHERE clicks >= ${MIN_PUBLIC_CLICKS}
      ORDER BY clicks DESC, updated_at ASC
      LIMIT ${LIMIT}
    `,
    db.sql`
      SELECT COUNT(*)::int AS total
      FROM scores
      WHERE clicks >= ${MIN_PUBLIC_CLICKS}
    `,
    db.sql`
      SELECT COUNT(*)::int AS total
      FROM scores
    `,
  ]);

  const total = Number(countRows[0]?.total ?? 0);
  const totalPlayers = Number(allCountRows[0]?.total ?? 0);

  return Response.json(
    {
      limit: LIMIT,
      total,
      totalPlayers,
      leaders: rows.map((row, index) => {
        const rawAvatar = typeof row.avatar_url === "string" ? row.avatar_url : "";
        // Hide URLs truncated by the old 500-char save path (broken lh3 links).
        const avatarUrl =
          rawAvatar &&
          (rawAvatar.startsWith("data:image/svg+xml,") || rawAvatar.length !== 500)
            ? rawAvatar
            : null;
        return {
          rank: index + 1,
          name: fixMojibake(row.display_name) || "Player",
          avatarUrl,
          clicks: Number(row.clicks || 0),
          online: row.online === true || row.online === "t" || row.online === "true",
        };
      }),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=5",
      },
    },
  );
};
