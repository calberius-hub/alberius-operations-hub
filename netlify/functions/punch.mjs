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
  MAX_PHOTO_CHARS, TOTAL_ITEMS, unitId, photoId, unitKey, photoKey,
  mergeUnit, summarize, isComplete,
} from "./punch-core.mjs";

const PUNCH_KEY = process.env.PUNCH_KEY || "rv-punch-2026";

/* ── Office notification ──────────────────────────────────────────────────
   When a manager finishes walking a unit — every one of the 97 checks
   answered — Cole and Randy get an email. Reuses the same Resend setup the
   CRA site uses; set RESEND_API_KEY on this site and it starts working.
   Without the key it stays quiet rather than failing the sync.            */
const NOTIFY_TO = (process.env.PUNCH_NOTIFY_TO ||
  "calberius@sds-ar.com,ralberius@sds-ar.com")
  .split(",").map((s) => s.trim()).filter(Boolean);

const NOTIFY_FROM = process.env.RESEND_FROM ||
  "Rosemary Villas Punch Out <hello@cra-construction.com>";

const SITE = "https://alberiusops.com";

function fmtWhen(ts) {
  try {
    return new Date(ts).toLocaleString("en-US", {
      timeZone: "America/Chicago", month: "short", day: "numeric",
      year: "numeric", hour: "numeric", minute: "2-digit",
    }) + " CT";
  } catch { return new Date(ts).toISOString(); }
}

function esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function completionEmail(rec) {
  const s    = summarize(rec);
  const who  = (s.inspectors || []).length ? s.inspectors.join(", ") : (s.inspector || "—");
  const link = SITE + "/punch-dashboard.html?unit=" + encodeURIComponent(rec.unit);

  const headline = s.fail
    ? s.fail + " item" + (s.fail === 1 ? "" : "s") + " to fix"
    : s.toVerify
      ? "Nothing to fix — " + s.toVerify + " waiting on verification"
      : "Clean walkthrough — nothing to fix";

  const row = (label, value, color) =>
    '<tr><td style="padding:5px 16px 5px 0;color:#5e6e63">' + label + "</td>" +
    '<td style="padding:5px 0;font-weight:700;color:' + color + '">' + value + "</td></tr>";

  const html =
    '<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;' +
      'color:#1a1f1c;line-height:1.55;max-width:520px">' +
    '<p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.14em;' +
      'text-transform:uppercase;color:#5e6e63">Rosemary Villas at Chenal</p>' +
    '<h2 style="margin:0 0 6px;font-size:22px">Unit ' + esc(rec.unit) + " punched out</h2>" +
    '<p style="margin:0 0 18px;color:#8c6526;font-weight:600">' + esc(headline) + "</p>" +
    '<p style="margin:0 0 16px;color:#2f3a33">Walked by ' + esc(who) +
      "<br>Finished " + esc(fmtWhen(s.updatedAt || Date.now())) + "</p>" +
    '<table style="border-collapse:collapse;font-size:14px;margin-bottom:22px">' +
      row("Passed", s.pass, "#47704b") +
      row("Still to fix", s.fail, "#933a2d") +
      row("Waiting on verification", s.toVerify, "#8c6526") +
      row("Verified", s.verified, "#3d6f66") +
    "</table>" +
    '<a href="' + link + '" style="display:inline-block;background:#5a8a5e;color:#fff;' +
      'text-decoration:none;padding:12px 20px;border-radius:9px;font-weight:600;' +
      'font-size:14px">Open Unit ' + esc(rec.unit) + "</a>" +
    '<p style="margin:24px 0 0;font-size:12px;color:#5e6e63">' +
      "Sent automatically when a manager finishes all " + TOTAL_ITEMS +
      " checks. Alberius Operations · Internal</p></div>";

  return {
    subject: "Unit " + rec.unit + " punched out — " + headline,
    html,
  };
}

async function notifyComplete(rec) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !NOTIFY_TO.length) return "skipped-no-key";
  const { subject, html } = completionEmail(rec);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ from: NOTIFY_FROM, to: NOTIFY_TO, subject, html }),
    });
    if (!res.ok) return "failed-" + res.status;
    return "sent";
  } catch (e) {
    return "failed";   // best effort — never fail a manager's sync over an email
  }
}

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

        // Tell the office once, the moment the walkthrough is finished.
        // `completedNotifiedAt` lives only on the stored record — mergeUnit
        // never copies it from an incoming payload, so a phone can't forge or
        // clear it. Claim it BEFORE sending so two syncs landing together
        // can't both fire; an email that then fails is lost rather than
        // doubled, which is the right way round for a notification.
        const complete = isComplete(merged);
        let notify = null;
        if (complete && !merged.completedNotifiedAt) {
          merged.completedNotifiedAt = Date.now();
          notify = "pending";
        } else if (!complete && merged.completedNotifiedAt) {
          merged.completedNotifiedAt = 0;   // re-arm if a check gets cleared
        }

        await s.setJSON(unitKey(u), merged);
        if (notify) notify = await notifyComplete(merged);

        return json(notify ? { ok: true, unit: merged, notified: notify }
                           : { ok: true, unit: merged });
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
