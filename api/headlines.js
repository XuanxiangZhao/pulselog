module.exports = async function handler(request, response) {
  try {
    const query = encodeURIComponent("(NBA OR CS2 OR economy OR market OR inflation OR election OR policy OR geopolitics)");
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=ArtList&format=json&maxrecords=8&sort=hybridrel&timespan=24h`;
    const data = await fetchJson(url);
    const articles = data.articles || data.items || [];
    const headlines = articles.slice(0, 6).map((article) => ({
      title: article.title,
      url: article.url || article.link,
      source: article.domain || article.source || "news",
      time: article.seendate || article.date_published,
      summary: article.sourcecountry ? `来源地区：${article.sourcecountry}` : "全球新闻索引",
    }));

    sendJson(response, { headlines });
  } catch (error) {
    sendJson(response, { headlines: [], error: error.message }, 502);
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
  response.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=180");
  response.status(status).json(data);
}
