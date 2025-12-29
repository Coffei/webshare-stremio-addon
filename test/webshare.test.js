const webshare = require("../src/webshare");
const needle = require("needle");

jest.mock("needle");

// Tests for stream-related functions have been moved to streams.test.js
// This file now only contains tests for the raw Webshare API webshare.js

test("search returns raw results from API", async () => {
  const mockResponse = {
    body: {
      children: [
        {
          name: "file",
          children: [
            { name: "ident", value: "abc123" },
            { name: "name", value: "Test.Movie.2024.mkv" },
            { name: "size", value: "1000000" },
            { name: "positive_votes", value: "5" },
            { name: "negative_votes", value: "1" },
          ],
        },
      ],
    },
  };

  needle.mockImplementation(() => mockResponse);

  const results = await webshare.search("test query", "token123");

  expect(results.length).toBe(1);
  expect(results[0].ident).toBe("abc123");
  expect(results[0].name).toBe("Test.Movie.2024.mkv");
  expect(results[0].size).toBe(1000000);
  expect(results[0].posVotes).toBe("5");
  expect(results[0].negVotes).toBe("1");
});
