'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
    Plus, Search, Edit, Trash2, Download, X, ChevronDown,
    ArrowUpCircle, ArrowDownCircle, Printer, AlertTriangle,
    CheckCircle, Box, Tag, Loader2
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { useToast } from '@/components/Toast';
import { useScanner } from '@/components/useScanner';
import { generateQRCodeSVG } from '@/lib/qrcode';
import { mereks, getLocationsForRole } from '@/lib/data';
import { Product, Merek } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

interface Location {
    id: string;
    name: string;
}

interface FormState {
    barcode: string;
    nama: string;
    merek: string;
    stok: string;
    lokasi_id: string;
    loker: string;
    deskripsi: string;
}

const emptyForm: FormState = { barcode: '', nama: '', merek: '', stok: '', lokasi_id: '', loker: '', deskripsi: '' };

export default function ProductsPage() {
    const {
        products, setProducts, addLog, userRole, username, userId,
        canAddProduct, canEditProduct, canDeleteProduct, canStokMasuk, canStokKeluar
    } = useStore();
    const { showToast } = useToast();

    const [searchQuery, setSearchQuery] = useState('');
    const [filterMerek, setFilterMerek] = useState('all');
    const [filterLokasi, setFilterLokasi] = useState('all');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [locations, setLocations] = useState<Location[]>([]);

    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showScanResultModal, setShowScanResultModal] = useState(false);
    const [showStokModal, setShowStokModal] = useState(false);
    const [showLabelModal, setShowLabelModal] = useState(false);
    const [showScanPickerModal, setShowScanPickerModal] = useState(false);

    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [scanMatchProducts, setScanMatchProducts] = useState<Product[]>([]);
    const [stokAction, setStokAction] = useState<'masuk' | 'keluar'>('masuk');
    const [stokAmount, setStokAmount] = useState(1);
    const [stokNote, setStokNote] = useState('');
    const [scanNotFound, setScanNotFound] = useState(false);
    const [scannedBarcode, setScannedBarcode] = useState('');
    const [form, setForm] = useState<FormState>(emptyForm);

    const [labelProducts, setLabelProducts] = useState<Product[]>([]);
    const [labelQty, setLabelQty] = useState<Record<string, number>>({});
    const [selectedForPrint, setSelectedForPrint] = useState<Set<string>>(new Set());
    const [labelSize, setLabelSize] = useState<'small' | 'medium' | 'large'>('medium');

    const searchInputRef = useRef<HTMLInputElement>(null);

    // Filter locations by role name
    const allowedLocationNames = getLocationsForRole(userRole);
    const availableLocations = locations.filter(l => allowedLocationNames.includes(l.name));

    // ─── FETCH ──────────────────────────────────────────
    useEffect(() => {
        async function load() {
            try {
                const supabase = createClient();
                const [prodRes, locRes] = await Promise.all([
                    supabase.from('products').select('*').order('created_at', { ascending: false }),
                    supabase.from('locations').select('id, name').order('name'),
                ]);
                if (prodRes.error) throw prodRes.error;
                if (locRes.error) throw locRes.error;
                setProducts((prodRes.data || []) as Product[]);
                setLocations((locRes.data || []) as Location[]);
            } catch (err: unknown) {
                console.error('Fetch error:', err);
                showToast('Gagal memuat data', 'error');
            } finally {
                setLoading(false);
            }
        }
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const anyModalOpen = showAddModal || showEditModal || showStokModal || showDeleteModal || showLabelModal || showScanPickerModal;

    // ─── SCANNER ────────────────────────────────────────
    const handleBarcodeScan = useCallback((barcode: string) => {
        const trimmed = barcode.trim();

        // Kalau form Add/Edit/ScanResult terbuka → inject barcode ke field form
        if (showAddModal || showEditModal || showScanResultModal) {
            setForm(prev => ({ ...prev, barcode: trimmed }));
            return;
        }

        setScannedBarcode(trimmed);
        const matches = products.filter(p => p.barcode === trimmed);

        if (matches.length > 1) {
            // Multiple locations — show picker
            setScanMatchProducts(matches);
            setShowScanPickerModal(true);
            addLog('scan', `Scan barcode "${trimmed}" — ${matches.length} lokasi ditemukan`, matches[0].nama);
        } else if (matches.length === 1) {
            // Single match — show detail langsung
            setSelectedProduct(matches[0]);
            setScanNotFound(false);
            setShowScanResultModal(true);
            addLog('scan', `Scan barcode "${trimmed}" — ditemukan`, matches[0].nama);
        } else {
            // Not found
            setScanNotFound(true);
            setForm({ ...emptyForm, barcode: trimmed });
            setShowScanResultModal(true);
            addLog('scan', `Scan barcode "${trimmed}" — tidak ditemukan`);
        }
    }, [products, addLog, showAddModal, showEditModal, showScanResultModal]);

    // Scanner aktif selalu kecuali stok/delete/label modal
    useScanner({ onScan: handleBarcodeScan, enabled: !showStokModal && !showDeleteModal && !showLabelModal, searchQuery, setSearchQuery });

    // ─── HELPERS ────────────────────────────────────────
    const resetForm = () => setForm(emptyForm);
    const genBarcode = () => `TJM${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
    const getLocName = (lokasi_id: string | null) => locations.find(l => l.id === lokasi_id)?.name || '-';
    const f = (key: keyof FormState, val: string) => setForm(prev => ({ ...prev, [key]: val }));

    const openAddModal = () => {
        const defaultLoc = availableLocations.length === 1 ? availableLocations[0].id : '';
        setForm({ ...emptyForm, lokasi_id: defaultLoc });
        setShowAddModal(true);
    };

    // ─── CREATE ─────────────────────────────────────────
    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const savedNama = form.nama;
        const barcode = form.barcode || genBarcode();
        try {
            const supabase = createClient();
            const stok = parseInt(form.stok) || 0;

            const { data, error } = await supabase.from('products').insert({
                barcode,
                nama: form.nama,
                merek: form.merek as Merek,
                stok,
                lokasi_id: form.lokasi_id || null,
                loker: form.loker || null,
                deskripsi: form.deskripsi || null,
            }).select().single();

            if (error) {
                // Handle duplicate barcode+lokasi
                if (error.code === '23505') {
                    showToast('Barcode sudah terdaftar di lokasi ini', 'error');
                    return;
                }
                throw error;
            }

            setProducts(prev => [data as Product, ...prev]);

            // Activity log - fire and forget, jangan sampai error ini block success
            try {
                await supabase.from('activity_logs').insert({
                    action: 'tambah', user_id: userId, user_name: username,
                    description: `Menambahkan produk baru (barcode: ${barcode}, stok: ${stok})`,
                    product_id: data.id, product_name: savedNama,
                });
            } catch { /* ignore activity log errors */ }

            resetForm();
            setShowAddModal(false);
            setShowScanResultModal(false);
            setScanNotFound(false);
            showToast(`Produk "${savedNama}" berhasil ditambahkan`);
        } catch (err: unknown) {
            console.error('Add product error:', err);
            showToast((err instanceof Error ? err.message : null) || 'Gagal menambahkan produk', 'error');
        } finally { setSaving(false); }
    };

    // ─── UPDATE ─────────────────────────────────────────
    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct) return;
        setSaving(true);
        try {
            const supabase = createClient();
            const stok = parseInt(form.stok) || 0;

            const { data, error } = await supabase.from('products').update({
                barcode: form.barcode,
                nama: form.nama,
                merek: form.merek as Merek,
                stok,
                lokasi_id: form.lokasi_id || null,
                loker: form.loker || null,
                deskripsi: form.deskripsi || null,
            }).eq('id', selectedProduct.id).select().single();
            if (error) throw error;

            setProducts(prev => prev.map(p => p.id === selectedProduct.id ? (data as Product) : p));
            try {
                await supabase.from('activity_logs').insert({
                    action: 'edit', user_id: userId, user_name: username,
                    description: `Mengedit data produk`, product_id: selectedProduct.id, product_name: form.nama,
                });
            } catch { /* ignore */ }

            resetForm();
            setShowEditModal(false);
            setSelectedProduct(null);
            showToast('Produk berhasil diperbarui');
        } catch (err: unknown) {
            console.error('Edit product error:', err);
            showToast((err instanceof Error ? err.message : null) || 'Gagal mengedit produk', 'error');
        } finally { setSaving(false); }
    };

    const openEditModal = (product: Product) => {
        setSelectedProduct(product);
        setForm({
            barcode: product.barcode,
            nama: product.nama,
            merek: product.merek || '',
            stok: String(product.stok),
            lokasi_id: product.lokasi_id || '',
            loker: product.loker || '',
            deskripsi: product.deskripsi || '',
        });
        setShowEditModal(true);
    };

    // ─── DELETE ─────────────────────────────────────────
    const handleDelete = async () => {
        if (!selectedProduct) return;
        setSaving(true);
        try {
            const supabase = createClient();
            const { error } = await supabase.from('products').delete().eq('id', selectedProduct.id);
            if (error) throw error;
            setProducts(prev => prev.filter(p => p.id !== selectedProduct.id));
            try { await supabase.from('activity_logs').insert({ action: 'hapus', user_id: userId, user_name: username, description: `Menghapus produk (barcode: ${selectedProduct.barcode})`, product_name: selectedProduct.nama }); } catch {}
            setShowDeleteModal(false);
            showToast(`Produk "${selectedProduct.nama}" berhasil dihapus`);
            setSelectedProduct(null);
        } catch (err: unknown) {
            showToast((err instanceof Error ? err.message : null) || 'Gagal menghapus produk', 'error');
        } finally { setSaving(false); }
    };

    // ─── STOCK ──────────────────────────────────────────
    const openStokModal = (product: Product, action: 'masuk' | 'keluar') => {
        if (action === 'keluar' && !canStokKeluar()) {
            showToast('Anda tidak memiliki akses untuk mengurangi stok', 'error');
            return;
        }
        setSelectedProduct(product);
        setStokAction(action);
        setStokAmount(1);
        setStokNote('');
        setShowStokModal(true);
        setShowScanResultModal(false);
    };

    const handleStokUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct) return;
        const newStok = stokAction === 'masuk' ? selectedProduct.stok + stokAmount : selectedProduct.stok - stokAmount;
        if (newStok < 0) { showToast('Stok tidak boleh kurang dari 0', 'error'); return; }
        setSaving(true);
        try {
            const supabase = createClient();
            await supabase.from('products').update({ stok: newStok }).eq('id', selectedProduct.id).throwOnError();
            try { await supabase.from('stock_movements').insert({ product_id: selectedProduct.id, type: stokAction, quantity: stokAmount, previous_stock: selectedProduct.stok, new_stock: newStok, notes: stokNote || null, user_id: userId }); } catch {}
            const noteText = stokNote ? ` (catatan: ${stokNote})` : '';
            try { await supabase.from('activity_logs').insert({ action: stokAction === 'masuk' ? 'stok_masuk' : 'stok_keluar', user_id: userId, user_name: username, description: `${stokAction === 'masuk' ? 'Stok masuk' : 'Stok keluar'} ${stokAmount} unit — stok ${selectedProduct.stok} → ${newStok}${noteText}`, product_id: selectedProduct.id, product_name: selectedProduct.nama }); } catch {}
            setProducts(prev => prev.map(p => p.id === selectedProduct.id ? { ...p, stok: newStok } : p));
            setShowStokModal(false);
            showToast(`Stok ${stokAction === 'masuk' ? 'masuk' : 'keluar'} ${stokAmount} unit untuk "${selectedProduct.nama}"`);
            setSelectedProduct(null);
        } catch (err: unknown) {
            showToast((err instanceof Error ? err.message : null) || 'Gagal update stok', 'error');
        } finally { setSaving(false); }
    };

    // ─── LABELS ─────────────────────────────────────────
    const openLabelModal = (p: Product) => { setLabelProducts([p]); setLabelQty({ [p.id]: 1 }); setShowLabelModal(true); };
    const openBulkLabelModal = () => {
        const sel = products.filter(p => selectedForPrint.has(p.id));
        if (!sel.length) { showToast('Pilih minimal 1 produk', 'error'); return; }
        setLabelProducts(sel);
        const q: Record<string, number> = {}; sel.forEach(p => { q[p.id] = 1; }); setLabelQty(q);
        setShowLabelModal(true);
    };
    const toggleSelect = (id: string) => setSelectedForPrint(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

    const handlePrintLabels = () => {
        const cfgs = { small: { w:220,h:100,qr:72,pad:10,nf:11,cf:9,sf:7 }, medium: { w:290,h:125,qr:90,pad:12,nf:13,cf:11,sf:8 }, large: { w:380,h:160,qr:118,pad:16,nf:16,cf:13,sf:10 } };
        const c = cfgs[labelSize]; const qm = labelSize === 'small' ? 2 : labelSize === 'medium' ? 3 : 4;
        let html = '';
        labelProducts.forEach(p => { const qty = labelQty[p.id] || 1; const qr = generateQRCodeSVG(p.barcode, qm);
            for (let i = 0; i < qty; i++) html += `<div class="label" style="width:${c.w}px;height:${c.h}px;padding:${c.pad}px;"><div class="qr" style="width:${c.qr}px;min-width:${c.qr}px;height:${c.qr}px;">${qr}</div><div class="info"><div class="shop" style="font-size:${c.sf}px;">TOKO JITU MOTOR</div><div class="name" style="font-size:${c.nf}px;">${p.nama}</div><div class="code" style="font-size:${c.cf}px;">${p.barcode}</div></div></div>`;
        });
        const win = window.open('', '_blank');
        if (!win) { showToast('Popup blocked!', 'error'); return; }
        win.document.write(`<!DOCTYPE html><html><head><title>Print Label</title><style>@page{margin:8mm}*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;padding:8px;display:flex;flex-wrap:wrap;align-content:flex-start}.label{border:1px dashed #d0d0d0;display:inline-flex;align-items:center;gap:12px;margin:3px;page-break-inside:avoid;overflow:hidden}.qr{display:flex;align-items:center;justify-content:center;flex-shrink:0;border-radius:4px}.qr svg{width:100%;height:100%}.info{flex:1;display:flex;flex-direction:column;justify-content:center;min-width:0;gap:2px}.shop{text-transform:uppercase;letter-spacing:1.5px;color:#999;font-weight:500}.name{font-weight:700;color:#111;line-height:1.25;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.code{font-family:'SF Mono','Consolas',monospace;color:#444;letter-spacing:1px;margin-top:2px}@media print{body{padding:0}.label{border-color:#eee}}</style></head><body>${html}</body></html>`);
        win.document.close(); win.onload = () => win.print();
        addLog('print', `Print ${Object.values(labelQty).reduce((a, b) => a + b, 0)} label`);
    };

    // ─── FILTER ─────────────────────────────────────────
    const filtered = products.filter(p => {
        const ms = p.nama.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.toLowerCase().includes(searchQuery.toLowerCase());
        const mm = filterMerek === 'all' || p.merek === filterMerek;
        const ml = filterLokasi === 'all' || p.lokasi_id === filterLokasi;
        return ms && mm && ml;
    });
    const totalStok = products.reduce((s, p) => s + p.stok, 0);
    const lowStokCount = products.filter(p => p.stok < 10).length;
    const mc: Record<string, string> = { Honda:'bg-red-50 text-red-700 border-red-200', Yamaha:'bg-blue-50 text-blue-700 border-blue-200', Suzuki:'bg-yellow-50 text-yellow-700 border-yellow-200', Kawasaki:'bg-green-50 text-green-700 border-green-200' };

    // ─── FORM JSX (inline, not a component) ─────────────
    const renderFormFields = (isEdit: boolean) => {
        const locs = isEdit && userRole === 'admin' ? locations : availableLocations;
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-900 mb-1.5">Barcode {!isEdit && <span className="text-gray-400 font-normal">(kosongkan = auto)</span>}</label>
                    <input type="text" value={form.barcode} onChange={e => f('barcode', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Scan atau ketik barcode..." />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-900 mb-1.5">Nama Produk *</label>
                    <input type="text" value={form.nama} onChange={e => f('nama', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Contoh: Kampas Rem Depan Beat" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1.5">Merek *</label>
                    <select value={form.merek} onChange={e => f('merek', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required>
                        <option value="">Pilih Merek</option>
                        {mereks.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1.5">Lokasi *</label>
                    <select value={form.lokasi_id} onChange={e => f('lokasi_id', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required>
                        {locs.length === 1 ? (
                            <option value={locs[0].id}>{locs[0].name}</option>
                        ) : (
                            <><option value="">Pilih Lokasi</option>{locs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</>
                        )}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1.5">Loker</label>
                    <input type="text" value={form.loker} onChange={e => f('loker', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Contoh: A1, B3, Rak 2..." />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1.5">{isEdit ? 'Stok' : 'Stok Awal'} *</label>
                    <input type="text" inputMode="numeric" value={form.stok} onChange={e => f('stok', e.target.value.replace(/[^0-9]/g, ''))} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="0" required />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-900 mb-1.5">Deskripsi</label>
                    <input type="text" value={form.deskripsi} onChange={e => f('deskripsi', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Deskripsi produk (opsional)" />
                </div>
            </div>
        );
    };

    if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /><span className="ml-2 text-sm text-gray-600">Memuat data produk...</span></div>;

    return (
        <div>
            {/* Full screen loading overlay saat saving */}
            {saving && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]">
                    <div className="bg-white rounded-xl px-8 py-6 flex flex-col items-center shadow-lg">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
                        <p className="text-sm font-medium text-gray-900">Menyimpan data...</p>
                        <p className="text-xs text-gray-500 mt-1">Mohon tunggu sebentar</p>
                    </div>
                </div>
            )}
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-5 rounded-lg border border-gray-200"><p className="text-sm text-gray-500 mb-1">Total Produk</p><p className="text-2xl font-semibold text-gray-900">{products.length}</p></div>
                <div className="bg-white p-5 rounded-lg border border-gray-200"><p className="text-sm text-gray-500 mb-1">Total Stok</p><p className="text-2xl font-semibold text-gray-900">{totalStok}</p></div>
                <div className="bg-white p-5 rounded-lg border border-gray-200"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500 mb-1">Stok Rendah</p><p className="text-2xl font-semibold text-gray-900">{lowStokCount}</p></div>{lowStokCount > 0 && <AlertTriangle className="w-5 h-5 text-amber-500" />}</div></div>
            </div>

            {/* Table Card */}
            <div className="bg-white rounded-lg border border-gray-200">
                <div className="p-5 border-b border-gray-200">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <h2 className="text-lg font-semibold text-gray-900">Daftar Sparepart</h2>
                        <div className="flex items-center gap-3">
                            {selectedForPrint.size > 0 && <button onClick={openBulkLabelModal} className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 transition font-medium"><Tag className="w-4 h-4" /><span>Print Label ({selectedForPrint.size})</span></button>}
                            <button className="flex items-center space-x-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition text-gray-700 font-medium"><Download className="w-4 h-4" /><span>Export</span></button>
                            {canAddProduct() && <button onClick={openAddModal} className="flex items-center space-x-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium"><Plus className="w-4 h-4" /><span>Tambah Produk</span></button>}
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 mt-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input ref={searchInputRef} type="text" placeholder="Cari nama produk atau barcode..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900" />
                        </div>
                        <div className="relative">
                            <select value={filterMerek} onChange={e => setFilterMerek(e.target.value)} className="appearance-none pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 bg-white">
                                <option value="all">Semua Merek</option>
                                {mereks.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                        <div className="relative">
                            <select value={filterLokasi} onChange={e => setFilterLokasi(e.target.value)} className="appearance-none pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 bg-white">
                                <option value="all">Semua Lokasi</option>
                                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="px-3 py-3 w-10"><input type="checkbox" checked={filtered.length > 0 && selectedForPrint.size === filtered.length} onChange={() => selectedForPrint.size === filtered.length ? setSelectedForPrint(new Set()) : setSelectedForPrint(new Set(filtered.map(p => p.id)))} className="h-4 w-4 text-blue-600 border-gray-300 rounded" /></th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Produk</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Barcode</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Merek</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Stok</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Lokasi</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Loker</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Aksi</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                        {filtered.map(product => (
                            <tr key={product.id} className={`hover:bg-gray-50 transition ${selectedForPrint.has(product.id) ? 'bg-blue-50/50' : ''}`}>
                                <td className="px-3 py-4"><input type="checkbox" checked={selectedForPrint.has(product.id)} onChange={() => toggleSelect(product.id)} className="h-4 w-4 text-blue-600 border-gray-300 rounded" /></td>
                                <td className="px-5 py-4"><div className="flex items-center space-x-3"><div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center"><Box className="w-4 h-4 text-gray-400" /></div><div><p className="text-sm font-medium text-gray-900">{product.nama}</p><p className="text-xs text-gray-500">{product.updated_at ? new Date(product.updated_at).toLocaleDateString('id-ID') : '-'}</p></div></div></td>
                                <td className="px-5 py-4"><code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700 font-mono">{product.barcode}</code></td>
                                <td className="px-5 py-4"><span className={`text-xs font-medium px-2 py-1 rounded-full border ${mc[product.merek] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>{product.merek}</span></td>
                                <td className="px-5 py-4"><span className={`text-sm font-semibold ${product.stok < 10 ? 'text-red-600' : 'text-gray-900'}`}>{product.stok}</span>{product.stok < 10 && <span className="ml-2 text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">Low</span>}</td>
                                <td className="px-5 py-4"><span className="text-sm text-gray-600">{getLocName(product.lokasi_id)}</span></td>
                                <td className="px-5 py-4"><span className="text-sm text-gray-600">{product.loker || '-'}</span></td>
                                <td className="px-5 py-4">
                                    <div className="flex items-center space-x-1">
                                        <button onClick={() => openLabelModal(product)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition" title="Print Label"><Tag className="w-4 h-4" /></button>
                                        {canStokMasuk() && <button onClick={() => openStokModal(product, 'masuk')} className="p-1.5 text-green-600 hover:bg-green-50 rounded transition" title="Stok Masuk"><ArrowDownCircle className="w-4 h-4" /></button>}
                                        {canStokKeluar() && <button onClick={() => openStokModal(product, 'keluar')} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded transition" title="Stok Keluar"><ArrowUpCircle className="w-4 h-4" /></button>}
                                        {canEditProduct() && <button onClick={() => openEditModal(product)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition" title="Edit"><Edit className="w-4 h-4" /></button>}
                                        {canDeleteProduct() && <button onClick={() => { setSelectedProduct(product); setShowDeleteModal(true); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition" title="Hapus"><Trash2 className="w-4 h-4" /></button>}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>

                {filtered.length === 0 && <div className="py-16 text-center"><Box className="w-10 h-10 text-gray-300 mx-auto mb-3" /><p className="text-sm text-gray-500">Tidak ada produk ditemukan</p></div>}
                <div className="px-5 py-4 border-t border-gray-200 bg-gray-50"><p className="text-sm text-gray-500">Menampilkan {filtered.length} dari {products.length} produk</p></div>
            </div>

            {/* ═══ MODALS ═══ */}

            {/* Scan Result */}
            {showScanResultModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        {!scanNotFound && selectedProduct ? (
                            <>
                                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                                    <div className="flex items-center space-x-3"><div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><CheckCircle className="w-5 h-5 text-green-600" /></div><div><h3 className="text-lg font-semibold text-gray-900">Produk Ditemukan</h3><p className="text-xs text-gray-500">Barcode: {selectedProduct.barcode}</p></div></div>
                                    <button onClick={() => { setShowScanResultModal(false); setSelectedProduct(null); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                                </div>
                                <div className="p-6">
                                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                                        <h4 className="text-base font-semibold text-gray-900 mb-3">{selectedProduct.nama}</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><p className="text-xs text-gray-500">Merek</p><span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${mc[selectedProduct.merek] || ''}`}>{selectedProduct.merek}</span></div>
                                            <div><p className="text-xs text-gray-500">Lokasi</p><p className="text-sm font-medium text-gray-900">{getLocName(selectedProduct.lokasi_id)}</p></div>
                                            <div><p className="text-xs text-gray-500">Loker</p><p className="text-sm font-medium text-gray-900">{selectedProduct.loker || '-'}</p></div>
                                            <div><p className="text-xs text-gray-500">Stok</p><p className={`text-sm font-semibold ${selectedProduct.stok < 10 ? 'text-red-600' : 'text-gray-900'}`}>{selectedProduct.stok} unit{selectedProduct.stok < 10 && <span className="ml-1 text-xs text-red-500">(Rendah!)</span>}</p></div>
                                        </div>
                                    </div>
                                    <p className="text-sm font-medium text-gray-700 mb-3">Quick Action</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {canStokMasuk() && <button onClick={() => openStokModal(selectedProduct, 'masuk')} className="flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm"><ArrowDownCircle className="w-4 h-4" /><span>Stok Masuk</span></button>}
                                        {canStokKeluar() && <button onClick={() => openStokModal(selectedProduct, 'keluar')} className="flex items-center justify-center space-x-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium text-sm"><ArrowUpCircle className="w-4 h-4" /><span>Stok Keluar</span></button>}
                                        {canEditProduct() && <button onClick={() => { setShowScanResultModal(false); openEditModal(selectedProduct); }} className="flex items-center justify-center space-x-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm"><Edit className="w-4 h-4" /><span>Edit Produk</span></button>}
                                        <button onClick={() => { setShowScanResultModal(false); openLabelModal(selectedProduct); }} className="flex items-center justify-center space-x-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm"><Printer className="w-4 h-4" /><span>Print Label</span></button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                                    <div className="flex items-center space-x-3"><div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-amber-600" /></div><div><h3 className="text-lg font-semibold text-gray-900">Produk Tidak Ditemukan</h3><p className="text-xs text-gray-500">Barcode: {scannedBarcode}</p></div></div>
                                    <button onClick={() => { setShowScanResultModal(false); setScanNotFound(false); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                                </div>
                                <div className="p-6">
                                    <p className="text-sm text-gray-600 mb-4">Barcode <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">{scannedBarcode}</code> belum terdaftar.</p>
                                    <form onSubmit={handleAdd} className="space-y-4">
                                        {renderFormFields(false)}
                                        <div className="flex justify-end space-x-3 pt-2">
                                            <button type="button" onClick={() => { setShowScanResultModal(false); setScanNotFound(false); }} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 font-medium">Batal</button>
                                            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50">{saving ? 'Menyimpan...' : 'Tambah Produk'}</button>
                                        </div>
                                    </form>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center"><h3 className="text-lg font-semibold text-gray-900">Tambah Produk Baru</h3><button onClick={() => { setShowAddModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button></div>
                        <form onSubmit={handleAdd} className="p-6">
                            {renderFormFields(false)}
                            <div className="flex justify-end space-x-3 mt-6">
                                <button type="button" onClick={() => { setShowAddModal(false); resetForm(); }} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 font-medium">Batal</button>
                                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan Produk'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && selectedProduct && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center"><h3 className="text-lg font-semibold text-gray-900">Edit Produk</h3><button onClick={() => { setShowEditModal(false); setSelectedProduct(null); resetForm(); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button></div>
                        <form onSubmit={handleEdit} className="p-6">
                            {renderFormFields(true)}
                            <div className="flex justify-end space-x-3 mt-6">
                                <button type="button" onClick={() => { setShowEditModal(false); setSelectedProduct(null); resetForm(); }} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 font-medium">Batal</button>
                                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Stok Modal */}
            {showStokModal && selectedProduct && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-md w-full">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <div className="flex items-center space-x-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stokAction === 'masuk' ? 'bg-green-100' : 'bg-orange-100'}`}>{stokAction === 'masuk' ? <ArrowDownCircle className="w-5 h-5 text-green-600" /> : <ArrowUpCircle className="w-5 h-5 text-orange-600" />}</div><div><h3 className="text-lg font-semibold text-gray-900">Stok {stokAction === 'masuk' ? 'Masuk' : 'Keluar'}</h3><p className="text-xs text-gray-500">{selectedProduct.nama}</p></div></div>
                            <button onClick={() => { setShowStokModal(false); setSelectedProduct(null); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleStokUpdate} className="p-6">
                            <div className="bg-gray-50 rounded-lg p-3 mb-4 flex justify-between"><span className="text-sm text-gray-600">Stok saat ini</span><span className="text-sm font-semibold text-gray-900">{selectedProduct.stok} unit</span></div>
                            <div className="mb-4"><label className="block text-sm font-medium text-gray-900 mb-1.5">Jumlah *</label><input type="text" inputMode="numeric" value={stokAmount || ''} onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); setStokAmount(v === '' ? 0 : parseInt(v)); }} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="1" required /></div>
                            <div className="mb-4"><label className="block text-sm font-medium text-gray-900 mb-1.5">Catatan (opsional)</label><input type="text" value={stokNote} onChange={e => setStokNote(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Contoh: Restok dari supplier" /></div>
                            <div className="bg-gray-50 rounded-lg p-3 mb-6 flex justify-between"><span className="text-sm text-gray-600">Stok setelah update</span><span className={`text-sm font-semibold ${(stokAction === 'masuk' ? selectedProduct.stok + stokAmount : selectedProduct.stok - stokAmount) < 10 ? 'text-red-600' : 'text-gray-900'}`}>{stokAction === 'masuk' ? selectedProduct.stok + stokAmount : Math.max(0, selectedProduct.stok - stokAmount)} unit</span></div>
                            <div className="flex justify-end space-x-3">
                                <button type="button" onClick={() => { setShowStokModal(false); setSelectedProduct(null); }} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 font-medium">Batal</button>
                                <button type="submit" disabled={saving} className={`px-4 py-2 text-sm text-white rounded-md font-medium disabled:opacity-50 ${stokAction === 'masuk' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}>{saving ? 'Memproses...' : `Konfirmasi ${stokAction === 'masuk' ? 'Masuk' : 'Keluar'}`}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {showDeleteModal && selectedProduct && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-sm w-full p-6">
                        <div className="flex items-center space-x-3 mb-4"><div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center"><Trash2 className="w-5 h-5 text-red-600" /></div><h3 className="text-lg font-semibold text-gray-900">Hapus Produk</h3></div>
                        <p className="text-sm text-gray-600 mb-1">Apakah Anda yakin ingin menghapus:</p><p className="text-sm font-semibold text-gray-900 mb-4">{selectedProduct.nama}</p><p className="text-xs text-gray-500 mb-6">Tindakan ini tidak dapat dibatalkan.</p>
                        <div className="flex justify-end space-x-3">
                            <button onClick={() => { setShowDeleteModal(false); setSelectedProduct(null); }} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 font-medium">Batal</button>
                            <button onClick={handleDelete} disabled={saving} className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 font-medium disabled:opacity-50">{saving ? 'Menghapus...' : 'Ya, Hapus'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Label Modal */}
            {showLabelModal && labelProducts.length > 0 && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center"><div className="flex items-center space-x-3"><div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center"><Tag className="w-5 h-5 text-gray-700" /></div><div><h3 className="text-lg font-semibold text-gray-900">Generate Label Barcode</h3><p className="text-xs text-gray-500">{labelProducts.length} produk dipilih</p></div></div><button onClick={() => { setShowLabelModal(false); setLabelProducts([]); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button></div>
                        <div className="p-6">
                            <div className="mb-5"><label className="block text-sm font-medium text-gray-900 mb-2">Ukuran Label</label><div className="flex gap-2">{(['small','medium','large'] as const).map(s => <button key={s} onClick={() => setLabelSize(s)} className={`px-4 py-2 text-sm rounded-md font-medium transition ${labelSize === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{s === 'small' ? 'Kecil' : s === 'medium' ? 'Sedang' : 'Besar'}</button>)}</div></div>
                            <div className="mb-5"><label className="block text-sm font-medium text-gray-900 mb-2">Jumlah Label per Produk</label>
                                <div className="space-y-2 max-h-60 overflow-y-auto">{labelProducts.map(p => (
                                    <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3"><div className="flex-1 min-w-0 mr-3"><p className="text-sm font-medium text-gray-900 truncate">{p.nama}</p><p className="text-xs text-gray-500 font-mono">{p.barcode}</p></div>
                                        <div className="flex items-center space-x-2"><button onClick={() => setLabelQty(prev => ({...prev,[p.id]:Math.max(1,(prev[p.id]||1)-1)}))} className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 text-sm font-medium">−</button><input type="text" inputMode="numeric" value={labelQty[p.id]||1} onChange={e => { const v = e.target.value.replace(/[^0-9]/g,''); setLabelQty(prev => ({...prev,[p.id]:Math.max(1,parseInt(v)||1)})); }} className="w-14 text-center px-1 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900" /><button onClick={() => setLabelQty(prev => ({...prev,[p.id]:(prev[p.id]||1)+1}))} className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 text-sm font-medium">+</button></div>
                                    </div>))}</div>
                            </div>
                            <div className="mb-5"><label className="block text-sm font-medium text-gray-900 mb-2">Preview</label>
                                <div className="border border-gray-200 rounded-lg p-5 bg-gray-50 flex flex-wrap gap-3 justify-center">
                                    {labelProducts.slice(0,2).map(p => { const cfg = labelSize === 'small' ? {w:210,qr:68,nf:11,cf:9,sf:7,qm:2} : labelSize === 'medium' ? {w:270,qr:85,nf:13,cf:10.5,sf:8,qm:3} : {w:350,qr:110,nf:15,cf:12.5,sf:9.5,qm:3}; return (
                                        <div key={p.id} className="bg-white border border-gray-200 rounded-md shadow-sm flex items-center gap-3 overflow-hidden" style={{width:cfg.w,padding:'10px 12px'}}><div className="shrink-0 flex items-center justify-center" style={{width:cfg.qr,height:cfg.qr}} dangerouslySetInnerHTML={{__html:generateQRCodeSVG(p.barcode,cfg.qm)}} /><div className="flex flex-col justify-center min-w-0 flex-1 gap-0.5"><p className="uppercase tracking-widest text-gray-400" style={{fontSize:cfg.sf}}>Toko Jitu Motor</p><p className="font-bold text-gray-900 leading-tight truncate" style={{fontSize:cfg.nf}}>{p.nama}</p><p className="font-mono text-gray-500 tracking-wide" style={{fontSize:cfg.cf}}>{p.barcode}</p></div></div>
                                    ); })}{labelProducts.length > 2 && <div className="flex items-center text-xs text-gray-400 px-4">+{labelProducts.length-2} lainnya</div>}
                                </div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 mb-5 flex justify-between"><span className="text-sm text-gray-600">Total label</span><span className="text-sm font-semibold text-gray-900">{Object.values(labelQty).reduce((a,b) => a+b,0)} label</span></div>
                            <div className="flex justify-end space-x-3"><button onClick={() => { setShowLabelModal(false); setLabelProducts([]); }} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 font-medium">Batal</button><button onClick={handlePrintLabels} className="flex items-center space-x-2 px-5 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 font-medium"><Printer className="w-4 h-4" /><span>Print Label</span></button></div>
                        </div>
                    </div>
                </div>
            )}
            {/* Scan Picker Modal — barcode ditemukan di >1 lokasi */}
            {showScanPickerModal && scanMatchProducts.length > 0 && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-md w-full">
                        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Box className="w-5 h-5 text-blue-600" /></div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">Pilih Lokasi</h3>
                                    <p className="text-xs text-gray-500">Barcode: {scanMatchProducts[0].barcode} — {scanMatchProducts.length} lokasi</p>
                                </div>
                            </div>
                            <button onClick={() => { setShowScanPickerModal(false); setScanMatchProducts([]); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-gray-600 mb-4">Produk <span className="font-semibold text-gray-900">{scanMatchProducts[0].nama}</span> ditemukan di beberapa lokasi. Pilih lokasi:</p>
                            <div className="space-y-2">
                                {scanMatchProducts.map(p => (
                                    <button key={p.id} onClick={() => {
                                        setSelectedProduct(p);
                                        setScanNotFound(false);
                                        setShowScanPickerModal(false);
                                        setScanMatchProducts([]);
                                        setShowScanResultModal(true);
                                    }} className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition text-left">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{getLocName(p.lokasi_id)}</p>
                                            <p className="text-xs text-gray-500">Loker: {p.loker || '-'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-sm font-semibold ${p.stok < 10 ? 'text-red-600' : 'text-gray-900'}`}>{p.stok} unit</p>
                                            {p.stok < 10 && <p className="text-xs text-red-500">Low</p>}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}