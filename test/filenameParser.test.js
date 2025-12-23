const {
  extractLanguage,
  extractSeasonEpisode,
} = require("../src/filenameParser");

test("extractLanguage", () => {
  expect(extractLanguage("movie.CZ.mkv")).toBe("CZ");
  expect(extractLanguage("movie.EN.avi")).toBe("EN");
  expect(extractLanguage("movie.SK.mp4")).toBe("SK");
  expect(extractLanguage("movie.CZ,EN SK.mkv")).toBe("CZ|EN|SK");
  expect(extractLanguage("movie CZ EN.mkv")).toBe("CZ|EN");
  expect(extractLanguage("movie.CZ-EN.mkv")).toBe("CZ|EN");
  expect(extractLanguage("movie.CZ_EN.mkv")).toBe("CZ|EN");
  expect(extractLanguage("movie.titulky.CZ.mkv")).toBe("CZ titulky");
  expect(extractLanguage("movie.CZ.titulky.mkv")).toBe("CZ titulky");
  expect(extractLanguage("movie.dabing.SK.avi")).toBe("SK");
  expect(extractLanguage("movie.SK.dabing.avi")).toBe("SK");
  expect(extractLanguage("movieCZSub.mkv")).toBe("CZ titulky");
  expect(extractLanguage("movieENaudio.avi")).toBe("EN");
  expect(extractLanguage("prodlouzena.mkv")).toBeNull();
  expect(extractLanguage("englishman.avi")).toBeNull();
  expect(extractLanguage("ceskydabing.mp4")).toBe("CZ");
  expect(extractLanguage("movie.DUAL.CZ.mkv")).toBe("CZ");
  expect(extractLanguage("movie.MULTI.EN.avi")).toBe("EN");
  expect(extractLanguage("[CZ] movie.mkv")).toBe("CZ");
  expect(extractLanguage("(EN)) movie.avi")).toBe("EN");
  expect(extractLanguage("movie-CZ-EN.mkv")).toBe("CZ|EN");
  expect(extractLanguage("movie_SK-EN.avi")).toBe("EN|SK");
  expect(extractLanguage("randomfile.mkv")).toBeNull();
  expect(extractLanguage("movienolanguage.avi")).toBeNull();
  expect(extractLanguage("movie.CZECH.mkv")).toBe("CZ");
  expect(extractLanguage("movie.CZE.mkv")).toBe("CZ");
  expect(extractLanguage("movie.SLOVENČINA.avi")).toBe("SK");
  expect(extractLanguage("movie.CS.avi")).toBe("CZ");
  expect(extractLanguage("movie.CES.avi")).toBe("CZ");
  expect(extractLanguage("movie.ČEŠTINA.avi")).toBe("CZ");
  expect(extractLanguage("movie.ČESKY.avi")).toBe("CZ");
  expect(extractLanguage("movie.CZDAB.avi")).toBe("CZ");
  expect(extractLanguage("movie.ENGLISH.avi")).toBeNull();
  expect(extractLanguage("movie.ENG.avi")).toBe("EN");
  expect(extractLanguage("movie.SLOVAK.avi")).toBe("SK");
  expect(extractLanguage("movie.SLO.avi")).toBe("SK");
  expect(extractLanguage("movie.SLK.avi")).toBe("SK");
  expect(extractLanguage("movie.SKDAB.avi")).toBe("SK");
  expect(extractLanguage("movie.CZ,EN-SK.mkv")).toBe("CZ|EN|SK");
  expect(extractLanguage("movie.CZECH-ENGLISH_SKDAB.avi")).toBe("CZ|SK");
  expect(extractLanguage("movie.CZ.EN-ENGLISH_SKDAB.mkv")).toBe("CZ|EN|SK");
  expect(
    extractLanguage(
      "Pán prstenů - Společenstvo prstenu  - Prodloužená verze 2001 CZ dabing TOP kvalita.mkv",
    ),
  ).toBe("CZ");
  expect(extractLanguage("movie.CZ-EN,SK.ENG_CZECH.avi")).toBe("CZ|EN|SK");
  expect(extractLanguage("movie.titulky. +CZECH.mkv")).toBe("CZ titulky");
  expect(extractLanguage("movie.CZECH.titulky.mkv")).toBe("CZ titulky");
  expect(extractLanguage("movie.titulky.SLOVENČINA.mkv")).toBe("SK titulky");
  expect(extractLanguage("movie.SLOVENČINA.titulky.mkv")).toBe("SK titulky");
  expect(extractLanguage("movie.subs.CZ-EN,SK.avi")).toBe("CZ titulky|EN|SK");
  expect(extractLanguage("movie.titulky.CZECH-ENGLISH_SKDAB.avi")).toBe(
    "CZ titulky|SK",
  );
  expect(extractLanguage("[CZECH] movie.mkv")).toBe("CZ");
  expect(extractLanguage("(SLOVENČINA)) movie.avi")).toBe("SK");
  expect(extractLanguage("movie.CZ,EN,EN,SK.mkv")).toBe("CZ|EN|SK");
  expect(extractLanguage("movie.CZ-EN-EN-SK.mkv")).toBe("CZ|EN|SK");
  expect(extractLanguage("movie.CZ.EN.EN.SLOVENČINA.mkv")).toBe("CZ|EN|SK");
  expect(extractLanguage("movie.CZ,EN,SK,ENGLISH,ENG,ČEŠTINA.mkv")).toBe(
    "CZ|EN|SK",
  );
  expect(extractLanguage("Posledni-pisen-CZ.avi")).toBe("CZ");
});

