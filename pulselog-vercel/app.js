const storageKey = "pulselog-state-v1";
const refreshIntervals = {
  live: 60 * 1000,
  active: 2 * 60 * 1000,
  idle: 5 * 60 * 1000,
};

const defaultState = {
  category: "all",
  sources: [
    {
      id: uid(),
      title: "NBA 官方新闻",
      url: "https://www.nba.com/news",
      category: "basketball",
    },
    {
      id: uid(),
      title: "HLTV CS2 赛事",
      url: "https://www.hltv.org/",
      category: "cs",
    },
    {
      id: uid(),
      title: "Financial Times Markets",
      url: "https://www.ft.com/markets",
      category: "economy",
    },
    {
      id: uid(),
      title: "Reuters World",
      url: "https://www.reuters.com/world/",
      category: "politics",
    },
  ],
  savedNews: [],
  weightEntries: seedWeights(),
  achievements: [
    {
      id: uid(),
      date: today(),
      title: "搭建自己的信息与成长系统",
      note: "从一个能持续使用的小工具开始。",
    },
  ],
  goals: [
    {
      id: uid(),
      title: "连续记录 14 天体重和每日成就",
      deadline: addDays(14),
      area: "健康",
      progress: 35,
      done: false,
    },
  ],
};

let state = loadState();
let liveState = {
  scores: [],
  csMatches: [],
  headlines: [],
};
let refreshTimer = null;
let countdownTimer = null;
let nextRefreshAt = 0;
let isRefreshing = false;

const newsTemplates = [
  {
    id: "nba",
    category: "basketball",
    title: "篮球：跟踪 NBA 赛程、伤病、交易和球队动态",
    summary: "适合每天早上快速扫一遍比赛结果、球员状态和球队新闻。",
    query: "NBA latest news scores injuries trades",
    source: "https://www.nba.com/news",
  },
  {
    id: "espn-nba",
    category: "basketball",
    title: "篮球：ESPN NBA 专区",
    summary: "聚合赛后分析、排名变化、球员故事和联盟趋势。",
    query: "ESPN NBA latest news",
    source: "https://www.espn.com/nba/",
  },
  {
    id: "hltv",
    category: "cs",
    title: "CS：HLTV 赛事与队伍新闻",
    summary: "关注 CS2 赛事日程、排名、战队阵容变化和赛后数据。",
    query: "HLTV CS2 latest matches rankings",
    source: "https://www.hltv.org/",
  },
  {
    id: "liquipedia",
    category: "cs",
    title: "CS：Liquipedia 赛事日历",
    summary: "适合查比赛时间、赛制、参赛队伍和历史战绩。",
    query: "Liquipedia Counter-Strike tournaments",
    source: "https://liquipedia.net/counterstrike/Main_Page",
  },
  {
    id: "macro",
    category: "economy",
    title: "经济：宏观指标与市场变化",
    summary: "跟踪通胀、利率、就业、汇率和主要市场波动。",
    query: "global economy inflation interest rates latest news",
    source: "https://www.reuters.com/markets/",
  },
  {
    id: "policy",
    category: "politics",
    title: "政治：国际关系与政策新闻",
    summary: "关注政府政策、选举、地缘政治和监管变化。",
    query: "world politics policy latest news",
    source: "https://www.reuters.com/world/",
  },
];

const categoryNames = {
  all: "全部",
  basketball: "篮球",
  cs: "CS",
  economy: "经济",
  politics: "政治",
};

