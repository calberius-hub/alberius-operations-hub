// netlify/functions/punch-core.mjs
//
// The pure logic behind the punch API — no Netlify, no network, no I/O — so
// it can be unit-tested directly. punch.mjs is the thin shell that wires this
// to Netlify Blobs.

export const MAX_PHOTO_CHARS     = 700000;  // ~500 KB decoded; the app sends far less
export const MAX_NOTE_CHARS      = 2000;
export const MAX_PHOTOS_PER_ITEM = 12;
export const MAX_ITEMS           = 400;     // the printed list has 97

/* Unit numbers and photo ids become blob keys, so keep them tame. */
export function unitId(raw) {
  return String(raw == null ? "" : raw).trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
}
export function photoId(raw) {
  return String(raw == null ? "" : raw).trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
}
export function clean(v, max) {
  return String(v == null ? "" : v).slice(0, max);
}

export const unitKey  = (u)  => "unit/" + u;
export const photoKey = (id) => "photo/" + id;

/* ── Per-item, newest-wins merge ──────────────────────────────────────────
   Each item carries the moment it last changed. Merging on that stamp rather
   than on who synced last is what lets two managers work the same unit
   without one of them quietly wiping the other's findings. */
export function mergeUnit(stored, incoming) {
  const base = stored || {
    unit:       incoming.unit,
    createdAt:  Number(incoming.createdAt) || Date.now(),
    items:      {},
    inspectors: [],
  };
  base.items = base.items || {};

  const inItems = incoming.items || {};
  let n = 0;
  for (const k of Object.keys(inItems)) {
    if (++n > MAX_ITEMS) break;
    const a = inItems[k];
    if (!a || typeof a !== "object") continue;
    const b  = base.items[k];
    const at = Number(a.t) || 0;
    const bt = b ? (Number(b.t) || 0) : -1;
    // Strictly newer only. A real edit always stamps a fresh t, so an equal
    // stamp means "same edit, pushed again" — and taking it would let a client
    // that doesn't know about a newer field quietly erase it on the way back.
    if (at > bt) {
      base.items[k] = {
        status:  a.status === "pass" || a.status === "fail" ? a.status : null,
        note:    clean(a.note, MAX_NOTE_CHARS),
        photos:  Array.isArray(a.photos)
                   ? a.photos.map(photoId).filter(Boolean).slice(0, MAX_PHOTOS_PER_ITEM)
                   : [],
        // A failed item that has since been put right. The failure stays on
        // the record — that is the point of a punch list — it just stops
        // counting as open work.
        fixed:   a.fixed === true,
        fixedAt: Number(a.fixedAt) || 0,
        fixedBy: clean(a.fixedBy, 60),
        t:       at || Date.now(),
      };
    }
  }

  // Everyone who has touched this unit, for the dashboard's "Walked by"
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
export function summarize(rec) {
  let pass = 0, fail = 0, fixed = 0;   // `fail` is OPEN failures only
  const items = rec.items || {};
  for (const k of Object.keys(items)) {
    const it = items[k];
    if (it.status === "pass") pass++;
    else if (it.status === "fail") { if (it.fixed) fixed++; else fail++; }
  }
  return {
    unit:       rec.unit,
    pass, fail, fixed,
    done:       pass + fail + fixed,
    inspector:  rec.inspector || "",
    inspectors: rec.inspectors || [],
    createdAt:  rec.createdAt || null,
    updatedAt:  rec.updatedAt || null,
  };
}
