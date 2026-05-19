module.exports = async function handler(request, response) {
  try {
    const data = await fetchJson("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard");
    const scores = (data.events || []).slice(0, 8).map((event) => {
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

    sendJson(response, { scores });
  } catch (error) {
    sendJson(response, { scores: [], error: error.message }, 502);
  }
};

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const result = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "PulseLog personal dashboard/1.0",
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
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
  response.status(status).json(data);
}