const els = {
  date: document.querySelector("#current-date"),
  summary: document.querySelector("#today-summary"),
  navItems: document.querySelectorAll(".nav-item"),
  views: document.querySelectorAll(".view"),
  newsSearch: document.querySelector("#news-search"),
  categoryButtons: document.querySelectorAll(".segment-button"),
  refreshLive: document.querySelector("#refresh-live"),
  liveUpdated: document.querySelector("#live-updated"),
  refreshCountdown: document.querySelector("#refresh-countdown"),
  overviewNba: document.querySelector("#overview-nba"),
  overviewCs: document.querySelector("#overview-cs"),
  overviewNews: document.querySelector("#overview-news"),
  overviewGrowth: document.querySelector("#overview-growth"),
  topInsight: document.querySelector("#top-insight"),
  marketInsight: document.querySelector("#market-insight"),
  personalInsight: document.querySelector("#personal-insight"),
  refreshMode: document.querySelector("#refresh-mode"),
  tickerList: document.querySelector("#ticker-list"),
  viewJumps: document.querySelectorAll("[data-view-jump]"),
  scoreList: document.querySelector("#score-list"),
  csList: document.querySelector("#cs-list"),
  headlineList: document.querySelector("#headline-list"),
  newsList: document.querySelector("#news-list"),
  sourceForm: document.querySelector("#source-form"),
  sourceTitle: document.querySelector("#source-title"),
  sourceUrl: document.querySelector("#source-url"),
  sourceCategory: document.querySelector("#source-category"),
  sourceList: document.querySelector("#source-list"),
  weightForm: document.querySelector("#weight-form"),
  weightDate: document.querySelector("#weight-date"),
  weightValue: document.querySelector("#weight-value"),
  weightChart: document.querySelector("#weight-chart"),
  latestWeight: document.querySelector("#latest-weight"),
  weightCount: document.querySelector("#weight-count"),
  weightDelta: document.querySelector("#weight-delta"),
  achievementForm: document.querySelector("#achievement-form"),
  achievementTitle: document.querySelector("#achievement-title"),
  achievementNote: document.querySelector("#achievement-note"),
  achievementList: document.querySelector("#achievement-list"),
  goalForm: document.querySelector("#goal-form"),
  goalTitle: document.querySelector("#goal-title"),
  goalDeadline: document.querySelector("#goal-deadline"),
  goalArea: document.querySelector("#goal-area"),
  goalList: document.querySelector("#goal-list"),
  goalSummary: document.querySelector("#goal-summary"),
  reset: document.querySelector("#reset-demo"),
};

init();

function init() {
  els.date.textContent = new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "full",
  }).format(new Date());
  els.weightDate.value = today();
  els.goalDeadline.value = addDays(30);
  bindEvents();
  render();
  refreshLiveDashboard({ reason: "initial" });
  startAutoRefresh();
}

function bindEvents() {
  els.navItems.forEach((item) => {
    item.addEventListener("click", () => switchView(item.dataset.view));
  });

  els.categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.category = button.dataset.category;
      saveState();
      renderNews();
    });
  });

  els.newsSearch.addEventListener("input", renderNews);

  els.refreshLive.addEventListener("click", () => refreshLiveDashboard({ reason: "manual" }));

  els.viewJumps.forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.viewJump));
  });

  document.querySelector("#add-source").addEventListener("click", () => {
    els.sourceTitle.focus();
  });

  els.sourceForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.sources.unshift({
      id: uid(),
      title: els.sourceTitle.value.trim(),
      url: els.sourceUrl.value.trim(),
      category: els.sourceCategory.value,
    });
    els.sourceForm.reset();
    saveAndRender();
  });

  els.weightForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.weightEntries.push({
      id: uid(),
      date: els.weightDate.value,
      value: Number(els.weightValue.value),
    });
    els.weightValue.value = "";
    saveAndRender();
  });

  els.achievementForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.achievements.unshift({
      id: uid(),
      date: today(),
      title: els.achievementTitle.value.trim(),
      note: els.achievementNote.value.trim(),
    });
    els.achievementForm.reset();
    saveAndRender();
  });

  els.goalForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.goals.unshift({
      id: uid(),
      title: els.goalTitle.value.trim(),
      deadline: els.goalDeadline.value,
      area: els.goalArea.value,
      progress: 0,
      done: false,
    });
    els.goalTitle.value = "";
    saveAndRender();
  });

  els.reset.addEventListener("click", () => {
    if (!confirm("确定清空这个浏览器里的 PulseLog 数据吗？")) return;
    removeStoredState();
    state = cloneDefaultState();
    saveAndRender();
  });

  window.addEventListener("resize", drawWeightChart);
}

function switchView(view) {
  els.navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  els.views.forEach((section) => section.classList.toggle("active", section.id === `${view}-view`));
  if (view === "growth") drawWeightChart();
}

function render() {
  renderNews();
  renderSources();
  renderGrowth();
  renderAchievements();
  renderGoals();
  renderSummary();
  renderTicker();
}

async function refreshLiveDashboard(options = {}) {
  if (isRefreshing) return;
  isRefreshing = true;
  els.refreshLive.disabled = true;
  els.refreshLive.textContent = "刷新中";
  els.liveUpdated.textContent = "正在读取公开数据源";
  renderLoadingCards();

  try {
    const results = await Promise.allSettled([loadNbaScores(), loadCsMatches(), loadImportantNews()]);
    const scores = results[0].status === "fulfilled" ? results[0].value : [];
    const csMatches = results[1].status === "fulfilled" ? results[1].value : [];
    const headlines = results[2].status === "fulfilled" ? results[2].value : [];
    liveState = { scores, csMatches, headlines };

    renderScores(scores);
    renderCsMatches(csMatches);
    renderHeadlines(headlines);
    renderOverview(scores, csMatches, headlines);
    renderSmartInsights(scores, csMatches, headlines);
    renderTicker(scores, csMatches, headlines);

    els.liveUpdated.textContent = `更新于 ${new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date())}`;
  } finally {
    els.refreshLive.disabled = false;
    els.refreshLive.textContent = "刷新";
    isRefreshing = false;
    scheduleNextRefresh(getRefreshInterval());
  }
}

