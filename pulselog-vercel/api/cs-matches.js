module.exports = async function handler(request, response) {
  try {
    const html = await fetchText("https://liquipedia.net/counterstrike/Liquipedia:Matches");
    const matches = parseLiquipediaMatches(html).slice(0, 10);
    sendJson(response, { matches });
  } catch (error) {
    sendJson(response, { matches: [], error: error.message }, 502);
  }
};

function parseLiquipediaMatches(html) {
  const matches = [];
  const blockPattern = /<div class="match-info">([\s\S]*?)(?=<div class="match-info">|<div class="toggle-area-content"|$)/g;
  let match;

  while ((match = blockPattern.exec(html)) !== null) {
    const block = match[1];
    const teams = extractAll(block, /<span class="name"[^>]*>\s*(?:<a[^>]*>)?([\s\S]*?)(?:<\/a>)?\s*<\/span>/g)
      .filter((team) => team && team.toLowerCase() !== "tbd")
      .slice(0, 2);
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
      url: eventHref
        ? `https://liquipedia.net${eventHref.replace(/&amp;/g, "&")}`
        : "https://liquipedia.net/counterstrike/Liquipedia:Matches",
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
  return String(value)
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

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const result = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "PulseLog personal dashboard/1.0 (contact: local-user)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!result.ok) throw new Error(`HTTP ${result.status}`);
    return await result.text();
  } finally {
    clearTimeout(timeout);
  }
}

function sendJson(response, data, status = 200) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
  response.status(status).json(data);
}
