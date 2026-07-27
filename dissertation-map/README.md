# Dissertation Map — editable

A single self-contained interactive version of the dissertation map
(`dissertation_map_editable.html`). Open it in any modern browser — no server,
no build step, nothing to install. Everything (HTML, CSS, JS) lives in the one
file, so it drops straight onto a website later.

## What you can do

| Action | How |
|---|---|
| **Pan** the canvas | Drag any empty space (flick to coast — inertial) |
| **Zoom** | Scroll / pinch, or the `− + fit` buttons |
| **Move a box** | Drag it — it lifts, springs, and settles with a little bounce; connectors flex to follow |
| **Edit text** | Double-click a box, type, press `Esc` (or click away) |
| **Lock it** | `arrange` ⇄ `view` toggle — *view* disables drag/edit for presentation |
| **Reset** | `reset layout` returns every box and edit to the file's defaults |
| **Save a copy** | `download` exports a standalone `.html` with the current layout baked in |

Edits **auto-save in the browser** (localStorage) as you work, so a refresh keeps
your changes. `download` is for a portable/backup copy or for publishing.

## The "bounce" — how the physics works

The elastic, alive feel is a small self-contained spring simulation (no D3, no
CDN — the file stays one portable piece):

- **Each box is a particle** tethered to a *home* by an underdamped spring, so it
  overshoots and settles instead of snapping. The home updates to wherever you
  drop a box, so your layout still persists — it just *arrives* bouncily.
- **The box you're dragging shoves neighbors aside** (one-directional collision);
  when you move off, they spring back to their homes. Nothing pushes at rest, so
  boxes can overlap freely and the simulation falls asleep (no wasted CPU).
- **Connectors are rubber bands**: each straight line's midpoint is its own
  springy particle that lags and catches up, drawn as a quadratic curve — so
  lines flex when boxes move and relax when they settle.
- **Panning has inertia**; dragged cards **lift** with a shadow.
- Tuning lives in the constants near the top of the script:
  `HOME_K`/`DAMP` (box spring), `CP_K`/`CP_DAMP` (line rubber-band),
  `COL_PAD`/`COL_SOFT` (how hard boxes shove). Lower stiffness / higher damping =
  calmer; the reverse = bouncier.

## How the pieces fit (for later edits)

- Every movable element is a `.draggable` with a unique `id`.
- **Connectors are defined by reference, not coordinates.** In the script,
  `CONNECTORS` lists `from`/`to` box ids plus which side to attach to; `BRACKETS`
  lists groups of boxes a bracket should span. Endpoints are recomputed from the
  boxes' live particle geometry every frame — that's why lines follow. To add a
  line, add one entry to `CONNECTORS`; to re-route one, change its sides.
- `DEFAULT` captures each element's pristine position/text at load, *before*
  saved edits are applied, so `reset layout` always has a clean baseline.

## Notes / limits (v1)

- v1 covers **drag (with spring physics) + inline text editing**. Resizing boxes
  and adding/deleting boxes or connectors aren't wired up yet — natural next steps.
- Fonts load from Google Fonts; offline they fall back to system sans/mono.
- localStorage is per-browser. To share edits across machines, use `download`
  and publish the resulting file (a shared-file/team-sync mode can come later).

## Publishing to a website

Because it's one static file, hosting is just "put the file somewhere":
drop `dissertation_map_editable.html` into any static host (Netlify, GitHub
Pages, S3, your CMS's file upload) and link to it. We can tackle that step
whenever you're ready.
