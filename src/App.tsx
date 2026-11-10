import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package, ShoppingCart, Truck, Clock, CheckCircle2, AlertTriangle,
  Search, Plus, Edit, Trash2, FileText, MessageCircle, Send,
  Download, Upload, LogOut, QrCode, Camera, Printer, ScanLine, X,
  Archive, RotateCcw, Copy, CheckSquare, Square, AlertCircle,
} from 'lucide-react';
import {
  supabase,
  isSupabaseConfigured,
  type Part, type StockLog, type Order, type OrderItem, type ChatMessage,
  BRANCHES,
} from '@/lib/supabase';
import { OrderFilters } from '@/components/OrderFilters';
import { SortableTh } from '@/components/SortableTh';

interface CurrentUser {
  role: 'admin' | 'branch';
  id?: string;
  name: string;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [logs, setLogs] = useState<StockLog[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [cart, setCart] = useState<(Part & { qty: number })[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState('ALL');
  const [selectedRackFilter, setSelectedRackFilter] = useState('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'low' | 'out' | 'ok'>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'part_no' | 'stock' | 'rack' | 'category'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedPartIds, setSelectedPartIds] = useState<Set<string>>(new Set());
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showPreviewImport, setShowPreviewImport] = useState<false | { items: Record<string, unknown>[]; conflicts: Record<string, unknown>[]; }>(false);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderMonthFilter, setOrderMonthFilter] = useState('ALL');
  const [orderYearFilter, setOrderYearFilter] = useState('ALL');
  const [orderBranchFilter, setOrderBranchFilter] = useState('ALL');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');

  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showOpnameModal, setShowOpnameModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showBarcodePrintModal, setShowBarcodePrintModal] = useState<Part | null>(null);
  const [scannedResultModal, setScannedResultModal] = useState<{
    type: 'part' | 'rack';
    data?: Part;
    rackCode?: string;
    items?: Part[];
  } | null>(null);

  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [selectedPartForAction, setSelectedPartForAction] = useState<Part | null>(null);

  const [partForm, setPartForm] = useState({
    id: '',
    partNo: '', barcode: '', name: '', category: 'Syringe',
    rack: 'RACK-A-01', stock: 0, minStock: 5, unit: 'unit', imageUrl: '',
  });
  const [actionQty, setActionQty] = useState(1);
  const [actionNote, setActionNote] = useState('');
  const [woInput, setWoInput] = useState('');
  const [orderNotesInput, setOrderNotesInput] = useState('');
  const [manualScanInput, setManualScanInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [selectedChatBranch, setSelectedChatBranch] = useState('ALL');

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- Data loading ---
  const loadParts = useCallback(async () => {
    const { data, error } = await supabase.from('parts').select('*').order('name');
    if (error) { showToast('Gagal memuat data sparepart', 'error'); return; }
    setParts((data || []) as Part[]);
  }, []);

  const duplicateGroups = useMemo(() => {
    const active = parts.filter(p => !p.is_archived);
    const groups: { key: string; field: string; items: Part[] }[] = [];
    const byPartNo = new Map<string, Part[]>();
    active.forEach(p => {
      const k = p.part_no.trim().toUpperCase();
      if (!k) return;
      const arr = byPartNo.get(k) || [];
      arr.push(p);
      byPartNo.set(k, arr);
    });
    byPartNo.forEach((items, key) => {
      if (items.length > 1) groups.push({ key, field: 'Part No', items });
    });
    const byName = new Map<string, Part[]>();
    active.forEach(p => {
      const k = p.name.trim().toLowerCase();
      if (!k) return;
      const arr = byName.get(k) || [];
      arr.push(p);
      byName.set(k, arr);
    });
    byName.forEach((items, key) => {
      if (items.length > 1) groups.push({ key, field: 'Nama Barang', items });
    });
    const byBarcode = new Map<string, Part[]>();
    active.forEach(p => {
      if (!p.barcode) return;
      const k = p.barcode.trim().toUpperCase();
      if (!k) return;
      const arr = byBarcode.get(k) || [];
      arr.push(p);
      byBarcode.set(k, arr);
    });
    byBarcode.forEach((items, key) => {
      if (items.length > 1) groups.push({ key, field: 'Barcode', items });
    });
    return groups;
  }, [parts]);

  const loadOrders = useCallback(async () => {
    const { data, error } = await supabase.from('orders').select('*').order('date', { ascending: false });
    if (error) { showToast('Gagal memuat data order', 'error'); return; }
    setOrders((data || []) as Order[]);
  }, []);

  const loadLogs = useCallback(async () => {
    const { data, error } = await supabase.from('logs').select('*').order('created_at', { ascending: false });
    if (error) { showToast('Gagal memuat riwayat mutasi', 'error'); return; }
    setLogs((data || []) as StockLog[]);
  }, []);

  const loadChatMessages = useCallback(async () => {
    const { data, error } = await supabase.from('chat_messages').select('*').order('created_at', { ascending: true });
    if (error) { showToast('Gagal memuat pesan chat', 'error'); return; }
    setChatMessages((data || []) as ChatMessage[]);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    (async () => {
      await Promise.all([loadParts(), loadOrders(), loadLogs(), loadChatMessages()]);
      setLoading(false);
    })();
  }, [loadParts, loadOrders, loadLogs, loadChatMessages]);

  const nowTimestamp = () => new Date().toISOString().replace('T', ' ').substring(0, 16);

  // --- Login ---
  const handleLogin = (username: string, password: string) => {
    if (username === 'admin' && password === 'admin123') {
      setCurrentUser({ role: 'admin', name: 'VTS Pusat (Admin)' });
      setActiveTab('dashboard');
      showToast('Login berhasil sebagai Admin VTS Pusat');
      return;
    }
    const branch = BRANCHES.find(b => b.user === username && b.pass === password);
    if (branch) {
      setCurrentUser({ role: 'branch', id: branch.id, name: branch.name });
      setActiveTab('catalog');
      showToast(`Login berhasil sebagai ${branch.name}`);
      return;
    }
    showToast('Username atau Password salah!', 'error');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCart([]);
    setChatInput('');
    setSelectedChatBranch('ALL');
    showToast('Berhasil keluar dari sistem');
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = chatInput.trim();
    const branch = currentUser?.role === 'branch'
      ? BRANCHES.find(item => item.id === currentUser.id)
      : BRANCHES.find(item => item.id === selectedChatBranch);
    if (!currentUser || !message || !branch) return;
    const { error } = await supabase.from('chat_messages').insert({
      id: `MSG-${Date.now()}`,
      branch_id: branch.id,
      branch_name: branch.name,
      sender_role: currentUser.role,
      sender_name: currentUser.name,
      message,
    });
    if (error) { showToast('Pesan belum dapat dikirim', 'error'); return; }
    setChatInput('');
    await loadChatMessages();
  };

  const handleAskAdminAboutStock = async (part: Part) => {
    if (!currentUser?.id) return;
    const branch = BRANCHES.find(item => item.id === currentUser.id);
    if (!branch) return;
    const message = `Halo Admin, stok ${part.name} (${part.part_no}) sedang kosong. Mohon info ketersediaan atau estimasi restock.`;
    const { error } = await supabase.from('chat_messages').insert({
      id: `MSG-${Date.now()}`,
      branch_id: branch.id,
      branch_name: branch.name,
      sender_role: currentUser.role,
      sender_name: currentUser.name,
      message,
    });
    if (error) { showToast('Pesan belum dapat dikirim', 'error'); return; }
    await loadChatMessages();
    setActiveTab('chat');
    showToast('Pesan stok kosong berhasil dikirim ke Admin Pusat');
  };

  // --- Master Data ---
  const handleSavePart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partForm.partNo || !partForm.name) {
      showToast('Harap isi Kode Part dan Nama Barang!', 'error');
      return;
    }
    const payload = {
      part_no: partForm.partNo,
      barcode: partForm.barcode || partForm.partNo,
      name: partForm.name,
      category: partForm.category,
      rack: partForm.rack,
      stock: Number(partForm.stock),
      min_stock: Number(partForm.minStock),
      unit: partForm.unit,
      image_url: partForm.imageUrl || null,
    };

    if (editingPart) {
      const { error } = await supabase.from('parts').update(payload).eq('id', editingPart.id);
      if (error) { showToast('Gagal memperbarui data', 'error'); return; }
      showToast('Data sparepart berhasil diperbarui');
    } else {
      const newId = Date.now().toString();
      const { error } = await supabase.from('parts').insert({ ...payload, id: newId });
      if (error) { showToast('Gagal menambahkan sparepart', 'error'); return; }
      showToast('Sparepart baru berhasil ditambahkan');
    }

