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

### How two managers in one unit stay out of each other's way

Every checklist item carries `t`, the moment it last changed. Both the phone
and the server merge **per item, newest wins** — never per unit. So if Randy
and Josh are both in 18129, each one's findings survive; whoever syncs last
does not overwrite the other. This is the one invariant to preserve if the
sync code is ever touched.

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
