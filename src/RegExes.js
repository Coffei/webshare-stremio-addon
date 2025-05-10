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
    ENGLISH: "EN",
    EN: "EN",
    ENG: "EN",

    // Slovak variations
    SLOVAK: "SK",
    SK: "SK",
    SLO: "SK",
    SLK: "SK",
    SLOVENČINA: "SK",
    SKDAB: "SK",
  };

  // Create a regex pattern for all language codes (word boundaries for short codes)
  const langCodes = Object.keys(languageMap).sort((a, b) => b.length - a.length); // Sort by length for better matching

  // Direct check for comma-separated language codes
  const commaRegex = new RegExp(`(${langCodes.join("|")}),(${langCodes.join("|")})`, "i");
  const commaMatch = filename.match(commaRegex);
  if (commaMatch) {
    const foundLanguages = new Set();
    const parts = commaMatch[0].split(",");
    for (const part of parts) {
      const lang = part.trim().toUpperCase();
      if (languageMap[lang]) {
        foundLanguages.add(languageMap[lang]);
      }
    }
    if (foundLanguages.size > 0) {
      return Array.from(foundLanguages).sort().join("|");
    }
  }

  // Direct check for multiple space-separated language codes (like "CZ SK EN")
  const spaceRegex = new RegExp(`\\b(${langCodes.join("|")})\\s+(${langCodes.join("|")})(?:\\s+(${langCodes.join("|")}))?\\b`, "i");
  const spaceMatch = filename.match(spaceRegex);
  if (spaceMatch) {
    const foundLanguages = new Set();
    const parts = spaceMatch[0].split(/\s+/);
    for (const part of parts) {
      const lang = part.trim().toUpperCase();
      if (languageMap[lang]) {
        foundLanguages.add(languageMap[lang]);
      }
    }
    if (foundLanguages.size > 0) {
      return Array.from(foundLanguages).sort().join("|");
    }
  }

  // First check for subtitle patterns - these take priority
  const subtitleKeywords = ["tit", "titulky", "subs", "sub"];
  const audioKeywords = ["audio", "dabing", "dub"];
  const allKeywords = [...subtitleKeywords, ...audioKeywords];

  const subtitlePattern = new RegExp(
    `(?:${allKeywords.join("|")})[\\s_\\.]*(?:${langCodes.join("|")})|(?:${langCodes.join("|")})[\\s_\\.]*(?:${allKeywords.join("|")})`,
    "i"
  );

  const subtitleMatch = filename.match(subtitlePattern);
  if (subtitleMatch) {
    // Extract all words from the match
    const words = subtitleMatch[0].split(/[\s_\.]+/);
    // Find the language code in the words
    for (const word of words) {
      const cleanWord = word.replace(/[^a-zA-Z]/g, "").toUpperCase();
      if (languageMap[cleanWord]) {
        // Check if it's an audio format
        const isAudio = audioKeywords.some((keyword) => subtitleMatch[0].toLowerCase().includes(keyword));
        return isAudio ? languageMap[cleanWord] : `${languageMap[cleanWord]} titulky`;
      }
    }
  }

  // Also check for concatenated format (e.g., CZSub, CZaudio)
  const concatenatedPattern = new RegExp(`(?:${langCodes.join("|")})(?:${allKeywords.join("|")})`, "i");
  const concatenatedMatch = filename.match(concatenatedPattern);
  if (concatenatedMatch) {
    const match = concatenatedMatch[0];
    // Try to find the language code at the start
    for (const code of langCodes) {
      if (match.toUpperCase().startsWith(code)) {
        // Check if it's an audio format
        const isAudio = audioKeywords.some((keyword) => match.toLowerCase().includes(keyword));
        return isAudio ? languageMap[code] : `${languageMap[code]} titulky`;
      }
    }
  }

  // Common patterns for language markers in torrent filenames
  const patterns = [
    // Match multiple languages at the end of filename (before extension)
    new RegExp(
      `(?:${langCodes.join("|")})(?:\\.(?:${langCodes.join(
        "|"
      )}))*(?=\\.(?:mkv|mp4|avi|mov|wmv|flv|webm|m4v|ts|mts|m2ts|vob|ogm|ogv|asf|rm|rmvb|3gp|3g2|f4v|f4p|f4a|f4b)$)`,
      "i"
    ),

    // Standalone language codes with delimiters
    new RegExp(`[\\[\\(\\.](?:${langCodes.join("|")})[\\.\\)\\]\\-\\_]`, "i"),

    // Language codes at end of string
    new RegExp(`[\\[\\(\\.](?:${langCodes.join("|")})$`, "i"),

    // Language codes after a dash or space
    new RegExp(`\\s(?:${langCodes.join("|")})[\\.\\s\\)\\]\\-\\_]`, "i"),

    // Language as a standalone tag [LANG] or (LANG)
    new RegExp(`[\\[\\(](?:${langCodes.join("|")})[\\)\\]]`, "i"),

    // Handle dual audio or multi language tags
    new RegExp(`(?:DUAL|MULTI)[\\-\\.\\s](?:${langCodes.join("|")})`, "i"),

    // For completeness, also try to match bare language names surrounded by separators
    new RegExp(`[^a-zA-Z0-9](?:${langCodes.join("|")})[^a-zA-Z0-9]`, "i"),

    // Match language codes separated by hyphens or underscores
    new RegExp(`(?:${langCodes.join("|")})(?:\\-|_)(?:${langCodes.join("|")})(?:\\-|_)?(?:${langCodes.join("|")})?`, "i"),
  ];

  // Store all found languages
  const foundLanguages = new Set();

  // Try to match each pattern
  for (const pattern of patterns) {
    const matches = [...filename.matchAll(new RegExp(pattern, "gi"))];
    for (const match of matches) {
      // Extract just the language code part without delimiters
      const rawMatch = match[0]
        .replace(/[\[\]\(\)\.\-\_\s]/g, " ")
        .trim()
        .toUpperCase();

      // Split by spaces to handle multiple languages in one match
      const possibleLangs = rawMatch.split(/[\s\-_]+/);

      for (const lang of possibleLangs) {
        if (languageMap[lang]) {
          foundLanguages.add(languageMap[lang]);
        }
      }
    }
  }

  // Direct check for common language patterns with separators
  const directLanguagePattern = /(?:SK|CZ|EN)(?:\-|_|\.)(?:SK|CZ|EN)(?:\-|_|\.)?(?:SK|CZ|EN)?/i;
  const directMatch = filename.match(directLanguagePattern);
  if (directMatch) {
    const langs = directMatch[0].split(/[\-_\.]/);
    for (const lang of langs) {
      if (languageMap[lang.toUpperCase()]) {
        foundLanguages.add(languageMap[lang.toUpperCase()]);
      }
    }
  }

  // Return all found languages joined by "|" or null if none found
  return foundLanguages.size > 0 ? Array.from(foundLanguages).sort().join("|") : null;
}

