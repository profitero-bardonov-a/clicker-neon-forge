import { getDatabase } from "@netlify/database";

const json = (body, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });

/**
 * Decode JWT payload as UTF-8 (not atob/Latin-1).
 * @param {string} token
 */
function parseJwtPayload(token) {
  const part = token.split(".")[1];
  if (!part) return null;
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const json = Buffer.from(b64, "base64").toString("utf8");
  return JSON.parse(json);
}

/** Guest ids are unguessable; the leaderboard never returns them. */
const GUEST_ID = /^guest_[0-9a-f]{32}$/;

/**
 * @param {unknown} value
 * @param {string} [fallback]
 */
function sanitizeName(value, fallback = "Player") {
  const name = fixMojibake(typeof value === "string" ? value.trim() : "")
    .replace(/\u0000/g, "")
    .slice(0, 80);
  return name || fallback;
}

/**
 * Guest avatars are the small SVG data URLs minted in the browser.
 * @param {unknown} value
 */
function sanitizeGuestAvatar(value) {
  if (typeof value !== "string") return null;
  const picture = value.replace(/\u0000/g, "").trim();
  if (!picture.startsWith("data:image/svg+xml,") || picture.length > 2048) return null;
  try {
    const decoded = decodeURIComponent(picture);
    if (/script|foreignobject|onload|javascript:/i.test(decoded)) return null;
  } catch {
    return null;
  }
  return picture;
}

/**
 * @param {Record<string, unknown>} body
 */
function getGuestFromBody(body) {
  const id = typeof body.guestId === "string" ? body.guestId : "";
  if (!GUEST_ID.test(id)) return null;
  return {
    id,
    name: sanitizeName(body.name),
    pictureUrl: sanitizeGuestAvatar(body.pictureUrl),
    guest: true,
  };
}

/**
 * Auth token must come from JSON body — not Cookie / Authorization.
 * Some Google accounts embed a huge avatar_url in the JWT; sending that
 * token in headers triggers Netlify platform "Internal Error" before our code runs.
 * @param {unknown} token
 */
function getUserFromToken(token) {
  if (typeof token !== "string" || !token) return null;
  try {
    const claims = parseJwtPayload(token);
    if (!claims?.sub) return null;
    if (typeof claims.exp === "number" && claims.exp * 1000 < Date.now()) {
      return null;
    }
    const meta = claims.user_metadata || {};
    const name =
      (typeof meta.full_name === "string" && meta.full_name) ||
      (typeof meta.name === "string" && meta.name) ||
      (typeof claims.email === "string" && claims.email.split("@")[0]) ||
      "Player";
    const pictureRaw =
      (typeof meta.avatar_url === "string" && meta.avatar_url) ||
      (typeof meta.picture === "string" && meta.picture) ||
      null;
    // TEXT column can hold long Google URLs; do not mid-slice (breaks lh3 links).
    const picture = pictureRaw ? String(pictureRaw).replace(/\u0000/g, "").trim() : "";
    return {
      id: String(claims.sub),
      email: typeof claims.email === "string" ? claims.email : undefined,
      name: String(name).replace(/\u0000/g, "").slice(0, 80) || "Player",
      pictureUrl: picture && picture.length <= 4096 ? picture : null,
    };
  } catch {
    return null;
  }
}

/**
 * Repair rows already stored with JWT atob mojibake.
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

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    const googleUser = getUserFromToken(body?.accessToken);
    const user = googleUser?.id ? googleUser : getGuestFromBody(body);
    if (!user?.id) {
      return json({ error: "unauthorized" }, 401);
    }

    const db = getDatabase();
    const op = body?.op === "get" ? "get" : "set";

    if (op === "get") {
      const rows = await db.sql`
        SELECT clicks
        FROM scores
        WHERE user_id = ${user.id}
        LIMIT 1
      `;
      return json({
        clicks: Number(rows[0]?.clicks ?? 0),
        user: {
          id: user.id,
          name: user.name,
          pictureUrl: user.pictureUrl,
        },
      });
    }

    const clicks = Math.floor(Number(body?.clicks));
    if (
      !Number.isFinite(clicks) ||
      clicks > Number.MAX_SAFE_INTEGER ||
      clicks < Number.MIN_SAFE_INTEGER
    ) {
      return json({ error: "invalid_clicks" }, 400);
    }

    const bodyName = typeof body?.name === "string" ? body.name.trim() : "";
    const name = fixMojibake(bodyName || user.name)
      .replace(/\u0000/g, "")
      .slice(0, 80) || "Player";

    const rows = await db.sql`
      INSERT INTO scores (user_id, display_name, avatar_url, clicks, updated_at)
      VALUES (${user.id}, ${name}, ${user.pictureUrl}, ${clicks}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        clicks = EXCLUDED.clicks,
        updated_at = CASE
          WHEN scores.clicks IS DISTINCT FROM EXCLUDED.clicks THEN NOW()
          ELSE scores.updated_at
        END
      RETURNING clicks
    `;

    if (
      googleUser?.id &&
      typeof body?.retireGuestId === "string" &&
      GUEST_ID.test(body.retireGuestId)
    ) {
      await db.sql`
        DELETE FROM scores
        WHERE user_id = ${body.retireGuestId}
      `;
    }

    return json({ clicks: Number(rows[0]?.clicks ?? clicks) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("score_error", message);
    return json({ error: "server_error", message }, 500);
  }
};
