'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, signUp, signIn, signOut, getUser, getPositions, addPosition, deletePosition } from '../lib/supabase'
import { ALL_SECURITIES } from '../lib/stocks-db'

// ── Sector / Region colors ──
const SC = {"Luxe":"#D4AF37","Conso. Cyclique":"#4ECDC4","Industrie":"#95A5A6","Santé":"#E74C3C","Énergie":"#F39C12","Finance":"#3498DB","Technologie":"#9B59B6","Télécom":"#1ABC9C","Conso. Défensive":"#27AE60","Communication":"#E67E22","Matériaux":"#8E44AD","Immobilier":"#2C3E50","Services":"#16A085","ETF Monde":"#2980B9","ETF US":"#3498DB","ETF Europe":"#1F618D","ETF Émergent":"#D35400","ETF Japon":"#C0392B","ETF Asie":"#E74C3C","ETF Techno":"#8E44AD","ETF Finance":"#2471A3","ETF ESG":"#1E8449","ETF US Small":"#2471A3","ETF France":"#002395","ETF Allemagne":"#DD0000","ETF Small Cap":"#AF601A","ETF Santé":"#E74C3C","ETF Matières":"#B7950B","ETF UK":"#2E4053"}
const RC = {"France":"#002395","Allemagne":"#DD0000","Pays-Bas":"#FF6B00","Belgique":"#FDDA24","Danemark":"#C8102E","Italie":"#009246","Espagne":"#AA151B","Finlande":"#003580","Europe":"#003399","Monde":"#22d3ee","USA":"#3C3B6E","Émergents":"#D35400","Japon":"#BC002D","Asie":"#DE2910","Suède":"#006AA7","Portugal":"#006600","Irlande":"#169B62","UK":"#012169"}

// ── Fetch real prices from Yahoo Finance via our API route ──
async function fetchPrices(symbols) {
  try {
    const res = await fetch('/api/prices?symbols=' + symbols.join(','))
    const data = await res.json()
    return data.prices || {}
  } catch (e) {
    console.error('Price fetch error:', e)
    return {}
  }
}

async function fetchStockDetail(symbol) {
  try {
    const res = await fetch('/api/stock/' + symbol)
    if (!res.ok) return null
    return await res.json()
  } catch (e) {
    console.error('Detail fetch error:', e)
    return null
  }
}

