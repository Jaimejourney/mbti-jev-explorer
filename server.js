const http = require("http");
const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");

const PORT = Number(process.env.PORT || 8767);
const API_KEY = process.env.TYPESAFE_API_KEY || readLocalApiKey();
const UPSTREAM = "https://api.typesafe.ai/v1/systemone";
const ROOT = __dirname;

function readLocalApiKey() {
  try {
    const env = fs.readFileSync(path.join(__dirname, ".env.local"), "utf8");
    const match = env.match(/^TYPESAFE_API_KEY=(.*)$/m);
    return match ? match[1].trim().replace(/^['"]|['"]$/g, "") : undefined;
  } catch {
    return undefined;
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".woff2": "font/woff2"
};

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function send(response, status, body, headers = {}) {
  response.writeHead(status, headers);
  response.end(body);
}

function sendJson(response, status, body) {
  send(response, status, JSON.stringify(body), {
    "Content-Type": "application/json; charset=utf-8"
  });
}

async function serveStatic(request, response, pathname) {
  const relative = pathname === "/" ? "/mbti-jev-explorer.html" : pathname;
  const file = path.join(ROOT, path.normalize(relative).replace(/^(\.\.[/\\])+/, ""));

  if (!file.startsWith(ROOT)) {
    return send(response, 403, "Forbidden");
  }

  try {
    const data = await fsPromises.readFile(file);
    return send(response, 200, data, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream"
    });
  } catch {
    return send(response, 404, "Not found");
  }
}

async function proxy(request, response) {
  if (!API_KEY) {
    return sendJson(response, 500, {
      detail: {
        error_type: "configuration_error",
        message: "Missing TYPESAFE_API_KEY environment variable."
      }
    });
  }

  try {
    const body = await readBody(request);
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body
    });
    const text = await upstream.text();
    return send(response, upstream.status, text, {
      "Content-Type": "application/json; charset=utf-8"
    });
  } catch (error) {
    return sendJson(response, 502, {
      detail: {
        error_type: "proxy_error",
        message: error.message
      }
    });
  }
}

const server = http.createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);

  if (request.method === "POST" && pathname === "/api/systemone") {
    return proxy(request, response);
  }

  if (request.method === "GET" && pathname === "/healthz") {
    return sendJson(response, 200, { ok: true, apiKeyConfigured: Boolean(API_KEY) });
  }

  if (request.method === "GET") {
    return serveStatic(request, response, pathname);
  }

  return send(response, 405, "Method not allowed");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`MBTI JEV Explorer: http://127.0.0.1:${PORT}`);
});
