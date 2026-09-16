# Alberius Operations Hub

A lightweight, Netlify-ready operations shell built with vanilla HTML, CSS, and JS.

## Overview

- **Depot:** `/tmp/claude-work/alberius-hub-v2`
- **Style:** cream/sage palette unified with the rosemary finish app and `rosemary-accounting.netlify.app`
- **Format:** static assets — zero build step, zero backend

## Pages

- `index.html` — Dashboard with executive status cards and quick tiles
- `punchlist.html` — Rosemary Villas punch-out walkthrough (phone-first)
- `punch-dashboard.html` — central view of every unit being punched out (admin)
- `punch-data.js` — the 97-check list, shared by both of the above
- `files-records.html` — Latest reports, executive summary, issues queue
- `rosemary-accounting.html` — Module shell with intake/routing/reports placeholder and migration note
- `cra-accounting.html` — CRA placeholder linked from top nav
- `companies.html` — Entity registry with live module links

## Navigation

All pages share a sticky top nav with:
Dashboard · Files & Records · Rosemary Accounting · CRA Accounting · Companies

## Design System

CSS variables are defined in `styles.css`:
- `--bg-body`: parchment background
- `--text-primary`: dark green
- `--sage-{100,300,500,700}`: accent scale
- `--bg-glass`: translucent surface for glass tiles

## Deployment

See `deployment.md`.


## Punch Out

Two pages over one shared store:

- **`punchlist.html`** is what the construction managers use in the field. It
  is local-first by design — every tap lands in `localStorage` (checklist) and
  IndexedDB (photos, downscaled to 1400px JPEG) before anything touches the
  network, so a unit with no signal works normally and catches up later.
- **`punch-dashboard.html`** is the office view: every unit, its progress, its
  open item count, who walked it, and the full report with photos.

### The API

`netlify/functions/punch.mjs` — a **v2** function on purpose. v1 handlers on
this site fail with `MissingBlobsEnvironmentError` because the Blobs context
isn't injected for them; v2 gets it automatically, so there is no `siteID` /
`token` to manage. Pure logic lives in `punch-core.mjs` and is unit-testable
with plain Node, no Netlify needed.

Blob keys: `unit/<unitNumber>` (JSON record) and `photo/<photoId>` (base64
data URI).

### Item states

An item is unanswered, **passed**, or **failed**. A failure then closes out in
two steps, because "the sub says it's done" and "I've laid eyes on it" are
different facts:

    open  --[mark fixed]-->  toVerify  --[verify]-->  verified
      ^                          |                        |
      +------[reopen]------------+------------------------+

So a failed item is always in exactly one bucket — `fail` (nobody has fixed
it), `toVerify`, or `verified` — and those three plus `pass` sum to `done`.
`fail` therefore means **open failures only** everywhere in this codebase.

Marking something fixed never erases the failure: a punch list is a record of
what went wrong as much as a list of what is left. Both signers and both
timestamps are kept, and the report says plainly when the same person did both
steps. Reopening clears the whole sign-off; clearing or flipping the pass/fail
answer clears it too.

`verified` is clamped server-side so an item nobody has fixed can never be
marked verified. Records written before verification existed read as
`toVerify` — never as verified — so nothing claims a sign-off that never
happened.

Either side can act: the managers on the phone, or the office from the
dashboard. By default anyone can do either step; set
`PUNCH_CONFIG.verifyRequiresAdmin` in `punch-data.js` to require a hub admin
for the verify step (a real control, but every sign-off then waits on an
admin).

### How two managers in one unit stay out of each other's way

Every checklist item carries `t`, the moment it last changed. Both the phone
and the server merge **per item, strictly-newer wins** — never per unit. So if
Randy and Josh are both in 18129, each one's findings survive; whoever syncs
last does not overwrite the other.

Two rules hold this together. Break either and you get silent data loss:

1. **Merge on a strictly newer stamp, never on an equal one.** A real edit
   always stamps a fresh `t`, so an equal stamp means "the same edit, pushed
   again". Accepting it lets a client that doesn't know about a field erase
   that field on its way back to the server.
2. **Copy the whole item record on the way in.** Both `mergeUnit` (server) and
   `applyRemote` (phone) rebuild the item from an explicit field list. Add a
   field to one and forget the other and it syncs one way only. That is
   exactly how `fixed` once travelled up from a phone but never back down to
   it, and how a dashboard fix got silently undone.

Only real mutators may write `t`. Rendering must never touch it.

### Auth — read this before widening access

The API takes a shared key in the `x-punch-key` header (`PUNCH_KEY` env var,
or a built-in default). The key sits in the page source, so it stops drive-by
traffic and nothing more. The dashboard additionally requires an `admin`
session from the hub, but that check is client-side.

That is a deliberate fit for what this holds: unit numbers, construction
defects, and jobsite photos. **If anything resembling customer or financial
data ever lands here, this needs real server-side auth first.**

### Changing the checklist

Results are stored against `<roomId>.<categoryIndex>.<itemIndex>`. Appending
an item to the end of a category is safe. Reordering or deleting items in an
existing room silently re-points saved results and needs a migration.