function startAutoRefresh() {
  scheduleNextRefresh(getRefreshInterval());
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(updateRefreshCountdown, 1000);
  updateRefreshCountdown();
}

function getRefreshInterval() {
  const hasLiveGame =
    liveState.scores.some((game) => game.state === "in") ||
    liveState.csMatches.some((match) => match.status === "live");
  const hasUpcomingSoon =
    liveState.scores.some((game) => game.state === "pre" && isWithinHours(game.date, 4)) ||
    liveState.csMatches.some((match) => match.status === "upcoming" && isWithinHours(match.time, 4));

  if (hasLiveGame) {
    els.refreshMode.textContent = "直播模式 · 60秒";
    return refreshIntervals.live;
  }

  if (hasUpcomingSoon) {
    els.refreshMode.textContent = "临近比赛 · 2分钟";
    return refreshIntervals.active;
  }

  els.refreshMode.textContent = "常规刷新 · 5分钟";
  return refreshIntervals.idle;
}

function scheduleNextRefresh(delay) {
  if (refreshTimer) clearTimeout(refreshTimer);
  nextRefreshAt = Date.now() + delay;
  refreshTimer = setTimeout(() => refreshLiveDashboard({ reason: "auto" }), delay);
  updateRefreshCountdown();
}

function updateRefreshCountdown() {
  if (!nextRefreshAt) {
    els.refreshCountdown.textContent = "自动刷新未启动";
    return;
  }

  const remaining = Math.max(0, nextRefreshAt - Date.now());
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  els.refreshCountdown.textContent = `下次刷新 ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function renderOverview(
  scores = liveState.scores,
  csMatches = liveState.csMatches,
  headlines = liveState.headlines,
) {
  const finishedGames = scores.filter((game) => game.state === "post").length;
  const liveGames = scores.filter((game) => game.state === "in").length;
  const upcomingGames = scores.filter((game) => game.state === "pre").length;
  const liveCs = csMatches.filter((match) => match.status === "live").length;
  const upcomingCs = csMatches.filter((match) => match.status === "upcoming").length;
  const finishedCs = csMatches.filter((match) => match.status === "finished").length;
  const weights = getSortedWeights();
  const latestWeight = weights[weights.length - 1];
  const todayWins = state.achievements.filter((item) => item.date === today()).length;
  const activeGoals = state.goals.filter((goal) => !goal.done).length;

  if (scores.length) {
    els.overviewNba.textContent =
      liveGames > 0
        ? `${liveGames} 场进行中`
        : finishedGames > 0
          ? `${finishedGames} 场已结束`
          : `${upcomingGames || scores.length} 场待开始`;
  } else {
    els.overviewNba.textContent = "暂无今日比分";
  }

  if (csMatches.length) {
    els.overviewCs.textContent =
      liveCs > 0
        ? `${liveCs} 场进行中`
        : finishedCs > 0
          ? `${finishedCs} 场有比分`
          : `${upcomingCs || csMatches.length} 场将进行`;
  } else {
    els.overviewCs.textContent = "等待比赛数据";
  }
  els.overviewNews.textContent = headlines.length ? `${headlines.length} 条重点新闻` : "新闻源待刷新";
  els.overviewGrowth.textContent = latestWeight
    ? `${latestWeight.value.toFixed(1)}kg · ${todayWins} 条成就 · ${activeGoals} 个目标`
    : `${todayWins} 条成就 · ${activeGoals} 个目标`;
}

function renderSmartInsights(scores = liveState.scores, csMatches = liveState.csMatches, headlines = liveState.headlines) {
  const liveNba = scores.find((game) => game.state === "in");
  const nextNba = scores.find((game) => game.state === "pre");
  const nextCs = csMatches.find((match) => match.status === "upcoming");
  const liveCs = csMatches.find((match) => match.status === "live");
  const todayWins = state.achievements.filter((item) => item.date === today()).length;
  const activeGoals = state.goals.filter((goal) => !goal.done);
  const importantHeadline = headlines[0];

  if (liveNba) {
    els.topInsight.textContent = `NBA 正在进行：${liveNba.title}，可以先看比分走势。`;
  } else if (liveCs) {
    els.topInsight.textContent = `CS 正在进行：${liveCs.title}，适合优先跟进。`;
  } else if (nextCs) {
    els.topInsight.textContent = `下一场重点 CS：${nextCs.title}，${formatDateTime(nextCs.time)}。`;
  } else if (nextNba) {
    els.topInsight.textContent = `下一场 NBA：${nextNba.title}，${formatDateTime(nextNba.date)}。`;
  } else {
    els.topInsight.textContent = "暂无进行中的比赛，先浏览重要新闻和个人目标。";
  }

  els.marketInsight.textContent = importantHeadline
    ? `${importantHeadline.source}：${importantHeadline.title}`
    : "新闻源未返回重点内容，可从 Reuters / FT 入口深入浏览。";

  els.personalInsight.textContent = activeGoals.length
    ? `今日已记录 ${todayWins} 条成就；当前优先推进「${activeGoals[0].title}」。`
    : `今日已记录 ${todayWins} 条成就；目标清单已经全部完成。`;
}

function renderTicker(scores = liveState.scores, csMatches = liveState.csMatches, headlines = liveState.headlines) {
  const items = [];
  const nowLabel = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  scores
    .filter((game) => game.state === "in")
    .slice(0, 4)
    .forEach((game) => {
      items.push({
        time: nowLabel,
        html: `NBA 进行中：<a href="${escapeAttribute(game.url)}" target="_blank" rel="noreferrer">${escapeHtml(game.title)}</a>，${escapeHtml(game.away)} ${escapeHtml(game.awayScore)} - ${escapeHtml(game.homeScore)} ${escapeHtml(game.home)}，${escapeHtml(game.detail || "实时比分更新中")}。`,
      });
    });

  csMatches
    .filter((match) => match.status === "live")
    .slice(0, 4)
    .forEach((match) => {
      items.push({
        time: nowLabel,
        html: `CS 进行中：<a href="${escapeAttribute(match.url)}" target="_blank" rel="noreferrer">${escapeHtml(match.title)}</a>，${escapeHtml(match.format || "TBD")}，${escapeHtml(match.event || "赛事详情")}。`,
      });
    });

  [...scores]
    .filter((game) => game.state === "pre")
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 2)
    .forEach((game) => {
      items.push({
        time: formatClock(game.date),
        html: `NBA 即将开始：<a href="${escapeAttribute(game.url)}" target="_blank" rel="noreferrer">${escapeHtml(game.title)}</a>。`,
      });
    });

  [...csMatches]
    .filter((match) => match.status === "upcoming")
    .sort((a, b) => new Date(a.time || 0) - new Date(b.time || 0))
    .slice(0, 3)
    .forEach((match) => {
      items.push({
        time: match.time ? formatClock(match.time) : "待定",
        html: `CS 将进行：<a href="${escapeAttribute(match.url)}" target="_blank" rel="noreferrer">${escapeHtml(match.title)}</a>，${escapeHtml(match.format || "TBD")}，${escapeHtml(match.event || "赛事详情")}。`,
      });
    });

  headlines.slice(0, 3).forEach((headline) => {
    items.push({
      time: formatGdeltTime(headline.time),
      html: `重要新闻：<a href="${escapeAttribute(headline.url)}" target="_blank" rel="noreferrer">${escapeHtml(headline.title)}</a> <span>${escapeHtml(headline.source)}</span>`,
    });
  });

  const todayWins = state.achievements.filter((item) => item.date === today()).length;
  const activeGoals = state.goals.filter((goal) => !goal.done);
  items.push({
    time: nowLabel,
    html: `个人进度：今天记录 ${todayWins} 条成就，${activeGoals.length} 个目标进行中${activeGoals[0] ? `，优先项是「${escapeHtml(activeGoals[0].title)}」` : ""}。`,
  });

  els.tickerList.innerHTML = items
    .slice(0, 10)
    .map(
      (item) => `
        <div class="ticker-item">
          <div class="ticker-time">${escapeHtml(item.time)}</div>
          <div class="ticker-copy">${item.html}</div>
        </div>
      `,
    )
    .join("");
}

function renderLoadingCards() {
  const loading = '<div class="live-item"><p>正在加载...</p></div>';
  els.scoreList.innerHTML = loading;
  els.csList.innerHTML = loading;
  els.headlineList.innerHTML = loading;
  els.tickerList.innerHTML = '<div class="ticker-item"><div class="ticker-time">LIVE</div><div class="ticker-copy">正在同步比赛、新闻和个人进度。</div></div>';
}

async function loadNbaScores() {
  try {
    const apiData = await fetchJson("/api/nba-scores");
    if (apiData.scores) return apiData.scores;
  } catch {
    // Local file previews fall back to ESPN directly.
  }

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

async function loadImportantNews() {
  try {
    const apiData = await fetchJson("/api/headlines");
    if (apiData.headlines) return apiData.headlines;
  } catch {
    // Local file previews fall back to GDELT directly.
  }

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

async function loadCsMatches() {
  if (location.protocol.startsWith("http")) {
    try {
      const data = await fetchJson("/api/cs-matches");
      if (data.matches && data.matches.length) return data.matches;
    } catch {
      // Fall through to the browser-only Liquipedia proxy path.
    }
  }

  const sourceUrl = "https://liquipedia.net/counterstrike/Liquipedia:Matches";
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(sourceUrl)}`;
  const html = await fetchText(proxyUrl);
  return parseLiquipediaMatches(html).slice(0, 10);
}

