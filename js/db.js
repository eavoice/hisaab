// ============================================================
// DB.JS — IndexedDB layer
// ============================================================
const DB = (() => {
  const DB_NAME = 'hisaab-db', DB_VER = 3;
  let _db;

  async function open() {
    if (_db) return _db;
    _db = await idb.openDB(DB_NAME, DB_VER, {
      upgrade(db) {
        const ensure = (name, opts, idxs) => {
          if (!db.objectStoreNames.contains(name)) {
            const s = db.createObjectStore(name, opts);
            (idxs||[]).forEach(i => s.createIndex(i,i));
          }
        };
        ensure('customers',        {keyPath:'id',autoIncrement:true}, ['name','phone']);
        ensure('factories',        {keyPath:'id',autoIncrement:true}, ['name','phone']);
        ensure('products',         {keyPath:'id',autoIncrement:true}, ['name']);
        ensure('transports',       {keyPath:'id',autoIncrement:true}, ['name']);
        ensure('sales',            {keyPath:'id',autoIncrement:true}, ['customerId','date']);
        ensure('salePayments',     {keyPath:'id',autoIncrement:true}, ['customerId','date']);
        ensure('purchases',        {keyPath:'id',autoIncrement:true}, ['factoryId','date']);
        ensure('purchasePayments', {keyPath:'id',autoIncrement:true}, ['factoryId','date']);
        ensure('settings',         {keyPath:'id'}, []);
      }
    });
    return _db;
  }

  async function getAll(store) { return (await open()).getAll(store); }

  async function getById(store, id) {
    const n = Number(id);
    if (!id || isNaN(n) || n <= 0) return null;
    return (await open()).get(store, n);
  }

  async function add(store, data) {
    localStorage.setItem('lastChangeTimestamp', Date.now());
    return (await open()).add(store, { ...data, createdAt: Date.now() });
  }

  async function update(store, data) {
    localStorage.setItem('lastChangeTimestamp', Date.now());
    return (await open()).put(store, data); 
  }
  async function remove(store, id) { 
    localStorage.setItem('lastChangeTimestamp', Date.now());
    return (await open()).delete(store, Number(id)); 
  }

  async function getByIndex(store, idx, val) {
    const n = Number(val);
    if (val === undefined || val === null || val === '' || isNaN(n)) return [];
    return (await open()).getAllFromIndex(store, idx, n);
  }

  async function getSetting(key)       { const r = await (await open()).get('settings', key); return r?.value ?? null; }
  async function setSetting(key, value){ return (await open()).put('settings', { id: key, value }); }

  async function nextBillNumber() {
    const n = (await getSetting('billCounter') || 0) + 1;
    await setSetting('billCounter', n);
    return `INV-${String(n).padStart(4,'0')}`;
  }

  async function customerBalance(customerId) {
    const cid = Number(customerId);
    if (!cid) return 0;
    const s = (await getByIndex('sales','customerId',cid)).reduce((a,r)=>a+(r.total||0),0);
    const p = (await getByIndex('salePayments','customerId',cid)).reduce((a,r)=>a+(r.amount||0),0);
    return s - p;
  }

  async function factoryBalance(factoryId) {
    const fid = Number(factoryId);
    if (!fid) return 0;
    const p = (await getByIndex('purchases','factoryId',fid)).reduce((a,r)=>a+(r.total||0),0);
    const py= (await getByIndex('purchasePayments','factoryId',fid)).reduce((a,r)=>a+(r.amount||0),0);
    return p - py;
  }

  async function exportAll() {
    const stores = ['customers','factories','products','transports','sales','salePayments','purchases','purchasePayments','settings'];
    const out = {};
    for (const s of stores) out[s] = await (await open()).getAll(s);
    return out;
  }

  async function importAll(data) {
    const stores = ['customers','factories','products','transports','sales','salePayments','purchases','purchasePayments','settings'];
    for (const s of stores) {
      if (!data[s]) continue;
      const tx = (await open()).transaction(s,'readwrite');
      await tx.store.clear();
      for (const row of data[s]) await tx.store.put(row);
      await tx.done;
    }
    localStorage.setItem('lastChangeTimestamp', Date.now());
  }

  async function clearAll() {
    const stores = ['customers','factories','products','transports','sales','salePayments','purchases','purchasePayments'];
    const d = await open();
    for (const s of stores) {
      const tx = d.transaction(s, 'readwrite');
      await tx.store.clear();
      await tx.done;
    }
    localStorage.setItem('lastChangeTimestamp', Date.now());
  }

  return { getAll, getById, add, update, remove, getByIndex, getSetting, setSetting, nextBillNumber, customerBalance, factoryBalance, exportAll, importAll, clearAll };
})();
