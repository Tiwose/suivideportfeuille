'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase, signUp, signIn, signOut, getUser, getPositions, addPosition, deletePosition } from '../lib/supabase'
import { ALL_SECURITIES } from '../lib/stocks-db'

// ═══════════════════════════════════════════════════════════════
// THEME SYSTEM
// ═══════════════════════════════════════════════════════════════
const themes = {
  dark: { bg:'#0f1117', card:'#1a1d28', card2:'#12141d', border:'#2a2d3a', text:'#eaedf3', muted:'#8b90a0', accent:'#6c8cff', accent2:'#a78bfa', green:'#34d399', red:'#f87171', orange:'#fbbf24', gradient:'linear-gradient(135deg,#6c8cff,#a78bfa)' },
  light: { bg:'#f5f0eb', card:'#ffffff', card2:'#faf7f4', border:'#e5dfd8', text:'#2d2a26', muted:'#8a8580', accent:'#5b6abf', accent2:'#8b6fbf', green:'#22a06b', red:'#de350b', orange:'#d97706', gradient:'linear-gradient(135deg,#5b6abf,#8b6fbf)' }
}

// ═══════════════════════════════════════════════════════════════
// COLORS
// ═══════════════════════════════════════════════════════════════
const SC = {"Luxe":"#D4AF37","Conso. Cyclique":"#4ECDC4","Industrie":"#7f8c8d","Santé":"#e74c3c","Énergie":"#f39c12","Finance":"#3498db","Technologie":"#9b59b6","Télécom":"#1abc9c","Conso. Défensive":"#27ae60","Communication":"#e67e22","Matériaux":"#8e44ad","Immobilier":"#34495e","Services":"#16a085","ETF Monde":"#2980b9","ETF US":"#3498db","ETF Europe":"#1f618d","ETF Émergent":"#d35400","ETF Japon":"#c0392b","ETF Asie":"#e74c3c","ETF Techno":"#8e44ad","ETF Finance":"#2471a3","ETF ESG":"#1e8449","ETF US Small":"#2471a3","ETF France":"#002395","ETF Allemagne":"#dd0000","ETF Small Cap":"#af601a","ETF Santé":"#e74c3c","ETF Matières":"#b7950b","ETF UK":"#2e4053"}
const RC = {"France":"#002395","Allemagne":"#dd0000","Pays-Bas":"#ff6b00","Belgique":"#fdda24","Danemark":"#c8102e","Italie":"#009246","Espagne":"#aa151b","Finlande":"#003580","Europe":"#003399","Monde":"#6c8cff","USA":"#3c3b6e","Émergents":"#d35400","Japon":"#bc002d","Asie":"#de2910","Suède":"#006aa7","Portugal":"#006600","Irlande":"#169b62","UK":"#012169"}
const TC = { 'Action':'#9b59b6','ETF':'#3498db','Crypto':'#f39c12','Matière première':'#27ae60','Indice':'#e74c3c','OPCVM':'#1abc9c','Devise':'#8e44ad' }