function renderScores(scores) {
  if (!scores.length) {
    els.scoreList.innerHTML = `
      <div class="live-item">
        <a href="https://www.espn.com/nba/scoreboard" target="_blank" rel="noreferrer">打开 ESPN NBA 今日比分</a>
        <p>暂时没有读取到今日 NBA 比赛，可能是休赛日、赛程未开始，或公开接口被浏览器拦截。</p>
      </div>
    `;
    return;
  }

  els.scoreList.innerHTML = scores
    .map((game) => {
      const isFinal = game.state === "post";
      const isLive = game.state === "in";
      const when = isLive || isFinal ? game.detail : formatDateTime(game.date);
      return `
        <article class="live-item">
          <a href="${escapeAttribute(game.url)}" target="_blank" rel="noreferrer">${escapeHtml(game.title)}</a>
          <div class="score-line">
            <span>${escapeHtml(game.away)} ${escapeHtml(game.awayScore)}</span>
            <strong>${escapeHtml(game.homeScore)} ${escapeHtml(game.home)}</strong>
          </div>
          <div class="live-meta">
            <span>${isFinal ? "已结束" : isLive ? "进行中" : "未开始"}</span>
            <span>${escapeHtml(when)}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderCsMatches(matches) {
  if (!matches.length) {
    const dateText = new Intl.DateTimeFormat("zh-CN", {
      month: "short",
      day: "numeric",
    }).format(new Date());
    const items = [
      {
        title: "打开 HLTV 今日 CS2 比赛",
        url: "https://www.hltv.org/matches",
        summary: "自动读取失败时可用这个入口查看今日对阵、比分和赛后数据。",
      },
      {
        title: "Liquipedia 正在进行的 CS 赛事",
        url: "https://liquipedia.net/counterstrike/Main_Page",
        summary: "适合查赛制、参赛队伍、赛程表和赛事奖金。",
      },
      {
        title: `搜索 ${dateText} CS2 赛事结果`,
        url: `https://www.google.com/search?q=${encodeURIComponent("CS2 matches today results HLTV")}`,
        summary: "直接搜索今日结果、集锦和重要战队新闻。",
      },
    ];

    els.csList.innerHTML = items
      .map(
        (item) => `
          <article class="live-item">
            <a href="${escapeAttribute(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a>
            <p>${escapeHtml(item.summary)}</p>
          </article>
        `,
      )
      .join("");
    return;
  }

  els.csList.innerHTML = matches
    .slice(0, 8)
    .map((match) => {
      const statusText =
        match.status === "live" ? "进行中" : match.status === "finished" ? "有比分" : "将进行";
      const timeText = match.time ? formatDateTime(match.time) : match.displayTime || "时间待定";
      const scoreText = match.score ? `<strong>${escapeHtml(match.score)}</strong>` : "";
      return `
        <article class="live-item">
          <a href="${escapeAttribute(match.url)}" target="_blank" rel="noreferrer">${escapeHtml(match.title)}</a>
          <div class="score-line">
            <span>${escapeHtml(match.teams && match.teams[0] ? match.teams[0] : "TBD")}</span>
            ${scoreText || "<strong>vs</strong>"}
            <span>${escapeHtml(match.teams && match.teams[1] ? match.teams[1] : "TBD")}</span>
          </div>
          <div class="live-meta">
            <span>${statusText}</span>
            <span>${escapeHtml(timeText)}</span>
            <span>${escapeHtml(match.format || "TBD")}</span>
            <span>${escapeHtml(match.event || "HLTV")}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderHeadlines(headlines) {
  if (!headlines.length) {
    els.headlineList.innerHTML = `
      <div class="live-item">
        <a href="https://www.reuters.com/world/" target="_blank" rel="noreferrer">打开 Reuters 世界新闻</a>
        <p>暂时没有读取到新闻流，可能是网络或跨域限制。你仍然可以从这里进入可靠新闻源。</p>
      </div>
      <div class="live-item">
        <a href="https://www.reuters.com/markets/" target="_blank" rel="noreferrer">打开 Reuters 市场新闻</a>
        <p>查看经济、市场、政策和宏观变化。</p>
      </div>
    `;
    return;
  }

  els.headlineList.innerHTML = headlines
    .map(
      (item) => `
        <article class="live-item">
          <a href="${escapeAttribute(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a>
          <p>${escapeHtml(item.summary)}</p>
          <div class="live-meta">
            <span>${escapeHtml(item.source)}</span>
            <span>${escapeHtml(formatGdeltTime(item.time))}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseLiquipediaMatches(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const matches = [...doc.querySelectorAll(".match-info")]
    .map((block, index) => {
      const teams = [...block.querySelectorAll(".name")]
        .map((node) => node.textContent.trim())
        .filter(Boolean)
        .slice(0, 2);
      if (teams.length < 2) return null;

      const scoreOrVs = textOf(block, ".match-info-header-scoreholder-upper");
      const format = textOf(block, ".match-info-header-scoreholder-lower").replace(/[()]/g, "");
      const timer = block.querySelector(".timer-object");
      const unix = timer ? Number(timer.dataset.timestamp || 0) : 0;
      const time = unix ? new Date(unix * 1000).toISOString() : "";
      const tournament = block.querySelector(".match-info-tournament-name a");
      const event = textOf(block, ".match-info-tournament-name") || "Liquipedia match";
      const score = scoreOrVs && scoreOrVs.toLowerCase() !== "vs" ? scoreOrVs : "";
      const staleUnscoredMatch = !score && unix && unix * 1000 < Date.now() - 6 * 60 * 60 * 1000;
      if (staleUnscoredMatch) return null;

      return {
        id: `${teams.join("-")}-${unix || index}`,
        title: `${teams[0]} vs ${teams[1]}`,
        url: tournament
          ? new URL(tournament.getAttribute("href"), "https://liquipedia.net").href
          : "https://liquipedia.net/counterstrike/Liquipedia:Matches",
        teams,
        event,
        format: format || "TBD",
        score,
        time,
        displayTime: timer ? timer.textContent.trim() : "",
        status: score ? "finished" : "upcoming",
        importance: getCsImportance(teams, event),
      };
    })
    .filter(Boolean);

  return matches.sort((a, b) => {
    if (a.status !== b.status) return csStatusRank(a.status) - csStatusRank(b.status);
    return b.importance - a.importance || (a.time || "").localeCompare(b.time || "");
  });
}

function textOf(root, selector) {
  const node = root.querySelector(selector);
  return node ? node.textContent.trim().replace(/\s+/g, " ") : "";
}

function getCsImportance(teams, event = "") {
  const tierTeams = [
    "Vitality",
    "NAVI",
    "Natus Vincere",
    "Spirit",
    "MOUZ",
    "FaZe",
    "G2",
    "Falcons",
    "MongolZ",
    "FURIA",
    "Astralis",
    "Liquid",
    "Virtus.pro",
    "VP",
    "MIBR",
  ];
  const teamScore = teams.reduce(
    (score, team) => score + (tierTeams.some((name) => team.includes(name)) ? 2 : 0),
    0,
  );
  const eventScore = /major|iem|blast|esl|pgl|epl|masters|championship/i.test(event) ? 2 : 0;
  return teamScore + eventScore;
}

function csStatusRank(status) {
  if (status === "live") return 0;
  if (status === "upcoming") return 1;
  return 2;
}

function renderNews() {
  els.categoryButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.category === state.category);
  });

  const term = els.newsSearch.value.trim().toLowerCase();
  const cards = newsTemplates
    .filter((item) => state.category === "all" || item.category === state.category)
    .filter((item) => `${item.title} ${item.summary}`.toLowerCase().includes(term));

  if (!cards.length) {
    els.newsList.innerHTML = '<div class="empty-state">没有匹配的资讯入口。</div>';
    return;
  }

  els.newsList.innerHTML = cards
    .map((item) => {
      const saved = state.savedNews.includes(item.id);
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(item.query)}`;
      return `
        <article class="news-card">
          <div class="tag-row">
            <span class="tag">${categoryNames[item.category]}</span>
            ${saved ? '<span class="tag">已收藏</span>' : ""}
          </div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.summary)}</p>
          <div class="tag-row">
            <a href="${item.source}" target="_blank" rel="noreferrer">打开来源</a>
            <a href="${searchUrl}" target="_blank" rel="noreferrer">搜索最新</a>
            <button class="small-button" data-save-news="${item.id}" type="button">${saved ? "取消收藏" : "收藏"}</button>
          </div>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll("[data-save-news]").forEach((button) => {
    button.addEventListener("click", () => toggleSavedNews(button.dataset.saveNews));
  });
}

