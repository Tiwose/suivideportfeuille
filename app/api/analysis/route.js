// app/api/analysis/route.js
// Goldman Sachs-style equity research report via Anthropic API

export async function POST(request) {
  const { symbol, name } = await request.json()
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return Response.json({ error: 'Clé API Anthropic non configurée. Ajoutez ANTHROPIC_API_KEY dans vos variables d\'environnement.' }, { status: 500 })
  }

  if (!symbol || !name) {
    return Response.json({ error: 'Symbol et nom requis' }, { status: 400 })
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Vous êtes un analyste senior en recherche sur les actions chez Goldman Sachs, doté de 20 ans d'expérience dans l'évaluation d'entreprises pour la division de gestion d'actifs.

Analysez : ${name} (${symbol})

Fournissez une analyse complète couvrant :
1. **NOTATION SOMMAIRE** : Note globale (Achat/Neutre/Vente), conviction (1-10), objectif de cours 12 mois
2. **Modèle d'affaires** : comment l'entreprise gagne de l'argent, expliqué simplement
3. **Flux de revenus** : chaque segment avec sa contribution en % et trajectoire de croissance
4. **Rentabilité** : tendances des marges (brute, opérationnelle, nette) sur 5 ans
5. **Bilan** : ratio dette/capitaux propres, position de trésorerie vs dette totale
6. **Cash-flow libre** : rendement du FCF, taux de croissance, allocation du capital
7. **Avantages concurrentiels** : pouvoir de prix, marque, coûts de changement (note /10)
8. **Valorisation** : P/E, P/S, EV/EBITDA vs moyenne 5 ans et pairs secteur
9. **Scénario haussier et baissier** : avec objectifs de prix 12 mois pour chacun
10. **Verdict** : acheter, conserver ou éviter avec le niveau de conviction

Recherchez les données les plus récentes sur le web. Répondez en français. Formatez en texte structuré avec des sections claires.`
        }]
      })
    })

    const data = await res.json()
    const text = (data.content || [])
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n')

    return Response.json({ analysis: text })

  } catch (error) {
    console.error('Analysis error:', error)
    return Response.json({ error: 'Erreur lors de l\'analyse' }, { status: 500 })
  }
}
