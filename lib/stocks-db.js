// lib/stocks-db.js
// Complete database of PEA-eligible stocks and ETFs
// Yahoo Finance symbols

export const STOCKS = [
  // ── CAC 40 ──
  { symbol: "MC.PA", name: "LVMH", sector: "Luxe", region: "France" },
  { symbol: "OR.PA", name: "L'Oréal", sector: "Conso. Cyclique", region: "France" },
  { symbol: "AI.PA", name: "Air Liquide", sector: "Industrie", region: "France" },
  { symbol: "SAN.PA", name: "Sanofi", sector: "Santé", region: "France" },
  { symbol: "TTE.PA", name: "TotalEnergies", sector: "Énergie", region: "France" },
  { symbol: "BNP.PA", name: "BNP Paribas", sector: "Finance", region: "France" },
  { symbol: "SU.PA", name: "Schneider Electric", sector: "Industrie", region: "France" },
  { symbol: "DG.PA", name: "Vinci", sector: "Industrie", region: "France" },
  { symbol: "CS.PA", name: "AXA", sector: "Finance", region: "France" },
  { symbol: "RI.PA", name: "Pernod Ricard", sector: "Conso. Défensive", region: "France" },
  { symbol: "AIR.PA", name: "Airbus", sector: "Industrie", region: "France" },
  { symbol: "SAF.PA", name: "Safran", sector: "Industrie", region: "France" },
  { symbol: "BN.PA", name: "Danone", sector: "Conso. Défensive", region: "France" },
  { symbol: "DSY.PA", name: "Dassault Systèmes", sector: "Technologie", region: "France" },
  { symbol: "STM.PA", name: "STMicroelectronics", sector: "Technologie", region: "France" },
  { symbol: "SGO.PA", name: "Saint-Gobain", sector: "Industrie", region: "France" },
  { symbol: "CAP.PA", name: "Capgemini", sector: "Technologie", region: "France" },
  { symbol: "EL.PA", name: "EssilorLuxottica", sector: "Santé", region: "France" },
  { symbol: "KER.PA", name: "Kering", sector: "Luxe", region: "France" },
  { symbol: "HO.PA", name: "Thales", sector: "Industrie", region: "France" },
  { symbol: "EN.PA", name: "Bouygues", sector: "Industrie", region: "France" },
  { symbol: "VIE.PA", name: "Veolia", sector: "Services", region: "France" },
  { symbol: "ENGI.PA", name: "Engie", sector: "Énergie", region: "France" },
  { symbol: "GLE.PA", name: "Société Générale", sector: "Finance", region: "France" },
  { symbol: "LR.PA", name: "Legrand", sector: "Industrie", region: "France" },
  { symbol: "ACA.PA", name: "Crédit Agricole", sector: "Finance", region: "France" },
  { symbol: "TEP.PA", name: "Teleperformance", sector: "Technologie", region: "France" },
  { symbol: "ML.PA", name: "Michelin", sector: "Conso. Cyclique", region: "France" },
  { symbol: "ORA.PA", name: "Orange", sector: "Télécom", region: "France" },
  { symbol: "CA.PA", name: "Carrefour", sector: "Conso. Défensive", region: "France" },
  { symbol: "PUB.PA", name: "Publicis", sector: "Communication", region: "France" },
  { symbol: "ERF.PA", name: "Eurofins", sector: "Santé", region: "France" },
  { symbol: "RMS.PA", name: "Hermès", sector: "Luxe", region: "France" },
  { symbol: "VIV.PA", name: "Vivendi", sector: "Communication", region: "France" },
  { symbol: "URW.PA", name: "Unibail-Rodamco", sector: "Immobilier", region: "France" },
  { symbol: "MT.AS", name: "ArcelorMittal", sector: "Matériaux", region: "France" },
  { symbol: "RNO.PA", name: "Renault", sector: "Conso. Cyclique", region: "France" },
  { symbol: "STLAM.MI", name: "Stellantis", sector: "Conso. Cyclique", region: "France" },

  // ── SBF 120 & Mid Caps ──
  { symbol: "SW.PA", name: "Sodexo", sector: "Services", region: "France" },
  { symbol: "FGR.PA", name: "Eiffage", sector: "Industrie", region: "France" },
  { symbol: "ALO.PA", name: "Alstom", sector: "Industrie", region: "France" },
  { symbol: "SOI.PA", name: "Soitec", sector: "Technologie", region: "France" },
  { symbol: "AKE.PA", name: "Arkema", sector: "Matériaux", region: "France" },
  { symbol: "RXL.PA", name: "Rexel", sector: "Industrie", region: "France" },
  { symbol: "ILD.PA", name: "Iliad", sector: "Télécom", region: "France" },
  { symbol: "AM.PA", name: "Amundi", sector: "Finance", region: "France" },
  { symbol: "BIM.PA", name: "bioMérieux", sector: "Santé", region: "France" },
  { symbol: "EDEN.PA", name: "Edenred", sector: "Technologie", region: "France" },
  { symbol: "FDJ.PA", name: "FDJ", sector: "Conso. Cyclique", region: "France" },
  { symbol: "GTT.PA", name: "GTT", sector: "Énergie", region: "France" },
  { symbol: "DIM.PA", name: "Sartorius Stedim", sector: "Santé", region: "France" },
  { symbol: "AF.PA", name: "Air France-KLM", sector: "Industrie", region: "France" },
  { symbol: "NEX.PA", name: "Nexans", sector: "Industrie", region: "France" },
  { symbol: "UBI.PA", name: "Ubisoft", sector: "Technologie", region: "France" },
  { symbol: "GFC.PA", name: "Gecina", sector: "Immobilier", region: "France" },
  { symbol: "NK.PA", name: "Imerys", sector: "Matériaux", region: "France" },
  { symbol: "RCO.PA", name: "Rémy Cointreau", sector: "Conso. Défensive", region: "France" },

  // ── Allemagne ──
  { symbol: "SAP.DE", name: "SAP", sector: "Technologie", region: "Allemagne" },
  { symbol: "SIE.DE", name: "Siemens", sector: "Industrie", region: "Allemagne" },
  { symbol: "ALV.DE", name: "Allianz", sector: "Finance", region: "Allemagne" },
  { symbol: "DTE.DE", name: "Deutsche Telekom", sector: "Télécom", region: "Allemagne" },
  { symbol: "MBG.DE", name: "Mercedes-Benz", sector: "Conso. Cyclique", region: "Allemagne" },
  { symbol: "BMW.DE", name: "BMW", sector: "Conso. Cyclique", region: "Allemagne" },
  { symbol: "BAS.DE", name: "BASF", sector: "Matériaux", region: "Allemagne" },
  { symbol: "MUV2.DE", name: "Munich Re", sector: "Finance", region: "Allemagne" },
  { symbol: "IFX.DE", name: "Infineon", sector: "Technologie", region: "Allemagne" },
  { symbol: "ADS.DE", name: "Adidas", sector: "Conso. Cyclique", region: "Allemagne" },
  { symbol: "RHM.DE", name: "Rheinmetall", sector: "Industrie", region: "Allemagne" },
  { symbol: "VOW3.DE", name: "Volkswagen", sector: "Conso. Cyclique", region: "Allemagne" },
  { symbol: "EOAN.DE", name: "E.ON", sector: "Énergie", region: "Allemagne" },
  { symbol: "DB1.DE", name: "Deutsche Börse", sector: "Finance", region: "Allemagne" },
  { symbol: "DHL.DE", name: "DHL Group", sector: "Industrie", region: "Allemagne" },
  { symbol: "HEN3.DE", name: "Henkel", sector: "Conso. Défensive", region: "Allemagne" },
  { symbol: "BEI.DE", name: "Beiersdorf", sector: "Conso. Défensive", region: "Allemagne" },
  { symbol: "ZAL.DE", name: "Zalando", sector: "Conso. Cyclique", region: "Allemagne" },
  { symbol: "CON.DE", name: "Continental", sector: "Conso. Cyclique", region: "Allemagne" },
  { symbol: "FRE.DE", name: "Fresenius", sector: "Santé", region: "Allemagne" },

  // ── Pays-Bas ──
  { symbol: "ASML.AS", name: "ASML Holding", sector: "Technologie", region: "Pays-Bas" },
  { symbol: "PHIA.AS", name: "Philips", sector: "Santé", region: "Pays-Bas" },
  { symbol: "AD.AS", name: "Ahold Delhaize", sector: "Conso. Défensive", region: "Pays-Bas" },
  { symbol: "INGA.AS", name: "ING Group", sector: "Finance", region: "Pays-Bas" },
  { symbol: "WKL.AS", name: "Wolters Kluwer", sector: "Technologie", region: "Pays-Bas" },
  { symbol: "UNA.AS", name: "Unilever", sector: "Conso. Défensive", region: "Pays-Bas" },
  { symbol: "ASM.AS", name: "ASM International", sector: "Technologie", region: "Pays-Bas" },
  { symbol: "AKZA.AS", name: "Akzo Nobel", sector: "Matériaux", region: "Pays-Bas" },

  // ── Belgique ──
  { symbol: "ABI.BR", name: "AB InBev", sector: "Conso. Défensive", region: "Belgique" },
  { symbol: "UCB.BR", name: "UCB", sector: "Santé", region: "Belgique" },
  { symbol: "KBC.BR", name: "KBC Groupe", sector: "Finance", region: "Belgique" },
  { symbol: "SOLB.BR", name: "Solvay", sector: "Matériaux", region: "Belgique" },

  // ── Italie ──
  { symbol: "ENEL.MI", name: "Enel", sector: "Énergie", region: "Italie" },
  { symbol: "ISP.MI", name: "Intesa Sanpaolo", sector: "Finance", region: "Italie" },
  { symbol: "UCG.MI", name: "UniCredit", sector: "Finance", region: "Italie" },
  { symbol: "ENI.MI", name: "ENI", sector: "Énergie", region: "Italie" },
  { symbol: "RACE.MI", name: "Ferrari", sector: "Luxe", region: "Italie" },
  { symbol: "G.MI", name: "Generali", sector: "Finance", region: "Italie" },
  { symbol: "PRY.MI", name: "Prysmian", sector: "Industrie", region: "Italie" },

  // ── Espagne ──
  { symbol: "SAN.MC", name: "Banco Santander", sector: "Finance", region: "Espagne" },
  { symbol: "IBE.MC", name: "Iberdrola", sector: "Énergie", region: "Espagne" },
  { symbol: "ITX.MC", name: "Inditex", sector: "Conso. Cyclique", region: "Espagne" },
  { symbol: "BBVA.MC", name: "BBVA", sector: "Finance", region: "Espagne" },
  { symbol: "TEF.MC", name: "Telefonica", sector: "Télécom", region: "Espagne" },
  { symbol: "AENA.MC", name: "Aena", sector: "Industrie", region: "Espagne" },

  // ── Nordiques ──
  { symbol: "NOVO-B.CO", name: "Novo Nordisk", sector: "Santé", region: "Danemark" },
  { symbol: "DSV.CO", name: "DSV", sector: "Industrie", region: "Danemark" },
  { symbol: "CARL-B.CO", name: "Carlsberg", sector: "Conso. Défensive", region: "Danemark" },
  { symbol: "NOKIA.HE", name: "Nokia", sector: "Technologie", region: "Finlande" },
  { symbol: "NESTE.HE", name: "Neste", sector: "Énergie", region: "Finlande" },
  { symbol: "SAMPO.HE", name: "Sampo", sector: "Finance", region: "Finlande" },
  { symbol: "VOLV-B.ST", name: "Volvo", sector: "Industrie", region: "Suède" },
  { symbol: "ATCO-A.ST", name: "Atlas Copco", sector: "Industrie", region: "Suède" },

  // ── Portugal / Irlande ──
  { symbol: "GALP.LS", name: "Galp Energia", sector: "Énergie", region: "Portugal" },
  { symbol: "CRH", name: "CRH", sector: "Matériaux", region: "Irlande" },
]

