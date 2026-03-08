// app/api/news/route.js
// Fetch financial news from Yahoo Finance for given symbols

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const symbols = searchParams.get('symbols')
  const general = searchParams.get('general')

  try {
    let allNews = []

    if (general === 'true') {
      // General market news
      const queries = ['bourse france', 'marchés financiers europe', 'économie actualités']
      for (const q of queries) {
        try {
          const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&newsCount=5&quotesCount=0&listsCount=0&lang=fr-FR&region=FR`
          const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
          const data = await res.json()
          if (data.news) allNews.push(...data.news)
        } catch (e) {}
      }
    }

    if (symbols) {
      const symList = symbols.split(',').slice(0, 10)
      for (const sym of symList) {
        try {
          const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(sym)}&newsCount=3&quotesCount=0&listsCount=0&lang=fr-FR&region=FR`
          const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
          const data = await res.json()
          if (data.news) allNews.push(...data.news.map(n => ({ ...n, relatedSymbol: sym })))
        } catch (e) {}
      }
    }

    // Deduplicate by title
    const seen = new Set()
    const unique = allNews.filter(n => {
      if (!n.title || seen.has(n.title)) return false
      seen.add(n.title)
      return true
    })

    const results = unique.slice(0, 20).map(n => ({
      title: n.title || '',
      link: n.link || '',
      publisher: n.publisher || '',
      publishedAt: n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toISOString() : '',
      thumbnail: n.thumbnail?.resolutions?.[0]?.url || '',
      relatedSymbol: n.relatedSymbol || '',
    }))

    return Response.json({ news: results })
  } catch (error) {
    console.error('News error:', error)
    return Response.json({ news: [] })
  }
}
