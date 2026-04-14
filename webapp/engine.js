/**
 * ScatterEngine — canvas-based rendering engine for a large virtual coordinate plane.
 *
 * The world is defined in data coordinates. A camera (offsetX, offsetY, zoom)
 * maps world coords to screen pixels. Pan/zoom only change the camera — the
 * underlying coordinate plane stays fixed.
 */

"use strict";

/* ================================================================
   ScatterEngine constructor
   ================================================================ */
function ScatterEngine(canvas) {
  this.canvas = canvas;
  this.ctx = canvas.getContext("2d");

  // Camera state (world units)
  this.cam = { x: 0, y: 0, zoom: 1 };

  // Data bounds (computed from points)
  this.worldMinX = 0;  this.worldMaxX = 100;
  this.worldMinY = 0;  this.worldMaxY = 100;

  // Margins in pixels for axis area
  this.margin = { top: 30, right: 30, bottom: 50, left: 60 };

  // Datasets
  this.points = [];          // {x, y, label, region, ...extra}
  this.regions = [];         // {xMin, xMax, yMin, yMax, color, label}
  this.axisTitle = { x: "X Axis", y: "Y Axis" };

  // Interaction state
  this.hoveredIndex = -1;
  this.selectedIndex = -1;
  this.searchTerm = "";
  this.activeRegion = "__all__";
  this.searchMatches = new Set();

  // Label visibility — priority 1 = always visible, higher = needs more zoom
  this.labelZoomThresholds = [0, 0.4, 0.8, 1.5, 3.0];

  // Caches
  this._labelRects = [];

  this.resize();
}

/* ================================================================
   Sizing
   ================================================================ */
ScatterEngine.prototype.resize = function () {
  var dpr = window.devicePixelRatio || 1;
  var rect = this.canvas.getBoundingClientRect();
  this.canvas.width = rect.width * dpr;
  this.canvas.height = rect.height * dpr;
  this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  this.W = rect.width;
  this.H = rect.height;
};

/* ================================================================
   Coordinate transforms
   ================================================================ */
ScatterEngine.prototype.plotW = function () {
  return this.W - this.margin.left - this.margin.right;
};
ScatterEngine.prototype.plotH = function () {
  return this.H - this.margin.top - this.margin.bottom;
};

/** World x → screen px */
ScatterEngine.prototype.wx = function (dataX) {
  var rangeW = this.worldMaxX - this.worldMinX || 1;
  var norm = (dataX - this.worldMinX) / rangeW;             // 0-1
  var worldPx = norm * this.plotW();                         // pixel in plot space
  return this.margin.left + (worldPx - this.cam.x) * this.cam.zoom;
};

/** World y → screen px  (y-axis points up in data, down on screen) */
ScatterEngine.prototype.wy = function (dataY) {
  var rangeH = this.worldMaxY - this.worldMinY || 1;
  var norm = (dataY - this.worldMinY) / rangeH;
  var worldPy = (1 - norm) * this.plotH();                  // flip
  return this.margin.top + (worldPy - this.cam.y) * this.cam.zoom;
};

/** Screen px → world x */
ScatterEngine.prototype.sx = function (screenX) {
  var plotPx = (screenX - this.margin.left) / this.cam.zoom + this.cam.x;
  var norm = plotPx / this.plotW();
  return this.worldMinX + norm * (this.worldMaxX - this.worldMinX);
};

/** Screen px → world y */
ScatterEngine.prototype.sy = function (screenY) {
  var plotPy = (screenY - this.margin.top) / this.cam.zoom + this.cam.y;
  var norm = plotPy / this.plotH();
  return this.worldMaxY - norm * (this.worldMaxY - this.worldMinY);
};

/* ================================================================
   Data loading helpers
   ================================================================ */
ScatterEngine.prototype.setPoints = function (arr) {
  this.points = arr;
  this._computeBounds();
};

ScatterEngine.prototype._computeBounds = function () {
  if (this.points.length === 0) return;
  var xs = this.points.map(function (p) { return p.x; });
  var ys = this.points.map(function (p) { return p.y; });
  var minX = Math.min.apply(null, xs);
  var maxX = Math.max.apply(null, xs);
  var minY = Math.min.apply(null, ys);
  var maxY = Math.max.apply(null, ys);
  // add 5% padding
  var padX = (maxX - minX) * 0.05 || 1;
  var padY = (maxY - minY) * 0.05 || 1;
  this.worldMinX = minX - padX;
  this.worldMaxX = maxX + padX;
  this.worldMinY = minY - padY;
  this.worldMaxY = maxY + padY;
};

