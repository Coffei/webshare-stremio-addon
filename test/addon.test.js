const pkg = require("../package.json");
const request = require("supertest");
const express = require("express");
const webshare = require("../src/webshare");
const { searchStreams } = require("../src/streams");
const app = require("../src/addon");
const { findShowInfo } = require("../src/meta");

jest.mock("../src/webshare");
jest.mock("../src/streams", () => ({ searchStreams: jest.fn() }));
jest.mock("../src/meta", () => ({ findShowInfo: jest.fn() }));

describe("GET /getUrl/:ident", () => {
  const ident = "test-ident";
  const token = "test-token";
  const fakeUrl = "https://webshare.cz/file/test";
  let server;

  beforeAll(() => {
    // Wrap the app in a server for supertest
    server = express();
    server.use(app);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls webshare.getUrl with correct params and redirects to returned URL", async () => {
    webshare.getUrl.mockResolvedValueOnce(fakeUrl);

    const res = await request(server)
      .get(`/getUrl/${ident}?token=${token}`)
      .expect(302);

    expect(webshare.getUrl).toHaveBeenCalledWith(ident, token);
    expect(res.headers.location).toBe(fakeUrl);
  });

  it("sets correct caching headers", async () => {
    webshare.getUrl.mockResolvedValueOnce(fakeUrl);

    const before = new Date();
    const res = await request(server)
      .get(`/getUrl/${ident}?token=${token}`)
      .expect(302);

    const expires = new Date(res.headers["expires"]);
    const lastModified = new Date(res.headers["last-modified"]);
    const cacheControl = res.headers["cache-control"];

    // Expires should be about 5 hours after last-modified
    expect(Math.abs(expires - lastModified - 5 * 60 * 60 * 1000)).toBeLessThan(
      2000,
    ); // allow 2s drift
    expect(Math.abs(lastModified - before)).toBeLessThan(5000); // allow 5s drift

    expect(cacheControl).toBe(
      "max-age=18000, must-revalidate, proxy-revalidate",
    );
  });

  it("returns 404 for missing ident param", async () => {
    // Route requires :ident, so /getUrl/ should 404
    const res = await request(server).get(`/getUrl/`).expect(404);
  });
});

describe("POST /configure", () => {
  const login = "testuser";
  const password = "testpass";
  const saltedPassword = "salted-testpass";
  const token = "test-token";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("salts password, logs in, and redirects with config if successful", async () => {
    webshare.saltPassword.mockResolvedValueOnce(saltedPassword);
    webshare.login.mockResolvedValueOnce(token);

    const res = await request(app)
      .post("/configure")
      .type("form")
      .send({ login, password });

    expect(webshare.saltPassword).toHaveBeenCalledWith(login, password);
    expect(webshare.login).toHaveBeenCalledWith(login, saltedPassword);

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^stremio:\/\//);

    // Check config in redirect URL
    const match = res.headers.location.match(
      /stremio:\/\/[^/]+\/([^/]+)\/manifest\.json/,
    );
    expect(match).toBeTruthy();
    const config = JSON.parse(decodeURIComponent(match[1]));
    expect(config).toEqual({ login, saltedPassword, enableSearch: false });
  });

  it("includes enableSearch true in config when checkbox is checked", async () => {
    webshare.saltPassword.mockResolvedValueOnce(saltedPassword);
    webshare.login.mockResolvedValueOnce(token);

    const res = await request(app)
      .post("/configure")
      .type("form")
      .send({ login, password, enableSearch: "on" });

    expect(res.status).toBe(302);
    const match = res.headers.location.match(
      /stremio:\/\/[^/]+\/([^/]+)\/manifest\.json/,
    );
    const config = JSON.parse(decodeURIComponent(match[1]));
    expect(config.enableSearch).toBe(true);
  });

  it("includes enableSearch false in config when checkbox is unchecked", async () => {
    webshare.saltPassword.mockResolvedValueOnce(saltedPassword);
    webshare.login.mockResolvedValueOnce(token);

    const res = await request(app)
      .post("/configure")
      .type("form")
      .send({ login, password });

    expect(res.status).toBe(302);
    const match = res.headers.location.match(
      /stremio:\/\/[^/]+\/([^/]+)\/manifest\.json/,
    );
    const config = JSON.parse(decodeURIComponent(match[1]));
    expect(config.enableSearch).toBe(false);
  });

  it("renders landing page with error if login fails", async () => {
    webshare.saltPassword.mockResolvedValueOnce(saltedPassword);
    webshare.login.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post("/configure")
      .type("form")
      .send({ login, password });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toMatch(/<html/i);
    expect(res.text).toMatch(new RegExp(login));
    expect(res.text).toContain("Login credentials are incorrect.");
  });

  it("renders landing page with error if saltPassword throws", async () => {
    webshare.saltPassword.mockRejectedValueOnce(new Error("fail"));

    const res = await request(app)
      .post("/configure")
      .type("form")
      .send({ login, password });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toMatch(/<html/i);
    expect(res.text).toMatch(new RegExp(login));
    expect(res.text).toContain("Login credentials are incorrect.");
  });
});

