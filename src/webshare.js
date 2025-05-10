const needle = require("needle");
const md5 = require("nano-md5");
const sha1 = require("sha1");
const formencode = require("form-urlencoded");
const { filesize } = require("filesize");
const ptt = require("parse-torrent-title");
const stringSimilarity = require("string-similarity");
const { extractSeasonEpisode, extractLanguage } = require("./RegExes");

const headers = { content_type: "application/x-www-form-urlencoded; charset=UTF-8", accept: "text/xml; charset=UTF-8" };

const getQueries = (info) => {
  const names = Array.from(new Set([info.name, info.nameSk, info.originalName].filter((n) => n)));
  if (info.type == "series") {
    return names.flatMap((name) => {
      const series = info.series.padStart(2, "0");
      const episode = info.episode.padStart(2, "0");
      return [`${name} S${series}E${episode}`, `${name} ${series}x${episode}`];
    });
  } else {
    return names;
  }
};

const search = async (query, token) => {
  console.log("Searching", query);
  const data = formencode({ what: query, category: "video", limit: 100, wst: token });
  const resp = await needle("post", "https://webshare.cz/api/search/", data, { headers });
  const files = resp.body.children.filter((el) => el.name == "file");

  return files.map((el) => {
    const ident = el.children.find((el) => el.name == "ident").value;
    const size = el.children.find((el) => el.name == "size").value;
    const posVotes = el.children.find((el) => el.name == "positive_votes").value;
    const negVotes = el.children.find((el) => el.name == "negative_votes").value;
    const name = el.children.find((el) => el.name == "name").value;
    const protected = el.children.find((el) => el.name == "password");
    return {
      ident,
      name,
      size,
      posVotes,
      negVotes,
      language: extractLanguage(name),
      parsedTitle: ptt.parse(name),
      SeasonEpisode: extractSeasonEpisode(name),
      protected: protected && protected.value == "1",
    };
  });
};

