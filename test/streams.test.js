const { searchStreams, compareStreams } = require("../src/streams");
const webshare = require("../src/webshare");

jest.mock("../src/webshare");

// Helper to mock search - returns files for first call, empty for subsequent
const mockSearch = (files) => {
  webshare.search.mockImplementation(() => Promise.resolve(files));
};

const file = (id, name, size, pos, neg) => ({
  ident: id,
  name: name,
  posVotes: pos,
  negVotes: neg,
  size: parseInt(size, 10),
  language: null,
  parsedTitle: require("parse-torrent-title").parse(name),
  SeasonEpisode: require("../src/filenameParser").extractSeasonEpisode(name),
  protected: false,
});

describe("search results are sorted", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("by match", async () => {
    const showInfo = {
      name: null,
      nameSk: null,
      originalName: "Miracle man",
      type: "movie",
      year: "2024",
    };

    mockSearch([
      file("1", "Morcle man 2024.avi", "600000", "1", "0"),
      file("2", "Moracle man 2024.avi", "600000", "1", "0"),
      file("3", "Miracle man 2024.avi", "600000", "1", "0"),
    ]);

    const results = await searchStreams(showInfo, null);
    expect(results.map((x) => x.ident)).toStrictEqual(["3", "2", "1"]);
  });

  test("by fulltext name match", async () => {
    const showInfo = {
      name: null,
      nameSk: null,
      originalName: "Miracle man",
      type: "series",
      episode: "3",
      series: "1",
      year: null,
    };

    mockSearch([
      // these filename are parsed incorrectly by the parse-torrent-title
      file("1", "720p S01 E03 Morcle man.avi", "600000", "1", "0"),
      file("2", "720p S01 E03 Moracle man.avi", "600000", "1", "0"),
      file("3", "720p S01 E03 Miracle man.avi", "600000", "1", "0"),
    ]);

    const results = await searchStreams(showInfo, null);
    expect(results.map((x) => x.ident)).toStrictEqual(["3", "2", "1"]);
  });

  test("by positive votes", async () => {
    const showInfo = {
      name: null,
      nameSk: null,
      originalName: "Miracle man",
      type: "movie",
      year: "2024",
    };

    mockSearch([
      file("1", "Miracle man 2024.avi", "600000", "4", "0"),
      file("2", "Miracle man 2024.avi", "600000", "0", "0"),
      file("3", "Miracle man 2024.avi", "600000", "1", "0"),
    ]);

    const results = await searchStreams(showInfo, null);
    expect(results.map((x) => x.ident)).toStrictEqual(["1", "3", "2"]);
  });

  test("by size", async () => {
    const showInfo = {
      name: null,
      nameSk: null,
      originalName: "Miracle man",
      type: "movie",
      year: "2024",
    };

    mockSearch([
      file("1", "Miracle man 2024.avi", "600000", "4", "0"),
      file("2", "Miracle man 2024.avi", "1200000", "4", "0"),
      file("3", "Miracle man 2024.avi", "100000", "4", "0"),
    ]);

    const results = await searchStreams(showInfo, null);
    expect(results.map((x) => x.ident)).toStrictEqual(["2", "1", "3"]);
  });

  test("strong matches are not sorted by fulltext match", async () => {
    const showInfo = {
      name: null,
      nameSk: null,
      originalName: "Miracle man",
      type: "series",
      episode: "3",
      series: "1",
      year: null,
    };

    mockSearch([
      // these filename are parsed incorrectly by the parse-torrent-title
      file("1", "720p S01 E03 Morcle man.avi", "600000", "1", "0"),
      file("2", "720p S01 E03 Moracle man.avi", "600000", "1", "0"),
      file("3", "720p S01 E03 Miracle man.avi", "600000", "1", "0"),
      // and these are parsed correctly, first has fulltext match 0.6, second 0.3 and third 0.4
      file("4", "Miracle man 720p S01 E03.avi", "600000", "1", "0"),
      file(
        "5",
        "Miracle man 720p VOD-gakqlqlqpapapa S01 E03.avi",
        "600000",
        "4",
        "0",
      ),
      file("6", "Miracle man 720p VOD-qqlkl S01 E03.avi", "600000", "2", "0"),
    ]);

    const results = await searchStreams(showInfo, null);
    // 5 is first even though the fulltext match is low
    // the last three are sorted by fulltext match
    expect(results.map((x) => x.ident)).toStrictEqual([
      "5",
      "6",
      "4",
      "3",
      "2",
      "1",
    ]);
  });
});

