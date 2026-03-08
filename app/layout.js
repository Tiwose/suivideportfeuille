import './globals.css'

export const metadata = {
  title: 'PortfolioLab — Gestion PEA',
  description: 'Gérez votre portefeuille PEA avec des données en temps réel',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-bg text-slate-200">
        {children}
      </body>
    </html>
  )
}
