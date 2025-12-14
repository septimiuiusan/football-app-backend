import axios from "axios";
export async function fetchLatestFootballNews() {
    const apiKey = process.env.FOOTBALL_NEWS_API_KEY;
    if (!apiKey)
        throw new Error("Missing FOOTBALL_NEWS_API_KEY");
    const url = "https://newsapi.org/v2/everything";
    const params = {
        q: "football OR soccer",
        language: "en",
        sortBy: "publishedAt",
        pageSize: 10,
        apiKey,
    };
    const res = await axios.get(url, { params });
    const articles = res.data.articles || [];
    return articles.map((a) => ({
        id: a.url,
        title: a.title,
        description: a.description,
        url: a.url,
        sourceName: a.source?.name || "",
        publishedAt: a.publishedAt,
    }));
}
