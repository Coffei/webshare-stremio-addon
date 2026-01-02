const webshare = require("../src/webshare");
const needle = require("needle");
const { saltPassword } = require("../src/webshare");

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

test("password is salted properly", async () => {
  const mockResponse = {
    body: { children: [{ name: "salt", value: "tEKKLoRT" }] },
  };
  needle.mockImplementation(() => mockResponse);
  const password = "testing";
  const salted = await saltPassword("test", password);
  expect(salted).toEqual("1ae7b498bbb0b1213b1c0b139519106ced268019");
});

test("long password can be salted", async () => {
  const mockResponse = { body: { children: [{ name: "salt", value: "123" }] } };
  needle.mockImplementation(() => mockResponse);
  const password =
    "1234567890123456789012345678901234567890123456789012345678901234567890";

  const salted = await saltPassword("test", password);
  expect(salted).toEqual("643b35f611c8f38f4cb42fe39551f49e4ec60521");
});
