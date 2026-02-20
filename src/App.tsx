import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Package,
  FilePlus,
  ShoppingCart,
  Truck,
  AlertTriangle,
  LogOut,
  Plus,
  Trash2,
  Search,
  ChevronRight,
  User as UserIcon,
  TrendingUp,
  Box,
  DollarSign,
  Users,
  RotateCcw,
  Edit,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Product, DashboardStats, Alert, Customer } from './types';

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${active
      ? 'bg-zinc-900 text-white shadow-lg'
      : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
      }`}
  >
    <Icon size={20} />
    <span className="font-medium text-sm">{label}</span>
  </button>
);

const StatCard = ({ label, value, icon: Icon, color }: { label: string, value: string | number, icon: any, color: string }) => (
  <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm flex items-center justify-between">
    <div>
      <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-1">{label}</p>
      <h3 className="text-2xl font-bold text-zinc-900">{value}</h3>
    </div>
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon size={24} className="text-white" />
    </div>
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  // Auth State
  const [email, setEmail] = useState('admin@sms.com');
  const [password, setPassword] = useState('admin123');

  useEffect(() => {
    if (user) {
      fetchDashboardStats();
      fetchProducts();
    }
  }, [user]);

  const fetchDashboardStats = async () => {
    const res = await fetch('/api/dashboard/stats');
    const data = await res.json();
    setStats(data);
  };

  const fetchProducts = async () => {
    const res = await fetch('/api/products');
    const data = await res.json();
    setProducts(data);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Login failed');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-zinc-100"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-lg overflow-hidden border border-zinc-100">
              <img src="/logo.JPG" alt="AUTOMODEAL(PVT)LTD Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900">SMS Portal</h1>
            <p className="text-zinc-500 text-sm">Sales Management System</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none transition-all"
                placeholder="admin@sms.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-colors shadow-lg disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-zinc-400 text-xs mb-4">Demo: admin@sms.com / admin123</p>
            <div className="pt-6 border-t border-zinc-100">
              <p className="text-zinc-500 text-xs">Developed by <span className="font-bold">NovaLink Innovations</span></p>
              <a
                href="https://novalinkinnovations.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-zinc-900 text-[10px] flex items-center justify-center gap-1 mt-1 transition-colors"
              >
                novalinkinnovations.com <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-zinc-200 p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-md overflow-hidden border border-zinc-100">
            <img src="/logo.JPG" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-bold text-zinc-900 tracking-tight">AUTOMODEAL(PVT)LTD</span>
        </div>

        <nav className="flex-1 space-y-1">
          <SidebarItem
            icon={LayoutDashboard}
            label="Dashboard"
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
          />
          <SidebarItem
            icon={Package}
            label="Inventory"
            active={activeTab === 'inventory'}
            onClick={() => setActiveTab('inventory')}
          />
          <SidebarItem
            icon={FilePlus}
            label="GRN Entry"
            active={activeTab === 'grn'}
            onClick={() => setActiveTab('grn')}
          />
          <SidebarItem
            icon={ShoppingCart}
            label="Sales Invoice"
            active={activeTab === 'sales'}
            onClick={() => setActiveTab('sales')}
          />
          <SidebarItem
            icon={Truck}
            label="Issue Orders"
            active={activeTab === 'issue'}
            onClick={() => setActiveTab('issue')}
          />
          <SidebarItem
            icon={Users}
            label="Customers"
            active={activeTab === 'customers'}
            onClick={() => setActiveTab('customers')}
          />
          <SidebarItem
            icon={RotateCcw}
            label="Sales Return"
            active={activeTab === 'credit-note'}
            onClick={() => setActiveTab('credit-note')}
          />
        </nav>

        <div className="mt-auto pt-6 border-t border-zinc-100">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center">
              <UserIcon size={20} className="text-zinc-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-zinc-900 truncate">{user.name}</p>
              <p className="text-xs text-zinc-500 truncate">{user.role}</p>
            </div>
          </div>
          <button
            onClick={() => setUser(null)}
            className="w-full flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 capitalize">{activeTab}</h2>
            <p className="text-zinc-500 text-sm">Manage your sales and inventory operations</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                type="text"
                placeholder="Search anything..."
                className="pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-zinc-900 outline-none w-64 transition-all"
              />
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Total Products" value={stats?.totalProducts || 0} icon={Box} color="bg-blue-500" />
                <StatCard label="Low Stock Items" value={stats?.lowStockCount || 0} icon={AlertTriangle} color="bg-amber-500" />
                <StatCard label="Total Sales" value={`Rs. ${stats?.totalSales.toLocaleString() || 0}`} icon={DollarSign} color="bg-emerald-500" />
                <StatCard label="Growth" value="+12.5%" icon={TrendingUp} color="bg-violet-500" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-zinc-900">Recent Inventory Alerts</h3>
                    <div className="flex items-center gap-3">
                      {stats?.activeAlerts && stats.activeAlerts.length > 0 && (
                        <button
                          onClick={() => setStats(prev => prev ? { ...prev, activeAlerts: [] } : null)}
                          className="text-zinc-500 text-xs font-bold hover:text-red-600 transition-colors"
                        >
                          Clear All
                        </button>
                      )}
                      <button className="text-zinc-500 text-xs font-bold hover:text-zinc-900">View All</button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {stats?.activeAlerts.length === 0 ? (
                      <p className="text-zinc-400 text-sm text-center py-8">No active alerts</p>
                    ) : (
                      stats?.activeAlerts.map(alert => (
                        <div key={alert.id} className="flex items-start gap-4 p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                          <div className="p-2 bg-amber-100 rounded-lg">
                            <AlertTriangle size={18} className="text-amber-600" />
                          </div>
                          <div>
                            <p className="text-sm text-zinc-900 font-medium">{alert.message}</p>
                            <p className="text-xs text-zinc-400 mt-1">{new Date(alert.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-zinc-900 p-6 rounded-2xl shadow-xl text-white">
                  <h3 className="font-bold mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <button onClick={() => setActiveTab('grn')} className="w-full flex items-center justify-between p-4 bg-white/10 hover:bg-white/20 rounded-xl transition-all group">
                      <span className="text-sm font-medium">New GRN Entry</span>
                      <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button onClick={() => setActiveTab('sales')} className="w-full flex items-center justify-between p-4 bg-white/10 hover:bg-white/20 rounded-xl transition-all group">
                      <span className="text-sm font-medium">Create Sales Invoice</span>
                      <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button onClick={() => setActiveTab('inventory')} className="w-full flex items-center justify-between p-4 bg-white/10 hover:bg-white/20 rounded-xl transition-all group">
                      <span className="text-sm font-medium">Manage Stock</span>
                      <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'inventory' && (
            <motion.div
              key="inventory"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="font-bold text-zinc-900">Product List</h3>
                <button className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-bold hover:bg-zinc-800 transition-colors">
                  <Plus size={16} />
                  Add Product
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-100">
                      <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Code</th>
                      <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Description</th>
                      <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Model</th>
                      <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest text-right">Unit Price</th>
                      <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest text-center">Stock</th>
                      <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {products.map(product => (
                      <tr key={product.id} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-mono text-zinc-900">{product.product_code}</td>
                        <td className="px-6 py-4 text-sm text-zinc-600">{product.description}</td>
                        <td className="px-6 py-4 text-sm text-zinc-500 italic">{product.model || '-'}</td>
                        <td className="px-6 py-4 text-sm text-zinc-900 text-right font-medium">Rs. {product.unit_price.toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm text-zinc-900 text-center font-bold">{product.current_stock}</td>
                        <td className="px-6 py-4 text-center">
                          {product.current_stock < product.min_stock_threshold ? (
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase rounded-md">Low Stock</span>
                          ) : (
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded-md">In Stock</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'grn' && <GRNModule onComplete={() => { setActiveTab('dashboard'); fetchDashboardStats(); }} />}
          {activeTab === 'sales' && <SalesModule products={products} onComplete={() => { setActiveTab('dashboard'); fetchDashboardStats(); }} />}
          {activeTab === 'issue' && <IssueOrderModule products={products} onComplete={() => { setActiveTab('dashboard'); fetchDashboardStats(); }} />}
          {activeTab === 'customers' && <CustomerModule />}
          {activeTab === 'credit-note' && <CreditNoteModule onComplete={() => { setActiveTab('dashboard'); fetchDashboardStats(); }} />}
        </AnimatePresence>

        <footer className="mt-12 pt-6 border-t border-zinc-200 text-center">
          <p className="text-zinc-400 text-xs">
            Developed by <span className="font-bold text-zinc-600">NovaLink Innovations</span> |
            <a href="https://novalinkinnovations.com" target="_blank" rel="noopener noreferrer" className="ml-1 hover:text-zinc-900 transition-colors">novalinkinnovations.com</a>
          </p>
        </footer>
      </main>
    </div>
  );
}

// --- Sub-Modules ---

const GRNModule = ({ onComplete }: { onComplete: () => void }) => {
  const [grnNumber, setGrnNumber] = useState(`GRN-${Date.now().toString().slice(-6)}`);
  const [supplier, setSupplier] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([{ product_code: '', description: '', model: '', brand: '', quantity: 1, price: 0 }]);

  const addItem = () => setItems([...items, { product_code: '', description: '', model: '', brand: '', quantity: 1, price: 0 }]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/grn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grn_number: grnNumber, supplier_name: supplier, date_received: date, items })
    });
    const data = await res.json();
    if (data.success) {
      alert('GRN Saved Successfully');
      onComplete();
    } else {
      alert(data.message);
    }
  };

  const total = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-8 rounded-2xl border border-zinc-100 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">GRN Number</label>
            <input type="text" value={grnNumber} readOnly className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm font-mono" />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Supplier Name</label>
            <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)} required className="w-full px-4 py-2 border border-zinc-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Date Received</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full px-4 py-2 border border-zinc-200 rounded-lg text-sm" />
          </div>
        </div>

        <div className="border border-zinc-100 rounded-xl overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase">Product Code</th>
                <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase">Description</th>
                <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase">Brand</th>
                <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase">Model</th>
                <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase w-24">Qty</th>
                <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase w-32">Price</th>
                <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase w-32">Total</th>
                <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {items.map((item, i) => (
                <tr key={i}>
                  <td className="p-2"><input type="text" value={item.product_code} onChange={e => updateItem(i, 'product_code', e.target.value)} className="w-full px-2 py-1 border border-zinc-200 rounded text-sm" required /></td>
                  <td className="p-2"><input type="text" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} className="w-full px-2 py-1 border border-zinc-200 rounded text-sm" required /></td>
                  <td className="p-2"><input type="text" value={item.brand} onChange={e => updateItem(i, 'brand', e.target.value)} className="w-full px-2 py-1 border border-zinc-200 rounded text-sm" required /></td>
                  <td className="p-2"><input type="text" value={item.model} onChange={e => updateItem(i, 'model', e.target.value)} className="w-full px-2 py-1 border border-zinc-200 rounded text-sm" /></td>
                  <td className="p-2"><input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', parseInt(e.target.value))} className="w-full px-2 py-1 border border-zinc-200 rounded text-sm" required /></td>
                  <td className="p-2"><input type="number" value={item.price} onChange={e => updateItem(i, 'price', parseFloat(e.target.value))} className="w-full px-2 py-1 border border-zinc-200 rounded text-sm" required /></td>
                  <td className="p-4 text-sm font-bold text-zinc-900">Rs. {(item.quantity * item.price).toFixed(2)}</td>
                  <td className="p-2">
                    <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={addItem} className="w-full py-3 bg-zinc-50 text-zinc-500 text-xs font-bold hover:bg-zinc-100 transition-colors flex items-center justify-center gap-2">
            <Plus size={14} /> Add Row
          </button>
        </div>

        <div className="flex items-center justify-between pt-6 border-t border-zinc-100">
          <div className="text-right">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Grand Total</p>
            <h4 className="text-3xl font-bold text-zinc-900">Rs. {total.toFixed(2)}</h4>
          </div>
          <button type="submit" className="px-8 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 shadow-lg">Save GRN</button>
        </div>
      </form>
    </motion.div>
  );
};

const SalesModule = ({ products, onComplete }: { products: Product[], onComplete: () => void }) => {
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString().slice(-6)}`);
  const [customer, setCustomer] = useState('');
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [discount, setDiscount] = useState(0);
  const [items, setItems] = useState([{ product_id: 0, quantity: 1, price: 0, error: '' }]);

  useEffect(() => {
    fetch('/api/customers').then(res => res.json()).then(setCustomers);
  }, []);

  const addItem = () => setItems([...items, { product_id: 0, quantity: 1, price: 0, error: '' }]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    const item = newItems[index] as any;

    if (field === 'product_id') {
      const p = products.find(x => x.id === parseInt(value));
      item.price = p?.unit_price || 0;
      item.product_id = parseInt(value);
      // Re-validate quantity if product changes
      if (item.quantity > (p?.current_stock || 0)) {
        item.error = `Insufficient stock. Only ${p?.current_stock} items available.`;
      } else {
        item.error = '';
      }
    } else if (field === 'quantity') {
      const qty = parseInt(value) || 0;
      item.quantity = qty;
      const p = products.find(x => x.id === item.product_id);
      if (qty > (p?.current_stock || 0)) {
        item.error = `Insufficient stock. Only ${p?.current_stock} items available.`;
      } else {
        item.error = '';
      }
    } else {
      item[field] = value;
    }
    setItems(newItems);
  };

  const hasErrors = items.some(item => item.error !== '') || items.some(item => item.product_id === 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (hasErrors) return;

    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice_number: invoiceNumber,
        customer_id: customerId,
        customer_name: customer,
        date_of_sale: new Date().toISOString().split('T')[0],
        discount,
        items
      })
    });
    const data = await res.json();
    if (data.success) {
      // Create a hidden form to submit and download PDF
      const form = document.createElement('form');
      form.method = 'GET';
      form.action = `/api/sales/invoice/${data.invoiceId}/pdf`;
      form.target = '_blank';
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);

      alert('Invoice Created Successfully');
      onComplete();
    } else {
      alert(data.message);
    }
  };

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const total = subtotal - discount;

  

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-8 rounded-2xl border border-zinc-100 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Invoice Number</label>
            <input type="text" value={invoiceNumber} readOnly className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm font-mono" />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Customer Selection</label>
            <div className="flex gap-2">
              <select
                value={customerId || ''}
                onChange={e => {
                  const id = parseInt(e.target.value);
                  setCustomerId(id);
                  const c = customers.find(x => x.id === id);
                  if (c) setCustomer(c.customer_name);
                }}
                className="flex-1 px-4 py-2 border border-zinc-200 rounded-lg text-sm"
              >
                <option value="">Select Existing Customer</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.customer_name} ({c.company_name})</option>
                ))}
              </select>
              <input
                type="text"
                value={customer}
                onChange={e => setCustomer(e.target.value)}
                placeholder="Or manual name"
                className="flex-1 px-4 py-2 border border-zinc-200 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        <div className="border border-zinc-100 rounded-xl overflow-x-auto">
          <table className="w-full text-left min-w-[1000px]">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase w-12 text-center">No</th>
                <th className="px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase">Brand</th>
                <th className="px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase">Part No</th>
                <th className="px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase">Model</th>
                <th className="px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase">Description</th>
                <th className="px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase w-24 text-center">QTY</th>
                <th className="px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase w-32 text-right">Unit Price</th>
                <th className="px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase w-32 text-right">Total Value</th>
                <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {items.map((item, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 text-xs text-zinc-400 text-center">{i + 1}</td>
                  <td className="px-2 py-1 text-xs text-zinc-600">{products.find(p => p.id === item.product_id)?.brand || '-'}</td>
                  <td className="px-2 py-1 text-xs font-mono text-zinc-900">{products.find(p => p.id === item.product_id)?.product_code || '-'}</td>
                  <td className="px-2 py-1 text-xs text-zinc-600 italic">{products.find(p => p.id === item.product_id)?.model || '-'}</td>
                  <td className="p-2">
                    <select
                      value={item.product_id}
                      onChange={e => updateItem(i, 'product_id', e.target.value)}
                      className="w-full px-2 py-1 border border-zinc-200 rounded text-xs"
                      required
                    >
                      <option value="0">Select Product</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.description} {p.model ? `[${p.model}]` : ''} ({p.current_stock} available)</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={item.quantity}
                      min="1"
                      onChange={e => updateItem(i, 'quantity', e.target.value)}
                      className={`w-full px-2 py-1 border rounded text-xs text-center transition-all ${item.error ? 'border-red-500 bg-red-50 text-red-900 ring-1 ring-red-500' : 'border-zinc-200'
                        }`}
                      required
                    />
                    {item.error && <p className="text-[10px] text-red-500 mt-1 font-bold text-center">{item.error}</p>}
                  </td>
                  <td className="p-2"><input type="number" value={item.price} readOnly className="w-full px-2 py-1 bg-zinc-50 border border-zinc-200 rounded text-xs text-right" /></td>
                  <td className="px-4 py-2 text-xs font-bold text-zinc-900 text-right">Rs. {(item.quantity * item.price).toFixed(2)}</td>
                  <td className="p-2 text-center">
                    <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={addItem} className="w-full py-3 bg-zinc-50 text-zinc-500 text-xs font-bold hover:bg-zinc-100 transition-colors flex items-center justify-center gap-2">
            <Plus size={14} /> Add Product
          </button>
        </div>

        <div className="flex flex-col items-end gap-2 pt-6 border-t border-zinc-100">
          <div className="flex flex-col items-end gap-2 pr-4">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total Quantity</p>
            <p className="text-sm font-bold text-zinc-900">{items.reduce((sum, i) => sum + (parseInt(i.quantity as any) || 0), 0)}</p>
          </div>
          <div className="flex items-center gap-4">
            <label className="text-xs font-bold text-zinc-400 uppercase">Discount (%)</label>
            <input type="number" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} className="w-32 px-4 py-1 border border-zinc-200 rounded-lg text-sm text-right" />
          </div>
          <div className="text-right mt-4">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">GRAND TOTAL</p>
            <h4 className="text-3xl font-bold text-zinc-900">Rs. {total.toFixed(2)}</h4>
          </div>
          <button
            type="submit"
            disabled={hasErrors}
            className="mt-4 px-8 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Generate Invoice
          </button>
        </div>
      </form>
      
      

      {/* Download existing Credit Note by ID (server PDF) */}
      <div className="mt-6 p-6 bg-white rounded-2xl border border-zinc-100 shadow-sm">
        <h4 className="text-sm font-bold mb-3">Download Existing Credit Note (by ID)</h4>
        <div className="flex gap-3">
          <input id="cn-download-id" placeholder="Enter Credit Note ID" className="flex-1 px-4 py-2 border border-zinc-200 rounded" />
          <button className="px-4 py-2 bg-emerald-600 text-white rounded" onClick={() => {
            const el = document.getElementById('cn-download-id') as HTMLInputElement | null;
            const v = el?.value?.trim();
            if (!v) return alert('Enter Credit Note ID');
            // Trigger server PDF download
            const link = document.createElement('a');
            link.href = `/api/credit-notes/${v}/pdf`;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}>Download</button>
        </div>
      </div>
    </motion.div>
  );
};

