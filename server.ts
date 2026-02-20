import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

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
    const PDFDocument = (await import("pdfkit")).default;

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
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    doc.pipe(res);

    // Header
    // Logo Placeholder
    doc.rect(50, 45, 50, 50).fill("#18181b");
    doc.fillColor("#ffffff").fontSize(20).text("S", 65, 60);

    doc.fillColor("#18181b").font("Helvetica-Bold").fontSize(20).text("SMS Pro", 110, 50);
    doc.font("Helvetica").fontSize(10).text("NovaLink Innovations", 110, 75);
    doc.text("123 Business Street, Tech City", 110, 88);
    doc.text("Contact: +94 11 2233445", 110, 101);

    doc.fontSize(20).text("INVOICE", 400, 50, { align: "right" });
    doc.fontSize(10).text(`Invoice No: ${invoice.invoice_number}`, 400, 75, { align: "right" });
    doc.text(`Date: ${new Date(invoice.date_of_sale).toLocaleDateString()}`, 400, 88, { align: "right" });

    doc.moveDown(4);

    // Client Details
    doc.fontSize(10).fillColor("#a1a1aa").text("CLIENT DETAILS", 50, 150);
    doc.fillColor("#18181b").font("Helvetica-Bold").fontSize(12).text(invoice.customer_name, 50, 165);
    doc.font("Helvetica").fontSize(10).text(invoice.company_name || "", 50, 180);
    doc.text(invoice.address || "", 50, 193);
    doc.text(invoice.contact_number || "", 50, 206);

    doc.moveDown(2);

    // Table Header
    const tableTop = 250;
    doc.rect(50, tableTop, 495, 20).fill("#f4f4f5");
    doc.fillColor("#71717a").fontSize(8).text("No", 55, tableTop + 6);
    doc.text("Brand", 80, tableTop + 6);
    doc.text("Part No", 140, tableTop + 6);
    doc.text("Model", 200, tableTop + 6);
    doc.text("Description", 260, tableTop + 6);
    doc.text("QTY", 400, tableTop + 6, { width: 30, align: "center" });
    doc.text("Unit Price", 440, tableTop + 6, { width: 50, align: "right" });
    doc.text("Total Value", 495, tableTop + 6, { width: 50, align: "right" });

    // Table Items
    let currentY = tableTop + 25;
    let totalQty = 0;
    items.forEach((item, index) => {
      doc.fillColor("#18181b").fontSize(8);
      doc.text(index + 1, 55, currentY);
      doc.text(item.brand || "-", 80, currentY);
      doc.text(item.product_code, 140, currentY);
      doc.text(item.model || "-", 200, currentY);
      doc.text(item.description, 260, currentY, { width: 130 });
      doc.text(item.quantity_sold, 400, currentY, { width: 30, align: "center" });
      doc.text(item.unit_price.toFixed(2), 440, currentY, { width: 50, align: "right" });
      doc.text(item.total.toFixed(2), 495, currentY, { width: 50, align: "right" });

      totalQty += item.quantity_sold;
      currentY += 20;

      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }
    });

    // Totals
    doc.moveDown(2);
    const subtotal = items.reduce((sum, i) => sum + i.total, 0);
    const discountPercent = invoice.discount ? (invoice.discount / subtotal) * 100 : 0;

    doc.fontSize(10).text("Total Quantity:", 50, currentY + 20);
    doc.font("Helvetica-Bold").fontSize(12).text(totalQty.toString(), 130, currentY + 20);

    doc.font("Helvetica").fontSize(10).text("Total", 400, currentY + 20, { width: 70, align: "right" });
    doc.text(`Rs. ${subtotal.toFixed(2)}`, 495, currentY + 20, { width: 50, align: "right" });

    doc.text(`Discount (${discountPercent.toFixed(0)}%)`, 400, currentY + 35, { width: 70, align: "right" });
    doc.text(`Rs. ${invoice.discount.toFixed(2)}`, 495, currentY + 35, { width: 50, align: "right" });

    doc.rect(390, currentY + 50, 160, 1).fill("#e4e4e7");
    doc.fillColor("#18181b").font("Helvetica-Bold").fontSize(12).text("Grand Total", 400, currentY + 60, { width: 70, align: "right" });
    doc.text(`Rs. ${invoice.total_amount.toFixed(2)}`, 480, currentY + 60, { width: 65, align: "right" });

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
          throw new Error(`Error: Insufficient stock for product ${product?.product_code || 'ID ' + item.product_id}. Available: ${product?.current_stock || 0}`);
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
