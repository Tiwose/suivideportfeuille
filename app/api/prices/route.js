// app/api/prices/route.js
// API route that fetches real-time prices from Yahoo Finance
// Called by the frontend to get current stock/ETF prices

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const symbols = searchParams.get('symbols')

  if (!symbols) {
    return Response.json({ error: 'No symbols provided' }, { status: 400 })
  }

  const symbolList = symbols.split(',').map(s => s.trim()).slice(0, 50)

  try {
    // Yahoo Finance v8 API - free, no key needed
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbolList.join(',')}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,marketCap,trailingPE,epsTrailingTwelveMonths,dividendYield,trailingAnnualDividendRate,fiftyTwoWeekHigh,fiftyTwoWeekLow,beta,averageVolume,currency`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      next: { revalidate: 60 } // cache 60 seconds
    })

    if (!response.ok) {
      // Fallback: try v8 quote endpoint
      return await fetchFallback(symbolList)
    }

    const data = await response.json()
    const quotes = data.quoteResponse?.result || []

    const prices = {}
    quotes.forEach(q => {
      prices[q.symbol] = {
        price: q.regularMarketPrice || null,
        change: q.regularMarketChange || 0,
        changePct: q.regularMarketChangePercent || 0,
        marketCap: q.marketCap || null,
        per: q.trailingPE || null,
        eps: q.epsTrailingTwelveMonths || null,
        dividendYield: q.dividendYield ? (q.dividendYield * 100) : null,
        dividend: q.trailingAnnualDividendRate || null,
        high52: q.fiftyTwoWeekHigh || null,
        low52: q.fiftyTwoWeekLow || null,
        beta: q.beta || null,
        volume: q.averageVolume || null,
        currency: q.currency || 'EUR'
      }
    })

    return Response.json({ prices, timestamp: new Date().toISOString() })

  } catch (error) {
    console.error('Yahoo Finance error:', error)
    return Response.json({ error: 'Failed to fetch prices' }, { status: 500 })
  }
}

// Fallback using Yahoo Finance v8 chart API
async function fetchFallback(symbols) {
  const prices = {}

  for (const symbol of symbols.slice(0, 20)) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
      const data = await res.json()
      const meta = data.chart?.result?.[0]?.meta

      if (meta) {
        prices[symbol] = {
          price: meta.regularMarketPrice || null,
          change: (meta.regularMarketPrice || 0) - (meta.previousClose || 0),
          changePct: meta.previousClose
            ? (((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100)
            : 0,
          currency: meta.currency || 'EUR'
        }
      }
    } catch (e) {
      console.error(`Failed for ${symbol}:`, e.message)
    }
  }

  return Response.json({ prices, timestamp: new Date().toISOString() })
}
