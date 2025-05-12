const { extractLanguage, extractSeasonEpisode } = require("./filenameParser");

// TEST CASES for extractLanguage
if (require.main === module) {
  const testFilenames = [
    // Should match single language
    "movie.CZ.mkv",
    "movie.EN.avi",
    "movie.SK.mp4",
    // Should match multiple languages
    "movie.CZ,EN SK.mkv",
    "movie CZ EN.mkv",
    "movie.CZ-EN.mkv",
    "movie.CZ_EN.mkv",
    // Should match with subtitles/audio
    "movie.titulky.CZ.mkv",
    "movie.CZ.titulky.mkv",
    "movie.dabing.SK.avi",
    "movie.SK.dabing.avi",
    // Should match concatenated
    "movieCZSub.mkv",
    "movieENaudio.avi",
    // Should not match as substring
    "prodlouzena.mkv",
    "englishman.avi",
    "ceskydabing.mp4",
    // Should match dual/multi
    "movie.DUAL.CZ.mkv",
    "movie.MULTI.EN.avi",
    // Should match with brackets
    "[CZ] movie.mkv",
    "(EN) movie.avi",
    // Should match with non-alphanumeric separators
    "movie-CZ-EN.mkv",
    "movie_SK-EN.avi",
    // Should not match nonsense
    "randomfile.mkv",
    "movienolanguage.avi",
    // Additional tests for language code variations
    "movie.CZECH.mkv",
    "movie.CZE.mkv",
    "movie.SLOVENČINA.avi",
    "movie.CS.avi",
    "movie.CES.avi",
    "movie.ČEŠTINA.avi",
    "movie.ČESKY.avi",
    "movie.CZDAB.avi",
    "movie.ENGLISH.avi",
    "movie.ENG.avi",
    "movie.SLOVAK.avi",
    "movie.SLO.avi",
    "movie.SLK.avi",
    "movie.SKDAB.avi",
    // Mixed delimiters and combinations
    "movie.CZ,EN-SK.mkv",
    "movie.CZECH-ENGLISH_SKDAB.avi",
    "movie.CZ.EN-ENGLISH_SKDAB.mkv",
    "Pán prstenů - Společenstvo prstenu  - Prodloužená verze 2001 CZ dabing TOP kvalita.mkv",
    "movie.CZ-EN,SK.ENG_CZECH.avi",
    // Subtitle with language variations
    "movie.titulky. +CZECH.mkv",
    "movie.CZECH.titulky.mkv",
    "movie.titulky.SLOVENČINA.mkv",
    "movie.SLOVENČINA.titulky.mkv",
    // Subtitle with mixed delimiters
    "movie.subs.CZ-EN,SK.avi",
    "movie.titulky.CZECH-ENGLISH_SKDAB.avi",
    // Brackets and parentheses with variations
    "[CZECH] movie.mkv",
    "(SLOVENČINA) movie.avi",
    // Edge cases
    "movie.CZ,EN,EN,SK.mkv",
    "movie.CZ-EN-EN-SK.mkv",
    "movie.CZ.EN.EN.SLOVENČINA.mkv",
    "movie.CZ,EN,SK,ENGLISH,ENG,ČEŠTINA.mkv",
  ];

  for (const filename of testFilenames) {
    const result = extractLanguage(filename);
    console.log(`'${filename}' => ${result}`);
  }

  console.log("\n=== Testing extractSeasonEpisode ===\n");

  const seasonEpisodeTests = [
    // Standard S01E01 format variations
    "Breaking.Bad.S01E01.mkv",
    "House.S1E1.mkv",
    "Game.of.Thrones.S01.E01.mkv",
    "Star.Trek.S1.E1.mkv",
    "Friends.S01-E01.mkv",
    "The.Office.S1-E1.mkv",
    "Sherlock.S01_E01.mkv",
    "Westworld.S1_E1.mkv",

    // Standard 1x01 format variations
    "Doctor.Who.1x01.mkv",
    "Stranger.Things.1×01.mkv",
    "Lost.1 x 01.mkv",
    "24.Hours.1 × 01.mkv",
    "C.S.I.1-01.mkv",
    "9-1-1.1_01.mkv",

    // Episode-only formats
    "Mr.Robot.E01.mkv",
    "E.R.Ep01.mkv",
    "X-Files.Episode01.mkv",
    "S.W.A.T.E01.mkv",
    "CSI.NY.Ep 01.mkv",
    "Law.and.Order.SVU.Episode 01.mkv",

    // Part-based formats
    "Band.of.Brothers.Part1.mkv",
    "True.Detective.Pt1.mkv",
    "S.H.I.E.L.D.Part.1.mkv",
    "Mindhunter.Pt.1.mkv",
    "Chernobyl.Part-1.mkv",
    "11.22.63.Pt-1.mkv",

    // Hash-based formats
    "Narcos.#01.mkv",
    "The.100.#1.mkv",

    // Mixed formats with different delimiters
    "Dexter.S01E01-02.mkv",
    "Prison.Break.S1E1_2.mkv",
    "Sons.of.Anarchy.1x01-02.mkv",
    "Vikings.1×01_2.mkv",

    // Edge cases
    "Top.99.S99E999.mkv", // Large numbers
    "Agent.99x999.mkv", // Large numbers
    "E.T.S01E01v2.mkv", // Version suffix
    "Power.1x01v2.mkv", // Version suffix

    // Should not match
    "Se7en.mkv", // No season/episode
    "The.4400.1.mkv", // Just a number
    "E.T.E.mkv", // Just E
    "X-Men.x.mkv", // Just x
    "S.Club.7.S.mkv", // Just S
    "Season.S01.mkv", // Just season
    "Episode.E01.mkv", // Just episode
    "1x.Matters.mkv", // Incomplete format
    "xFiles.x01.mkv", // Incomplete format
    "S.H.I.E.L.D.S01E.mkv", // Incomplete format
    "SE01.Movie.mkv", // Invalid format
    "1E01.Series.mkv", // Invalid format
    "S1x01.Drama.mkv", // Invalid format
  ];

  for (const filename of seasonEpisodeTests) {
    const result = extractSeasonEpisode(filename);
    console.log(`'${filename}' => ${JSON.stringify(result)}`);
  }
}