export const ETFS = [
  // ── Monde ──
  { symbol: "CW8.PA", name: "Amundi MSCI World", sector: "ETF Monde", region: "Monde" },
  { symbol: "EWLD.PA", name: "Lyxor PEA Monde", sector: "ETF Monde", region: "Monde" },
  { symbol: "MWRD.PA", name: "Amundi MSCI World DR", sector: "ETF Monde", region: "Monde" },

  // ── USA ──
  { symbol: "500.PA", name: "Amundi PEA S&P 500", sector: "ETF US", region: "USA" },
  { symbol: "PSP5.PA", name: "Lyxor PEA S&P 500", sector: "ETF US", region: "USA" },
  { symbol: "PE500.PA", name: "Amundi PEA S&P 500 ESG", sector: "ETF US", region: "USA" },
  { symbol: "PUST.PA", name: "Lyxor PEA Nasdaq-100", sector: "ETF US", region: "USA" },
  { symbol: "PANX.PA", name: "Amundi PEA Nasdaq-100", sector: "ETF US", region: "USA" },
  { symbol: "RS2K.PA", name: "Amundi Russell 2000 PEA", sector: "ETF US Small", region: "USA" },

  // ── Europe ──
  { symbol: "C50.PA", name: "Amundi Euro Stoxx 50", sector: "ETF Europe", region: "Europe" },
  { symbol: "MSE.PA", name: "Amundi MSCI Europe", sector: "ETF Europe", region: "Europe" },
  { symbol: "CAC.PA", name: "Amundi CAC 40", sector: "ETF France", region: "France" },
  { symbol: "SMAE.PA", name: "Amundi EMU Small Cap", sector: "ETF Small Cap", region: "Europe" },
  { symbol: "CD9.PA", name: "Amundi DAX UCITS", sector: "ETF Allemagne", region: "Allemagne" },
  { symbol: "LCUK.PA", name: "Amundi PEA FTSE UK", sector: "ETF UK", region: "UK" },

  // ── Émergents ──
  { symbol: "PAEEM.PA", name: "Amundi PEA Emerging", sector: "ETF Émergent", region: "Émergents" },
  { symbol: "PLEM.PA", name: "Lyxor PEA Émergents", sector: "ETF Émergent", region: "Émergents" },

  // ── Asie ──
  { symbol: "PJAP.PA", name: "Amundi PEA Japan TOPIX", sector: "ETF Japon", region: "Japon" },
  { symbol: "PAASI.PA", name: "Amundi PEA Asie Pac", sector: "ETF Asie", region: "Asie" },

  // ── Sectoriels ──
  { symbol: "TNO.PA", name: "Amundi MSCI World IT", sector: "ETF Techno", region: "Monde" },
  { symbol: "HLT.PA", name: "Amundi MSCI World Health", sector: "ETF Santé", region: "Monde" },
  { symbol: "BNKE.PA", name: "Amundi Euro Stoxx Banks", sector: "ETF Finance", region: "Europe" },
  { symbol: "CRB.PA", name: "Lyxor Commodities", sector: "ETF Matières", region: "Monde" },

  // ── ESG / Thématique ──
  { symbol: "PANW.PA", name: "Amundi PEA World SRI", sector: "ETF ESG", region: "Monde" },
  { symbol: "EESM.PA", name: "BNP Easy Europe SRI", sector: "ETF ESG", region: "Europe" },
]

export const ALL_SECURITIES = [
  ...STOCKS.map(s => ({ ...s, type: 'Action' })),
  ...ETFS.map(s => ({ ...s, type: 'ETF' })),
]