function renderSources() {
  els.sourceList.innerHTML = state.sources
    .map(
      (source) => `
        <article class="source-item">
          <strong>${escapeHtml(source.title)}</strong>
          <p class="eyebrow">${categoryNames[source.category]}</p>
          <a href="${escapeAttribute(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(shortUrl(source.url))}</a>
          <div class="goal-actions">
            <button class="small-button" data-open-search="${source.id}" type="button">查最新</button>
            <button class="danger-button" data-delete-source="${source.id}" type="button">删除</button>
          </div>
        </article>
      `,
    )
    .join("");

  document.querySelectorAll("[data-delete-source]").forEach((button) => {
    button.addEventListener("click", () => {
      state.sources = state.sources.filter((source) => source.id !== button.dataset.deleteSource);
      saveAndRender();
    });
  });

  document.querySelectorAll("[data-open-search]").forEach((button) => {
    button.addEventListener("click", () => {
      const source = state.sources.find((item) => item.id === button.dataset.openSearch);
      window.open(`https://www.google.com/search?q=${encodeURIComponent(`${source.title} latest news`)}`, "_blank");
    });
  });
}

function renderGrowth() {
  const sorted = getSortedWeights();
  const latest = sorted[sorted.length - 1];
  els.latestWeight.textContent = latest ? `${latest.value.toFixed(1)} kg` : "--";
  els.weightCount.textContent = sorted.length;
  if (sorted.length >= 2) {
    const delta = latest.value - sorted[0].value;
    els.weightDelta.textContent = `${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg`;
    els.weightDelta.style.color = delta <= 0 ? "var(--good)" : "var(--warn)";
  } else {
    els.weightDelta.textContent = "--";
  }
  drawWeightChart();
  renderOverview();
}

