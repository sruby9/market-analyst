export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const sources = [
    { name: 'Reuters',      url: 'https://feeds.reuters.com/reuters/businessNews' },
    { name: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
    { name: 'CNBC',         url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664' },
    { name: 'MarketWatch',  url: 'https://feeds.marketwatch.com/marketwatch/topstories/' },
  ];

  const results = [];
  
  await Promise.all(sources.map(async src => {
    try {
      const r = await fetch(src.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!r.ok) return;
      const text = await r.text();
      // Simple XML parsing
      const items = text.match(/<item>[\s\S]*?<\/item>/g) || [];
      items.slice(0, 2).forEach(item => {
        const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] 
                   || item.match(/<title>(.*?)<\/title>/)?.[1] || '';
        const link = item.match(/<link>(.*?)<\/link>/)?.[1]
                  || item.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] || '#';
        const date = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
        if (title.trim()) results.push({ source: src.name, title: title.trim(), link: link.trim(), date });
      });
    } catch(e) {
      console.error('News fail:', src.name, e.message);
    }
  }));

  return res.status(200).json({ items: results.slice(0, 8) });
}