describe("Stream search handler", () => {
  const type = "movie";
  const id = "tt1234567";
  const info = { id, type, title: "Test Movie" };
  const login = "testuser";
  const password = "testpass";
  const saltedPassword = "salted-testpass";
  const wsToken = "test-token";
  const streams = [
    { url: "https://webshare.cz/file/1", title: "Stream 1" },
    { url: "https://webshare.cz/file/2", title: "Stream 2" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns streams when password is provided in config", async () => {
    // Mock meta and webshare
    findShowInfo.mockResolvedValue(info);
    webshare.saltPassword.mockResolvedValueOnce(saltedPassword);
    webshare.login.mockResolvedValueOnce(wsToken);
    searchStreams.mockResolvedValueOnce(streams);

    // Use /stream endpoint as defined by stremio-addon-sdk
    const config = encodeURIComponent(JSON.stringify({ login, password }));
    const res = await request(app)
      .get(`/${config}/stream/${type}/${id}.json`)
      .expect(200);

    expect(webshare.saltPassword).toHaveBeenCalledWith(login, password);
    expect(webshare.login).toHaveBeenCalledWith(login, saltedPassword);
    expect(searchStreams).toHaveBeenCalledWith(info, wsToken);
    expect(res.body).toHaveProperty("streams");
    expect(res.body.streams).toEqual(streams);
  });

  it("returns streams when saltedPassword is provided in config", async () => {
    findShowInfo.mockResolvedValue(info);
    webshare.login.mockResolvedValueOnce(wsToken);
    searchStreams.mockResolvedValueOnce(streams);

    const config = encodeURIComponent(
      JSON.stringify({ login, saltedPassword }),
    );
    const res = await request(app)
      .get(`/${config}/stream/${type}/${id}.json`)
      .expect(200);

    expect(webshare.saltPassword).not.toHaveBeenCalled();
    expect(webshare.login).toHaveBeenCalledWith(login, saltedPassword);
    expect(searchStreams).toHaveBeenCalledWith(info, wsToken);
    expect(res.body.streams).toEqual(streams);
  });

  it("returns empty streams if findShowInfo returns null", async () => {
    findShowInfo.mockResolvedValue(null);

    const config = encodeURIComponent(JSON.stringify({ login, password }));
    const res = await request(app)
      .get(`/${config}/stream/${type}/${id}.json`)
      .expect(200);

    expect(res.body).toHaveProperty("streams");
    expect(res.body.streams).toEqual([]);
  });

  it("returns empty streams if searchStreams throws", async () => {
    findShowInfo.mockResolvedValue(info);
    webshare.saltPassword.mockResolvedValueOnce(saltedPassword);
    webshare.login.mockResolvedValueOnce(wsToken);
    searchStreams.mockRejectedValueOnce(new Error("fail"));

    const config = encodeURIComponent(JSON.stringify({ login, password }));
    const res = await request(app)
      .get(`/${config}/stream/${type}/${id}.json`)
      .expect(200);

    expect(res.body).toHaveProperty("streams");
    expect(res.body.streams).toEqual([]);
  });

  it("returns empty streams if webshare.login throws", async () => {
    findShowInfo.mockResolvedValue(info);
    webshare.saltPassword.mockResolvedValueOnce(saltedPassword);
    webshare.login.mockRejectedValueOnce(new Error("fail"));

    const config = encodeURIComponent(JSON.stringify({ login, password }));
    const res = await request(app)
      .get(`/${config}/stream/${type}/${id}.json`)
      .expect(200);

    expect(res.body).toHaveProperty("streams");
    expect(res.body.streams).toEqual([]);
  });

  it("resturns a single stream for internal catalog items", async () => {
    webshare.login.mockResolvedValueOnce(wsToken);
    const config = encodeURIComponent(
      JSON.stringify({ login, saltedPassword }),
    );
    const res = await request(app)
      .get(`/${config}/stream/movie/coffei.webshare%3A123.json`)
      .expect(200);

    expect(res.body.streams).toEqual([
      {
        ident: "123",
        url: `https://20317bf4c6c6-webshare-stremio-addon.baby-beamup.club/getUrl/123?token=${wsToken}`,
      },
    ]);

    expect(webshare.login).toHaveBeenCalledWith(login, saltedPassword);
  });
});

