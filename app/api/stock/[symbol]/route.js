// app/api/stock/[symbol]/route.js
// Detailed stock data from Yahoo Finance

export async function GET(request, { params }) {
  const symbol = params.symbol

  if (!symbol) {
    return Response.json({ error: 'No symbol' }, { status: 400 })
  }

  try {
    // Fetch quote data
    const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,marketCap,trailingPE,forwardPE,epsTrailingTwelveMonths,epsForward,dividendYield,trailingAnnualDividendRate,exDividendDate,fiftyTwoWeekHigh,fiftyTwoWeekLow,beta,averageVolume,regularMarketVolume,fiftyDayAverage,twoHundredDayAverage,currency,longName,shortName,sector,industry,earningsTimestamp,targetMeanPrice,recommendationMean,recommendationKey,numberOfAnalystOpinions`

    const res = await fetch(quoteUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 300 }
    })

    const data = await res.json()
    const q = data.quoteResponse?.result?.[0]

    if (!q) {
      return Response.json({ error: 'Symbol not found' }, { status: 404 })
    }

    // Map recommendation to French
    const consensusMap = {
      'strong_buy': 'Achat fort',
      'buy': 'Achat',
      'hold': 'Neutre',
      'sell': 'Vente',
      'strong_sell': 'Vente forte'
    }

    const result = {
      symbol: q.symbol,
      name: q.longName || q.shortName || symbol,
      price: q.regularMarketPrice,
      change: q.regularMarketChange,
      changePct: q.regularMarketChangePercent,
      currency: q.currency || 'EUR',

      // Fundamentals
      per: q.trailingPE || q.forwardPE || null,
      forwardPer: q.forwardPE || null,
      eps: q.epsTrailingTwelveMonths || null,
      epsForward: q.epsForward || null,
      marketCap: q.marketCap || null,
      beta: q.beta || null,

      // Dividends
      dividend: q.trailingAnnualDividendRate || null,
      dividendYield: q.dividendYield ? (q.dividendYield * 100).toFixed(2) : null,
      exDividendDate: q.exDividendDate
        ? new Date(q.exDividendDate * 1000).toISOString().split('T')[0]
        : null,

      // Ranges
      high52: q.fiftyTwoWeekHigh || null,
      low52: q.fiftyTwoWeekLow || null,
      avg50: q.fiftyDayAverage || null,
      avg200: q.twoHundredDayAverage || null,

      // Volume
      volume: q.regularMarketVolume || null,
      avgVolume: q.averageVolume || null,

      // Analyst
      consensus: consensusMap[q.recommendationKey] || null,
      targetPrice: q.targetMeanPrice || null,
      analystCount: q.numberOfAnalystOpinions || null,

      // Earnings
      nextEarnings: q.earningsTimestamp
        ? new Date(q.earningsTimestamp * 1000).toISOString().split('T')[0]
        : null,

      // Technical (calculated)
      support: q.fiftyTwoWeekLow
        ? Math.round((q.regularMarketPrice - (q.regularMarketPrice - q.fiftyTwoWeekLow) * 0.3) * 100) / 100
        : null,
      resistance: q.fiftyTwoWeekHigh
        ? Math.round((q.regularMarketPrice + (q.fiftyTwoWeekHigh - q.regularMarketPrice) * 0.3) * 100) / 100
        : null,

      // Sector
      sector: q.sector || null,
      industry: q.industry || null,

      timestamp: new Date().toISOString()
    }

    return Response.json(result)

  } catch (error) {
    console.error('Stock detail error:', error)
    return Response.json({ error: 'Failed to fetch stock data' }, { status: 500 })
  }
}
