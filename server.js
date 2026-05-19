const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = process.env.PORT || 5173;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

http
  .createServer(async (request, response) => {
    const requestPath = decodeURIComponent(new URL(request.url, `http://localhost:${port}`).pathname);

    if (requestPath === "/api/cs-matches") {
      try {
        const matches = await loadCsMatches();
        sendJson(response, { matches });
      } catch (error) {
        sendJson(response, { matches: [], error: error.message }, 502);
      }
      return;
    }

    if (requestPath === "/api/nba-scores") {
      try {
        const scores = await loadNbaScores();
        sendJson(response, { scores });
      } catch (error) {
        sendJson(response, { scores: [], error: error.message }, 502);
      }
      return;
    }

    if (requestPath === "/api/headlines") {
      try {
        const headlines = await loadHeadlines();
        sendJson(response, { headlines });
      } catch (error) {
        sendJson(response, { headlines: [], error: error.message }, 502);
      }
      return;
    }

    const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(root, safePath === "/" ? "index.html" : safePath);

    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, content) => {
      if (error) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      response.writeHead(200, {
        "Content-Type": types[path.extname(filePath)] || "application/octet-stream",
      });
      response.end(content);
    });
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`PulseLog is running at http://127.0.0.1:${port}/`);
  });

async function loadCsMatches() {
  const liquipediaHtml = await fetchText("https://liquipedia.net/counterstrike/Liquipedia:Matches");
  const liquipediaMatches = parseLiquipediaMatches(liquipediaHtml);
  if (liquipediaMatches.length) return liquipediaMatches.slice(0, 10);

  for (const url of ["https://www.hltv.org/matches?predefinedFilter=top_tier", "https://www.hltv.org/matches"]) {
    const html = await fetchText(url, "hltv");
    const matches = parseHltvMatches(html);
    if (matches.length) return matches.slice(0, 10);
  }

  return [];
}

async function loadNbaScores() {
  const data = await fetchJson("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard");
  return (data.events || []).slice(0, 8).map((event) => {
    const competition = event.competitions && event.competitions[0];
    const competitors = competition ? competition.competitors || [] : [];
    const away = competitors.find((team) => team.homeAway === "away") || competitors[0] || {};
    const home = competitors.find((team) => team.homeAway === "home") || competitors[1] || {};
    const status = competition && competition.status ? competition.status.type : event.status.type;
    const detail = competition && competition.status ? competition.status.type.detail : event.status.type.detail;

    return {
      id: event.id,
      title: event.name,
      url: event.links && event.links[0] ? event.links[0].href : "https://www.espn.com/nba/scoreboard",
      state: status.state,
      detail,
      date: event.date,
      away: away.team ? away.team.abbreviation : "客队",
      home: home.team ? home.team.abbreviation : "主队",
      awayScore: away.score || "0",
      homeScore: home.score || "0",
    };
  });
}

async function loadHeadlines() {
  const query = encodeURIComponent("(NBA OR CS2 OR economy OR market OR inflation OR election OR policy OR geopolitics)");
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=ArtList&format=json&maxrecords=8&sort=hybridrel&timespan=24h`;
  const data = await fetchJson(url);
  const articles = data.articles || data.items || [];
  return articles.slice(0, 6).map((article) => ({
    title: article.title,
    url: article.url || article.link,
    source: article.domain || article.source || "news",
    time: article.seendate || article.date_published,
    summary: article.sourcecountry ? `来源地区：${article.sourcecountry}` : "全球新闻索引",
  }));
}

function parseLiquipediaMatches(html) {
  const matches = [];
  const blockPattern = /<div class="match-info">([\s\S]*?)(?=<div class="match-info">|<div class="toggle-area-content"|$)/g;
  let match;

  while ((match = blockPattern.exec(html)) !== null) {
    const block = match[1];
    const teams = extractAll(block, /<span class="name"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/span>/g).slice(0, 2);
    if (teams.length < 2) continue;

    const scoreOrVs = extractOne(block, /class="match-info-header-scoreholder-upper"[^>]*>([\s\S]*?)<\/span>/);
    const format = extractOne(block, /class="match-info-header-scoreholder-lower"[^>]*>\(?([\s\S]*?)\)?<\/span>/);
    const unix = extractOne(block, /data-timestamp="(\d+)"/);
    const time = unix ? new Date(Number(unix) * 1000).toISOString() : "";
    const event = extractOne(block, /class="match-info-tournament-name"[\s\S]*?<span>([\s\S]*?)<\/span>/);
    const eventHref = extractOne(block, /class="match-info-tournament-name"[\s\S]*?<a href="([^"]+)"/);
    const score = scoreOrVs && scoreOrVs.toLowerCase() !== "vs" ? scoreOrVs : "";
    const status = score ? "finished" : "upcoming";
    const matchTime = unix ? Number(unix) * 1000 : 0;
    const staleUnscoredMatch = !score && matchTime && matchTime < Date.now() - 6 * 60 * 60 * 1000;
    if (staleUnscoredMatch) continue;

    matches.push({
      id: `${teams.join("-")}-${unix || matches.length}`,
      title: `${teams[0]} vs ${teams[1]}`,
      url: eventHref ? `https://liquipedia.net${eventHref.replace(/&amp;/g, "&")}` : "https://liquipedia.net/counterstrike/Liquipedia:Matches",
      teams,
      event: event || "Liquipedia match",
      format: format || "TBD",
      score,
      time,
      displayTime: extractOne(block, /class="timer-object"[^>]*>([\s\S]*?)<\/span>/),
      status,
      importance: getCsImportance(teams, event),
    });
  }

  return matches.sort((a, b) => {
    if (a.status !== b.status) return statusRank(a.status) - statusRank(b.status);
    return b.importance - a.importance || (a.time || "").localeCompare(b.time || "");
  });
}

