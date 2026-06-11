# Deployment — Alberius Hub

## Netlify

1. Create a new Netlify site from this folder (drag-and-drop).
2. Build settings: none required because assets are static HTML/CSS/JS.
3. Publish directory: the repo root (e.g. `/tmp/claude-work/alberius-hub-v2`).

## Clean titles

Ensure Netlify site name includes your org label, for example:

`alberius-hub.netlify.app`

## Content links

- `README.md` and `deployment.md` are included as docs;
  Netlify will serve them as plain text.
- Any page with relative navigation will be reachable from `/`.

## Keep relative links intact

All navigation uses relative hrefs (`index.html`, `rosemary-accounting.html`, etc.);
preserve them during any file reorganization or build step.