function renderAchievements() {
  if (!state.achievements.length) {
    els.achievementList.innerHTML = '<div class="empty-state">今天先写下一件做成的小事。</div>';
    return;
  }

  els.achievementList.innerHTML = state.achievements
    .slice(0, 12)
    .map(
      (item) => `
        <article class="timeline-item">
          <time>${formatDate(item.date)}</time>
          <h3>${escapeHtml(item.title)}</h3>
          ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ""}
          <button class="danger-button" data-delete-achievement="${item.id}" type="button">删除</button>
        </article>
      `,
    )
    .join("");

  document.querySelectorAll("[data-delete-achievement]").forEach((button) => {
    button.addEventListener("click", () => {
      state.achievements = state.achievements.filter((item) => item.id !== button.dataset.deleteAchievement);
      saveAndRender();
    });
  });
}

function renderGoals() {
  if (!state.goals.length) {
    els.goalSummary.textContent = "0 个目标";
    els.goalList.innerHTML = '<div class="empty-state">创建一个接下来真正想完成的目标。</div>';
    return;
  }

  const activeCount = state.goals.filter((goal) => !goal.done).length;
  const completedCount = state.goals.length - activeCount;
  const averageProgress = Math.round(
    state.goals.reduce((total, goal) => total + goal.progress, 0) / state.goals.length,
  );
  els.goalSummary.textContent = `${activeCount} 进行中 · ${completedCount} 已完成 · 平均 ${averageProgress}%`;

  els.goalList.innerHTML = state.goals
    .map(
      (goal) => `
        <article class="goal-card">
          <small>${escapeHtml(goal.area)} · 截止 ${formatDate(goal.deadline)}</small>
          <h3>${escapeHtml(goal.title)}</h3>
          <div class="goal-meta">
            <span>${goal.done ? "已完成" : "进行中"}</span>
            <strong>${goal.progress}%</strong>
          </div>
          <div class="progress" aria-label="目标进度">
            <span style="--progress: ${goal.progress}%"></span>
          </div>
          <div class="goal-actions">
            <button class="small-button" data-goal-progress="${goal.id}" data-delta="-10" type="button">-10%</button>
            <button class="small-button" data-goal-progress="${goal.id}" data-delta="10" type="button">+10%</button>
            <button class="small-button" data-goal-done="${goal.id}" type="button">完成</button>
            <button class="danger-button" data-delete-goal="${goal.id}" type="button">删除</button>
          </div>
        </article>
      `,
    )
    .join("");

  document.querySelectorAll("[data-goal-progress]").forEach((button) => {
    button.addEventListener("click", () => {
      const goal = state.goals.find((item) => item.id === button.dataset.goalProgress);
      goal.progress = clamp(goal.progress + Number(button.dataset.delta), 0, 100);
      goal.done = goal.progress === 100;
      saveAndRender();
    });
  });

  document.querySelectorAll("[data-goal-done]").forEach((button) => {
    button.addEventListener("click", () => {
      const goal = state.goals.find((item) => item.id === button.dataset.goalDone);
      goal.progress = 100;
      goal.done = true;
      saveAndRender();
    });
  });

  document.querySelectorAll("[data-delete-goal]").forEach((button) => {
    button.addEventListener("click", () => {
      state.goals = state.goals.filter((item) => item.id !== button.dataset.deleteGoal);
      saveAndRender();
    });
  });
}

