import PDFDocument from 'pdfkit';
import fs from 'fs';

function formatCurrency(n) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2 });
}

function generateInvoice(path) {
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  const stream = fs.createWriteStream(path);
  doc.pipe(stream);

  // sample data (you can edit values below)
  const invoiceNumber = 'inv-0001';
  const today = new Date().toISOString().slice(0,10);
  const customer = {
    name: 'john doe',
    address: '123 main st, colombo',
    contact: '+94 77 123 4567'
  };

  const items = [
    { itemno: 1, count: 1, brand: 'canon', part: 'p-1001', model: 'm-01', description: 'printer ink cartridge', qty: 2, total: 3000.00 },
    { itemno: 2, count: 2, brand: 'hp', part: 'p-2002', model: 'm-02', description: 'laptop charger', qty: 1, total: 2500.00 },
    { itemno: 3, count: 1, brand: 'dell', part: 'p-3003', model: 'm-03', description: 'hard drive 1tb', qty: 1, total: 10000.00 }
  ];

  const subtotal = items.reduce((s,i)=>s + (i.total || 0), 0);
  const discount = 500.00;
  const grandTotal = subtotal - discount;

  // header
  // logo (if available)
  try {
    doc.image('/Users/sanjulathilan/Documents/GitHub/Automodeal_Sales_managemnet_System/public/logo.JPG', 50, 40, { width: 80 });
  } catch (e) {
    // fallback text if image not found
    doc.fontSize(10).text('[logo]', 50, 48);
  }
  doc.font('Helvetica-Bold').fontSize(14).text('automodeal (pvt) ltd', 150, 48);

  // invoice number / date
  doc.font('Helvetica').fontSize(9).text('invoice number: ' + invoiceNumber, 400, 48, { align: 'left' });
  doc.text('date: ' + today, 400, 64);

  // customer details
  doc.moveDown(1);
  doc.font('Helvetica-Bold').fontSize(10).text('customer details:', 50, 120);
  doc.font('Helvetica').fontSize(9).text('- name: ' + customer.name, 50, 136);
  doc.text('- address: ' + customer.address, 50, 150);
  doc.text('- contact: ' + customer.contact, 50, 164);

  // table header
  const tableTop = 200;
  const col = {
    // removed itemno column; shifted columns left
    count: 50,
    brand: 100,
    part: 180,
    model: 260,
    description: 330,
    qty: 450,
    total: 490
  };

  doc.moveTo(40, tableTop-6).lineTo(555, tableTop-6).stroke('#e5e7eb');
  doc.font('Helvetica-Bold').fontSize(9).text('count', col.count, tableTop);
  doc.text('brand', col.brand, tableTop);
  doc.text('part no.', col.part, tableTop);
  doc.text('model', col.model, tableTop);
  doc.text('description', col.description, tableTop);
  doc.text('qty', col.qty, tableTop, { width: 40, align: 'right' });
  doc.text('total', col.total, tableTop, { width: 80, align: 'right' });
  doc.moveTo(40, tableTop+16).lineTo(555, tableTop+16).stroke('#e5e7eb');

  // table rows
  let y = tableTop + 24;
  doc.font('Helvetica').fontSize(9);
  items.forEach(it => {
    // itemno removed
    doc.text(String(it.count), col.count, y);
    doc.text(it.brand, col.brand, y);
    doc.text(it.part, col.part, y);
    doc.text(it.model, col.model, y);
    doc.text(it.description, col.description, y, { width: 110 });
    doc.text(String(it.qty), col.qty, y, { width: 30, align: 'right' });
    doc.text(formatCurrency(it.total), col.total, y, { width: 60, align: 'right' });

    // row underline
    y += 20;
    doc.moveTo(40, y-6).lineTo(555, y-6).stroke('#f1f5f9');
  });

  // totals inside table area
  y += 6;
  doc.moveTo(40, y-6).lineTo(555, y-6).stroke('#e5e7eb');
  y += 8;
  // subtotal row
  doc.font('Helvetica').fontSize(9).text('subtotal :', col.description, y, { width: col.total - col.description, align: 'right' });
  doc.text(formatCurrency(subtotal), col.total, y, { width: 80, align: 'right' });
  y += 14;
  // discount row
  doc.text('discount :', col.description, y, { width: col.total - col.description, align: 'right' });
  doc.text(formatCurrency(discount), col.total, y, { width: 80, align: 'right' });
  y += 16;
  // grand total row
  doc.font('Helvetica-Bold').fontSize(11).text('grand total :', col.description, y, { width: col.total - col.description, align: 'right' });
  doc.text(formatCurrency(grandTotal), col.total, y, { width: 80, align: 'right' });

  // footer
  doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text('Generate Using Automodeal Sales Management Application | Developed by Novalink innovations www.novalinkinnovations.com', 48, 780, { align: 'center', width: 504 });

  doc.end();

  stream.on('finish', () => {
    console.log('invoice generated at', path);
  });
}

const outpath = new URL('../generated_invoice_A4.pdf', import.meta.url).pathname;
generateInvoice(outpath);
