// netlify/functions/punch.js
//
// Backing API for the Rosemary Villas punch-out walkthrough.
//
// The phone app (punchlist.html) is local-first: managers can work a unit
// with no signal and everything lands in localStorage/IndexedDB. This
// function is the shared copy those phones push to and pull from, and it is
// what punch-dashboard.html reads so Cole can see every unit from his desk.
//
// Merging is per-item, newest-wins, using the `t` stamp the app writes on
// every change. That way two managers in the same unit both converge instead
// of one of them silently overwriting the other.
//
// Auth: header  x-punch-key: <key>  — PUNCH_KEY env var, or the built-in
// default so this works with zero configuration. This is internal-obscurity,
// not real security; see README.
//
// Actions (POST JSON { action, ... }):
//   "list"         → summary of every unit (counts, inspectors, last activity)
//   "get"          → { unit } one unit's full record
//   "sync"         → { unit, rec } merge a phone's copy in, return the merge
//   "delete-unit"  → { unit } remove a unit and its photos
//   "photo-put"    → { id, data } store one base64 JPEG
//   "photo-get"    → { id } read one back as a data URI

const { getStore } = require("@netlify/blobs");

const PUNCH_KEY = process.env.PUNCH_KEY || "rv-punch-2026";

const MAX_PHOTO_CHARS = 700000;  // ~500 KB decoded — app sends far less
const MAX_NOTE_CHARS  = 2000;
const MAX_PHOTOS_PER_ITEM = 12;
const MAX_ITEMS = 400;           // the printed list has 97

function json(code, obj) {
  return {
    statusCode: code,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(obj),
  };
}

function store() {
  const opts = { name: "punch", consistency: "strong" };
  // Match the pattern used by the CRA site: explicit creds when the site
  // provides them, otherwise the runtime's own automatic configuration.
  if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_API_TOKEN) {
    opts.siteID = process.env.NETLIFY_SITE_ID;
    opts.token  = process.env.NETLIFY_API_TOKEN;
  }
  return getStore(opts);
}

/* Unit numbers become blob keys, so keep them tame. */
function unitId(raw) {
  const s = String(raw == null ? "" : raw).trim().replace(/[^A-Za-z0-9_-]/g, "");
  return s.slice(0, 32);
}
function photoId(raw) {
  const s = String(raw == null ? "" : raw).trim().replace(/[^A-Za-z0-9_-]/g, "");
  return s.slice(0, 64);
}
function clean(v, max) {
  return String(v == null ? "" : v).slice(0, max);
}

const unitKey  = (u)  => "unit/" + u;
const photoKey = (id) => "photo/" + id;

/* ── Per-item, newest-wins merge ────────────────────────────────────────── */
function mergeUnit(stored, incoming) {
  const base = stored || {
    unit:      incoming.unit,
    createdAt: Number(incoming.createdAt) || Date.now(),
    items:     {},
    inspectors: [],
  };
  base.items = base.items || {};

  const inItems = incoming.items || {};
  let n = 0;
  for (const k of Object.keys(inItems)) {
    if (++n > MAX_ITEMS) break;
    const a = inItems[k];
    if (!a || typeof a !== "object") continue;
    const b = base.items[k];
    const at = Number(a.t) || 0;
    const bt = b ? (Number(b.t) || 0) : -1;
    if (at >= bt) {
      base.items[k] = {
        status: a.status === "pass" || a.status === "fail" ? a.status : null,
        note:   clean(a.note, MAX_NOTE_CHARS),
        photos: Array.isArray(a.photos)
                  ? a.photos.map(photoId).filter(Boolean).slice(0, MAX_PHOTOS_PER_ITEM)
                  : [],
        t:      at || Date.now(),
      };
    }
  }

  // Everyone who has touched this unit, for the dashboard's "Inspected by".
  const who = new Set(Array.isArray(base.inspectors) ? base.inspectors : []);
  const incomingWho = clean(incoming.inspector, 60).trim();
  if (incomingWho) who.add(incomingWho);
  base.inspectors = Array.from(who).slice(0, 20);
  base.inspector  = incomingWho || base.inspector || "";

  base.createdAt = Math.min(base.createdAt || Date.now(), Number(incoming.createdAt) || Date.now());
  base.updatedAt = Math.max(Number(base.updatedAt) || 0, Number(incoming.updatedAt) || 0) || Date.now();
  base.unit      = base.unit || incoming.unit;
  return base;
}

/* Counts for the dashboard — computed fresh so the list is never stale. */
function summarize(rec) {
  let pass = 0, fail = 0;
  const items = rec.items || {};
  for (const k of Object.keys(items)) {
    const s = items[k].status;
    if (s === "pass") pass++;
    else if (s === "fail") fail++;
  }
  return {
    unit:       rec.unit,
    pass, fail,
    done:       pass + fail,
    inspector:  rec.inspector || "",
    inspectors: rec.inspectors || [],
    createdAt:  rec.createdAt || null,
    updatedAt:  rec.updatedAt || null,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Use POST" });

  const headers = event.headers || {};
  const key = headers["x-punch-key"] || headers["X-Punch-Key"];
  if (key !== PUNCH_KEY) return json(401, { error: "Unauthorized" });

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch (e) { return json(400, { error: "Bad JSON" }); }

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
        return json(200, { ok: true, units });
      }

      case "get": {
        const u = unitId(body.unit);
        if (!u) return json(400, { error: "Missing unit" });
        const rec = await s.get(unitKey(u), { type: "json" });
        return json(200, { ok: true, unit: rec || null });
      }

      case "sync": {
        const u = unitId(body.unit);
        if (!u) return json(400, { error: "Missing unit" });
        const incoming = body.rec && typeof body.rec === "object" ? body.rec : {};
        incoming.unit = u;
        const stored = await s.get(unitKey(u), { type: "json" });
        const merged = mergeUnit(stored, incoming);
        await s.setJSON(unitKey(u), merged);
        return json(200, { ok: true, unit: merged });
      }

      case "delete-unit": {
        const u = unitId(body.unit);
        if (!u) return json(400, { error: "Missing unit" });
        const rec = await s.get(unitKey(u), { type: "json" });
        if (rec && rec.items) {
          for (const k of Object.keys(rec.items)) {
            for (const pid of (rec.items[k].photos || [])) {
              try { await s.delete(photoKey(pid)); } catch (e) { /* already gone */ }
            }
          }
        }
        await s.delete(unitKey(u));
        return json(200, { ok: true });
      }

      case "photo-put": {
        const id = photoId(body.id);
        if (!id) return json(400, { error: "Missing photo id" });
        const data = String(body.data || "");
        if (!data) return json(400, { error: "Missing photo data" });
        if (data.length > MAX_PHOTO_CHARS) return json(413, { error: "Photo too large" });
        await s.set(photoKey(id), data);
        return json(200, { ok: true, id });
      }

      case "photo-get": {
        const id = photoId(body.id);
        if (!id) return json(400, { error: "Missing photo id" });
        const data = await s.get(photoKey(id), { type: "text" });
        if (!data) return json(404, { error: "No such photo" });
        return json(200, { ok: true, id, data });
      }

      default:
        return json(400, { error: "Unknown action" });
    }
  } catch (err) {
    return json(500, { error: String((err && err.message) || err) });
  }
};
