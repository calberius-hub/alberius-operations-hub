// netlify/functions/punch.mjs
//
// Backing API for the Rosemary Villas punch-out walkthrough.
//
// The phone app (punchlist.html) is local-first: managers can work a unit
// with no signal and everything lands in localStorage/IndexedDB. This
// function is the shared copy those phones push to and pull from, and it is
// what punch-dashboard.html reads so the office can see every unit.
//
// This is a Functions v2 handler on purpose — v2 gets the Netlify Blobs
// context injected automatically, so the store needs no siteID/token and
// there is no API credential to manage or rotate.
//
// Auth: header  x-punch-key: <key>  — PUNCH_KEY env var, or the built-in
// default so this works with zero configuration. That is internal-obscurity,
// not real security; see README.
//
// Actions (POST JSON { action, ... }):
//   "list"         → summary of every unit (counts, inspectors, last activity)
//   "get"          → { unit } one unit's full record
//   "sync"         → { unit, rec } merge a phone's copy in, return the merge
//   "delete-unit"  → { unit } remove a unit and its photos
//   "photo-put"    → { id, data } store one base64 JPEG
//   "photo-get"    → { id } read one back as a data URI

import { getStore } from "@netlify/blobs";
import {
  MAX_PHOTO_CHARS, unitId, photoId, unitKey, photoKey, mergeUnit, summarize,
} from "./punch-core.mjs";

const PUNCH_KEY = process.env.PUNCH_KEY || "rv-punch-2026";

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function store() {
  return getStore({ name: "punch", consistency: "strong" });
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  if (req.headers.get("x-punch-key") !== PUNCH_KEY) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body;
  try { body = await req.json(); }
  catch { return json({ error: "Bad JSON" }, 400); }

  const s = store();

  try {
    switch (body.action) {

      case "list": {
        const { blobs } = await s.list({ prefix: "unit/" });
        const units = [];
        for (const b of blobs) {
          const rec = await s.get(b.key, { type: "json" });
          if (rec) units.push(summarize(rec));
        }
        units.sort((a, x) => (x.updatedAt || 0) - (a.updatedAt || 0));
        return json({ ok: true, units });
      }

      case "get": {
        const u = unitId(body.unit);
        if (!u) return json({ error: "Missing unit" }, 400);
        const rec = await s.get(unitKey(u), { type: "json" });
        return json({ ok: true, unit: rec || null });
      }

      case "sync": {
        const u = unitId(body.unit);
        if (!u) return json({ error: "Missing unit" }, 400);
        const incoming = body.rec && typeof body.rec === "object" ? body.rec : {};
        incoming.unit = u;
        const stored = await s.get(unitKey(u), { type: "json" });
        const merged = mergeUnit(stored, incoming);
        await s.setJSON(unitKey(u), merged);
        return json({ ok: true, unit: merged });
      }

      case "delete-unit": {
        const u = unitId(body.unit);
        if (!u) return json({ error: "Missing unit" }, 400);
        const rec = await s.get(unitKey(u), { type: "json" });
        if (rec?.items) {
          for (const k of Object.keys(rec.items)) {
            for (const pid of (rec.items[k].photos || [])) {
              try { await s.delete(photoKey(pid)); } catch { /* already gone */ }
            }
          }
        }
        await s.delete(unitKey(u));
        return json({ ok: true });
      }

      case "photo-put": {
        const id = photoId(body.id);
        if (!id) return json({ error: "Missing photo id" }, 400);
        const data = String(body.data || "");
        if (!data) return json({ error: "Missing photo data" }, 400);
        if (data.length > MAX_PHOTO_CHARS) return json({ error: "Photo too large" }, 413);
        await s.set(photoKey(id), data);
        return json({ ok: true, id });
      }

      case "photo-get": {
        const id = photoId(body.id);
        if (!id) return json({ error: "Missing photo id" }, 400);
        const data = await s.get(photoKey(id), { type: "text" });
        if (!data) return json({ error: "No such photo" }, 404);
        return json({ ok: true, id, data });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    return json({ error: String(err?.message || err) }, 500);
  }
};