describe("formatting description and name", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("description and name are formed correctly from the filename and metadata", async () => {
    const showInfo = {
      name: null,
      nameSk: null,
      originalName: "The Relic",
      type: "movie",
      year: "1999",
    };

    mockSearch([
      file(
        "1",
        "The.Relic.1999.1080p.BluRay.x264-[YTS.AG].mkv",
        "2000000000",
        "10",
        "0",
      ),
      file(
        "2",
        "The.Relic.1999.2160p.UHD.BluRay.x265.10bit.HDR.DTS-HD.MA.5.1-SWTYBLZ.mkv",
        "30000000000",
        "15",
        "0",
      ),
      file(
        "3",
        "The.Relic.1999.REMASTERED.1080p.BluRay.H264.AAC-RARBG.mp4",
        "2500000000",
        "8",
        "0",
      ),
      file(
        "4",
        "The.Relic.1999.1080p.WEB-DL.DD5.1.H264-FGT.mkv",
        "180000000",
        "12",
        "0",
      ),
      file(
        "5",
        "The.Relic.1999.720p.BluRay.x264-[YTS.AG].mkv",
        "1000000000",
        "5",
        "0",
      ),
    ]);

    const results = await searchStreams(showInfo, null);
    expect(results.length).toBe(5);
    // Results include the filename, the votes and the language in decsription
    expect(results[0].description).toContain("👍 15 👎 0");
    expect(results[0].description).toContain(
      "The.Relic.1999.2160p.UHD.BluRay.x265.10bit.HDR.DTS-HD.MA.5.1-SWTYBLZ.mkv",
    );
    expect(results[0].description).toContain("💾 30 GB");
    expect(results[0].name).toBe("Webshare ✅ 2160p");

    expect(results[1].description).toContain("👍 12 👎 0");
    expect(results[1].description).toContain(
      "The.Relic.1999.1080p.WEB-DL.DD5.1.H264-FGT.mkv",
    );
    expect(results[1].description).toContain("💾 180 MB");
    expect(results[1].name).toBe("Webshare ✅ 1080p");

    expect(results[2].description).toContain("👍 10 👎 0");
    expect(results[2].description).toContain(
      "The.Relic.1999.1080p.BluRay.x264-[YTS.AG].mkv",
    );
    expect(results[2].description).toContain("💾 2 GB");
    expect(results[2].name).toBe("Webshare ✅ 1080p");

    expect(results[3].description).toContain("👍 8 👎 0");
    expect(results[3].description).toContain(
      "The.Relic.1999.REMASTERED.1080p.BluRay.H264.AAC-RARBG.mp4",
    );
    expect(results[3].description).toContain("💾 2.5 GB");
    expect(results[3].name).toBe("Webshare ✅ 1080p");

    expect(results[4].description).toContain("👍 5 👎 0");
    expect(results[4].description).toContain(
      "The.Relic.1999.720p.BluRay.x264-[YTS.AG].mkv",
    );
    expect(results[4].description).toContain("💾 1 GB");
    expect(results[4].name).toBe("Webshare ✅ 720p");
  });

  test("handles common TV show filename patterns", async () => {
    const showInfo = {
      name: null,
      nameSk: null,
      originalName: "Rolling Rad",
      type: "series",
      series: "1",
      episode: "1",
      year: null,
    };

    mockSearch([
      file(
        "1",
        "Rolling.Rad.S01E01.1080p.BluRay.x264-[YTS.AG].mkv",
        "2000000000",
        "10",
        "0",
      ),
      file(
        "2",
        "Rolling.Rad.S01E01.2160p.UHD.BluRay.x265.10bit.HDR.DTS-HD.MA.5.1-SWTYBLZ.mkv",
        "30000000000",
        "15",
        "0",
      ),
      file(
        "3",
        "Rolling.Rad.S01E01.REMASTERED.1080p.BluRay.H264.AAC-RARBG.mp4",
        "2500000000",
        "8",
        "0",
      ),
      file(
        "5",
        "Rolling.Rad.S01E01.720p.BluRay.x264-[YTS.AG].mkv",
        "1000000000",
        "5",
        "0",
      ),
    ]);

    const results = await searchStreams(showInfo, null);
    expect(results.length).toBe(4);
    expect(results[0].description).toContain("👍 15 👎 0");
    expect(results[0].description).toContain(
      "Rolling.Rad.S01E01.2160p.UHD.BluRay.x265.10bit.HDR.DTS-HD.MA.5.1-SWTYBLZ.mkv",
    );
    expect(results[0].description).toContain("💾 30 GB");
    expect(results[0].name).toBe("Webshare ✅ 2160p");

    expect(results[1].description).toContain("👍 10 👎 0");
    expect(results[1].description).toContain(
      "Rolling.Rad.S01E01.1080p.BluRay.x264-[YTS.AG].mkv",
    );
    expect(results[1].description).toContain("💾 2 GB");
    expect(results[1].name).toBe("Webshare ✅ 1080p");

    expect(results[2].description).toContain("👍 8 👎 0");
    expect(results[2].description).toContain(
      "Rolling.Rad.S01E01.REMASTERED.1080p.BluRay.H264.AAC-RARBG.mp4",
    );
    expect(results[2].description).toContain("💾 2.5 GB");
    expect(results[2].name).toBe("Webshare ✅ 1080p");

    expect(results[3].description).toContain("👍 5 👎 0");
    expect(results[3].description).toContain(
      "Rolling.Rad.S01E01.720p.BluRay.x264-[YTS.AG].mkv",
    );
    expect(results[3].description).toContain("💾 1 GB");
    expect(results[3].name).toBe("Webshare ✅ 720p");
  });

  test("handles filenames with language and subtitle information", async () => {
    const showInfo = {
      name: null,
      nameSk: null,
      originalName: "The LongTrain",
      type: "movie",
      year: "1999",
    };

    const { extractLanguage } = require("../src/filenameParser");
    const createFileWithLang = (id, name, size, pos, neg) => ({
      ...file(id, name, size, pos, neg),
      language: extractLanguage(name),
    });

    mockSearch([
      createFileWithLang(
        "1",
        "The.LongTrain.1999.1080p.BluRay.x264-[YTS.AG].mkv",
        "2000000000",
        "5",
        "0",
      ),
      createFileWithLang(
        "2",
        "The.LongTrain.1999.1080p.BluRay.x264-[YTS.AG].CZ.EN.mkv",
        "2000000000",
        "4",
        "0",
      ),
      createFileWithLang(
        "3",
        "The.LongTrain.1999.1080p.BluRay.x264-[YTS.AG].EN.CZ.mkv",
        "2000000000",
        "3",
        "0",
      ),
      createFileWithLang(
        "4",
        "The.LongTrain.1999.1080p.BluRay.x264-[YTS.AG].CZ.mkv",
        "2000000000",
        "2",
        "0",
      ),
      createFileWithLang(
        "5",
        "The.LongTrain.1999.1080p.BluRay.x264-[YTS.AG].EN.mkv",
        "2000000000",
        "1",
        "0",
      ),
    ]);

    const results = await searchStreams(showInfo, null);
    expect(results.length).toBe(5);
    // Check that language information is correctly extracted
    expect(results[0].description).not.toContain("🌐");
    expect(results[1].description).toContain("🌐 CZ|EN");
    expect(results[2].description).toContain("🌐 CZ|EN");
    expect(results[3].description).toContain("🌐 CZ");
    expect(results[4].description).toContain("🌐 EN");
  });
});

