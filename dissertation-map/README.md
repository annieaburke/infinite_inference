# Dissertation Map — editable

A single self-contained interactive version of the dissertation map
(`dissertation_map_editable.html`). Open it in any modern browser — no server,
no build step, nothing to install. Everything (HTML, CSS, JS) lives in the one
file, so it drops straight onto a website later.

## What you can do

| Action | How |
|---|---|
| **Pan** the canvas | Drag any empty space |
| **Zoom** | Scroll / pinch, or the `− + fit` buttons |
| **Move a box** | Drag it — connector lines recompute and follow |
| **Edit text** | Double-click a box, type, press `Esc` (or click away) |
| **Lock it** | `arrange` ⇄ `view` toggle — *view* disables drag/edit for presentation |
| **Reset** | `reset layout` returns every box and edit to the file's defaults |
| **Save a copy** | `download` exports a standalone `.html` with the current layout baked in |

Edits **auto-save in the browser** (localStorage) as you work, so a refresh keeps
your changes. `download` is for a portable/backup copy or for publishing.

## How the pieces fit (for later edits)

- Every movable element is a `.draggable` with a unique `id`.
- **Connectors are defined by reference, not coordinates.** In the script,
  `CONNECTORS` lists `from`/`to` box ids plus which side to attach to; `BRACKETS`
  lists groups of boxes a bracket should span. On every drag they're redrawn from
  the boxes' live geometry — that's why lines follow. To add a line, add one entry
  to `CONNECTORS`; to re-route one, change its sides.
- `DEFAULT` captures each element's pristine position/text at load, *before*
  saved edits are applied, so `reset layout` always has a clean baseline.

## Notes / limits (v1)

- v1 covers **drag + inline text editing**. Resizing boxes and adding/deleting
  boxes or connectors aren't wired up yet — natural next steps.
- Fonts load from Google Fonts; offline they fall back to system sans/mono.
- localStorage is per-browser. To share edits across machines, use `download`
  and publish the resulting file (a shared-file/team-sync mode can come later).

## Publishing to a website

Because it's one static file, hosting is just "put the file somewhere":
drop `dissertation_map_editable.html` into any static host (Netlify, GitHub
Pages, S3, your CMS's file upload) and link to it. We can tackle that step
whenever you're ready.