ScatterEngine.prototype.setRegions = function (arr) {
  this.regions = arr;
};

/* ================================================================
   Camera helpers
   ================================================================ */
ScatterEngine.prototype.resetCamera = function () {
  this.cam.x = 0;
  this.cam.y = 0;
  this.cam.zoom = 1;
};

ScatterEngine.prototype.zoomAt = function (screenX, screenY, factor) {
  // Convert screen point to world-pixel offset before zoom
  var wx = (screenX - this.margin.left) / this.cam.zoom + this.cam.x;
  var wy = (screenY - this.margin.top) / this.cam.zoom + this.cam.y;

  var newZoom = Math.max(0.1, Math.min(50, this.cam.zoom * factor));
  this.cam.x = wx - (screenX - this.margin.left) / newZoom;
  this.cam.y = wy - (screenY - this.margin.top) / newZoom;
  this.cam.zoom = newZoom;
};

ScatterEngine.prototype.pan = function (dx, dy) {
  this.cam.x -= dx / this.cam.zoom;
  this.cam.y -= dy / this.cam.zoom;
};

ScatterEngine.prototype.fitAll = function () {
  this.resetCamera();
};

/* ================================================================
   Hit testing — find the point nearest to screen coords
   ================================================================ */
ScatterEngine.prototype.hitTest = function (mx, my, radius) {
  radius = radius || 12;
  var bestDist = Infinity;
  var bestIdx = -1;
  for (var i = 0; i < this.points.length; i++) {
    if (!this._isVisible(i)) continue;
    var px = this.wx(this.points[i].x);
    var py = this.wy(this.points[i].y);
    var d = Math.hypot(mx - px, my - py);
    if (d < radius && d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
};

ScatterEngine.prototype._isVisible = function (i) {
  var p = this.points[i];
  if (this.activeRegion !== "__all__" && p.region !== this.activeRegion) return false;
  if (this.searchTerm && !this.searchMatches.has(i)) return false;
  return true;
};

/* ================================================================
   Drawing
   ================================================================ */
ScatterEngine.prototype.draw = function () {
  var ctx = this.ctx;
  ctx.clearRect(0, 0, this.W, this.H);

  this._drawBackground();
  this._drawRegions();
  this._drawGrid();
  this._drawAxes();
  this._drawPoints();
  this._drawLabels();
  this._drawAxisTitles();
};

/* ---------- background ---------- */
ScatterEngine.prototype._drawBackground = function () {
  var ctx = this.ctx;
  ctx.fillStyle = "#0f0f23";
  ctx.fillRect(this.margin.left, this.margin.top, this.plotW(), this.plotH());
};

/* ---------- shaded regions ---------- */
ScatterEngine.prototype._drawRegions = function () {
  var ctx = this.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.rect(this.margin.left, this.margin.top, this.plotW(), this.plotH());
  ctx.clip();

  for (var i = 0; i < this.regions.length; i++) {
    var r = this.regions[i];
    var x1 = this.wx(r.xMin);
    var y1 = this.wy(r.yMax);   // yMax → top on screen
    var x2 = this.wx(r.xMax);
    var y2 = this.wy(r.yMin);
    ctx.fillStyle = r.color || "rgba(100,150,255,0.08)";
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

    // region label
    if (r.label) {
      ctx.fillStyle = r.labelColor || "rgba(200,200,220,0.3)";
      var fontSize = Math.max(10, Math.min(18, 14 * this.cam.zoom));
      ctx.font = "600 " + fontSize + "px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(r.label, (x1 + x2) / 2, y1 + 6);
    }
  }
  ctx.restore();
};

/* ---------- grid lines ---------- */
ScatterEngine.prototype._drawGrid = function () {
  var ctx = this.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.rect(this.margin.left, this.margin.top, this.plotW(), this.plotH());
  ctx.clip();

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;

  var ticks;

  // Vertical grid
  ticks = this._niceTicks(this.worldMinX, this.worldMaxX, 10);
  for (var i = 0; i < ticks.length; i++) {
    var sx = this.wx(ticks[i]);
    if (sx < this.margin.left || sx > this.W - this.margin.right) continue;
    ctx.beginPath();
    ctx.moveTo(sx, this.margin.top);
    ctx.lineTo(sx, this.H - this.margin.bottom);
    ctx.stroke();
  }

  // Horizontal grid
  ticks = this._niceTicks(this.worldMinY, this.worldMaxY, 8);
  for (var j = 0; j < ticks.length; j++) {
    var sy = this.wy(ticks[j]);
    if (sy < this.margin.top || sy > this.H - this.margin.bottom) continue;
    ctx.beginPath();
    ctx.moveTo(this.margin.left, sy);
    ctx.lineTo(this.W - this.margin.right, sy);
    ctx.stroke();
  }

  ctx.restore();
};

/* ---------- axes and tick labels ---------- */
ScatterEngine.prototype._drawAxes = function () {
  var ctx = this.ctx;
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#b0b8c8";
  ctx.font = "11px -apple-system, sans-serif";

  // X axis ticks
  var xTicks = this._niceTicks(this.worldMinX, this.worldMaxX, 10);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (var i = 0; i < xTicks.length; i++) {
    var sx = this.wx(xTicks[i]);
    if (sx < this.margin.left - 5 || sx > this.W - this.margin.right + 5) continue;
    ctx.beginPath();
    ctx.moveTo(sx, this.H - this.margin.bottom);
    ctx.lineTo(sx, this.H - this.margin.bottom + 5);
    ctx.stroke();
    ctx.fillText(this._formatTick(xTicks[i]), sx, this.H - this.margin.bottom + 8);
  }

  // Y axis ticks
  var yTicks = this._niceTicks(this.worldMinY, this.worldMaxY, 8);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (var j = 0; j < yTicks.length; j++) {
    var sy = this.wy(yTicks[j]);
    if (sy < this.margin.top - 5 || sy > this.H - this.margin.bottom + 5) continue;
    ctx.beginPath();
    ctx.moveTo(this.margin.left - 5, sy);
    ctx.lineTo(this.margin.left, sy);
    ctx.stroke();
    ctx.fillText(this._formatTick(yTicks[j]), this.margin.left - 8, sy);
  }

  // Axis lines
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(this.margin.left, this.margin.top);
  ctx.lineTo(this.margin.left, this.H - this.margin.bottom);
  ctx.lineTo(this.W - this.margin.right, this.H - this.margin.bottom);
  ctx.stroke();
};

/* ---------- axis titles ---------- */
ScatterEngine.prototype._drawAxisTitles = function () {
  var ctx = this.ctx;
  ctx.fillStyle = "#d8dce6";
  ctx.font = "bold 13px -apple-system, sans-serif";

  // X title
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(this.axisTitle.x, this.margin.left + this.plotW() / 2, this.H - 4);

  // Y title (rotated)
  ctx.save();
  ctx.translate(14, this.margin.top + this.plotH() / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(this.axisTitle.y, 0, 0);
  ctx.restore();
};

/* ---------- points ---------- */
ScatterEngine.prototype._drawPoints = function () {
  var ctx = this.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.rect(this.margin.left, this.margin.top, this.plotW(), this.plotH());
  ctx.clip();

  var baseR = 5;
  var r = Math.max(2.5, Math.min(10, baseR * Math.sqrt(this.cam.zoom)));

  for (var i = 0; i < this.points.length; i++) {
    if (!this._isVisible(i)) continue;
    var p = this.points[i];
    var sx = this.wx(p.x);
    var sy = this.wy(p.y);

    // Skip points far off-screen
    if (sx < this.margin.left - 20 || sx > this.W - this.margin.right + 20) continue;
    if (sy < this.margin.top - 20 || sy > this.H - this.margin.bottom + 20) continue;

    var isHovered = (i === this.hoveredIndex);
    var isSelected = (i === this.selectedIndex);
    var isSearchMatch = this.searchTerm && this.searchMatches.has(i);

    // Draw point
    ctx.beginPath();
    ctx.arc(sx, sy, isHovered ? r * 1.5 : r, 0, Math.PI * 2);

    if (isSelected) {
      ctx.fillStyle = "#e74c3c";
      ctx.strokeStyle = "#c0392b";
      ctx.lineWidth = 2.5;
    } else if (isSearchMatch) {
      ctx.fillStyle = "#f39c12";
      ctx.strokeStyle = "#e67e22";
      ctx.lineWidth = 2;
    } else if (isHovered) {
      ctx.fillStyle = "#3498db";
      ctx.strokeStyle = "#2980b9";
      ctx.lineWidth = 2;
    } else {
      ctx.fillStyle = p.color || "#5b8def";
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 1.5;
    }
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
};

/* ---------- labels with collision avoidance and zoom-based visibility ---------- */
ScatterEngine.prototype._drawLabels = function () {
  var ctx = this.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.rect(this.margin.left, this.margin.top, this.plotW(), this.plotH());
  ctx.clip();

  ctx.font = "11px -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";

  var zoom = this.cam.zoom;
  this._labelRects = [];

  // Sort points: always show hovered/selected/search-matched first
  var order = [];
  for (var i = 0; i < this.points.length; i++) {
    if (!this._isVisible(i)) continue;
    order.push(i);
  }

  var self = this;
  order.sort(function (a, b) {
    var pa = self._labelPriority(a);
    var pb = self._labelPriority(b);
    return pa - pb;   // lower priority value → drawn first
  });

  for (var k = 0; k < order.length; k++) {
    var idx = order[k];
    var p = this.points[idx];
    if (!p.label) continue;

    var priority = p.priority || 3;
    // Skip labels that require more zoom than we currently have
    var threshold = this.labelZoomThresholds[Math.min(priority, this.labelZoomThresholds.length - 1)] || 0;
    var forceShow = (idx === this.hoveredIndex || idx === this.selectedIndex ||
                     (this.searchTerm && this.searchMatches.has(idx)));
    if (!forceShow && zoom < threshold) continue;

    var sx = this.wx(p.x);
    var sy = this.wy(p.y);
    if (sx < this.margin.left - 40 || sx > this.W - this.margin.right + 40) continue;
    if (sy < this.margin.top - 20 || sy > this.H - this.margin.bottom + 20) continue;

    var textW = ctx.measureText(p.label).width;
    var lx = sx + 8;
    var ly = sy - 4;
    var rect = { x: lx - 1, y: ly - 12, w: textW + 2, h: 14 };

    // Collision check (skip for force-shown)
    if (!forceShow && this._collides(rect)) continue;

    this._labelRects.push(rect);

    // Background pill
    ctx.fillStyle = "rgba(15,15,35,0.75)";
    ctx.beginPath();
    this._roundRect(ctx, rect.x - 2, rect.y - 1, rect.w + 4, rect.h + 2, 3);
    ctx.fill();

    // Text
    ctx.fillStyle = (idx === this.hoveredIndex) ? "#5dade2" :
                    (idx === this.selectedIndex) ? "#f1948a" :
                    (this.searchTerm && this.searchMatches.has(idx)) ? "#f5b041" : "#d0d4de";
    ctx.fillText(p.label, lx, ly);
  }
  ctx.restore();
};

ScatterEngine.prototype._labelPriority = function (idx) {
  if (idx === this.selectedIndex) return 0;
  if (idx === this.hoveredIndex) return 1;
  if (this.searchTerm && this.searchMatches.has(idx)) return 2;
  return (this.points[idx].priority || 3) + 3;
};

ScatterEngine.prototype._collides = function (r) {
  for (var i = 0; i < this._labelRects.length; i++) {
    var o = this._labelRects[i];
    if (r.x < o.x + o.w && r.x + r.w > o.x &&
        r.y < o.y + o.h && r.y + r.h > o.y) {
      return true;
    }
  }
  return false;
};

ScatterEngine.prototype._roundRect = function (ctx, x, y, w, h, rad) {
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
};

/* ================================================================
   Tick generation — "nice" numbers
   ================================================================ */
ScatterEngine.prototype._niceTicks = function (lo, hi, approxCount) {
  var range = hi - lo;
  if (range <= 0) return [lo];
  var roughStep = range / approxCount;
  var mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
  var residual = roughStep / mag;
  var niceStep;
  if (residual <= 1.5) niceStep = 1 * mag;
  else if (residual <= 3) niceStep = 2 * mag;
  else if (residual <= 7) niceStep = 5 * mag;
  else niceStep = 10 * mag;

  var ticks = [];
  var start = Math.ceil(lo / niceStep) * niceStep;
  for (var v = start; v <= hi; v += niceStep) {
    ticks.push(parseFloat(v.toPrecision(12)));
  }
  return ticks;
};

ScatterEngine.prototype._formatTick = function (v) {
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + "K";
  if (Number.isInteger(v)) return v.toString();
  return v.toFixed(2);
};
