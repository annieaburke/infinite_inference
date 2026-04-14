/**
 * App wiring — CSV parsing, event handlers, toolbar bindings.
 */

"use strict";

(function () {

  /* ── Bootstrap ──────────────────────────────────────────────── */
  var canvas = document.getElementById("scatter-canvas");
  var engine = new ScatterEngine(canvas);

  var tooltip      = document.getElementById("tooltip");
  var detailPanel  = document.getElementById("detail-panel");
  var detailTitle  = document.getElementById("detail-title");
  var detailBody   = document.getElementById("detail-body");
  var searchInput  = document.getElementById("search-input");
  var regionFilter = document.getElementById("region-filter");
  var zoomDisplay  = document.getElementById("zoom-level");

  /* ── Demo data (used when no CSV is loaded) ─────────────────── */
  function loadDemoData() {
    var regions = [
      { xMin:  0, xMax: 35, yMin: 60, yMax: 100, color: "rgba(46,204,113,0.08)",  label: "High Growth" },
      { xMin: 35, xMax: 70, yMin: 30, yMax:  70, color: "rgba(52,152,219,0.08)",  label: "Stable" },
      { xMin: 60, xMax:100, yMin:  0, yMax:  40, color: "rgba(231,76,60,0.07)",   label: "Declining" },
      { xMin:  0, xMax: 30, yMin:  0, yMax:  30, color: "rgba(155,89,182,0.07)",  label: "Emerging" },
    ];
    engine.setRegions(regions);
    engine.axisTitle.x = "Market Share (%)";
    engine.axisTitle.y = "Growth Rate (%)";

    var names = [
      "Alpha Corp","Beta Inc","Gamma LLC","Delta Co","Epsilon Ltd",
      "Zeta Group","Eta Partners","Theta Ventures","Iota Systems","Kappa Tech",
      "Lambda AI","Mu Robotics","Nu Energy","Xi Finance","Omicron Health",
      "Pi Media","Rho Logistics","Sigma Bio","Tau Materials","Upsilon Foods",
      "Phi Aero","Chi Analytics","Psi Networks","Omega Cloud","Star Digital",
      "Nova Pharma","Apex Labs","Zenith Data","Pulse IoT","Orbit Space",
      "Vertex AI","Prism Optics","Forge Steel","Tide Marine","Crest Solar",
      "Ember Heat","Frost Cool","Peak Summit","Vale Agri","Drift Auto",
      "Bloom Garden","Swift Delivery","Spark Electric","Wave Audio","Stone Mining",
      "Globe Travel","Link Comms","Core Compute","Edge Security","Nest Housing"
    ];
    var regionNames = ["Technology","Healthcare","Finance","Energy","Consumer"];
    var points = [];
    // Use a seeded-style deterministic sequence for demo reproducibility
    var seed = 42;
    function rand() { seed = (seed * 16807 + 0) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < names.length; i++) {
      points.push({
        x: rand() * 95 + 2,
        y: rand() * 95 + 2,
        label: names[i],
        region: regionNames[i % regionNames.length],
        color: ["#5b8def","#2ecc71","#e67e22","#9b59b6","#e74c3c"][i % 5],
        revenue: "$" + (rand() * 500 + 10).toFixed(0) + "M",
        employees: Math.floor(rand() * 9000 + 100),
        priority: (i < 15) ? 1 : (i < 30) ? 2 : 3
      });
    }
    engine.setPoints(points);
    populateRegionFilter();
    engine.fitAll();
    render();
  }

  /* ── CSV parsing ────────────────────────────────────────────── */
  function parseCSV(text) {
    var lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    var headers = parseCSVLine(lines[0]);
    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      var vals = parseCSVLine(lines[i]);
      if (vals.length < 2) continue;
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        obj[headers[j].trim().toLowerCase()] = (vals[j] || "").trim();
      }
      rows.push(obj);
    }
    return rows;
  }

  function parseCSVLine(line) {
    var result = [];
    var current = "";
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { result.push(current); current = ""; }
        else { current += ch; }
      }
    }
    result.push(current);
    return result;
  }

  function loadCSVData(rows) {
    // Determine x and y columns: look for "x", "y", or first two numeric columns
    var keys = Object.keys(rows[0]);
    var xKey = null, yKey = null, labelKey = null, regionKey = null;

    for (var k = 0; k < keys.length; k++) {
      var kl = keys[k].toLowerCase();
      if (kl === "x") xKey = keys[k];
      if (kl === "y") yKey = keys[k];
      if (kl === "label" || kl === "name") labelKey = keys[k];
      if (kl === "region" || kl === "group" || kl === "category") regionKey = keys[k];
    }

    // Fallback: first two numeric columns
    if (!xKey || !yKey) {
      var numericCols = [];
      for (var c = 0; c < keys.length; c++) {
        if (!isNaN(parseFloat(rows[0][keys[c]]))) numericCols.push(keys[c]);
      }
      if (!xKey && numericCols.length > 0) xKey = numericCols[0];
      if (!yKey && numericCols.length > 1) yKey = numericCols[1];
    }

    if (!xKey || !yKey) {
      alert("CSV must have columns named 'x' and 'y', or at least two numeric columns.");
      return;
    }

    // Axis titles
    engine.axisTitle.x = xKey;
    engine.axisTitle.y = yKey;

    var colors = ["#5b8def","#2ecc71","#e67e22","#9b59b6","#e74c3c","#1abc9c","#f39c12","#3498db"];
    var regionColors = {};
    var colorIdx = 0;

    var points = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var px = parseFloat(r[xKey]);
      var py = parseFloat(r[yKey]);
      if (isNaN(px) || isNaN(py)) continue;

      var region = regionKey ? r[regionKey] : "Default";
      if (!(region in regionColors)) {
        regionColors[region] = colors[colorIdx % colors.length];
        colorIdx++;
      }

      var pt = {
        x: px, y: py,
        label: labelKey ? r[labelKey] : ("Point " + (i + 1)),
        region: region,
        color: regionColors[region],
        priority: (i < rows.length * 0.3) ? 1 : (i < rows.length * 0.6) ? 2 : 3
      };

      // Attach all extra fields
      for (var ek = 0; ek < keys.length; ek++) {
        var ekey = keys[ek];
        if (ekey !== xKey && ekey !== yKey && ekey !== labelKey && ekey !== regionKey) {
          pt[ekey] = r[ekey];
        }
      }
      points.push(pt);
    }

    engine.setPoints(points);
    engine.setRegions([]);   // clear demo regions for imported data
    populateRegionFilter();
    engine.fitAll();
    render();
  }

  document.getElementById("csv-upload").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      var rows = parseCSV(ev.target.result);
      if (rows.length) loadCSVData(rows);
    };
    reader.readAsText(file);
  });

  /* ── Region filter ──────────────────────────────────────────── */
  function populateRegionFilter() {
    var seen = {};
    for (var i = 0; i < engine.points.length; i++) {
      seen[engine.points[i].region] = true;
    }
    regionFilter.innerHTML = '<option value="__all__">All Regions</option>';
    Object.keys(seen).sort().forEach(function (r) {
      var opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r;
      regionFilter.appendChild(opt);
    });
  }

  regionFilter.addEventListener("change", function () {
    engine.activeRegion = regionFilter.value;
    render();
  });

  /* ── Search ─────────────────────────────────────────────────── */
  searchInput.addEventListener("input", function () {
    var term = searchInput.value.trim().toLowerCase();
    engine.searchTerm = term;
    engine.searchMatches.clear();
    if (term) {
      for (var i = 0; i < engine.points.length; i++) {
        if (engine.points[i].label && engine.points[i].label.toLowerCase().indexOf(term) !== -1) {
          engine.searchMatches.add(i);
        }
      }
    }
    render();
  });

  document.getElementById("clear-search").addEventListener("click", function () {
    searchInput.value = "";
    engine.searchTerm = "";
    engine.searchMatches.clear();
    render();
  });

  /* ── Toolbar buttons ────────────────────────────────────────── */
  document.getElementById("btn-reset-view").addEventListener("click", function () {
    engine.fitAll();
    updateZoomDisplay();
    render();
  });

  document.getElementById("btn-zoom-in").addEventListener("click", function () {
    engine.zoomAt(engine.W / 2, engine.H / 2, 1.4);
    updateZoomDisplay();
    render();
  });

  document.getElementById("btn-zoom-out").addEventListener("click", function () {
    engine.zoomAt(engine.W / 2, engine.H / 2, 1 / 1.4);
    updateZoomDisplay();
    render();
  });

  function updateZoomDisplay() {
    zoomDisplay.textContent = engine.cam.zoom.toFixed(2);
  }

  /* ── Mouse interaction: pan, zoom, hover, click ─────────────── */
  var isDragging = false;
  var dragStart = { x: 0, y: 0 };

  canvas.addEventListener("mousedown", function (e) {
    isDragging = true;
    dragStart.x = e.clientX;
    dragStart.y = e.clientY;
    canvas.classList.add("dragging");
  });

  window.addEventListener("mousemove", function (e) {
    if (isDragging) {
      var dx = e.clientX - dragStart.x;
      var dy = e.clientY - dragStart.y;
      engine.pan(dx, dy);
      dragStart.x = e.clientX;
      dragStart.y = e.clientY;
      render();
      return;
    }

    // Hover hit test
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    var hit = engine.hitTest(mx, my);

    if (hit !== engine.hoveredIndex) {
      engine.hoveredIndex = hit;
      render();
    }

    if (hit >= 0) {
      var p = engine.points[hit];
      var lines = [p.label];
      lines.push(engine.axisTitle.x + ": " + p.x.toFixed(2));
      lines.push(engine.axisTitle.y + ": " + p.y.toFixed(2));
      if (p.region) lines.push("Region: " + p.region);
      tooltip.textContent = lines.join("\n");
      tooltip.classList.remove("hidden");
      tooltip.style.left = (e.clientX + 14) + "px";
      tooltip.style.top = (e.clientY + 14) + "px";
      canvas.style.cursor = "pointer";
    } else {
      tooltip.classList.add("hidden");
      canvas.style.cursor = isDragging ? "grabbing" : "grab";
    }
  });

  window.addEventListener("mouseup", function () {
    isDragging = false;
    canvas.classList.remove("dragging");
  });

  canvas.addEventListener("click", function (e) {
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    var hit = engine.hitTest(mx, my);
    if (hit >= 0) {
      engine.selectedIndex = hit;
      showDetail(hit);
    } else {
      engine.selectedIndex = -1;
      detailPanel.classList.add("hidden");
    }
    render();
  });

  document.getElementById("close-detail").addEventListener("click", function () {
    engine.selectedIndex = -1;
    detailPanel.classList.add("hidden");
    render();
  });

  function showDetail(idx) {
    var p = engine.points[idx];
    detailTitle.textContent = p.label || "Point " + idx;
    var html = "";
    var skip = { label: 1, color: 1, priority: 1 };
    var keyMap = { x: engine.axisTitle.x, y: engine.axisTitle.y };
    for (var key in p) {
      if (skip[key]) continue;
      var displayKey = keyMap[key] || key;
      var val = (typeof p[key] === "number") ? p[key].toFixed(2) : p[key];
      html += '<div class="field"><span class="field-key">' + escHtml(displayKey) +
              ':</span> ' + escHtml(String(val)) + '</div>';
    }
    detailBody.innerHTML = html;
    detailPanel.classList.remove("hidden");
  }

  function escHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ── Wheel zoom ─────────────────────────────────────────────── */
  canvas.addEventListener("wheel", function (e) {
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    var factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    engine.zoomAt(mx, my, factor);
    updateZoomDisplay();
    render();
  }, { passive: false });

  /* ── Touch support (pinch zoom + pan) ───────────────────────── */
  var touches = {};
  var lastPinchDist = 0;

  canvas.addEventListener("touchstart", function (e) {
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      touches[t.identifier] = { x: t.clientX, y: t.clientY };
    }
    if (Object.keys(touches).length === 2) {
      var pts = Object.values(touches);
      lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  }, { passive: false });

  canvas.addEventListener("touchmove", function (e) {
    e.preventDefault();
    var ids = Object.keys(touches);
    if (ids.length === 1) {
      var t = e.changedTouches[0];
      var prev = touches[t.identifier];
      if (prev) {
        engine.pan(t.clientX - prev.x, t.clientY - prev.y);
        touches[t.identifier] = { x: t.clientX, y: t.clientY };
        render();
      }
    } else if (ids.length === 2) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var ct = e.changedTouches[i];
        touches[ct.identifier] = { x: ct.clientX, y: ct.clientY };
      }
      var pts = Object.values(touches);
      var dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (lastPinchDist > 0) {
        var cx = (pts[0].x + pts[1].x) / 2;
        var cy = (pts[0].y + pts[1].y) / 2;
        var rect = canvas.getBoundingClientRect();
        engine.zoomAt(cx - rect.left, cy - rect.top, dist / lastPinchDist);
        updateZoomDisplay();
        render();
      }
      lastPinchDist = dist;
    }
  }, { passive: false });

  canvas.addEventListener("touchend", function (e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      delete touches[e.changedTouches[i].identifier];
    }
    lastPinchDist = 0;
  });

  /* ── Keyboard shortcuts ─────────────────────────────────────── */
  document.addEventListener("keydown", function (e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (e.key === "+" || e.key === "=") {
      engine.zoomAt(engine.W / 2, engine.H / 2, 1.3);
      updateZoomDisplay(); render();
    } else if (e.key === "-") {
      engine.zoomAt(engine.W / 2, engine.H / 2, 1 / 1.3);
      updateZoomDisplay(); render();
    } else if (e.key === "0") {
      engine.fitAll(); updateZoomDisplay(); render();
    } else if (e.key === "Escape") {
      engine.selectedIndex = -1;
      detailPanel.classList.add("hidden");
      render();
    } else if (e.key === "/" || e.key === "f" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  /* ── Resize handling ────────────────────────────────────────── */
  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      engine.resize();
      render();
    }, 80);
  });

  /* ── Render loop (on-demand, not continuous) ────────────────── */
  var rafPending = false;
  function render() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () {
      rafPending = false;
      engine.draw();
    });
  }

  /* ── Init ────────────────────────────────────────────────────── */
  engine.resize();
  loadDemoData();
  updateZoomDisplay();

})();
