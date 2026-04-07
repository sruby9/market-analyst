export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 1. Sesbírej zprávy z RSS feedů serverside
  const feeds = [
    { name: 'Reuters',     url: 'https://feeds.reuters.com/reuters/businessNews' },
    { name: 'BBC Business',url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
    { name: 'CNBC',        url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664' },
    { name: 'MarketWatch', url: 'https://feeds.marketwatch.com/marketwatch/topstories/' },
    { name: 'FT',          url: 'https://www.ft.com/rss/home' },
    { name: 'Bloomberg',   url: 'https://feeds.bloomberg.com/markets/news.rss' },
  ];

  const headlines = [];
  await Promise.all(feeds.map(async feed => {
    try {
      const r = await fetch(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml, application/xml, text/xml' },
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
    } catch(e) { /* skip failed feed */ }
  }));

  if (headlines.length === 0) {
    return res.status(503).json({ error: 'Nepodařilo se načíst zprávy. Zkuste za chvíli.' });
  }

  // 2. Připrav kontext pro Claudea
  const newsContext = headlines.slice(0, 20).map((h, i) =>
    `${i+1}. [${h.source}] ${h.title}`
  ).join('\n');

  const today = new Date().toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });

  const prompt = `Jsi zkušený investiční analytik. Dnes je ${today}.

Toto jsou aktuální zprávy ze světa za posledních 24 hodin:

${newsContext}

Na základě těchto zpráv proveď analýzu dopadu na investice. Odpověz POUZE validním JSON (žádný text mimo JSON):

{
  "summary": "2-3 věty: co se dnes děje ve světě a ekonomice",
  "sentiment": "Býčí|Medvědí|Neutrální|Smíšený",
  "sentiment_reason": "1 věta proč",
  "impacts": [
    {
      "category": "název kategorie (např. Technologie ETF, Emerging Markets, Energie, Zdravotnictví, Dluhopisy, USD, Zlato...)",
      "ticker_examples": "např. QQQ, XLK",
      "direction": "pozitivní|negativní|neutrální|smíšený",
      "strength": 1-5,
      "reasoning": "2-3 věty konkrétního zdůvodnění proč tato kategorie reaguje takto"
    }
  ],
  "key_risks": ["riziko 1", "riziko 2", "riziko 3"],
  "opportunities": ["příležitost 1", "příležitost 2"],
  "headline_count": ${headlines.length}
}

Uveď 5-8 kategorií impacts. Buď konkrétní a odkaž na konkrétní zprávy z přehledu.`;

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!claudeRes.ok) throw new Error('Claude API ' + claudeRes.status);
    const d = await claudeRes.json();
    const text = d.content?.find(b => b.type === 'text')?.text || '';
    const json = JSON.parse(text.replace(/```json|```/g, '').trim());

    return res.status(200).json({ analysis: json, headlines: headlines.slice(0, 20) });
  } catch(e) {
    console.error('Analysis error:', e);
    return res.status(500).json({ error: 'Chyba analýzy: ' + e.message });
  }
}
