// ============================================================
// PDF.JS — PDF generation using jsPDF + autoTable
// ============================================================

const PDF = {

  _header(doc, title, sub, companyName) {
    doc.setFillColor(10, 15, 30);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text(companyName || 'Hisaab', 14, 14);

    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text(title, 210 - 14, 12, { align: 'right' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(sub || '', 210 - 14, 19, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  },

  async bill(saleId) {
    const { jsPDF } = window.jspdf;
    const sale      = await DB.getById('sales', saleId);
    if (!sale) return;
    const customer  = await DB.getById('customers', sale.customerId) || {};
    const transport = sale.transportId ? (await DB.getById('transports', sale.transportId) || {}) : {};

    // Support both old single-product and new items[] format
    const items = Array.isArray(sale.items)
      ? sale.items
      : [{ productName: (await DB.getById('products', sale.productId)||{}).name||'—', packing: sale.packing||'', units: sale.units||0, cost: sale.perUnitCost||0, total: sale.total||0 }];

    const company = await DB.getSetting('companyName');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    PDF._header(doc, sale.billNumber || 'Bill', fmtDate(sale.date), company);

    // Customer block
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('Bill To:', 14, 40);
    doc.setFont('helvetica', 'normal');
    doc.text(customer.name || '—', 14, 47);
    if (customer.city) doc.text(customer.city, 14, 53);
    if (customer.phone) doc.text(customer.phone, 14, 59);

    // Meta block
    doc.setFont('helvetica', 'bold');
    doc.text('Bill No:', 130, 40); doc.setFont('helvetica', 'normal'); doc.text(sale.billNumber||'—', 158, 40);
    doc.setFont('helvetica', 'bold');
    doc.text('Date:',   130, 47); doc.setFont('helvetica', 'normal'); doc.text(fmtDate(sale.date), 158, 47);
    if (sale.lrNumber) {
      doc.setFont('helvetica', 'bold');
      doc.text('LR No:', 130, 54); doc.setFont('helvetica', 'normal'); doc.text(sale.lrNumber, 158, 54);
    }

    doc.autoTable({
      startY: 68,
      head: [['Product', 'Packing', 'Units', 'Rate (Rs. )', 'Amount (Rs. )']],
      body: items.map(i => [i.productName||'', i.packing||'', String(i.units||''), String(i.cost||''), String(i.total||'')]),
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [99,102,241], textColor: 255 },
      columnStyles: { 2: {halign:'right'}, 3: {halign:'right'}, 4: {halign:'right'} },
      alternateRowStyles: { fillColor: [245,246,250] },
    });

    const finalY = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text(`Total: Rs. ${(sale.total||0).toLocaleString('en-IN')}`, 194, finalY, { align: 'right' });
    if (transport.name || sale.lrNumber) {
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(`Transport: ${transport.name||'—'}  |  LR: ${sale.lrNumber||'—'}`, 14, finalY);
    }
    doc.setFontSize(8); doc.setTextColor(120);
    const genDate = new Date().toLocaleString('en-IN', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});
    doc.text(`Generated on: ${genDate}`, 14, 285);
    const tsStr = new Date().toISOString().replace(/[:T]/g, '-').substring(0, 19);
    doc.save(`Bill-${sale.billNumber||saleId}_${tsStr}.pdf`);
    return doc;
  },

  async customerLedger(customerId, fromDate, toDate) {
    const { jsPDF } = window.jspdf;
    const customer  = await DB.getById('customers', customerId) || {};
    const allSales  = await DB.getByIndex('sales', 'customerId', Number(customerId));
    const allPayments = await DB.getByIndex('salePayments', 'customerId', Number(customerId));

    const inRange = arr => arr.filter(r => {
      const d = r.date;
      return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
    });

    const sales    = inRange(allSales).sort((a,b) => a.date.localeCompare(b.date));
    const payments = inRange(allPayments).sort((a,b) => a.date.localeCompare(b.date));
    const totalSales    = sales.reduce((s,r) => s + (r.total||0), 0);
    const totalPayments = payments.reduce((s,r) => s + (r.amount||0), 0);
    const outstanding   = totalSales - totalPayments;

    const company = await DB.getSetting('companyName');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const title = fromDate || toDate ? `${fromDate || ''}  to  ${toDate || ''}` : 'All Time';
    PDF._header(doc, 'Customer Ledger', title, company);

    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text(customer.name || '—', 14, 40);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    if (customer.city)  doc.text(customer.city,  14, 47);
    if (customer.phone) doc.text(customer.phone, 14, 53);

    // Bills table
    if (sales.length) {
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text('Bills', 14, 64);
      const billRows = [];
      for (const s of sales) {
        const items = Array.isArray(s.items) ? s.items : [{ productName: '—', packing: s.packing||'', units: s.units||0, cost: s.perUnitCost||0, total: s.total||0 }];
        items.forEach((it, idx) => billRows.push([idx===0?fmtDate(s.date):'', idx===0?s.billNumber||'—':'', it.productName||'—', it.packing||'—', it.units, it.cost, `Rs. ${(it.total||0).toLocaleString('en-IN')}`]));
      }
      doc.autoTable({
        startY: 68,
        head: [['Date','Bill No','Product','Packing','Units','Rate','Amount']],
        body: billRows,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [99,102,241], textColor: 255 },
        columnStyles: { 4: {halign:'right'}, 5: {halign:'right'}, 6: {halign:'right'} },
      });
    }

    let y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 68;

    // Payments table
    if (payments.length) {
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text('Payments Received', 14, y);
      doc.autoTable({
        startY: y + 4,
        head: [['Date','Amount','Mode','Txn ID']],
        body: payments.map(p => [fmtDate(p.date), `Rs. ${(p.amount||0).toLocaleString('en-IN')}`, p.mode||'—', p.transactionId||'—']),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [16,185,129], textColor: 255 },
        columnStyles: { 1: {halign:'right'} },
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    // Summary
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(`Total Billed:    Rs. ${totalSales.toLocaleString('en-IN')}`, 14, y);
    doc.text(`Total Received:  Rs. ${totalPayments.toLocaleString('en-IN')}`, 14, y + 7);
    doc.setFontSize(12);
    doc.setTextColor(outstanding > 0 ? 220 : 16, outstanding > 0 ? 38 : 185, outstanding > 0 ? 38 : 129);
    doc.text(`Outstanding: Rs. ${outstanding.toLocaleString('en-IN')}`, 14, y + 16);

    doc.setFontSize(8); doc.setTextColor(120);
    const genDate = new Date().toLocaleString('en-IN', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});
    doc.text(`Generated on: ${genDate}`, 14, 285);

    const tsStr = new Date().toISOString().replace(/[:T]/g, '-').substring(0, 19);
    doc.save(`Ledger-${customer.name || customerId}_${tsStr}.pdf`);
  },

  async factoryLedger(factoryId, fromDate, toDate) {
    const { jsPDF } = window.jspdf;
    const factory   = await DB.getById('factories', factoryId) || {};
    const allPurch  = await DB.getByIndex('purchases', 'factoryId', Number(factoryId));
    const allPayments = await DB.getByIndex('purchasePayments', 'factoryId', Number(factoryId));

    const inRange = arr => arr.filter(r => {
      const d = r.date;
      return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
    });

    const purchases = inRange(allPurch).sort((a,b) => a.date.localeCompare(b.date));
    const payments  = inRange(allPayments).sort((a,b) => a.date.localeCompare(b.date));
    const totalPurch    = purchases.reduce((s,r) => s + (r.total||0), 0);
    const totalPayments = payments.reduce((s,r) => s + (r.amount||0), 0);
    const outstanding   = totalPurch - totalPayments;

    const company = await DB.getSetting('companyName');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const title = fromDate || toDate ? `${fromDate || ''} to ${toDate || ''}` : 'All Time';
    PDF._header(doc, 'Factory Ledger', title, company);

    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text(factory.name || '—', 14, 40);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    if (factory.phone) doc.text(factory.phone, 14, 47);

    if (purchases.length) {
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text('Purchases', 14, 58);
      const purchRows = [];
      for (const p of purchases) {
        const items = Array.isArray(p.items) ? p.items : [{ productName:'—', packing:p.packing||'', units:p.units||0, cost:p.perUnitCost||0, total:p.total||0 }];
        items.forEach((it,idx) => purchRows.push([idx===0?fmtDate(p.date):'', it.productName||'—', it.packing||'—', it.units, it.cost, `Rs. ${(it.total||0).toLocaleString('en-IN')}`]));
      }
      doc.autoTable({
        startY: 62,
        head: [['Date','Product','Packing','Units','Rate','Amount']],
        body: purchRows,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [14,165,233], textColor: 255 },
        columnStyles: { 3: {halign:'right'}, 4: {halign:'right'}, 5: {halign:'right'} },
      });
    }

    let y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 68;

    if (payments.length) {
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text('Payments Made', 14, y);
      doc.autoTable({
        startY: y + 4,
        head: [['Date','Amount','Mode','Txn ID']],
        body: payments.map(p => [fmtDate(p.date), `Rs. ${(p.amount||0).toLocaleString('en-IN')}`, p.mode||'—', p.transactionId||'—']),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [239,68,68], textColor: 255 },
        columnStyles: { 1: {halign:'right'} },
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(`Total Purchased: Rs. ${totalPurch.toLocaleString('en-IN')}`, 14, y);
    doc.text(`Total Paid:      Rs. ${totalPayments.toLocaleString('en-IN')}`, 14, y + 7);
    doc.setFontSize(12);
    doc.setTextColor(outstanding > 0 ? 220 : 16, outstanding > 0 ? 38 : 185, outstanding > 0 ? 38 : 129);
    doc.text(`Due to Factory: Rs. ${outstanding.toLocaleString('en-IN')}`, 14, y + 16);

    doc.setFontSize(8); doc.setTextColor(120);
    const genDate = new Date().toLocaleString('en-IN', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});
    doc.text(`Generated on: ${genDate}`, 14, 285);

    const tsStr = new Date().toISOString().replace(/[:T]/g, '-').substring(0, 19);
    doc.save(`Factory-${factory.name || factoryId}_${tsStr}.pdf`);
  },

  // Share via Web Share API (fallback: download)
  async share(saleId) {
    const sale = await DB.getById('sales', saleId); if (!sale) return;
    const { jsPDF } = window.jspdf;
    const customer  = await DB.getById('customers', sale.customerId) || {};
    const transport = sale.transportId ? (await DB.getById('transports', sale.transportId) || {}) : {};
    const items = Array.isArray(sale.items) ? sale.items
      : [{ productName: (await DB.getById('products', sale.productId)||{}).name||'—', packing: sale.packing||'', units: sale.units||0, cost: sale.perUnitCost||0, total: sale.total||0 }];
    const company = await DB.getSetting('companyName');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    PDF._header(doc, sale.billNumber||'Bill', fmtDate(sale.date), company);
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.text('Bill To:', 14, 40); doc.setFont('helvetica','normal');
    doc.text(customer.name||'—', 14, 47); if(customer.city) doc.text(customer.city, 14, 53); if(customer.phone) doc.text(customer.phone, 14, 59);
    doc.setFont('helvetica','bold'); doc.text('Bill No:',130,40); doc.setFont('helvetica','normal'); doc.text(sale.billNumber||'—',158,40);
    doc.setFont('helvetica','bold'); doc.text('Date:',130,47);   doc.setFont('helvetica','normal'); doc.text(fmtDate(sale.date),158,47);
    doc.autoTable({ startY:68, head:[['Product','Packing','Units','Rate (Rs. )','Amount (Rs. )']], body:items.map(i=>[i.productName||'',i.packing||'',String(i.units||''),String(i.cost||''),String(i.total||'')]), styles:{fontSize:10,cellPadding:4}, headStyles:{fillColor:[99,102,241],textColor:255}, columnStyles: { 2: {halign:'right'}, 3: {halign:'right'}, 4: {halign:'right'} } });
    const fy = doc.lastAutoTable.finalY+8;
    doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.text(`Total: Rs. ${(sale.total||0).toLocaleString('en-IN')}`, 194, fy, { align: 'right' });
    doc.setFontSize(8); doc.setTextColor(120); 
    const genDate = new Date().toLocaleString('en-IN', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});
    doc.text(`Generated on: ${genDate}`,14,285);
    const fileName = `Bill-${sale.billNumber||saleId}.pdf`;
    const blob = doc.output('blob');
    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([blob], fileName, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files:[file], title:fileName }); return; }
      } catch(e) { if (e.name==='AbortError') return; }
    }
    // Fallback download
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=fileName; a.click(); URL.revokeObjectURL(url);
  }
};
