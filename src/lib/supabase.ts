import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your-project-id')
);

// Fallback dummy client if credentials are not yet configured (prevents crash on load)
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key'
);

export interface Part {
  id: string;
  part_no: string;
  barcode: string | null;
  name: string;
  category: string;
  rack: string;
  stock: number;
  min_stock: number;
  unit: string;
  image_url: string | null;
  is_archived: boolean;
  archived_at: string | null;
}

export interface StockLog {
  id: string;
  timestamp: string;
  part_no: string;
  part_name: string;
  type: 'IN' | 'OUT';
  qty: number;
  unit: string;
  ref: string | null;
  user: string | null;
  note: string | null;
}

export interface OrderItem {
  partNo: string;
  name: string;
  qty: number;
  unit: string;
}

export interface Order {
  id: string;
  branch_id: string;
  branch_name: string;
  wo_number: string;
  date: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  notes: string | null;
  items: OrderItem[];
}

export interface ChatMessage {
  id: string;
  branch_id: string;
  branch_name: string;
  sender_role: 'branch' | 'admin';
  sender_name: string;
  message: string;
  created_at: string;
}

export interface Branch {
  id: string;
  name: string;
  user: string;
  pass: string;
}

export const BRANCHES: Branch[] = [
  { id: 'jakarta', name: 'Cabang Jakarta', user: 'jakarta', pass: 'jkt123' },
  { id: 'bandung', name: 'Cabang Bandung', user: 'bandung', pass: 'bdg123' },
  { id: 'semarang', name: 'Cabang Semarang', user: 'semarang', pass: 'smg123' },
  { id: 'surabaya', name: 'Cabang Surabaya', user: 'surabaya', pass: 'sby123' },
  { id: 'medan', name: 'Cabang Medan', user: 'medan', pass: 'mdn123' },
  { id: 'palembang', name: 'Cabang Palembang', user: 'palembang', pass: 'plm123' },
  { id: 'makassar', name: 'Cabang Makassar', user: 'makassar', pass: 'mks123' },
];
