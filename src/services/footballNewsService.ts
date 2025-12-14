const axios = require("axios");

const IMPORTANT_KEYWORDS = [
  "Premier League",
  "La Liga",
  "Serie A",
  "Bundesliga",
  "Champions League",
  "Europa League",
  "transfer",
  "signing",
  "loan",
  "contract",
  "injury",
  "Manchester",
  "Arsenal",
  "Chelsea",
  "Liverpool",
  "Tottenham",
  "Real Madrid",
  "Barcelona",
  "Atletico",
  "Juventus",
  "Inter",
  "Milan",
  "Napoli",
  "Bayern",
  "Dortmund",
];

function pickImage(a: any) {
  const url = a?.urlToImage || a?.imageUrl || a?.image || null;
  if (!url) return null;
  if (typeof url !== "string") return null;
  if (!url.startsWith("http")) return null;
  return url;
}

function isImportant(a: any) {
  const text = `${a?.title || ""} ${a?.description || ""}`.toLowerCase();
  return IMPORTANT_KEYWORDS.some((k) => text.includes(k.toLowerCase()));
}

async function fetchLatestFootballNews() {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    throw new Error("NEWS_API_KEY missing");
  }

  // Use "everything" with good sources to avoid junk
  const sources = [
    "bbc-sport",
    "the-guardian-uk",
    "espn",
    "four-four-two",
    "talksport",
  ].join(",");

  const q =
    'football AND ( "Premier League" OR "La Liga" OR "Serie A" OR Bundesliga OR "Champions League" OR "Europa League" OR transfer OR transfers )';

  const url = "https://newsapi.org/v2/everything";

  const res = await axios.get(url, {
    params: {
      apiKey,
      q,
      sources,
      language: "en",
      sortBy: "publishedAt",
      pageSize: 40,
    },
  });

  const raw = res?.data?.articles || [];

  const mapped = raw
    .filter((a: any) => a?.title && a?.url)
    .map((a: any, idx: number) => ({
      id: a.url || String(idx),
      title: a.title,
      description: a.description || "",
      url: a.url,
      imageUrl: pickImage(a),
      sourceName: a?.source?.name || "",
      publishedAt: a.publishedAt,
    }))
    .filter((a: any) => isImportant(a));

  return mapped;
}

module.exports = { fetchLatestFootballNews };