function renderSummary() {
  const todayWins = state.achievements.filter((item) => item.date === today()).length;
  const activeGoals = state.goals.filter((goal) => !goal.done).length;
  els.summary.textContent = `今天已有 ${todayWins} 条成就，${activeGoals} 个目标正在推进。`;
  renderOverview();
  renderSmartInsights();
}

function drawWeightChart() {
  const canvas = els.weightChart;
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const entries = [...state.weightEntries].sort((a, b) => a.date.localeCompare(b.date)).slice(-12);
  ctx.fillStyle = "#65717a";
  ctx.font = "14px Inter, sans-serif";

  if (entries.length < 2) {
    ctx.fillText("至少记录两次体重后会显示趋势线。", 22, 36);
    return;
  }

  const padding = { top: 24, right: 24, bottom: 42, left: 46 };
  const values = entries.map((entry) => entry.value);
  const min = Math.floor(Math.min(...values) - 1);
  const max = Math.ceil(Math.max(...values) + 1);
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  ctx.strokeStyle = "#dfe6e8";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    const label = max - ((max - min) / 4) * i;
    ctx.fillStyle = "#65717a";
    ctx.fillText(label.toFixed(0), 10, y + 4);
  }

  const points = entries.map((entry, index) => {
    const x = padding.left + (chartW / (entries.length - 1)) * index;
    const y = padding.top + chartH - ((entry.value - min) / (max - min)) * chartH;
    return { ...entry, x, y };
  });

  ctx.strokeStyle = "#0d7f78";
  ctx.lineWidth = 3;
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  points.forEach((point) => {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#0d7f78";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  const first = points[0];
  const last = points[points.length - 1];
  ctx.fillStyle = "#182025";
  ctx.font = "700 13px Inter, sans-serif";
  ctx.fillText(`${first.value.toFixed(1)}kg`, first.x - 16, first.y - 14);
  ctx.fillText(`${last.value.toFixed(1)}kg`, last.x - 24, last.y - 14);
}

function getSortedWeights() {
  return [...state.weightEntries].sort((a, b) => a.date.localeCompare(b.date));
}

function toggleSavedNews(id) {
  if (state.savedNews.includes(id)) {
    state.savedNews = state.savedNews.filter((item) => item !== id);
  } else {
    state.savedNews.push(id);
  }
  saveState();
  renderNews();
}

function saveAndRender() {
  saveState();
  render();
}

function loadState() {
  const raw = getStoredState();
  if (!raw) return cloneDefaultState();
  try {
    return Object.assign(cloneDefaultState(), JSON.parse(raw));
  } catch {
    return cloneDefaultState();
  }
}

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState));
}

