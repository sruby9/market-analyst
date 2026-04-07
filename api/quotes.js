export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'symbols required' });

  const fields = 'regularMarketPrice,regularMarketChange,regularMarketChangePercent,fiftyTwoWeekLow,fiftyTwoWeekHigh,trailingPE,shortName,marketCap,regularMarketVolume';
  
  const sources = [
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&fields=${fields}`,
    `https://query2.finance.yahoo.com/v8/finance/quote?symbols=${encodeURIComponent(symbols)}&fields=${fields}`,
  ];

  for (const url of sources) {
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Referer': 'https://finance.yahoo.com',
        }
      });
      if (!r.ok) continue;
      const data = await r.json();
      const result = data.quoteResponse?.result;
      if (result?.length) {
        return res.status(200).json({ result });
      }
    } catch(e) {
      console.error('Source failed:', url, e.message);
    }
  }
  
  return res.status(503).json({ error: 'All sources unavailable' });
}