async function fetchPrices(symbols) {
  try { const r = await fetch('/api/prices?symbols='+symbols.join(',')); const d = await r.json(); return d.prices||{} } catch(e) { return {} }
}
async function fetchStockDetail(symbol) {
  try { const r = await fetch('/api/stock/'+symbol); if(!r.ok) return null; return await r.json() } catch(e) { return null }
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function Home() {
  const [theme, setTheme] = useState('dark')
  const t = themes[theme]
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
  const [authForm, setAuthForm] = useState({email:'',password:'',name:''})
  const [authErr, setAuthErr] = useState('')
  const [proj, setProj] = useState({initial:10000,monthly:500,years:20,rate:8})
  const [budget, setBudget] = useState({salaryGross:2300,salaryNet:2080,partnerNet:0,rent:713,apl:0})
  const [dca, setDca] = useState({ items:[
    {name:'Amundi MSCI World (CW8)',symbol:'CW8.PA',monthly:200,done:Array(12).fill(false)},
    {name:'Amundi Emerging Markets',symbol:'PAEEM.PA',monthly:50,done:Array(12).fill(false)},
    {name:'Bitcoin',symbol:'BTC-EUR',monthly:50,done:Array(12).fill(false)},
    {name:'Stock picking',symbol:'',monthly:100,done:Array(12).fill(false)},
  ]})

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      if(session?.user){setUser(session.user);loadPositions(session.user.id)}
      setLoading(false)
    })
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>{
      if(session?.user){setUser(session.user);loadPositions(session.user.id)} else {setUser(null);setPositions([])}
    })
    return ()=>subscription.unsubscribe()
  },[])

  const loadPositions=async(uid)=>{const {data}=await getPositions(uid);setPositions(data||[])}

  const gp=useCallback(sym=>{if(prices[sym]?.price!=null) return prices[sym].price;return 0},[prices])

  const refresh=useCallback(async()=>{
    if(priceLoading||!positions.length) return;setPriceLoading(true)
    try{const p=await fetchPrices(positions.map(x=>x.symbol));setPrices(prev=>({...prev,...p}));setLastFetch(new Date())}
    finally{setPriceLoading(false)}
  },[positions,priceLoading])

  useEffect(()=>{if(positions.length>0&&!lastFetch)refresh()},[positions])

  const tv=useMemo(()=>positions.reduce((s,p)=>s+gp(p.symbol)*p.quantity,0),[positions,gp])
  const ti=useMemo(()=>positions.reduce((s,p)=>s+p.buy_price*p.quantity,0),[positions])

  const handleAuth=async()=>{
    setAuthErr('')
    if(authMode==='login'){
      const{error}=await signIn(authForm.email,authForm.password)
      if(error) setAuthErr('Email ou mot de passe incorrect')
    } else {
      if(!authForm.name||!authForm.email||!authForm.password){setAuthErr('Tous les champs requis');return}
      if(authForm.password.length<6){setAuthErr('6 caractères min.');return}
      const {data:uc}=await supabase.rpc('count_users')
      if(uc>=10){setAuthErr('Limite de 10 comptes atteinte.');return}
      const{error}=await signUp(authForm.email,authForm.password,authForm.name)
      if(error) setAuthErr(error.message)
    }
  }
  const handleLogout=async()=>{await signOut();setUser(null);setPositions([]);setPrices({});setPage('dashboard')}

  const handleAddPosition=async(pos)=>{
    const existing=positions.find(p=>p.symbol===pos.symbol)
    if(existing){
      const oldQ=Number(existing.quantity),oldP=Number(existing.buy_price),newQ=pos.qty,newP=pos.pru
      const totalQ=oldQ+newQ,wPru=Math.round(((oldQ*oldP)+(newQ*newP))/totalQ*100)/100
      await supabase.from('positions').update({quantity:totalQ,buy_price:wPru}).eq('id',existing.id)
    } else {
      const sec=ALL_SECURITIES.find(s=>s.symbol===pos.symbol)
      await addPosition(user.id,{symbol:pos.symbol,name:pos.name||sec?.name||pos.symbol,quantity:pos.qty,buyPrice:pos.pru})
    }
    await loadPositions(user.id);setShowAdd(false)
  }
  const handleDelete=async(id,e)=>{e.stopPropagation();await deletePosition(id);await loadPositions(user.id)}
  const openStock=sym=>{setSelSym(sym);setPage('stock')}

  if(loading) return <div style={{minHeight:'100vh',background:t.bg,display:'flex',alignItems:'center',justifyContent:'center',color:t.muted,fontFamily:'Inter,sans-serif'}}>Chargement...</div>
  if(!user) return <AuthPage mode={authMode} setMode={setAuthMode} form={authForm} setForm={setAuthForm} err={authErr} onSubmit={handleAuth} t={t} theme={theme}/>

  const userName=user.user_metadata?.name||user.email?.split('@')[0]||'User'
  const navItems=[['dashboard','Portfolio'],['market','Marché'],['analyse','Analyse'],['projection','Projections'],['exposure','Exposition'],['dca','DCA'],['budget','Budget']]

  return (
    <div style={{minHeight:'100vh',background:t.bg,color:t.text,fontFamily:"'Inter','Segoe UI',sans-serif",transition:'all 0.3s'}}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet"/>
      <nav style={{background:theme==='dark'?'#13151fee':'#ffffffee',borderBottom:'1px solid '+t.border,backdropFilter:'blur(14px)',position:'sticky',top:0,zIndex:50,padding:'0 20px',height:54,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <div onClick={()=>setPage('dashboard')} style={{display:'flex',alignItems:'center',gap:7,cursor:'pointer'}}>
            <div style={{width:30,height:30,background:t.gradient,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'JetBrains Mono'",fontWeight:800,fontSize:15,color:'#fff'}}>P</div>
            <span style={{fontWeight:800,fontSize:16}}>PortfolioLab</span>
          </div>
          <div style={{display:'flex',gap:2}}>
            {navItems.map(([id,label])=>(
              <button key={id} onClick={()=>setPage(id)} style={{background:page===id?t.border:'transparent',color:page===id?t.accent:t.muted,border:'none',padding:'6px 12px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:600,fontFamily:'inherit',transition:'all 0.2s'}}>{label}</button>
            ))}
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button onClick={()=>setTheme(theme==='dark'?'light':'dark')} style={{background:'none',border:'1px solid '+t.border,color:t.muted,width:32,height:32,borderRadius:8,cursor:'pointer',fontSize:15,display:'flex',alignItems:'center',justifyContent:'center'}}>{theme==='dark'?'☀️':'🌙'}</button>
          <span style={{fontSize:12,color:t.muted}}>{userName}</span>
          <button onClick={handleLogout} style={{background:'none',border:'1px solid '+t.border,color:t.muted,padding:'6px 12px',borderRadius:7,cursor:'pointer',fontSize:11,fontFamily:'inherit'}}>Déco.</button>
        </div>
      </nav>
      <div style={{maxWidth:1400,margin:'0 auto',padding:'18px 20px'}}>
        {page==='dashboard'&&<DashPage positions={positions} gp={gp} tv={tv} ti={ti} openStock={openStock} onAdd={()=>setShowAdd(true)} refresh={refresh} priceLoading={priceLoading} lastFetch={lastFetch} prices={prices} onDelete={handleDelete} t={t}/>}
        {page==='market'&&<MarketPage openStock={openStock} gp={gp} prices={prices} t={t}/>}
        {page==='analyse'&&<AnalysePage t={t} openStock={openStock}/>}
        {page==='projection'&&<ProjPage p={proj} setP={setProj} tv={tv} t={t}/>}
        {page==='exposure'&&<ExpoPage positions={positions} gp={gp} t={t}/>}
        {page==='dca'&&<DCAPage dca={dca} setDca={setDca} t={t}/>}
        {page==='budget'&&<BudgetPage b={budget} setB={setBudget} t={t}/>}
        {page==='stock'&&selSym&&<StockPage sym={selSym} gp={gp} goBack={()=>setPage('dashboard')} prices={prices} positions={positions} t={t}/>}
      </div>
      {showAdd&&<AddModal onClose={()=>setShowAdd(false)} onAdd={handleAddPosition} t={t}/>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════
function AuthPage({mode,setMode,form,setForm,err,onSubmit,t,theme}){
  const inp={background:t.card2,border:'1px solid '+t.border,color:t.text,width:'100%',padding:'11px 14px',borderRadius:10,fontSize:14,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}
  return(
    <div style={{minHeight:'100vh',background:t.bg,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Inter',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet"/>
      <div style={{width:400,padding:36,background:t.card,borderRadius:16,border:'1px solid '+t.border}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{width:48,height:48,background:t.gradient,borderRadius:12,display:'inline-flex',alignItems:'center',justifyContent:'center',fontFamily:"'JetBrains Mono'",fontWeight:800,fontSize:22,color:'#fff',marginBottom:14}}>P</div>
          <h1 style={{fontSize:24,fontWeight:800,color:t.text,margin:'0 0 4px'}}>PortfolioLab</h1>
          <p style={{color:t.muted,fontSize:14,margin:0}}>Gérez votre portfolio intelligemment</p>
        </div>
        <div style={{display:'flex',gap:3,background:t.card2,borderRadius:10,padding:3,marginBottom:22}}>
          {['login','register'].map(m=>(
            <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:10,border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13,fontFamily:'inherit',background:mode===m?t.border:'transparent',color:mode===m?t.accent:t.muted}}>{m==='login'?'Connexion':'Inscription'}</button>
          ))}
        </div>
        {mode==='register'&&<div style={{marginBottom:14}}><label style={{display:'block',fontSize:13,color:t.muted,marginBottom:6}}>Nom complet</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Jean Dupont" style={inp}/></div>}
        <div style={{marginBottom:14}}><label style={{display:'block',fontSize:13,color:t.muted,marginBottom:6}}>Email</label><input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} type="email" placeholder="votre@email.com" style={inp}/></div>
        <div style={{marginBottom:22}}><label style={{display:'block',fontSize:13,color:t.muted,marginBottom:6}}>Mot de passe</label><input value={form.password} onChange={e=>setForm({...form,password:e.target.value})} type="password" placeholder="••••••" style={inp} onKeyDown={e=>{if(e.key==='Enter')onSubmit()}}/></div>
        {err&&<div style={{background:t.red+'15',border:'1px solid '+t.red+'40',padding:'10px 14px',borderRadius:8,color:t.red,fontSize:13,marginBottom:14}}>{err}</div>}
        <button onClick={onSubmit} style={{width:'100%',padding:14,background:t.gradient,border:'none',borderRadius:10,color:'#fff',fontWeight:700,fontSize:15,cursor:'pointer',fontFamily:'inherit'}}>{mode==='login'?'Se connecter':'Créer mon compte'}</button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
function DashPage({positions,gp,tv,ti,openStock,onAdd,refresh,priceLoading,lastFetch,prices,onDelete,t}){
  const tg=tv-ti,tp=ti>0?(tg/ti*100):0
  const [sortKey,setSortKey]=useState('weight')
  const [sortDir,setSortDir]=useState('desc')
  const toggleSort=k=>{if(sortKey===k) setSortDir(d=>d==='asc'?'desc':'asc'); else{setSortKey(k);setSortDir('desc')}}
  const sorted=useMemo(()=>[...positions].sort((a,b)=>{
    let va,vb;const cA=gp(a.symbol),cB=gp(b.symbol)
    switch(sortKey){case 'name':va=a.name.toLowerCase();vb=b.name.toLowerCase();break;case 'qty':va=a.quantity;vb=b.quantity;break;case 'value':va=cA*a.quantity;vb=cB*b.quantity;break;case 'weight':va=tv>0?(cA*a.quantity/tv):0;vb=tv>0?(cB*b.quantity/tv):0;break;case 'perf':va=a.buy_price>0?((cA-a.buy_price)/a.buy_price):0;vb=b.buy_price>0?((cB-b.buy_price)/b.buy_price):0;break;default:va=0;vb=0}
    if(typeof va==='string') return sortDir==='asc'?va.localeCompare(vb):vb.localeCompare(va)
    return sortDir==='asc'?va-vb:vb-va
  }),[positions,sortKey,sortDir,gp,tv])
  const thS=k=>({padding:'10px 12px',textAlign:'left',fontSize:10,fontWeight:600,color:sortKey===k?t.accent:t.muted,textTransform:'uppercase',cursor:'pointer',letterSpacing:'0.5px'})
  const ar=k=>sortKey===k?(sortDir==='asc'?' ↑':' ↓'):''
  const btn={background:t.gradient,border:'none',color:'#fff',padding:'9px 20px',borderRadius:9,cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit'}

  return(<div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
      <h2 style={{margin:0,fontSize:20,fontWeight:800}}>Mon Portfolio</h2>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        {lastFetch&&<span style={{fontSize:10,color:t.muted}}>Màj: {lastFetch.toLocaleTimeString('fr-FR')}</span>}
        <button onClick={refresh} disabled={priceLoading||!positions.length} style={{...btn,opacity:priceLoading?0.5:1}}>{priceLoading?'Chargement...':'Actualiser les prix'}</button>
      </div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
      {[['Valeur totale',tv.toLocaleString('fr-FR',{maximumFractionDigits:2})+' €',t.accent],['Investi',ti.toLocaleString('fr-FR',{maximumFractionDigits:2})+' €',t.accent2],['+/- Value',(tg>=0?'+':'')+tg.toLocaleString('fr-FR',{maximumFractionDigits:2})+' €',tg>=0?t.green:t.red,(tp>=0?'+':'')+tp.toFixed(2)+'%'],['Positions',String(positions.length),t.orange]].map(([l,v,c,sub],i)=>(
        <div key={i} style={{background:t.card,borderRadius:12,border:'1px solid '+t.border,padding:16,position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:c,borderRadius:'12px 12px 0 0'}}/>
          <div style={{fontSize:11,color:t.muted,marginBottom:4}}>{l}</div>
          <div style={{fontSize:20,fontWeight:800,fontFamily:"'JetBrains Mono'",color:c}}>{v}</div>
          {sub&&<div style={{fontSize:12,color:c,marginTop:3,fontWeight:600}}>{sub}</div>}
        </div>
      ))}
    </div>
    <div style={{background:t.card,borderRadius:12,border:'1px solid '+t.border,overflow:'hidden'}}>
      <div style={{padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid '+t.border}}>
        <h3 style={{margin:0,fontSize:15,fontWeight:700}}>Positions</h3>
        <button onClick={onAdd} style={btn}>+ Ajouter</button>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr style={{background:t.card2}}>
            <th onClick={()=>toggleSort('name')} style={thS('name')}>Titre{ar('name')}</th>
            <th onClick={()=>toggleSort('qty')} style={thS('qty')}>Qté{ar('qty')}</th>
            <th style={{...thS('pru')}}>PRU</th>
            <th style={{...thS('price')}}>Cours</th>
            <th onClick={()=>toggleSort('value')} style={thS('value')}>Valeur{ar('value')}</th>
            <th onClick={()=>toggleSort('weight')} style={thS('weight')}>Poids{ar('weight')}</th>
            <th onClick={()=>toggleSort('perf')} style={thS('perf')}>Perf{ar('perf')}</th>
            <th style={{width:30}}></th>
          </tr></thead>
          <tbody>
            {sorted.map(pos=>{const cur=gp(pos.symbol),val=cur*pos.quantity,gain=(cur-pos.buy_price)*pos.quantity,pct=pos.buy_price>0?((cur-pos.buy_price)/pos.buy_price*100):0,w=tv>0?(val/tv*100):0,live=prices[pos.symbol]?.price!=null
              return(<tr key={pos.id} onClick={()=>openStock(pos.symbol)} style={{borderBottom:'1px solid '+t.border,cursor:'pointer',transition:'background 0.15s'}} onMouseEnter={e=>e.currentTarget.style.background=t.border+'40'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <td style={{padding:'12px'}}><div style={{fontWeight:600,fontSize:13}}>{pos.name}</div><div style={{fontSize:10,color:t.muted,fontFamily:"'JetBrains Mono'"}}>{pos.symbol}{live&&<span style={{color:t.green,marginLeft:4}}>●</span>}</div></td>
                <td style={{padding:'12px',fontFamily:"'JetBrains Mono'",fontSize:12}}>{pos.quantity}</td>
                <td style={{padding:'12px',fontFamily:"'JetBrains Mono'",fontSize:12}}>{Number(pos.buy_price).toFixed(2)}€</td>
                <td style={{padding:'12px',fontFamily:"'JetBrains Mono'",fontSize:12}}>{cur>0?cur.toFixed(2)+'€':'—'}</td>
                <td style={{padding:'12px',fontFamily:"'JetBrains Mono'",fontSize:12}}>{cur>0?val.toLocaleString('fr-FR',{maximumFractionDigits:0})+'€':'—'}</td>
                <td style={{padding:'12px'}}>{cur>0&&<div style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:40,height:5,background:t.border,borderRadius:3}}><div style={{height:5,background:t.accent,borderRadius:3,width:Math.min(w,100)+'%'}}/></div><span style={{fontSize:11,fontFamily:"'JetBrains Mono'",fontWeight:700,color:t.accent}}>{w.toFixed(1)}%</span></div>}</td>
                <td style={{padding:'12px'}}>{cur>0&&<span style={{background:gain>=0?t.green+'18':t.red+'18',color:gain>=0?t.green:t.red,padding:'4px 8px',borderRadius:6,fontSize:11,fontWeight:700,fontFamily:"'JetBrains Mono'"}}>{pct>=0?'+':''}{pct.toFixed(2)}%</span>}</td>
                <td style={{padding:'12px'}}><button onClick={e=>onDelete(pos.id,e)} style={{background:t.red+'15',border:'none',color:t.red,padding:'4px 8px',borderRadius:5,cursor:'pointer',fontSize:10}}>✕</button></td>
              </tr>)})}
            {!positions.length&&<tr><td colSpan={8} style={{padding:36,textAlign:'center',color:t.muted,fontSize:13}}>Aucune position — cliquez "Ajouter"</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  </div>)
}

// ═══════════════════════════════════════════════════════════════
// MARKET
// ═══════════════════════════════════════════════════════════════
function MarketPage({openStock,gp,prices,t}){
  const [search,setSearch]=useState('');const [mode,setMode]=useState('local');const [yahoo,setYahoo]=useState([]);const [searching,setSearching]=useState(false);const timeout=useRef(null)
  const local=useMemo(()=>ALL_SECURITIES.filter(s=>{const q=search.toLowerCase();return !q||s.name.toLowerCase().includes(q)||s.symbol.toLowerCase().includes(q)}),[search])
  const searchYahoo=async q=>{if(!q||q.length<2){setYahoo([]);return};setSearching(true);try{const r=await fetch('/api/search?q='+encodeURIComponent(q));const d=await r.json();setYahoo(d.results||[])}catch(e){setYahoo([])}finally{setSearching(false)}}
  const handleSearch=v=>{setSearch(v);if(mode==='yahoo'){if(timeout.current)clearTimeout(timeout.current);timeout.current=setTimeout(()=>searchYahoo(v),400)}}
  const results=mode==='local'?local:yahoo
  return(<div>
    <h2 style={{margin:'0 0 14px',fontSize:20,fontWeight:800}}>Explorer le marché</h2>
    <div style={{display:'flex',gap:4,background:t.card,borderRadius:10,padding:3,marginBottom:14,maxWidth:400}}>
      <button onClick={()=>{setMode('local');setYahoo([])}} style={{flex:1,padding:9,border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:12,fontFamily:'inherit',background:mode==='local'?t.border:'transparent',color:mode==='local'?t.accent:t.muted}}>Base PEA ({ALL_SECURITIES.length})</button>
      <button onClick={()=>setMode('yahoo')} style={{flex:1,padding:9,border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:12,fontFamily:'inherit',background:mode==='yahoo'?t.border:'transparent',color:mode==='yahoo'?t.orange:t.muted}}>Yahoo Finance</button>
    </div>
    <input value={search} onChange={e=>handleSearch(e.target.value)} placeholder={mode==='local'?"Rechercher...":"iShares, Bitcoin, Tesla, Gold..."} style={{width:'100%',maxWidth:500,padding:'10px 14px',background:t.card,border:'1px solid '+t.border,borderRadius:10,color:t.text,fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box',marginBottom:14}}/>
    {searching&&<div style={{padding:10,color:t.accent,fontSize:12}}>Recherche...</div>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))',gap:8}}>
      {results.slice(0,60).map(sec=>{const p=prices[sec.symbol];return(
        <div key={sec.symbol} onClick={()=>openStock(sec.symbol)} style={{background:t.card,borderRadius:10,border:'1px solid '+t.border,padding:16,cursor:'pointer',transition:'all 0.15s'}} onMouseEnter={e=>e.currentTarget.style.borderColor=t.accent+'60'} onMouseLeave={e=>e.currentTarget.style.borderColor=t.border}>
          <div style={{fontWeight:700,fontSize:13}}>{sec.name}</div>
          <div style={{fontSize:10,color:t.muted,fontFamily:"'JetBrains Mono'",marginBottom:6}}>{sec.symbol}</div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}>
            <div style={{fontFamily:"'JetBrains Mono'",fontSize:17,fontWeight:800}}>{p?.price?p.price.toFixed(2)+'€':'—'}</div>
            <span style={{fontSize:9,padding:'3px 7px',borderRadius:5,background:(TC[sec.type]||t.muted)+'18',color:TC[sec.type]||t.muted,fontWeight:600}}>{sec.type||'Action'}</span>
          </div>
        </div>
      )})}
    </div>
  </div>)
}

// ═══════════════════════════════════════════════════════════════
// STOCK DETAIL
// ═══════════════════════════════════════════════════════════════
function StockPage({sym,gp,goBack,prices,positions,t}){
  const sec=ALL_SECURITIES.find(s=>s.symbol===sym)
  const [det,setDet]=useState(null);const [ld,setLd]=useState(false)
  const pos=positions.find(p=>p.symbol===sym)
  useEffect(()=>{setLd(true);fetchStockDetail(sym).then(d=>{if(d)setDet(d);setLd(false)})},[sym])
  const price=det?.price||gp(sym)
  const name=det?.name||sec?.name||pos?.name||sym
  const kv=(l,v,c)=><div key={l} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid '+t.border+'30'}}><span style={{fontSize:12,color:t.muted}}>{l}</span><span style={{fontSize:12,fontFamily:"'JetBrains Mono'",fontWeight:700,color:c}}>{v}</span></div>

  const signals=[]
  if(det){
    if(det.per){const v=Number(det.per);signals.push({l:'PER',v:v.toFixed(1),verdict:v<12?'Sous-évalué':v<20?'Correct':v<35?'Élevé':'Très cher',c:v<12?t.green:v<20?t.accent:v<35?t.orange:t.red})}
    if(det.dividendYield){const v=Number(det.dividendYield);signals.push({l:'Rendement div.',v:v.toFixed(2)+'%',verdict:v>4?'Élevé':v>2?'Correct':'Faible',c:v>4?t.green:v>2?t.accent:t.orange})}
    if(det.beta){const v=Number(det.beta);signals.push({l:'Bêta',v:v.toFixed(2),verdict:v<0.8?'Défensif':v<1.2?'Neutre':'Volatil',c:v<0.8?t.green:v<1.2?t.accent:t.orange})}
    if(det.avg50&&det.avg200&&price){const a50=price>det.avg50,a200=price>det.avg200;signals.push({l:'Tendance',v:(a50?'> MM50':'< MM50')+' / '+(a200?'> MM200':'< MM200'),verdict:a50&&a200?'Haussière':!a50&&!a200?'Baissière':'Mixte',c:a50&&a200?t.green:!a50&&!a200?t.red:t.orange})}
    if(det.consensus){signals.push({l:'Consensus',v:det.consensus,verdict:det.targetPrice?'Objectif: '+det.targetPrice+' €':'',c:String(det.consensus).includes('Achat')?t.green:det.consensus==='Neutre'?t.orange:t.red})}
  }

  return(<div>
    <button onClick={goBack} style={{background:'none',border:'none',color:t.muted,cursor:'pointer',fontSize:12,fontFamily:'inherit',marginBottom:12}}>← Retour</button>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
      <div><h1 style={{margin:'0 0 4px',fontSize:26,fontWeight:800}}>{name}</h1><span style={{fontFamily:"'JetBrains Mono'",color:t.muted,fontSize:12}}>{sym}</span></div>
      <div style={{textAlign:'right'}}><div style={{fontFamily:"'JetBrains Mono'",fontSize:30,fontWeight:800}}>{price>0?price.toFixed(2)+' €':'—'}</div>
        {det?.changePct!=null&&<div style={{color:det.changePct>=0?t.green:t.red,fontSize:14,fontFamily:"'JetBrains Mono'",fontWeight:700}}>{det.changePct>=0?'▲':'▼'} {Math.abs(det.changePct).toFixed(2)}%</div>}
      </div>
    </div>
    {ld&&<div style={{padding:16,color:t.accent,fontSize:13}}>Chargement des données Yahoo Finance...</div>}
    {det&&<div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:14}}>
        <div style={{background:t.card,borderRadius:12,border:'1px solid '+t.border,padding:18}}>
          <h3 style={{margin:'0 0 12px',fontSize:14,fontWeight:700,color:t.accent}}>Bilan financier</h3>
          {[['Prix actuel',price.toFixed(2)+' €',t.accent],det.per&&['PER',Number(det.per).toFixed(1),det.per<15?t.green:det.per<25?t.orange:t.red],det.eps&&['BPA (EPS)',det.eps+' €',t.accent],det.marketCap&&['Capitalisation',det.marketCap>1e9?(det.marketCap/1e9).toFixed(1)+' Md€':(det.marketCap/1e6).toFixed(0)+' M€',t.muted],det.beta&&['Bêta',Number(det.beta).toFixed(2),t.muted],det.high52&&['Plus haut 52s',det.high52+' €',t.green],det.low52&&['Plus bas 52s',det.low52+' €',t.red]].filter(Boolean).map(([l,v,c])=>kv(l,v,c))}
        </div>
        <div style={{background:t.card,borderRadius:12,border:'1px solid '+t.border,padding:18}}>
          <h3 style={{margin:'0 0 12px',fontSize:14,fontWeight:700,color:t.accent}}>Niveaux techniques</h3>
          {det.support&&kv('Support',det.support+' €',t.green)}
          {det.resistance&&kv('Résistance',det.resistance+' €',t.red)}
          {det.avg50&&kv('MM 50 jours',Number(det.avg50).toFixed(2)+' €',price>det.avg50?t.green:t.red)}
          {det.avg200&&kv('MM 200 jours',Number(det.avg200).toFixed(2)+' €',price>det.avg200?t.green:t.red)}
          {det.support&&det.resistance&&<div style={{marginTop:12}}>
            <div style={{fontSize:10,color:t.muted,marginBottom:5}}>Position dans le range</div>
            <div style={{height:8,background:t.border,borderRadius:4,position:'relative'}}>
              <div style={{position:'absolute',left:Math.min(100,Math.max(0,((price-det.support)/(det.resistance-det.support))*100))+'%',top:-3,width:14,height:14,background:t.accent,borderRadius:'50%',transform:'translateX(-50%)',border:'2px solid '+t.card}}/>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}><span style={{fontSize:9,color:t.green}}>{det.support}€</span><span style={{fontSize:9,color:t.red}}>{det.resistance}€</span></div>
          </div>}
          {det.nextEarnings&&<div style={{marginTop:10}}>{kv('Prochains résultats',det.nextEarnings,t.orange)}</div>}
        </div>
        <div style={{background:t.card,borderRadius:12,border:'1px solid '+t.border,padding:18}}>
          <h3 style={{margin:'0 0 12px',fontSize:14,fontWeight:700,color:t.accent}}>Dividendes & Consensus</h3>
          {det.dividend&&Number(det.dividend)>0?[['Dividende annuel',det.dividend+' €',t.accent],det.dividendYield&&['Rendement',det.dividendYield+'%',t.green],det.exDividendDate&&['Date ex-div',det.exDividendDate,t.text]].filter(Boolean).map(([l,v,c])=>kv(l,v,c)):<div style={{fontSize:12,color:t.muted,padding:'8px 0'}}>Pas de dividende</div>}
          {det.consensus&&<div style={{marginTop:12,paddingTop:12,borderTop:'1px solid '+t.border,textAlign:'center'}}>
            <div style={{fontSize:22,fontWeight:800,color:String(det.consensus).includes('Achat')?t.green:det.consensus==='Neutre'?t.orange:t.red}}>{det.consensus}</div>
            {det.targetPrice&&<div style={{fontSize:12,color:t.muted,marginTop:4}}>Objectif: <span style={{color:t.accent,fontWeight:700}}>{det.targetPrice} €</span> ({((det.targetPrice-price)/price*100).toFixed(1)}%)</div>}
          </div>}
        </div>
      </div>
      {signals.length>0&&<div style={{background:t.card,borderRadius:12,border:'1px solid '+t.border,padding:18}}>
        <h3 style={{margin:'0 0 14px',fontSize:14,fontWeight:700}}>Synthèse des signaux</h3>
        <div style={{display:'grid',gridTemplateColumns:'repeat('+Math.min(signals.length,5)+',1fr)',gap:10}}>
          {signals.map((s,i)=><div key={i} style={{background:t.card2,borderRadius:10,padding:14,textAlign:'center'}}>
            <div style={{fontSize:11,color:t.muted,marginBottom:4}}>{s.l}</div>
            <div style={{fontSize:16,fontWeight:800,fontFamily:"'JetBrains Mono'",color:s.c}}>{s.v}</div>
            <div style={{fontSize:10,color:s.c,fontWeight:600,marginTop:4}}>{s.verdict}</div>
          </div>)}
        </div>
      </div>}
    </div>}
    {!det&&!ld&&<div style={{background:t.card,borderRadius:12,border:'1px solid '+t.border,padding:40,textAlign:'center'}}><div style={{fontSize:13,color:t.muted}}>Impossible de charger les données</div><button onClick={()=>{setLd(true);fetchStockDetail(sym).then(d=>{if(d)setDet(d);setLd(false)})}} style={{marginTop:12,background:t.gradient,border:'none',color:'#fff',padding:'8px 18px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit'}}>Réessayer</button></div>}
  </div>)
}

// ═══════════════════════════════════════════════════════════════
// ANALYSE PAGE
// ═══════════════════════════════════════════════════════════════
function AnalysePage({t,openStock}){
  const [sym,setSym]=useState('');const [det,setDet]=useState(null);const [ld,setLd]=useState(false);const [results,setResults]=useState([]);const timeout=useRef(null)
  const search=async q=>{if(!q||q.length<2){setResults([]);return};try{const r=await fetch('/api/search?q='+encodeURIComponent(q));const d=await r.json();setResults(d.results||[])}catch{setResults([])}}
  const handleInput=v=>{setSym(v);if(timeout.current)clearTimeout(timeout.current);timeout.current=setTimeout(()=>search(v),400)}
  const analyze=async symbol=>{setLd(true);setSym(symbol);setResults([]);const d=await fetchStockDetail(symbol);if(d)setDet(d);setLd(false)}
  const kv=(l,v,c)=><div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid '+t.border+'30'}}><span style={{fontSize:12,color:t.muted}}>{l}</span><span style={{fontSize:12,fontFamily:"'JetBrains Mono'",fontWeight:700,color:c}}>{v}</span></div>

  return(<div>
    <h2 style={{margin:'0 0 6px',fontSize:20,fontWeight:800}}>Analyse d'actif</h2>
    <p style={{margin:'0 0 16px',fontSize:13,color:t.muted}}>Recherchez n'importe quel titre pour obtenir une analyse complète</p>
    <div style={{position:'relative',maxWidth:500,marginBottom:20}}>
      <input value={sym} onChange={e=>handleInput(e.target.value)} placeholder="Tapez un nom ou symbole (Schneider, AAPL, BTC...)" style={{width:'100%',padding:'12px 16px',background:t.card,border:'1px solid '+t.border,borderRadius:10,color:t.text,fontSize:14,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}/>
      {results.length>0&&<div style={{position:'absolute',top:'100%',left:0,right:0,background:t.card,border:'1px solid '+t.border,borderRadius:10,marginTop:4,maxHeight:250,overflowY:'auto',zIndex:10}}>
        {results.map(r=><div key={r.symbol} onClick={()=>analyze(r.symbol)} style={{padding:'10px 14px',cursor:'pointer',borderBottom:'1px solid '+t.border+'40',display:'flex',justifyContent:'space-between'}} onMouseEnter={e=>e.currentTarget.style.background=t.border+'40'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
          <div><div style={{fontWeight:600,fontSize:13}}>{r.name}</div><div style={{fontSize:10,color:t.muted}}>{r.symbol}</div></div>
          <span style={{fontSize:10,color:TC[r.type]||t.muted,fontWeight:600,alignSelf:'center'}}>{r.type}</span>
        </div>)}
      </div>}
    </div>
    {ld&&<div style={{padding:20,color:t.accent,fontSize:13}}>Analyse en cours...</div>}
    {det&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
      <div style={{background:t.card,borderRadius:12,border:'1px solid '+t.border,padding:20}}>
        <h3 style={{margin:'0 0 4px',fontSize:18,fontWeight:800}}>{det.name||sym}</h3>
        <div style={{fontFamily:"'JetBrains Mono'",fontSize:28,fontWeight:800,color:t.accent,margin:'8px 0'}}>{det.price?det.price.toFixed(2)+' €':'—'}</div>
        {det.changePct!=null&&<div style={{fontSize:14,fontWeight:700,color:det.changePct>=0?t.green:t.red,marginBottom:12}}>{det.changePct>=0?'▲':'▼'} {Math.abs(det.changePct).toFixed(2)}%</div>}
        <h4 style={{margin:'14px 0 8px',fontSize:13,fontWeight:700,color:t.accent}}>Fondamentaux</h4>
        {[det.per&&['PER',Number(det.per).toFixed(1),det.per<15?t.green:det.per<25?t.orange:t.red],det.eps&&['BPA',det.eps+' €',t.accent],det.marketCap&&['Capitalisation',det.marketCap>1e9?(det.marketCap/1e9).toFixed(1)+' Md€':(det.marketCap/1e6).toFixed(0)+' M€',t.muted],det.beta&&['Bêta',Number(det.beta).toFixed(2),t.muted],det.dividend&&Number(det.dividend)>0&&['Dividende',det.dividend+' € ('+det.dividendYield+'%)',t.green]].filter(Boolean).map(([l,v,c])=>kv(l,v,c))}
      </div>
      <div style={{background:t.card,borderRadius:12,border:'1px solid '+t.border,padding:20}}>
        <h4 style={{margin:'0 0 10px',fontSize:13,fontWeight:700,color:t.accent}}>Niveaux techniques</h4>
        {[det.support&&['Support',det.support+' €',t.green],det.resistance&&['Résistance',det.resistance+' €',t.red],det.avg50&&['MM50',Number(det.avg50).toFixed(2)+' €',det.price>det.avg50?t.green:t.red],det.avg200&&['MM200',Number(det.avg200).toFixed(2)+' €',det.price>det.avg200?t.green:t.red],det.high52&&['Plus haut 52s',det.high52+' €',t.green],det.low52&&['Plus bas 52s',det.low52+' €',t.red],det.volume&&['Volume',Number(det.volume).toLocaleString('fr-FR'),t.muted],det.avgVolume&&['Vol. moyen',Number(det.avgVolume).toLocaleString('fr-FR'),t.muted]].filter(Boolean).map(([l,v,c])=>kv(l,v,c))}
        {det.consensus&&<div style={{marginTop:14,paddingTop:14,borderTop:'1px solid '+t.border,textAlign:'center'}}>
          <div style={{fontSize:11,color:t.muted,marginBottom:4}}>Consensus analystes</div>
          <div style={{fontSize:24,fontWeight:800,color:String(det.consensus).includes('Achat')?t.green:det.consensus==='Neutre'?t.orange:t.red}}>{det.consensus}</div>
          {det.targetPrice&&<div style={{fontSize:12,color:t.muted,marginTop:4}}>Objectif {det.targetPrice} € ({((det.targetPrice-det.price)/det.price*100).toFixed(1)}%)</div>}
        </div>}
      </div>
    </div>}
  </div>)
}

// ═══════════════════════════════════════════════════════════════
// PROJECTIONS
// ═══════════════════════════════════════════════════════════════
function ProjPage({p,setP,tv,t}){
  const ei=tv>0?tv:p.initial
  const data=useMemo(()=>{const r=[];let inv=ei,val=ei;for(let y=0;y<=p.years;y++){r.push({y,inv:Math.round(inv),val:Math.round(val)});val=val*(1+p.rate/100)+p.monthly*12;inv+=p.monthly*12}return r},[p,ei])
  const fin=data[data.length-1]||{val:0,inv:0};const max=Math.max(...data.map(d=>d.val))
  return(<div>
    <h2 style={{margin:'0 0 6px',fontSize:20,fontWeight:800}}>Projection de patrimoine</h2>
    {tv>0&&<p style={{margin:'0 0 16px',fontSize:13,color:t.muted}}>Capital de départ: votre portfolio <span style={{color:t.accent,fontWeight:700,fontFamily:"'JetBrains Mono'"}}>{tv.toLocaleString('fr-FR',{maximumFractionDigits:0})} €</span></p>}
    <div style={{display:'grid',gridTemplateColumns:'1fr 260px',gap:12}}>
      <div style={{background:t.card,borderRadius:12,border:'1px solid '+t.border,padding:20}}>
        <svg viewBox="0 0 700 240" style={{width:'100%',height:240}}>
          <defs><linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={t.accent} stopOpacity="0.12"/><stop offset="100%" stopColor={t.accent} stopOpacity="0"/></linearGradient></defs>
          {[0,.25,.5,.75,1].map(pc=>{const y=220-pc*190;return<g key={pc}><line x1="50" y1={y} x2="660" y2={y} stroke={t.border}/><text x="45" y={y+4} fill={t.muted} fontSize="9" textAnchor="end" fontFamily="JetBrains Mono">{(max*pc/1000).toFixed(0)}k</text></g>})}
          <polygon points={"50,220 "+data.map(d=>(50+(d.y/p.years)*610)+","+(220-(d.val/max)*190)).join(" ")+" 660,220"} fill="url(#gv)"/>
          <polyline points={data.map(d=>(50+(d.y/p.years)*610)+","+(220-(d.val/max)*190)).join(" ")} fill="none" stroke={t.accent} strokeWidth="2.5"/>
          <polyline points={data.map(d=>(50+(d.y/p.years)*610)+","+(220-(d.inv/max)*190)).join(" ")} fill="none" stroke={t.accent2} strokeWidth="1.5" strokeDasharray="5,3"/>
        </svg>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:12}}>
          {[['Patrimoine',(fin.val/1000).toFixed(0)+'k €',t.accent],['Investi',(fin.inv/1000).toFixed(0)+'k €',t.accent2],['Gains',((fin.val-fin.inv)/1000).toFixed(0)+'k €',t.green]].map(([l,v,c])=>(
            <div key={l} style={{background:t.card2,borderRadius:8,padding:12,textAlign:'center'}}><div style={{fontSize:10,color:t.muted}}>{l}</div><div style={{fontSize:18,fontWeight:800,color:c,fontFamily:"'JetBrains Mono'"}}>{v}</div></div>
          ))}
        </div>
      </div>
      <div style={{background:t.card,borderRadius:12,border:'1px solid '+t.border,padding:16}}>
        <h3 style={{margin:'0 0 16px',fontSize:14,fontWeight:700}}>Paramètres</h3>
        {[{k:'monthly',l:'Mensualité',u:'€',min:0,max:5000,step:50},{k:'years',l:'Durée',u:'ans',min:1,max:40,step:1},{k:'rate',l:'Rendement',u:'%',min:1,max:20,step:0.5}].map(s=>(
          <div key={s.k} style={{marginBottom:16}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}><span style={{fontSize:12,color:t.muted}}>{s.l}</span><span style={{fontFamily:"'JetBrains Mono'",fontSize:13,fontWeight:700,color:t.accent}}>{p[s.k]} {s.u}</span></div>
            <input type="range" min={s.min} max={s.max} step={s.step} value={p[s.k]} onChange={e=>setP({...p,[s.k]:parseFloat(e.target.value)})} style={{width:'100%',accentColor:t.accent}}/>
          </div>
        ))}
        <div style={{background:t.card2,borderRadius:8,padding:10,marginTop:6}}>
          <div style={{fontSize:11,color:t.muted}}>Les gains composés = <span style={{color:t.green,fontWeight:700}}>{fin.val>0?((1-fin.inv/fin.val)*100).toFixed(0):0}%</span> du total</div>
        </div>
      </div>
    </div>
  </div>)
}

// ═══════════════════════════════════════════════════════════════
// EXPOSURE
// ═══════════════════════════════════════════════════════════════
function ExpoPage({positions,gp,t}){
  const build=key=>{const m={};positions.forEach(p=>{const s=ALL_SECURITIES.find(x=>x.symbol===p.symbol);const label=s?s[key]:'Autre';m[label]=(m[label]||0)+gp(p.symbol)*p.quantity});const tot=Object.values(m).reduce((a,b)=>a+b,0)||1;return Object.entries(m).map(([k,v])=>({name:k,val:v,pct:v/tot*100})).sort((a,b)=>b.pct-a.pct)}
  const buildType=()=>{const m={};positions.forEach(p=>{const s=ALL_SECURITIES.find(x=>x.symbol===p.symbol);let type=s?s.type:'Autre';const sym=p.symbol.toUpperCase();if(sym.includes('-USD')||sym.includes('-EUR')||sym.includes('BTC')||sym.includes('ETH'))type='Crypto';else if(sym.includes('GC=F')||sym.includes('SI=F'))type='Matière première';m[type]=(m[type]||0)+gp(p.symbol)*p.quantity});const tot=Object.values(m).reduce((a,b)=>a+b,0)||1;return Object.entries(m).map(([k,v])=>({name:k,val:v,pct:v/tot*100})).sort((a,b)=>b.pct-a.pct)}
  const sD=useMemo(()=>build('sector'),[positions,gp]);const rD=useMemo(()=>build('region'),[positions,gp]);const tD=useMemo(()=>buildType(),[positions,gp])
  if(!positions.length) return <div><h2 style={{margin:'0 0 14px',fontSize:20,fontWeight:800}}>Exposition</h2><div style={{background:t.card,borderRadius:12,border:'1px solid '+t.border,padding:36,textAlign:'center',color:t.muted}}>Ajoutez des positions.</div></div>
  const Bars=({data,colors})=>data.map((d,i)=><div key={i} style={{marginBottom:8}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}><div style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:10,height:10,borderRadius:3,background:colors[d.name]||t.muted}}/><span style={{fontSize:12}}>{d.name}</span></div><span style={{fontSize:12,fontFamily:"'JetBrains Mono'",fontWeight:700,color:colors[d.name]||t.muted}}>{d.pct.toFixed(1)}%</span></div><div style={{height:6,background:t.border,borderRadius:3}}><div style={{height:6,background:colors[d.name]||t.muted,borderRadius:3,width:d.pct+'%'}}/></div></div>)
  return(<div>
    <h2 style={{margin:'0 0 16px',fontSize:20,fontWeight:800}}>Exposition du portfolio</h2>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
      {[['Par secteur',sD,SC],['Par région',rD,RC],["Par type d'actif",tD,TC]].map(([title,data,colors])=>(
        <div key={title} style={{background:t.card,borderRadius:12,border:'1px solid '+t.border,padding:18}}>
          <h3 style={{margin:'0 0 14px',fontSize:14,fontWeight:700}}>{title}</h3><Bars data={data} colors={colors}/>
        </div>
      ))}
    </div>
  </div>)
}

// ═══════════════════════════════════════════════════════════════
// DCA PROGRAM
// ═══════════════════════════════════════════════════════════════
function DCAPage({dca,setDca,t}){
  const months=['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc']
  const totalMonthly=dca.items.reduce((s,it)=>s+it.monthly,0)
  const totalYear=totalMonthly*12
  const toggleDone=(itemIdx,monthIdx)=>{const next={...dca,items:dca.items.map((it,i)=>{if(i!==itemIdx)return it;const done=[...it.done];done[monthIdx]=!done[monthIdx];return{...it,done}})};setDca(next)}
  const updateItem=(idx,field,val)=>{const next={...dca,items:dca.items.map((it,i)=>i===idx?{...it,[field]:val}:it)};setDca(next)}
  const addItem=()=>{setDca({...dca,items:[...dca.items,{name:'Nouvel actif',symbol:'',monthly:50,done:Array(12).fill(false)}]})}
  const removeItem=idx=>{setDca({...dca,items:dca.items.filter((_,i)=>i!==idx)})}

  return(<div>
    <h2 style={{margin:'0 0 6px',fontSize:20,fontWeight:800}}>Programme DCA — 1 an</h2>
    <p style={{margin:'0 0 16px',fontSize:13,color:t.muted}}>Budget mensuel: <span style={{color:t.accent,fontWeight:700,fontFamily:"'JetBrains Mono'"}}>{totalMonthly} €/mois</span> — Budget annuel: <span style={{color:t.green,fontWeight:700,fontFamily:"'JetBrains Mono'"}}>{totalYear} €/an</span></p>

    <div style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:14}}>
      {/* Config */}
      <div style={{background:t.card,borderRadius:12,border:'1px solid '+t.border,padding:18}}>
        <h3 style={{margin:'0 0 14px',fontSize:14,fontWeight:700}}>Actifs DCA</h3>
        {dca.items.map((item,i)=>(
          <div key={i} style={{background:t.card2,borderRadius:10,padding:12,marginBottom:8}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
              <input value={item.name} onChange={e=>updateItem(i,'name',e.target.value)} style={{background:'transparent',border:'none',color:t.text,fontWeight:600,fontSize:13,fontFamily:'inherit',outline:'none',flex:1}}/>
              <button onClick={()=>removeItem(i)} style={{background:t.red+'15',border:'none',color:t.red,width:22,height:22,borderRadius:5,cursor:'pointer',fontSize:11}}>✕</button>
            </div>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <input value={item.symbol} onChange={e=>updateItem(i,'symbol',e.target.value)} placeholder="Symbole" style={{background:t.bg,border:'1px solid '+t.border,color:t.muted,padding:'5px 8px',borderRadius:6,fontSize:10,fontFamily:"'JetBrains Mono'",width:100,outline:'none'}}/>
              <input type="number" value={item.monthly} onChange={e=>updateItem(i,'monthly',Number(e.target.value))} style={{background:t.bg,border:'1px solid '+t.border,color:t.accent,padding:'5px 8px',borderRadius:6,fontSize:12,fontFamily:"'JetBrains Mono'",width:70,outline:'none',textAlign:'right'}}/>
              <span style={{fontSize:11,color:t.muted}}>€/mois</span>
            </div>
            <div style={{marginTop:6,fontSize:10,color:t.muted}}>{item.done.filter(Boolean).length}/12 mois validés</div>
          </div>
        ))}
        <button onClick={addItem} style={{width:'100%',padding:10,background:t.gradient,border:'none',borderRadius:8,color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit',marginTop:4}}>+ Ajouter un actif</button>
      </div>

      {/* Checklist grid */}
      <div style={{background:t.card,borderRadius:12,border:'1px solid '+t.border,padding:18,overflowX:'auto'}}>
        <h3 style={{margin:'0 0 14px',fontSize:14,fontWeight:700}}>Suivi des virements</h3>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr>
            <th style={{padding:'8px 12px',textAlign:'left',fontSize:11,color:t.muted,fontWeight:600}}>Actif</th>
            {months.map(m=><th key={m} style={{padding:'8px 6px',textAlign:'center',fontSize:10,color:t.muted,fontWeight:600}}>{m}</th>)}
            <th style={{padding:'8px 10px',textAlign:'center',fontSize:10,color:t.muted,fontWeight:600}}>Total</th>
          </tr></thead>
          <tbody>
            {dca.items.map((item,i)=>{const doneCount=item.done.filter(Boolean).length;return(
              <tr key={i} style={{borderBottom:'1px solid '+t.border}}>
                <td style={{padding:'10px 12px'}}><div style={{fontWeight:600,fontSize:12}}>{item.name}</div><div style={{fontSize:10,color:t.muted,fontFamily:"'JetBrains Mono'"}}>{item.monthly}€/mois</div></td>
                {months.map((_,mi)=>(
                  <td key={mi} style={{padding:'6px',textAlign:'center'}}>
                    <button onClick={()=>toggleDone(i,mi)} style={{width:28,height:28,borderRadius:7,border:'2px solid '+(item.done[mi]?t.green:t.border),background:item.done[mi]?t.green+'20':'transparent',cursor:'pointer',fontSize:13,color:item.done[mi]?t.green:t.border,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>{item.done[mi]?'✓':''}</button>
                  </td>
                ))}
                <td style={{padding:'10px',textAlign:'center'}}>
                  <div style={{fontFamily:"'JetBrains Mono'",fontSize:13,fontWeight:700,color:t.accent}}>{doneCount*item.monthly} €</div>
                  <div style={{fontSize:9,color:t.muted}}>{doneCount}/12</div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
        <div style={{marginTop:14,padding:14,background:t.card2,borderRadius:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div><div style={{fontSize:12,color:t.muted}}>Total investi cette année</div><div style={{fontSize:22,fontWeight:800,fontFamily:"'JetBrains Mono'",color:t.green}}>{dca.items.reduce((s,it)=>s+it.done.filter(Boolean).length*it.monthly,0)} €</div></div>
          <div style={{textAlign:'right'}}><div style={{fontSize:12,color:t.muted}}>Progression</div><div style={{fontSize:22,fontWeight:800,fontFamily:"'JetBrains Mono'",color:t.accent}}>{dca.items.length>0?Math.round(dca.items.reduce((s,it)=>s+it.done.filter(Boolean).length,0)/(dca.items.length*12)*100):0}%</div></div>
        </div>
      </div>
    </div>
  </div>)
}

// ═══════════════════════════════════════════════════════════════
// BUDGET
// ═══════════════════════════════════════════════════════════════
function BudgetPage({b,setB,t}){
  const totalIncome=b.salaryNet+b.partnerNet;const rentAfterApl=Math.max(0,b.rent-b.apl)
  const myRent=b.partnerNet>0?Math.round(rentAfterApl*(b.salaryNet/totalIncome)):rentAfterApl
  const partRent=b.partnerNet>0?Math.round(rentAfterApl*(b.partnerNet/totalIncome)):0
  const myAfter=b.salaryNet-myRent;const needs=Math.round(myAfter*0.50);const wants=Math.round(myAfter*0.25);const invest=Math.round(myAfter*0.25)
  const curve=[];for(let ps=0;ps<=2500;ps+=100){const tot=b.salaryNet+ps;curve.push({ps,my:ps>0?Math.round(rentAfterApl*(b.salaryNet/tot)):rentAfterApl,part:ps>0?Math.round(rentAfterApl*(ps/tot)):0})}
  const maxR=Math.max(...curve.map(d=>d.my),rentAfterApl)
  const inp={background:t.card2,border:'1px solid '+t.border,color:t.text,width:'100%',padding:'10px 12px',borderRadius:8,fontSize:14,fontFamily:"'JetBrains Mono'",outline:'none',boxSizing:'border-box',textAlign:'right'}

  return(<div>
    <h2 style={{margin:'0 0 6px',fontSize:20,fontWeight:800}}>Budget — 50/25/25</h2>
    <p style={{margin:'0 0 16px',fontSize:13,color:t.muted}}>50% besoins • 25% plaisirs • 25% investissement</p>
    <div style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:14}}>
      <div style={{background:t.card,borderRadius:12,border:'1px solid '+t.border,padding:18}}>
        <h3 style={{margin:'0 0 14px',fontSize:14,fontWeight:700,color:t.accent}}>Revenus</h3>
        {[['Salaire brut','salaryGross'],['Salaire net (après impôt)','salaryNet'],['Salaire net copine','partnerNet']].map(([l,k])=>(
          <div key={k} style={{marginBottom:12}}><label style={{display:'block',fontSize:12,color:t.muted,marginBottom:4}}>{l}</label><input type="number" value={b[k]} onChange={e=>setB({...b,[k]:Number(e.target.value)})} style={inp}/></div>
        ))}
        <div style={{borderTop:'1px solid '+t.border,paddingTop:14,marginTop:6}}>
          <h3 style={{margin:'0 0 14px',fontSize:14,fontWeight:700,color:t.accent}}>Logement</h3>
          {[['Loyer','rent'],['APL','apl']].map(([l,k])=>(
            <div key={k} style={{marginBottom:12}}><label style={{display:'block',fontSize:12,color:t.muted,marginBottom:4}}>{l}</label><input type="number" value={b[k]} onChange={e=>setB({...b,[k]:Number(e.target.value)})} style={inp}/></div>
          ))}
        </div>
      </div>
      <div>
        <div style={{background:t.card,borderRadius:12,border:'1px solid '+t.border,padding:18,marginBottom:14}}>
          <h3 style={{margin:'0 0 14px',fontSize:14,fontWeight:700}}>Répartition du loyer</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:14}}>
            {[['Loyer net',rentAfterApl+' €',t.orange],['Votre part',myRent+' €',t.accent],['Sa part',partRent+' €',t.accent2]].map(([l,v,c])=>(
              <div key={l} style={{background:t.card2,borderRadius:10,padding:14,textAlign:'center'}}><div style={{fontSize:11,color:t.muted,marginBottom:4}}>{l}</div><div style={{fontSize:22,fontWeight:800,color:c,fontFamily:"'JetBrains Mono'"}}>{v}</div></div>
            ))}
          </div>
          <svg viewBox="0 0 700 180" style={{width:'100%',height:160}}>
            {[0,.25,.5,.75,1].map(p=>{const y=160-p*140;return<g key={p}><line x1="50" y1={y} x2="670" y2={y} stroke={t.border}/><text x="45" y={y+4} fill={t.muted} fontSize="8" textAnchor="end" fontFamily="JetBrains Mono">{Math.round(maxR*p)}€</text></g>})}
            <polyline points={curve.map(d=>(50+(d.ps/2500)*620)+','+(160-(d.my/maxR)*140)).join(' ')} fill="none" stroke={t.accent} strokeWidth="2.5"/>
            <polyline points={curve.map(d=>(50+(d.ps/2500)*620)+','+(160-(d.part/maxR)*140)).join(' ')} fill="none" stroke={t.accent2} strokeWidth="2.5"/>
            {b.partnerNet>0&&<line x1={50+(b.partnerNet/2500)*620} y1="20" x2={50+(b.partnerNet/2500)*620} y2="160" stroke={t.orange} strokeWidth="1" strokeDasharray="4,3"/>}
          </svg>
          <div style={{display:'flex',gap:16,justifyContent:'center'}}><span style={{fontSize:10,color:t.accent}}>━━ Vous</span><span style={{fontSize:10,color:t.accent2}}>━━ Copine</span></div>
        </div>
        <div style={{background:t.card,borderRadius:12,border:'1px solid '+t.border,padding:18}}>
          <h3 style={{margin:'0 0 10px',fontSize:14,fontWeight:700}}>Répartition 50/25/25</h3>
          <div style={{fontSize:12,color:t.muted,marginBottom:14}}>{b.salaryNet}€ - {myRent}€ loyer = <span style={{color:t.accent,fontWeight:700}}>{myAfter}€</span> à répartir</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:14}}>
            {[['Besoins (50%)',needs+' €',t.red,'Courses, transport, abonnements'],['Plaisirs (25%)',wants+' €',t.orange,'Sorties, shopping, loisirs'],['Investissement (25%)',invest+' €',t.green,'PEA, crypto, épargne']].map(([l,v,c,d])=>(
              <div key={l} style={{background:t.card2,borderRadius:10,padding:16,position:'relative',overflow:'hidden'}}>
                <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:c}}/>
                <div style={{fontSize:12,color:t.muted,marginBottom:6}}>{l}</div>
                <div style={{fontSize:24,fontWeight:800,color:c,fontFamily:"'JetBrains Mono'",marginBottom:4}}>{v}</div>
                <div style={{fontSize:10,color:t.muted}}>{d}</div>
              </div>
            ))}
          </div>
          <div style={{display:'flex',borderRadius:8,overflow:'hidden',height:30}}>
            <div style={{width:(myRent/b.salaryNet*100)+'%',background:t.accent2,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'#fff',fontWeight:700}}>Loyer</div>
            <div style={{width:(needs/b.salaryNet*100)+'%',background:t.red,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'#fff',fontWeight:700}}>Besoins</div>
            <div style={{width:(wants/b.salaryNet*100)+'%',background:t.orange,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'#fff',fontWeight:700}}>Plaisirs</div>
            <div style={{width:(invest/b.salaryNet*100)+'%',background:t.green,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'#fff',fontWeight:700}}>Invest</div>
          </div>
          <div style={{marginTop:14,padding:12,background:t.card2,borderRadius:8}}>
            <div style={{fontSize:14,fontWeight:700,marginBottom:6}}>Ce que votre copine vous doit</div>
            <div style={{fontSize:28,fontWeight:800,color:t.accent2,fontFamily:"'JetBrains Mono'"}}>{partRent} €<span style={{fontSize:13,color:t.muted,fontWeight:400}}> / mois</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>)
}

// ═══════════════════════════════════════════════════════════════
// ADD MODAL
// ═══════════════════════════════════════════════════════════════
function AddModal({onClose,onAdd,t}){
  const [search,setSearch]=useState('');const [sel,setSel]=useState(null);const [qty,setQty]=useState('');const [pru,setPru]=useState('');const [yahoo,setYahoo]=useState([]);const [searching,setSearching]=useState(false);const [mode,setMode]=useState('local');const timeout=useRef(null)
  const local=useMemo(()=>{if(!search)return ALL_SECURITIES.slice(0,20);const q=search.toLowerCase();return ALL_SECURITIES.filter(s=>s.name.toLowerCase().includes(q)||s.symbol.toLowerCase().includes(q)).slice(0,20)},[search])
  const searchYahoo=useCallback(async q=>{if(!q||q.length<2){setYahoo([]);return};setSearching(true);try{const r=await fetch('/api/search?q='+encodeURIComponent(q));const d=await r.json();setYahoo(d.results||[])}catch{setYahoo([])}finally{setSearching(false)}},[])
  const handleSearch=v=>{setSearch(v);if(mode==='yahoo'){if(timeout.current)clearTimeout(timeout.current);timeout.current=setTimeout(()=>searchYahoo(v),400)}}
  const results=mode==='local'?local:yahoo
  const inp={background:t.card2,border:'1px solid '+t.border,color:t.text,width:'100%',padding:'10px 12px',borderRadius:8,fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}} onClick={onClose}>
      <div style={{width:460,background:t.card,borderRadius:14,border:'1px solid '+t.border,overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'14px 18px',borderBottom:'1px solid '+t.border,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3 style={{margin:0,fontSize:15,fontWeight:700}}>Ajouter une position</h3>
          <button onClick={onClose} style={{background:'none',border:'none',color:t.muted,cursor:'pointer',fontSize:18}}>✕</button>
        </div>
        <div style={{padding:16}}>
          {!sel?(<div>
            <div style={{display:'flex',gap:3,background:t.card2,borderRadius:8,padding:3,marginBottom:10}}>
              <button onClick={()=>{setMode('local');setYahoo([])}} style={{flex:1,padding:8,border:'none',borderRadius:6,cursor:'pointer',fontWeight:600,fontSize:11,fontFamily:'inherit',background:mode==='local'?t.border:'transparent',color:mode==='local'?t.accent:t.muted}}>PEA ({ALL_SECURITIES.length})</button>
              <button onClick={()=>setMode('yahoo')} style={{flex:1,padding:8,border:'none',borderRadius:6,cursor:'pointer',fontWeight:600,fontSize:11,fontFamily:'inherit',background:mode==='yahoo'?t.border:'transparent',color:mode==='yahoo'?t.orange:t.muted}}>Yahoo Finance</button>
            </div>
            <input value={search} onChange={e=>handleSearch(e.target.value)} placeholder={mode==='local'?"LVMH, CW8, Schneider...":"iShares, Bitcoin, Tesla..."} autoFocus style={{...inp,marginBottom:8}}/>
            {searching&&<div style={{padding:8,color:t.accent,fontSize:11,textAlign:'center'}}>Recherche...</div>}
            <div style={{maxHeight:280,overflowY:'auto'}}>
              {results.map(s=><div key={s.symbol} onClick={()=>setSel(s)} style={{padding:'9px 10px',cursor:'pointer',borderRadius:7,display:'flex',justifyContent:'space-between',alignItems:'center'}} onMouseEnter={e=>e.currentTarget.style.background=t.border+'40'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div><div style={{fontWeight:600,fontSize:12}}>{s.name}</div><div style={{fontSize:10,color:t.muted}}>{s.symbol}</div></div>
                <span style={{fontSize:9,padding:'2px 6px',borderRadius:4,background:(TC[s.type]||t.muted)+'18',color:TC[s.type]||t.muted,fontWeight:600}}>{s.type||'Action'}</span>
              </div>)}
              {mode==='local'&&!results.length&&search&&<div style={{padding:14,textAlign:'center'}}><div style={{fontSize:11,color:t.muted,marginBottom:6}}>Pas trouvé dans la base PEA</div><button onClick={()=>{setMode('yahoo');searchYahoo(search)}} style={{background:t.orange+'20',border:'1px solid '+t.orange+'40',color:t.orange,padding:'6px 14px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:600,fontFamily:'inherit'}}>Chercher sur Yahoo Finance</button></div>}
            </div>
          </div>):(<div>
            <div style={{padding:10,background:t.card2,borderRadius:8,marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div><div style={{fontWeight:700,fontSize:13}}>{sel.name}</div><div style={{fontSize:10,color:t.muted}}>{sel.symbol} • {sel.type||'Action'}</div></div>
              <button onClick={()=>setSel(null)} style={{background:t.border,border:'none',color:t.muted,padding:'4px 10px',borderRadius:6,cursor:'pointer',fontSize:10,fontFamily:'inherit'}}>Changer</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
              <div><label style={{display:'block',fontSize:12,color:t.muted,marginBottom:4}}>Quantité</label><input value={qty} onChange={e=>setQty(e.target.value)} type="number" style={inp}/></div>
              <div><label style={{display:'block',fontSize:12,color:t.muted,marginBottom:4}}>Prix d'achat €</label><input value={pru} onChange={e=>setPru(e.target.value)} type="number" step="0.01" style={inp}/></div>
            </div>
            <button onClick={()=>{if(qty&&pru)onAdd({symbol:sel.symbol,name:sel.name,qty:parseFloat(qty),pru:parseFloat(pru)})}} disabled={!qty||!pru} style={{width:'100%',padding:12,background:qty&&pru?t.gradient:t.border,border:'none',borderRadius:9,color:qty&&pru?'#fff':t.muted,fontWeight:700,fontSize:13,cursor:qty&&pru?'pointer':'default',fontFamily:'inherit'}}>Ajouter au portfolio</button>
          </div>)}
        </div>
      </div>
    </div>
  )
}