function saveState() {
  setStoredState(JSON.stringify(state));
}

function getStoredState() {
  try {
    return window.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function setStoredState(value) {
  try {
    window.localStorage.setItem(storageKey, value);
  } catch {
    // Some embedded previews block localStorage. The page still works in memory.
  }
}

function removeStoredState() {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore storage restrictions in preview environments.
  }
}

function seedWeights() {
  return [
    { id: uid(), date: addDays(-6), value: 74.8 },
    { id: uid(), date: addDays(-4), value: 74.2 },
    { id: uid(), date: addDays(-2), value: 73.9 },
    { id: uid(), date: today(), value: 73.6 },
  ];
}

function uid() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function formatDateTime(value) {
  if (!value) return "时间待定";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatClock(value) {
  if (!value) return "待定";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isWithinHours(value, hours) {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  const diff = time - Date.now();
  return diff > 0 && diff <= hours * 60 * 60 * 1000;
}

function formatGdeltTime(value) {
  if (!value || value.length < 8) return "最新";
  const year = value.slice(0, 4);
  const month = value.slice(4, 6);
  const day = value.slice(6, 8);
  const hour = value.slice(9, 11) || "00";
  const minute = value.slice(11, 13) || "00";
  return `${month}-${day} ${hour}:${minute}`;
}

function shortUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
