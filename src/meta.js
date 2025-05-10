const tmdbPrivateKey = require("../config/keys").tmdbApiKey;
const needle = require("needle");
let tmdbApiKey;

async function initFreeKeys() {
  const params = await require("freekeys")();
  return params.tmdb_key;
}

const findShowInfo = async (type, id) => {
  tmdbApiKey = tmdbPrivateKey || (await initFreeKeys());
  if (type == "movie") {
    return (await findMovieTmdb(type, id)) || (await findMovieCinemeta(type, id));
  } else if (type == "series") {
    return (await findSeriesTmdb(type, id)) || (await findSeriesCinemeta(type, id));
  }
};

const findMovieCinemeta = async (type, id) => {
  const resp = await needle("get", "https://v3-cinemeta.strem.io/meta/" + type + "/" + id + ".json");
  return resp.body && { name: resp.body.meta.name, originalName: null, type, year: resp.body.meta.releaseInfo };
};

const findSeriesCinemeta = async (type, id) => {
  const segments = id.split(":");
  if (segments.length == 3) {
    const [id, series, episode] = segments;
    const resp = await needle("get", "https://v3-cinemeta.strem.io/meta/" + type + "/" + id + ".json");
    return resp.body && { name: resp.body.meta.name, originalName: null, type, series, episode, year: null };
  }
};

const findMovieTmdb = async (type, id) => {
  const [resp, respSk] = await Promise.all([
    needle("get", `https://api.themoviedb.org/3/find/${id}?api_key=${tmdbApiKey}&external_source=imdb_id&language=cs`, null, {}),
    needle("get", `https://api.themoviedb.org/3/find/${id}?api_key=${tmdbApiKey}&external_source=imdb_id&language=sk`, null, {}),
  ]);

  if (resp.statusCode == 200) {
    const results = resp.body.movie_results;
    const resultsSk = respSk?.body?.movie_results;
    if (results.length >= 1) {
      return {
        name: results[0].title,
        nameSk: resultsSk[0]?.title,
        originalName: results[0].original_title,
        type,
        year: results[0].release_date?.substring(0, 4),
      };
    }
  }
};

const findSeriesTmdb = async (type, id) => {
  const segments = id.split(":");
  if (segments.length == 3) {
    const [id, series, episode] = segments;
    const [resp, respSk] = await Promise.all([
      needle("get", `https://api.themoviedb.org/3/find/${id}?api_key=${tmdbApiKey}&external_source=imdb_id&language=cs`, null, {}),
      needle("get", `https://api.themoviedb.org/3/find/${id}?api_key=${tmdbApiKey}&external_source=imdb_id&language=sk`, null, {}),
    ]);
    if (resp.statusCode == 200) {
      const results = resp.body.tv_results;
      const resultsSk = respSk?.body?.tv_results;
      if (results.length >= 1) {
        return { name: results[0].name, nameSk: resultsSk[0]?.name, originalName: results[0].original_name, type, series, episode, year: null };
      }
    }
  }
};

module.exports = { findShowInfo };
