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
  const [budget, setBudget] = useState({ salaryGross: 2300, salaryNet: 2080, partnerNet: 0, rent: 713, apl: 0 })

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
    // Check if position already exists for this symbol
    const existing = positions.find(p => p.symbol === pos.symbol)
    if (existing) {
      // Merge: calculate weighted average PRU
      const oldQty = Number(existing.quantity)
      const oldPru = Number(existing.buy_price)
      const newQty = pos.qty
      const newPru = pos.pru
      const totalQty = oldQty + newQty
      const weightedPru = ((oldQty * oldPru) + (newQty * newPru)) / totalQty
      // Update existing position
      await supabase.from('positions').update({
        quantity: totalQty,
        buy_price: Math.round(weightedPru * 100) / 100
      }).eq('id', existing.id)
      await loadPositions(user.id)
      setShowAdd(false)
    } else {
      // New position
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
          {['dashboard','market','projection','exposure','budget'].map(id => (
            <button key={id} onClick={() => setPage(id)} style={{ background: page === id ? '#1e293b' : 'transparent', color: page === id ? '#22d3ee' : '#64748b', border: 'none', padding: '7px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.2s' }}>
              {id === 'dashboard' ? '📊 Portfolio' : id === 'market' ? '🏛 Marché' : id === 'projection' ? '📈 Projections' : id === 'exposure' ? '🎯 Exposition' : '💰 Budget'}
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
        {page === 'budget' && <BudgetPage b={budget} setB={setBudget} />}
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
  const [sortKey, setSortKey] = useState('weight')
  const [sortDir, setSortDir] = useState('desc')
  const [news, setNews] = useState([])
  const [newsLoading, setNewsLoading] = useState(false)

  // Fetch news for portfolio
  useEffect(() => {
    if (!positions.length) return
    setNewsLoading(true)
    const syms = positions.map(p => p.symbol).slice(0, 8).join(',')
    fetch('/api/news?symbols=' + syms + '&general=true')
      .then(r => r.json())
      .then(d => setNews(d.news || []))
      .catch(() => {})
      .finally(() => setNewsLoading(false))
  }, [positions])

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = useMemo(() => {
    return [...positions].sort((a, b) => {
      let va, vb
      const curA = gp(a.symbol), curB = gp(b.symbol)
      switch (sortKey) {
        case 'name': va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break
        case 'qty': va = a.quantity; vb = b.quantity; break
        case 'pru': va = Number(a.buy_price); vb = Number(b.buy_price); break
        case 'price': va = curA; vb = curB; break
        case 'value': va = curA * a.quantity; vb = curB * b.quantity; break
        case 'weight': va = tv > 0 ? (curA * a.quantity / tv) : 0; vb = tv > 0 ? (curB * b.quantity / tv) : 0; break
        case 'perf': va = a.buy_price > 0 ? ((curA - a.buy_price) / a.buy_price) : 0; vb = b.buy_price > 0 ? ((curB - b.buy_price) / b.buy_price) : 0; break
        default: va = 0; vb = 0
      }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      return sortDir === 'asc' ? va - vb : vb - va
    })
  }, [positions, sortKey, sortDir, gp, tv])

  const btnStyle = { background: 'linear-gradient(135deg,#22d3ee,#6366f1)', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }
  const thStyle = (key) => ({ padding: '10px 12px', textAlign: 'left', fontSize: 9, fontWeight: 600, color: sortKey === key ? '#22d3ee' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', userSelect: 'none' })
  const arrow = (key) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>Mon Portfolio</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {lastFetch && <span style={{ fontSize: 9, color: '#64748b' }}>Màj: {lastFetch.toLocaleTimeString('fr-FR')}</span>}
          <button onClick={refresh} disabled={priceLoading || !positions.length} style={{ ...btnStyle, opacity: priceLoading ? 0.5 : 1 }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 12, marginBottom: 16 }}>
        {/* Positions table */}
        <div style={{ background: '#111827', borderRadius: 10, border: '1px solid #1e293b', overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>Mes Positions</h3>
            <button onClick={onAdd} style={btnStyle}>+ Ajouter</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0f1422' }}>
                  <th onClick={() => toggleSort('name')} style={thStyle('name')}>Titre{arrow('name')}</th>
                  <th onClick={() => toggleSort('qty')} style={thStyle('qty')}>Qté{arrow('qty')}</th>
                  <th onClick={() => toggleSort('pru')} style={thStyle('pru')}>PRU{arrow('pru')}</th>
                  <th onClick={() => toggleSort('price')} style={thStyle('price')}>Cours{arrow('price')}</th>
                  <th onClick={() => toggleSort('value')} style={thStyle('value')}>Valeur{arrow('value')}</th>
                  <th onClick={() => toggleSort('weight')} style={thStyle('weight')}>% Portf.{arrow('weight')}</th>
                  <th onClick={() => toggleSort('perf')} style={thStyle('perf')}>+/-%{arrow('perf')}</th>
                  <th style={{ padding: '10px 12px', width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(pos => {
                  const cur = gp(pos.symbol), val = cur * pos.quantity
                  const gain = (cur - pos.buy_price) * pos.quantity
                  const pct = pos.buy_price > 0 ? ((cur - pos.buy_price) / pos.buy_price * 100) : 0
                  const weight = tv > 0 ? (val / tv * 100) : 0
                  const live = prices[pos.symbol]?.price != null
                  return (
                    <tr key={pos.id} onClick={() => openStock(pos.symbol)} style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background='#1e293b30'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td style={{ padding: '10px 12px' }}><div style={{ fontWeight: 600, fontSize: 12, color: '#f1f5f9' }}>{pos.name}</div><div style={{ fontSize: 9, color: '#64748b', fontFamily: "'Space Mono', monospace" }}>{pos.symbol} {live && <span style={{ color: '#10b981' }}>●</span>}</div></td>
                      <td style={{ padding: '10px 12px', fontFamily: "'Space Mono', monospace", fontSize: 11, color: '#e2e8f0' }}>{pos.quantity}</td>
                      <td style={{ padding: '10px 12px', fontFamily: "'Space Mono', monospace", fontSize: 11, color: '#e2e8f0' }}>{Number(pos.buy_price).toFixed(2)}€</td>
                      <td style={{ padding: '10px 12px', fontFamily: "'Space Mono', monospace", fontSize: 11, color: '#e2e8f0' }}>{cur > 0 ? cur.toFixed(2)+'€' : '—'}</td>
                      <td style={{ padding: '10px 12px', fontFamily: "'Space Mono', monospace", fontSize: 11, color: '#e2e8f0' }}>{cur > 0 ? val.toLocaleString('fr-FR',{maximumFractionDigits:0})+'€' : '—'}</td>
                      <td style={{ padding: '10px 12px' }}>{cur > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 36, height: 4, background: '#1e293b', borderRadius: 2 }}><div style={{ height: 4, background: '#22d3ee', borderRadius: 2, width: Math.min(weight,100)+'%' }}/></div><span style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", fontWeight: 600, color: '#22d3ee' }}>{weight.toFixed(1)}%</span></div>}</td>
                      <td style={{ padding: '10px 12px' }}>{cur > 0 && <span style={{ background: gain>=0?'#10b98118':'#ef444418', color: gain>=0?'#10b981':'#ef4444', padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700, fontFamily: "'Space Mono', monospace" }}>{pct>=0?'+':''}{pct.toFixed(2)}%</span>}</td>
                      <td style={{ padding: '10px 12px' }}><button onClick={(e) => onDelete(pos.id, e)} style={{ background: '#7f1d1d18', border: '1px solid #991b1b30', color: '#fca5a5', padding: '3px 8px', borderRadius: 5, cursor: 'pointer', fontSize: 9 }}>✕</button></td>
                    </tr>
                  )
                })}
                {!positions.length && <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#64748b', fontSize: 12 }}>Aucune position</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* News sidebar */}
        <div style={{ background: '#111827', borderRadius: 10, border: '1px solid #1e293b', padding: 16, maxHeight: 600, overflowY: 'auto' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>📰 Actualités de vos actifs</h3>
          {newsLoading && <div style={{ fontSize: 11, color: '#64748b', padding: 8 }}>Chargement des actualités...</div>}
          {news.length === 0 && !newsLoading && <div style={{ fontSize: 11, color: '#64748b', padding: 8 }}>Aucune actualité disponible</div>}
          {news.map((n, i) => (
            <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '10px 8px', background: '#0a0e17', borderRadius: 7, marginBottom: 6, textDecoration: 'none', transition: 'all 0.15s' }} onMouseEnter={e => e.currentTarget.style.borderColor='#22d3ee40'} onMouseLeave={e => e.currentTarget.style.borderColor='transparent'}>
              <div style={{ fontSize: 11, color: '#f1f5f9', lineHeight: 1.4, marginBottom: 4 }}>{n.title}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 9, color: '#64748b' }}>{n.publisher}</span>
                {n.publishedAt && <span style={{ fontSize: 9, color: '#64748b' }}>{new Date(n.publishedAt).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</span>}
                {n.relatedSymbol && <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: '#22d3ee15', color: '#22d3ee' }}>{n.relatedSymbol}</span>}
              </div>
            </a>
          ))}
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
  const [mode, setMode] = useState('local')
  const [yahooResults, setYahooResults] = useState([])
  const [searching, setSearching] = useState(false)
  const searchTimeout = useRef(null)

  const localFiltered = useMemo(() => ALL_SECURITIES.filter(s => {
    const q = search.toLowerCase()
    return (!q || s.name.toLowerCase().includes(q) || s.symbol.toLowerCase().includes(q)) && (typeF === 'all' || s.type === typeF)
  }), [search, typeF])

  const searchYahoo = async (q) => {
    if (!q || q.length < 2) { setYahooResults([]); return }
    setSearching(true)
    try {
      const res = await fetch('/api/search?q=' + encodeURIComponent(q))
      const data = await res.json()
      setYahooResults(data.results || [])
    } catch (e) { setYahooResults([]) }
    finally { setSearching(false) }
  }

  const handleSearch = (val) => {
    setSearch(val)
    if (mode === 'yahoo') {
      if (searchTimeout.current) clearTimeout(searchTimeout.current)
      searchTimeout.current = setTimeout(() => searchYahoo(val), 400)
    }
  }

  const results = mode === 'local' ? localFiltered : yahooResults
  const typeColors = { 'Action': '#9B59B6', 'ETF': '#3498DB', 'Crypto': '#F39C12', 'Matière première': '#27AE60', 'Indice': '#E74C3C', 'OPCVM': '#1ABC9C' }
  const inputStyle = { padding: '9px 12px', background: '#0a0e17', border: '1px solid #1e293b', borderRadius: 7, color: '#f1f5f9', fontSize: 12, fontFamily: 'inherit', outline: 'none' }

  return (
    <div>
      <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>Explorer le marché</h2>

      <div style={{ display: 'flex', gap: 4, background: '#111827', borderRadius: 8, padding: 3, marginBottom: 12, maxWidth: 400 }}>
        <button onClick={() => { setMode('local'); setYahooResults([]) }} style={{ flex: 1, padding: 8, border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 11, fontFamily: 'inherit', background: mode === 'local' ? '#1e293b' : 'transparent', color: mode === 'local' ? '#22d3ee' : '#94a3b8' }}>
          📋 Base PEA ({ALL_SECURITIES.length})
        </button>
        <button onClick={() => setMode('yahoo')} style={{ flex: 1, padding: 8, border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 11, fontFamily: 'inherit', background: mode === 'yahoo' ? '#1e293b' : 'transparent', color: mode === 'yahoo' ? '#f59e0b' : '#94a3b8' }}>
          🌍 Yahoo Finance
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => handleSearch(e.target.value)} placeholder={mode === 'local' ? "Rechercher dans la base PEA..." : "iShares, Bitcoin, Tesla, Gold, Nasdaq..."} style={{ ...inputStyle, flex: 1, minWidth: 250 }} />
        {mode === 'local' && (
          <select value={typeF} onChange={e => setTypeF(e.target.value)} style={{ ...inputStyle, fontSize: 11 }}>
            <option value="all">Tous</option><option value="Action">Actions</option><option value="ETF">ETFs</option>
          </select>
        )}
        <span style={{ fontSize: 10, color: '#64748b', alignSelf: 'center' }}>{results.length} résultats</span>
      </div>

      {searching && <div style={{ padding: 12, textAlign: 'center', color: '#22d3ee', fontSize: 12 }}>Recherche sur Yahoo Finance...</div>}
      {mode === 'yahoo' && search.length < 2 && !searching && <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 12 }}>Tapez au moins 2 caractères pour chercher</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 8 }}>
        {results.slice(0, 60).map(sec => {
          const p = prices[sec.symbol]
          const tc = typeColors[sec.type] || '#64748b'
          return (
            <div key={sec.symbol} onClick={() => openStock(sec.symbol)} style={{ background: '#111827', borderRadius: 10, border: '1px solid #1e293b', padding: 14, cursor: 'pointer', transition: 'all 0.15s' }} onMouseEnter={e=>{e.currentTarget.style.borderColor='#22d3ee40';e.currentTarget.style.transform='translateY(-1px)'}} onMouseLeave={e=>{e.currentTarget.style.borderColor='#1e293b';e.currentTarget.style.transform='none'}}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sec.name}</div>
                  <div style={{ fontSize: 9, color: '#64748b', fontFamily: "'Space Mono', monospace" }}>{sec.symbol}</div>
                </div>
                <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: tc + '18', color: tc, fontWeight: 600, flexShrink: 0, marginLeft: 6 }}>{sec.type}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>{p?.price ? p.price.toFixed(2)+'€' : '—'}</div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 8, padding: '2px 5px', borderRadius: 3, background: (SC[sec.sector]||'#64748b')+'15', color: SC[sec.sector]||'#64748b', fontWeight: 600 }}>{sec.sector}</span>
                  <div style={{ fontSize: 8, color: '#64748b', marginTop: 2 }}>{sec.region} {sec.exchange ? '• '+sec.exchange : ''}</div>
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
  const [news, setNews] = useState([])
  const [newsLd, setNewsLd] = useState(false)
  const pos = positions.find(p => p.symbol === sym)
  const posInPortfolio = positions.find(p => p.symbol === sym)

  useEffect(() => {
    // Auto-load data + news
    setLd(true)
    fetchStockDetail(sym).then(d => { if (d) setDet(d); setLd(false) })
    setNewsLd(true)
    fetch('/api/news?symbols=' + sym).then(r => r.json()).then(d => setNews(d.news || [])).catch(() => {}).finally(() => setNewsLd(false))
  }, [sym])

  const price = det?.price || gp(sym)
  const stockName = det?.name || sec?.name || pos?.name || sym
  const kv = (l, v, c) => (
    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #1e293b10' }}>
      <span style={{ fontSize: 11, color: '#94a3b8' }}>{l}</span>
      <span style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", fontWeight: 600, color: c }}>{v}</span>
    </div>
  )

  // Build analysis summary from Yahoo data
  const buildAnalysis = () => {
    if (!det) return null
    const items = []
    if (det.per) {
      const perVal = Number(det.per)
      items.push({ label: 'Valorisation (PER)', value: perVal.toFixed(1), verdict: perVal < 12 ? 'Sous-évalué' : perVal < 20 ? 'Correctement valorisé' : perVal < 35 ? 'Valorisation élevée' : 'Très cher', color: perVal < 12 ? '#10b981' : perVal < 20 ? '#22d3ee' : perVal < 35 ? '#f59e0b' : '#ef4444' })
    }
    if (det.dividendYield) {
      const dy = Number(det.dividendYield)
      items.push({ label: 'Rendement dividende', value: dy.toFixed(2) + '%', verdict: dy > 4 ? 'Rendement élevé' : dy > 2 ? 'Rendement correct' : dy > 0 ? 'Rendement faible' : 'Pas de dividende', color: dy > 4 ? '#10b981' : dy > 2 ? '#22d3ee' : '#f59e0b' })
    }
    if (det.beta) {
      const b = Number(det.beta)
      items.push({ label: 'Volatilité (Bêta)', value: b.toFixed(2), verdict: b < 0.8 ? 'Défensif' : b < 1.2 ? 'Neutre' : 'Volatil', color: b < 0.8 ? '#10b981' : b < 1.2 ? '#22d3ee' : '#f59e0b' })
    }
    if (det.high52 && det.low52 && price) {
      const range = ((price - det.low52) / (det.high52 - det.low52) * 100)
      items.push({ label: 'Position dans le range 52s', value: range.toFixed(0) + '%', verdict: range > 80 ? 'Proche des plus hauts' : range > 50 ? 'Milieu de range' : range > 20 ? 'Milieu-bas de range' : 'Proche des plus bas', color: range > 80 ? '#f59e0b' : range > 50 ? '#22d3ee' : range > 20 ? '#22d3ee' : '#10b981' })
    }
    if (det.avg50 && det.avg200 && price) {
      const above50 = price > det.avg50
      const above200 = price > det.avg200
      const trend = above50 && above200 ? 'Tendance haussière' : !above50 && !above200 ? 'Tendance baissière' : 'Signal mixte'
      items.push({ label: 'Tendance technique', value: (above50 ? '> MM50' : '< MM50') + ' / ' + (above200 ? '> MM200' : '< MM200'), verdict: trend, color: trend === 'Tendance haussière' ? '#10b981' : trend === 'Tendance baissière' ? '#ef4444' : '#f59e0b' })
    }
    if (det.consensus) {
      const c = det.consensus
      items.push({ label: 'Consensus analystes', value: c, verdict: det.targetPrice ? 'Objectif: ' + det.targetPrice + ' € (' + ((det.targetPrice - price) / price * 100).toFixed(1) + '%)' : '', color: c.includes('Achat') ? '#10b981' : c === 'Neutre' ? '#f59e0b' : '#ef4444' })
    }
    return items
  }

  const analysisItems = buildAnalysis()

  return (
    <div>
      <button onClick={goBack} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', marginBottom: 12 }}>← Retour</button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>{stockName}</h1>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontFamily: "'Space Mono', monospace", color: '#64748b', fontSize: 11 }}>{sym}</span>
            {det?.sector && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: '#9B59B618', color: '#9B59B6', fontWeight: 600 }}>{det.sector}</span>}
            {det?.industry && <span style={{ fontSize: 9, color: '#64748b' }}>{det.industry}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 28, fontWeight: 700, color: '#f1f5f9' }}>{price > 0 ? price.toFixed(2) + ' €' : '—'}</div>
          {det?.changePct != null && <div style={{ color: det.changePct >= 0 ? '#10b981' : '#ef4444', fontSize: 13, fontFamily: "'Space Mono', monospace", fontWeight: 600 }}>{det.changePct >= 0 ? '▲' : '▼'} {Math.abs(det.changePct).toFixed(2)}%</div>}
        </div>
      </div>

      {ld && <div style={{ fontSize: 12, color: '#22d3ee', marginBottom: 10 }}>Chargement des données Yahoo Finance...</div>}

      {det && (
        <div>
          {/* Row 1: Key metrics + Dividends + Technique */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div style={{ background: '#111827', borderRadius: 10, border: '1px solid #1e293b', padding: 16 }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 12, color: '#22d3ee', fontWeight: 700 }}>📊 Bilan</h3>
              {[['Prix', price.toFixed(2)+' €', '#22d3ee'],
                det.per && ['PER', Number(det.per).toFixed(1), det.per<15?'#10b981':det.per<25?'#f59e0b':'#ef4444'],
                det.eps && ['BPA', det.eps+' €', '#22d3ee'],
                det.marketCap && ['Capitalisation', det.marketCap > 1e9 ? (det.marketCap/1e9).toFixed(1)+' Md€' : (det.marketCap/1e6).toFixed(0)+' M€', '#94a3b8'],
                det.beta && ['Bêta', Number(det.beta).toFixed(2), det.beta < 1 ? '#10b981' : '#f59e0b'],
                det.avgVolume && ['Volume moyen', Number(det.avgVolume).toLocaleString('fr-FR'), '#94a3b8'],
                det.high52 && ['+ Haut 52 semaines', det.high52+' €', '#10b981'],
                det.low52 && ['+ Bas 52 semaines', det.low52+' €', '#ef4444'],
              ].filter(Boolean).map(([l,v,c]) => kv(l,v,c))}
            </div>

            <div style={{ background: '#111827', borderRadius: 10, border: '1px solid #1e293b', padding: 16 }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 12, color: '#22d3ee', fontWeight: 700 }}>💰 Dividendes</h3>
              {det.dividend && Number(det.dividend) > 0 ? (
                <div>
                  {[['Montant annuel', det.dividend+' €', '#22d3ee'],
                    det.dividendYield && ['Rendement', det.dividendYield+'%', '#10b981'],
                    det.exDividendDate && ['Date ex-dividende', det.exDividendDate, '#f1f5f9'],
                  ].filter(Boolean).map(([l,v,c]) => kv(l,v,c))}
                  {posInPortfolio && <div style={{ marginTop: 10, padding: 8, background: '#0a0e17', borderRadius: 6 }}>
                    <div style={{ fontSize: 9, color: '#64748b' }}>Vos dividendes annuels estimés</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#22d3ee', fontFamily: "'Space Mono', monospace" }}>{(Number(det.dividend) * posInPortfolio.quantity).toFixed(2)} €</div>
                  </div>}
                </div>
              ) : <div style={{ fontSize: 11, color: '#64748b', padding: '10px 0' }}>Pas de dividende versé</div>}

              <h3 style={{ margin: '14px 0 10px', fontSize: 12, color: '#22d3ee', fontWeight: 700 }}>🎯 Consensus</h3>
              {det.consensus ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: String(det.consensus).includes('Achat')?'#10b981':det.consensus==='Neutre'?'#f59e0b':'#ef4444' }}>{det.consensus}</div>
                  {det.targetPrice && <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>Objectif: <span style={{ color: '#22d3ee', fontWeight: 700 }}>{det.targetPrice} €</span></div>}
                  {det.targetPrice && price > 0 && <div style={{ fontSize: 11, color: ((det.targetPrice - price) / price) >= 0 ? '#10b981' : '#ef4444', marginTop: 2 }}>Potentiel: {((det.targetPrice - price) / price * 100).toFixed(1)}%</div>}
                  {det.analystCount && <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>{det.analystCount} analystes</div>}
                </div>
              ) : <div style={{ fontSize: 11, color: '#64748b' }}>Non disponible</div>}
            </div>

            <div style={{ background: '#111827', borderRadius: 10, border: '1px solid #1e293b', padding: 16 }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 12, color: '#22d3ee', fontWeight: 700 }}>📐 Technique</h3>
              {det.support && kv('Support', det.support+' €', '#10b981')}
              {det.resistance && kv('Résistance', det.resistance+' €', '#ef4444')}
              {det.avg50 && kv('Moyenne mobile 50j', Number(det.avg50).toFixed(2)+' €', price > det.avg50 ? '#10b981' : '#ef4444')}
              {det.avg200 && kv('Moyenne mobile 200j', Number(det.avg200).toFixed(2)+' €', price > det.avg200 ? '#10b981' : '#ef4444')}
              {det.support && det.resistance && price > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 9, color: '#64748b', marginBottom: 4 }}>Position dans le range</div>
                  <div style={{ height: 6, background: '#1e293b', borderRadius: 3, position: 'relative' }}>
                    <div style={{ position: 'absolute', left: Math.min(100, Math.max(0, ((price - det.support) / (det.resistance - det.support)) * 100)) + '%', top: -3, width: 12, height: 12, background: '#22d3ee', borderRadius: '50%', transform: 'translateX(-50%)', border: '2px solid #111827' }} />
                  </div>
                </div>
              )}
              {det.nextEarnings && <div style={{ marginTop: 12 }}>{kv('📊 Prochains résultats', det.nextEarnings, '#f59e0b')}</div>}
            </div>
          </div>

          {/* Row 2: Analysis + News */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {/* Yahoo-based Analysis */}
            <div style={{ background: '#111827', borderRadius: 10, border: '1px solid #1e293b', padding: 18 }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>🏦 Analyse rapide</h3>
              {analysisItems && analysisItems.length > 0 ? (
                <div>
                  {analysisItems.map((item, i) => (
                    <div key={i} style={{ padding: '10px 0', borderBottom: i < analysisItems.length - 1 ? '1px solid #1e293b20' : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{item.label}</span>
                        <span style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", fontWeight: 700, color: item.color }}>{item.value}</span>
                      </div>
                      <div style={{ fontSize: 10, color: item.color, fontWeight: 600 }}>{item.verdict}</div>
                    </div>
                  ))}
                  {/* Overall score */}
                  <div style={{ marginTop: 14, padding: 12, background: '#0a0e17', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Signal global</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: det.consensus && String(det.consensus).includes('Achat') ? '#10b981' : det.consensus === 'Neutre' ? '#f59e0b' : '#94a3b8' }}>
                      {det.consensus && String(det.consensus).includes('Achat') ? '📈 Positif' : det.consensus === 'Neutre' ? '➡️ Neutre' : det.consensus && String(det.consensus).includes('Vente') ? '📉 Négatif' : '⏳ En attente de données'}
                    </div>
                    <div style={{ fontSize: 9, color: '#64748b', marginTop: 4 }}>Basé sur les données Yahoo Finance en temps réel</div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center', padding: 16 }}>Données insuffisantes pour l'analyse</div>
              )}
            </div>

            {/* News */}
            <div style={{ background: '#111827', borderRadius: 10, border: '1px solid #1e293b', padding: 18, maxHeight: 450, overflowY: 'auto' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>📰 Actualités {stockName}</h3>
              {newsLd && <div style={{ fontSize: 11, color: '#64748b', padding: 8 }}>Chargement...</div>}
              {!newsLd && news.length === 0 && <div style={{ fontSize: 11, color: '#64748b', padding: 8 }}>Aucune actualité récente trouvée</div>}
              {news.map((n, i) => (
                <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '10px 8px', background: '#0a0e17', borderRadius: 7, marginBottom: 6, textDecoration: 'none', border: '1px solid transparent', transition: 'border-color 0.15s' }} onMouseEnter={e => e.currentTarget.style.borderColor='#22d3ee30'} onMouseLeave={e => e.currentTarget.style.borderColor='transparent'}>
                  <div style={{ fontSize: 11, color: '#f1f5f9', lineHeight: 1.4, marginBottom: 4 }}>{n.title}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: '#94a3b8' }}>{n.publisher}</span>
                    {n.publishedAt && <span style={{ fontSize: 9, color: '#64748b' }}>{new Date(n.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {!det && !ld && (
        <div style={{ background: '#111827', borderRadius: 10, border: '1px solid #1e293b', padding: 36, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📈</div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>Impossible de charger les données pour ce titre</div>
          <button onClick={() => { setLd(true); fetchStockDetail(sym).then(d => { if (d) setDet(d); setLd(false) }) }} style={{ background: 'linear-gradient(135deg,#22d3ee,#6366f1)', border: 'none', color: '#fff', padding: '8px 18px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>Réessayer</button>
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
// BUDGET — Méthode 50/25/25
// ═══════════════════════════════════════════════════════════════
function BudgetPage({ b, setB }) {
  const totalIncome = b.salaryNet + b.partnerNet
  const rentAfterApl = Math.max(0, b.rent - b.apl)

  // Rent split proportional to income
  const myRentShare = b.partnerNet > 0 ? Math.round(rentAfterApl * (b.salaryNet / totalIncome)) : rentAfterApl
  const partnerRentShare = b.partnerNet > 0 ? Math.round(rentAfterApl * (b.partnerNet / totalIncome)) : 0

  // 50/25/25 based on MY net salary after my rent share
  const myAfterRent = b.salaryNet - myRentShare
  const needs = Math.round(myAfterRent * 0.50)      // Besoins (charges, courses, transport, etc.)
  const wants = Math.round(myAfterRent * 0.25)       // Plaisirs
  const invest = Math.round(myAfterRent * 0.25)      // Épargne/Investissement

  // Generate rent split curve based on partner salary
  const curveData = []
  for (let ps = 0; ps <= 2500; ps += 100) {
    const tot = b.salaryNet + ps
    const myShare = ps > 0 ? Math.round(rentAfterApl * (b.salaryNet / tot)) : rentAfterApl
    const partShare = ps > 0 ? Math.round(rentAfterApl * (ps / tot)) : 0
    curveData.push({ ps, my: myShare, part: partShare })
  }
  const maxRent = Math.max(...curveData.map(d => d.my), rentAfterApl)

  const inputStyle = { background: '#0a0e17', border: '1px solid #1e293b', color: '#f1f5f9', width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14, fontFamily: "'Space Mono', monospace", outline: 'none', boxSizing: 'border-box', textAlign: 'right' }
  const labelStyle = { display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 5 }
  const cardStyle = { background: '#111827', borderRadius: 10, border: '1px solid #1e293b', padding: 18 }

  return (
    <div>
      <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>💰 Budget — Méthode 50/25/25</h2>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: '#94a3b8' }}>50% besoins essentiels • 25% plaisirs • 25% épargne/investissement</p>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 14 }}>
        {/* Left: Inputs */}
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 600, color: '#22d3ee' }}>📝 Vos revenus</h3>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Votre salaire brut</label>
            <div style={{ position: 'relative' }}>
              <input type="number" value={b.salaryGross} onChange={e => setB({...b, salaryGross: Number(e.target.value)})} style={inputStyle} />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: 12 }}>€</span>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Votre salaire net (après impôt)</label>
            <div style={{ position: 'relative' }}>
              <input type="number" value={b.salaryNet} onChange={e => setB({...b, salaryNet: Number(e.target.value)})} style={inputStyle} />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: 12 }}>€</span>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Salaire net de votre copine</label>
            <div style={{ position: 'relative' }}>
              <input type="number" value={b.partnerNet} onChange={e => setB({...b, partnerNet: Number(e.target.value)})} style={inputStyle} />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: 12 }}>€</span>
            </div>
            <div style={{ fontSize: 9, color: '#64748b', marginTop: 3 }}>Mettez 0 si pas de revenu actuellement</div>
          </div>

          <div style={{ borderTop: '1px solid #1e293b', paddingTop: 14, marginTop: 14 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 600, color: '#22d3ee' }}>🏠 Logement</h3>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Loyer mensuel</label>
              <div style={{ position: 'relative' }}>
                <input type="number" value={b.rent} onChange={e => setB({...b, rent: Number(e.target.value)})} style={inputStyle} />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: 12 }}>€</span>
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>APL mensuelles</label>
              <div style={{ position: 'relative' }}>
                <input type="number" value={b.apl} onChange={e => setB({...b, apl: Number(e.target.value)})} style={inputStyle} />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: 12 }}>€</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Results */}
        <div>
          {/* Rent split */}
          <div style={{ ...cardStyle, marginBottom: 14 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>🏠 Répartition du loyer</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div style={{ background: '#0a0e17', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Loyer après APL</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b', fontFamily: "'Space Mono', monospace" }}>{rentAfterApl} €</div>
              </div>
              <div style={{ background: '#0a0e17', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Votre part</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#22d3ee', fontFamily: "'Space Mono', monospace" }}>{myRentShare} €</div>
                <div style={{ fontSize: 9, color: '#64748b' }}>{totalIncome > 0 ? Math.round(myRentShare / rentAfterApl * 100) : 100}%</div>
              </div>
              <div style={{ background: '#0a0e17', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Sa part</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#a78bfa', fontFamily: "'Space Mono', monospace" }}>{partnerRentShare} €</div>
                <div style={{ fontSize: 9, color: '#64748b' }}>{totalIncome > 0 && b.partnerNet > 0 ? Math.round(partnerRentShare / rentAfterApl * 100) : 0}%</div>
              </div>
            </div>

            {/* Rent curve */}
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>Évolution de la répartition selon le salaire de votre copine</div>
            <svg viewBox="0 0 700 200" style={{ width: '100%', height: 180 }}>
              {[0,.25,.5,.75,1].map(p => {
                const y = 180 - p * 160
                return <g key={p}><line x1="50" y1={y} x2="670" y2={y} stroke="#1e293b" /><text x="45" y={y+4} fill="#64748b" fontSize="8" textAnchor="end" fontFamily="Space Mono">{Math.round(maxRent*p)}€</text></g>
              })}
              {curveData.filter((_, i) => i % 5 === 0).map(d => (
                <text key={d.ps} x={50 + (d.ps / 2500) * 620} y={196} fill="#64748b" fontSize="7" textAnchor="middle" fontFamily="Space Mono">{d.ps}€</text>
              ))}
              <polyline points={curveData.map(d => (50 + (d.ps / 2500) * 620) + ',' + (180 - (d.my / maxRent) * 160)).join(' ')} fill="none" stroke="#22d3ee" strokeWidth="2.5" />
              <polyline points={curveData.map(d => (50 + (d.ps / 2500) * 620) + ',' + (180 - (d.part / maxRent) * 160)).join(' ')} fill="none" stroke="#a78bfa" strokeWidth="2.5" />
              {b.partnerNet > 0 && <line x1={50 + (b.partnerNet / 2500) * 620} y1="20" x2={50 + (b.partnerNet / 2500) * 620} y2="180" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4,3" />}
            </svg>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 4 }}>
              <span style={{ fontSize: 10, color: '#22d3ee' }}>━━ Vous</span>
              <span style={{ fontSize: 10, color: '#a78bfa' }}>━━ Copine</span>
              {b.partnerNet > 0 && <span style={{ fontSize: 10, color: '#f59e0b' }}>┆ Salaire actuel</span>}
            </div>
          </div>

          {/* 50/25/25 breakdown */}
          <div style={{ ...cardStyle }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>📊 Répartition 50/25/25</h3>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 14 }}>Basée sur votre salaire net ({b.salaryNet}€) moins votre part de loyer ({myRentShare}€) = <span style={{ color: '#22d3ee', fontWeight: 700 }}>{myAfterRent}€</span> disponibles</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[
                ['🏠 Besoins (50%)', needs, '#ef4444', 'Courses, transport, téléphone, assurance, abonnements essentiels'],
                ['🎮 Plaisirs (25%)', wants, '#f59e0b', 'Sorties, restos, shopping, loisirs, Spotify, Netflix'],
                ['📈 Investissement (25%)', invest, '#10b981', 'PEA, épargne, crypto, formation'],
              ].map(([label, amount, color, desc]) => (
                <div key={label} style={{ background: '#0a0e17', borderRadius: 10, padding: 16, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }} />
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: color, fontFamily: "'Space Mono', monospace", marginBottom: 6 }}>{amount} €</div>
                  <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.4 }}>{desc}</div>
                </div>
              ))}
            </div>

            {/* Budget bar */}
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>Répartition visuelle de votre salaire</div>
              <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 28 }}>
                <div style={{ width: (myRentShare / b.salaryNet * 100) + '%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 600 }}>Loyer {myRentShare}€</div>
                <div style={{ width: (needs / b.salaryNet * 100) + '%', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 600 }}>Besoins {needs}€</div>
                <div style={{ width: (wants / b.salaryNet * 100) + '%', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 600 }}>Plaisirs {wants}€</div>
                <div style={{ width: (invest / b.salaryNet * 100) + '%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 600 }}>Invest {invest}€</div>
              </div>
            </div>

            {/* Monthly summary */}
            <div style={{ marginTop: 16, padding: 14, background: '#0a0e17', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#f1f5f9' }}>📋 Récap mensuel</h4>
              {[
                ['Salaire net', b.salaryNet + ' €', '#22d3ee'],
                ['- Votre part loyer', '- ' + myRentShare + ' €', '#6366f1'],
                ['= Reste à répartir', myAfterRent + ' €', '#f1f5f9'],
                [''],
                ['→ Besoins (50%)', needs + ' €', '#ef4444'],
                ['→ Plaisirs (25%)', wants + ' €', '#f59e0b'],
                ['→ Investissement (25%)', invest + ' €', '#10b981'],
                [''],
                ['Votre copine doit vous donner', partnerRentShare + ' €', '#a78bfa'],
              ].map((item, i) => {
                if (!item[0]) return <div key={i} style={{ height: 8 }} />
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: item[0].startsWith('=') ? '1px solid #1e293b' : 'none' }}>
                    <span style={{ fontSize: 11, color: item[0].startsWith('=') || item[0].startsWith('Votre copine') ? '#f1f5f9' : '#94a3b8', fontWeight: item[0].startsWith('=') || item[0].startsWith('Votre copine') ? 700 : 400 }}>{item[0]}</span>
                    <span style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", fontWeight: 700, color: item[2] }}>{item[1]}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
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
