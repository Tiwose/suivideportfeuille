'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
      name: pos.name || sec?.name || pos.symbol,
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

  if (loading) return <div style={{ minHeight: '100vh', background: '#0a0e17', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontFamily: "'DM Sans', sans-serif" }}>Chargement...</div>

  if (!user) return <AuthPage mode={authMode} setMode={setAuthMode} form={authForm} setForm={setAuthForm} err={authErr} onSubmit={handleAuth} />

  const userName = user.user_metadata?.name || user.email?.split('@')[0] || 'User'

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e17', color: '#e2e8f0', fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      {/* NAV */}
      <nav style={{ background: '#0f1422ee', borderBottom: '1px solid #1e293b', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 50, padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div onClick={() => setPage('dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg,#22d3ee,#6366f1)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 14, color: '#fff' }}>P</div>
            <span style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9' }}>PortfolioLab</span>
          </div>
          {['dashboard','market','projection','exposure'].map(id => (
            <button key={id} onClick={() => setPage(id)} style={{ background: page === id ? '#1e293b' : 'transparent', color: page === id ? '#22d3ee' : '#64748b', border: 'none', padding: '7px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.2s' }}>
              {id === 'dashboard' ? '📊 Portfolio' : id === 'market' ? '🏛 Marché' : id === 'projection' ? '📈 Projections' : '🎯 Exposition'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{userName}</span>
          <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '6px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', transition: 'all 0.2s' }}>Déconnexion</button>
        </div>
      </nav>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '18px 20px' }}>
        {page === 'dashboard' && <DashPage positions={positions} gp={gp} tv={tv} ti={ti} openStock={openStock} onAdd={() => setShowAdd(true)} refresh={refresh} priceLoading={priceLoading} lastFetch={lastFetch} prices={prices} onDelete={handleDeletePosition} />}
        {page === 'market' && <MarketPage openStock={openStock} gp={gp} prices={prices} />}
        {page === 'projection' && <ProjPage p={proj} setP={setProj} tv={tv} ti={ti} />}
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
  const btnStyle = { background: 'linear-gradient(135deg,#22d3ee,#6366f1)', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.2s' }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>Mon Portfolio</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {lastFetch && <span style={{ fontSize: 9, color: '#64748b' }}>Màj: {lastFetch.toLocaleTimeString('fr-FR')}</span>}
          <button onClick={refresh} disabled={priceLoading || !positions.length} style={{ ...btnStyle, background: priceLoading ? '#1e293b' : 'linear-gradient(135deg,#22d3ee,#6366f1)', opacity: (!positions.length || priceLoading) ? 0.5 : 1, cursor: priceLoading ? 'default' : 'pointer' }}>
            {priceLoading ? '↻ Chargement...' : '⟳ Actualiser les prix'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        {[['Valeur totale', tv.toLocaleString('fr-FR',{maximumFractionDigits:2})+' €', '#22d3ee'],
          ['Capital investi', ti.toLocaleString('fr-FR',{maximumFractionDigits:2})+' €', '#6366f1'],
          ['+/- Value', (tg>=0?'+':'')+tg.toLocaleString('fr-FR',{maximumFractionDigits:2})+' €', tg>=0?'#10b981':'#ef4444', (tp>=0?'+':'')+tp.toFixed(2)+'%'],
          ['Positions', String(positions.length), '#f59e0b']].map(([l,v,c,sub],i) => (
          <div key={i} style={{ background: '#111827', borderRadius: 10, border: '1px solid #1e293b', padding: 14, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, background: c }} />
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: c }}>{v}</div>
            {sub && <div style={{ fontSize: 11, color: c, marginTop: 2, fontWeight: 600 }}>{sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ background: '#111827', borderRadius: 10, border: '1px solid #1e293b', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>Mes Positions</h3>
          <button onClick={onAdd} style={btnStyle}>+ Ajouter une position</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0f1422' }}>
                {['Titre','Qté','PRU','Cours','Valeur','% Portf.','+/-%',''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 9, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map(pos => {
                const sec = ALL_SECURITIES.find(s => s.symbol === pos.symbol)
                const cur = gp(pos.symbol)
                const val = cur * pos.quantity
                const gain = (cur - pos.buy_price) * pos.quantity
                const pct = pos.buy_price > 0 ? ((cur - pos.buy_price) / pos.buy_price * 100) : 0
                const weight = tv > 0 ? (val / tv * 100) : 0
                const live = prices[pos.symbol]?.price != null
                return (
                  <tr key={pos.id} onClick={() => openStock(pos.symbol)} style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background='#1e293b30'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ fontWeight: 600, fontSize: 12, color: '#f1f5f9' }}>{pos.name}</div>
                      <div style={{ fontSize: 9, color: '#64748b', fontFamily: "'Space Mono', monospace" }}>{pos.symbol} {live && <span style={{ color: '#10b981' }}>●</span>}</div>
                    </td>
                    <td style={{ padding: '11px 12px', fontFamily: "'Space Mono', monospace", fontSize: 11, color: '#e2e8f0' }}>{pos.quantity}</td>
                    <td style={{ padding: '11px 12px', fontFamily: "'Space Mono', monospace", fontSize: 11, color: '#e2e8f0' }}>{Number(pos.buy_price).toFixed(2)}€</td>
                    <td style={{ padding: '11px 12px', fontFamily: "'Space Mono', monospace", fontSize: 11, color: '#e2e8f0' }}>{cur > 0 ? cur.toFixed(2) + '€' : '—'}</td>
                    <td style={{ padding: '11px 12px', fontFamily: "'Space Mono', monospace", fontSize: 11, color: '#e2e8f0' }}>{cur > 0 ? val.toLocaleString('fr-FR',{maximumFractionDigits:2})+'€' : '—'}</td>
                    <td style={{ padding: '11px 12px' }}>
                      {cur > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 40, height: 4, background: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: 4, background: '#22d3ee', borderRadius: 2, width: Math.min(weight, 100) + '%' }} />
                        </div>
                        <span style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", fontWeight: 600, color: '#22d3ee' }}>{weight.toFixed(1)}%</span>
                      </div>}
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      {cur > 0 && <span style={{ background: gain >= 0 ? '#10b98118' : '#ef444418', color: gain >= 0 ? '#10b981' : '#ef4444', padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700, fontFamily: "'Space Mono', monospace" }}>
                        {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                      </span>}
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <button onClick={(e) => onDelete(pos.id, e)} style={{ background: '#7f1d1d18', border: '1px solid #991b1b30', color: '#fca5a5', padding: '3px 8px', borderRadius: 5, cursor: 'pointer', fontSize: 9, fontFamily: 'inherit' }}>✕</button>
                    </td>
                  </tr>
                )
              })}
              {!positions.length && <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#64748b', fontSize: 12 }}>Aucune position — cliquez "Ajouter une position"</td></tr>}
            </tbody>
          </table>
        </div>
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
function ProjPage({ p, setP, tv, ti }) {
  // Use actual portfolio value as initial if available
  const effectiveInitial = tv > 0 ? tv : p.initial
  const data = useMemo(() => {
    const r = []; let inv = effectiveInitial, val = effectiveInitial
    for (let y = 0; y <= p.years; y++) { r.push({ y, inv: Math.round(inv), val: Math.round(val) }); val = val * (1 + p.rate / 100) + p.monthly * 12; inv += p.monthly * 12 }
    return r
  }, [p, effectiveInitial])
  const fin = data[data.length - 1] || { val: 0, inv: 0 }
  const max = Math.max(...data.map(d => d.val))
  const btnStyle = { background: 'linear-gradient(135deg,#22d3ee,#6366f1)', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }

  return (
    <div>
      <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>Projection de patrimoine</h2>
      {tv > 0 && <p style={{ margin: '0 0 16px', fontSize: 12, color: '#94a3b8' }}>Basée sur votre portfolio actuel : <span style={{ color: '#22d3ee', fontWeight: 700, fontFamily: "'Space Mono', monospace" }}>{tv.toLocaleString('fr-FR',{maximumFractionDigits:0})} €</span></p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 12 }}>
        <div style={{ background: '#111827', borderRadius: 10, border: '1px solid #1e293b', padding: 20 }}>
          <svg viewBox="0 0 700 250" style={{ width: '100%', height: 250 }}>
            <defs><linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity="0.15"/><stop offset="100%" stopColor="#22d3ee" stopOpacity="0"/></linearGradient></defs>
            {[0,.25,.5,.75,1].map(pct => { const y=220-pct*190; return <g key={pct}><line x1="50" y1={y} x2="660" y2={y} stroke="#1e293b"/><text x="45" y={y+4} fill="#64748b" fontSize="8" textAnchor="end" fontFamily="Space Mono">{(max*pct/1000).toFixed(0)}k</text></g> })}
            <polygon points={"50,220 "+data.map(d=>(50+(d.y/p.years)*610)+","+(220-(d.val/max)*190)).join(" ")+" 660,220"} fill="url(#gv)"/>
            <polyline points={data.map(d=>(50+(d.y/p.years)*610)+","+(220-(d.val/max)*190)).join(" ")} fill="none" stroke="#22d3ee" strokeWidth="2.5"/>
            <polyline points={data.map(d=>(50+(d.y/p.years)*610)+","+(220-(d.inv/max)*190)).join(" ")} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="5,3"/>
          </svg>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 10, color: '#22d3ee' }}>━━ Patrimoine</span>
            <span style={{ fontSize: 10, color: '#6366f1' }}>┅┅ Capital investi</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 14 }}>
            {[['Patrimoine final',(fin.val/1000).toFixed(0)+'k €','#22d3ee'],['Total investi',(fin.inv/1000).toFixed(0)+'k €','#6366f1'],['Plus-values',((fin.val-fin.inv)/1000).toFixed(0)+'k €','#10b981']].map(([l,v,c])=>(
              <div key={l} style={{ background: '#0a0e17', borderRadius: 7, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#64748b', marginBottom: 2 }}>{l}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: c, fontFamily: "'Space Mono', monospace" }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: '#111827', borderRadius: 10, border: '1px solid #1e293b', padding: 16 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>Paramètres</h3>
          {tv > 0 && <div style={{ background: '#22d3ee10', border: '1px solid #22d3ee30', borderRadius: 7, padding: '8px 10px', marginBottom: 14, fontSize: 10, color: '#22d3ee' }}>💡 Capital initial = valeur de votre portfolio</div>}
          {[{k:'monthly',l:'Investissement mensuel',u:'€',min:0,max:5000,step:50},{k:'years',l:'Durée',u:'ans',min:1,max:40,step:1},{k:'rate',l:'Rendement annuel estimé',u:'%',min:1,max:20,step:0.5}].map(s=>(
            <div key={s.k} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{s.l}</span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: '#22d3ee' }}>{p[s.k]} {s.u}</span>
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step} value={p[s.k]} onChange={e=>setP({...p,[s.k]:parseFloat(e.target.value)})} style={{ width: '100%', accentColor: '#22d3ee' }}/>
            </div>
          ))}
          <div style={{ background: '#0a0e17', borderRadius: 7, padding: 10, marginTop: 8 }}>
            <div style={{ fontSize: 10, color: '#64748b' }}>💰 Les intérêts composés représentent</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981', fontFamily: "'Space Mono', monospace" }}>{fin.val > 0 ? ((1-fin.inv/fin.val)*100).toFixed(0) : 0}% du patrimoine final</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// EXPOSURE
// ═══════════════════════════════════════════════════════════════
function ExpoPage({ positions, gp }) {
  const TC = { 'Action': '#9B59B6', 'ETF': '#3498DB', 'Crypto': '#F39C12', 'Matière première': '#27AE60', 'Indice': '#E74C3C', 'OPCVM': '#1ABC9C', 'Devise': '#8E44AD' }

  const buildFromDb = (key) => {
    const m = {}
    positions.forEach(p => {
      const s = ALL_SECURITIES.find(x => x.symbol === p.symbol)
      const label = s ? s[key] : 'Autre'
      m[label] = (m[label] || 0) + gp(p.symbol) * p.quantity
    })
    const t = Object.values(m).reduce((a, b) => a + b, 0) || 1
    return Object.entries(m).map(([k, v]) => ({ name: k, val: v, pct: v / t * 100 })).sort((a, b) => b.pct - a.pct)
  }

  const buildType = () => {
    const m = {}
    positions.forEach(p => {
      const s = ALL_SECURITIES.find(x => x.symbol === p.symbol)
      // Detect type from symbol or DB
      let type = s ? s.type : 'Autre'
      const sym = p.symbol.toUpperCase()
      if (sym.includes('-USD') || sym.includes('-EUR') || sym.includes('BTC') || sym.includes('ETH') || sym.includes('SOL') || sym.includes('ADA') || sym.includes('XRP')) type = 'Crypto'
      else if (sym.includes('GC=F') || sym.includes('SI=F') || sym.includes('CL=F') || sym.includes('NG=F')) type = 'Matière première'
      m[type] = (m[type] || 0) + gp(p.symbol) * p.quantity
    })
    const t = Object.values(m).reduce((a, b) => a + b, 0) || 1
    return Object.entries(m).map(([k, v]) => ({ name: k, val: v, pct: v / t * 100 })).sort((a, b) => b.pct - a.pct)
  }

  const sD = useMemo(() => buildFromDb('sector'), [positions, gp])
  const rD = useMemo(() => buildFromDb('region'), [positions, gp])
  const tD = useMemo(() => buildType(), [positions, gp])
  const totalVal = positions.reduce((s, p) => s + gp(p.symbol) * p.quantity, 0)
  const maxC = Math.max(...sD.map(d => d.pct), ...rD.map(d => d.pct), 0)

  if (!positions.length) return (
    <div>
      <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>Exposition du portfolio</h2>
      <div style={{ background: '#111827', borderRadius: 10, border: '1px solid #1e293b', padding: 36, textAlign: 'center', color: '#64748b' }}>Ajoutez des positions pour analyser votre exposition.</div>
    </div>
  )

  const Bars = ({ data, colors }) => data.map((d, i) => (
    <div key={i} style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: colors[d.name] || '#64748b' }} />
          <span style={{ fontSize: 11, color: '#e2e8f0' }}>{d.name}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#64748b', fontFamily: "'Space Mono', monospace" }}>{d.val.toLocaleString('fr-FR',{maximumFractionDigits:0})}€</span>
          <span style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", fontWeight: 700, color: colors[d.name] || '#64748b' }}>{d.pct.toFixed(1)}%</span>
        </div>
      </div>
      <div style={{ height: 5, background: '#1e293b', borderRadius: 3 }}>
        <div style={{ height: 5, background: colors[d.name] || '#64748b', borderRadius: 3, width: d.pct + '%', transition: 'width 0.3s' }} />
      </div>
    </div>
  ))

  return (
    <div>
      <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>Exposition du portfolio</h2>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: '#94a3b8' }}>Valeur totale : <span style={{ color: '#22d3ee', fontWeight: 700, fontFamily: "'Space Mono', monospace" }}>{totalVal.toLocaleString('fr-FR',{maximumFractionDigits:0})} €</span> — {positions.length} position{positions.length > 1 ? 's' : ''}</p>

      {/* Diversification indicator */}
      <div style={{ background: maxC > 50 ? '#7f1d1d16' : maxC > 30 ? '#78350f16' : '#05291916', borderRadius: 8, border: '1px solid ' + (maxC > 50 ? '#991b1b30' : maxC > 30 ? '#92400e30' : '#065f4630'), padding: 12, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>{maxC > 50 ? '⚠️' : maxC > 30 ? '⚡' : '✅'}</span>
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9' }}>Diversification : </span>
          <span style={{ fontWeight: 700, color: maxC > 50 ? '#ef4444' : maxC > 30 ? '#f59e0b' : '#10b981' }}>{maxC > 50 ? 'Faible' : maxC > 30 ? 'Modérée' : 'Bonne'}</span>
          <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>Concentration max : {maxC.toFixed(1)}%</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {[['🏢 Par secteur', sD, SC], ['🌍 Par région', rD, RC], ['📦 Par type d\'actif', tD, TC]].map(([title, data, colors]) => (
          <div key={title} style={{ background: '#111827', borderRadius: 10, border: '1px solid #1e293b', padding: 18 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{title}</h3>
            <Bars data={data} colors={colors} />
          </div>
        ))}
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
  const [yahooResults, setYahooResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [mode, setMode] = useState('local') // 'local' or 'yahoo'
  const searchTimeout = useRef(null)

  // Local search in static DB
  const localFiltered = useMemo(() => {
    if (!search) return ALL_SECURITIES.slice(0, 20)
    const q = search.toLowerCase()
    return ALL_SECURITIES.filter(s => s.name.toLowerCase().includes(q) || s.symbol.toLowerCase().includes(q)).slice(0, 20)
  }, [search])

  // Yahoo Finance live search with debounce
  const searchYahoo = useCallback(async (query) => {
    if (!query || query.length < 2) { setYahooResults([]); return }
    setSearching(true)
    try {
      const res = await fetch('/api/search?q=' + encodeURIComponent(query))
      const data = await res.json()
      setYahooResults(data.results || [])
    } catch (e) { setYahooResults([]) }
    finally { setSearching(false) }
  }, [])

  const handleSearchChange = (val) => {
    setSearch(val)
    if (mode === 'yahoo') {
      if (searchTimeout.current) clearTimeout(searchTimeout.current)
      searchTimeout.current = setTimeout(() => searchYahoo(val), 400)
    }
  }

  const results = mode === 'local' ? localFiltered : yahooResults
  const inputStyle = { background: '#0a0e17', border: '1px solid #1e293b', color: '#f1f5f9', width: '100%', padding: '9px 12px', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  const typeColors = { 'Action': '#9B59B6', 'ETF': '#3498DB', 'Crypto': '#F39C12', 'Matière première': '#27AE60', 'Indice': '#E74C3C', 'OPCVM': '#1ABC9C', 'Devise': '#8E44AD' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={onClose}>
      <div style={{ width: 460, background: '#111827', borderRadius: 12, border: '1px solid #1e293b', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>Ajouter une position</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        <div style={{ padding: 16 }}>
          {!sel ? (
            <div>
              {/* Toggle local / Yahoo */}
              <div style={{ display: 'flex', gap: 3, background: '#0a0e17', borderRadius: 7, padding: 3, marginBottom: 10 }}>
                <button onClick={() => { setMode('local'); setYahooResults([]) }} style={{ flex: 1, padding: 7, border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 600, fontSize: 11, fontFamily: 'inherit', background: mode === 'local' ? '#1e293b' : 'transparent', color: mode === 'local' ? '#22d3ee' : '#94a3b8' }}>
                  PEA ({ALL_SECURITIES.length} titres)
                </button>
                <button onClick={() => setMode('yahoo')} style={{ flex: 1, padding: 7, border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 600, fontSize: 11, fontFamily: 'inherit', background: mode === 'yahoo' ? '#1e293b' : 'transparent', color: mode === 'yahoo' ? '#f59e0b' : '#94a3b8' }}>
                  🌍 Recherche mondiale
                </button>
              </div>

              <input
                value={search}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder={mode === 'local' ? "LVMH, CW8, Schneider, Veolia..." : "iShares MSCI World, Bitcoin, Tesla, Gold..."}
                autoFocus
                style={{ ...inputStyle, marginBottom: 8 }}
              />

              {mode === 'yahoo' && search.length < 2 && (
                <div style={{ padding: '8px 0', fontSize: 11, color: '#64748b', textAlign: 'center' }}>Tapez au moins 2 caractères pour chercher sur Yahoo Finance</div>
              )}
              {searching && <div style={{ padding: '8px 0', fontSize: 11, color: '#22d3ee', textAlign: 'center' }}>Recherche en cours...</div>}

              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {results.map(s => (
                  <div key={s.symbol} onClick={() => setSel(s)} style={{ padding: '8px 10px', cursor: 'pointer', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onMouseEnter={e => e.currentTarget.style.background = '#1e293b'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 12, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>{s.symbol} {s.exchange ? '• ' + s.exchange : ''}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: (typeColors[s.type] || '#64748b') + '20', color: typeColors[s.type] || '#64748b', fontWeight: 600 }}>{s.type}</span>
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: '#1e293b', color: '#94a3b8' }}>{s.region}</span>
                    </div>
                  </div>
                ))}
                {mode === 'local' && !results.length && search && (
                  <div style={{ padding: 16, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>Aucun résultat dans la base PEA</div>
                    <button onClick={() => { setMode('yahoo'); searchYahoo(search) }} style={{ background: '#f59e0b20', border: '1px solid #f59e0b40', color: '#f59e0b', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>
                      🌍 Chercher sur Yahoo Finance
                    </button>
                  </div>
                )}
                {mode === 'yahoo' && !results.length && search.length >= 2 && !searching && (
                  <div style={{ padding: 16, textAlign: 'center', fontSize: 11, color: '#64748b' }}>Aucun résultat trouvé</div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ padding: 10, background: '#0a0e17', borderRadius: 7, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>{sel.name}</div>
                  <div style={{ fontSize: 10, color: '#64748b', display: 'flex', gap: 6, marginTop: 2 }}>
                    <span>{sel.symbol}</span>
                    <span style={{ padding: '0 5px', borderRadius: 3, background: (typeColors[sel.type] || '#64748b') + '20', color: typeColors[sel.type] || '#64748b', fontWeight: 600 }}>{sel.type}</span>
                    <span>{sel.region}</span>
                  </div>
                </div>
                <button onClick={() => setSel(null)} style={{ background: '#1e293b', border: 'none', color: '#94a3b8', padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}>Changer</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Quantité</label>
                  <input value={qty} onChange={e => setQty(e.target.value)} type="number" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Prix d'achat (€)</label>
                  <input value={pru} onChange={e => setPru(e.target.value)} type="number" step="0.01" style={inputStyle} />
                </div>
              </div>
              <button onClick={() => { if (qty && pru) onAdd({ symbol: sel.symbol, name: sel.name, qty: parseFloat(qty), pru: parseFloat(pru) }) }} disabled={!qty || !pru} style={{ width: '100%', padding: 11, background: qty && pru ? 'linear-gradient(135deg,#22d3ee,#6366f1)' : '#1e293b', border: 'none', borderRadius: 7, color: qty && pru ? '#fff' : '#64748b', fontWeight: 700, fontSize: 13, cursor: qty && pru ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                Ajouter au portfolio
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
