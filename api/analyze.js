export const config = { maxDuration: 20 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const feeds = [
    { name: 'Reuters',     url: 'https://feeds.reuters.com/reuters/businessNews' },
    { name: 'BBC Business',url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
    { name: 'CNBC',        url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664' },
    { name: 'MarketWatch', url: 'https://feeds.marketwatch.com/marketwatch/topstories/' },
    { name: 'FT',          url: 'https://www.ft.com/rss/home' },
  ];

  const headlines = [];
  await Promise.all(feeds.map(async feed => {
    try {
      const r = await fetch(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml, text/xml' },
        signal: AbortSignal.timeout(6000)
      });
      if (!r.ok) return;
      const text = await r.text();
      const matches = text.match(/<item[\s\S]*?<\/item>/g) || [];
      matches.slice(0, 4).forEach(item => {
        const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]>/)?.[1] || item.match(/<title>(.*?)<\/title>/)?.[1] || '').trim();
        const link  = (item.match(/<link>(.*?)<\/link>/)?.[1] || item.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] || '').trim();
        const date  = (item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '').trim();
        if (title && title.length > 10) headlines.push({ source: feed.name, title, link, date });
      });
    } catch(e) {}
  }));

  if (headlines.length === 0) {
    return res.status(503).json({ error: 'Nepodařilo se načíst zprávy. Zkuste za chvíli.' });
  }

  // Vrátí pouze zprávy - Claude analýzu provede browser
  return res.status(200).json({ headlines: headlines.slice(0, 20) });
}
