// app/api/search/route.js
// Search any stock, ETF, crypto, commodity on Yahoo Finance

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query || query.length < 1) {
    return Response.json({ results: [] })
  }

  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=15&newsCount=0&listsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query&lang=fr-FR&region=FR`

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })

    if (!res.ok) {
      return Response.json({ results: [] })
    }

    const data = await res.json()
    const quotes = data.quotes || []

    const results = quotes
      .filter(q => q.symbol && q.shortname)
      .map(q => {
        // Determine type
        let type = 'Action'
        const qtype = (q.quoteType || '').toUpperCase()
        if (qtype === 'ETF') type = 'ETF'
        else if (qtype === 'CRYPTOCURRENCY') type = 'Crypto'
        else if (qtype === 'FUTURE' || qtype === 'COMMODITY') type = 'Matière première'
        else if (qtype === 'INDEX') type = 'Indice'
        else if (qtype === 'MUTUALFUND') type = 'OPCVM'
        else if (qtype === 'CURRENCY') type = 'Devise'

        // Determine region from exchange
        const exchange = (q.exchange || '').toUpperCase()
        let region = 'Autre'
        if (exchange.includes('PAR')) region = 'France'
        else if (exchange.includes('GER') || exchange.includes('FRA') || exchange.includes('XETRA')) region = 'Allemagne'
        else if (exchange.includes('AMS')) region = 'Pays-Bas'
        else if (exchange.includes('BRU')) region = 'Belgique'
        else if (exchange.includes('MIL')) region = 'Italie'
        else if (exchange.includes('MCE') || exchange.includes('MAD')) region = 'Espagne'
        else if (exchange.includes('LSE') || exchange.includes('LON')) region = 'UK'
        else if (exchange.includes('NAS') || exchange.includes('NYQ') || exchange.includes('NYSE') || exchange.includes('NMS')) region = 'USA'
        else if (exchange.includes('CCC') || exchange.includes('CRYPTO')) region = 'Crypto'
        else if (exchange.includes('HEL')) region = 'Finlande'
        else if (exchange.includes('CPH') || exchange.includes('CSE')) region = 'Danemark'
        else if (exchange.includes('STO')) region = 'Suède'
        else if (exchange.includes('VIE')) region = 'Autriche'
        else if (exchange.includes('SWX') || exchange.includes('EBS')) region = 'Suisse'
        else if (exchange.includes('TYO') || exchange.includes('JPX')) region = 'Japon'
        else if (exchange.includes('HKG')) region = 'Hong Kong'

        // Determine sector hint from type
        let sector = type
        if (type === 'ETF') {
          const name = (q.shortname || '').toLowerCase()
          if (name.includes('world') || name.includes('msci w') || name.includes('acwi')) sector = 'ETF Monde'
          else if (name.includes('s&p') || name.includes('500') || name.includes('nasdaq') || name.includes('russell') || name.includes('us ')) sector = 'ETF US'
          else if (name.includes('euro') || name.includes('stoxx') || name.includes('europe')) sector = 'ETF Europe'
          else if (name.includes('emerg')) sector = 'ETF Émergent'
          else if (name.includes('japan') || name.includes('topix') || name.includes('nikkei')) sector = 'ETF Japon'
          else if (name.includes('china') || name.includes('asia')) sector = 'ETF Asie'
          else if (name.includes('tech') || name.includes('info')) sector = 'ETF Techno'
          else if (name.includes('health') || name.includes('pharma')) sector = 'ETF Santé'
          else if (name.includes('financ') || name.includes('bank')) sector = 'ETF Finance'
          else if (name.includes('energy') || name.includes('oil')) sector = 'ETF Énergie'
          else if (name.includes('gold') || name.includes('commod') || name.includes('material')) sector = 'ETF Matières'
          else if (name.includes('bond') || name.includes('oblig') || name.includes('treasury')) sector = 'ETF Oblig'
          else if (name.includes('esg') || name.includes('sri') || name.includes('sustain')) sector = 'ETF ESG'
          else if (name.includes('small')) sector = 'ETF Small Cap'
          else if (name.includes('cac') || name.includes('france')) sector = 'ETF France'
          else if (name.includes('dax') || name.includes('germany')) sector = 'ETF Allemagne'
        }

        return {
          symbol: q.symbol,
          name: q.shortname || q.longname || q.symbol,
          type,
          sector,
          region,
          exchange: q.exchDisp || q.exchange || '',
        }
      })

    return Response.json({ results })

  } catch (error) {
    console.error('Search error:', error)
    return Response.json({ results: [] })
  }
}
