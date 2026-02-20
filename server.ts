import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("sales_management.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT CHECK(role IN ('Admin', 'InventoryManager', 'Rep')) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_code TEXT UNIQUE NOT NULL,
    description TEXT,
    model TEXT,
    brand TEXT,
    unit_price REAL NOT NULL,
    current_stock INTEGER DEFAULT 0,
    min_stock_threshold INTEGER DEFAULT 10,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS grn (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grn_number TEXT UNIQUE NOT NULL,
    supplier_name TEXT NOT NULL,
    date_received DATE NOT NULL,
    total_amount REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS grn_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grn_id INTEGER,
    product_code TEXT NOT NULL,
    product_description TEXT,
    model TEXT,
    brand TEXT,
    quantity_received INTEGER NOT NULL,
    price_per_unit REAL NOT NULL,
    total REAL NOT NULL,
    FOREIGN KEY (grn_id) REFERENCES grn(id)
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    address TEXT,
    contact_number TEXT,
    company_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sales_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE NOT NULL,
    customer_id INTEGER,
    customer_name TEXT NOT NULL, -- Keep for backward compatibility or as snapshot
    date_of_sale DATE NOT NULL,
    discount REAL DEFAULT 0,
    total_amount REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS credit_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    credit_note_number TEXT UNIQUE NOT NULL,
    invoice_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    date_of_return DATE NOT NULL,
    remarks TEXT,
    total_bill_value REAL NOT NULL,
    discount_percent REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    grand_total REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS credit_note_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    credit_note_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    part_number TEXT,
    description TEXT,
    brand TEXT,
    model TEXT,
    additional_description TEXT,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    total_value REAL NOT NULL,
    FOREIGN KEY (credit_note_id) REFERENCES credit_notes(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS sales_invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER,
    product_id INTEGER,
    quantity_sold INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    total REAL NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS issue_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_order_number TEXT UNIQUE NOT NULL,
    rep_id INTEGER,
    date_of_order DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rep_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS issue_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_order_id INTEGER,
    product_id INTEGER,
    quantity_issued INTEGER NOT NULL,
    FOREIGN KEY (issue_order_id) REFERENCES issue_orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
`);

// Seed Admin User if not exists
const adminExists = db.prepare("SELECT * FROM users WHERE email = ?").get("admin@sms.com");
if (!adminExists) {
  db.prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)").run(
    "System Admin",
    "admin@sms.com",
    "admin123", // In a real app, use password_hash
    "Admin"
  );
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API Routes ---

  // Auth
  app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ? AND password = ?").get(email, password);
    if (user) {
      res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  });

  // Dashboard Stats
  app.get("/api/dashboard/stats", (req, res) => {
    const totalProducts = db.prepare("SELECT COUNT(*) as count FROM products").get().count;
    const lowStockCount = db.prepare("SELECT COUNT(*) as count FROM products WHERE current_stock < min_stock_threshold").get().count;
    const totalSales = db.prepare("SELECT SUM(total_amount) as total FROM sales_invoices").get().total || 0;
    const activeAlerts = db.prepare("SELECT * FROM alerts WHERE status = 'active' ORDER BY created_at DESC LIMIT 5").all();

    res.json({ totalProducts, lowStockCount, totalSales, activeAlerts });
  });

  // Customers
  app.get("/api/customers", (req, res) => {
    const customers = db.prepare("SELECT * FROM customers ORDER BY customer_name").all();
    res.json(customers);
  });

  app.post("/api/customers", (req, res) => {
    const { customer_name, address, contact_number, company_name } = req.body;
    try {
      const result = db.prepare("INSERT INTO customers (customer_name, address, contact_number, company_name) VALUES (?, ?, ?, ?)").run(
        customer_name, address, contact_number, company_name
      );
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.put("/api/customers/:id", (req, res) => {
    const { id } = req.params;
    const { customer_name, address, contact_number, company_name } = req.body;
    try {
      db.prepare("UPDATE customers SET customer_name = ?, address = ?, contact_number = ?, company_name = ? WHERE id = ?").run(
        customer_name, address, contact_number, company_name, id
      );
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.delete("/api/customers/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM customers WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
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

    const colNo = 50;
    const colPartNo = 80;
    const colDesc = 150;
    const colBrand = 270;
    const colModel = 325;
    const colQty = 385;
    const colPrice = 415;
    const colTotal = 490;

    const drawHeader = (pageNum: number) => {
      // Company Info (Top Left) - Replaced logo and old text with requested details
      doc.fillColor("#18181b").font("Helvetica-Bold").fontSize(14).text("Automodeal(pvt)ltd", 50, 45);
      doc.font("Helvetica").fontSize(9).fillColor("#52525b");
      doc.text("250/12 Makola south Makola", 50, 62);
      doc.text("0777384343/0703384343", 50, 75);

      // Invoice Info (Top Right)
      doc.fillColor("#18181b").font("Helvetica-Bold").fontSize(22).text("INVOICE", 380, 45, { align: "right" });
      doc.fontSize(10).fillColor("#71717a").text("Invoice Number", 380, 75, { align: "right" });
      doc.fillColor("#18181b").fontSize(12).text(invoice.invoice_number, 380, 88, { align: "right" });
      doc.fontSize(10).fillColor("#71717a").text("Date", 380, 105, { align: "right" });
      doc.fillColor("#18181b").fontSize(12).text(new Date(invoice.date_of_sale).toLocaleDateString(), 380, 118, { align: "right" });

      if (pageNum === 1) {
        // Client details only on first page - Dynamic height to avoid overlay
        let clientY = 160;
        doc.fillColor("#71717a").font("Helvetica-Bold").fontSize(10).text("BILL TO", 50, clientY);
        doc.rect(50, clientY + 12, 20, 2).fill("#18181b");
        clientY += 25;

        doc.fillColor("#18181b").font("Helvetica-Bold").fontSize(13).text(invoice.customer_name, 50, clientY, { width: 250 });
        doc.fontSize(13);
        clientY += doc.heightOfString(invoice.customer_name, { width: 250 }) + 5;

        doc.font("Helvetica").fontSize(10).fillColor("#52525b");
        if (invoice.company_name) {
          doc.text(invoice.company_name, 50, clientY, { width: 250 });
          doc.fontSize(10);
          clientY += doc.heightOfString(invoice.company_name, { width: 250 }) + 3;
        }

        const address = invoice.address || "N/A";
        doc.text(address, 50, clientY, { width: 250 });
        doc.fontSize(10);
        clientY += doc.heightOfString(address, { width: 250 }) + 3;

        doc.text(invoice.contact_number || "N/A", 50, clientY, { width: 250 });
      }
    };

    const drawTableHeader = (y: number) => {
      doc.rect(50, y, 495, 25).fill("#18181b");
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8);
      doc.text("No", colNo + 2, y + 8);
      doc.text("Part No", colPartNo, y + 8, { width: 65 });
      doc.text("Description", colDesc, y + 8, { width: 115 });
      doc.text("Brand", colBrand, y + 8, { width: 50 });
      doc.text("Model", colModel, y + 8, { width: 55 });
      doc.text("QTY", colQty, y + 8, { width: 25, align: "center" });
      doc.text("Price", colPrice, y + 8, { width: 70, align: "right" });
      doc.text("Total", colTotal, y + 8, { width: 55, align: "right" });
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
      const descHeight = doc.heightOfString(item.description || "", { width: 115 });
      const rowHeight = Math.max(25, descHeight + 12);

      if (currentY + rowHeight > 750) {
        doc.addPage();
        currentPage++;
        drawHeader(currentPage);
        currentY = 160; // Start higher on subsequent pages since no BILL TO section
        drawTableHeader(currentY);
        currentY += 25;
      }

      if (index % 2 === 1) doc.rect(50, currentY, 495, rowHeight).fill("#f9fafb");

      doc.fillColor("#18181b").font("Helvetica").fontSize(8);
      doc.text(index + 1, colNo + 2, currentY + 8);
      doc.text(item.product_code || "-", colPartNo, currentY + 8, { width: 65, ellipsis: true });
      doc.text(item.description || "-", colDesc, currentY + 8, { width: 115 }); // Allow wrap
      doc.text(item.brand || "-", colBrand, currentY + 8, { width: 50, ellipsis: true });
      doc.text(item.model || "-", colModel, currentY + 8, { width: 55, ellipsis: true });
      doc.text(item.quantity_sold, colQty, currentY + 8, { width: 25, align: "center" });
      doc.text(item.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 }), colPrice, currentY + 8, { width: 70, align: "right" });
      doc.text(item.total.toLocaleString(undefined, { minimumFractionDigits: 2 }), colTotal, currentY + 8, { width: 55, align: "right" });

      doc.moveTo(50, currentY + rowHeight).lineTo(545, currentY + rowHeight).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
      totalQty += item.quantity_sold;
      currentY += rowHeight;
    });

    // Totals
    if (currentY + 120 > 800) {
      doc.addPage();
      drawHeader(++currentPage);
      currentY = 200;
    }

    doc.moveDown(2);
    const subtotal = items.reduce((sum, i) => sum + i.total, 0);
    const discountPercent = invoice.discount ? (invoice.discount / subtotal) * 100 : 0;
    const totalsX = 350;

    currentY += 20;
    doc.fillColor("#52525b").font("Helvetica").fontSize(10);
    doc.text("Sub Total", totalsX, currentY, { width: 110, align: "right" });
    doc.fillColor("#18181b").font("Helvetica-Bold").text(`Rs. ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, colTotal, currentY, { width: 55, align: "right" });

    currentY += 20;
    doc.fillColor("#52525b").font("Helvetica").text(`Discount (${discountPercent.toFixed(0)}%)`, totalsX, currentY, { width: 110, align: "right" });
    doc.fillColor("#18181b").text(`Rs. ${invoice.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, colTotal, currentY, { width: 55, align: "right" });

    currentY += 25;
    doc.rect(totalsX + 40, currentY - 5, 155, 1).fill("#18181b");

    doc.fillColor("#18181b").font("Helvetica-Bold").fontSize(12);
    doc.text("GRAND TOTAL", totalsX, currentY, { width: 110, align: "right" });
    doc.text(`Rs. ${invoice.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, colTotal, currentY, { width: 55, align: "right" });

    doc.moveTo(totalsX + 40, currentY + 15).lineTo(545, currentY + 15).lineWidth(1).stroke();
    doc.moveTo(totalsX + 40, currentY + 18).lineTo(545, currentY + 18).lineWidth(1).stroke();

    const qtyY = currentY + 40;
    doc.rect(50, qtyY, 130, 35).strokeColor("#e5e7eb").lineWidth(1).stroke();
    doc.fillColor("#71717a").font("Helvetica-Bold").fontSize(8).text("TOTAL QUANTITY", 60, qtyY + 8);
    doc.fillColor("#18181b").font("Helvetica-Bold").fontSize(14).text(totalQty.toString(), 60, qtyY + 18);

    // Footer on the last page
    doc.fillColor("#a1a1aa").fontSize(8).text("Thank you for your business!", 50, 780, { align: "center", width: 495 });
    doc.text("Automodeal(pvt)ltd | Powered by NovaLink Innovations", 50, 792, { align: "center", width: 495 });

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

    const colNo = 50;
    const colPartNo = 80;
    const colDesc = 150;
    const colBrand = 270;
    const colModel = 325;
    const colQty = 385;
    const colPrice = 415;
    const colTotal = 490;

    const drawHeader = (pageNum: number) => {
      // Company Info (Top Left) - Replaced logo and old text with requested details
      doc.fillColor("#18181b").font("Helvetica-Bold").fontSize(14).text("Automodeal(pvt)ltd", 50, 45);
      doc.font("Helvetica").fontSize(9).fillColor("#52525b");
      doc.text("250/12 Makola south Makola", 50, 62);
      doc.text("0777384343/0703384343", 50, 75);

      doc.fillColor("#18181b").font("Helvetica-Bold").fontSize(22).text("CREDIT NOTE", 380, 45, { align: "right" });
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
      doc.rect(50, y, 495, 25).fill("#18181b");
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8);
      doc.text("No", colNo + 2, y + 8);
      doc.text("Part No", colPartNo, y + 8, { width: 65 });
      doc.text("Description", colDesc, y + 8, { width: 115 });
      doc.text("Brand", colBrand, y + 8, { width: 50 });
      doc.text("Model", colModel, y + 8, { width: 55 });
      doc.text("QTY", colQty, y + 8, { width: 25, align: "center" });
      doc.text("Price", colPrice, y + 8, { width: 70, align: "right" });
      doc.text("Total", colTotal, y + 8, { width: 55, align: "right" });
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
      const descHeight = doc.heightOfString(item.description || "", { width: 115 });
      const rowHeight = Math.max(25, descHeight + 12);

      if (currentY + rowHeight > 750) {
        doc.addPage();
        currentPage++;
        drawHeader(currentPage);
        currentY = 160; // Start higher on subsequent pages since no BILL TO section
        drawTableHeader(currentY);
        currentY += 25;
      }

      if (index % 2 === 1) doc.rect(50, currentY, 495, rowHeight).fill("#f9fafb");
      doc.fillColor("#18181b").font("Helvetica").fontSize(8);
      doc.text(index + 1, colNo + 2, currentY + 8);
      doc.text(item.part_number || "-", colPartNo, currentY + 8, { width: 65, ellipsis: true });
      doc.text(item.description || "-", colDesc, currentY + 8, { width: 115 }); // Allow wrap
      doc.text(item.brand || "-", colBrand, currentY + 8, { width: 50, ellipsis: true });
      doc.text(item.model || "-", colModel, currentY + 8, { width: 55, ellipsis: true });
      doc.text(item.quantity, colQty, currentY + 8, { width: 25, align: "center" });
      doc.text(item.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 }), colPrice, currentY + 8, { width: 70, align: "right" });
      doc.text(item.total_value.toLocaleString(undefined, { minimumFractionDigits: 2 }), colTotal, currentY + 8, { width: 55, align: "right" });
      doc.moveTo(50, currentY + rowHeight).lineTo(545, currentY + rowHeight).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
      totalQty += item.quantity;
      currentY += rowHeight;
    });

    if (currentY + 120 > 800) {
      doc.addPage();
      drawHeader(++currentPage);
      currentY = 200;
    }

    const totalsX = 350;
    currentY += 20;
    doc.fillColor("#52525b").font("Helvetica").fontSize(10);
    doc.text("Sub Total", totalsX, currentY, { width: 110, align: "right" });
    doc.fillColor("#18181b").font("Helvetica-Bold").text(`Rs. ${cn.total_bill_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, colTotal, currentY, { width: 55, align: "right" });

    currentY += 20;
    doc.fillColor("#d97706").font("Helvetica-Bold").text("Overridden Amount", totalsX, currentY, { width: 110, align: "right" });
    doc.text("Rs. 120.00", colTotal, currentY, { width: 55, align: "right" });

    currentY += 25;
    doc.rect(totalsX + 40, currentY - 5, 155, 1).fill("#18181b");
    doc.fillColor("#18181b").font("Helvetica-Bold").fontSize(12).text("TOTAL REFUND", totalsX, currentY, { width: 110, align: "right" });
    doc.text("Rs. 120.00", colTotal, currentY, { width: 55, align: "right" });

    doc.fillColor("#a1a1aa").fontSize(8).text("Credit Note issued for sales return.", 50, 780, { align: "center", width: 495 });
    doc.text("Automodeal(pvt)ltd | Sales Return Document", 50, 792, { align: "center", width: 495 });

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