const webshare = {
  login: async (user, password) => {
    console.log(`Logging in user ${user}`);
    // get salt
    const saltResp = await needle("https://webshare.cz/api/salt/", `username_or_email=${user}`, headers);
    const salt = saltResp.body.children.find((el) => el.name == "salt").value;

    // login
    const passEncoded = sha1(md5.crypt(password, salt));
    const data = formencode({ username_or_email: user, password: passEncoded, keep_logged_in: 0 });
    const resp = await needle("post", "https://webshare.cz/api/login/", data, headers);
    if (resp.statusCode != 200 || resp.body.children.find((el) => el.name == "status").value != "OK") {
      throw Error("Cannot log in to Webshare.cz, invalid login credentials");
    }
    return resp.body.children.find((el) => el.name == "token").value;
  },

  // improve movie query by adding year with movies
  // search localized names too
  // we could also combine multiple different queries to get better results
  search: async (showInfo, token) => {
    const queries = getQueries(showInfo);
    // Get all results from different queries
    let results = await Promise.all(queries.map((query) => search(query, token)));

    // Create a unique list by using an object to track items by their ident
    results = Object.values(
      results.flat().reduce((acc, item) => {
        acc[item.ident] = item;
        return acc;
      }, {})
    );

    return (
      results
        .map((item) => {
          //if there is parsed year of release for found stream, add it to comparison to have better sorting results
          const titleYear =
            showInfo.type === "movie" && item.parsedTitle.year && showInfo.year && !ptt.parse(queries[0]).year ? `${showInfo.year}` : ""; //if there is year in title, do not compare years e.g. Wonder Woman 1984 (2020)
          const queryTitleYear =
            showInfo.type === "movie" && item.parsedTitle.year && showInfo.year && !ptt.parse(queries[0]).year ? `${item.parsedTitle.year}` : "";

          const cleanedTitle =
            item.parsedTitle.title
              ?.replace(/subtitles/gi, "")
              ?.replace(/titulky/gi, "")
              ?.replace(/[^\p{L}\p{N}\s]/gu, " ") //remove special chars but keep accented letters like áíéř
              ?.replace(/[_]/g, " ")
              ?.trim()
              ?.toLowerCase() + titleYear;
          const queryTitle = (showInfo.type == "series" ? queries[0]?.split(" ").slice(0, -1).join(" ") : queries[0] + queryTitleYear)?.toLowerCase();
          const queryTitleSk = (
            showInfo.type == "series" ? queries[1]?.split(" ").slice(0, -1).join(" ") : queries[1] + queryTitleYear
          )?.toLowerCase();
          const queryTitleOriginal = (
            showInfo.type == "series" ? queries[2]?.split(" ").slice(0, -1).join(" ") : queries[2] + queryTitleYear
          )?.toLowerCase();

          return {
            ident: item.ident,
            titleYear: titleYear,
            queryTitleYear: queryTitleYear,
            description:
              item.name +
              (item.language ? `\n🌐 ${item.language}` : "") +
              `\n👍 ${item.posVotes} 👎 ${item.negVotes}` +
              `\n💾 ${filesize(item.size)}`,
            match: Math.max(
              queryTitle ? stringSimilarity.compareTwoStrings(cleanedTitle, queryTitle) : 0,
              queryTitleOriginal ? stringSimilarity.compareTwoStrings(cleanedTitle, queryTitleOriginal) : 0,
              queryTitleSk ? stringSimilarity.compareTwoStrings(cleanedTitle, queryTitleSk) : 0,
              queryTitleSk ? stringSimilarity.compareTwoStrings(cleanedTitle, queryTitleSk + "/" + queryTitleOriginal) : 0,
              queryTitleSk ? stringSimilarity.compareTwoStrings(cleanedTitle, queryTitle + "/" + queryTitleOriginal) : 0
            ),
            SeasonEpisode: item.SeasonEpisode,
            posVotes: item.posVotes,
            name: `Webshare ${item.parsedTitle.resolution || ""}`,
            behaviorHints: {
              bingeGroup: "WebshareStremio|" + item.language + "|" + item.parsedTitle.resolution + "|" + item.parsedTitle.source, //secures quite reliable auto play next episode
              videoSize: item.size, //for subtitle addons
              filename: item.name, //for subtitle addons
            },

            queries: [queryTitle, queryTitleOriginal, queryTitleSk],
            parsedTitle: cleanedTitle,
          };
        })
        // Filter out items with low match score, exclude TV episodes when searching for movies,
        // exclude protected files, and ensure series match the correct season/episode
        .filter(
          (item) =>
            !item.protected &&
            item.match > 0.5 && //this threshold has best results, it filters out the most irrelevant streams
            item.queryTitleYear == item.titleYear && //filters out movies, which we are sure, that should not be send to Stremio
            !(showInfo.type == "movie" && item.SeasonEpisode) && //if movie, remove series streams from movie results
            !(showInfo.type == "series" && (item.SeasonEpisode?.season != showInfo.series || item.SeasonEpisode?.episode != showInfo.episode)) //if series, keep only streams with correct season and episode
        )
        .sort((a, b) => {
          if (a.match != b.match) {
            return b.match - a.match;
          } else if (a.posVotes != b.posVotes) {
            return b.posVotes - a.posVotes;
          } else {
            return b.behaviorHints.videoSize - a.behaviorHints.videoSize;
          }
        })
    );
  },

  addUrlToStreams: (streams, token) => {
    return Promise.all(
      streams.map(async (stream) => {
        const { ident, ...restStream } = stream;
        const data = formencode({ ident, download_type: "video_stream", force_https: 1, wst: token });
        const resp = await needle("post", "https://webshare.cz/api/file_link/", data, { headers });
        const status = resp?.body?.children?.find((el) => el.name == "status")?.value;
        if (status == "OK") {
          const url = resp?.body?.children?.find((el) => el.name == "link")?.value;
          return { ...restStream, url };
        } else {
          return restStream;
        }
      })
    );
  },
};
module.exports = webshare;
