/**
 * Minimal HTTPS dev server for testing the PowerPoint add-in locally.
 *
 * Usage:
 *   1. Generate a self-signed cert:
 *        openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"
 *   2. node serve.js
 *   3. Sideload manifest.xml into PowerPoint (Insert → My Add-ins → Upload).
 *
 * The server serves the repo root so both /webapp/* and /powerpoint-addin/* are accessible.
 */
var https = require("https");
var fs    = require("fs");
var path  = require("path");

var PORT = 3000;
var ROOT = path.resolve(__dirname, "..");

var MIME = {
  ".html": "text/html",
  ".css":  "text/css",
  ".js":   "application/javascript",
  ".json": "application/json",
  ".png":  "image/png",
  ".svg":  "image/svg+xml",
  ".csv":  "text/csv",
  ".xml":  "application/xml",
};

// Check for certs; fall back to HTTP if not found
var useHTTPS = fs.existsSync(path.join(__dirname, "key.pem")) &&
               fs.existsSync(path.join(__dirname, "cert.pem"));

function handler(req, res) {
  var urlPath = req.url.split("?")[0];
  if (urlPath === "/") urlPath = "/webapp/index.html";

  var filePath = path.join(ROOT, urlPath);
  var ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found: " + urlPath);
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(data);
  });
}

if (useHTTPS) {
  var opts = {
    key:  fs.readFileSync(path.join(__dirname, "key.pem")),
    cert: fs.readFileSync(path.join(__dirname, "cert.pem")),
  };
  https.createServer(opts, handler).listen(PORT, function () {
    console.log("HTTPS server running at https://localhost:" + PORT);
    console.log("  Webapp:   https://localhost:" + PORT + "/webapp/index.html");
    console.log("  Taskpane: https://localhost:" + PORT + "/powerpoint-addin/taskpane.html");
  });
} else {
  var http = require("http");
  http.createServer(handler).listen(PORT, function () {
    console.log("HTTP server running at http://localhost:" + PORT);
    console.log("  Webapp:   http://localhost:" + PORT + "/webapp/index.html");
    console.log("  (Generate key.pem + cert.pem for HTTPS, required by Office add-ins)");
  });
}