export default function Home() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('dashboard')
  const [positions, setPositions] = useState([])
  const [prices, setPrices] = useState({})
  const [priceLoading, setPriceLoading] = useState(false)
  const [lastFetch, setLastFetch] = useState(null)
  const [selSym, setSelSym] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' })
  const [authErr, setAuthErr] = useState('')
  const [proj, setProj] = useState({ initial: 10000, monthly: 500, years: 20, rate: 8 })

  // ── Check session on load ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        loadPositions(session.user.id)
      }
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        loadPositions(session.user.id)
      } else {
        setUser(null)
        setPositions([])
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadPositions = async (userId) => {
    const { data } = await getPositions(userId)
    setPositions(data || [])
  }

  // ── Get price: live or fallback ──
  const gp = useCallback((sym) => {
    if (prices[sym]?.price != null) return prices[sym].price
    // No fallback needed - Yahoo will provide real prices
    return 0
  }, [prices])

  // ── Refresh prices from Yahoo Finance ──
  const refresh = useCallback(async () => {
    if (priceLoading || !positions.length) return
    setPriceLoading(true)
    try {
      const syms = positions.map(p => p.symbol)
      const data = await fetchPrices(syms)
      setPrices(prev => ({ ...prev, ...data }))
      setLastFetch(new Date())
    } finally {
      setPriceLoading(false)
    }
  }, [positions, priceLoading])

  // ── Auto-refresh on first load with positions ──
  useEffect(() => {
    if (positions.length > 0 && !lastFetch) refresh()
  }, [positions])

  const tv = useMemo(() => positions.reduce((s, p) => s + gp(p.symbol) * p.quantity, 0), [positions, gp])
  const ti = useMemo(() => positions.reduce((s, p) => s + p.buy_price * p.quantity, 0), [positions])

  // ── Auth handlers ──
  const handleAuth = async () => {
    setAuthErr('')
    if (authMode === 'login') {
      const { error } = await signIn(authForm.email, authForm.password)
      if (error) setAuthErr(error.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect' : error.message)
    } else {
      if (!authForm.name || !authForm.email || !authForm.password) { setAuthErr('Tous les champs requis'); return }
      if (authForm.password.length < 6) { setAuthErr('Mot de passe: 6 caractères min.'); return }
      // Vérifier la limite de 10 utilisateurs
      const { data: userCount } = await supabase.rpc('count_users')
      if (userCount >= 10) { setAuthErr('Nombre maximum de comptes atteint (10/10). Contactez l\'administrateur.'); return }
      const { error } = await signUp(authForm.email, authForm.password, authForm.name)
      if (error) setAuthErr(error.message)
    }
  }

  const handleLogout = async () => {
    await signOut()
    setUser(null)
    setPositions([])
    setPrices({})
    setPage('dashboard')
  }

  const handleAddPosition = async (pos) => {
    const sec = ALL_SECURITIES.find(s => s.symbol === pos.symbol)
    await addPosition(user.id, {
      symbol: pos.symbol,
      name: sec?.name || pos.symbol,
      quantity: pos.qty,
      buyPrice: pos.pru,
    })
    await loadPositions(user.id)
    setShowAdd(false)
  }

  const handleDeletePosition = async (posId, e) => {
    e.stopPropagation()
    await deletePosition(posId)
    await loadPositions(user.id)
  }

  const openStock = (sym) => { setSelSym(sym); setPage('stock') }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Chargement...</div>

  if (!user) return <AuthPage mode={authMode} setMode={setAuthMode} form={authForm} setForm={setAuthForm} err={authErr} onSubmit={handleAuth} />

  const userName = user.user_metadata?.name || user.email?.split('@')[0] || 'User'

  return (
    <div className="min-h-screen">
      {/* NAV */}
      <nav style={{ background: '#0f1422ee', borderBottom: '1px solid #1e293b', backdropFilter: 'blur(12px)' }} className="sticky top-0 z-50 px-5 h-14 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div onClick={() => setPage('dashboard')} className="flex items-center gap-2 cursor-pointer">
            <div style={{ background: 'linear-gradient(135deg,#22d3ee,#6366f1)' }} className="w-7 h-7 rounded-md flex items-center justify-center font-mono font-bold text-sm text-white">P</div>
            <span className="font-bold text-base">PortfolioLab</span>
          </div>
          {['dashboard','market','projection','exposure'].map(id => (
            <button key={id} onClick={() => setPage(id)} className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors" style={{ background: page === id ? '#1e293b' : 'transparent', color: page === id ? '#22d3ee' : '#64748b' }}>
              {id === 'dashboard' ? 'Portfolio' : id === 'market' ? 'Marché' : id === 'projection' ? 'Projections' : 'Exposition'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{userName}</span>
          <button onClick={handleLogout} className="text-xs text-slate-400 border border-slate-700 px-2 py-1 rounded-md hover:text-white transition-colors">Déconnexion</button>
        </div>
      </nav>

      <div className="max-w-[1400px] mx-auto p-5">
        {page === 'dashboard' && <DashPage positions={positions} gp={gp} tv={tv} ti={ti} openStock={openStock} onAdd={() => setShowAdd(true)} refresh={refresh} priceLoading={priceLoading} lastFetch={lastFetch} prices={prices} onDelete={handleDeletePosition} />}
        {page === 'market' && <MarketPage openStock={openStock} gp={gp} prices={prices} />}
        {page === 'projection' && <ProjPage p={proj} setP={setProj} />}
        {page === 'exposure' && <ExpoPage positions={positions} gp={gp} />}
        {page === 'stock' && selSym && <StockPage sym={selSym} gp={gp} goBack={() => setPage('dashboard')} prices={prices} positions={positions} />}
      </div>

      {showAdd && <AddModal onClose={() => setShowAdd(false)} onAdd={handleAddPosition} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// AUTH PAGE
// ═══════════════════════════════════════════════════════════════
function AuthPage({ mode, setMode, form, setForm, err, onSubmit }) {
  const inputStyle = { background: '#0a0e17', border: '1px solid #1e293b', color: '#f1f5f9', width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  return (
    <div style={{ minHeight: '100vh', background: '#0a0e17', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <div style={{ width: 380, padding: 32, background: '#111827', borderRadius: 14, border: '1px solid #1e293b' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 44, height: 44, background: 'linear-gradient(135deg,#22d3ee,#6366f1)', borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 18, color: '#fff', marginBottom: 12 }}>P</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px' }}>PortfolioLab</h1>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Portfolio PEA — {ALL_SECURITIES.length} titres</p>
        </div>
        <div style={{ display: 'flex', gap: 3, background: '#0a0e17', borderRadius: 8, padding: 3, marginBottom: 20 }}>
          {['login','register'].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: 9, border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'inherit', background: mode === m ? '#1e293b' : 'transparent', color: mode === m ? '#22d3ee' : '#94a3b8' }}>
              {m === 'login' ? 'Connexion' : 'Inscription'}
            </button>
          ))}
        </div>
        {mode === 'register' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 5 }}>Nom complet</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Jean Dupont" style={inputStyle} />
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 5 }}>Email</label>
          <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} type="email" placeholder="votre@email.com" style={inputStyle} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 5 }}>Mot de passe</label>
          <input value={form.password} onChange={e => setForm({...form, password: e.target.value})} type="password" placeholder="••••••" style={inputStyle} onKeyDown={e => { if (e.key === 'Enter') onSubmit() }} />
        </div>
        {err && <div style={{ background: '#7f1d1d30', border: '1px solid #991b1b', padding: '9px 12px', borderRadius: 7, color: '#fca5a5', fontSize: 12, marginBottom: 14 }}>{err}</div>}
        <button onClick={onSubmit} style={{ width: '100%', padding: 13, background: 'linear-gradient(135deg,#22d3ee,#6366f1)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
          {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
function DashPage({ positions, gp, tv, ti, openStock, onAdd, refresh, priceLoading, lastFetch, prices, onDelete }) {
  const tg = tv - ti, tp = ti > 0 ? (tg / ti * 100) : 0
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Mon Portfolio</h2>
        <div className="flex gap-2 items-center">
          {lastFetch && <span className="text-[9px] text-slate-500">Màj: {lastFetch.toLocaleTimeString('fr-FR')}</span>}
          <button onClick={refresh} disabled={priceLoading || !positions.length} className="px-3 py-1.5 rounded-md text-xs font-semibold" style={{ background: '#1e293b', border: '1px solid #334155', color: priceLoading ? '#64748b' : '#22d3ee' }}>
            {priceLoading ? '↻ Chargement...' : '⟳ Actualiser (Yahoo)'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {[['Valeur', tv.toLocaleString('fr-FR',{maximumFractionDigits:2})+' €', '#22d3ee'],
          ['Investi', ti.toLocaleString('fr-FR',{maximumFractionDigits:2})+' €', '#6366f1'],
          ['+/- Value', (tg>=0?'+':'')+tg.toLocaleString('fr-FR',{maximumFractionDigits:2})+' €', tg>=0?'#10b981':'#ef4444'],
          ['Positions', String(positions.length), '#f59e0b']].map(([l,v,c],i) => (
          <div key={i} className="rounded-lg p-3 relative overflow-hidden" style={{ background: '#111827', border: '1px solid #1e293b' }}>
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: c }} />
            <div className="text-[10px] text-slate-500 mb-1">{l}</div>
            <div className="text-base font-bold font-mono" style={{ color: c }}>{v}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg overflow-hidden mb-4" style={{ background: '#111827', border: '1px solid #1e293b' }}>
        <div className="px-4 py-3 flex justify-between items-center" style={{ borderBottom: '1px solid #1e293b' }}>
          <h3 className="text-sm font-semibold">Positions</h3>
          <button onClick={onAdd} className="px-4 py-1.5 rounded-md text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg,#22d3ee,#6366f1)' }}>+ Ajouter</button>
        </div>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#0f1422' }}>
              {['Titre','Qté','PRU','Cours','Valeur','+/-%',''].map(h => (
                <th key={h} className="px-3 py-2 text-left text-[9px] font-semibold text-slate-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map(pos => {
              const sec = ALL_SECURITIES.find(s => s.symbol === pos.symbol)
              const cur = gp(pos.symbol)
              const gain = (cur - pos.buy_price) * pos.quantity
              const pct = pos.buy_price > 0 ? ((cur - pos.buy_price) / pos.buy_price * 100) : 0
              const live = prices[pos.symbol]?.price != null
              return (
                <tr key={pos.id} onClick={() => openStock(pos.symbol)} className="cursor-pointer hover:bg-slate-800/30 transition-colors" style={{ borderBottom: '1px solid #1e293b' }}>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-xs">{pos.name}</div>
                    <div className="text-[9px] text-slate-500 font-mono">{pos.symbol} {live && <span className="text-emerald-500">●</span>}</div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">{pos.quantity}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{Number(pos.buy_price).toFixed(2)}€</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{cur > 0 ? cur.toFixed(2) + '€' : '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{cur > 0 ? (cur * pos.quantity).toLocaleString('fr-FR',{maximumFractionDigits:2})+'€' : '—'}</td>
                  <td className="px-3 py-2.5">
                    {cur > 0 && <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono" style={{ background: gain >= 0 ? '#10b98118' : '#ef444418', color: gain >= 0 ? '#10b981' : '#ef4444' }}>
                      {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                    </span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={(e) => onDelete(pos.id, e)} className="text-[9px] text-red-300 px-1.5 py-0.5 rounded" style={{ background: '#7f1d1d18' }}>✕</button>
                  </td>
                </tr>
              )
            })}
            {!positions.length && <tr><td colSpan={7} className="py-8 text-center text-slate-500 text-xs">Aucune position — cliquez "Ajouter"</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MARKET
// ═══════════════════════════════════════════════════════════════
function MarketPage({ openStock, gp, prices }) {
  const [search, setSearch] = useState('')
  const [typeF, setTypeF] = useState('all')
  const filtered = useMemo(() => ALL_SECURITIES.filter(s => {
    const q = search.toLowerCase()
    return (!q || s.name.toLowerCase().includes(q) || s.symbol.toLowerCase().includes(q)) && (typeF === 'all' || s.type === typeF)
  }), [search, typeF])

  return (
    <div>
      <h2 className="text-lg font-bold mb-3">Marché PEA — {ALL_SECURITIES.length} titres</h2>
      <div className="flex gap-2 mb-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher (LVMH, CW8, Schneider...)" className="flex-1 px-3 py-2 rounded-md text-xs outline-none" style={{ background: '#111827', border: '1px solid #1e293b', color: '#f1f5f9' }} />
        <select value={typeF} onChange={e => setTypeF(e.target.value)} className="px-2 py-1.5 rounded-md text-xs" style={{ background: '#0a0e17', border: '1px solid #1e293b', color: '#f1f5f9' }}>
          <option value="all">Tous</option>
          <option value="Action">Actions</option>
          <option value="ETF">ETFs</option>
        </select>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))' }}>
        {filtered.slice(0, 80).map(sec => {
          const p = prices[sec.symbol]
          return (
            <div key={sec.symbol} onClick={() => openStock(sec.symbol)} className="p-3 rounded-lg cursor-pointer hover:border-cyan-500/30 transition-all" style={{ background: '#111827', border: '1px solid #1e293b' }}>
              <div className="font-bold text-xs">{sec.name}</div>
              <div className="text-[9px] text-slate-500 font-mono mb-1">{sec.symbol}</div>
              <div className="flex justify-between items-end">
                <div className="font-mono text-sm font-bold">{p?.price ? p.price.toFixed(2) + '€' : '—'}</div>
                <div className="text-right">
                  <span className="text-[8px] px-1.5 py-0.5 rounded font-semibold" style={{ background: (SC[sec.sector]||'#64748b')+'16', color: SC[sec.sector] }}>{sec.sector}</span>
                  <div className="text-[8px] text-slate-500 mt-0.5">{sec.region} • {sec.type}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// STOCK DETAIL
// ═══════════════════════════════════════════════════════════════
function StockPage({ sym, gp, goBack, prices, positions }) {
  const sec = ALL_SECURITIES.find(s => s.symbol === sym)
  const [det, setDet] = useState(null)
  const [ld, setLd] = useState(false)
  const pos = positions.find(p => p.symbol === sym)

  const load = async () => {
    if (ld) return
    setLd(true)
    const d = await fetchStockDetail(sym)
    if (d) setDet(d)
    setLd(false)
  }

  useEffect(() => { load() }, [sym])

  const price = det?.price || gp(sym)

  if (!sec) return <div><button onClick={goBack}>← Retour</button><p>Introuvable</p></div>

  return (
    <div>
      <button onClick={goBack} className="text-xs text-slate-500 mb-3 hover:text-white transition-colors">← Retour</button>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">{sec.name}</h1>
          <div className="flex gap-2 items-center">
            <span className="font-mono text-xs text-slate-500">{sym}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold" style={{ background: (SC[sec.sector]||'#64748b')+'18', color: SC[sec.sector] }}>{sec.sector}</span>
            <span className="text-[9px] text-slate-500">{sec.region}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-bold">{price > 0 ? price.toFixed(2) + ' €' : '—'}</div>
          {det?.changePct != null && (
            <div className="text-xs font-mono font-semibold" style={{ color: det.changePct >= 0 ? '#10b981' : '#ef4444' }}>
              {det.changePct >= 0 ? '▲' : '▼'} {Math.abs(det.changePct).toFixed(2)}%
            </div>
          )}
        </div>
      </div>

      {ld && <div className="text-xs text-slate-500 mb-3">Chargement des données Yahoo Finance...</div>}

      {det ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 rounded-lg" style={{ background: '#111827', border: '1px solid #1e293b' }}>
            <h3 className="text-[11px] uppercase text-slate-400 font-semibold mb-2">Données Clés</h3>
            {[['Prix', price.toFixed(2)+' €', '#22d3ee'],
              det.per && ['PER', String(Number(det.per).toFixed(1)), det.per<15?'#10b981':det.per<25?'#f59e0b':'#ef4444'],
              det.eps && ['BPA', det.eps+' €', '#22d3ee'],
              det.marketCap && ['Cap.', (det.marketCap/1e9).toFixed(1)+' Md€', '#94a3b8'],
              det.beta && ['Bêta', String(Number(det.beta).toFixed(2)), '#94a3b8'],
              det.high52 && ['+Haut 52s', det.high52+' €', '#10b981'],
              det.low52 && ['+Bas 52s', det.low52+' €', '#ef4444']
            ].filter(Boolean).map(([l,v,c]) => (
              <div key={l} className="flex justify-between py-1"><span className="text-[10px] text-slate-500">{l}</span><span className="text-[10px] font-mono font-semibold" style={{color:c}}>{v}</span></div>
            ))}
          </div>
          <div className="p-4 rounded-lg" style={{ background: '#111827', border: '1px solid #1e293b' }}>
            <h3 className="text-[11px] uppercase text-slate-400 font-semibold mb-2">Dividendes & Consensus</h3>
            {det.dividend ? (
              <div>
                {[['Dividende', det.dividend+' €', '#22d3ee'],
                  det.dividendYield && ['Rendement', det.dividendYield+'%', '#10b981'],
                  det.exDividendDate && ['Ex-div', det.exDividendDate, '#f1f5f9']
                ].filter(Boolean).map(([l,v,c]) => (
                  <div key={l} className="flex justify-between py-1"><span className="text-[10px] text-slate-500">{l}</span><span className="text-[10px] font-mono font-semibold" style={{color:c}}>{v}</span></div>
                ))}
              </div>
            ) : <div className="text-[10px] text-slate-500">Pas de dividende</div>}
            <div className="mt-3 pt-3 text-center" style={{ borderTop: '1px solid #1e293b' }}>
              {det.consensus ? (
                <div>
                  <div className="text-lg font-bold" style={{ color: String(det.consensus).includes('Achat')?'#10b981':det.consensus==='Neutre'?'#f59e0b':'#ef4444' }}>{det.consensus}</div>
                  {det.targetPrice && <div className="text-[10px] text-slate-500 mt-1">Objectif: <span className="text-cyan-400 font-bold">{det.targetPrice} €</span></div>}
                  {det.analystCount && <div className="text-[9px] text-slate-600">{det.analystCount} analystes</div>}
                </div>
              ) : <div className="text-[10px] text-slate-500">Consensus indisponible</div>}
            </div>
          </div>
          <div className="p-4 rounded-lg" style={{ background: '#111827', border: '1px solid #1e293b' }}>
            <h3 className="text-[11px] uppercase text-slate-400 font-semibold mb-2">Technique</h3>
            {det.support && <div className="flex justify-between py-1"><span className="text-[10px] text-emerald-500">Support</span><span className="text-[10px] font-mono font-bold text-emerald-500">{det.support} €</span></div>}
            {det.resistance && <div className="flex justify-between py-1"><span className="text-[10px] text-red-400">Résistance</span><span className="text-[10px] font-mono font-bold text-red-400">{det.resistance} €</span></div>}
            {det.avg50 && <div className="flex justify-between py-1"><span className="text-[10px] text-slate-500">MM50</span><span className="text-[10px] font-mono font-semibold">{Number(det.avg50).toFixed(2)} €</span></div>}
            {det.avg200 && <div className="flex justify-between py-1"><span className="text-[10px] text-slate-500">MM200</span><span className="text-[10px] font-mono font-semibold">{Number(det.avg200).toFixed(2)} €</span></div>}
            {det.nextEarnings && <div className="flex justify-between py-1"><span className="text-[10px] text-slate-500">Résultats</span><span className="text-[10px] font-semibold">{det.nextEarnings}</span></div>}
            <div className="mt-2 text-[10px] text-emerald-500 font-semibold">Éligible PEA ✓</div>
          </div>
        </div>
      ) : !ld && (
        <div className="p-8 text-center rounded-lg" style={{ background: '#111827', border: '1px solid #1e293b' }}>
          <div className="text-3xl mb-2">📈</div>
          <button onClick={load} className="px-4 py-2 rounded-lg text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg,#22d3ee,#6366f1)' }}>Charger les données</button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PROJECTIONS
// ═══════════════════════════════════════════════════════════════
function ProjPage({ p, setP }) {
  const data = useMemo(() => {
    const r = []; let inv = p.initial, val = p.initial
    for (let y = 0; y <= p.years; y++) { r.push({ y, inv: Math.round(inv), val: Math.round(val) }); val = val * (1 + p.rate / 100) + p.monthly * 12; inv += p.monthly * 12 }
    return r
  }, [p])
  const fin = data[data.length - 1] || { val: 0, inv: 0 }
  const max = Math.max(...data.map(d => d.val))

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">Projection patrimoine</h2>
      <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 240px' }}>
        <div className="p-5 rounded-lg" style={{ background: '#111827', border: '1px solid #1e293b' }}>
          <svg viewBox="0 0 700 250" className="w-full" style={{ height: 250 }}>
            <defs><linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity="0.15"/><stop offset="100%" stopColor="#22d3ee" stopOpacity="0"/></linearGradient></defs>
            {[0,.25,.5,.75,1].map(pct => { const y=220-pct*190; return <g key={pct}><line x1="50" y1={y} x2="660" y2={y} stroke="#1e293b"/><text x="45" y={y+4} fill="#64748b" fontSize="8" textAnchor="end" fontFamily="Space Mono">{(max*pct/1000).toFixed(0)}k</text></g> })}
            <polygon points={"50,220 "+data.map(d=>(50+(d.y/p.years)*610)+","+(220-(d.val/max)*190)).join(" ")+" 660,220"} fill="url(#gv)"/>
            <polyline points={data.map(d=>(50+(d.y/p.years)*610)+","+(220-(d.val/max)*190)).join(" ")} fill="none" stroke="#22d3ee" strokeWidth="2.5"/>
            <polyline points={data.map(d=>(50+(d.y/p.years)*610)+","+(220-(d.inv/max)*190)).join(" ")} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="5,3"/>
          </svg>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[['Patrimoine',(fin.val/1000).toFixed(0)+'k €','#22d3ee'],['Investi',(fin.inv/1000).toFixed(0)+'k €','#6366f1'],['Gains',((fin.val-fin.inv)/1000).toFixed(0)+'k €','#10b981']].map(([l,v,c])=>(
              <div key={l} className="p-3 rounded-md text-center" style={{ background: '#0a0e17' }}><div className="text-[9px] text-slate-500">{l}</div><div className="text-base font-bold font-mono" style={{color:c}}>{v}</div></div>
            ))}
          </div>
        </div>
        <div className="p-4 rounded-lg" style={{ background: '#111827', border: '1px solid #1e293b' }}>
          <h3 className="text-xs font-semibold mb-4">Paramètres</h3>
          {[{k:'initial',l:'Capital initial',u:'€',min:0,max:100000,step:500},{k:'monthly',l:'Mensualité',u:'€',min:0,max:5000,step:50},{k:'years',l:'Durée',u:'ans',min:1,max:40,step:1},{k:'rate',l:'Rendement',u:'%',min:1,max:20,step:0.5}].map(s=>(
            <div key={s.k} className="mb-4">
              <div className="flex justify-between mb-1"><span className="text-[10px] text-slate-400">{s.l}</span><span className="font-mono text-xs font-bold text-cyan-400">{p[s.k]} {s.u}</span></div>
              <input type="range" min={s.min} max={s.max} step={s.step} value={p[s.k]} onChange={e=>setP({...p,[s.k]:parseFloat(e.target.value)})} className="w-full accent-cyan-400"/>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// EXPOSURE
// ═══════════════════════════════════════════════════════════════
function ExpoPage({ positions, gp }) {
  const build = (key) => {
    const m = {}
    positions.forEach(p => { const s = ALL_SECURITIES.find(x => x.symbol === p.symbol); if (s) m[s[key]] = (m[s[key]] || 0) + gp(p.symbol) * p.quantity })
    const t = Object.values(m).reduce((a, b) => a + b, 0) || 1
    return Object.entries(m).map(([k, v]) => ({ name: k, pct: v / t * 100 })).sort((a, b) => b.pct - a.pct)
  }
  const sD = useMemo(() => build('sector'), [positions, gp])
  const rD = useMemo(() => build('region'), [positions, gp])

  if (!positions.length) return <div><h2 className="text-lg font-bold mb-3">Exposition</h2><div className="p-8 text-center text-slate-500 rounded-lg" style={{ background: '#111827', border: '1px solid #1e293b' }}>Ajoutez des positions.</div></div>

  const Bars = ({ data, colors }) => data.map((d, i) => (
    <div key={i} className="mb-1.5">
      <div className="flex justify-between mb-0.5"><div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{ background: colors[d.name] || '#64748b' }} /><span className="text-[10px]">{d.name}</span></div><span className="text-[10px] font-mono font-semibold">{d.pct.toFixed(1)}%</span></div>
      <div className="h-1 rounded" style={{ background: '#1e293b' }}><div className="h-1 rounded" style={{ background: colors[d.name] || '#64748b', width: d.pct + '%' }} /></div>
    </div>
  ))

  return (
    <div>
      <h2 className="text-lg font-bold mb-3">Exposition</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-lg" style={{ background: '#111827', border: '1px solid #1e293b' }}><h3 className="text-xs font-semibold mb-3">Sectorielle</h3><Bars data={sD} colors={SC} /></div>
        <div className="p-4 rounded-lg" style={{ background: '#111827', border: '1px solid #1e293b' }}><h3 className="text-xs font-semibold mb-3">Géographique</h3><Bars data={rD} colors={RC} /></div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ADD MODAL
// ═══════════════════════════════════════════════════════════════
function AddModal({ onClose, onAdd }) {
  const [search, setSearch] = useState('')
  const [sel, setSel] = useState(null)
  const [qty, setQty] = useState('')
  const [pru, setPru] = useState('')
  const filtered = useMemo(() => {
    if (!search) return ALL_SECURITIES.slice(0, 20)
    const q = search.toLowerCase()
    return ALL_SECURITIES.filter(s => s.name.toLowerCase().includes(q) || s.symbol.toLowerCase().includes(q)).slice(0, 20)
  }, [search])

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="w-[420px] rounded-xl overflow-hidden" style={{ background: '#111827', border: '1px solid #1e293b' }} onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 flex justify-between items-center" style={{ borderBottom: '1px solid #1e293b' }}>
          <h3 className="text-sm font-semibold">Ajouter une position</h3>
          <button onClick={onClose} className="text-slate-500 text-lg">✕</button>
        </div>
        <div className="p-4">
          {!sel ? (
            <div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="LVMH, CW8, Schneider..." autoFocus className="w-full px-3 py-2 rounded-md text-xs mb-2 outline-none" style={{ background: '#0a0e17', border: '1px solid #1e293b', color: '#f1f5f9' }} />
              <div className="max-h-72 overflow-y-auto">
                {filtered.map(s => (
                  <div key={s.symbol} onClick={() => setSel(s)} className="px-2 py-2 rounded-md cursor-pointer flex justify-between hover:bg-slate-800/50 transition-colors">
                    <div><div className="font-semibold text-xs">{s.name}</div><div className="text-[9px] text-slate-500">{s.symbol} • {s.type}</div></div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="p-2 rounded-md mb-3 flex justify-between items-center" style={{ background: '#0a0e17' }}>
                <div><div className="font-bold text-xs">{sel.name}</div><div className="text-[9px] text-slate-500">{sel.symbol}</div></div>
                <button onClick={() => setSel(null)} className="text-[9px] text-slate-400 px-2 py-1 rounded" style={{ background: '#1e293b' }}>Changer</button>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div><label className="text-[10px] text-slate-400">Quantité</label><input value={qty} onChange={e => setQty(e.target.value)} type="number" className="w-full px-2 py-2 rounded-md text-xs outline-none mt-1" style={{ background: '#0a0e17', border: '1px solid #1e293b', color: '#f1f5f9' }} /></div>
                <div><label className="text-[10px] text-slate-400">Prix d'achat €</label><input value={pru} onChange={e => setPru(e.target.value)} type="number" step="0.01" className="w-full px-2 py-2 rounded-md text-xs outline-none mt-1" style={{ background: '#0a0e17', border: '1px solid #1e293b', color: '#f1f5f9' }} /></div>
              </div>
              <button onClick={() => { if (qty && pru) onAdd({ symbol: sel.symbol, qty: parseFloat(qty), pru: parseFloat(pru) }) }} disabled={!qty || !pru} className="w-full py-2.5 rounded-md text-xs font-bold text-white" style={{ background: qty && pru ? 'linear-gradient(135deg,#22d3ee,#6366f1)' : '#1e293b', color: qty && pru ? '#fff' : '#64748b' }}>
                Ajouter
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