describe("exclude TV episodes when searching for movies - real world examples", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("Harry Potter and the Deathly Hallows - Part 1: includes Part 1 file, excludes episode file", async () => {
    const showInfo = {
      name: null,
      nameSk: null,
      originalName: "Harry Potter and the Deathly Hallows - Part 1",
      type: "movie",
      year: "2010",
    };

    mockSearch([
      // Should be included: "Part 1" in both title and filename
      file(
        "1",
        "Harry Potter and the Deathly Hallows - Part 1 (2010) (2160p BluRay x265 10bit HDR Tigole).mkv",
        "20000000000",
        "10",
        "0",
      ),
      // Should be excluded: has SeasonEpisode (01x14) but "part" not in filename
      file(
        "2",
        "Harry Potter and the Deathly Hallows - 01x14 (2160p BluRay x265 10bit HDR Tigole).mkv",
        "20000000000",
        "5",
        "0",
      ),
      // should be excluded: contains "Episode" in filename but not in title
      file(
        "3",
        "Harry Potter and the Deathly Hallows Episode 1.mkv",
        "20000000000",
        "3",
        "0",
      ),
    ]);

    const results = await searchStreams(showInfo, null);
    expect(results.length).toBe(1);
    expect(results[0].ident).toBe("1");
  });

  test("Star Wars Episode I Phantom Menace: includes files with Episode in both, excludes when Episode only in title", async () => {
    const showInfo = {
      name: null,
      nameSk: null,
      originalName: "Star Wars Episode I Phantom Menace",
      type: "movie",
      year: "1999",
    };

    mockSearch([
      // Should be included: "Episode" in both title and filename
      file(
        "1",
        "Star.Wars.Episode.I.Phantom.Menace.1999.JAPANESE.720p.BluRay.AC3.5.1.x264-JPN.mp4",
        "2000000000",
        "10",
        "0",
      ),

      // Should be excluded: has SeasonEpisode (S02E03) but "Episode" not in filename (only in title)
      file(
        "2",
        "Star.Wars.1.Phantom.Menace. S02E03 . 1999.mp4",
        "2000000000",
        "5",
        "0",
      ),

      // Should be excluded: contains "Part" in filename but not in title
      file(
        "3",
        "Star.Wars.Part.1.Phantom.Menace.1999.mp4",
        "2000000000",
        "3",
        "0",
      ),
    ]);

    const results = await searchStreams(showInfo, null);
    expect(results.length).toBe(1);
    expect(results.map((x) => x.ident)).toStrictEqual(["1"]);
  });
});

