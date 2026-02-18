'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    History, Clock, Plus, Edit, Trash2, ArrowUpCircle, ArrowDownCircle,
    Printer, LogOut, ScanLine, UserCircle, Search, X, Loader2, RefreshCw
} from 'lucide-react';
import { LogAction } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

interface ActivityLogRow {
    id: string;
    action: LogAction;
    user_id: string | null;
    user_name: string;
    description: string;
    product_id: string | null;
    product_name: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
}

const logConfig: Record<LogAction, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
    tambah:      { icon: <Plus className="w-4 h-4" />, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Tambah Produk' },
    edit:        { icon: <Edit className="w-4 h-4" />, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Edit Produk' },
    hapus:       { icon: <Trash2 className="w-4 h-4" />, color: 'text-red-600', bg: 'bg-red-50', label: 'Hapus Produk' },
    stok_masuk:  { icon: <ArrowDownCircle className="w-4 h-4" />, color: 'text-green-600', bg: 'bg-green-50', label: 'Stok Masuk' },
    stok_keluar: { icon: <ArrowUpCircle className="w-4 h-4" />, color: 'text-orange-600', bg: 'bg-orange-50', label: 'Stok Keluar' },
    scan:        { icon: <ScanLine className="w-4 h-4" />, color: 'text-violet-600', bg: 'bg-violet-50', label: 'Scan Barcode' },
    print:       { icon: <Printer className="w-4 h-4" />, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Print Label' },
    login:       { icon: <UserCircle className="w-4 h-4" />, color: 'text-green-600', bg: 'bg-green-50', label: 'Login' },
    logout:      { icon: <LogOut className="w-4 h-4" />, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Logout' },
};

export default function ActivityPage() {
    const [logs, setLogs] = useState<ActivityLogRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<LogAction | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const fetchLogs = useCallback(async () => {
        try {
            const supabase = createClient();
            const { data, error } = await supabase
                .from('activity_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(500);
            if (error) throw error;
            setLogs((data || []) as ActivityLogRow[]);
        } catch (err) {
            console.error('Fetch activity logs error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const filtered = logs.filter(log => {
        const matchFilter = filter === 'all' || log.action === filter;
        const matchSearch = searchQuery === '' ||
            log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.product_name && log.product_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
            log.user_name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchFilter && matchSearch;
    });

    // Group by date
    const grouped: Record<string, ActivityLogRow[]> = {};
    filtered.forEach(log => {
        const date = new Date(log.created_at).toLocaleDateString('id-ID', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(log);
    });

    // Stats
    const actionCounts = logs.reduce((acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-2 text-sm text-gray-600">Memuat activity log...</span>
            </div>
        );
    }

    return (
        <div>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                    { key: 'stok_masuk', label: 'Stok Masuk', color: 'text-green-600' },
                    { key: 'stok_keluar', label: 'Stok Keluar', color: 'text-orange-600' },
                    { key: 'tambah', label: 'Produk Baru', color: 'text-blue-600' },
                    { key: 'scan', label: 'Total Scan', color: 'text-violet-600' },
                ].map(item => (
                    <div key={item.key} className="bg-white p-5 rounded-lg border border-gray-200">
                        <p className="text-sm text-gray-500 mb-1">{item.label}</p>
                        <p className={`text-2xl font-semibold ${item.color}`}>{actionCounts[item.key] || 0}</p>
                    </div>
                ))}
            </div>

            {/* Log Panel */}
            <div className="bg-white rounded-lg border border-gray-200">
                <div className="p-5 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                            <History className="w-5 h-5 text-gray-500" />
                            <h2 className="text-lg font-semibold text-gray-900">Activity Log</h2>
                            {logs.length > 0 && (
                                <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
                  {logs.length}
                </span>
                            )}
                        </div>
                        <button
                            onClick={() => { setLoading(true); fetchLogs(); }}
                            className="flex items-center space-x-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 hover:bg-blue-50 rounded-md transition"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Refresh</span>
                        </button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Cari aktivitas, produk, atau user..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <select
                            value={filter}
                            onChange={e => setFilter(e.target.value as LogAction | 'all')}
                            className="appearance-none px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 bg-white"
                        >
                            <option value="all">Semua Aktivitas</option>
                            <option value="tambah">Tambah Produk</option>
                            <option value="edit">Edit Produk</option>
                            <option value="hapus">Hapus Produk</option>
                            <option value="stok_masuk">Stok Masuk</option>
                            <option value="stok_keluar">Stok Keluar</option>
                            <option value="scan">Scan Barcode</option>
                            <option value="print">Print Label</option>
                            <option value="login">Login</option>
                            <option value="logout">Logout</option>
                        </select>
                    </div>
                </div>

                {/* Log List */}
                <div className="max-h-[calc(100vh-380px)] overflow-y-auto">
                    {Object.keys(grouped).length === 0 ? (
                        <div className="py-16 text-center">
                            <History className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                            <p className="text-sm text-gray-400">
                                {logs.length === 0 ? 'Belum ada aktivitas tercatat' : 'Tidak ada aktivitas untuk filter ini'}
                            </p>
                        </div>
                    ) : (
                        Object.entries(grouped).map(([date, dateLogs]) => (
                            <div key={date}>
                                <div className="sticky top-0 bg-gray-50 px-5 py-2 border-b border-gray-100">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{date}</p>
                                </div>
                                {dateLogs.map(log => {
                                    const cfg = logConfig[log.action] || logConfig['scan'];
                                    const timeStr = new Date(log.created_at).toLocaleTimeString('id-ID', {
                                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                                    });

                                    return (
                                        <div key={log.id} className="flex items-start gap-3 px-5 py-4 hover:bg-gray-50 transition border-b border-gray-50">
                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${cfg.bg} ${cfg.color}`}>
                                                {cfg.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mr-2 ${cfg.bg} ${cfg.color}`}>
                              {cfg.label}
                            </span>
                                                        {log.product_name && (
                                                            <span className="text-sm font-semibold text-gray-900">{log.product_name}</span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-gray-400 shrink-0 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                                                        {timeStr}
                          </span>
                                                </div>
                                                <p className="text-sm text-gray-600 mt-1">{log.description}</p>
                                                <div className="flex items-center gap-1 mt-1.5">
                                                    <UserCircle className="w-3 h-3 text-gray-300" />
                                                    <span className="text-xs text-gray-400">{log.user_name}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>

                {filtered.length > 0 && (
                    <div className="px-5 py-3 border-t border-gray-200 bg-gray-50">
                        <p className="text-xs text-gray-500">
                            Menampilkan {filtered.length} dari {logs.length} aktivitas
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}