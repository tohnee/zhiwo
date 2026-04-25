function extractTagValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? match[1].trim() : "";
}

export async function loadRssFeed(feedUrl, fetchFeed = async (url) => (await fetch(url)).text()) {
  const xml = await fetchFeed(feedUrl);
  const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];

  return itemMatches.map((match, index) => {
    const itemXml = match[1];
    return {
      id: `rss-${index + 1}`,
      title: extractTagValue(itemXml, "title"),
      link: extractTagValue(itemXml, "link"),
      publishedAt: extractTagValue(itemXml, "pubDate")
    };
  });
}