test("extractSeasonEpisode", () => {
  expect(extractSeasonEpisode("Breaking.Bad.S01E01.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("House.S1E1.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("Game.of.Thrones.S01.E01.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("Star.Trek.S1.E1.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("Friends.S01-E01.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("The.Office.S1-E1.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("Sherlock.S01_E01.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("Westworld.S1_E1.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("Doctor.Who.1x01.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("Stranger.Things.1×01.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("Lost.1 x 01.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("24.Hours.1 × 01.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("C.S.I.1-01.mkv")).toBeNull();
  expect(extractSeasonEpisode("9-1-1.1_01.mkv")).toBeNull();
  expect(extractSeasonEpisode("Mr.Robot.E01.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("E.R.Ep01.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("X-Files.Episode01.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("S.W.A.T.E01.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("CSI.NY.Ep 01.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(
    extractSeasonEpisode("Law.and.Order.SVU.Episode 01.mkv"),
  ).toStrictEqual({ season: 1, episode: 1 });
  expect(extractSeasonEpisode("Band.of.Brothers.Part1.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("True.Detective.Pt1.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("S.H.I.E.L.D.Part.1.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("Mindhunter.Pt.1.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("Chernobyl.Part-1.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("11.22.63.Pt-1.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("Narcos.#01.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("The.100.#1.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("Dexter.S01E01-02.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("Prison.Break.S1E1_2.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("Sons.of.Anarchy.1x01-02.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("Vikings.1×01_2.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("Top.99.S99E999.mkv")).toStrictEqual({
    season: 99,
    episode: 999,
  });
  expect(extractSeasonEpisode("Agent.99x999.mkv")).toStrictEqual({
    season: 99,
    episode: 999,
  });
  expect(extractSeasonEpisode("E.T.S01E01v2.mkv")).toBeNull();
  expect(extractSeasonEpisode("Power.1x01v2.mkv")).toBeNull();
  expect(extractSeasonEpisode("Se7en.mkv")).toBeNull();
  expect(extractSeasonEpisode("The.4400.1.mkv")).toBeNull();
  expect(extractSeasonEpisode("E.T.E.mkv")).toBeNull();
  expect(extractSeasonEpisode("X-Men.x.mkv")).toBeNull();
  expect(extractSeasonEpisode("S.Club.7.S.mkv")).toBeNull();
  expect(extractSeasonEpisode("Season.S01.mkv")).toBeNull();
  expect(extractSeasonEpisode("Episode.E01.mkv")).toStrictEqual({
    season: 1,
    episode: 1,
  });
  expect(extractSeasonEpisode("1x.Matters.mkv")).toBeNull();
  expect(extractSeasonEpisode("xFiles.x01.mkv")).toBeNull();
  expect(extractSeasonEpisode("S.H.I.E.L.D.S01E.mkv")).toBeNull();
  expect(extractSeasonEpisode("SE01.Movie.mkv")).toBeNull();
  expect(extractSeasonEpisode("1E01.Series.mkv")).toBeNull();
  expect(extractSeasonEpisode("S1x01.Drama.mkv")).toBeNull();
});

test("extractSeasonEpisode ignores x26* version codec", () => {
  expect(extractSeasonEpisode("Thing_5.1.x264.mkv")).toBeNull();
  expect(extractSeasonEpisode("Thing_5.1 x264.mkv")).toBeNull();
  expect(extractSeasonEpisode("Thing_5.1_x264.mkv")).toBeNull();

  expect(extractSeasonEpisode("Thing_5.1.x265.mkv")).toBeNull();
  expect(extractSeasonEpisode("Thing_5.1 x265.mkv")).toBeNull();
  expect(extractSeasonEpisode("Thing_5.1_x265.mkv")).toBeNull();

  expect(extractSeasonEpisode("Thing_5.1.x266.mkv")).toBeNull();
  expect(extractSeasonEpisode("Thing_5.1 x266.mkv")).toBeNull();
  expect(extractSeasonEpisode("Thing_5.1_x266.mkv")).toBeNull();

  // not a valid codec number
  expect(extractSeasonEpisode("Thing_5.1.x261.mkv")).toStrictEqual({
    season: 1,
    episode: 261,
  });
  expect(extractSeasonEpisode("Thing_5.1 x261.mkv")).toStrictEqual({
    season: 1,
    episode: 261,
  });
  expect(extractSeasonEpisode("Thing_5.1x261.mkv")).toStrictEqual({
    season: 1,
    episode: 261,
  });

  // without a space
  expect(extractSeasonEpisode("Thing_5.1x264.mkv")).toStrictEqual({
    season: 1,
    episode: 264,
  });
  // codec broken by a character
  expect(extractSeasonEpisode("Thing_5.1 x 264.mkv")).toStrictEqual({
    season: 1,
    episode: 264,
  });
  expect(extractSeasonEpisode("Thing_5.1.x.264.mkv")).toStrictEqual({
    season: 1,
    episode: 264,
  });
});
