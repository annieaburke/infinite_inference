# Interactive Scatterplot Map

A browser-based interactive scatterplot rendered as a large zoomable analytical map. Each point has real numeric x/y coordinates tied to axes, and pan/zoom operates as a camera over a virtual coordinate plane.

## Features

- **Large virtual coordinate system** with movable camera (pan + zoom)
- **Real axes** with auto-scaled nice ticks, gridlines, and axis titles
- **Shaded background regions** with labels
- **Labeled data points** with collision avoidance and zoom-based progressive visibility
- **Hover tooltips** showing point details
- **Click-to-select** with detail panel
- **Search** — type to highlight matching points
- **Region filter** — dropdown to show only one group
- **CSV import** — load your own data (auto-detects x, y, label, region columns)
- **Touch support** — pinch-to-zoom and drag on mobile/tablet
- **Keyboard shortcuts** — `+`/`-` zoom, `0` reset, `Esc` deselect, `/` focus search

## Project Structure

```
webapp/                     Standalone web app
  index.html                Main HTML shell
  style.css                 Styles
  engine.js                 Canvas rendering engine (coordinate transforms, drawing)
  app.js                    Application logic (events, CSV parsing, UI wiring)
  sample-data.csv           Example dataset (50 companies)

powerpoint-addin/           PowerPoint content add-in
  manifest.xml              Office add-in manifest (sideload into PowerPoint)
  taskpane.html             Task pane UI (embeds the same engine.js)
  serve.js                  Dev server (Node.js, HTTP/HTTPS)
```

## Quick Start — Standalone Web App

Open `webapp/index.html` directly in a browser, or serve it:

```bash
cd powerpoint-addin
node serve.js
# Open http://localhost:3000/webapp/index.html
```

## Quick Start — PowerPoint Add-in

1. Generate a self-signed certificate (Office add-ins require HTTPS):
   ```bash
   cd powerpoint-addin
   openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"
   ```

2. Start the dev server:
   ```bash
   node serve.js
   ```

3. Sideload the add-in into PowerPoint:
   - Open PowerPoint → Insert → My Add-ins → Upload My Add-in
   - Select `powerpoint-addin/manifest.xml`

4. Click **Open Scatterplot** on the Home tab ribbon.

5. Use **Insert into Slide** to capture the current view as an image on the active slide.

## CSV Format

The CSV importer auto-detects columns. Recommended headers:

| Column | Required | Description |
|--------|----------|-------------|
| `x` | Yes | Numeric X coordinate |
| `y` | Yes | Numeric Y coordinate |
| `label` or `name` | No | Display label for each point |
| `region`, `group`, or `category` | No | Grouping for color and filter |
| *(any other)* | No | Shown in the detail panel on click |

If no `x`/`y` headers exist, the first two numeric columns are used.
