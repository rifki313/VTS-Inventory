import { Search } from 'lucide-react';
import { BRANCHES } from '@/lib/supabase';

export interface OrderFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  month: string;
  onMonthChange: (value: string) => void;
  year: string;
  onYearChange: (value: string) => void;
  branch: string;
  onBranchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  years: string[];
  showBranch?: boolean;
  onReset: () => void;
}

export function OrderFilters({
  searchQuery, onSearchChange, month, onMonthChange, year, onYearChange,
  branch, onBranchChange, status, onStatusChange, years, showBranch = false, onReset,
}: OrderFiltersProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Filter Riwayat Order</h2>
          <p className="text-xs text-slate-500">Gabungkan beberapa filter untuk menemukan order dengan cepat</p>
        </div>
        <button onClick={onReset} className="text-xs font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap">Reset Filter</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input type="text" placeholder="Cari No. Order, WO, atau Cabang" value={searchQuery}
            onChange={e => onSearchChange(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={month} onChange={e => onMonthChange(e.target.value)} className="p-2 border rounded-lg text-sm bg-white">
          <option value="ALL">Semua Bulan</option>
          <option value="01">Januari</option><option value="02">Februari</option><option value="03">Maret</option>
          <option value="04">April</option><option value="05">Mei</option><option value="06">Juni</option>
          <option value="07">Juli</option><option value="08">Agustus</option><option value="09">September</option>
          <option value="10">Oktober</option><option value="11">November</option><option value="12">Desember</option>
        </select>
        <select value={year} onChange={e => onYearChange(e.target.value)} className="p-2 border rounded-lg text-sm bg-white">
          <option value="ALL">Semua Tahun</option>
          {years.map(orderYear => <option key={orderYear} value={orderYear}>{orderYear}</option>)}
        </select>
        {showBranch && (
          <select value={branch} onChange={e => onBranchChange(e.target.value)} className="p-2 border rounded-lg text-sm bg-white">
            <option value="ALL">Semua Cabang</option>
            {BRANCHES.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        )}
        <select value={status} onChange={e => onStatusChange(e.target.value)} className="p-2 border rounded-lg text-sm bg-white">
          <option value="ALL">Semua Status</option>
          <option value="Pending">Menunggu Konfirmasi</option>
          <option value="Approved">Disetujui</option>
          <option value="Rejected">Ditolak</option>
        </select>
      </div>
    </div>
  );
}
