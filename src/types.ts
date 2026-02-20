export interface User {
  id: number;
  name: string;
  email: string;
  role: 'Admin' | 'InventoryManager' | 'Rep';
}

export interface Product {
  id: number;
  product_code: string;
  description: string;
  model?: string;
  brand?: string;
  unit_price: number;
  current_stock: number;
  min_stock_threshold: number;
  created_at: string;
}

export interface Customer {
  id: number;
  customer_name: string;
  address: string;
  contact_number: string;
  company_name: string;
  created_at: string;
}

export interface CreditNote {
  id: number;
  credit_note_number: string;
  invoice_id: number;
  customer_id: number;
  date_of_return: string;
  remarks: string;
  total_bill_value: number;
  discount_percent: number;
  discount_amount: number;
  grand_total: number;
  created_at: string;
}

export interface DashboardStats {
  totalProducts: number;
  lowStockCount: number;
  totalSales: number;
  activeAlerts: Alert[];
}

export interface Alert {
  id: number;
  product_id: number;
  message: string;
  status: string;
  created_at: string;
}
