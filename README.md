# Alberius Operations Hub

A lightweight, Netlify-ready operations shell built with vanilla HTML, CSS, and JS.

## Overview

- **Depot:** `/tmp/claude-work/alberius-hub-v2`
- **Style:** cream/sage palette unified with the rosemary finish app and `rosemary-accounting.netlify.app`
- **Format:** static assets — zero build step, zero backend

## Pages

- `index.html` — Dashboard with executive status cards and quick tiles
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
