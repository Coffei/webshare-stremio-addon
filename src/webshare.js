const { performance } = require("node:perf_hooks");
const needle = require("needle");
const md5 = require("nano-md5");
const sha1 = require("sha1");
const formencode = require("form-urlencoded");
const { filesize } = require("filesize");
const ptt = require("parse-torrent-title");
const stringSimilarity = require("string-similarity");
const { extractSeasonEpisode, extractLanguage } = require("./filenameParser");
const { url } = require("./env");

const headers = {
  content_type: "application/x-www-form-urlencoded; charset=UTF-8",
  accept: "text/xml; charset=UTF-8",
};

const normalizeText = (text) =>
  text
    ?.trim()
    ?.toLowerCase()
    .normalize("NFD") // "pelíšky" → "pelisky\u0301"
    .replace(/[\u0300-\u036f]/g, ""); // "pelisky\u0301" → "pelisky"

const getQueries = (info) => {
  const names = Array.from(
    new Set(
      [info.name, info.nameSk, info.nameEn, info.originalName].filter((n) => n),
    ),
  );
  if (info.type == "series") {
    return names.flatMap((name) => {
      const series = info.series.padStart(2, "0");
      const episode = info.episode.padStart(2, "0");
      return [`${name} S${series}E${episode}`, `${name} ${series}x${episode}`];
    });
  } else {
    // add queries with the release year appended, helps to find relevant files for movies with generic name like Mother (tt1216496) or Soul (tt2948372)
    names.push(...names.map((name) => name + " " + info.year));
    return names;
  }
};

const cleanTitle = (text) => {
  return normalizeText(
    text
      ?.replace(/subtitles/gi, "")
      ?.replace(/titulky/gi, "")
      ?.replace(/[^\p{L}\p{N}\s]/gu, " ") //remove special chars but keep accented letters like áíéř
      ?.replace(/[_]/g, " "),
  );
};

const calculateMatchScores = (item, queries, showInfo) => {
  //if there is parsed year of release for found stream, add it to comparison to have better sorting results
  const titleYear =
    showInfo.type === "movie" &&
    item.parsedTitle.year &&
    showInfo.year &&
    !ptt.parse(queries[0]).year
      ? `${showInfo.year}`
      : ""; //if there is year in title, do not compare years e.g. Wonder Woman 1984 (2020)
  const queryTitleYear =
    showInfo.type === "movie" &&
    item.parsedTitle.year &&
    showInfo.year &&
    !ptt.parse(queries[0]).year
      ? `${item.parsedTitle.year}`
      : "";

  const cleanedTitle = cleanTitle(item.parsedTitle.title) + titleYear;
  const cleanedName = cleanTitle(item.name);

  const queryTitle = normalizeText(
    showInfo.type == "series"
      ? queries[0]?.split(" ").slice(0, -1).join(" ")
      : queries[0] + queryTitleYear,
  );

  const queryTitleSk = normalizeText(
    showInfo.type == "series"
      ? queries[1]?.split(" ").slice(0, -1).join(" ")
      : queries[1] + queryTitleYear,
  );

  const queryTitleOriginal = normalizeText(
    showInfo.type == "series"
      ? queries[2]?.split(" ").slice(0, -1).join(" ")
      : queries[2] + queryTitleYear,
  );

  const matchQueries = [
    queryTitle,
    queryTitleOriginal,
    queryTitleSk,
    queryTitleSk &&
      queryTitleOriginal &&
      queryTitleSk + "/" + queryTitleOriginal,
    queryTitle && queryTitleOriginal && queryTitle + "/" + queryTitleOriginal,
  ].filter((q) => q);

  const titleMatch = stringSimilarity.findBestMatch(cleanedTitle, matchQueries)
    .bestMatch.rating;

  const nameMatch = stringSimilarity.findBestMatch(cleanedName, matchQueries)
    .bestMatch.rating;

  return {
    titleYear,
    queryTitleYear,
    cleanedTitle,
    titleMatch,
    nameMatch,
    queries: [queryTitle, queryTitleOriginal, queryTitleSk],
  };
};