const IssueOrderModule = ({ products, onComplete }: { products: Product[], onComplete: () => void }) => {
  const [orderNumber, setOrderNumber] = useState(`ISS-${Date.now().toString().slice(-6)}`);
  const [repId, setRepId] = useState(1);
  const [items, setItems] = useState([{ product_id: 0, quantity: 1, error: '' }]);

  const addItem = () => setItems([...items, { product_id: 0, quantity: 1, error: '' }]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    const item = newItems[index] as any;

    if (field === 'product_id') {
      item.product_id = parseInt(value);
      const p = products.find(x => x.id === item.product_id);
      if (item.quantity > (p?.current_stock || 0)) {
        item.error = `Insufficient stock. Only ${p?.current_stock} items available.`;
      } else {
        item.error = '';
      }
    } else if (field === 'quantity') {
      const qty = parseInt(value) || 0;
      item.quantity = qty;
      const p = products.find(x => x.id === item.product_id);
      if (qty > (p?.current_stock || 0)) {
        item.error = `Insufficient stock. Only ${p?.current_stock} items available.`;
      } else {
        item.error = '';
      }
    } else {
      item[field] = value;
    }
    setItems(newItems);
  };

  const hasErrors = items.some(item => item.error !== '') || items.some(item => item.product_id === 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (hasErrors) return;

    const res = await fetch('/api/issue-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue_order_number: orderNumber, rep_id: repId, date_of_order: new Date().toISOString().split('T')[0], items })
    });
    const data = await res.json();
    if (data.success) {
      alert('Issue Order Saved Successfully');
      onComplete();
    } else {
      alert(data.message);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-8 rounded-2xl border border-zinc-100 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Order Number</label>
            <input type="text" value={orderNumber} readOnly className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm font-mono" />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Representative ID</label>
            <input type="number" value={repId} onChange={e => setRepId(parseInt(e.target.value))} required className="w-full px-4 py-2 border border-zinc-200 rounded-lg text-sm" />
          </div>
        </div>

        <div className="border border-zinc-100 rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase">Product</th>
                <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase w-32">Quantity</th>
                <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {items.map((item, i) => (
                <tr key={i}>
                  <td className="p-2">
                    <select
                      value={item.product_id}
                      onChange={e => updateItem(i, 'product_id', e.target.value)}
                      className="w-full px-2 py-1 border border-zinc-200 rounded text-sm"
                      required
                    >
                      <option value="0">Select Product</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.description} {p.model ? `[${p.model}]` : ''} ({p.current_stock} available)</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={item.quantity}
                      min="1"
                      onChange={e => updateItem(i, 'quantity', e.target.value)}
                      className={`w-full px-2 py-1 border rounded text-sm transition-all ${item.error ? 'border-red-500 bg-red-50 text-red-900 ring-1 ring-red-500' : 'border-zinc-200'
                        }`}
                      required
                    />
                    {item.error && <p className="text-[10px] text-red-500 mt-1 font-bold">{item.error}</p>}
                  </td>
                  <td className="p-2">
                    <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={addItem} className="w-full py-3 bg-zinc-50 text-zinc-500 text-xs font-bold hover:bg-zinc-100 transition-colors flex items-center justify-center gap-2">
            <Plus size={14} /> Add Product
          </button>
        </div>

        <div className="flex justify-end pt-6 border-t border-zinc-100">
          <button
            type="submit"
            disabled={hasErrors}
            className="px-8 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Issue Order
          </button>
        </div>
      </form>
    </motion.div>
  );
};

const CustomerModule = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({ customer_name: '', address: '', contact_number: '', company_name: '' });

  useEffect(() => { fetchCustomers(); }, []);

  const fetchCustomers = () => fetch('/api/customers').then(res => res.json()).then(setCustomers);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = isEditing ? `/api/customers/${isEditing.id}` : '/api/customers';
    const method = isEditing ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (res.ok) {
      alert(isEditing ? 'Customer Updated' : 'Customer Added');
      setFormData({ customer_name: '', address: '', contact_number: '', company_name: '' });
      setIsEditing(null);
      fetchCustomers();
    }
  };

  const filtered = customers.filter(c =>
    c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    c.company_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="bg-white p-8 rounded-2xl border border-zinc-100 shadow-sm">
        <h3 className="font-bold text-zinc-900 mb-6">{isEditing ? 'Edit Customer' : 'Add New Customer'}</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <input
            placeholder="Customer Name"
            value={formData.customer_name}
            onChange={e => setFormData({ ...formData, customer_name: e.target.value })}
            className="px-4 py-2 border border-zinc-200 rounded-lg text-sm" required
          />
          <input
            placeholder="Company Name"
            value={formData.company_name}
            onChange={e => setFormData({ ...formData, company_name: e.target.value })}
            className="px-4 py-2 border border-zinc-200 rounded-lg text-sm" required
          />
          <input
            placeholder="Contact Number"
            value={formData.contact_number}
            onChange={e => setFormData({ ...formData, contact_number: e.target.value })}
            className="px-4 py-2 border border-zinc-200 rounded-lg text-sm" required
          />
          <input
            placeholder="Address"
            value={formData.address}
            onChange={e => setFormData({ ...formData, address: e.target.value })}
            className="px-4 py-2 border border-zinc-200 rounded-lg text-sm" required
          />
          <div className="lg:col-span-4 flex justify-end gap-2">
            {isEditing && <button type="button" onClick={() => { setIsEditing(null); setFormData({ customer_name: '', address: '', contact_number: '', company_name: '' }); }} className="px-4 py-2 text-zinc-500 text-sm">Cancel</button>}
            <button type="submit" className="px-6 py-2 bg-zinc-900 text-white rounded-lg text-sm font-bold">{isEditing ? 'Update' : 'Save'} Customer</button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="font-bold text-zinc-900">Customer List</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input
              placeholder="Search customers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 border border-zinc-200 rounded-lg text-sm"
            />
          </div>
        </div>
        <table className="w-full text-left">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase">Name</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase">Company</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase">Contact</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-zinc-900">{c.customer_name}</td>
                <td className="px-6 py-4 text-sm text-zinc-600">{c.company_name}</td>
                <td className="px-6 py-4 text-sm text-zinc-600">{c.contact_number}</td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button onClick={() => { setIsEditing(c); setFormData(c); }} className="text-zinc-400 hover:text-zinc-900"><Edit size={16} /></button>
                  <button onClick={() => { if (confirm('Delete?')) fetch(`/api/customers/${c.id}`, { method: 'DELETE' }).then(fetchCustomers); }} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

const CreditNoteModule = ({ onComplete }: { onComplete: () => void }) => {
  const [cnNumber, setCnNumber] = useState(`CN-${Date.now().toString().slice(-6)}`);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [remarks, setRemarks] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchInvoice = async () => {
    if (!invoiceNumber) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/invoices/${invoiceNumber}`);
      const data = await res.json();
      if (data.success === false) {
        alert(data.message);
        setInvoiceData(null);
      } else {
        setInvoiceData(data);
        setItems(data.items.map((item: any) => ({
          ...item,
          quantity: 0, // Start with 0 to return
          unit_price: item.unit_price,
          part_number: '',
          brand: '',
          model: item.model || '',
          additional_description: ''
        })));
      }
    } catch (err) {
      alert('Error fetching invoice');
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    const item = newItems[index];

    if (field === 'quantity') {
      const qty = parseInt(value) || 0;
      if (qty > item.quantity_sold) {
        alert(`Cannot return more than sold (${item.quantity_sold})`);
        return;
      }
      item.quantity = qty;
    } else {
      item[field] = value;
    }
    setItems(newItems);
  };

  const totalBillValue = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const discountAmount = (totalBillValue * discountPercent) / 100;
  const grandTotal = totalBillValue - discountAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceData) return;

    const returnItems = items.filter(i => i.quantity > 0);
    if (returnItems.length === 0) return alert('Add at least one item to return');

    const res = await fetch('/api/credit-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credit_note_number: cnNumber,
        invoice_id: invoiceData.id,
        customer_id: invoiceData.customer_id,
        date_of_return: new Date().toISOString().split('T')[0],
        remarks,
        discount_percent: discountPercent,
        items: returnItems
      })
    });

    const data = await res.json();
    if (data.success) {
      const link = document.createElement('a');
      link.href = `/api/credit-notes/${data.cnId}/pdf`;
      link.download = `CreditNote_${cnNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      alert('Credit Note Saved Successfully');
      onComplete();
    } else {
      alert(data.message);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="bg-white p-8 rounded-2xl border border-zinc-100 shadow-sm">
        <div className="flex items-end gap-4 mb-8">
          <div className="flex-1">
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Original Invoice Number</label>
            <input
              placeholder="e.admin INV-123456"
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              className="w-full px-4 py-2 border border-zinc-200 rounded-lg text-sm"
            />
          </div>
          <button
            onClick={fetchInvoice}
            disabled={loading}
            className="px-6 py-2 bg-zinc-900 text-white rounded-lg text-sm font-bold hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Fetch Invoice'}
          </button>
        </div>

        {invoiceData && (
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase">Customer Details</p>
                <p className="text-sm font-bold text-zinc-900 mt-1">{invoiceData.customer_name}</p>
                <p className="text-xs text-zinc-500">{invoiceData.company_name}</p>
                <p className="text-xs text-zinc-500">{invoiceData.address}</p>
                <p className="text-xs text-zinc-500">{invoiceData.contact_number}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase">Credit Note Info</p>
                <p className="text-sm font-bold text-zinc-900 mt-1">{cnNumber}</p>
                <p className="text-xs text-zinc-500">Date: {new Date().toLocaleDateString()}</p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Remarks</label>
                <textarea
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-xs h-16"
                  placeholder="Reason for return..."
                />
              </div>
            </div>

            <div className="border border-zinc-100 rounded-xl overflow-x-auto">
              <table className="w-full text-left min-w-[1000px]">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase">Part #</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase">Description</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase">Brand/Model</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase w-20">Sold</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase w-24">Return</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase w-32">Price</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase w-32">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {items.map((item, i) => (
                    <tr key={i}>
                      <td className="p-2"><input value={item.part_number} onChange={e => updateItem(i, 'part_number', e.target.value)} className="w-full px-2 py-1 border border-zinc-200 rounded text-xs" /></td>
                      <td className="p-2">
                        <p className="text-xs font-medium text-zinc-900">{item.description}</p>
                        <input placeholder="Add. Desc" value={item.additional_description} onChange={e => updateItem(i, 'additional_description', e.target.value)} className="w-full px-2 py-1 border border-zinc-200 rounded text-[10px] mt-1" />
                      </td>
                      <td className="p-2">
                        <input placeholder="Brand" value={item.brand} onChange={e => updateItem(i, 'brand', e.target.value)} className="w-full px-2 py-1 border border-zinc-200 rounded text-[10px]" />
                        <input placeholder="Model" value={item.model} onChange={e => updateItem(i, 'model', e.target.value)} className="w-full px-2 py-1 border border-zinc-200 rounded text-[10px] mt-1" />
                      </td>
                      <td className="px-4 py-2 text-xs text-zinc-400 font-bold">{item.quantity_sold}</td>
                      <td className="p-2"><input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} className="w-full px-2 py-1 border border-zinc-200 rounded text-xs font-bold" /></td>
                      <td className="px-4 py-2 text-xs text-zinc-900 font-medium">Rs. {item.unit_price.toFixed(2)}</td>
                      <td className="px-4 py-2 text-xs text-zinc-900 font-bold">Rs. {(item.quantity * item.unit_price).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col items-end gap-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-8">
                <p className="text-[10px] font-bold text-zinc-400 uppercase">Total Bill Value</p>
                <p className="text-lg font-bold text-zinc-900">Rs. {totalBillValue.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-4">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Discount (%)</label>
                <input
                  type="number"
                  value={discountPercent}
                  onChange={e => setDiscountPercent(parseFloat(e.target.value) || 0)}
                  className="w-24 px-3 py-1 border border-zinc-200 rounded-lg text-sm text-right"
                />
                <p className="text-xs text-zinc-400">Amount: Rs. {discountAmount.toFixed(2)}</p>
              </div>
              <div className="text-right mt-4">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Overridden Amount</p>
                <h4 className="text-3xl font-bold text-zinc-900">Rs. 120.00</h4>
              </div>
              <button type="submit" className="mt-4 px-10 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 shadow-lg">Save Credit Note</button>
            </div>
          </form>
        )}
      </div>
    </motion.div>
  );
};