describe("stream items are enhanced with few fields", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("title year for movies", async () => {
    const showInfo = {
      name: null,
      nameSk: null,
      originalName: "The Matrix",
      type: "movie",
      year: "1999",
    };

    mockSearch([
      file("1", "The.Matrix.1999.1080p.BluRay.mkv", "2000000000", "10", "0"),
    ]);

    const results = await searchStreams(showInfo, null);
    expect(results.length).toBe(1);
    // titleYear should be the show's year when item has a parsed year
    expect(results[0].titleYear).toBe("1999");
  });

  test("title year is empty when movie title contains year", async () => {
    const showInfo = {
      name: null,
      nameSk: null,
      originalName: "Wonder Woman 1984",
      type: "movie",
      year: "2020",
    };

    mockSearch([
      file(
        "1",
        "Wonder.Woman.1984.2020.1080p.BluRay.mkv",
        "2000000000",
        "10",
        "0",
      ),
    ]);

    const results = await searchStreams(showInfo, null);
    expect(results.length).toBe(1);
    // titleYear should be empty when original title contains a year
    expect(results[0].titleYear).toBe("");
  });

  test("title year is empty for series", async () => {
    const showInfo = {
      name: null,
      nameSk: null,
      originalName: "Breaking Bad",
      type: "series",
      series: "1",
      episode: "1",
      year: "2008",
    };

    mockSearch([
      file(
        "1",
        "Breaking.Bad.S01E01.2008.1080p.BluRay.mkv",
        "2000000000",
        "10",
        "0",
      ),
    ]);

    const results = await searchStreams(showInfo, null);
    expect(results.length).toBe(1);
    // titleYear should be empty for series
    expect(results[0].titleYear).toBe("");
  });

  test("item title year for movies", async () => {
    const showInfo = {
      name: null,
      nameSk: null,
      originalName: "The Matrix",
      type: "movie",
      year: "1999",
    };

    mockSearch([
      file("1", "The.Matrix.1999.1080p.BluRay.mkv", "2000000000", "10", "0"),
    ]);

    const results = await searchStreams(showInfo, null);
    expect(results.length).toBe(1);
    // itemTitleYear should be the parsed year from the filename
    expect(results[0].itemTitleYear).toBe("1999");
  });

  test("item title year mismatch filters out results when difference is more than 1 year", async () => {
    const showInfo = {
      name: null,
      nameSk: null,
      originalName: "The Matrix",
      type: "movie",
      year: "1999",
    };

    mockSearch([
      // This has wrong year in filename (22 years difference) - should be filtered out
      file("1", "The.Matrix.2021.1080p.BluRay.mkv", "2000000000", "10", "0"),
      // This has correct year - should be included
      file("2", "The.Matrix.1999.720p.BluRay.mkv", "1000000000", "5", "0"),
    ]);

    const results = await searchStreams(showInfo, null);
    expect(results.length).toBe(1);
    expect(results[0].ident).toBe("2");
    expect(results[0].itemTitleYear).toBe("1999");
  });

  test("item title year +1 difference is allowed (TMDB vs regional release dates)", async () => {
    const showInfo = {
      name: null,
      nameSk: null,
      originalName: "Eden",
      type: "movie",
      year: "2025", // TMDB says 2025
    };

    mockSearch([
      // File has 2024 year (e.g., from WebShare where it premiered earlier)
      file("1", "Eden.2024.1080p.BluRay.mkv", "2000000000", "10", "0"),
      // File has exact year match
      file("2", "Eden.2025.720p.BluRay.mkv", "1000000000", "5", "0"),
    ]);

    const results = await searchStreams(showInfo, null);
    // Both files should be included - +1 year tolerance
    expect(results.length).toBe(2);
    expect(results.map((r) => r.ident).sort()).toStrictEqual(["1", "2"]);
  });

  test("item title year -1 difference is allowed (TMDB vs regional release dates)", async () => {
    const showInfo = {
      name: null,
      nameSk: null,
      originalName: "Eden",
      type: "movie",
      year: "2024", // TMDB says 2024
    };

    mockSearch([
      // File has 2025 year (e.g., from another database with later release)
      file("1", "Eden.2025.1080p.BluRay.mkv", "2000000000", "10", "0"),
      // File has exact year match
      file("2", "Eden.2024.720p.BluRay.mkv", "1000000000", "5", "0"),
    ]);

    const results = await searchStreams(showInfo, null);
    // Both files should be included - -1 year tolerance
    expect(results.length).toBe(2);
    expect(results.map((r) => r.ident).sort()).toStrictEqual(["1", "2"]);
  });

  test("item title year +2 difference is filtered out", async () => {
    const showInfo = {
      name: null,
      nameSk: null,
      originalName: "Test Movie",
      type: "movie",
      year: "2024",
    };

    mockSearch([
      // 2 years ahead - should be filtered out
      file("1", "Test.Movie.2026.1080p.BluRay.mkv", "2000000000", "10", "0"),
      // Exact match - should be included
      file("2", "Test.Movie.2024.720p.BluRay.mkv", "1000000000", "5", "0"),
      // 1 year ahead - should be included
      file("3", "Test.Movie.2025.720p.BluRay.mkv", "1000000000", "5", "0"),
    ]);

    const results = await searchStreams(showInfo, null);
    expect(results.length).toBe(2);
    expect(results.map((r) => r.ident).sort()).toStrictEqual(["2", "3"]);
  });

  test("item title year -2 difference is filtered out", async () => {
    const showInfo = {
      name: null,
      nameSk: null,
      originalName: "Test Movie",
      type: "movie",
      year: "2024",
    };

    mockSearch([
      // 2 years behind - should be filtered out
      file("1", "Test.Movie.2022.1080p.BluRay.mkv", "2000000000", "10", "0"),
      // Exact match - should be included
      file("2", "Test.Movie.2024.720p.BluRay.mkv", "1000000000", "5", "0"),
      // 1 year behind - should be included
      file("3", "Test.Movie.2023.720p.BluRay.mkv", "1000000000", "5", "0"),
    ]);

    const results = await searchStreams(showInfo, null);
    expect(results.length).toBe(2);
    expect(results.map((r) => r.ident).sort()).toStrictEqual(["2", "3"]);
  });

  test("cleaned item title", async () => {
    const showInfo = {
      name: null,
      nameSk: null,
      originalName: "The Matrix",
      type: "movie",
      year: "1999",
    };

    mockSearch([
      file("1", "The.Matrix.1999.1080p.BluRay.mkv", "2000000000", "10", "0"),
    ]);

    const results = await searchStreams(showInfo, null);
    expect(results.length).toBe(1);
    // parsedTitle in the result is actually cleanedItemTitle
    // It should be normalized (lowercase, no special chars) + itemTitleYear
    expect(results[0].parsedTitle).toBe("the matrix1999");
  });

  test("cleaned item title removes subtitles and titulky keywords", async () => {
    const showInfo = {
      name: null,
      nameSk: null,
      originalName: "The Matrix",
      type: "movie",
      year: "1999",
    };

    mockSearch([
      file(
        "1",
        "The.Matrix.1999.Subtitles.CZ.1080p.BluRay.mkv",
        "2000000000",
        "10",
        "0",
      ),
    ]);

    const results = await searchStreams(showInfo, null);
    expect(results.length).toBe(1);
    // "subtitles" should be removed from the cleaned title
    expect(results[0].parsedTitle).toBe("the matrix1999");
  });

  test("titles", async () => {
    const showInfo = {
      name: "Matice",
      nameSk: "Matica",
      nameEn: "The Matrix EN",
      originalName: "The Matrix",
      type: "movie",
      year: "1999",
    };

    mockSearch([
      file("1", "The.Matrix.1999.1080p.BluRay.mkv", "2000000000", "10", "0"),
    ]);

    const results = await searchStreams(showInfo, null);
    expect(results.length).toBe(1);
    // titles should contain normalized versions with year appended
    expect(results[0].titles).toEqual({
      title: "matice1999",
      titleSk: "matica1999",
      titleEn: "the matrix en1999",
      titleOriginal: "the matrix1999",
    });
  });

  test("titles without year for series", async () => {
    const showInfo = {
      name: "Perníkový táta",
      nameSk: "Pernikový fotr",
      nameEn: "Breaking Bad EN",
      originalName: "Breaking Bad",
      type: "series",
      series: "1",
      episode: "1",
      year: "2008",
    };

    mockSearch([
      file(
        "1",
        "Breaking.Bad.S01E01.1080p.BluRay.mkv",
        "2000000000",
        "10",
        "0",
      ),
    ]);

    const results = await searchStreams(showInfo, null);
    expect(results.length).toBe(1);
    // titles for series should not have year appended (titleYear is empty)
    expect(results[0].titles).toEqual({
      title: "pernikovy tata",
      titleSk: "pernikovy fotr",
      titleEn: "breaking bad en",
      titleOriginal: "breaking bad",
    });
  });
});
