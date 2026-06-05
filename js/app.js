// ============================================================
// APP.JS — Controller
// ============================================================
const App = {
  currentRoute: 'dashboard',
  salesFilter:    { customerId:'', from:'', to:'', sort:'newest' },
  purchaseFilter: { factoryId:'',  from:'', to:'', sort:'newest' },

  async init() {
    const company = await DB.getSetting('companyName');
    if (company) document.querySelector('.app-title').textContent = company;
    const theme = await DB.getSetting('themeColor') || 'indigo';
    this.applyTheme(theme);
    this.navigate('dashboard');
    setTimeout(() => this.checkDailyBackup(), 2000);

    document.addEventListener('cb:select', async (e) => {
      const w = e.target.closest?.('.combobox-wrapper');
      if (w?.dataset?.cb==='sale-cust') {
        const bal = await DB.customerBalance(e.detail.id);
        const el = document.getElementById('sale-cust-bal');
        if (el) el.innerHTML = `Balance: <span style="color:${bal>0?'var(--danger)':'var(--success)'}">${fmt(bal)}</span>`;
      }
    });
  },

  async navigate(route) {
    this.currentRoute = route;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.id===`nav-${route}`));
    const main = document.getElementById('main-content');
    main.innerHTML = '<div class="spinner"></div>';
    const fab = document.getElementById('fab');
    const lbl = document.getElementById('fab-label');
    const fabLabels = { sales:'New Bill', purchases:'New Purchase', masters:'Add' };
    if (fabLabels[route]) {
      fab.classList.remove('hidden');
      if (lbl) lbl.textContent = fabLabels[route];
    } else {
      fab.classList.add('hidden');
      if (lbl) lbl.textContent = '';
    }
    try {
      main.innerHTML = await Pages[route]();
      if (route==='reports') this.switchReportTab('summary');
      if (route==='masters') this.switchMasterTab('customers');
      if (route==='sales')    this.applySalesFilter();
      if (route==='purchases') this.applyPurchaseFilter();
    } catch(e) {
      console.error(e);
      main.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
    }
  },

  handleFab() {
    if (this.currentRoute==='sales')     this.newSale();
    if (this.currentRoute==='purchases') this.newPurchase();
    if (this.currentRoute==='masters') {
      const type = document.getElementById('master-list-container')?.dataset?.activeType || 'customers';
      CB.openMasterCreate(type);
    }
  },

  // ===================== FILTERS =====================
  async applySalesFilter() {
    this.salesFilter = {
      customerId: document.getElementById('sf-cust')?.value||'',
      from:       document.getElementById('sf-from')?.value||'',
      to:         document.getElementById('sf-to')?.value||'',
      sort:       document.getElementById('sf-sort')?.value||'newest'
    };
    const el = document.getElementById('sales-list');
    if (el) el.innerHTML = await Pages.renderSalesList(this.salesFilter);
  },

  async applyPurchaseFilter() {
    this.purchaseFilter = {
      factoryId: document.getElementById('pf-fact')?.value||'',
      from:      document.getElementById('pf-from')?.value||'',
      to:        document.getElementById('pf-to')?.value||'',
      sort:      document.getElementById('pf-sort')?.value||'newest'
    };
    const el = document.getElementById('purchase-list');
    if (el) el.innerHTML = await Pages.renderPurchaseList(this.purchaseFilter);
  },

  // ===================== SALE FORM =====================
  _saleEditId: null,

  newSale() {
    this._saleEditId = null;
    this._openSaleForm(null);
  },

  async editSale(id) {
    this._saleEditId = id;
    const s = await DB.getById('sales', id);
    this._openSaleForm(s);
  },

  _openSaleForm(sale) {
    const isEdit = !!sale;
    const body = `
      <div class="form-group"><label class="form-label">Customer *</label>${CB.html('sale-cust','customers')}
        <div id="sale-cust-bal" style="font-size:12px;margin-top:4px;color:var(--text-3)"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Date *</label>
          <input type="date" id="sale-date" class="form-input" value="${sale?.date||today()}"></div>
        <div class="form-group"><label class="form-label">Transport</label>${CB.html('sale-trans','transports')}</div>
      </div>
      <div class="form-group"><label class="form-label">LR Number</label>
        <input type="text" id="sale-lr" class="form-input" value="${esc(sale?.lrNumber||'')}" placeholder="LR No (optional)"></div>
      <div class="form-label" style="margin-bottom:10px">Products *</div>
      <div id="li-container"></div>
      <button type="button" class="btn btn-ghost btn-full" style="margin-top:4px" onclick="LineItems.addRow()">+ Add Product</button>
      <div class="calc-display" style="margin-top:12px"><span class="calc-label">Grand Total</span><span id="li-grand-total">₹0</span></div>`;
    const foot = `
      <button class="btn btn-ghost" style="flex:1" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" style="flex:2" onclick="App.saveSale()">${isEdit?'Update Bill':'Save & View Bill'}</button>`;
    Modal.open(isEdit?'Edit Bill':'New Customer Bill', body, foot);
    setTimeout(async ()=>{
      LineItems.init('li-container','li-grand-total', Array.isArray(sale?.items)?sale.items:null);
      if (sale?.customerId) {
        const c = await DB.getById('customers', sale.customerId);
        if (c) { document.querySelector('[data-cb="sale-cust"] .combobox-input').value=c.name; document.getElementById('cb-sale-cust').value=c.id; }
      }
      if (sale?.transportId) {
        const t = await DB.getById('transports', sale.transportId);
        if (t) { document.querySelector('[data-cb="sale-trans"] .combobox-input').value=t.name; document.getElementById('cb-sale-trans').value=t.id; }
      }
    }, 60);
  },

  async saveSale() {
    const cid = CB.val('sale-cust');
    if (!cid) return Toast.show('Select a customer','error');
    const items = LineItems.getItems();
    if (!items.length || !items[0].productId) return Toast.show('Add at least one product','error');
    const data = {
      customerId:  Number(cid),
      date:        document.getElementById('sale-date').value,
      items,
      total:       LineItems.grandTotal(),
      transportId: CB.val('sale-trans') ? Number(CB.val('sale-trans')) : null,
      lrNumber:    document.getElementById('sale-lr').value,
    };
    if (this._saleEditId) {
      const existing = await DB.getById('sales', this._saleEditId);
      await DB.update('sales', { ...existing, ...data });
      Toast.show('Bill updated','success');
    } else {
      data.billNumber = await DB.nextBillNumber();
      const id = await DB.add('sales', data);
      Toast.show('Bill saved','success');
      Modal.close();
      PDF.bill(id);
      if (['sales','dashboard'].includes(this.currentRoute)) this.navigate(this.currentRoute);
      return;
    }
    Modal.close();
    if (['sales','dashboard'].includes(this.currentRoute)) this.navigate(this.currentRoute);
  },

  async deleteSale(id) {
    if (!confirmDialog('Delete this bill? This cannot be undone.')) return;
    await DB.remove('sales', id);
    Toast.show('Bill deleted','info');
    Modal.close();
    if (this.currentRoute==='sales') this.applySalesFilter();
    else this.navigate('dashboard');
  },

  async viewSale(id) {
    const s = await DB.getById('sales', id); if (!s) return;
    const c = await DB.getById('customers', s.customerId)||{};
    const items = Array.isArray(s.items)?s.items:[{productName:'—',packing:s.packing||'',units:s.units||0,cost:s.perUnitCost||0,total:s.total||0}];
    const rows = items.map(i=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
      <span>${esc(i.productName||'—')}${i.packing?' ('+esc(i.packing)+')':''}<br><small style="color:var(--text-3)">${i.units} × ${fmt(i.cost)}</small></span>
      <span style="font-weight:600">${fmt(i.total)}</span></div>`).join('');
    const body = `
      <div style="margin-bottom:12px"><div class="item-title">${esc(c.name||'Unknown')}</div>
      <div class="text-sm text-muted">${s.billNumber} · ${fmtDate(s.date)}</div></div>
      ${rows}
      <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:18px;font-weight:700">
        <span>Total</span><span style="color:var(--primary-light)">${fmt(s.total)}</span></div>
      ${s.lrNumber?`<div class="text-sm text-muted">LR: ${esc(s.lrNumber)}</div>`:''}`;
    const foot = `
      <button class="btn btn-ghost btn-sm" onclick="App.deleteSale(${id})" style="color:var(--danger)">🗑 Delete</button>
      <button class="btn btn-outline btn-sm" onclick="Modal.close();App.editSale(${id})">✏️ Edit</button>
      <button class="btn btn-ghost btn-sm" onclick="PDF.bill(${id})">⬇ PDF</button>
      <button class="btn btn-primary btn-sm" onclick="PDF.share(${id})">↗ Share</button>`;
    Modal.open('Bill Details', body, foot, `${s.billNumber} · ${fmtDate(s.date)}`);
  },

  // ===================== PURCHASE FORM =====================
  _purchEditId: null,

  newPurchase() { this._purchEditId=null; this._openPurchaseForm(null); },

  async editPurchase(id) {
    this._purchEditId = id;
    const p = await DB.getById('purchases', id);
    this._openPurchaseForm(p);
  },

  _openPurchaseForm(purch) {
    const isEdit = !!purch;
    const body = `
      <div class="form-group"><label class="form-label">Factory *</label>${CB.html('purch-fact','factories')}</div>
      <div class="form-group"><label class="form-label">Date *</label>
        <input type="date" id="purch-date" class="form-input" value="${purch?.date||today()}"></div>
      <div class="form-label" style="margin-bottom:10px">Products *</div>
      <div id="li-container"></div>
      <button type="button" class="btn btn-ghost btn-full" style="margin-top:4px" onclick="LineItems.addRow()">+ Add Product</button>
      <div class="calc-display" style="margin-top:12px"><span class="calc-label">Grand Total</span><span id="li-grand-total">₹0</span></div>`;
    const foot = `
      <button class="btn btn-ghost" style="flex:1" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" style="flex:2" onclick="App.savePurchase()">${isEdit?'Update Purchase':'Save Purchase'}</button>`;
    Modal.open(isEdit?'Edit Purchase':'New Purchase', body, foot);
    setTimeout(async ()=>{
      LineItems.init('li-container','li-grand-total', Array.isArray(purch?.items)?purch.items:null);
      if (purch?.factoryId) {
        const f = await DB.getById('factories', purch.factoryId);
        if (f) { document.querySelector('[data-cb="purch-fact"] .combobox-input').value=f.name; document.getElementById('cb-purch-fact').value=f.id; }
      }
    }, 60);
  },

  async savePurchase() {
    const fid = CB.val('purch-fact');
    if (!fid) return Toast.show('Select a factory','error');
    const items = LineItems.getItems();
    if (!items.length || !items[0].productId) return Toast.show('Add at least one product','error');
    const data = { factoryId:Number(fid), date:document.getElementById('purch-date').value, items, total:LineItems.grandTotal() };
    if (this._purchEditId) {
      const ex = await DB.getById('purchases', this._purchEditId);
      await DB.update('purchases', {...ex, ...data});
      Toast.show('Purchase updated','success');
    } else {
      await DB.add('purchases', data);
      Toast.show('Purchase saved','success');
    }
    Modal.close();
    if (['purchases','dashboard'].includes(this.currentRoute)) this.navigate(this.currentRoute);
  },

  async viewPurchase(id) {
    const p = await DB.getById('purchases', id); if (!p) return;
    const f = await DB.getById('factories', p.factoryId)||{};
    const items = Array.isArray(p.items)?p.items:[{productName:'—',packing:p.packing||'',units:p.units||0,cost:p.perUnitCost||0,total:p.total||0}];
    const rows = items.map(i=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
      <span>${esc(i.productName||'—')}${i.packing?' ('+esc(i.packing)+')':''}<br><small style="color:var(--text-3)">${i.units} × ${fmt(i.cost)}</small></span>
      <span style="font-weight:600">${fmt(i.total)}</span></div>`).join('');
    const body = `
      <div style="margin-bottom:12px"><div class="item-title">${esc(f.name||'Unknown Factory')}</div>
      <div class="text-sm text-muted">${fmtDate(p.date)}</div></div>
      ${rows}
      <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:18px;font-weight:700"><span>Total</span><span style="color:var(--sky)">${fmt(p.total)}</span></div>`;
    const foot = `
      <button class="btn btn-ghost btn-sm" onclick="App.deletePurchase(${id})" style="color:var(--danger)">🗑 Delete</button>
      <button class="btn btn-primary btn-sm" onclick="Modal.close();App.editPurchase(${id})">✏️ Edit</button>
      <button class="btn btn-ghost btn-sm" onclick="Modal.close()">Close</button>`;
    Modal.open('Purchase Details', body, foot, fmtDate(p.date));
  },

  async deletePurchase(id) {
    if (!confirmDialog('Delete this purchase?')) return;
    await DB.remove('purchases', id);
    Toast.show('Purchase deleted','info');
    Modal.close();
    if (this.currentRoute==='purchases') this.applyPurchaseFilter();
    else this.navigate('dashboard');
  },

  // ===================== PAYMENTS =====================
  customerPayment() {
    const body = `
      <div class="form-group"><label class="form-label">Customer *</label>${CB.html('pay-cust','customers')}</div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Date *</label><input type="date" id="pay-date" class="form-input" value="${today()}"></div>
        <div class="form-group"><label class="form-label">Amount (₹) *</label><input type="number" id="pay-amt" class="form-input" min="1" step="0.01"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Mode</label><select id="pay-mode" class="select-input"><option>UPI</option><option>Cash</option><option>Bank Transfer</option></select></div>
        <div class="form-group"><label class="form-label">Txn ID</label><input type="text" id="pay-txn" class="form-input" placeholder="Optional"></div>
      </div>`;
    Modal.open('Receive Payment', body, `<button class="btn btn-ghost" style="flex:1" onclick="Modal.close()">Cancel</button><button class="btn btn-success" style="flex:2" onclick="App.savePayment('customer')">Save Payment</button>`);
  },

  factoryPayment() {
    const body = `
      <div class="form-group"><label class="form-label">Factory *</label>${CB.html('fpay-fact','factories')}</div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Date *</label><input type="date" id="fpay-date" class="form-input" value="${today()}"></div>
        <div class="form-group"><label class="form-label">Amount (₹) *</label><input type="number" id="fpay-amt" class="form-input" min="1" step="0.01"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Mode</label><select id="fpay-mode" class="select-input"><option>UPI</option><option>Bank Transfer</option><option>Cash</option></select></div>
        <div class="form-group"><label class="form-label">Txn ID</label><input type="text" id="fpay-txn" class="form-input" placeholder="Optional"></div>
      </div>`;
    Modal.open('Pay Factory', body, `<button class="btn btn-ghost" style="flex:1" onclick="Modal.close()">Cancel</button><button class="btn btn-danger" style="flex:2" onclick="App.savePayment('factory')">Pay Factory</button>`);
  },

  async savePayment(type) {
    const isCust = type==='customer', pre=isCust?'pay':'fpay';
    const idVal = CB.val(`${pre}-${isCust?'cust':'fact'}`);
    const amt   = parseFloat(document.getElementById(`${pre}-amt`)?.value);
    if (!idVal || !amt) return Toast.show('Fill required fields','error');
    await DB.add(isCust?'salePayments':'purchasePayments', {
      [isCust?'customerId':'factoryId']: Number(idVal),
      date: document.getElementById(`${pre}-date`).value,
      amount: amt,
      mode:  document.getElementById(`${pre}-mode`).value,
      transactionId: document.getElementById(`${pre}-txn`).value
    });
    Modal.close();
    Toast.show('Payment recorded','success');
    if (this.currentRoute==='dashboard') this.navigate('dashboard');
  },

  // ===================== REPORTS =====================
  async switchReportTab(tab) {
    const tabs = ['summary','customers','factories','products','txns'];
    document.querySelectorAll('#report-tabs .seg-tab').forEach((t,i)=>t.classList.toggle('active',tabs[i]===tab));
    const c = document.getElementById('report-content');
    c.innerHTML = '<div class="spinner"></div>';
    try {
      const map = { summary:Pages.reportSummary, customers:Pages.reportCustomers, factories:Pages.reportFactories, products:Pages.reportProducts, txns:Pages.reportTxns };
      c.innerHTML = await map[tab].call(Pages);
      if (['customers','factories'].includes(tab)) document.querySelectorAll('#report-content .combobox-wrapper').forEach(w=>CB.init(w));
    } catch(e) { c.innerHTML=`<div class="empty-state">Error: ${e.message}</div>`; }
  },

  runLedger(type) {
    if (type==='customer') {
      const cid=CB.val('rep-cust'); if(!cid) return Toast.show('Select a customer','error');
      PDF.customerLedger(cid, document.getElementById('rep-cust-from')?.value, document.getElementById('rep-cust-to')?.value);
    } else {
      const fid=CB.val('rep-fact'); if(!fid) return Toast.show('Select a factory','error');
      PDF.factoryLedger(fid, document.getElementById('rep-fact-from')?.value, document.getElementById('rep-fact-to')?.value);
    }
  },

  async sendWhatsApp() {
    const cid=CB.val('rep-cust'); if(!cid) return Toast.show('Select a customer','error');
    const cust=await DB.getById('customers',cid);
    if (!cust?.phone) return Toast.show('Customer has no phone number','error');
    const bal=await DB.customerBalance(cid);
    const company=await DB.getSetting('companyName')||'us';
    const text=encodeURIComponent(`Hello ${cust.name},\n\nYour outstanding balance with ${company} is *₹${bal.toLocaleString('en-IN')}*.\nKindly clear your dues at the earliest.\n\nThank you! 🙏`);
    let phone=cust.phone.replace(/\D/g,''); if(phone.length===10) phone='91'+phone;
    window.open(`https://wa.me/${phone}?text=${text}`,'_blank');
  },

  async quickCustomerView(customerId) {
    const cust=await DB.getById('customers',customerId); if(!cust) return;
    const [bills,pays]=await Promise.all([DB.getByIndex('sales','customerId',Number(customerId)),DB.getByIndex('salePayments','customerId',Number(customerId))]);
    const tB=bills.reduce((s,r)=>s+(r.total||0),0), tP=pays.reduce((s,r)=>s+(r.amount||0),0), bal=tB-tP;
    const body=`<div class="report-summary">
      <div class="report-row"><span>Total Billed</span><span>${fmt(tB)}</span></div>
      <div class="report-row"><span>Total Received</span><span class="amount-positive">${fmt(tP)}</span></div>
      <div class="report-row total"><span>Outstanding</span><span class="${bal>0?'amount-negative':'amount-positive'}">${fmt(bal)}</span></div>
    </div><div style="margin-top:12px;font-size:13px;color:var(--text-2)">${bills.length} bills · ${pays.length} payments</div>`;
    const foot=`<button class="btn btn-ghost" style="flex:1" onclick="Modal.close()">Close</button>
      <button class="btn btn-primary" style="flex:1" onclick="PDF.customerLedger(${customerId})">📄 PDF</button>
      ${cust.phone?`<button class="btn btn-success" style="flex:1" onclick="App._waReminder(${customerId})">💬 WA</button>`:''}`;
    Modal.open(cust.name, body, foot, cust.city||'');
  },

  async _waReminder(cid) {
    Modal.close();
    const cust=await DB.getById('customers',cid), bal=await DB.customerBalance(cid), company=await DB.getSetting('companyName')||'us';
    const text=encodeURIComponent(`Hello ${cust.name},\n\nYour outstanding balance with ${company} is *₹${bal.toLocaleString('en-IN')}*.\nKindly clear your dues at the earliest.\n\nThank you! 🙏`);
    let phone=cust.phone.replace(/\D/g,''); if(phone.length===10) phone='91'+phone;
    window.open(`https://wa.me/${phone}?text=${text}`,'_blank');
  },

  // ===================== MASTERS =====================
  async switchMasterTab(type) {
    document.querySelectorAll('.seg-tab').forEach(t=>{
      const map={customers:'Customers',factories:'Factories',products:'Products',transports:'Transport',settings:'Settings'};
      t.classList.toggle('active', map[type]===t.textContent);
    });
    const c=document.getElementById('master-list-container');
    if (c) { c.dataset.activeType=type; c.innerHTML=await Pages.renderMasterList(type); }
  },

  async deleteMaster(type, id) {
    if (!confirmDialog('Delete this entry?')) return;
    await DB.remove(type, id);
    const at=document.getElementById('master-list-container')?.dataset?.activeType||type;
    this.switchMasterTab(at);
    Toast.show('Deleted','info');
  },

  saveCompanyName() {
    const val=document.getElementById('setting-company')?.value?.trim();
    if (!val) return Toast.show('Enter a company name','error');
    DB.setSetting('companyName', val);
    document.querySelector('.app-title').textContent = val;
    Toast.show('Saved','success');
  },

  async clearDatabase() {
    if (!confirmDialog('WARNING: This will permanently delete ALL data. Make sure you have a backup first. Type "DELETE" to confirm.')) return;
    const confirmation = prompt('Type "DELETE" to confirm:');
    if (confirmation !== 'DELETE') return Toast.show('Cancelled', 'info');
    await DB.clearAll();
    Toast.show('Database cleared', 'success');
    setTimeout(() => location.reload(), 1000);
  },

  async exportData() {
    Toast.show('Preparing backup...', 'info');
    const data = await DB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'text/plain' });
    const fileName = `Hisaab-Backup-${today()}.txt`;
    const file = new File([blob], fileName, { type: 'text/plain' });
    const canShare = navigator.share && navigator.canShare && navigator.canShare({ files: [file] });

    window._hisaabDownloadTemp = () => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Hisaab-Backup-${today()}.json`; a.click(); URL.revokeObjectURL(url);
      localStorage.setItem('lastBackupTimestamp', Date.now());
      if (App.currentRoute === 'dashboard') App.navigate('dashboard');
      Toast.show('Backup downloaded', 'success');
      Modal.close();
    };
    window._hisaabShareTemp = async () => {
      try {
        await navigator.share({ files: [file], title: 'Hisaab Backup' });
        localStorage.setItem('lastBackupTimestamp', Date.now());
        if (App.currentRoute === 'dashboard') App.navigate('dashboard');
        Modal.close();
      } catch (e) {
        if (e.name !== 'AbortError') window._hisaabDownloadTemp();
      }
    };

    const body = `
      <div style="text-align:center;padding:10px 0">
        <div style="font-size:48px;margin-bottom:16px">📦</div>
        <div style="font-size:18px;font-weight:700;margin-bottom:8px">Backup Ready</div>
        <p style="color:var(--text-3);font-size:14px;margin-bottom:24px;line-height:1.5">Your database backup has been generated. Please save it securely to Google Drive or email it to yourself.</p>
        ${canShare ? `<button class="btn btn-primary btn-full mb-16" onclick="window._hisaabShareTemp()">Share via App (Drive/Email)</button>` : ''}
        <button class="btn btn-outline btn-full" onclick="window._hisaabDownloadTemp()">Download File</button>
      </div>
    `;
    Modal.open('Backup Data', body, `<button class="btn btn-ghost btn-full" onclick="Modal.close()">Cancel</button>`);
  },

  async checkDailyBackup() {
    const lastChangeTs = Number(localStorage.getItem('lastChangeTimestamp')||0);
    const [custs, facts] = await Promise.all([DB.getAll('customers'), DB.getAll('factories')]);
    const hasAnyData = lastChangeTs > 0 || custs.length > 0 || facts.length > 0;
    
    if (!hasAnyData) return; // Do not bother new users with no data
    
    const lastTs = Number(localStorage.getItem('lastBackupTimestamp')||0);
    const msInDay = 24 * 60 * 60 * 1000;
    if (Date.now() - lastTs > msInDay) {
      if (confirmDialog('It is recommended to backup your data daily. Would you like to export it now?')) {
        await this.exportData();
      }
    }
  },

  importData(input) {
    if (!input.files[0]) return;
    const r=new FileReader();
    r.onload=async(e)=>{ try { const d=JSON.parse(e.target.result); if(confirmDialog('Overwrite all current data?')){ await DB.importAll(d); Toast.show('Imported','success'); setTimeout(()=>location.reload(),1000); } } catch{ Toast.show('Invalid file','error'); } };
    r.readAsText(input.files[0]);
  },
  
  async saveTheme(val) {
    await DB.setSetting('themeColor', val);
    this.applyTheme(val);
  },
  applyTheme(color) {
    const root = document.documentElement;
    if (color === 'emerald') {
      root.style.setProperty('--primary', '#14b8a6');
      root.style.setProperty('--primary-light', '#2dd4bf');
      root.style.setProperty('--primary-dim', 'rgba(20,184,166,0.15)');
    } else if (color === 'sky') {
      root.style.setProperty('--primary', '#38bdf8');
      root.style.setProperty('--primary-light', '#7dd3fc');
      root.style.setProperty('--primary-dim', 'rgba(56,189,248,0.15)');
    } else if (color === 'rose') {
      root.style.setProperty('--primary', '#f43f5e');
      root.style.setProperty('--primary-light', '#fb7185');
      root.style.setProperty('--primary-dim', 'rgba(244,63,94,0.15)');
    } else { // indigo
      root.style.setProperty('--primary', '#6366f1');
      root.style.setProperty('--primary-light', '#818cf8');
      root.style.setProperty('--primary-dim', 'rgba(99,102,241,0.15)');
    }
  }
};

window.addEventListener('DOMContentLoaded', () => App.init());