function getCsImportance(teams, event = "") {
  const tierTeams = [
    "Vitality",
    "Natus Vincere",
    "NAVI",
    "Spirit",
    "MOUZ",
    "FaZe",
    "G2",
    "Falcons",
    "The MongolZ",
    "FURIA",
    "Astralis",
    "Liquid",
    "Virtus.pro",
    "VP",
    "MIBR",
  ];
  const teamScore = teams.reduce((score, team) => score + (tierTeams.some((name) => team.includes(name)) ? 2 : 0), 0);
  const eventScore = /major|iem|blast|esl|pgl|epl|masters|championship/i.test(event) ? 2 : 0;
  return teamScore + eventScore;
}

function statusRank(status) {
  if (status === "live") return 0;
  if (status === "upcoming") return 1;
  return 2;
}

function parseHltvMatches(html) {
  const matches = [];
  const linkPattern = /<a[^>]+class="[^"]*match[^"]*a-reset[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const block = match[2];
    const teams = unique([
      ...extractAll(block, /class="[^"]*match-teamname[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/g),
      ...extractAll(block, /class="[^"]*team[^"]*"[^>]*>\s*<[^>]+>\s*([\s\S]*?)\s*<\/[^>]+>/g),
    ]).filter((team) => team && team.toLowerCase() !== "tbd");

    const title = teams.length >= 2 ? `${teams[0]} vs ${teams[1]}` : cleanText(block).slice(0, 80);
    if (!title || matches.some((item) => item.url.endsWith(match[1]))) continue;

    const unix = extractOne(block, /data-unix="(\d+)"/);
    const time = unix ? new Date(Number(unix)).toISOString() : "";
    const displayTime = extractOne(block, /class="[^"]*match-time[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/);
    const event = extractOne(block, /class="[^"]*match-event-name[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/);
    const format = extractOne(block, /class="[^"]*match-meta[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/);
    const score = extractOne(block, /class="[^"]*match-score[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/);
    const stars = (block.match(/match-star-icon/g) || []).length;
    const live = /live|进行中/i.test(cleanText(block));

    matches.push({
      id: match[1].split("/")[2] || match[1],
      title,
      url: `https://www.hltv.org${match[1]}`,
      teams: teams.slice(0, 2),
      event: event || "HLTV match",
      format: format || "TBD",
      score,
      time,
      displayTime,
      status: live ? "live" : score ? "finished" : "upcoming",
      importance: Math.max(stars, teams.length >= 2 ? 1 : 0),
    });
  }

  return matches
    .filter((item) => item.title && item.url)
    .sort((a, b) => b.importance - a.importance || (a.time || "").localeCompare(b.time || ""));
}

function extractAll(value, pattern) {
  const items = [];
  let match;
  while ((match = pattern.exec(value)) !== null) items.push(cleanText(match[1]));
  return items;
}

function extractOne(value, pattern) {
  const match = value.match(pattern);
  return match ? cleanText(match[1]) : "";
}

function cleanText(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function unique(items) {
  return [...new Set(items)];
}

function fetchText(url, source = "liquipedia") {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          "User-Agent": source === "liquipedia"
            ? "PulseLog personal local dashboard/1.0 (contact: local-user)"
            : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
      },
      (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`${source} returned HTTP ${response.statusCode}`));
          response.resume();
          return;
        }

        let data = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => resolve(data));
      },
    );

    request.setTimeout(9000, () => {
      request.destroy(new Error("HLTV request timed out"));
    });
    request.on("error", reject);
  });
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const result = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "PulseLog personal local dashboard/1.0",
        Accept: "application/json",
      },
    });
    if (!result.ok) throw new Error(`HTTP ${result.status}`);
    return await result.json();
  } finally {
    clearTimeout(timeout);
  }
}

function sendJson(response, data, status = 200) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(data));
}
