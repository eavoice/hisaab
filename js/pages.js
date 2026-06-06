// ============================================================
// PAGES.JS — View rendering
// ============================================================
const Pages = {

  async dashboard() {
    let recv=0, pay=0, salesTotal=0, purchTotal=0;
    const curMonth = today().substring(0,7);
    const [custs,facts,sales,purch] = await Promise.all([DB.getAll('customers'),DB.getAll('factories'),DB.getAll('sales'),DB.getAll('purchases')]);
    for(const c of custs){ const b=await DB.customerBalance(c.id); if(b>0) recv+=b; }
    for(const f of facts){ const b=await DB.factoryBalance(f.id); if(b>0) pay+=b; }
    salesTotal = sales.filter(s=>s.date?.startsWith(curMonth)).reduce((a,b)=>a+(b.total||0),0);
    purchTotal = purch.filter(p=>p.date?.startsWith(curMonth)).reduce((a,b)=>a+(b.total||0),0);

    const generateSparkline = (dataArray, colorStr) => {
      const max = Math.max(...dataArray, 1);
      return `<div style="display:flex;align-items:flex-end;gap:4px;height:32px;opacity:0.4;position:absolute;bottom:16px;right:16px;width:60px">
        ${dataArray.map(val => `<div style="flex:1;background:${colorStr};height:${Math.max((val/max)*100, 10)}%;border-radius:2px;transition:height 0.3s"></div>`).join('')}
      </div>`;
    };
    const last7 = [...Array(7)].map((_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); });
    const sTrend = last7.map(dt => sales.filter(s=>s.date===dt).reduce((a,b)=>a+(b.total||0),0));
    const pTrend = last7.map(dt => purch.filter(p=>p.date===dt).reduce((a,b)=>a+(b.total||0),0));

    const lastBackupTs = Number(localStorage.getItem('lastBackupTimestamp')||0);
    const lastChangeTs = Number(localStorage.getItem('lastChangeTimestamp')||0);
    let bannerHtml = '';
    const hasAnyData = lastChangeTs > 0 || custs.length > 0 || facts.length > 0;
    if (lastBackupTs > 0) {
      const dateStr = new Date(lastBackupTs).toLocaleString('en-IN', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:true});
      if (lastChangeTs > lastBackupTs) {
        bannerHtml = `<div style="background:var(--danger-dim);color:var(--danger);padding:10px 14px;border-radius:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;font-size:13px">
          <div><div style="font-weight:600">Unsaved Changes</div><div style="opacity:0.8;margin-top:2px">Last backup: ${dateStr}</div></div>
          <button class="btn btn-primary btn-sm" onclick="App.exportData()">Backup</button>
        </div>`;
      } else {
        bannerHtml = `<div style="background:var(--success-dim);color:var(--success);padding:10px 14px;border-radius:12px;margin-bottom:16px;font-size:13px">
          <div style="font-weight:600">All data backed up</div><div style="opacity:0.8;margin-top:2px">Last backup: ${dateStr}</div>
        </div>`;
      }
    } else if (hasAnyData) {
      bannerHtml = `<div style="background:var(--danger-dim);color:var(--danger);padding:10px 14px;border-radius:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;font-size:13px">
          <div><div style="font-weight:600">No Backup Found</div><div style="opacity:0.8;margin-top:2px">Secure your data now</div></div>
          <button class="btn btn-primary btn-sm" onclick="App.exportData()">Backup</button>
        </div>`;
    }

    return `<div class="page-section">
      ${bannerHtml}
      <h2 class="section-title">Quick Actions</h2>
      <div class="quick-actions" style="padding:0;margin-bottom:24px">
        <div class="quick-action" onclick="App.newSale()"><div class="qa-icon" style="background:var(--primary-dim);color:var(--primary-light)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        </div><div><div class="qa-label">New Bill</div><div class="qa-sub">Customer Sale</div></div></div>
        
        <div class="quick-action" onclick="App.customerPayment()"><div class="qa-icon" style="background:var(--success-dim);color:var(--success)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
        </div><div><div class="qa-label">Receive Pay</div><div class="qa-sub">From Customer</div></div></div>
        
        <div class="quick-action" onclick="App.newPurchase()"><div class="qa-icon" style="background:var(--sky-dim);color:var(--sky)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/></svg>
        </div><div><div class="qa-label">New Purchase</div><div class="qa-sub">From Factory</div></div></div>
        
        <div class="quick-action" onclick="App.factoryPayment()"><div class="qa-icon" style="background:var(--danger-dim);color:var(--danger)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
        </div><div><div class="qa-label">Pay Factory</div><div class="qa-sub">Record outflow</div></div></div>
      </div>
      <h2 class="section-title">Overview</h2>
      <div class="stats-grid" style="padding:0;margin-bottom:24px">
        <div class="stat-card receivable"><div class="stat-label">To Receive</div><div class="stat-value green">${fmt(recv)}</div><div class="stat-sub">From customers</div>
          <svg style="position:absolute;top:16px;right:16px;opacity:0.2" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
        <div class="stat-card payable"><div class="stat-label">To Pay</div><div class="stat-value red">${fmt(pay)}</div><div class="stat-sub">To factories</div>
          <svg style="position:absolute;top:16px;right:16px;opacity:0.2" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div>
        <div class="stat-card sales-total"><div class="stat-label">Sales (${curMonth})</div><div class="stat-value indigo">${fmt(salesTotal)}</div>${generateSparkline(sTrend, 'var(--primary)')}</div>
        <div class="stat-card purchase-total"><div class="stat-label">Purchases (${curMonth})</div><div class="stat-value blue">${fmt(purchTotal)}</div>${generateSparkline(pTrend, 'var(--sky)')}</div>
      </div>
    </div>`;
  },

  async sales() {
    const customers = await DB.getAll('customers');
    const custOpts  = customers.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
    return `
      <div class="filter-bar">
        <div class="filter-row">
          <select id="sf-cust" class="select-input" style="flex:1" onchange="App.applySalesFilter()">
            <option value="">All Customers</option>${custOpts}
          </select>
          <select id="sf-sort" class="select-input" style="flex:1" onchange="App.applySalesFilter()">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="highest">Highest Amount</option>
            <option value="lowest">Lowest Amount</option>
          </select>
        </div>
        <div class="filter-row">
          <input type="date" id="sf-from" class="form-input" style="flex:1" onchange="App.applySalesFilter()">
          <input type="date" id="sf-to"   class="form-input" style="flex:1" onchange="App.applySalesFilter()">
        </div>
      </div>
      <div id="sales-list" class="list-container" style="padding-top:12px"><div class="skeleton-list"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div></div>`;
  },

  async renderSalesList(filter) {
    let list = await DB.getAll('sales');
    if (filter.customerId) list = list.filter(s=>String(s.customerId)===String(filter.customerId));
    if (filter.from) list = list.filter(s=>s.date>=filter.from);
    if (filter.to)   list = list.filter(s=>s.date<=filter.to);
    const sorts = { newest:(a,b)=>b.createdAt-a.createdAt, oldest:(a,b)=>a.createdAt-b.createdAt, highest:(a,b)=>(b.total||0)-(a.total||0), lowest:(a,b)=>(a.total||0)-(b.total||0) };
    list.sort(sorts[filter.sort]||sorts.newest);
    if (!list.length) return `<div class="empty-state"><div class="empty-icon">🧾</div><div class="empty-title">No bills found</div><div class="empty-text">Tap + New Bill to create one.</div></div>`;
    let html='';
    for(const s of list){
      const c = await DB.getById('customers',s.customerId);
      const cnt = Array.isArray(s.items)?s.items.length:1;
      html += `<div class="list-item" onclick="App.viewSale(${s.id})">
        <div class="item-icon sale">🧾</div>
        <div class="item-body"><div class="item-title">${esc(c?.name||'Unknown')}</div><div class="item-subtitle">${s.billNumber} · ${cnt} product${cnt>1?'s':''}</div></div>
        <div class="item-right"><div class="item-amount">${fmt(s.total)}</div><div class="item-date">${fmtDate(s.date)}</div></div>
      </div>`;
    }
    return html;
  },

  async purchases() {
    const factories = await DB.getAll('factories');
    const factOpts  = factories.map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join('');
    return `
      <div class="filter-bar">
        <div class="filter-row">
          <select id="pf-fact" class="select-input" style="flex:1" onchange="App.applyPurchaseFilter()">
            <option value="">All Factories</option>${factOpts}
          </select>
          <select id="pf-sort" class="select-input" style="flex:1" onchange="App.applyPurchaseFilter()">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="highest">Highest Amount</option>
            <option value="lowest">Lowest Amount</option>
          </select>
        </div>
        <div class="filter-row">
          <input type="date" id="pf-from" class="form-input" style="flex:1" onchange="App.applyPurchaseFilter()">
          <input type="date" id="pf-to"   class="form-input" style="flex:1" onchange="App.applyPurchaseFilter()">
        </div>
      </div>
      <div id="purchase-list" class="list-container" style="padding-top:12px"><div class="skeleton-list"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div></div>`;
  },

  async renderPurchaseList(filter) {
    let list = await DB.getAll('purchases');
    if (filter.factoryId) list = list.filter(p=>String(p.factoryId)===String(filter.factoryId));
    if (filter.from) list = list.filter(p=>p.date>=filter.from);
    if (filter.to)   list = list.filter(p=>p.date<=filter.to);
    const sorts = { newest:(a,b)=>(b.createdAt||0)-(a.createdAt||0), oldest:(a,b)=>(a.createdAt||0)-(b.createdAt||0), highest:(a,b)=>(b.total||0)-(a.total||0), lowest:(a,b)=>(a.total||0)-(b.total||0) };
    list.sort(sorts[filter.sort]||sorts.newest);
    if (!list.length) return `<div class="empty-state"><div class="empty-icon">🏭</div><div class="empty-title">No purchases found</div><div class="empty-text">Tap + New Purchase to record one.</div></div>`;
    let html='';
    for(const p of list){
      const f = await DB.getById('factories',p.factoryId);
      const cnt = Array.isArray(p.items)?p.items.length:1;
      html += `<div class="list-item" onclick="App.viewPurchase(${p.id})">
        <div class="item-icon purchase">🏭</div>
        <div class="item-body"><div class="item-title">${esc(f?.name||'Unknown')}</div><div class="item-subtitle">${cnt} product${cnt>1?'s':''}</div></div>
        <div class="item-right"><div class="item-amount">${fmt(p.total)}</div><div class="item-date">${fmtDate(p.date)}</div></div>
      </div>`;
    }
    return html;
  },

  async reports() {
    return `<div class="page-section">
      <div class="seg-tabs" id="report-tabs" style="overflow-x:auto;flex-wrap:nowrap">
        <div class="seg-tab active" onclick="App.switchReportTab('summary')">Summary</div>
        <div class="seg-tab" onclick="App.switchReportTab('customers')">Customers</div>
        <div class="seg-tab" onclick="App.switchReportTab('factories')">Factories</div>
        <div class="seg-tab" onclick="App.switchReportTab('products')">By Product</div>
        <div class="seg-tab" onclick="App.switchReportTab('txns')">Transactions</div>
      </div>
      <div id="report-content"><div class="skeleton-list"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div></div></div>`;
  },

  async reportSummary() {
    const [sales,purch,salePay,purchPay] = await Promise.all([DB.getAll('sales'),DB.getAll('purchases'),DB.getAll('salePayments'),DB.getAll('purchasePayments')]);
    const tS=sales.reduce((s,r)=>s+(r.total||0),0), tP=purch.reduce((s,r)=>s+(r.total||0),0);
    const tR=salePay.reduce((s,r)=>s+(r.amount||0),0), tPd=purchPay.reduce((s,r)=>s+(r.amount||0),0);
    const gp=tS-tP, nr=tS-tR, np=tP-tPd;
    const now=new Date(); const mm={};
    for(let i=5;i>=0;i--){ const d=new Date(now.getFullYear(),now.getMonth()-i,1); const mStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; mm[mStr]={s:0,p:0}; }
    sales.forEach(s=>{const k=s.date?.substring(0,7); if(mm[k]) mm[k].s+=(s.total||0);});
    purch.forEach(p=>{const k=p.date?.substring(0,7); if(mm[k]) mm[k].p+=(p.total||0);});
    const maxV=Math.max(...Object.values(mm).map(v=>Math.max(v.s,v.p)),1);
    const bars=Object.entries(mm).map(([m,v])=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
      <div style="width:100%;display:flex;gap:3px;align-items:flex-end;height:60px">
        <div style="flex:1;background:var(--primary);border-radius:3px 3px 0 0;height:${Math.round(v.s/maxV*60)}px;min-height:2px"></div>
        <div style="flex:1;background:var(--sky);border-radius:3px 3px 0 0;height:${Math.round(v.p/maxV*60)}px;min-height:2px"></div>
      </div><div style="font-size:10px;color:var(--text-3)">${m.substring(5)}</div></div>`).join('');
    return `
      <div class="report-summary">
        <div class="report-row"><span>Total Sales</span><span class="amount-positive">${fmt(tS)}</span></div>
        <div class="report-row"><span>Total Purchases</span><span class="amount-negative">${fmt(tP)}</span></div>
        <div class="report-row total"><span>Gross Profit</span><span class="${gp>=0?'amount-positive':'amount-negative'}">${fmt(gp)}</span></div>
      </div>
      <div class="report-summary">
        <div class="report-row"><span>Total Received</span><span class="amount-positive">${fmt(tR)}</span></div>
        <div class="report-row"><span>Outstanding (Customers)</span><span class="amount-negative">${fmt(nr)}</span></div>
        <div class="report-row"><span>Due to Factories</span><span class="amount-negative">${fmt(np)}</span></div>
      </div>
      <div class="report-summary">
        <div style="font-size:12px;color:var(--text-3);margin-bottom:12px;font-weight:600">SALES vs PURCHASES — Last 6 Months</div>
        <div style="display:flex;gap:6px;align-items:flex-end">${bars}</div>
        <div style="display:flex;gap:16px;margin-top:10px;font-size:11px">
          <span><span style="display:inline-block;width:10px;height:10px;background:var(--primary);border-radius:2px;margin-right:4px"></span>Sales</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:var(--sky);border-radius:2px;margin-right:4px"></span>Purchases</span>
        </div>
      </div>`;
  },

  async reportCustomers() {
    const custs = await DB.getAll('customers');
    let rows='';
    for(const c of custs){ const b=await DB.customerBalance(c.id); rows+=`
      <div class="list-item" style="margin-bottom:8px" onclick="App.quickCustomerView(${c.id})">
        <div class="item-body"><div class="item-title">${esc(c.name)}</div><div class="item-subtitle">${esc(c.city||'')}${c.phone?' · '+c.phone:''}</div></div>
        <div class="item-right"><div class="item-amount ${b>0?'credit':'text-muted'}">${fmt(b)}</div><div class="item-date">${b>0?'Outstanding':'Settled'}</div></div>
      </div>`; }
    return `
      <div class="form-group">
        <label class="form-label">Customer Ledger PDF</label>
        ${CB.html('rep-cust','customers','Select customer...')}
        <div class="form-row" style="margin-top:10px">
          <input type="date" id="rep-cust-from" class="form-input">
          <input type="date" id="rep-cust-to" class="form-input">
        </div>
        <div style="display:flex;gap:10px;margin-top:10px">
          <button class="btn btn-primary" style="flex:1" onclick="App.runLedger('customer')">📄 PDF</button>
          <button class="btn btn-success" style="flex:1" onclick="App.sendWhatsApp()">💬 WhatsApp</button>
        </div>
      </div>
      <div class="divider"></div>
      <h2 class="section-title">All Customers</h2>
      <div>${rows||'<div class="empty-state"><div class="empty-text">No customers yet.</div></div>'}</div>`;
  },

  async reportFactories() {
    const facts = await DB.getAll('factories');
    let rows='';
    for(const f of facts){ const b=await DB.factoryBalance(f.id); rows+=`
      <div class="list-item" style="margin-bottom:8px">
        <div class="item-body"><div class="item-title">${esc(f.name)}</div><div class="item-subtitle">${f.phone||''}</div></div>
        <div class="item-right"><div class="item-amount ${b>0?'debit':'text-muted'}">${fmt(b)}</div><div class="item-date">${b>0?'Due':'Settled'}</div></div>
      </div>`; }
    return `
      <div class="form-group">
        <label class="form-label">Factory Ledger PDF</label>
        ${CB.html('rep-fact','factories','Select factory...')}
        <div class="form-row" style="margin-top:10px">
          <input type="date" id="rep-fact-from" class="form-input">
          <input type="date" id="rep-fact-to" class="form-input">
        </div>
        <button class="btn btn-primary btn-full" style="margin-top:10px" onclick="App.runLedger('factory')">📄 View PDF</button>
      </div>
      <div class="divider"></div>
      <h2 class="section-title">All Factories</h2>
      <div>${rows||'<div class="empty-state"><div class="empty-text">No factories yet.</div></div>'}</div>`;
  },

  async reportProducts() {
    const [sales, products] = await Promise.all([DB.getAll('sales'), DB.getAll('products')]);
    const map = {}; // productId -> { name, units, revenue }
    for(const s of sales){
      const items = Array.isArray(s.items) ? s.items : [{productId:s.productId, productName:'—', units:s.units||0, total:s.total||0}];
      for(const i of items){
        const pid = i.productId || 'unknown';
        if(!map[pid]) map[pid]={name:i.productName||'Unknown', units:0, revenue:0, bills:0};
        map[pid].units   += Number(i.units)||0;
        map[pid].revenue += Number(i.total)||0;
        map[pid].bills   += 1;
      }
    }
    const sorted = Object.entries(map).sort((a,b)=>b[1].revenue-a[1].revenue);
    if(!sorted.length) return `<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">No sales data yet</div></div>`;
    const rows = sorted.map(([pid,v])=>`
      <div class="list-item" style="margin-bottom:8px">
        <div class="item-body"><div class="item-title">${esc(v.name)}</div><div class="item-subtitle">${v.units} units across ${v.bills} bill${v.bills>1?'s':''}</div></div>
        <div class="item-right"><div class="item-amount">${fmt(v.revenue)}</div><div class="item-date">Revenue</div></div>
      </div>`).join('');
    const total = sorted.reduce((s,[,v])=>s+v.revenue,0);
    return `<div class="report-summary"><div class="report-row total"><span>Total Revenue</span><span class="amount-positive">${fmt(total)}</span></div></div>${rows}`;
  },

  async reportTxns() {
    const [sp,pp,custs,facts] = await Promise.all([DB.getAll('salePayments'),DB.getAll('purchasePayments'),DB.getAll('customers'),DB.getAll('factories')]);
    const cm={},fm={}; custs.forEach(c=>cm[c.id]=c.name); facts.forEach(f=>fm[f.id]=f.name);
    const all=[...sp.map(p=>({...p,type:'in',party:cm[p.customerId]||'?'})),...pp.map(p=>({...p,type:'out',party:fm[p.factoryId]||'?'}))].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    if(!all.length) return `<div class="empty-state"><div class="empty-icon">💳</div><div class="empty-title">No transactions</div></div>`;
    return all.map(t=>`<div class="list-item" style="margin-bottom:8px">
      <div class="item-icon ${t.type==='in'?'payment-in':'payment-out'}">${t.type==='in'?'↙':'↗'}</div>
      <div class="item-body"><div class="item-title">${esc(t.party)}</div><div class="item-subtitle">${t.mode||''} ${t.transactionId?'· '+t.transactionId:''}</div></div>
      <div class="item-right"><div class="item-amount ${t.type==='in'?'credit':'debit'}">${t.type==='in'?'+':'−'}${fmt(t.amount)}</div><div class="item-date">${fmtDate(t.date)}</div></div>
    </div>`).join('');
  },

  async masters() {
    return `<div class="page-section">
      <div class="seg-tabs">
        <div class="seg-tab active" onclick="App.switchMasterTab('customers')">Customers</div>
        <div class="seg-tab" onclick="App.switchMasterTab('factories')">Factories</div>
        <div class="seg-tab" onclick="App.switchMasterTab('products')">Products</div>
        <div class="seg-tab" onclick="App.switchMasterTab('transports')">Transport</div>
        <div class="seg-tab" data-tab="settings" onclick="App.switchMasterTab('settings')">Settings</div>
      </div>
      <div id="master-list-container" class="list-container" data-active-type="customers"><div class="skeleton-list"><div class="skeleton"></div><div class="skeleton"></div></div></div>
    </div>`;
  },

  async renderMasterList(type) {
    if(type==='settings'){
      const co=await DB.getSetting('companyName')||'';
      const themeOpt=await DB.getSetting('themeColor')||'indigo';
      return `<div class="form-group"><label class="form-label">Company / Trader Name (shown on bills)</label>
        <input type="text" id="setting-company" class="form-input" value="${esc(co)}" placeholder="Your business name"></div>
        <button class="btn btn-primary btn-full" onclick="App.saveCompanyName()">Save Name</button>
        <div class="divider"></div>
        <div class="form-group"><label class="form-label">Theme Color</label>
        <select id="setting-theme" class="select-input" onchange="App.saveTheme(this.value)">
          <option value="indigo" ${themeOpt==='indigo'?'selected':''}>Midnight Indigo</option>
          <option value="emerald" ${themeOpt==='emerald'?'selected':''}>Emerald Green</option>
          <option value="sky" ${themeOpt==='sky'?'selected':''}>Ocean Blue</option>
          <option value="rose" ${themeOpt==='rose'?'selected':''}>Ruby Rose</option>
        </select></div>
        <div class="divider"></div>
        <div class="divider"></div>
        <label class="form-label">Data Backup</label>
        <button class="btn btn-outline btn-full mb-16" onclick="App.exportData()">⬇ Export Backup</button>
        <button class="btn btn-outline btn-full mb-16" onclick="document.getElementById('import-file').click()">⬆ Import Backup</button>
        <input type="file" id="import-file" style="display:none" accept=".json,.txt" onchange="App.importData(this)">
        <button class="btn btn-ghost btn-full" style="color:var(--danger);margin-top:10px" onclick="App.clearDatabase()">⚠️ Clear All Data</button>
        <p class="text-sm text-muted" style="line-height:1.6;margin-top:16px">Export saves a JSON file. Store it in Google Drive for safekeeping.</p>`;
    }
    const items = await DB.getAll(type);
    const label = {customers:'Customer',factories:'Factory',products:'Product',transports:'Transport'}[type]||type;
    let html = `<button class="btn btn-primary btn-full mb-16" onclick="CB.openMasterCreate('${type}')">+ Add ${label}</button>`;
    if(!items.length) return html+`<div class="empty-state"><div class="empty-text">No ${type} yet.</div></div>`;
    html += items.map(i=>`<div class="master-item">
      <div class="master-info">
        <div class="master-name">${esc(i.name)}</div>
        ${i.city?`<div class="master-detail">📍 ${esc(i.city)}</div>`:''}
        ${i.phone?`<div class="master-detail">📞 ${esc(i.phone)}</div>`:''}
      </div>
      <div class="master-actions">
        <button class="btn-icon" style="color:var(--primary-light)" onclick="CB.openMasterEdit('${type}',${i.id},${JSON.stringify({name:i.name,city:i.city||'',phone:i.phone||''}).replace(/"/g,'&quot;')})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon" style="color:var(--danger)" onclick="App.deleteMaster('${type}',${i.id})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>`).join('');
    return html;
  }
};
