let tmdbPrivateKey;
try {
  tmdbPrivateKey = require("../config/keys").tmdbApiKey;
} catch (e) {}

const needle = require("needle");
let tmdbApiKey;

async function initFreeKeys() {
  const params = await require("freekeys")();
  return params.tmdb_key;
}

const findShowInfo = async (type, id) => {
  tmdbApiKey = tmdbPrivateKey || (await initFreeKeys());
  if (type == "movie") {
    return (
      (await findMovieTmdbByImdb(type, id)) ||
      (await findMovieCinemeta(type, id))
    );
  } else if (type == "series") {
    return (
      (await findSeriesTmdbByImdb(type, id)) ||
      (await findSeriesCinemeta(type, id))
    );
  }
};

const findShowInfoInTmdb = async (type, id) => {
  tmdbApiKey = tmdbPrivateKey || (await initFreeKeys());
  if (type == "movie") {
    return await findMovieTmdb(type, id);
  } else if (type == "series") {
    return await findSeriesTmdb(type, id);
  }
};

const findMovieCinemeta = async (type, id) => {
  const resp = await needle(
    "get",
    "https://v3-cinemeta.strem.io/meta/" + type + "/" + id + ".json",
  );
  return (
    resp.body && {
      name: resp.body.meta.name,
      originalName: null,
      type,
      year: resp.body.meta.releaseInfo,
    }
  );
};

const findSeriesCinemeta = async (type, id) => {
  const segments = id.split(":");
  if (segments.length == 3) {
    const [id, series, episode] = segments;
    const resp = await needle(
      "get",
      "https://v3-cinemeta.strem.io/meta/" + type + "/" + id + ".json",
    );
    return (
      resp.body && {
        name: resp.body.meta.name,
        originalName: null,
        type,
        series,
        episode,
        year: null,
      }
    );
  }
};

const findMovieTmdbByImdb = async (type, id) => {
  const [resp, respSk] = await Promise.all([
    needle(
      "get",
      `https://api.themoviedb.org/3/find/${id}?api_key=${tmdbApiKey}&external_source=imdb_id&language=cs`,
      null,
      {},
    ),
    needle(
      "get",
      `https://api.themoviedb.org/3/find/${id}?api_key=${tmdbApiKey}&external_source=imdb_id&language=sk`,
      null,
      {},
    ),
  ]);

  if (resp.statusCode == 200) {
    const results = resp.body.movie_results;
    const resultsSk = respSk?.body?.movie_results;
    let resultsEn = null;

    //e.g. Naprostí cizinci.original_title = 'Perfetti sconosciuti' = not/not enough webshare search results
    if (results[0] && results[0].original_language !== "en") {
      const respEn = await needle(
        "get",
        `https://api.themoviedb.org/3/find/${id}?api_key=${tmdbApiKey}&external_source=imdb_id`,
        null,
        {},
      );
      resultsEn = respEn?.body?.movie_results;
    }

    if (results.length >= 1) {
      return {
        name: results[0].title,
        nameSk: resultsSk[0]?.title,
        nameEn: resultsEn?.[0]?.title,
        originalName: results[0].original_title,
        type,
        year: results[0].release_date?.substring(0, 4),
      };
    }
  }
};

const findSeriesTmdbByImdb = async (type, id) => {
  const segments = id.split(":");
  if (segments.length == 3) {
    const [id, series, episode] = segments;
    const [resp, respSk] = await Promise.all([
      needle(
        "get",
        `https://api.themoviedb.org/3/find/${id}?api_key=${tmdbApiKey}&external_source=imdb_id&language=cs`,
        null,
        {},
      ),
      needle(
        "get",
        `https://api.themoviedb.org/3/find/${id}?api_key=${tmdbApiKey}&external_source=imdb_id&language=sk`,
        null,
        {},
      ),
    ]);

    if (resp.statusCode == 200) {
      const results = resp.body.tv_results;
      const resultsSk = respSk?.body?.tv_results;
      let resultsEn = null;

      //e.g. Squid Game.original_name = '오징어 게임' = not/not enough webshare search results
      if (results[0].original_language !== "en") {
        const respEn = await needle(
          "get",
          `https://api.themoviedb.org/3/find/${id}?api_key=${tmdbApiKey}&external_source=imdb_id`,
          null,
          {},
        );

        resultsEn = respEn?.body?.tv_results;
      }

      if (results.length >= 1) {
        return {
          name: results[0].name,
          nameSk: resultsSk[0]?.name,
          nameEn: resultsEn?.[0]?.name,
          originalName: results[0].original_name,
          type,
          series,
          episode,
          year: null,
        };
      }
    }
  }
};
const findMovieTmdb = async (type, id) => {
  const [resp, respSk] = await Promise.all([
    needle(
      "get",
      `https://api.themoviedb.org/3/movie/${id}?api_key=${tmdbApiKey}&language=cs`,
      null,
      {},
    ),
    needle(
      "get",
      `https://api.themoviedb.org/3/movie/${id}?api_key=${tmdbApiKey}&language=sk`,
      null,
      {},
    ),
  ]);

  if (resp.statusCode == 200) {
    const result = resp.body;
    const resultSk = respSk?.body;
    let resultEn = null;

    //e.g. Naprostí cizinci.original_title = 'Perfetti sconosciuti' = not/not enough webshare search results
    if (result?.original_language !== "en") {
      const respEn = await needle(
        "get",
        `https://api.themoviedb.org/3/movie/${id}?api_key=${tmdbApiKey}`,
        null,
        {},
      );
      resultEn = respEn?.body;
    }

    if (result) {
      return {
        name: result.title,
        nameSk: resultSk?.title,
        nameEn: resultEn?.title,
        originalName: result.original_title,
        type,
        year: result.release_date?.substring(0, 4),
      };
    }
  }
};

const findSeriesTmdb = async (type, id) => {
  const segments = id.split(":");
  if (segments.length == 3) {
    const [id, series, episode] = segments;
    const [resp, respSk] = await Promise.all([
      needle(
        "get",
        `https://api.themoviedb.org/3/tv/${id}?api_key=${tmdbApiKey}&language=cs`,
        null,
        {},
      ),
      needle(
        "get",
        `https://api.themoviedb.org/3/tv/${id}?api_key=${tmdbApiKey}&language=sk`,
        null,
        {},
      ),
    ]);

    if (resp.statusCode == 200) {
      const result = resp.body;
      const resultSk = respSk?.body;
      let resultEn = null;

      //e.g. Squid Game.original_name = '오징어 게임' = not/not enough webshare search results
      if (result?.original_language !== "en") {
        const respEn = await needle(
          "get",
          `https://api.themoviedb.org/3/tv/${id}?api_key=${tmdbApiKey}`,
          null,
          {},
        );

        resultEn = respEn?.body;
      }

      if (result) {
        return {
          name: result.name,
          nameSk: resultSk?.name,
          nameEn: resultEn?.name,
          originalName: result.original_name,
          type,
          series,
          episode,
          year: null,
        };
      }
    }
  }
};

module.exports = { findShowInfo, findShowInfoInTmdb };
