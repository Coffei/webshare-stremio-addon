const needle = require("needle");
const { findShowInfo, findShowInfoInTmdb } = require("../src/meta");

jest.mock("needle");
jest.mock("freekeys", () =>
  jest.fn(() => Promise.resolve({ tmdb_key: "test-key" })),
);

describe("meta.js", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("findShowInfo", () => {
    describe("movies", () => {
      it("returns TMDB result with cs/sk names when found", async () => {
        needle.mockImplementation((method, url) => {
          if (url.includes("language=cs")) {
            return {
              statusCode: 200,
              body: {
                movie_results: [
                  {
                    title: "Český název",
                    original_title: "Original Title",
                    release_date: "2024-01-15",
                    original_language: "en",
                  },
                ],
              },
            };
          }
          if (url.includes("language=sk")) {
            return {
              statusCode: 200,
              body: {
                movie_results: [
                  {
                    title: "Slovenský názov",
                    original_title: "Original Title",
                    release_date: "2024-01-15",
                    original_language: "en",
                  },
                ],
              },
            };
          }
          return { statusCode: 404, body: {} };
        });

        const result = await findShowInfo("movie", "tt1234567");

        expect(result).toEqual({
          name: "Český název",
          nameSk: "Slovenský názov",
          nameEn: undefined,
          originalName: "Original Title",
          type: "movie",
          year: "2024",
        });
      });

      it("fetches English name when original language is not English", async () => {
        needle.mockImplementation((method, url) => {
          if (url.includes("language=cs")) {
            return {
              statusCode: 200,
              body: {
                movie_results: [
                  {
                    title: "Naprostí cizinci",
                    original_title: "Perfetti sconosciuti",
                    release_date: "2016-02-11",
                    original_language: "it",
                  },
                ],
              },
            };
          }
          if (url.includes("language=sk")) {
            return {
              statusCode: 200,
              body: {
                movie_results: [
                  {
                    title: "Úplní cudzinci",
                    original_title: "Perfetti sconosciuti",
                    release_date: "2016-02-11",
                    original_language: "it",
                  },
                ],
              },
            };
          }
          // English fallback (no language param)
          return {
            statusCode: 200,
            body: {
              movie_results: [
                {
                  title: "Perfect Strangers",
                  original_title: "Perfetti sconosciuti",
                  release_date: "2016-02-11",
                  original_language: "it",
                },
              ],
            },
          };
        });

        const result = await findShowInfo("movie", "tt4901306");

        expect(result).toEqual({
          name: "Naprostí cizinci",
          nameSk: "Úplní cudzinci",
          nameEn: "Perfect Strangers",
          originalName: "Perfetti sconosciuti",
          type: "movie",
          year: "2016",
        });
      });

      it("skips English fetch when original language IS English", async () => {
        needle.mockImplementation((method, url) => {
          if (url.includes("language=cs")) {
            return {
              statusCode: 200,
              body: {
                movie_results: [
                  {
                    title: "Matrix",
                    original_title: "The Matrix",
                    release_date: "1999-03-31",
                    original_language: "en",
                  },
                ],
              },
            };
          }
          if (url.includes("language=sk")) {
            return {
              statusCode: 200,
              body: {
                movie_results: [
                  {
                    title: "Matrix",
                    original_title: "The Matrix",
                    release_date: "1999-03-31",
                    original_language: "en",
                  },
                ],
              },
            };
          }
          return { statusCode: 404, body: {} };
        });

        const result = await findShowInfo("movie", "tt0133093");

        expect(result.nameEn).toBeUndefined();
        // Verify English endpoint was NOT called (only cs and sk)
        const calls = needle.mock.calls;
        const englishCalls = calls.filter(
          (call) =>
            !call[1].includes("language=cs") &&
            !call[1].includes("language=sk"),
        );
        expect(englishCalls.length).toBe(0);
      });

      it("falls back to Cinemeta when TMDB returns no results", async () => {
        needle.mockImplementation((method, url) => {
          if (url.includes("themoviedb.org")) {
            return {
              statusCode: 200,
              body: {
                movie_results: [],
              },
            };
          }
          if (url.includes("cinemeta.strem.io")) {
            return {
              body: {
                meta: {
                  name: "Cinemeta Movie",
                  releaseInfo: "2024",
                },
              },
            };
          }
          return { statusCode: 404, body: {} };
        });

        const result = await findShowInfo("movie", "tt9999999");

        expect(result).toEqual({
          name: "Cinemeta Movie",
          originalName: null,
          type: "movie",
          year: "2024",
        });
      });

      it("falls back to Cinemeta when TMDB returns non-200 status", async () => {
        needle.mockImplementation((method, url) => {
          if (url.includes("themoviedb.org")) {
            return {
              statusCode: 500,
              body: {},
            };
          }
          if (url.includes("cinemeta.strem.io")) {
            return {
              body: {
                meta: {
                  name: "Fallback Movie",
                  releaseInfo: "2023",
                },
              },
            };
          }
          return { statusCode: 404, body: {} };
        });

        const result = await findShowInfo("movie", "tt8888888");

        expect(result).toEqual({
          name: "Fallback Movie",
          originalName: null,
          type: "movie",
          year: "2023",
        });
      });

      it("returns falsy value when both TMDB and Cinemeta fail", async () => {
        needle.mockImplementation(() => ({
          statusCode: 500,
          body: null,
        }));

        const result = await findShowInfo("movie", "tt0000000");

        expect(result).toBeFalsy();
      });
    });

    describe("series", () => {
      it("returns TMDB result with parsed season/episode from ID", async () => {
        needle.mockImplementation((method, url) => {
          if (url.includes("language=cs")) {
            return {
              statusCode: 200,
              body: {
                tv_results: [
                  {
                    name: "Hra o trůny",
                    original_name: "Game of Thrones",
                    original_language: "en",
                  },
                ],
              },
            };
          }
          if (url.includes("language=sk")) {
            return {
              statusCode: 200,
              body: {
                tv_results: [
                  {
                    name: "Hra o tróny",
                    original_name: "Game of Thrones",
                    original_language: "en",
                  },
                ],
              },
            };
          }
          return { statusCode: 404, body: {} };
        });

        const result = await findShowInfo("series", "tt0944947:2:5");

        expect(result).toEqual({
          name: "Hra o trůny",
          nameSk: "Hra o tróny",
          nameEn: undefined,
          originalName: "Game of Thrones",
          type: "series",
          series: "2",
          episode: "5",
          year: null,
        });
      });

      it("fetches English name for non-English series", async () => {
        needle.mockImplementation((method, url) => {
          if (url.includes("language=cs")) {
            return {
              statusCode: 200,
              body: {
                tv_results: [
                  {
                    name: "Hra na oliheň",
                    original_name: "오징어 게임",
                    original_language: "ko",
                  },
                ],
              },
            };
          }
          if (url.includes("language=sk")) {
            return {
              statusCode: 200,
              body: {
                tv_results: [
                  {
                    name: "Hra na kalmára",
                    original_name: "오징어 게임",
                    original_language: "ko",
                  },
                ],
              },
            };
          }
          // English fallback
          return {
            statusCode: 200,
            body: {
              tv_results: [
                {
                  name: "Squid Game",
                  original_name: "오징어 게임",
                  original_language: "ko",
                },
              ],
            },
          };
        });

        const result = await findShowInfo("series", "tt10919420:1:3");

        expect(result).toEqual({
          name: "Hra na oliheň",
          nameSk: "Hra na kalmára",
          nameEn: "Squid Game",
          originalName: "오징어 게임",
          type: "series",
          series: "1",
          episode: "3",
          year: null,
        });
      });

      it("falls back to Cinemeta when TMDB returns non-200 status", async () => {
        needle.mockImplementation((method, url) => {
          if (url.includes("themoviedb.org")) {
            // Return non-200 to trigger fallback
            // Note: Empty results would trigger a bug in findSeriesTmdbByImdb (line 144)
            return {
              statusCode: 500,
              body: {},
            };
          }
          if (url.includes("cinemeta.strem.io")) {
            return {
              body: {
                meta: {
                  name: "Cinemeta Series",
                },
              },
            };
          }
          return { statusCode: 404, body: {} };
        });

        const result = await findShowInfo("series", "tt9999999:1:1");

        expect(result).toEqual({
          name: "Cinemeta Series",
          originalName: null,
          type: "series",
          series: "1",
          episode: "1",
          year: null,
        });
      });

      it("returns undefined for invalid ID format (not 3 segments)", async () => {
        const result = await findShowInfo("series", "tt1234567");

        expect(result).toBeUndefined();
      });
    });
  });

  describe("findShowInfoInTmdb", () => {
    describe("movies", () => {
      it("returns movie info with all name variants", async () => {
        needle.mockImplementation((method, url) => {
          if (url.includes("language=cs")) {
            return {
              statusCode: 200,
              body: {
                title: "Temný rytíř",
                original_title: "The Dark Knight",
                release_date: "2008-07-18",
                original_language: "en",
              },
            };
          }
          if (url.includes("language=sk")) {
            return {
              statusCode: 200,
              body: {
                title: "Temný rytier",
                original_title: "The Dark Knight",
                release_date: "2008-07-18",
                original_language: "en",
              },
            };
          }
          return { statusCode: 404, body: {} };
        });

        const result = await findShowInfoInTmdb("movie", "155");

        expect(result).toEqual({
          name: "Temný rytíř",
          nameSk: "Temný rytier",
          nameEn: undefined,
          originalName: "The Dark Knight",
          type: "movie",
          year: "2008",
        });
      });

      it("fetches English name for non-English movies", async () => {
        needle.mockImplementation((method, url) => {
          if (url.includes("language=cs")) {
            return {
              statusCode: 200,
              body: {
                title: "Amélie z Montmartru",
                original_title: "Le Fabuleux Destin d'Amélie Poulain",
                release_date: "2001-04-25",
                original_language: "fr",
              },
            };
          }
          if (url.includes("language=sk")) {
            return {
              statusCode: 200,
              body: {
                title: "Amélia",
                original_title: "Le Fabuleux Destin d'Amélie Poulain",
                release_date: "2001-04-25",
                original_language: "fr",
              },
            };
          }
          // English fallback
          return {
            statusCode: 200,
            body: {
              title: "Amélie",
              original_title: "Le Fabuleux Destin d'Amélie Poulain",
              release_date: "2001-04-25",
              original_language: "fr",
            },
          };
        });

        const result = await findShowInfoInTmdb("movie", "194");

        expect(result).toEqual({
          name: "Amélie z Montmartru",
          nameSk: "Amélia",
          nameEn: "Amélie",
          originalName: "Le Fabuleux Destin d'Amélie Poulain",
          type: "movie",
          year: "2001",
        });
      });

      it("returns undefined on API error", async () => {
        needle.mockImplementation(() => ({
          statusCode: 500,
          body: {},
        }));

        const result = await findShowInfoInTmdb("movie", "999999999");

        expect(result).toBeUndefined();
      });
    });

    describe("series", () => {
      it("returns series info with season/episode parsed", async () => {
        needle.mockImplementation((method, url) => {
          if (url.includes("language=cs")) {
            return {
              statusCode: 200,
              body: {
                name: "Perníkový táta",
                original_name: "Breaking Bad",
                original_language: "en",
              },
            };
          }
          if (url.includes("language=sk")) {
            return {
              statusCode: 200,
              body: {
                name: "Vo všetkom zlom",
                original_name: "Breaking Bad",
                original_language: "en",
              },
            };
          }
          return { statusCode: 404, body: {} };
        });

        const result = await findShowInfoInTmdb("series", "1396:3:7");

        expect(result).toEqual({
          name: "Perníkový táta",
          nameSk: "Vo všetkom zlom",
          nameEn: undefined,
          originalName: "Breaking Bad",
          type: "series",
          series: "3",
          episode: "7",
          year: null,
        });
      });

      it("fetches English name for non-English series", async () => {
        needle.mockImplementation((method, url) => {
          if (url.includes("language=cs")) {
            return {
              statusCode: 200,
              body: {
                name: "Papírový dům",
                original_name: "La Casa de Papel",
                original_language: "es",
              },
            };
          }
          if (url.includes("language=sk")) {
            return {
              statusCode: 200,
              body: {
                name: "Papierový dom",
                original_name: "La Casa de Papel",
                original_language: "es",
              },
            };
          }
          // English fallback
          return {
            statusCode: 200,
            body: {
              name: "Money Heist",
              original_name: "La Casa de Papel",
              original_language: "es",
            },
          };
        });

        const result = await findShowInfoInTmdb("series", "71446:2:4");

        expect(result).toEqual({
          name: "Papírový dům",
          nameSk: "Papierový dom",
          nameEn: "Money Heist",
          originalName: "La Casa de Papel",
          type: "series",
          series: "2",
          episode: "4",
          year: null,
        });
      });

      it("returns undefined for invalid ID format", async () => {
        const result = await findShowInfoInTmdb("series", "1396");

        expect(result).toBeUndefined();
      });
    });
  });
});
