import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("sales_management.db");

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  app.use(express.json());

  // Ensure users table exists and seed admin user if missing
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'Admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  const admin = db.prepare("SELECT * FROM users WHERE email = ?").get('admin@sms.com');
  if (!admin) {
    db.prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)").run('System Admin', 'admin@sms.com', 'admin123', 'Admin');
  }

  // Auth
  app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Missing credentials' });
    try {
      const user = db.prepare('SELECT id, name, email, role FROM users WHERE email = ? AND password = ?').get(email, password);
      if (user) return res.json({ success: true, user });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // Products
  app.get("/api/products", (req, res) => {
    const products = db.prepare("SELECT * FROM products").all();
    res.json(products);
  });

  app.post("/api/products", (req, res) => {
    const { product_code, description, unit_price, min_stock_threshold } = req.body;
    try {
      const result = db.prepare("INSERT INTO products (product_code, description, unit_price, min_stock_threshold) VALUES (?, ?, ?, ?)").run(
        product_code, description, unit_price, min_stock_threshold
      );
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // Customers table - ensure exists and basic CRUD endpoints
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      company_name TEXT,
      address TEXT,
      contact_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  app.get('/api/customers', (req, res) => {
    try {
      const customers = db.prepare('SELECT * FROM customers ORDER BY id DESC').all();
      res.json(customers);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/customers', (req, res) => {
    const { customer_name, company_name, address, contact_number } = req.body;
    if (!customer_name) return res.status(400).json({ success: false, message: 'customer_name is required' });
    try {
      const result = db.prepare('INSERT INTO customers (customer_name, company_name, address, contact_number) VALUES (?, ?, ?, ?)').run(
        customer_name, company_name || '', address || '', contact_number || ''
      );
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.put('/api/customers/:id', (req, res) => {
    const { id } = req.params;
    const { customer_name, company_name, address, contact_number } = req.body;
    try {
      const info = db.prepare('UPDATE customers SET customer_name = ?, company_name = ?, address = ?, contact_number = ? WHERE id = ?').run(
        customer_name, company_name || '', address || '', contact_number || '', id
      );
      if (info.changes === 0) return res.status(404).json({ success: false, message: 'Customer not found' });
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/customers/:id', (req, res) => {
    const { id } = req.params;
    try {
      const info = db.prepare('DELETE FROM customers WHERE id = ?').run(id);
      if (info.changes === 0) return res.status(404).json({ success: false, message: 'Customer not found' });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // GRN (Goods Received Note)
  app.post("/api/grn", (req, res) => {
    const { grn_number, supplier_name, date_received, items } = req.body;
    const total_amount = items.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0);

    const transaction = db.transaction(() => {
      const grnResult = db.prepare("INSERT INTO grn (grn_number, supplier_name, date_received, total_amount) VALUES (?, ?, ?, ?)").run(
        grn_number, supplier_name, date_received, total_amount
      );
      const grnId = grnResult.lastInsertRowid;

      for (const item of items) {
        db.prepare("INSERT INTO grn_items (grn_id, product_code, product_description, model, brand, quantity_received, price_per_unit, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
          grnId, item.product_code, item.description, item.model, item.brand, item.quantity, item.price, item.quantity * item.price
        );

        // Update stock
        const product = db.prepare("SELECT * FROM products WHERE product_code = ?").get(item.product_code);
        if (product) {
          db.prepare("UPDATE products SET current_stock = current_stock + ?, model = ?, brand = ?, description = ? WHERE product_code = ?").run(item.quantity, item.model, item.brand, item.description, item.product_code);
        } else {
          // Create product if it doesn't exist
          db.prepare("INSERT INTO products (product_code, description, model, brand, unit_price, current_stock) VALUES (?, ?, ?, ?, ?, ?)").run(
            item.product_code, item.description, item.model, item.brand, item.price, item.quantity
          );
        }
      }
      return grnId;
    });

    try {
      const grnId = transaction();
      res.json({ success: true, grnId });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // Sales Invoice
  app.get("/api/sales/invoices/:number", (req, res) => {
    const { number } = req.params;
    const invoice = db.prepare(`
      SELECT si.*, c.customer_name, c.company_name, c.address, c.contact_number, c.id as customer_id
      FROM sales_invoices si
      LEFT JOIN customers c ON si.customer_id = c.id
      WHERE si.invoice_number = ?
    `).get(number);

    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    const items = db.prepare(`
      SELECT sii.*, p.product_code, p.description, p.model, p.brand, p.id as product_id
      FROM sales_invoice_items sii
      JOIN products p ON sii.product_id = p.id
      WHERE sii.invoice_id = ?
    `).all(invoice.id);

    res.json({ ...invoice, items });
  });

  // PDF Generation
  app.get("/api/sales/invoice/:id/pdf", async (req, res) => {
    const { id } = req.params;

    const invoice = db.prepare(`
      SELECT si.*, c.customer_name, c.company_name, c.address, c.contact_number
      FROM sales_invoices si
      LEFT JOIN customers c ON si.customer_id = c.id
      WHERE si.id = ?
    `).get(id);

    if (!invoice) return res.status(404).send("Invoice not found");

    const items = db.prepare(`
      SELECT sii.*, p.product_code, p.description, p.model, p.brand
      FROM sales_invoice_items sii
      JOIN products p ON sii.product_id = p.id
      WHERE sii.invoice_id = ?
    `).all(id);

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const filename = `Invoice_${invoice.invoice_number}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    // Compute page layout
    const pageWidth = doc.page.width;
    const pageMargin = (doc.page.margins && doc.page.margins.left) ? doc.page.margins.left : 50;
    const usableWidth = pageWidth - pageMargin * 2;

    // Columns to match sample: No | Brand | Part no | Model | Description | Qty | Total
    const colWidths = {
      no: 40,
      brand: 90,
      part: 90,
      model: 80,
      qty: 60,
      total: 110,
      desc: Math.max(usableWidth - (40 + 90 + 90 + 80 + 60 + 110), 250)
    } as any;

    const colX: any = {};
    colX.no = pageMargin;
    colX.brand = colX.no + colWidths.no;
    colX.part = colX.brand + colWidths.brand;
    colX.model = colX.part + colWidths.part;
    colX.desc = colX.model + colWidths.model;
    colX.qty = colX.desc + colWidths.desc;
    colX.total = colX.qty + colWidths.qty;

    const headerHeight = 40;

    const drawHeader = (pageNum: number) => {
      const logoPath = path.join(__dirname, 'dist', 'logo.JPG');
      const logoExists = fs.existsSync(logoPath);
      if (logoExists) {
        try {
          doc.image(logoPath, pageMargin, 36, { width: 90, height: 60 });
        } catch (e) {}
      }

      // Address box to the right of logo
      const addrX = pageMargin + (logoExists ? 100 : 0);
      const addrY = 36;
      const addrW = 300;
      const addrH = 60;
      // draw subtle border for address box (no background)
      doc.save();
      doc.lineWidth(0.5).strokeColor('#e5e7eb').rect(addrX, addrY, addrW, addrH).stroke();
      doc.restore();
      doc.fillColor('#0b2545').font('Helvetica-Bold').fontSize(12).text('automodeal (Pvt) Ltd', addrX + 8, addrY + 6);
      doc.font('Helvetica').fontSize(9).fillColor('#52525b');
      doc.text('250/12 Makola South, Makola', addrX + 8, addrY + 26);
      doc.text('Tel: +94 777384343 | +94 703384343', addrX + 8, addrY + 40);

      // Invoice small boxes (top-right)
      const boxW = 120;
      const boxH = 28;
      const rightX = pageWidth - pageMargin - boxW;
      // invoice number box - no background, use light border
      doc.save();
      doc.lineWidth(0.5).strokeColor('#e5e7eb').rect(rightX, 40, boxW, boxH).stroke();
      doc.restore();
      doc.fillColor('#71717a').font('Helvetica').fontSize(9).text('Invoice Number', rightX + 8, 44);
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(11).text(invoice.invoice_number, rightX + 8, 56);

      // date box - no background, use light border
      doc.save();
      doc.lineWidth(0.5).strokeColor('#e5e7eb').rect(rightX, 40 + boxH + 8, boxW, boxH).stroke();
      doc.restore();
      doc.fillColor('#71717a').font('Helvetica').fontSize(9).text('Date', rightX + 8, 44 + boxH + 8);
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(11).text(new Date(invoice.date_of_sale).toLocaleDateString(), rightX + 8, 56 + boxH + 8);

      // Title centered-left area
      doc.fillColor('#0b2545').font('Helvetica-Bold').fontSize(22).text('INVOICE', pageMargin + addrW + 20, 48);

      // Customer details box on first page
      if (pageNum === 1) {
        const custX = pageMargin;
        const custY = addrY + addrH + 18;
        const custW = 420;
        const custH = 60;
        // customer details box: keep layout but remove background fill
        doc.save();
        doc.lineWidth(0.5).strokeColor('#e5e7eb').rect(custX, custY, custW, custH).stroke();
        doc.restore();
        doc.fillColor('#71717a').font('Helvetica-Bold').fontSize(10).text('CUSTOMER DETAILS', custX + 10, custY + 8);
        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(12).text(invoice.customer_name || '-', custX + 10, custY + 26, { width: custW - 20 });
        if (invoice.company_name) {
          doc.font('Helvetica').fontSize(10).fillColor('#52525b').text(invoice.company_name, custX + 10, custY + 42, { width: custW - 20 });
        } else {
          doc.font('Helvetica').fontSize(10).fillColor('#52525b').text(invoice.address || '-', custX + 10, custY + 42, { width: custW - 20 });
        }
      }
    };

    const drawTableHeader = (y: number) => {
      // header - no background fill, keep header text and borders
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(10);
      const textY = y + 12;
      const pad = 6;
      doc.text('No', colX.no + pad, textY, { width: colWidths.no - pad, align: 'left' });
      doc.text('Brand', colX.brand + pad, textY, { width: colWidths.brand - pad, align: 'left' });
      doc.text('Part no', colX.part + pad, textY, { width: colWidths.part - pad, align: 'left' });
      doc.text('Model', colX.model + pad, textY, { width: colWidths.model - pad, align: 'left' });
      doc.text('Description', colX.desc + pad, textY, { width: colWidths.desc - pad, align: 'left' });
      doc.text('Qty', colX.qty, textY, { width: colWidths.qty - pad, align: 'center' });
      doc.text('Total', colX.total - 6, textY, { width: colWidths.total, align: 'right' });

      // top/bottom border and vertical separators
      doc.moveTo(pageMargin, y).lineTo(pageMargin + usableWidth, y).strokeColor('#e5e7eb').lineWidth(1).stroke();
      doc.moveTo(pageMargin, y + headerHeight).lineTo(pageMargin + usableWidth, y + headerHeight).strokeColor('#e5e7eb').lineWidth(1).stroke();
      [colX.brand, colX.part, colX.model, colX.desc, colX.qty, colX.total].forEach(x => {
        doc.moveTo(x, y).lineTo(x, y + headerHeight).strokeColor('#e5e7eb').lineWidth(1).stroke();
      });
    };

    let currentPage = 1;
    drawHeader(currentPage);
    // compute table start after header & customer box
    let tableTop = 180;
    drawTableHeader(tableTop);
    let currentY = tableTop + headerHeight;
    let totalQty = 0;

    items.forEach((item, index) => {
      doc.fontSize(9);
      const descText = item.description || item.product_code || '-';
      const descHeight = doc.heightOfString(descText, { width: colWidths.desc - 10 });
      const rowHeight = Math.max(28, descHeight + 12);

      const bottomBoundary = doc.page.height - (doc.page.margins && doc.page.margins.bottom ? doc.page.margins.bottom : 50) - 160;
      if (currentY + rowHeight > bottomBoundary) {
        doc.addPage();
        currentPage++;
        drawHeader(currentPage);
        currentY = 140;
        drawTableHeader(currentY);
        currentY += headerHeight;
      }

      const cellPad = 6;
      // row contents
      doc.fillColor('#111827').font('Helvetica').fontSize(9);
      doc.text(String(index + 1), colX.no + cellPad, currentY + 8, { width: colWidths.no - cellPad, align: 'left' });
      doc.text(item.brand || '-', colX.brand + cellPad, currentY + 8, { width: colWidths.brand - cellPad, align: 'left' });
      doc.text(item.product_code || '-', colX.part + cellPad, currentY + 8, { width: colWidths.part - cellPad, align: 'left' });
      doc.text(item.model || '-', colX.model + cellPad, currentY + 8, { width: colWidths.model - cellPad, align: 'left' });
      doc.text(descText, colX.desc + 6, currentY + 8, { width: colWidths.desc - 10 });
      doc.text(String(item.quantity_sold), colX.qty, currentY + 8, { width: colWidths.qty, align: 'center' });
      const amount = (item.total !== undefined) ? item.total : (item.quantity_sold * item.unit_price);
      doc.font('Courier').text(amount.toLocaleString(undefined, { minimumFractionDigits: 2 }), colX.total - 6, currentY + 8, { width: colWidths.total, align: 'right' });

      // row bottom border and vertical grid lines
      const ruleEndXRow = pageMargin + usableWidth;
      doc.moveTo(pageMargin, currentY + rowHeight).lineTo(ruleEndXRow, currentY + rowHeight).strokeColor('#e5e7eb').lineWidth(1).stroke();
      [colX.no, colX.brand, colX.part, colX.model, colX.desc, colX.qty, colX.total, pageMargin + usableWidth].forEach(x => {
        doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).strokeColor('#e5e7eb').lineWidth(1).stroke();
      });

      totalQty += item.quantity_sold;
      currentY += rowHeight;
      doc.font('Helvetica');
    });

    // draw rounded border around table area
    try {
      const tableHeight = currentY - tableTop + 6;
      if (typeof (doc as any).roundedRect === 'function') {
        (doc as any).roundedRect(pageMargin, tableTop - 6, usableWidth, tableHeight, 6).stroke('#e5e7eb');
      } else {
        doc.rect(pageMargin, tableTop - 6, usableWidth, tableHeight).stroke('#e5e7eb');
      }
    } catch (e) {}

    // Totals area - ensure space
    const totalsNeededHeight = 160;
    const pageBottom = doc.page.height - (doc.page.margins && doc.page.margins.bottom ? doc.page.margins.bottom : 50);
    if (currentY + totalsNeededHeight > pageBottom) {
      doc.addPage();
      drawHeader(++currentPage);
      currentY = 140;
    }

    currentY += 12;
    const subtotal = items.reduce((s: number, it: any) => s + ((it.total !== undefined) ? it.total : (it.quantity_sold * it.unit_price)), 0);
    const discountVal = invoice.discount || 0;
    const salesTaxPercent = invoice.sales_tax_percent || invoice.sales_tax || 0;
    const taxableBase = subtotal - discountVal;
    const salesTaxAmount = salesTaxPercent ? +(taxableBase * (salesTaxPercent / 100)) : 0;
    const grandTotal = +(subtotal - discountVal + salesTaxAmount);

    // Totals grey box on right
    const totalsBoxW = 320;
    const totalsBoxH = 110;
    const totalsBoxX = pageWidth - pageMargin - totalsBoxW;
    const totalsBoxY = currentY;
    // totals box - remove background, draw subtle border
    doc.save();
    doc.lineWidth(0.5).strokeColor('#e5e7eb').rect(totalsBoxX, totalsBoxY, totalsBoxW, totalsBoxH).stroke();
    doc.restore();
    const labelX = totalsBoxX + 12;
    const valueX = totalsBoxX + totalsBoxW - 12;
    doc.fillColor('#71717a').font('Helvetica').fontSize(10).text('Subtotal', labelX, totalsBoxY + 12, { width: totalsBoxW - 24, align: 'left' });
    doc.fillColor('#111827').font('Courier').fontSize(10).text(subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 }), labelX, totalsBoxY + 12, { width: totalsBoxW - 24, align: 'right' });

    doc.fillColor('#71717a').font('Helvetica').fontSize(10).text('Discount', labelX, totalsBoxY + 34, { width: totalsBoxW - 24, align: 'left' });
    doc.fillColor('#111827').font('Courier').fontSize(10).text(discountVal.toLocaleString(undefined, { minimumFractionDigits: 2 }), labelX, totalsBoxY + 34, { width: totalsBoxW - 24, align: 'right' });

    if (salesTaxAmount > 0) {
      doc.fillColor('#71717a').font('Helvetica').fontSize(10).text(`Sales Tax (${salesTaxPercent}%)`, labelX, totalsBoxY + 56, { width: totalsBoxW - 24, align: 'left' });
      doc.fillColor('#111827').font('Courier').fontSize(10).text(salesTaxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }), labelX, totalsBoxY + 56, { width: totalsBoxW - 24, align: 'right' });
    }

    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(12).text('GRAND TOTAL', labelX, totalsBoxY + totalsBoxH - 34);
    doc.fillColor('#111827').font('Courier-Bold').fontSize(16).text(grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 }), labelX, totalsBoxY + totalsBoxH - 34, { width: totalsBoxW - 24, align: 'right' });

    // Total Quantity box below
    const qtyBoxW = 300;
    const qtyBoxH = 28;
    const qtyBoxX = pageMargin;
    const qtyBoxY = totalsBoxY + totalsBoxH - 8;
    // total qty box - border only for a cleaner look
    doc.save();
    doc.lineWidth(0.5).strokeColor('#e5e7eb').rect(qtyBoxX, qtyBoxY, qtyBoxW, qtyBoxH).stroke();
    doc.restore();
    doc.fillColor('#71717a').font('Helvetica-Bold').fontSize(9).text('TOTAL QTY', qtyBoxX + 10, qtyBoxY + 6);
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(12).text(String(totalQty), qtyBoxX + qtyBoxW - 40, qtyBoxY + 4);

    // Footer
    const footerY = doc.page.height - 60;
    doc.fillColor('#a1a1aa').fontSize(8).text('Generate Using Automodeal Sales Management Application | Developed by Novalink innovations www.novalinkinnovations.com', pageMargin, footerY, { align: 'center', width: pageWidth - pageMargin * 2 });

    doc.end();
  });

  app.get("/api/credit-notes/:id/pdf", async (req, res) => {
    const { id } = req.params;

    const cn = db.prepare(`
      SELECT cn.*, c.customer_name, c.company_name, c.address, c.contact_number, si.invoice_number as original_invoice_number
      FROM credit_notes cn
      LEFT JOIN customers c ON cn.customer_id = c.id
      LEFT JOIN sales_invoices si ON cn.invoice_id = si.id
      WHERE cn.id = ?
    `).get(id);

    if (!cn) return res.status(404).send("Credit Note not found");

    const items = db.prepare(`SELECT * FROM credit_note_items WHERE credit_note_id = ?`).all(id);

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const filename = `CreditNote_${cn.credit_note_number}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    const pageWidth = doc.page.width;
    const pageMargin = (doc.page.margins && doc.page.margins.left) ? doc.page.margins.left : 50;
    const usableWidth = pageWidth - pageMargin * 2;
    const colWidths = {
      no: 30,
      part: 60,
      desc: 170,
      brand: 50,
      model: 50,
      qty: 40,
      price: 60,
      total: usableWidth - (30 + 60 + 170 + 50 + 50 + 40 + 60)
    } as any;
    const colX: any = {};
    colX.no = pageMargin;
    colX.part = colX.no + colWidths.no;
    colX.desc = colX.part + colWidths.part;
    colX.brand = colX.desc + colWidths.desc;
    colX.model = colX.brand + colWidths.brand;
    colX.qty = colX.model + colWidths.model;
    colX.price = colX.qty + colWidths.qty;
    colX.total = colX.price + colWidths.price;
    const headerHeight = 28;

    const drawHeader = (pageNum: number) => {
      // Company Info (Top Left) - include logo if available and use smaller company name
      const logoPath = path.join(__dirname, 'dist', 'logo.JPG');
      const logoExists = fs.existsSync(logoPath);
      if (logoExists) {
        try {
          doc.image(logoPath, pageMargin, 40, { width: 80, height: 50, align: 'left' });
        } catch (e) {
          // ignore image errors
        }
      }

      const textStartX = pageMargin + (logoExists ? 90 : 0);
      doc.fillColor("#18181b").font("Helvetica-Bold").fontSize(12).text("automodeal (Pvt) Ltd", textStartX, 45);
      doc.font("Helvetica").fontSize(9).fillColor("#52525b");
      doc.text("250/12 Makola South, Makola", textStartX, 62);
      doc.text("Tel: +94 777384343 | Tel: +94 703384343", textStartX, 75);

      doc.fillColor("#18181b").font("Helvetica-Bold").fontSize(22).text("CREDIT NOTE", pageWidth - pageMargin - 160, 45, { align: "right" });
      doc.fontSize(10).fillColor("#71717a").text("Credit Note Number", 380, 75, { align: "right" });
      doc.fillColor("#18181b").fontSize(12).text(cn.credit_note_number, 380, 88, { align: "right" });
      doc.fontSize(10).fillColor("#71717a").text("Original Invoice", 380, 105, { align: "right" });
      doc.fillColor("#18181b").fontSize(12).text(cn.original_invoice_number, 380, 118, { align: "right" });

      if (pageNum === 1) {
        // Client details only on first page - Dynamic height to avoid overlay
        let clientY = 160;
        doc.fillColor("#71717a").font("Helvetica-Bold").fontSize(10).text("BILL TO", 50, clientY);
        doc.rect(50, clientY + 12, 20, 2).fill("#18181b");
        clientY += 25;

        doc.fillColor("#18181b").font("Helvetica-Bold").fontSize(13).text(cn.customer_name, 50, clientY, { width: 250 });
        doc.fontSize(13);
        clientY += doc.heightOfString(cn.customer_name, { width: 250 }) + 5;

        doc.font("Helvetica").fontSize(10).fillColor("#52525b");
        const address = cn.address || "N/A";
        doc.text(address, 50, clientY, { width: 250 });
        doc.fontSize(10);
        clientY += doc.heightOfString(address, { width: 250 }) + 3;

        doc.text(cn.contact_number || "N/A", 50, clientY, { width: 250 });
      }
    };

    const drawTableHeader = (y: number) => {
      // table header - no background fill, use bold dark text
      doc.fillColor("#111827").font("Helvetica-Bold").fontSize(9);
      const textY = y + 8;
      const pad = 6;
      doc.text("No", colX.no + pad, textY, { width: colWidths.no - pad, align: 'left' });
      doc.text("Part No", colX.part + pad, textY, { width: colWidths.part - pad, align: 'left' });
      doc.text("Description", colX.desc + pad, textY, { width: colWidths.desc - pad, align: 'left' });
      doc.text("Brand", colX.brand + pad, textY, { width: colWidths.brand - pad, align: 'left' });
      doc.text("Model", colX.model + pad, textY, { width: colWidths.model - pad, align: 'left' });
      doc.text("QTY", colX.qty, textY, { width: colWidths.qty - pad, align: 'center' });
      doc.text("Price", colX.price, textY, { width: colWidths.price - pad, align: 'right' });
      doc.text("Total", colX.total, textY, { width: colWidths.total - pad, align: 'right' });
    };

    let currentPage = 1;
    drawHeader(currentPage);
    // Increased tableTop to accommodate dynamic header/bill-to section
    let tableTop = 320;
    drawTableHeader(tableTop);
    let currentY = tableTop + 25;
    let totalQty = 0;

    items.forEach((item, index) => {
      // Dynamic row height to prevent overlay and handle long descriptions
      doc.fontSize(8);
      const descHeight = doc.heightOfString(item.description || "", { width: colWidths.desc - 6 });
      const rowHeight = Math.max(25, descHeight + 12);

      const bottomBoundary = doc.page.height - (doc.page.margins && doc.page.margins.bottom ? doc.page.margins.bottom : 50) - 140;
      if (currentY + rowHeight > bottomBoundary) {
        doc.addPage();
        currentPage++;
        drawHeader(currentPage);
        currentY = 160; // Start higher on subsequent pages since no BILL TO section
        drawTableHeader(currentY);
        currentY += headerHeight;
      }

      // no row background fills for a cleaner look
      doc.fillColor("#18181b").font("Helvetica").fontSize(8);
      const cellPad = 6;
      doc.text(String(index + 1), colX.no + cellPad, currentY + 8, { width: colWidths.no - cellPad, align: 'left' });
      doc.text(item.part_number || "-", colX.part + cellPad, currentY + 8, { width: colWidths.part - cellPad, ellipsis: true });
      doc.text(item.description || "-", colX.desc + cellPad, currentY + 8, { width: colWidths.desc - cellPad }); // Allow wrap
      doc.text(item.brand || "-", colX.brand + cellPad, currentY + 8, { width: colWidths.brand - cellPad, ellipsis: true });
      doc.text(item.model || "-", colX.model + cellPad, currentY + 8, { width: colWidths.model - cellPad, ellipsis: true });
      doc.text(String(item.quantity), colX.qty, currentY + 8, { width: colWidths.qty - cellPad, align: 'center' });
      doc.text(item.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 }), colX.price, currentY + 8, { width: colWidths.price - cellPad, align: 'right' });
      doc.text(item.total_value.toLocaleString(undefined, { minimumFractionDigits: 2 }), colX.total, currentY + 8, { width: colWidths.total - cellPad, align: 'right' });
      const ruleEndXRow = pageMargin + usableWidth;
      doc.moveTo(pageMargin, currentY + rowHeight).lineTo(ruleEndXRow, currentY + rowHeight).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
      totalQty += item.quantity;
      currentY += rowHeight;
    });

    const totalsNeededHeight = 180;
    const pageBottom = doc.page.height - (doc.page.margins && doc.page.margins.bottom ? doc.page.margins.bottom : 50);
    if (currentY + totalsNeededHeight > pageBottom) {
      doc.addPage();
      drawHeader(++currentPage);
      currentY = 160;
    }

    const totalsAreaX = colX.price;
    const totalsAreaWidth = pageWidth - pageMargin - totalsAreaX;
    const labelWidth = Math.floor(totalsAreaWidth * 0.62);
    const amountWidth = Math.floor(totalsAreaWidth * 0.38);
    currentY += 20;

    doc.fillColor("#52525b").font("Helvetica").fontSize(9);
    doc.text("Sub Total", totalsAreaX, currentY, { width: labelWidth, align: "right" });
    doc.fillColor("#18181b").font("Helvetica-Bold").fontSize(9).text(`Rs. ${cn.total_bill_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, totalsAreaX + labelWidth, currentY, { width: amountWidth, align: "right" });

    currentY += 18;
    // Overridden / adjustments (if any) - keep emphasis but smaller
    doc.fillColor("#d97706").font("Helvetica-Bold").fontSize(9).text("Overridden Amount", totalsAreaX, currentY, { width: labelWidth, align: "right" });
    doc.fillColor("#18181b").font("Helvetica").fontSize(9).text("Rs. 120.00", totalsAreaX + labelWidth, currentY, { width: amountWidth, align: "right" });

    currentY += 20;
    const dividerX = totalsAreaX + Math.max(10, labelWidth - 20);
    doc.rect(dividerX, currentY - 6, amountWidth + 10, 1).fill("#18181b");

    currentY += 6;
    doc.fillColor("#18181b").font("Helvetica-Bold").fontSize(11).text("TOTAL REFUND", totalsAreaX, currentY, { width: labelWidth, align: "right" });
    doc.text("Rs. 120.00", totalsAreaX + labelWidth, currentY, { width: amountWidth, align: "right" });

    const footerY = doc.page.height - 60;
    doc.fillColor("#a1a1aa").fontSize(8).text("Credit Note issued for sales return.", pageMargin, footerY, { align: "center", width: pageWidth - pageMargin * 2 });
    doc.text("automodeal (Pvt) Ltd | Sales Return Document", pageMargin, footerY + 12, { align: "center", width: pageWidth - pageMargin * 2 });

    doc.end();
  });

  app.post("/api/sales", (req, res) => {
    const { invoice_number, customer_id, customer_name, date_of_sale, discount, items } = req.body;
    const total_amount = items.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0) - (discount || 0);

    const transaction = db.transaction(() => {
      // Check stock first
      for (const item of items) {
        const product = db.prepare("SELECT current_stock, description, product_code FROM products WHERE id = ?").get(item.product_id);
        if (!product || product.current_stock < item.quantity) {
          throw new Error(`Error: Insufficient stock for product ${product?.product_code || 'ID ' + item.product_id}. Available: ${product?.current_stock || 0}`);
        }
      }

      const invoiceResult = db.prepare("INSERT INTO sales_invoices (invoice_number, customer_id, customer_name, date_of_sale, discount, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(
        invoice_number, customer_id, customer_name, date_of_sale, discount, total_amount
      );
      const invoiceId = invoiceResult.lastInsertRowid;

      for (const item of items) {
        db.prepare("INSERT INTO sales_invoice_items (invoice_id, product_id, quantity_sold, unit_price, total) VALUES (?, ?, ?, ?, ?)").run(
          invoiceId, item.product_id, item.quantity, item.price, item.quantity * item.price
        );

        // Deduct stock
        db.prepare("UPDATE products SET current_stock = current_stock - ? WHERE id = ?").run(item.quantity, item.product_id);

        // Check for low stock alert
        const updatedProduct = db.prepare("SELECT * FROM products WHERE id = ?").get(item.product_id);
        if (updatedProduct.current_stock < updatedProduct.min_stock_threshold) {
          db.prepare("INSERT INTO alerts (product_id, message) VALUES (?, ?)").run(
            item.product_id, `Low stock alert for ${updatedProduct.description}: ${updatedProduct.current_stock} remaining.`
          );
        }
      }
      return invoiceId;
    });

    try {
      const invoiceId = transaction();
      res.json({ success: true, invoiceId });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });
  // Credit Notes
  app.post("/api/credit-notes", (req, res) => {
    const { credit_note_number, invoice_id, customer_id, date_of_return, remarks, discount_percent, items } = req.body;

    const total_bill_value = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0);
    const discount_amount = (total_bill_value * (discount_percent || 0)) / 100;
    const grand_total = total_bill_value - discount_amount;

    const transaction = db.transaction(() => {
      // Validate quantities against original invoice
      const originalItems = db.prepare("SELECT product_id, quantity_sold FROM sales_invoice_items WHERE invoice_id = ?").all(invoice_id);

      for (const item of items) {
        const original = originalItems.find(oi => oi.product_id === item.product_id);
        if (!original || item.quantity > original.quantity_sold) {
          throw new Error(`Error: Return quantity for product ID ${item.product_id} exceeds original invoice quantity.`);
        }
      }

      const cnResult = db.prepare(`
        INSERT INTO credit_notes (credit_note_number, invoice_id, customer_id, date_of_return, remarks, total_bill_value, discount_percent, discount_amount, grand_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(credit_note_number, invoice_id, customer_id, date_of_return, remarks, total_bill_value, discount_percent, discount_amount, grand_total);

      const cnId = cnResult.lastInsertRowid;

      for (const item of items) {
        db.prepare(`
          INSERT INTO credit_note_items (credit_note_id, product_id, part_number, description, brand, model, additional_description, quantity, unit_price, total_value)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(cnId, item.product_id, item.part_number, item.description, item.brand, item.model, item.additional_description, item.quantity, item.unit_price, item.quantity * item.unit_price);

        // Increase stock
        db.prepare("UPDATE products SET current_stock = current_stock + ? WHERE id = ?").run(item.quantity, item.product_id);
      }
      return cnId;
    });

    try {
      const cnId = transaction();
      res.json({ success: true, cnId });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // Issue Orders
  app.post("/api/issue-orders", (req, res) => {
    const { issue_order_number, rep_id, date_of_order, items } = req.body;

    const transaction = db.transaction(() => {
      // Check stock
      for (const item of items) {
        const product = db.prepare("SELECT current_stock, description, product_code FROM products WHERE id = ?").get(item.product_id);
        if (!product || product.current_stock < item.quantity) {
          throw new Error(`Error: Insufficient stock for product ${product?.product_code || 'ID ' + item.product_id}.Available: ${product?.current_stock || 0} `);
        }
      }

      const orderResult = db.prepare("INSERT INTO issue_orders (issue_order_number, rep_id, date_of_order) VALUES (?, ?, ?)").run(
        issue_order_number, rep_id, date_of_order
      );
      const orderId = orderResult.lastInsertRowid;

      for (const item of items) {
        db.prepare("INSERT INTO issue_order_items (issue_order_id, product_id, quantity_issued) VALUES (?, ?, ?)").run(
          orderId, item.product_id, item.quantity
        );

        // Deduct stock
        db.prepare("UPDATE products SET current_stock = current_stock - ? WHERE id = ?").run(item.quantity, item.product_id);
      }
      return orderId;
    });

    try {
      const orderId = transaction();
      res.json({ success: true, orderId });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
