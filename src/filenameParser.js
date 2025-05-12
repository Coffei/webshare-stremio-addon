function extractLanguage(filename) {
  // Mapping of language codes to standardized format
  const languageMap = {
    // Czech variations - prioritizing these as requested
    CZECH: "CZ",
    CZ: "CZ",
    CZE: "CZ",
    CS: "CZ",
    CES: "CZ",
    ČEŠTINA: "CZ",
    ČESKY: "CZ",
    CZDAB: "CZ",

    // English variations
    EN: "EN",
    ENG: "EN",

    // Slovak variations
    SLOVAK: "SK",
    SLOVENSKY: "SK",
    SK: "SK",
    SLO: "SK",
    SLK: "SK",
    SLOVENČINA: "SK",
    SKDAB: "SK",
  };

  // Split language codes into short (2-3 chars) and long codes for more precise matching
  const langCodes = Object.keys(languageMap).sort((a, b) => b.length - a.length);

  // First check for subtitle patterns - these take priority
  const subtitleKeywords = ["tit", "titulky", "subs", "sub"];
  const audioKeywords = ["audio", "dabing", "dub"];
  const allKeywords = [...subtitleKeywords, ...audioKeywords];

  // Unified patterns array for all language-detecting regexes, each using capturing groups
  // Use non-alphanumeric boundaries to avoid false positives and ensure correct matches
  const patterns = {
    // Subtitle or audio keywords with language (e.g., titulky CZ, CZ titulky)
    subtitleRegex: new RegExp(
      `(?:${allKeywords.join("|")})[^a-zA-Z0-9]+(${langCodes.join("|")})(?:[^a-zA-Z0-9]|$)|(?:^|[^a-zA-Z0-9])(${langCodes.join(
        "|"
      )})[^a-zA-Z0-9]+(?:${allKeywords.join("|")})(?:[^a-zA-Z0-9]|$)`,
      "gi"
    ),
    // Concatenated format (e.g., CZSub, CZaudio) - only match if at start
    concatenatedRegex: new RegExp(`(?:^|[^a-zA-Z0-9])(${langCodes.join("|")})(?:${allKeywords.join("|")})(?:[^a-zA-Z0-9]|$)`, "gi"),
    // Must be entirely isolated (surrounded by spaces, punctuation, or string boundaries)
    // [^a-zA-Z0-9] caused some false positives
    generalRegex: new RegExp(`(?:^|[\\s.,;:!?\\-_\\[\\]()])(${langCodes.join("|")})(?=[\\s.,;:!?\\-_\\[\\](]|$)`, "gi"),
  };

  // Store all found languages
  const foundLanguages = new Set();
  const subtitleLangs = new Set();

  // Try to match each pattern and collect all language codes from capturing groups
  for (const [patternName, pattern] of Object.entries(patterns)) {
    const matches = [...filename.matchAll(pattern)];
    for (const match of matches) {
      for (let i = 1; i < match.length; i++) {
        const lang = match[i] ? match[i].toUpperCase() : null;
        if (lang && languageMap[lang]) {
          // If this is the subtitle/audio pattern (index 0), check for subtitle keyword
          if (patternName === "subtitleRegex") {
            const matchStr = match[0].toLowerCase();
            const hasSubtitleKeyword = subtitleKeywords.some((kw) => matchStr.includes(kw));
            if (hasSubtitleKeyword) {
              foundLanguages.add(`${languageMap[lang]} titulky`);
              subtitleLangs.add(languageMap[lang]);
              continue;
            }
          }
          // Only add plain language code if not already marked as 'titulky'
          if (!subtitleLangs.has(languageMap[lang])) {
            foundLanguages.add(languageMap[lang]);
          }
        }
      }
    }
  }

  // Return all found languages joined by "|" or null if none found
  return foundLanguages.size > 0 ? Array.from(foundLanguages).sort().join("|") : null;
}

function extractSeasonEpisode(filename) {
  // Handle standard S01E01 and 1x01 formats with various separators
  // Updated: allow any non-alphanumeric characters as separators
  const standardRegex =
    /(?:^|[^a-zA-Z0-9])(?:(?:s|season\s*)(\d{1,2})[^a-zA-Z0-9]*(?:e|ep|episode\s*)(\d{1,3})|(\d{1,2})[^a-zA-Z0-9]*(?:x|×)[^a-zA-Z0-9]*(\d{1,3}))(?:[^a-zA-Z0-9]|$)/i;

  // Handle episode-only and part-based formats with unified regex
  // Matches: e01, ep 01, episode 01, #01, part 1, pt 1, part.1, pt.1, etc.
  // Now handles any non-alphanumeric delimiter between prefix and number
  const episodeOrPartRegex = /(?:^|[^a-zA-Z0-9])(?:(?:e|ep|episode|#|part|pt)[^a-zA-Z0-9]*(\d{1,3}))(?:[^a-zA-Z0-9]|$)/i;

  // Try each regex in order of specificity
  let match = filename.match(standardRegex);
  if (match) {
    if (match[1] && match[2]) {
      return { season: parseInt(match[1], 10), episode: parseInt(match[2], 10) };
    } else if (match[3] && match[4]) {
      return { season: parseInt(match[3], 10), episode: parseInt(match[4], 10) };
    }
  }

  match = filename.match(episodeOrPartRegex);
  if (match) {
    return { season: 1, episode: parseInt(match[1], 10) }; // Assume season 1 for episode-only or part-based
  }

  return null; // No match found
}

module.exports = { extractLanguage, extractSeasonEpisode };
