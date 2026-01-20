const { performance } = require("node:perf_hooks");
const { filesize } = require("filesize");
const ptt = require("parse-torrent-title");
const stringSimilarity = require("string-similarity");
const { url } = require("./env");
const { search: wsSearch } = require("./webshare");

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

const enhanceItem = (item, showInfo) => {
  // if there is parsed year of release for found stream, add it to comparison to have better sorting results
  const titleYear =
    showInfo.type === "movie" &&
    item.parsedTitle.year &&
    showInfo.year &&
    !ptt.parse(showInfo.originalName).year //if there is year in title, do not compare years e.g. Wonder Woman 1984 (2020)
      ? `${showInfo.year}`
      : "";
  const itemTitleYear =
    showInfo.type === "movie" &&
    item.parsedTitle.year &&
    showInfo.year &&
    !ptt.parse(showInfo.originalName).year //if there is year in title, do not compare years e.g. Wonder Woman 1984 (2020)
      ? `${item.parsedTitle.year}`
      : "";

  const cleanedItemTitle = cleanTitle(item.parsedTitle.title) + itemTitleYear;

  const title = showInfo.name && normalizeText(showInfo.name + titleYear);
  const titleSk = showInfo.nameSk && normalizeText(showInfo.nameSk + titleYear);
  const titleEn = showInfo.nameEn && normalizeText(showInfo.nameEn + titleYear);
  const titleOriginal =
    showInfo.originalName && normalizeText(showInfo.originalName + titleYear);

  return {
    ...item,
    titleYear,
    itemTitleYear,
    cleanedItemTitle,
    titles: { title, titleSk, titleEn, titleOriginal },
  };
};

const calculateMatchScores = (item) => {
  const cleanedItemName = cleanTitle(item.name);
  const { title, titleSk, titleEn, titleOriginal } = item.titles;

  const matchTitles = [
    title,
    titleOriginal,
    titleSk,
    titleEn,
    titleSk && titleOriginal && titleSk + "/" + titleOriginal,
    title && titleOriginal && title + "/" + titleOriginal,
    titleSk && titleEn && titleSk + "/" + titleEn,
    title && titleEn && title + "/" + titleEn,
    titleEn && titleOriginal && titleEn + "/" + titleOriginal,
    titleOriginal && titleEn && titleOriginal + "/" + titleEn,
  ].filter((q) => q);

  const titleMatch = stringSimilarity.findBestMatch(
    item.cleanedItemTitle,
    matchTitles,
  ).bestMatch.rating;

  const nameMatch = stringSimilarity.findBestMatch(cleanedItemName, matchTitles)
    .bestMatch.rating;

  return { titleMatch, nameMatch };
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
    titleYear: item.titleYear,
    itemTitleYear: item.itemTitleYear,
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
    titles: item.titles,
    parsedTitle: item.cleanedItemTitle,
    protected: item.protected,
  };
};

// Filter out items with low match score, exclude TV episodes when searching for movies, exclude
// protected files, and ensure series match the correct season/episode.
const shouldIncludeResult = (item, showInfo) => {
  if (item.protected) return false;
  if (!item.strongMatch && !item.weakMatch) return false;
  // Allow +/- 1 year tolerance for year comparison, as different databases (TMDB, CSFD, etc.)
  // may have different release years due to regional premiere differences
  if (
    item.itemTitleYear &&
    item.titleYear &&
    item.itemTitleYear != "" &&
    item.titleYear != ""
  ) {
    const yearDiff = Math.abs(
      parseInt(item.itemTitleYear, 10) - parseInt(item.titleYear, 10),
    );
    if (yearDiff > 1) return false;
  }

  // Exclude TV episodes when searching for movies
  if (
    showInfo.type == "movie" &&
    item.SeasonEpisode &&
    !["episode", "part"].some((keyword) => {
      return (
        item.behaviorHints.filename.toLowerCase().includes(keyword) &&
        Object.values(item.titles).some((title) => title?.includes(keyword))
      );
    })
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

// Main orchestration function - searches for streams matching showInfo
const searchStreams = async (showInfo, token) => {
  const queries = getQueries(showInfo);

  // Get all results from different queries
  const searchStartMs = performance.now();
  let results = await Promise.all(
    queries.map((query) => wsSearch(query, token)),
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
      const enhanced = enhanceItem(item, showInfo);
      const matchScores = calculateMatchScores(enhanced);
      return mapToStream(enhanced, matchScores, token);
    })
    .filter((item) => shouldIncludeResult(item, showInfo))
    .sort(compareStreams)
    .slice(0, 100);
};

module.exports = {
  searchStreams,
  // Export for testing
  compareStreams,
};