    await loadParts();
    setShowAddPartModal(false);
    setEditingPart(null);
    setPartForm({ id: '', partNo: '', barcode: '', name: '', category: 'Syringe', rack: 'RACK-A-01', stock: 0, minStock: 5, unit: 'unit', imageUrl: '' });
  };

  const handleDeletePart = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin mengarsipkan sparepart ini? Data dapat dipulihkan kembali.')) return;
    const { error } = await supabase.from('parts').update({ is_archived: true, archived_at: new Date().toISOString() }).eq('id', id);
    if (error) { showToast('Gagal mengarsipkan sparepart', 'error'); return; }
    await loadParts();
    showToast('Sparepart berhasil diarsipkan');
  };

  const handleRestorePart = async (id: string) => {
    const { error } = await supabase.from('parts').update({ is_archived: false, archived_at: null }).eq('id', id);
    if (error) { showToast('Gagal memulihkan sparepart', 'error'); return; }
    await loadParts();
    showToast('Sparepart berhasil dipulihkan');
  };

  const handlePermanentDelete = async (id: string) => {
    if (!window.confirm('HAPUS PERMANEN: data akan benar-benar terhapus dan tidak bisa dipulihkan. Lanjutkan?')) return;
    const { error } = await supabase.from('parts').delete().eq('id', id);
    if (error) { showToast('Gagal menghapus permanen', 'error'); return; }
    await loadParts();
    showToast('Sparepart dihapus permanen');
  };

  const handleBulkArchive = async () => {
    if (selectedPartIds.size === 0) { showToast('Pilih data yang ingin diarsipkan dulu', 'error'); return; }
    if (!window.confirm(`Arsipkan ${selectedPartIds.size} data sparepart terpilih?`)) return;
    const { error } = await supabase.from('parts')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .in('id', Array.from(selectedPartIds));
    if (error) { showToast('Gagal mengarsipkan massal', 'error'); return; }
    await loadParts();
    setSelectedPartIds(new Set());
    showToast(`${selectedPartIds.size} data berhasil diarsipkan`);
  };

  const handleBulkPermanentDelete = async () => {
    if (selectedPartIds.size === 0) return;
    const count = selectedPartIds.size;
    if (!window.confirm(`HAPUS PERMANEN ${count} data arsip terpilih? Data tidak dapat dipulihkan setelah dihapus.`)) return;
    const { error } = await supabase.from('parts').delete().in('id', Array.from(selectedPartIds));
    if (error) { showToast('Gagal menghapus data terpilih', 'error'); return; }
    await loadParts();
    setSelectedPartIds(new Set());
    showToast(`${count} data berhasil dihapus permanen`);
  };

  const handleAutoArchiveDuplicates = async () => {
    const duplicateIds = new Set<string>();
    duplicateGroups.forEach(group => {
      group.items.slice(1).forEach(item => duplicateIds.add(item.id));
    });
    const ids = Array.from(duplicateIds);
    if (ids.length === 0) {
      showToast('Tidak ada salinan data yang perlu diarsipkan');
      return;
    }
    if (!window.confirm(`Arsipkan otomatis ${ids.length} data ganda? Satu data utama pada setiap kelompok akan dipertahankan dan data arsip masih dapat dipulihkan.`)) return;
    const { error } = await supabase.from('parts')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .in('id', ids);
    if (error) { showToast('Gagal membersihkan data ganda', 'error'); return; }
    await loadParts();
    showToast(`${ids.length} data ganda berhasil diarsipkan`);
  };

  // --- Restock ---
  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartForAction || actionQty <= 0) return;
    const newStock = selectedPartForAction.stock + Number(actionQty);
    const { error: updErr } = await supabase.from('parts').update({ stock: newStock }).eq('id', selectedPartForAction.id);
    if (updErr) { showToast('Gagal merestock', 'error'); return; }

    const logId = 'l_' + Date.now();
    const { error: logErr } = await supabase.from('logs').insert({
      id: logId,
      timestamp: nowTimestamp(),
      part_no: selectedPartForAction.part_no,
      part_name: selectedPartForAction.name,
      type: 'IN',
      qty: Number(actionQty),
      unit: selectedPartForAction.unit,
      ref: actionNote || 'Restock Manual',
      user: currentUser?.name || 'System',
      note: 'Penerimaan/Restock Barang',
    });
    if (logErr) { showToast('Gagal mencatat log', 'error'); return; }

    await Promise.all([loadParts(), loadLogs()]);
    setShowRestockModal(false);
    setScannedResultModal(null);
    setActionQty(1);
    setActionNote('');
    showToast(`Berhasil menambah ${actionQty} ${selectedPartForAction.unit} stok ${selectedPartForAction.name}`);
  };

  // --- Stock Opname ---
  const handleStockOpname = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartForAction) return;
    const diff = Number(actionQty) - selectedPartForAction.stock;
    const { error: updErr } = await supabase.from('parts').update({ stock: Number(actionQty) }).eq('id', selectedPartForAction.id);
    if (updErr) { showToast('Gagal menyimpan opname', 'error'); return; }

    if (diff !== 0) {
      const logId = 'l_' + Date.now();
      const { error: logErr } = await supabase.from('logs').insert({
        id: logId,
        timestamp: nowTimestamp(),
        part_no: selectedPartForAction.part_no,
        part_name: selectedPartForAction.name,
        type: diff >= 0 ? 'IN' : 'OUT',
        qty: Math.abs(diff),
        unit: selectedPartForAction.unit,
        ref: 'STOCK-OPNAME',
        user: currentUser?.name || 'System',
        note: `Penyesuaian Stock Opname (${actionNote || 'Sesuai Fisik Rak'})`,
      });
      if (logErr) { showToast('Gagal mencatat log opname', 'error'); return; }
    }

    await Promise.all([loadParts(), loadLogs()]);
    setShowOpnameModal(false);
    setScannedResultModal(null);
    setActionQty(1);
    setActionNote('');
    showToast(`Stock Opname berhasil disimpan. Stok fisik disesuaikan ke ${actionQty} ${selectedPartForAction.unit}`);
  };

  // --- Cart ---
  const addToCart = (part: Part) => {
    const existing = cart.find(item => item.id === part.id);
    if (existing) {
      if (existing.qty + 1 > part.stock) {
        showToast('Jumlah melebihi batas stok gudang pusat!', 'error');
        return;
      }
      setCart(cart.map(item => item.id === part.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      if (part.stock < 1) {
        showToast('Stok barang sedang kosong!', 'error');
        return;
      }
      setCart([...cart, { ...part, qty: 1 }]);
    }
    showToast(`${part.name} ditambahkan ke keranjang`);
  };

  const removeFromCart = (id: string) => setCart(cart.filter(item => item.id !== id));

  // --- Checkout ---
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) { showToast('Keranjang order kosong!', 'error'); return; }
    if (!woInput.trim()) { showToast('Nomor Work Order (WO) wajib diisi!', 'error'); return; }
    if (!currentUser?.id) return;

    const newOrderId = 'ORD-' + Date.now().toString().slice(-5);
    const items: OrderItem[] = cart.map(item => ({
      partNo: item.part_no, name: item.name, qty: item.qty, unit: item.unit,
    }));

    const { error } = await supabase.from('orders').insert({
      id: newOrderId,
      branch_id: currentUser.id,
      branch_name: currentUser.name,
      wo_number: woInput,
      date: nowTimestamp(),
      status: 'Pending',
      notes: orderNotesInput || null,
      items: items as unknown as Record<string, unknown>[],
    });
    if (error) { showToast('Gagal mengajukan order', 'error'); return; }

    await loadOrders();
    setCart([]);
    setWoInput('');
    setOrderNotesInput('');
    setActiveTab('my-orders');
    showToast('Order berhasil diajukan ke VTS Pusat');
  };

  // --- Order approval ---
  const handleApproveOrder = async (order: Order) => {
    for (const item of order.items) {
      const cp = parts.find(p => p.part_no === item.partNo);
      if (!cp || cp.stock < item.qty) {
        showToast(`Stok ${item.name} tidak mencukupi untuk menyetujui order ini!`, 'error');
        return;
      }
    }

    for (const item of order.items) {
      const cp = parts.find(p => p.part_no === item.partNo);
      if (!cp) continue;
      const newStock = cp.stock - item.qty;
      await supabase.from('parts').update({ stock: newStock }).eq('id', cp.id);

      const logId = 'l_' + Math.random().toString(36).substring(2, 10);
      await supabase.from('logs').insert({
        id: logId,
        timestamp: nowTimestamp(),
        part_no: item.partNo,
        part_name: item.name,
        type: 'OUT',
        qty: item.qty,
        unit: item.unit,
        ref: order.wo_number,
        user: order.branch_name,
        note: `Pengiriman Order Cabang (${order.id})`,
      });
    }

    await supabase.from('orders').update({ status: 'Approved' }).eq('id', order.id);
    await Promise.all([loadParts(), loadOrders(), loadLogs()]);
    showToast(`Order ${order.id} berhasil disetujui & stok telah dipotong`);
  };

  const handleRejectOrder = async (order: Order) => {
    const { error } = await supabase.from('orders').update({ status: 'Rejected' }).eq('id', order.id);
    if (error) { showToast('Gagal menolak order', 'error'); return; }
    await loadOrders();
    showToast(`Order ${order.id} ditolak`);
  };

  // --- Barcode scanning ---
  const handleProcessBarcodeScan = (code: string) => {
    const query = code.trim().toUpperCase();
    const matchedPart = parts.find(p =>
      p.part_no.toUpperCase() === query ||
      (p.barcode && p.barcode.toUpperCase() === query)
    );
    if (matchedPart) {
      setScannedResultModal({ type: 'part', data: matchedPart });
      setShowScannerModal(false);
      setManualScanInput('');
      return;
    }
    const rackParts = parts.filter(p => p.rack.toUpperCase() === query);
    if (rackParts.length > 0) {
      setScannedResultModal({ type: 'rack', rackCode: query, items: rackParts });
      setShowScannerModal(false);
      setManualScanInput('');
      return;
    }
    showToast(`Kode / Barcode "${code}" tidak ditemukan di database system!`, 'error');
  };

  // --- CSV ---
  const handleDownloadTemplate = () => {
    const csv = "data:text/csv;charset=utf-8," +
      "partNo,barcode,name,category,rack,stock,minStock,unit,imageUrl\n" +
      "SOC-003,SOC-003,Socorex Syringe 1-5 ml,Syringe,RACK-A-03,10,2,unit,\n" +
      "VAL-002,VAL-002,Chick Master Solenoid Valve,Valve,RACK-C-06,5,2,pcs,";
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = 'Template_Import_Sparepart_VTS.csv';
    link.click();
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = String(evt.target?.result || '');
      const lines = text.split('\n');
      const newItems: Record<string, unknown>[] = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = lines[i].split(',');
        if (cols.length >= 5) {
          newItems.push({
            id: 'imp_' + Date.now() + '_' + i,
            part_no: cols[0]?.trim() || '',
            barcode: cols[1]?.trim() || cols[0]?.trim() || '',
            name: cols[2]?.trim() || '',
            category: cols[3]?.trim() || 'General',
            rack: cols[4]?.trim() || 'RACK-A-01',
            stock: Number(cols[5]) || 0,
            min_stock: Number(cols[6]) || 5,
            unit: cols[7]?.trim() || 'pcs',
            image_url: cols[8]?.trim() || null,
          });
        }
      }
      if (newItems.length === 0) { showToast('Format CSV tidak valid!', 'error'); return; }
      const existingPartNos = new Set(parts.filter(p => !p.is_archived).map(p => p.part_no.trim().toUpperCase()));
      const conflicts: Record<string, unknown>[] = [];
      const clean: Record<string, unknown>[] = [];
      const seenInFile = new Set<string>();
      newItems.forEach(item => {
        const pn = String(item.part_no).trim().toUpperCase();
        const issues: string[] = [];
        if (!pn) issues.push('Part No kosong');
        if (existingPartNos.has(pn)) issues.push('Part No sudah ada di database');
        if (seenInFile.has(pn)) issues.push('Part No ganda dalam file CSV');
        if (!String(item.name).trim()) issues.push('Nama kosong');
        seenInFile.add(pn);
        if (issues.length) conflicts.push({ ...item, _issues: issues.join('; ') });
        else clean.push(item);
      });
      setShowPreviewImport({ items: clean, conflicts });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!showPreviewImport) return;
    const { error } = await supabase.from('parts').insert(showPreviewImport.items);
    if (error) { showToast('Gagal mengimpor: ' + error.message, 'error'); return; }
    await loadParts();
    showToast(`Berhasil mengimpor ${showPreviewImport.items.length} data sparepart!`);
    setShowPreviewImport(false);
  };

  const handleExportParts = () => {
    let csv = 'ID,Part No,Barcode,Nama Barang,Kategori,Rak,Stok,Min Stok,Satuan\n';
    parts.forEach(p => {
      csv += `"${p.id}","${p.part_no}","${p.barcode || p.part_no}","${p.name}","${p.category}","${p.rack}",${p.stock},${p.min_stock},"${p.unit}"\n`;
    });
    const link = document.createElement('a');
    link.href = encodeURI('data:text/csv;charset=utf-8,' + csv);
    link.download = `Master_Stok_VTS_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPartForm({ ...partForm, imageUrl: String(reader.result) });
      reader.readAsDataURL(file);
    }
  };

  const handleBulkImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const normalize = (value: string) => value.trim().toLowerCase().replace(/\\.[^.]+$/, '');
    const activePartByKey = new Map<string, Part>();
    parts.filter(part => !part.is_archived).forEach(part => {
      activePartByKey.set(normalize(part.part_no), part);
      if (part.barcode) activePartByKey.set(normalize(part.barcode), part);
    });

    const readAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Gagal membaca file foto'));
      reader.readAsDataURL(file);
    });

    let updated = 0;
    let unmatched = 0;
    for (const file of files) {
      const part = activePartByKey.get(normalize(file.name));
      if (!part) {
        unmatched += 1;
        continue;
      }
      const imageUrl = await readAsDataUrl(file);
      const { error } = await supabase.from('parts').update({ image_url: imageUrl }).eq('id', part.id);
      if (error) {
        showToast(`Foto ${file.name} gagal disimpan`, 'error');
        return;
      }
      updated += 1;
    }

    await loadParts();
    showToast(`${updated} foto berhasil dipasang${unmatched > 0 ? `, ${unmatched} file tidak cocok` : ''}`);
  };

  const activeParts = useMemo(() => parts.filter(p => !p.is_archived), [parts]);
  const lowStockCount = activeParts.filter(p => p.stock <= p.min_stock).length;
  const pendingOrdersCount = orders.filter(o => o.status === 'Pending').length;
  const uniqueRacks = Array.from(new Set(parts.filter(p => !p.is_archived).map(p => p.rack)));
  const orderYears = Array.from(new Set(orders.map(order => order.date.slice(0, 4)))).sort((a, b) => b.localeCompare(a));

  const filteredParts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const result = parts.filter(p => {
      if (p.is_archived !== showArchived) return false;
      const matchSearch = !query || p.name.toLowerCase().includes(query) ||
        p.part_no.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        Boolean(p.barcode?.toLowerCase().includes(query));
      const matchRack = selectedRackFilter === 'ALL' || p.rack === selectedRackFilter;
      const matchCategory = selectedCategoryFilter === 'ALL' || p.category === selectedCategoryFilter;
      const matchStock = stockFilter === 'ALL' ||
        (stockFilter === 'out' && p.stock <= 0) ||
        (stockFilter === 'low' && p.stock > 0 && p.stock <= p.min_stock) ||
        (stockFilter === 'ok' && p.stock > p.min_stock);
      return matchSearch && matchRack && matchCategory && matchStock;
    });
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'part_no') cmp = a.part_no.localeCompare(b.part_no);
      else if (sortBy === 'stock') cmp = a.stock - b.stock;
      else if (sortBy === 'rack') cmp = a.rack.localeCompare(b.rack);
      else if (sortBy === 'category') cmp = a.category.localeCompare(b.category);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [parts, searchQuery, selectedRackFilter, selectedCategoryFilter, stockFilter, sortBy, sortDir, showArchived]);

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Konfigurasi Supabase Diperlukan</h2>
          <p className="text-sm text-slate-600 mb-6">
            Aplikasi belum dapat berjalan karena <strong>Environment Variables</strong> Supabase belum disetel pada pengaturan Vercel.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left text-xs font-mono text-slate-700 space-y-2 mb-6">
            <div>
              <span className="font-bold text-slate-900 block">1. VITE_SUPABASE_URL</span>
              <span className="text-slate-500 break-all">https://xmizthhajiwywcgckzst.supabase.co</span>
            </div>
            <div className="pt-2 border-t border-slate-200">
              <span className="font-bold text-slate-900 block">2. VITE_SUPABASE_ANON_KEY</span>
              <span className="text-slate-500 break-all">eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...</span>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Tambahkan kedua variabel di atas di <strong>Vercel &gt; Settings &gt; Environment Variables</strong>, lalu lakukan Redeploy.
          </p>
        </div>
      </div>
    );
  }

  // --- Login View ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center items-center gap-3 mb-4">
              <img src="/logo_romindo.jpeg" alt="Romindo Primavetcom" className="h-12 w-auto object-contain" />
              <span className="h-10 w-px bg-slate-200" />
              <img src="/logo_vts.jpeg" alt="VTS Vaccination Technologies & Services" className="h-12 w-auto object-contain" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">VTS Inventory & Ordering Hub</h1>
            <p className="text-slate-500 text-sm mt-1">Sistem Manajemen Logistik Sparepart Internal</p>
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleLogin((e.currentTarget.username as HTMLInputElement).value, (e.currentTarget.password as HTMLInputElement).value);
          }} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Username</label>
              <input name="username" type="text" required placeholder="Contoh: admin atau jakarta"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Password</label>
              <input name="password" type="password" required placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg shadow-md transition">
              Masuk Sistem
            </button>
          </form>
          <div className="mt-8 pt-6 border-t border-slate-200 text-xs text-slate-500">
            <p className="font-bold text-slate-700 mb-1">Kredensial Demo Login:</p>
            <p>• <strong>VTS Pusat:</strong> admin / admin123</p>
            <p>• <strong>Cabang:</strong> jakarta, bandung, surabaya, dll. / (nama3huruf)123</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-500 font-semibold animate-pulse">Memuat data sistem VTS...</div>
      </div>
    );
  }

  const filteredOrders = orders.filter(order => {
    const query = orderSearchQuery.toLowerCase().trim();
    const matchesSearch = !query || order.id.toLowerCase().includes(query) || order.wo_number.toLowerCase().includes(query) || order.branch_name.toLowerCase().includes(query);
    const matchesMonth = orderMonthFilter === 'ALL' || order.date.slice(5, 7) === orderMonthFilter;
    const matchesYear = orderYearFilter === 'ALL' || order.date.slice(0, 4) === orderYearFilter;
    const matchesBranch = orderBranchFilter === 'ALL' || order.branch_id === orderBranchFilter;
    const matchesStatus = orderStatusFilter === 'ALL' || order.status === orderStatusFilter;
    const matchesCurrentBranch = currentUser.role !== 'branch' || order.branch_id === currentUser.id;
    return matchesSearch && matchesMonth && matchesYear && matchesBranch && matchesStatus && matchesCurrentBranch;
  });
  const resetOrderFilters = () => {
    setOrderSearchQuery('');
    setOrderMonthFilter('ALL');
    setOrderYearFilter('ALL');
    setOrderBranchFilter('ALL');
    setOrderStatusFilter('ALL');
  };
  const visibleChatMessages = chatMessages.filter(message => currentUser.role === 'branch'
    ? message.branch_id === currentUser.id
    : selectedChatBranch === 'ALL' || message.branch_id === selectedChatBranch);

  const navBtn = (tab: string, icon: React.ReactNode, label: string, badge?: number) => (
    <button onClick={() => setActiveTab(tab)}
      className={`px-4 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap ${activeTab === tab ? 'border-blue-500 text-white bg-slate-700' : 'border-transparent text-slate-300 hover:bg-slate-700'}`}>
      {icon} {label}
      {badge !== undefined && badge > 0 && (
        <span className={`font-bold text-xs px-2 py-0.5 rounded-full ${tab === 'orders' ? 'bg-amber-500 text-slate-900' : 'bg-blue-500 text-white'}`}>{badge}</span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white font-medium flex items-center gap-2 ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          {toast.msg}
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <img src="/logo_romindo.jpeg" alt="Romindo Primavetcom" className="h-8 sm:h-9 w-auto max-w-[150px] object-contain" />
              <span className="h-7 w-px bg-slate-300" />
              <img src="/logo_vts.jpeg" alt="VTS Vaccination Technologies & Services" className="h-9 sm:h-10 w-auto max-w-[100px] object-contain" />
            </div>
            <div className="h-6 w-px bg-slate-300 hidden sm:block"></div>
            <span className="text-xs font-semibold text-slate-500 hidden sm:block">Logistics & Order System</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowScannerModal(true)}
              className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-blue-200">
              <ScanLine className="w-4 h-4" /> Scan Barcode
            </button>
            <div className="text-right pl-2 border-l border-slate-200">
              <div className="text-sm font-bold text-slate-800">{currentUser.name}</div>
              <div className="text-xs text-slate-500 capitalize">{currentUser.role === 'admin' ? 'Administrator Pusat' : 'Akses Regional Cabang'}</div>
            </div>
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition" title="Keluar">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-slate-800 text-white shadow-inner">
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {currentUser.role === 'admin' ? (
            <>
              {navBtn('dashboard', <Package className="w-4 h-4" />, 'Dashboard Pusat')}
              {navBtn('orders', <Truck className="w-4 h-4" />, 'Kelola Order Cabang', pendingOrdersCount)}
              {navBtn('parts', <Package className="w-4 h-4" />, 'Master Data & Lokasi Rak')}
              {navBtn('logs', <FileText className="w-4 h-4" />, 'Riwayat Mutasi Stok')}
              {navBtn('chat', <MessageCircle className="w-4 h-4" />, 'Chat Cabang')}
            </>
          ) : (
            <>
              {navBtn('catalog', <Package className="w-4 h-4" />, 'Katalog Sparepart')}
              {navBtn('cart', <ShoppingCart className="w-4 h-4" />, 'Keranjang Order', cart.reduce((a, b) => a + b.qty, 0))}
              {navBtn('my-orders', <Clock className="w-4 h-4" />, 'Status Permintaan Cabang')}
              {navBtn('chat', <MessageCircle className="w-4 h-4" />, 'Chat Admin')}
            </>
          )}
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ADMIN DASHBOARD */}
        {currentUser.role === 'admin' && activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-slate-500 text-xs font-bold uppercase">Total Jenis Sparepart</div>
                  <div className="text-3xl font-extrabold text-slate-800 mt-1">{activeParts.length}</div>
                </div>
                <div className="bg-blue-50 p-3 rounded-xl text-blue-600"><Package className="w-8 h-8" /></div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-slate-500 text-xs font-bold uppercase">Stok Menipis (&lt; Minimum)</div>
                  <div className="text-3xl font-extrabold text-amber-600 mt-1">{lowStockCount}</div>
                </div>
                <div className="bg-amber-50 p-3 rounded-xl text-amber-600"><AlertTriangle className="w-8 h-8" /></div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-slate-500 text-xs font-bold uppercase">Order Cabang Menunggu</div>
                  <div className="text-3xl font-extrabold text-blue-600 mt-1">{pendingOrdersCount}</div>
                </div>
                <div className="bg-blue-50 p-3 rounded-xl text-blue-600"><Truck className="w-8 h-8" /></div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-500" /> Peringatan Stok Menipis di Gudang Pusat
              </h2>
              {activeParts.filter(p => p.stock <= p.min_stock).length === 0 ? (
                <p className="text-slate-500 text-sm">Seluruh stok sparepart aman di atas batas minimum.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-xs">
                      <tr>
                        <th className="p-3">Foto</th><th className="p-3">Part No</th><th className="p-3">Nama Barang</th>
                        <th className="p-3">Lokasi Rak</th><th className="p-3">Stok Saat Ini</th><th className="p-3">Min. Stok</th><th className="p-3">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeParts.filter(p => p.stock <= p.min_stock).map(part => (
                        <tr key={part.id}>
                          <td className="p-3"><img src={part.image_url || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=100'} alt="" className="w-10 h-10 object-cover rounded border" /></td>
                          <td className="p-3 font-bold">{part.part_no}</td>
                          <td className="p-3">{part.name}</td>
                          <td className="p-3 font-semibold text-blue-600">{part.rack}</td>
                          <td className="p-3 font-bold text-red-600">{part.stock} {part.unit}</td>
                          <td className="p-3 text-slate-500">{part.min_stock} {part.unit}</td>
                          <td className="p-3">
                            <button onClick={() => { setSelectedPartForAction(part); setShowRestockModal(true); }}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-semibold">+ Restock</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ADMIN MASTER DATA */}
        {currentUser.role === 'admin' && activeTab === 'parts' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-xl font-bold text-slate-800">Master Data Sparepart & Lokasi Rak</h1>
                <p className="text-slate-500 text-xs">Kelola lokasi rak, cetak label barcode, foto sparepart, cek data ganda, dan arsip</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={handleDownloadTemplate} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                  <Download className="w-4 h-4" /> Template CSV
                </button>
                <label className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-4 h-4" /> Impor CSV
                  <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
                </label>
                <button onClick={handleExportParts} className="bg-slate-700 hover:bg-slate-800 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                  <Download className="w-4 h-4" /> Ekspor CSV
                </button>
                <label className="bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-4 h-4" /> Foto Massal
                  <input type="file" accept="image/*" multiple onChange={handleBulkImageUpload} className="hidden" />
                </label>
                <button onClick={() => setShowDuplicateModal(true)} className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                  <Copy className="w-4 h-4" /> Cek Duplikat {duplicateGroups.length > 0 && <span className="bg-white text-amber-600 text-[10px] font-bold px-1.5 rounded-full">{duplicateGroups.length}</span>}
                </button>
                <button onClick={() => { setEditingPart(null); setPartForm({ id: '', partNo: '', barcode: '', name: '', category: 'Syringe', rack: 'RACK-A-01', stock: 0, minStock: 5, unit: 'unit', imageUrl: '' }); setShowAddPartModal(true); }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Tambah Barang Baru
                </button>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input type="text" placeholder="Cari Part No, Barcode, Nama Barang, atau Kategori..." value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <select value={selectedRackFilter} onChange={e => setSelectedRackFilter(e.target.value)} className="p-2 border rounded-lg text-sm bg-white">
                    <option value="ALL">Semua Rak</option>
                    {uniqueRacks.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <select value={selectedCategoryFilter} onChange={e => setSelectedCategoryFilter(e.target.value)} className="p-2 border rounded-lg text-sm bg-white">
                    <option value="ALL">Semua Kategori</option>
                    {Array.from(new Set(parts.map(p => p.category))).sort().map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={stockFilter} onChange={e => setStockFilter(e.target.value as 'ALL' | 'low' | 'out' | 'ok')} className="p-2 border rounded-lg text-sm bg-white">
                    <option value="ALL">Semua Stok</option>
                    <option value="ok">Stok Aman</option>
                    <option value="low">Stok Menipis</option>
                    <option value="out">Stok Habis</option>
                  </select>
                  <label className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm bg-white cursor-pointer whitespace-nowrap">
                    <input type="checkbox" checked={showArchived} onChange={e => { setShowArchived(e.target.checked); setSelectedPartIds(new Set()); }} className="rounded" />
                    <Archive className="w-3.5 h-3.5 text-slate-500" /> Lihat Arsip
                  </label>
                </div>
              </div>
              {selectedPartIds.size > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <span className="text-xs font-semibold text-blue-700">{selectedPartIds.size} data dipilih</span>
                  <div className="flex gap-2 flex-wrap">
                    {!showArchived && (
                      <button onClick={handleBulkArchive} className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1">
                        <Archive className="w-3.5 h-3.5" /> Arsipkan Terpilih
                      </button>
                    )}
                    {showArchived && (
                      <button onClick={handleBulkPermanentDelete} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1">
                        <Trash2 className="w-3.5 h-3.5" /> Hapus Permanen
                      </button>
                    )}
                    <button onClick={() => setSelectedPartIds(new Set())} className="text-slate-600 px-3 py-1.5 text-xs font-bold">Batal</button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-xs border-b">
                    <tr>
                      <th className="p-2 w-10">
                        <button onClick={() => {
                          const filteredView = filteredParts;
                          const allSelected = filteredView.length > 0 && filteredView.every(p => selectedPartIds.has(p.id));
                          if (allSelected) {
                            const next = new Set(selectedPartIds);
                            filteredView.forEach(p => next.delete(p.id));
                            setSelectedPartIds(next);
                          } else {
                            const next = new Set(selectedPartIds);
                            filteredView.forEach(p => next.add(p.id));
                            setSelectedPartIds(next);
                          }
                        }} className="flex items-center gap-1 hover:text-blue-600">
                          {filteredParts.length > 0 && filteredParts.every(p => selectedPartIds.has(p.id)) ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                        </button>
                      </th>
                      <th className="p-4 w-12">Foto</th>
                      <SortableTh label="Part No / Barcode" field="part_no" sortBy={sortBy} sortDir={sortDir} onSort={(f, d) => { setSortBy(f); setSortDir(d); }} />
                      <SortableTh label="Nama Barang" field="name" sortBy={sortBy} sortDir={sortDir} onSort={(f, d) => { setSortBy(f); setSortDir(d); }} />
                      <SortableTh label="Kategori" field="category" sortBy={sortBy} sortDir={sortDir} onSort={(f, d) => { setSortBy(f); setSortDir(d); }} />
                      <SortableTh label="Lokasi Rak" field="rack" sortBy={sortBy} sortDir={sortDir} onSort={(f, d) => { setSortBy(f); setSortDir(d); }} />
                      <SortableTh label="Stok" field="stock" sortBy={sortBy} sortDir={sortDir} onSort={(f, d) => { setSortBy(f); setSortDir(d); }} />
                      <th className="p-4">Min. Stok</th>
                      <th className="p-4 text-center">Label Barcode</th>
                      <th className="p-4 text-center">Aksi Kelola</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredParts.length === 0 ? (
                      <tr><td colSpan={10} className="p-8 text-center text-slate-400 text-sm">Tidak ada data yang sesuai dengan filter.</td></tr>
                    ) : filteredParts.map(part => {
                      const isDup = duplicateGroups.some(g => g.items.some(i => i.id === part.id));
                      return (
                      <tr key={part.id} className={`hover:bg-slate-50 ${selectedPartIds.has(part.id) ? 'bg-blue-50' : ''} ${part.is_archived ? 'opacity-60' : ''}`}>
                        <td className="p-2">
                          <button onClick={() => {
                            const next = new Set(selectedPartIds);
                            if (next.has(part.id)) next.delete(part.id); else next.add(part.id);
                            setSelectedPartIds(next);
                          }}>
                            {selectedPartIds.has(part.id) ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-slate-300" />}
                          </button>
                        </td>
                        <td className="p-4"><img src={part.image_url || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=100'} alt="" className="w-12 h-12 object-cover rounded-lg border" /></td>
                        <td className="p-4">
                          <div className="font-bold text-slate-800 flex items-center gap-1">
                            {part.part_no}
                            {isDup && <span title="Data ganda terdeteksi" className="bg-red-100 text-red-600 text-[9px] font-bold px-1 rounded">DUPLIKAT</span>}
                          </div>
                          <div className="text-xs text-slate-400 font-mono">BC: {part.barcode || part.part_no}</div>
                        </td>
                        <td className="p-4 font-medium">{part.name}</td>
                        <td className="p-4"><span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{part.category || 'Tanpa kategori'}</span></td>
                        <td className="p-4 font-bold text-blue-600">{part.rack}</td>
                        <td className={`p-4 font-bold ${part.stock <= 0 ? 'text-red-600' : part.stock <= part.min_stock ? 'text-amber-600' : 'text-emerald-700'}`}>{part.stock} {part.unit}</td>
                        <td className="p-4 text-slate-500">{part.min_stock} {part.unit}</td>
                        <td className="p-4 text-center">
                          <button onClick={() => setShowBarcodePrintModal(part)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 mx-auto">
                            <QrCode className="w-3.5 h-3.5" /> Barcode
                          </button>
                        </td>
                        <td className="p-4">
                          <div className="flex justify-center items-center gap-1.5 flex-wrap">
                            {!part.is_archived && (
                              <>
                                <button onClick={() => { setSelectedPartForAction(part); setActionQty(1); setShowRestockModal(true); }} title="Restock" className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-2 py-1 rounded text-xs font-bold">+ Stok</button>
                                <button onClick={() => { setSelectedPartForAction(part); setActionQty(part.stock); setShowOpnameModal(true); }} title="Stock Opname" className="bg-amber-50 text-amber-600 hover:bg-amber-100 px-2 py-1 rounded text-xs font-bold">Opname</button>
                                <button onClick={() => { setEditingPart(part); setPartForm({ id: part.id, partNo: part.part_no, barcode: part.barcode || '', name: part.name, category: part.category, rack: part.rack, stock: part.stock, minStock: part.min_stock, unit: part.unit, imageUrl: part.image_url || '' }); setShowAddPartModal(true); }} className="bg-slate-100 text-slate-600 hover:bg-slate-200 p-1.5 rounded"><Edit className="w-3.5 h-3.5" /></button>
                                <button onClick={() => handleDeletePart(part.id)} title="Arsipkan" className="bg-slate-100 text-slate-600 hover:bg-slate-200 p-1.5 rounded"><Archive className="w-3.5 h-3.5" /></button>
                              </>
                            )}
                            {part.is_archived && (
                              <>
                                <button onClick={() => handleRestorePart(part.id)} className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" /> Pulihkan</button>
                                <button onClick={() => handlePermanentDelete(part.id)} className="bg-red-50 text-red-600 hover:bg-red-100 p-1.5 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ADMIN ORDERS */}
        {currentUser.role === 'admin' && activeTab === 'orders' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-slate-800">Kelola Order Cabang</h1>
              <p className="text-slate-500 text-xs">Persetujuan dan riwayat permintaan barang dari 7 cabang regional</p>
            </div>
            <OrderFilters
              searchQuery={orderSearchQuery}
              onSearchChange={setOrderSearchQuery}
              month={orderMonthFilter}
              onMonthChange={setOrderMonthFilter}
              year={orderYearFilter}
              onYearChange={setOrderYearFilter}
              branch={orderBranchFilter}
              onBranchChange={setOrderBranchFilter}
              status={orderStatusFilter}
              onStatusChange={setOrderStatusFilter}
              years={orderYears}
              showBranch
              onReset={resetOrderFilters}
            />
            <div className="space-y-4">
              {orders.length === 0 ? (
                <p className="text-slate-500 text-sm">Belum ada order dari cabang.</p>
              ) : filteredOrders.length === 0 ? (
                <p className="text-slate-500 text-sm">Tidak ada order yang sesuai dengan filter.</p>
              ) : filteredOrders.map(order => (
                <div key={order.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <div className="flex flex-col sm:flex-row justify-between border-b pb-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-lg">{order.id}</span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${order.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : order.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {order.status === 'Approved' ? 'Disetujui' : order.status === 'Rejected' ? 'Ditolak' : 'Menunggu Konfirmasi'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Cabang Pemohon: <strong>{order.branch_name}</strong> | Tanggal: {order.date}</div>
                      <div className="text-xs font-semibold text-blue-600 mt-0.5">Work Order Ref: {order.wo_number}</div>
                    </div>
                    {order.status === 'Pending' && (
                      <div className="flex gap-2 mt-4 sm:mt-0">
                        <button onClick={() => handleRejectOrder(order)} className="bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-lg text-xs font-bold">Tolak Order</button>
                        <button onClick={() => handleApproveOrder(order)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm">Setujui & Potong Stok</button>
                      </div>
                    )}
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="text-xs font-bold text-slate-600 uppercase mb-2">Daftar Barang Dipesan:</div>
                    <ul className="divide-y divide-slate-200">
                      {order.items.map((item, idx) => (
                        <li key={idx} className="py-2 flex justify-between text-sm">
                          <span><strong>{item.partNo}</strong> - {item.name}</span>
                          <span className="font-bold">{item.qty} {item.unit}</span>
                        </li>
                      ))}
                    </ul>
                    {order.notes && <div className="text-xs text-slate-500 mt-3 border-t pt-2">Catatan Cabang: <em>"{order.notes}"</em></div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ADMIN LOGS */}
        {currentUser.role === 'admin' && activeTab === 'logs' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-slate-800">Riwayat Mutasi Stok</h1>
              <p className="text-slate-500 text-xs">Jejak audit otomatis pergerakan stok masuk dan keluar</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-xs border-b">
                  <tr>
                    <th className="p-4">Waktu</th><th className="p-4">Jenis</th><th className="p-4">Part No</th>
                    <th className="p-4">Nama Barang</th><th className="p-4">Jumlah</th><th className="p-4">Referensi / WO</th><th className="p-4">Oleh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map(log => (
                    <tr key={log.id}>
                      <td className="p-4 text-xs text-slate-500">{log.timestamp}</td>
                      <td className="p-4"><span className={`text-xs px-2 py-0.5 rounded font-bold ${log.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{log.type === 'IN' ? 'MASUK' : 'KELUAR'}</span></td>
                      <td className="p-4 font-bold">{log.part_no}</td>
                      <td className="p-4">{log.part_name}</td>
                      <td className="p-4 font-bold">{log.qty} {log.unit}</td>
                      <td className="p-4 text-xs text-slate-600 font-mono">{log.ref}</td>
                      <td className="p-4 text-xs text-slate-500">{log.user}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* BRANCH CATALOG */}
        {currentUser.role === 'branch' && activeTab === 'catalog' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-slate-800">Katalog Sparepart VTS Pusat</h1>
              <p className="text-slate-500 text-xs">Pilih komponen dan tambahkan ke keranjang permintaan cabang</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3">
              <input type="text" placeholder="Cari nama, nomor part, barcode, atau kategori..." value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)} className="flex-1 px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={catalogCategoryFilter} onChange={e => setCatalogCategoryFilter(e.target.value)} className="sm:w-52 px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="ALL">Semua Kategori</option>
                {Array.from(new Set(activeParts.map(part => part.category))).sort().map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeParts.filter(p => {
                const query = searchQuery.toLowerCase().trim();
                const matchesSearch = p.name.toLowerCase().includes(query) ||
                  p.part_no.toLowerCase().includes(query) ||
                  p.category.toLowerCase().includes(query) ||
                  Boolean(p.barcode?.toLowerCase().includes(query));
                return matchesSearch && (catalogCategoryFilter === 'ALL' || p.category === catalogCategoryFilter);
              }).map(part => (
                <div key={part.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
                  <div>
                    <img src={part.image_url || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300'} alt="" className="w-full h-40 object-cover" />
                    <div className="p-4">
                      <div className="text-xs font-bold text-blue-600">{part.part_no}</div>
                      <h3 className="font-bold text-slate-800 text-base mt-0.5">{part.name}</h3>
                      <div className="text-xs text-slate-500 mt-1">Kategori: {part.category} | Rak: {part.rack}</div>
                      <div className="mt-4 flex items-center justify-between">
                        <span className={`text-xs font-bold ${part.stock > 0 ? 'text-emerald-600' : 'text-red-600'}`}>Tersedia: {part.stock} {part.unit}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 border-t">
                    {part.stock > 0 ? (
                      <button onClick={() => addToCart(part)} className="w-full py-2 rounded-lg text-xs font-bold transition bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                        + Tambah ke Keranjang
                      </button>
                    ) : (
                      <button onClick={() => handleAskAdminAboutStock(part)} className="w-full py-2 rounded-lg text-xs font-bold transition bg-amber-500 hover:bg-amber-600 text-white shadow-sm flex items-center justify-center gap-1.5">
                        <MessageCircle className="w-4 h-4" /> Tanya Admin
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BRANCH CART */}
        {currentUser.role === 'branch' && activeTab === 'cart' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h1 className="text-xl font-bold text-slate-800">Keranjang Permintaan Barang</h1>
              <p className="text-slate-500 text-xs">Periksa kembali barang sebelum mengajukan ke VTS Pusat</p>
            </div>
            {cart.length === 0 ? (
              <div className="bg-white p-8 rounded-xl text-center border">
                <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium text-sm">Keranjang Anda masih kosong.</p>
                <button onClick={() => setActiveTab('catalog')} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold">Buka Katalog Sparepart</button>
              </div>
            ) : (
              <form onSubmit={handleCheckout} className="space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 divide-y">
                  {cart.map(item => (
                    <div key={item.id} className="py-4 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-800">{item.name}</div>
                        <div className="text-xs text-slate-500">{item.part_no}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm font-bold">{item.qty} {item.unit}</div>
                        <button type="button" onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <h3 className="font-bold text-slate-800 text-sm uppercase">Detail Dokumen Permintaan</h3>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Nomor Work Order (WO) *Wajib</label>
                    <input type="text" required placeholder="Contoh: WO-JKT-2026-089" value={woInput}
                      onChange={e => setWoInput(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Catatan / Peruntukan Perbaikan</label>
                    <textarea placeholder="Contoh: Perbaikan urgent unit mesin vaksinator di Hatchery X" value={orderNotesInput}
                      onChange={e => setOrderNotesInput(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" rows={3} />
                  </div>
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg shadow">Kirim Permintaan Barang ke Pusat</button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* BRANCH MY ORDERS */}
        {currentUser.role === 'branch' && activeTab === 'my-orders' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-slate-800">Status Permintaan {currentUser.name}</h1>
              <p className="text-slate-500 text-xs">Riwayat pengajuan order sparepart dari cabang Anda</p>
            </div>
            <OrderFilters
              searchQuery={orderSearchQuery}
              onSearchChange={setOrderSearchQuery}
              month={orderMonthFilter}
              onMonthChange={setOrderMonthFilter}
              year={orderYearFilter}
              onYearChange={setOrderYearFilter}
              branch={orderBranchFilter}
              onBranchChange={setOrderBranchFilter}
              status={orderStatusFilter}
              onStatusChange={setOrderStatusFilter}
              years={orderYears}
              onReset={resetOrderFilters}
            />
            <div className="space-y-4">
              {orders.filter(o => o.branch_id === currentUser.id).length === 0 ? (
                <p className="text-slate-500 text-sm">Belum ada riwayat order.</p>
              ) : filteredOrders.length === 0 ? (
                <p className="text-slate-500 text-sm">Tidak ada order yang sesuai dengan filter.</p>
              ) : filteredOrders.map(order => (
                <div key={order.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <div className="flex justify-between items-center border-b pb-3 mb-3">
                    <div>
                      <span className="font-bold text-slate-800">{order.id}</span>
                      <span className="text-xs text-slate-500 ml-3">WO Ref: <strong>{order.wo_number}</strong></span>
                    </div>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${order.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : order.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {order.status === 'Approved' ? 'Disetujui & Dikirim' : order.status === 'Rejected' ? 'Ditolak' : 'Proses Verifikasi'}
                    </span>
                  </div>
                  <ul className="divide-y divide-slate-100 text-sm">
                    {order.items.map((item, idx) => (
                      <li key={idx} className="py-2 flex justify-between">
                        <span>{item.name} ({item.partNo})</span>
                        <span className="font-bold">{item.qty} {item.unit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CHAT */}
        {activeTab === 'chat' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h1 className="text-xl font-bold text-slate-800">Chat {currentUser.role === 'admin' ? 'dengan Cabang' : 'dengan Admin Pusat'}</h1>
              <p className="text-slate-500 text-xs">Koordinasikan kebutuhan sparepart dan tindak lanjut permintaan Anda</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {currentUser.role === 'admin' && (
                <div className="p-4 border-b bg-slate-50">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Pilih percakapan cabang</label>
                  <select value={selectedChatBranch} onChange={e => setSelectedChatBranch(e.target.value)} className="w-full sm:max-w-sm p-2.5 border rounded-lg text-sm bg-white">
                    <option value="ALL">Semua Percakapan</option>
                    {BRANCHES.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </select>
                </div>
              )}
              <div className="min-h-[360px] max-h-[520px] overflow-y-auto p-4 sm:p-6 bg-slate-50 space-y-3">
                {visibleChatMessages.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center text-slate-400">
                    <MessageCircle className="w-10 h-10 mb-2 text-slate-300" />
                    <p className="text-sm font-medium">Belum ada pesan</p>
                    <p className="text-xs mt-1">Mulai percakapan untuk menghubungi {currentUser.role === 'admin' ? 'cabang' : 'admin pusat'}.</p>
                  </div>
                ) : visibleChatMessages.map(message => (
                  <div key={message.id} className={`flex ${message.sender_role === currentUser.role ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-3 shadow-sm ${message.sender_role === currentUser.role ? 'bg-blue-600 text-white rounded-br-md' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-md'}`}>
                      <div className={`text-[10px] font-bold mb-1 ${message.sender_role === currentUser.role ? 'text-blue-100' : 'text-slate-500'}`}>
                        {message.sender_name}{currentUser.role === 'admin' && selectedChatBranch === 'ALL' ? ` · ${message.branch_name}` : ''}
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
                      <div className={`text-[10px] mt-2 ${message.sender_role === currentUser.role ? 'text-blue-100' : 'text-slate-400'}`}>
                        {new Date(message.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSendChatMessage} className="p-4 border-t bg-white flex gap-2">
                <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} disabled={currentUser.role === 'admin' && selectedChatBranch === 'ALL'} placeholder={currentUser.role === 'admin' && selectedChatBranch === 'ALL' ? 'Pilih satu cabang untuk membalas' : 'Tulis pesan...'} className="flex-1 px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400" />
                <button type="submit" disabled={!chatInput.trim() || (currentUser.role === 'admin' && selectedChatBranch === 'ALL')} className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-bold">
                  <Send className="w-4 h-4" /> <span className="hidden sm:inline">Kirim</span>
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* SCANNER MODAL */}
      {showScannerModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button onClick={() => setShowScannerModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            <div className="text-center mb-4">
              <div className="bg-blue-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto text-blue-600 mb-2"><Camera className="w-6 h-6" /></div>
              <h3 className="font-bold text-lg text-slate-800">Scanner Barcode Kamera</h3>
              <p className="text-xs text-slate-500">Arahkan kamera ke Barcode Produk atau Rak Gudang</p>
            </div>
            <div className="relative bg-slate-900 rounded-xl h-52 flex flex-col items-center justify-center border-2 border-dashed border-blue-500 overflow-hidden mb-4">
              <div className="absolute inset-x-8 top-12 bottom-12 border-2 border-emerald-400 rounded-lg animate-pulse pointer-events-none"></div>
              <p className="text-white text-xs font-semibold z-10 bg-slate-800/80 px-3 py-1 rounded-full">Kamera Aktif / Siap Pindai</p>
              <div className="text-slate-400 text-[10px] mt-2 z-10">Gunakan contoh di bawah untuk uji coba cepat:</div>
              <div className="flex gap-2 mt-2 z-10">
                <button onClick={() => handleProcessBarcodeScan('SOC-001')} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] px-2.5 py-1 rounded font-bold">Test SOC-001</button>
                <button onClick={() => handleProcessBarcodeScan('RACK-A-01')} className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] px-2.5 py-1 rounded font-bold">Test RACK-A-01</button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600">Atau Ketik Kode Barcode / Part No / Rak:</label>
              <div className="flex gap-2">
                <input type="text" placeholder="Contoh: SOC-001 atau RACK-A-01" value={manualScanInput}
                  onChange={e => setManualScanInput(e.target.value)} className="flex-1 p-2 border rounded-lg text-sm uppercase" />
                <button onClick={() => handleProcessBarcodeScan(manualScanInput)} className="bg-blue-600 text-white font-bold px-4 py-2 rounded-lg text-xs">Cari</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCAN RESULT MODAL */}
      {scannedResultModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button onClick={() => setScannedResultModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            {scannedResultModal.type === 'part' && scannedResultModal.data && (
              <div>
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase mb-3"><CheckCircle2 className="w-4 h-4" /> Hasil Scan Barcode Ditemukan</div>
                <div className="flex gap-4 border-b pb-4 mb-4">
                  <img src={scannedResultModal.data.image_url || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200'} alt="" className="w-24 h-24 object-cover rounded-xl border" />
                  <div>
                    <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded">Rak: {scannedResultModal.data.rack}</span>
                    <h3 className="font-bold text-slate-800 text-lg mt-1">{scannedResultModal.data.name}</h3>
                    <div className="text-xs text-slate-500">Part No: <strong>{scannedResultModal.data.part_no}</strong></div>
                    <div className="text-xs text-slate-500">Kategori: {scannedResultModal.data.category}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`text-sm font-extrabold ${scannedResultModal.data.stock <= scannedResultModal.data.min_stock ? 'text-red-600' : 'text-emerald-600'}`}>Stok Pusat: {scannedResultModal.data.stock} {scannedResultModal.data.unit}</span>
                      {scannedResultModal.data.stock <= scannedResultModal.data.min_stock && <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded">Stok Kritis</span>}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-600 uppercase">Aksi Cepat:</div>
                  {currentUser.role === 'admin' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => { setSelectedPartForAction(scannedResultModal.data!); setShowRestockModal(true); }} className="bg-emerald-600 text-white font-bold py-2 rounded-lg text-xs">+ Restock Barang</button>
                      <button onClick={() => { setSelectedPartForAction(scannedResultModal.data!); setActionQty(scannedResultModal.data!.stock); setShowOpnameModal(true); }} className="bg-amber-600 text-white font-bold py-2 rounded-lg text-xs">Stock Opname</button>
                    </div>
                  ) : (
                    <button onClick={() => { addToCart(scannedResultModal.data!); setScannedResultModal(null); }} className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg text-xs">+ Tambahkan ke Keranjang Order</button>
                  )}
                </div>
              </div>
            )}
            {scannedResultModal.type === 'rack' && (
              <div>
                <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase mb-3"><QrCode className="w-4 h-4" /> Informasi Lokasi Rak Gudang</div>
                <h3 className="font-bold text-slate-800 text-lg mb-1">Lokasi: {scannedResultModal.rackCode}</h3>
                <p className="text-xs text-slate-500 mb-4">Daftar sparepart yang tersimpan di rak ini:</p>
                <div className="divide-y max-h-60 overflow-y-auto mb-4 border rounded-lg p-2">
                  {scannedResultModal.items?.map(item => (
                    <div key={item.id} className="py-2 flex items-center justify-between text-sm">
                      <div>
                        <div className="font-bold text-slate-800">{item.name}</div>
                        <div className="text-xs text-slate-500">{item.part_no}</div>
                      </div>
                      <div className="font-bold text-slate-700">{item.stock} {item.unit}</div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setScannedResultModal(null)} className="w-full bg-slate-200 text-slate-700 font-bold py-2 rounded-lg text-xs">Tutup</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BARCODE PRINT MODAL */}
      {showBarcodePrintModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center relative">
            <button onClick={() => setShowBarcodePrintModal(null)} className="absolute top-4 right-4 text-slate-400"><X className="w-5 h-5" /></button>
            <h3 className="font-bold text-slate-800 text-base mb-4">Cetak Label Barcode Rak</h3>
            <div className="border-2 border-dashed border-slate-400 p-4 rounded-xl bg-slate-50 mb-6 space-y-2">
              <div className="font-black text-red-600 text-xs">PT ROMINDO PRIMAVETCOM - VTS</div>
              <div className="font-bold text-slate-800 text-sm">{showBarcodePrintModal.name}</div>
              <div className="text-xs font-mono font-bold text-blue-600">Part No: {showBarcodePrintModal.part_no}</div>
              <div className="bg-white p-3 rounded border flex flex-col items-center justify-center">
                <div className="h-12 w-full flex items-center justify-center gap-1">
                  {[...Array(24)].map((_, i) => (
                    <div key={i} className={`h-full ${i % 3 === 0 ? 'w-1 bg-black' : i % 2 === 0 ? 'w-0.5 bg-black' : 'w-1.5 bg-black'}`}></div>
                  ))}
                </div>
                <div className="text-[10px] font-mono tracking-widest mt-1 font-bold">{showBarcodePrintModal.barcode || showBarcodePrintModal.part_no}</div>
              </div>
              <div className="text-xs font-bold text-slate-700">LOKASI RAK: <span className="bg-blue-600 text-white px-2 py-0.5 rounded">{showBarcodePrintModal.rack}</span></div>
            </div>
            <button onClick={() => { window.print(); setShowBarcodePrintModal(null); }} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 text-xs">
              <Printer className="w-4 h-4" /> Cetak Label (Print)
            </button>
          </div>
        </div>
      )}

      {/* ADD/EDIT PART MODAL */}
      {showAddPartModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="font-bold text-lg text-slate-800">{editingPart ? 'Edit Sparepart' : 'Tambah Sparepart Baru'}</h3>
              <button onClick={() => setShowAddPartModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSavePart} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Part No *</label>
                  <input type="text" required value={partForm.partNo} onChange={e => setPartForm({ ...partForm, partNo: e.target.value })} className="w-full p-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Barcode Kode</label>
                  <input type="text" placeholder="Sama dg Part No" value={partForm.barcode} onChange={e => setPartForm({ ...partForm, barcode: e.target.value })} className="w-full p-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nama Barang *</label>
                <input type="text" required value={partForm.name} onChange={e => setPartForm({ ...partForm, name: e.target.value })} className="w-full p-2 border rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Kategori</label>
                  <input type="text" value={partForm.category} onChange={e => setPartForm({ ...partForm, category: e.target.value })} className="w-full p-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Lokasi Rak Presisi *</label>
                  <input type="text" required placeholder="Contoh: RACK-A-01" value={partForm.rack} onChange={e => setPartForm({ ...partForm, rack: e.target.value })} className="w-full p-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Stok Awal</label>
                  <input type="number" value={partForm.stock} onChange={e => setPartForm({ ...partForm, stock: Number(e.target.value) })} className="w-full p-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Min. Stok</label>
                  <input type="number" value={partForm.minStock} onChange={e => setPartForm({ ...partForm, minStock: Number(e.target.value) })} className="w-full p-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Satuan</label>
                  <input type="text" value={partForm.unit} onChange={e => setPartForm({ ...partForm, unit: e.target.value })} className="w-full p-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Gambar Produk</label>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full text-xs text-slate-500 mb-2" />
                <input type="text" placeholder="Atau tempel URL Gambar di sini..." value={partForm.imageUrl} onChange={e => setPartForm({ ...partForm, imageUrl: e.target.value })} className="w-full p-2 border rounded-lg text-sm" />
                {partForm.imageUrl && <img src={partForm.imageUrl} alt="Preview" className="mt-2 w-20 h-20 object-cover rounded border" />}
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg">Simpan Sparepart</button>
            </form>
          </div>
        </div>
      )}

      {/* RESTOCK MODAL */}
      {showRestockModal && selectedPartForAction && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="font-bold text-lg text-slate-800 mb-2">Restock / Tambah Stok Masuk</h3>
            <p className="text-xs text-slate-500 mb-4">{selectedPartForAction.part_no} - {selectedPartForAction.name}</p>
            <form onSubmit={handleRestock} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Jumlah Tambah Stok ({selectedPartForAction.unit})</label>
                <input type="number" min="1" required value={actionQty} onChange={e => setActionQty(Number(e.target.value))} className="w-full p-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Catatan / Ref Penerimaan Vendor</label>
                <input type="text" placeholder="Contoh: PO-VENDOR-9912" value={actionNote} onChange={e => setActionNote(e.target.value)} className="w-full p-2 border rounded-lg text-sm" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowRestockModal(false)} className="w-1/2 py-2 text-slate-600 border rounded-lg">Batal</button>
                <button type="submit" className="w-1/2 py-2 bg-emerald-600 text-white font-bold rounded-lg">Konfirmasi Restock</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OPNAME MODAL */}
      {showOpnameModal && selectedPartForAction && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="font-bold text-lg text-slate-800 mb-2">Stock Opname / Penyesuaian Fisik</h3>
            <p className="text-xs text-slate-500 mb-4">{selectedPartForAction.part_no} - {selectedPartForAction.name}</p>
            <form onSubmit={handleStockOpname} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Jumlah Stok Fisik Riil di Rak ({selectedPartForAction.unit})</label>
                <input type="number" min="0" required value={actionQty} onChange={e => setActionQty(Number(e.target.value))} className="w-full p-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Alasan Penyesuaian / Catatan</label>
                <input type="text" placeholder="Contoh: Hasil perhitungan opname akhir bulan" value={actionNote} onChange={e => setActionNote(e.target.value)} className="w-full p-2 border rounded-lg text-sm" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowOpnameModal(false)} className="w-1/2 py-2 text-slate-600 border rounded-lg">Batal</button>
                <button type="submit" className="w-1/2 py-2 bg-amber-600 text-white font-bold rounded-lg">Simpan Opname</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DUPLICATE DETECTION MODAL */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[85vh] overflow-y-auto relative">
            <button onClick={() => setShowDuplicateModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-6 h-6 text-amber-500" />
              <div>
                <h3 className="font-bold text-lg text-slate-800">Pemeriksaan Data Ganda</h3>
                <p className="text-xs text-slate-500">Sparepart dengan Part No, Barcode, atau Nama yang sama</p>
              </div>
            </div>
            {duplicateGroups.length > 0 && (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <div className="text-xs text-amber-800">
                  <strong>Pembersihan otomatis:</strong> pertahankan data pertama, arsipkan salinan lainnya.
                </div>
                <button onClick={handleAutoArchiveDuplicates} className="shrink-0 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700">
                  Arsipkan Otomatis
                </button>
              </div>
            )}
            {duplicateGroups.length === 0 ? (
              <div className="text-center py-10">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <p className="font-semibold text-slate-700">Tidak ada data ganda ditemukan</p>
                <p className="text-xs text-slate-500 mt-1">Semua Part No, Barcode, dan Nama Barang aktif bersifat unik.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Ditemukan {duplicateGroups.length} kelompok data ganda. Periksa dan arsipkan atau hapus yang tidak diperlukan.
                </p>
                {duplicateGroups.map((group, gi) => (
                  <div key={gi} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 flex items-center gap-2">
                      <span className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full">{group.field}</span>
                      <span className="font-mono">{group.key}</span>
                      <span className="ml-auto text-slate-400">{group.items.length} data</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {group.items.map(item => (
                        <div key={item.id} className="px-4 py-2 flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-sm text-slate-800">{item.name}</div>
                            <div className="text-xs text-slate-500">{item.part_no} · Rak {item.rack} · Stok {item.stock} {item.unit}</div>
                          </div>
                          <div className="flex gap-1.5">
                            <button onClick={() => { setEditingPart(item); setPartForm({ id: item.id, partNo: item.part_no, barcode: item.barcode || '', name: item.name, category: item.category, rack: item.rack, stock: item.stock, minStock: item.min_stock, unit: item.unit, imageUrl: item.image_url || '' }); setShowAddPartModal(true); setShowDuplicateModal(false); }} className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-2 py-1 rounded text-xs font-bold">Edit</button>
                            <button onClick={() => { handleDeletePart(item.id); }} className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><Archive className="w-3 h-3" /> Arsip</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CSV IMPORT PREVIEW MODAL */}
      {showPreviewImport && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[85vh] overflow-y-auto relative">
            <button onClick={() => setShowPreviewImport(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            <h3 className="font-bold text-lg text-slate-800 mb-1">Pratinjau Impor CSV</h3>
            <p className="text-xs text-slate-500 mb-4">Periksa data sebelum disimpan ke database</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-extrabold text-emerald-700">{showPreviewImport.items.length}</div>
                <div className="text-xs text-emerald-700 font-semibold">Data Siap Diimpor</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-extrabold text-red-700">{showPreviewImport.conflicts.length}</div>
                <div className="text-xs text-red-700 font-semibold">Baris Bermasalah</div>
              </div>
            </div>
            {showPreviewImport.conflicts.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-bold text-red-700 uppercase mb-2">Baris Bermasalah (tidak akan diimpor)</h4>
                <div className="max-h-40 overflow-y-auto border border-red-200 rounded-lg divide-y divide-red-100">
                  {showPreviewImport.conflicts.map((c, i) => (
                    <div key={i} className="px-3 py-2 text-xs">
                      <div className="font-semibold text-slate-700">{String(c.part_no)} — {String(c.name)}</div>
                      <div className="text-red-600">{String(c._issues)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {showPreviewImport.items.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-bold text-emerald-700 uppercase mb-2">Data Akan Diimpor</h4>
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr><th className="p-2 text-left">Part No</th><th className="p-2 text-left">Nama</th><th className="p-2 text-left">Rak</th><th className="p-2">Stok</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {showPreviewImport.items.map((it, i) => (
                        <tr key={i}>
                          <td className="p-2 font-mono">{String(it.part_no)}</td>
                          <td className="p-2">{String(it.name)}</td>
                          <td className="p-2">{String(it.rack)}</td>
                          <td className="p-2 text-center">{String(it.stock)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowPreviewImport(false)} className="flex-1 py-2.5 border rounded-lg text-sm font-bold text-slate-600">Batal</button>
              <button onClick={handleConfirmImport} disabled={showPreviewImport.items.length === 0} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm disabled:bg-slate-300">
                Impor {showPreviewImport.items.length} Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

