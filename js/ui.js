// ============================================================
// UI.JS — Modal, Sub-dialog, Toast, Combobox, LineItems
// ============================================================

function fmt(n) { if(!n&&n!==0)return'₹0'; return'₹'+Number(n).toLocaleString('en-IN',{minimumFractionDigits:0,maximumFractionDigits:2}); }
function fmtDate(s){ if(!s)return''; return new Date(s+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
function today(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ---------- Toast ----------
const Toast = {
  show(msg, type='info', dur=2800) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span>${{success:'✓',error:'✕',info:'ℹ'}[type]||'ℹ'}</span><span>${esc(msg)}</span>`;
    c.appendChild(t);
    setTimeout(()=>t.remove(), dur);
  }
};

// ---------- Modal ----------
const Modal = {
  open(title, body, foot='', sub='') {
    document.getElementById('modal-header').innerHTML =
      `<div class="modal-title">${esc(title)}</div>${sub?`<div class="modal-subtitle">${esc(sub)}</div>`:''}`;
    document.getElementById('modal-body').innerHTML   = body;
    document.getElementById('modal-footer').innerHTML = foot;
    document.getElementById('modal-overlay').classList.add('open');
    document.getElementById('modal-sheet').classList.add('open');
    document.getElementById('modal-body').scrollTop = 0;
    document.querySelectorAll('#modal-body .combobox-wrapper').forEach(w=>CB.init(w));
  },
  close() {
    document.getElementById('modal-overlay').classList.remove('open');
    document.getElementById('modal-sheet').classList.remove('open');
  }
};

// ---------- Sub-dialog (layered above main modal) ----------
const SubDlg = {
  open(html) {
    const el = document.getElementById('sub-dlg');
    document.getElementById('sub-dlg-inner').innerHTML = html;
    el.style.display = 'flex';
  },
  close() { document.getElementById('sub-dlg').style.display = 'none'; }
};

// ---------- Combobox ----------
const CB = {
  _blocking: false,
  _pendingWrapper: null,

  html(id, store, ph='Search or type to add...') {
    return `<div class="combobox-wrapper" data-store="${store}" data-cb="${id}">
      <input type="text" class="form-input combobox-input" placeholder="${ph}" autocomplete="off"/>
      <input type="hidden" class="combobox-hidden" id="cb-${id}"/>
      <div class="combobox-dropdown" id="cbd-${id}"></div>
    </div>`;
  },

  init(w) {
    const inp = w.querySelector('.combobox-input');
    const dd  = w.querySelector('.combobox-dropdown');
    if (inp._cb) return; inp._cb = true;
    inp.addEventListener('focus', ()=>CB._refresh(w, inp.value));
    inp.addEventListener('input', ()=>CB._refresh(w, inp.value));
    inp.addEventListener('blur',  ()=>{ if(!CB._blocking) CB._close(dd); });
    dd.addEventListener('mousedown',  ()=>{ CB._blocking=true; });
    dd.addEventListener('touchstart', ()=>{ CB._blocking=true; },{passive:true});
    dd.addEventListener('mouseup',  ()=>setTimeout(()=>{ CB._blocking=false; },200));
    dd.addEventListener('touchend', ()=>setTimeout(()=>{ CB._blocking=false; },200));
  },

  async _refresh(w, search) {
    const store = w.dataset.store;
    const dd    = w.querySelector('.combobox-dropdown');
    const items = await DB.getAll(store);
    const q     = (search||'').toLowerCase().trim();
    const filt  = q ? items.filter(i=>i.name.toLowerCase().includes(q)) : items;
    const exact = items.find(i=>i.name.toLowerCase()===q);
    let html = '';
    if (q && !exact) html += `<div class="combobox-option create-new" data-action="create" data-name="${esc(search)}">+ Create "${esc(search)}"</div>`;
    if (!filt.length && !q) html += `<div class="combobox-option" style="color:var(--text-3)">No entries yet — type to create.</div>`;
    filt.forEach(i=>{
      const extra = i.city?` — ${i.city}`:i.phone?` · ${i.phone}`:'';
      html += `<div class="combobox-option" data-id="${i.id}" data-name="${esc(i.name)}">${esc(i.name)}<span style="color:var(--text-3);font-size:12px">${esc(extra)}</span></div>`;
    });
    dd.innerHTML = html; dd.classList.add('open');
    dd.querySelectorAll('[data-id]').forEach(o=>o.addEventListener('click',()=>CB._select(w,o.dataset.id,o.dataset.name)));
    const co = dd.querySelector('[data-action="create"]');
    if (co) co.addEventListener('click',()=>{ CB._close(dd); CB._openSubDlg(store, co.dataset.name, w); });
  },

  _select(w, id, name) {
    w.querySelector('.combobox-input').value  = name;
    w.querySelector('.combobox-hidden').value = id;
    CB._close(w.querySelector('.combobox-dropdown'));
    CB._blocking = false;
    w.dispatchEvent(new CustomEvent('cb:select',{detail:{id,name},bubbles:true}));
  },

  _close(dd){ if(dd) dd.classList.remove('open'); },
  val(id)  { return document.getElementById(`cb-${id}`)?.value || ''; },

  // Opens sub-dialog (on top of current modal) for creating customer/factory/etc
  _openSubDlg(store, prefill, wrapper) {
    CB._pendingWrapper = wrapper;
    const isC = store==='customers';
    const isF = store==='factories';
    if (!isC && !isF) {
      // Products / transports: just create inline
      DB.add(store,{name:prefill}).then(id=>{ CB._select(wrapper,id,prefill); Toast.show(`"${prefill}" added`,'success'); });
      return;
    }
    const extra = isC
      ? `<div class="form-group"><label class="form-label">City</label><input class="form-input" id="sdlg-city" placeholder="City"></div>
         <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="sdlg-phone" placeholder="Phone" type="tel"></div><div class="form-group"><label class="form-label">Opening Balance (To Receive)</label><input class="form-input" id="sdlg-ob" placeholder="0.00" type="number" step="0.01"></div>`
      : `<div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="sdlg-phone" placeholder="Phone" type="tel"></div><div class="form-group"><label class="form-label">Opening Balance (To Pay)</label><input class="form-input" id="sdlg-ob" placeholder="0.00" type="number" step="0.01"></div>`;
    SubDlg.open(`
      <div style="font-size:17px;font-weight:700;margin-bottom:16px">Add ${isC?'Customer':'Factory'}</div>
      <div class="form-group"><label class="form-label">Name *</label>
        <input class="form-input" id="sdlg-name" value="${esc(prefill)}" placeholder="${isC?'Customer':'Factory'} name"></div>
      ${extra}
      <div style="display:flex;gap:10px;margin-top:12px">
        <button class="btn btn-ghost" style="flex:1" onclick="CB._closeSubDlg()">Cancel</button>
        <button class="btn btn-primary" style="flex:2" onclick="CB._saveSubDlg('${store}')">Save &amp; Select</button>
      </div>`);
  },

  _closeSubDlg() { SubDlg.close(); CB._pendingWrapper = null; },

  async _saveSubDlg(store) {
    const name  = document.getElementById('sdlg-name')?.value?.trim();
    if (!name) return Toast.show('Name is required','error');
    const city  = document.getElementById('sdlg-city')?.value?.trim()||'';
    const phone = document.getElementById('sdlg-phone')?.value?.trim()||'';
    const openingBalance = parseFloat(document.getElementById('sdlg-ob')?.value) || 0;
    const data  = store==='customers' ? {name,city,phone,openingBalance} : {name,phone,openingBalance};
    const id    = await DB.add(store, data);
    Toast.show(`"${name}" created`,'success');
    SubDlg.close();
    if (CB._pendingWrapper) { CB._select(CB._pendingWrapper, id, name); CB._pendingWrapper = null; }
    // If on masters page, refresh
    if (App.currentRoute==='masters') {
      const at = document.getElementById('master-list-container')?.dataset?.activeType;
      if (at) App.switchMasterTab(at);
    }
  },

  // For adding from masters tab directly (no existing wrapper)
  openMasterCreate(store) {
    CB._pendingWrapper = null;
    const isC = store==='customers', isF = store==='factories';
    const isP = store==='products',  isT = store==='transports';
    let extra = '';
    if (isC) extra = `<div class="form-group"><label class="form-label">City</label><input class="form-input" id="sdlg-city" placeholder="City"></div><div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="sdlg-phone" placeholder="Phone" type="tel"></div><div class="form-group"><label class="form-label">Opening Balance (To Receive)</label><input class="form-input" id="sdlg-ob" placeholder="0.00" type="number" step="0.01"></div>`;
    if (isF) extra = `<div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="sdlg-phone" placeholder="Phone" type="tel"></div><div class="form-group"><label class="form-label">Opening Balance (To Pay)</label><input class="form-input" id="sdlg-ob" placeholder="0.00" type="number" step="0.01"></div>`;
    const label = isC?'Customer':isF?'Factory':isP?'Product':'Transport';
    SubDlg.open(`
      <div style="font-size:17px;font-weight:700;margin-bottom:16px">Add ${label}</div>
      <div class="form-group"><label class="form-label">Name *</label>
        <input class="form-input" id="sdlg-name" placeholder="${label} name"></div>
      ${extra}
      <div style="display:flex;gap:10px;margin-top:12px">
        <button class="btn btn-ghost" style="flex:1" onclick="CB._closeSubDlg()">Cancel</button>
        <button class="btn btn-primary" style="flex:2" onclick="CB._saveSubDlg('${store}')">Save</button>
      </div>`);
  },

  openMasterEdit(store, id, item) {
    const isC = store==='customers', isF = store==='factories';
    let extra = '';
    if (isC) extra = `<div class="form-group"><label class="form-label">City</label><input class="form-input" id="sdlg-city" value="${esc(item.city||'')}" placeholder="City"></div><div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="sdlg-phone" value="${esc(item.phone||'')}" placeholder="Phone" type="tel"></div><div class="form-group"><label class="form-label">Opening Balance</label><input class="form-input" id="sdlg-ob" value="${item.openingBalance||''}" placeholder="0.00" type="number" step="0.01"></div>`;
    if (isF) extra = `<div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="sdlg-phone" value="${esc(item.phone||'')}" placeholder="Phone" type="tel"></div><div class="form-group"><label class="form-label">Opening Balance</label><input class="form-input" id="sdlg-ob" value="${item.openingBalance||''}" placeholder="0.00" type="number" step="0.01"></div>`;
    const label = isC?'Customer':isF?'Factory':store==='products'?'Product':'Transport';
    SubDlg.open(`
      <div style="font-size:17px;font-weight:700;margin-bottom:16px">Edit ${label}</div>
      <div class="form-group"><label class="form-label">Name *</label>
        <input class="form-input" id="sdlg-name" value="${esc(item.name||'')}" placeholder="${label} name"></div>
      ${extra}
      <div style="display:flex;gap:10px;margin-top:12px">
        <button class="btn btn-ghost" style="flex:1" onclick="CB._closeSubDlg()">Cancel</button>
        <button class="btn btn-primary" style="flex:2" onclick="CB._updateSubDlg('${store}',${id})">Save Changes</button>
      </div>`);
  },

  async _updateSubDlg(store, id) {
    const name  = document.getElementById('sdlg-name')?.value?.trim();
    if (!name) return Toast.show('Name is required','error');
    const existing = await DB.getById(store, id);
    const city  = document.getElementById('sdlg-city')?.value?.trim()||existing?.city||'';
    const phone = document.getElementById('sdlg-phone')?.value?.trim()||existing?.phone||'';
    const openingBalance = parseFloat(document.getElementById('sdlg-ob')?.value) || 0;
    await DB.update(store, { ...existing, name, city, phone, openingBalance });
    Toast.show('Updated','success');
    SubDlg.close();
    const at = document.getElementById('master-list-container')?.dataset?.activeType || store;
    App.switchMasterTab(at);
  }
};

function confirmDialog(msg){ return confirm(msg); }

function wireCalc(uid, cid, tid){
  const c=()=>{ const u=parseFloat(document.getElementById(uid)?.value)||0, v=parseFloat(document.getElementById(cid)?.value)||0, el=document.getElementById(tid); if(el) el.textContent=fmt(u*v); };
  document.getElementById(uid)?.addEventListener('input',c);
  document.getElementById(cid)?.addEventListener('input',c);
  c();
}

// ---------- LineItems ----------
const LineItems = {
  _rows:[], _nextId:0, _cid:'', _gtid:'',

  init(cid, gtid, preload) {
    this._rows=[]; this._nextId=0; this._cid=cid; this._gtid=gtid;
    if (preload?.length) { preload.forEach(i=>this._addRowData(i)); this._render(); }
    else { this.addRow(); }
  },

  _addRowData(data) {
    const id = ++this._nextId;
    this._rows.push({ id, productId:data.productId||'', productName:data.productName||'', packing:data.packing||'', units:data.units||'', cost:data.cost||'' });
  },

  addRow() { this._addRowData({}); this._render(); },
  removeRow(id) { if(this._rows.length<=1)return Toast.show('At least one product required','error'); this._rows=this._rows.filter(r=>r.id!==id); this._render(); },

  _render() {
    const c = document.getElementById(this._cid); if(!c)return;
    c.innerHTML = this._rows.map(r=>`
      <div class="line-item-row" id="lir-${r.id}">
        <div class="line-item-header">
          <span class="line-item-num">Item ${r.id}</span>
          <button type="button" class="btn-icon btn-sm" style="color:var(--danger);width:28px;height:28px" onclick="LineItems.removeRow(${r.id})">✕</button>
        </div>
        <div style="margin-bottom:10px">${CB.html(`li-prod-${r.id}`,'products','Product...')}</div>
        <div class="form-row">
          <div class="form-group" style="margin-bottom:0"><label class="form-label">Packing</label>
            <input type="text" class="form-input" id="li-pack-${r.id}" placeholder="50kg bag" value="${esc(r.packing)}" oninput="LineItems._upd(${r.id},'packing',this.value)"></div>
          <div class="form-group" style="margin-bottom:0"><label class="form-label">Units</label>
            <input type="number" class="form-input" id="li-units-${r.id}" value="${r.units}" min="0.01" step="0.01" oninput="LineItems._upd(${r.id},'units',this.value);LineItems._calc(${r.id})"></div>
        </div>
        <div class="form-row" style="margin-top:8px">
          <div class="form-group" style="margin-bottom:0"><label class="form-label">Rate (₹)</label>
            <input type="number" class="form-input" id="li-cost-${r.id}" value="${r.cost}" min="0" step="0.01" oninput="LineItems._upd(${r.id},'cost',this.value);LineItems._calc(${r.id})"></div>
          <div class="form-group" style="margin-bottom:0"><label class="form-label">Amount</label>
            <div class="form-input" id="li-amt-${r.id}" style="background:var(--primary-dim);color:var(--primary-light);font-weight:700">${fmt(r.units*r.cost)}</div></div>
        </div>
      </div>`).join('');

    this._rows.forEach(r=>{
      const w = document.querySelector(`[data-cb="li-prod-${r.id}"]`)?.closest('.combobox-wrapper');
      if(!w) return; CB.init(w);
      if(r.productId && r.productName){ w.querySelector('.combobox-input').value=r.productName; w.querySelector('.combobox-hidden').value=r.productId; }
      w.addEventListener('cb:select', e=>{ const row=this._rows.find(x=>x.id===r.id); if(row){row.productId=e.detail.id;row.productName=e.detail.name;} });
    });
    this._updateGT();
  },

  _upd(id,f,v){ const r=this._rows.find(x=>x.id===id); if(r) r[f]=v; },
  _calc(id){
    const r=this._rows.find(x=>x.id===id); if(!r)return;
    const el=document.getElementById(`li-amt-${id}`); if(el) el.textContent=fmt((parseFloat(r.units)||0)*(parseFloat(r.cost)||0));
    this._updateGT();
  },
  _updateGT(){
    const t=this._rows.reduce((s,r)=>(s+(parseFloat(r.units)||0)*(parseFloat(r.cost)||0)),0);
    const el=document.getElementById(this._gtid); if(el) el.textContent=fmt(t);
  },

  getItems() {
    return this._rows.map(r=>({
      productId:   r.productId   || document.getElementById(`cb-li-prod-${r.id}`)?.value||'',
      productName: r.productName || document.querySelector(`[data-cb="li-prod-${r.id}"] .combobox-input`)?.value||'',
      packing:     document.getElementById(`li-pack-${r.id}`)?.value||r.packing,
      units:       parseFloat(document.getElementById(`li-units-${r.id}`)?.value||r.units)||0,
      cost:        parseFloat(document.getElementById(`li-cost-${r.id}`)?.value||r.cost)||0,
    })).map(r=>({...r, total:r.units*r.cost}));
  },

  grandTotal(){ return this.getItems().reduce((s,r)=>s+r.total,0); }
};