describe("GET /manifest.json", () => {
  it("returns the addon manifest", async () => {
    const res = await request(app).get("/manifest.json").expect(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("name");
    expect(res.body).toHaveProperty("types");
    expect(res.body).toHaveProperty("version");

    expect(res.body.id).toBe("community.coffei.webshare");
    expect(res.body.name).toBe("Webshare.cz");
    expect(res.body.types).toEqual(["movie", "series"]);
    expect(res.body.version).toBe(pkg.version);
  });
});

describe("Catalog handler", () => {
  const login = "testuser";
  const password = "123456";
  const saltedPassword = "salted-testpass";
  const wsToken = "test-token";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns found items as movies using a password", async () => {
    const config = encodeURIComponent(JSON.stringify({ login, password }));
    webshare.saltPassword.mockResolvedValueOnce(saltedPassword);
    webshare.login.mockResolvedValueOnce(wsToken);
    webshare.search.mockResolvedValueOnce([
      {
        ident: "123",
        name: "A.mkv",
        posVotes: 1,
        negVotes: 2,
        img: "a.jpg",
        size: 100,
        language: "en",
      },
      {
        ident: "987",
        name: "B.mkv",
        posVotes: 0,
        negVotes: 0,
        img: "b.jpg",
        size: 5120,
        language: "cs",
      },
    ]);

    const res = await request(app)
      .get(`/${config}/catalog/movie/direct/search=test.json`)
      .expect(200);
    expect(res.body.metas).toEqual([
      {
        id: "coffei.webshare:123",
        name: "A.mkv",
        poster: "a.jpg",
        type: "movie",
      },
      {
        id: "coffei.webshare:987",
        name: "B.mkv",
        poster: "b.jpg",
        type: "movie",
      },
    ]);

    expect(webshare.saltPassword).toHaveBeenCalledWith(login, password);
    expect(webshare.search).toHaveBeenCalledWith("test", wsToken);
  });

  it("returns empty metas when enableSearch is false", async () => {
    const config = encodeURIComponent(
      JSON.stringify({ login, saltedPassword, enableSearch: false }),
    );

    const res = await request(app)
      .get(`/${config}/catalog/movie/direct/search=test.json`)
      .expect(200);

    expect(res.body.metas).toEqual([]);
    expect(webshare.search).not.toHaveBeenCalled();
  });

  it("returns results when enableSearch is true", async () => {
    const config = encodeURIComponent(
      JSON.stringify({ login, saltedPassword, enableSearch: true }),
    );
    webshare.login.mockResolvedValueOnce(wsToken);
    webshare.search.mockResolvedValueOnce([
      {
        ident: "123",
        name: "A.mkv",
        posVotes: 1,
        negVotes: 2,
        img: "a.jpg",
        size: 100,
        language: "en",
      },
    ]);

    const res = await request(app)
      .get(`/${config}/catalog/movie/direct/search=test.json`)
      .expect(200);

    expect(res.body.metas).toEqual([
      {
        id: "coffei.webshare:123",
        name: "A.mkv",
        poster: "a.jpg",
        type: "movie",
      },
    ]);
    expect(webshare.search).toHaveBeenCalledWith("test", wsToken);
  });

  it("returns results when enableSearch is missing from config (backward compat)", async () => {
    const config = encodeURIComponent(
      JSON.stringify({ login, saltedPassword }),
    );
    webshare.login.mockResolvedValueOnce(wsToken);
    webshare.search.mockResolvedValueOnce([
      {
        ident: "456",
        name: "C.mkv",
        posVotes: 0,
        negVotes: 0,
        img: "c.jpg",
        size: 200,
        language: "cs",
      },
    ]);

    const res = await request(app)
      .get(`/${config}/catalog/movie/direct/search=test.json`)
      .expect(200);

    expect(res.body.metas).toEqual([
      {
        id: "coffei.webshare:456",
        name: "C.mkv",
        poster: "c.jpg",
        type: "movie",
      },
    ]);
    expect(webshare.search).toHaveBeenCalledWith("test", wsToken);
  });

  it("returns found items as movies using a salted password", async () => {
    const config = encodeURIComponent(
      JSON.stringify({ login, saltedPassword }),
    );
    webshare.login.mockResolvedValueOnce(wsToken);
    webshare.search.mockResolvedValueOnce([
      {
        ident: "123",
        name: "A.mkv",
        posVotes: 1,
        negVotes: 2,
        img: "a.jpg",
        size: 100,
        language: "en",
      },
      {
        ident: "987",
        name: "B.mkv",
        posVotes: 0,
        negVotes: 0,
        img: "b.jpg",
        size: 5120,
        language: "cs",
      },
    ]);

    const res = await request(app)
      .get(`/${config}/catalog/movie/direct/search=test.json`)
      .expect(200);
    expect(res.body.metas).toEqual([
      {
        id: "coffei.webshare:123",
        name: "A.mkv",
        poster: "a.jpg",
        type: "movie",
      },
      {
        id: "coffei.webshare:987",
        name: "B.mkv",
        poster: "b.jpg",
        type: "movie",
      },
    ]);

    expect(webshare.search).toHaveBeenCalledWith("test", wsToken);
  });
});