const mapToStream = (item, matchScores, token) => {
  // This threshold has best results, it filters out the most irrelevant streams.
  const strongMatch = matchScores.titleMatch > 0.5;
  // Round to the precision of 1 decimal point, creating buckets for sorting purposes. We don't want
  // this artificial number to be the only factor in sorting, so we create buckets with items of
  // similar match quality.
  const fulltextMatch = Math.round(matchScores.nameMatch * 10) / 10;
  // This allows other lower quality results, useful for titles where parse-torrent-title parses the
  // title incorrectly.
  const weakMatch = matchScores.nameMatch > 0.3;

  return {
    ident: item.ident,
    titleYear: matchScores.titleYear,
    queryTitleYear: matchScores.queryTitleYear,
    url: url + "getUrl/" + item.ident + "?token=" + token,
    description:
      item.name +
      (item.language ? `\n🌐 ${item.language}` : "") +
      `\n👍 ${item.posVotes} 👎 ${item.negVotes}` +
      `\n💾 ${filesize(item.size)}`,
    match: matchScores.titleMatch,
    strongMatch,
    fulltextMatch,
    weakMatch,
    SeasonEpisode: item.SeasonEpisode,
    posVotes: item.posVotes,
    // Add a check-mark if we get a strong match based on the parsed filename.
    name: `Webshare${strongMatch ? " ✅" : ""} ${item.parsedTitle.resolution || ""}`,
    behaviorHints: {
      bingeGroup:
        "WebshareStremio|" +
        item.language +
        "|" +
        item.parsedTitle.resolution +
        "|" +
        item.parsedTitle.source,
      videoSize: item.size,
      filename: item.name,
    },
    queries: matchScores.queries,
    parsedTitle: matchScores.cleanedTitle,
    protected: item.protected,
  };
};

// Filter out items with low match score, exclude TV episodes when searching for movies, exclude
// protected files, and ensure series match the correct season/episode.
const shouldIncludeResult = (item, showInfo) => {
  if (item.protected) return false;
  if (!item.strongMatch && !item.weakMatch) return false;
  if (item.queryTitleYear != item.titleYear) return false;

  // Exclude TV episodes when searching for movies
  if (
    showInfo.type == "movie" &&
    item.SeasonEpisode &&
    !item.name.toLowerCase().includes("part")
  ) {
    return false;
  }

  // For series, keep only streams with correct season and episode
  if (
    showInfo.type == "series" &&
    (item.SeasonEpisode?.season != showInfo.series ||
      item.SeasonEpisode?.episode != showInfo.episode)
  ) {
    return false;
  }

  return true;
};

const compareStreams = (a, b) => {
  if (a.strongMatch && b.strongMatch) {
    // Compare strong matches by match, positive votes and size. Do not use `fulltextMatch` since we
    // know `match` should provide a better metric here. Using both `match` and `fulltextMatch`
    // leads ot the fact that other criteria are basically ignored.
    if (a.match != b.match) return b.match - a.match;
    if (a.posVotes != b.posVotes) return b.posVotes - a.posVotes;
    return b.behaviorHints.videoSize - a.behaviorHints.videoSize;
  } else if (!a.strongMatch && !b.strongMatch) {
    // Compare weak matches by match, fulltextMatch, positive votes and size. Note that `match`
    // below is the strong-threshold but still is the primary indicator of quality.
    if (a.match != b.match) return b.match - a.match;
    if (a.fulltextMatch != b.fulltextMatch)
      return b.fulltextMatch - a.fulltextMatch;
    if (a.posVotes != b.posVotes) return b.posVotes - a.posVotes;
    return b.behaviorHints.videoSize - a.behaviorHints.videoSize;
  } else {
    // One is strong and the other is not, compare by match since they definitely won't be the same.
    return b.match - a.match;
  }
};

const search = async (query, token) => {
  console.log("Searching", query);
  const data = formencode({
    what: query,
    category: "video",
    limit: 100,
    wst: token,
  });
  const resp = await needle("post", "https://webshare.cz/api/search/", data, {
    headers,
  });
  const files = resp.body.children.filter((el) => el.name == "file");

  return files.map((el) => {
    const ident = el.children.find((el) => el.name == "ident").value;
    const size = el.children.find((el) => el.name == "size").value;
    const posVotes = el.children.find(
      (el) => el.name == "positive_votes",
    ).value;
    const negVotes = el.children.find(
      (el) => el.name == "negative_votes",
    ).value;
    const name = el.children.find((el) => el.name == "name").value;
    const password = el.children.find((el) => el.name == "password");
    const img = el.children.find((el) => el.name == "img")?.value;
    return {
      ident,
      name,
      posVotes,
      negVotes,
      img,
      size: parseInt(size, 10),
      language: extractLanguage(name),
      parsedTitle: ptt.parse(name),
      SeasonEpisode: extractSeasonEpisode(name),
      protected: password && password.value == "1",
    };
  });
};