function extractSeasonEpisode(filename) {
  // Handle standard S01E01 and 1x01 formats with various separators
  const standardRegex =
    /(?:^|[^a-zA-Z0-9])(?:(?:s|season\s*)(\d{1,2})(?:\s*(?:\.|\-|_|\s|$))?\s*(?:e|ep|episode\s*)(\d{1,3})|(\d{1,2})(?:x|\s*×\s*)(\d{1,3}))(?:[^a-zA-Z0-9]|$)/i;

  // Handle numeric format like 101, 102 (season 1, episode 01, 02)
  // const numericRegex = /(?:^|[^a-zA-Z0-9])([1-9])(\d{2})(?:[^a-zA-Z0-9]|$)/; //commeted due to false positives

  // Handle episode-only formats with fallback to season 1
  const episodeOnlyRegex = /(?:^|[^a-zA-Z0-9])(?:(?:e|ep|episode|#)\s*)(\d{1,3})(?:[^a-zA-Z0-9]|$)/i;

  // Handle part-based formats
  const partRegex = /(?:^|[^a-zA-Z0-9])(?:part|pt)\s*\.?\s*(\d{1,2})(?:[^a-zA-Z0-9]|$)/i;

  // Try each regex in order of specificity
  let match = filename.match(standardRegex);
  if (match) {
    if (match[1] && match[2]) {
      return { season: parseInt(match[1], 10), episode: parseInt(match[2], 10) };
    } else if (match[3] && match[4]) {
      return { season: parseInt(match[3], 10), episode: parseInt(match[4], 10) };
    }
  }

  // match = filename.match(numericRegex);
  // if (match) {
  //   return { season: parseInt(match[1], 10), episode: parseInt(match[2], 10) };
  // }

  match = filename.match(episodeOnlyRegex);
  if (match) {
    return { season: 1, episode: parseInt(match[1], 10) }; // Assume season 1 for episode-only
  }

  match = filename.match(partRegex);
  if (match) {
    return { season: 1, episode: parseInt(match[1], 10) }; // Assume season 1 for parts
  }

  return null; // No match found
}

module.exports = { extractLanguage, extractSeasonEpisode };