describe("Meta handler", () => {
  const login = "testuser";
  const password = "123456";
  const saltedPassword = "salted-testpass";
  const wsToken = "test-token";

  it("returns info about a file using a password", async () => {
    const config = encodeURIComponent(JSON.stringify({ login, password }));
    webshare.saltPassword.mockResolvedValueOnce(saltedPassword);
    webshare.login.mockResolvedValueOnce(wsToken);
    webshare.getById.mockResolvedValueOnce({
      ident: "123",
      name: "A file",
      filename: "a_file.mkv",
      description: "Some nice file",
      posVotes: 10,
      negVotes: 2,
      stripe: "background.png",
      size: 1020,
      language: "en,cs",
    });

    const res = await request(app).get(
      `/${config}/meta/movie/coffei.webshare%3A123.json`,
    );
    expect(res.body.meta).toEqual({
      id: "coffei.webshare:123",
      type: "movie",
      name: "A file",
      poster: "background.png",
      background: "background.png",
      description: "Some nice file",
      website: "https://webshare.cz/#/file/123",
    });
    expect(webshare.saltPassword).toHaveBeenCalledWith(login, password);
    expect(webshare.getById).toHaveBeenCalledWith("123", wsToken);
  });

  it("returns info about a file using a salted password", async () => {
    const config = encodeURIComponent(
      JSON.stringify({ login, saltedPassword }),
    );
    webshare.login.mockResolvedValueOnce(wsToken);
    webshare.getById.mockResolvedValueOnce({
      ident: "123",
      name: "A file",
      filename: "a_file.mkv",
      description: "Some nice file",
      posVotes: 10,
      negVotes: 2,
      stripe: "background.png",
      size: 1020,
      language: "en,cs",
    });

    const res = await request(app).get(
      `/${config}/meta/movie/coffei.webshare%3A123.json`,
    );
    expect(res.body.meta).toEqual({
      id: "coffei.webshare:123",
      type: "movie",
      name: "A file",
      poster: "background.png",
      background: "background.png",
      description: "Some nice file",
      website: "https://webshare.cz/#/file/123",
    });
    expect(webshare.getById).toHaveBeenCalledWith("123", wsToken);
  });
});