const webshare = {
  saltPassword: async (user, password) => {
    const saltResp = await needle(
      "https://webshare.cz/api/salt/",
      `username_or_email=${user}`,
      headers,
    );
    const salt = saltResp.body.children.find((el) => el.name == "salt").value;
    return sha1(md5.crypt(password, salt));
  },
  login: async (user, saltedPassword) => {
    console.log(`Logging in user ${user}`);
    const data = formencode({
      username_or_email: user,
      password: saltedPassword,
      keep_logged_in: 1,
    });
    const resp = await needle(
      "post",
      "https://webshare.cz/api/login/",
      data,
      headers,
    );
    if (
      resp.statusCode != 200 ||
      resp.body.children.find((el) => el.name == "status").value != "OK"
    ) {
      throw Error("Cannot log in to Webshare.cz, invalid login credentials");
    }
    return resp.body.children.find((el) => el.name == "token").value;
  },

  directSearch: async (query, token) => {
    return await search(query, token);
  },

  getById: async (id, token) => {
    await needle("https://webshare.cz/api/file_info");
    const data = formencode({ ident: id, wst: token });
    const resp = await needle(
      "post",
      "https://webshare.cz/api/file_info/",
      data,
      { headers },
    );
    const children = resp.body.children;

    const size = children.find((el) => el.name == "size").value;
    const posVotes = children.find((el) => el.name == "positive_votes").value;
    const negVotes = children.find((el) => el.name == "negative_votes").value;
    const filename = children.find((el) => el.name == "name").value;
    const desc = children.find((el) => el.name == "description").value;
    const password = children.find((el) => el.name == "password");
    const stripe = children.find((el) => el.name == "stripe")?.value;

    const lang = extractLanguage(filename);
    const parsedTitle = ptt.parse(filename);
    const { title, season, episode } = parsedTitle;
    const seasonEpisode =
      season != null && episode != null
        ? `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`
        : "";
    const name = `${title || filename} ${seasonEpisode}`;

    const description =
      filename +
      (lang ? `\n🌐 ${lang}` : "") +
      `\n👍 ${posVotes} 👎 ${negVotes}` +
      `\n💾 ${filesize(size)}` +
      `\n${desc}`;

    return {
      ident: id,
      name,
      filename,
      description,
      posVotes,
      negVotes,
      stripe,
      size: parseInt(size, 10),
      language: lang,
      parsedTitle,
      SeasonEpisode: extractSeasonEpisode(name),
      protected: password && password.value == "1",
    };
  },

  // improve movie query by adding year with movies
  // search localized names too
  // we could also combine multiple different queries to get better results
  search: async (showInfo, token) => {
    const queries = getQueries(showInfo);

    // Get all results from different queries
    const searchStartMs = performance.now();
    let results = await Promise.all(
      queries.map((query) => search(query, token)),
    );
    const searchDurationMs = Math.round(performance.now() - searchStartMs);
    console.log(`Executing all search queries: ${searchDurationMs}ms`);

    // Deduplicate results by ident
    results = Object.values(
      results.flat().reduce((acc, item) => {
        acc[item.ident] = item;
        return acc;
      }, {}),
    );

    return results
      .map((item) => {
        const matchScores = calculateMatchScores(item, queries, showInfo);
        return mapToStream(item, matchScores, token);
      })
      .filter((item) => shouldIncludeResult(item, showInfo))
      .sort(compareStreams)
      .slice(0, 100);
  },

  getUrl: async (ident, token) => {
    const data = formencode({
      ident,
      download_type: "video_stream",
      force_https: 1,
      wst: token,
    });
    const resp = await needle(
      "post",
      "https://webshare.cz/api/file_link/",
      data,
      { headers },
    );
    const status = resp?.body?.children?.find(
      (el) => el.name == "status",
    )?.value;
    if (status == "OK") {
      return resp?.body?.children?.find((el) => el.name == "link")?.value; //url
    } else {
      return null;
    }
  },
};
module.exports = webshare;
