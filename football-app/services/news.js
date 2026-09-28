import { XMLParser } from "fast-xml-parser";
import { footballFetch } from "./footballApi";

const NEWS_FEEDS = [
  {
    sourceKey: "bbc",
    source: "BBC Football",
  },
  {
    sourceKey: "sky",
    source: "Sky Sports Football",
  },
];

const KEYWORDS = [
  "football",
  "soccer",
  "Premier League",
  "Champions League",
  "Bundesliga",
  "Eredivisie",
  "Serie A",
  "Ligue 1",
  "La Liga",
  "Championship",
  "Primeira Liga",
  "Arsenal",
  "Chelsea",
  "Liverpool",
  "Manchester United",
  "Manchester City",
  "Tottenham",
  "Barcelona",
  "Real Madrid",
  "Bayern",
  "Dortmund",
  "PSG",
  "Inter",
  "Milan",
  "Juventus",
];

function cleanText(value) {
  if (!value) return "";

  return String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function normalizeItems(items) {
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

function attributeUrl(value) {
  if (!value) return "";

  if (Array.isArray(value)) {
    return value.map(attributeUrl).find(Boolean) || "";
  }

  if (typeof value === "string") return value;

  return (
    value["@_url"] ||
    value["@_href"] ||
    value.url ||
    value.href ||
    ""
  );
}

function imageFromHtml(value) {
  return (
    String(value || "").match(
      /<img[^>]+src=["']([^"']+)["']/i
    )?.[1] || ""
  );
}

function feedItemImage(item) {
  return (
    attributeUrl(item["media:content"]) ||
    attributeUrl(item["media:thumbnail"]) ||
    attributeUrl(item.enclosure) ||
    imageFromHtml(item.description) ||
    imageFromHtml(item["content:encoded"]) ||
    ""
  );
}

async function articleImage(link) {
  if (!link) return "";

  try {
    const response = await footballFetch(
      `/news/image?url=${encodeURIComponent(link)}`
    );

    if (!response.ok) return "";

    const data = await response.json();
    return data.image || "";
  } catch {
    return "";
  }
}

function removeDuplicates(news) {
  const seen = new Set();

  return news.filter((item) => {
    const key = item.title
      ?.toLowerCase()
      .trim();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export async function getFootballNews() {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
    });

    const allNews = [];

    for (const feed of NEWS_FEEDS) {
      try {
        const response = await footballFetch(
          `/news/feed?source=${feed.sourceKey}`
        );

        if (!response.ok) {
          console.log(
            "NEWS FEED FAILED:",
            feed.sourceKey,
            response.status
          );
          continue;
        }

        const xml = await response.text();
        const data = parser.parse(xml);

        const channel =
          data?.rss?.channel;

        const items = normalizeItems(
          channel?.item
        );

        items.forEach((item) => {
          const title = cleanText(
            item.title
          );

          const description = cleanText(
            item.description
          );

          const link =
            typeof item.link === "string"
              ? item.link
              : item.link?.["#text"] || "";

          const text =
            `${title} ${description}`.toLowerCase();

          const isRelevant =
            KEYWORDS.some((word) =>
              text.includes(
                word.toLowerCase()
              )
            );

          if (title && isRelevant) {
            allNews.push({
              title,
              description,
              link,
              date:
                item.pubDate ||
                item["dc:date"] ||
                "",
              source:
                feed.source ||
                channel?.title ||
                "Football News",
              image: feedItemImage(item),
            });
          }
        });
      } catch (feedError) {
        console.log(
          "SINGLE NEWS FEED ERROR:",
          feed.sourceKey,
          feedError
        );
      }
    }

    const uniqueNews =
      removeDuplicates(allNews);

    return Promise.all(
      uniqueNews.slice(0, 12).map(async (item) => ({
        ...item,
        image: item.image || (await articleImage(item.link)),
      }))
    );
  } catch (error) {
    console.log("NEWS ERROR:", error);
    return [];
  }
}
