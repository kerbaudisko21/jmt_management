export type Merek = 'Honda' | 'Yamaha' | 'Suzuki' | 'Kawasaki';

export type UserRole = 'admin' | 'user_gudang_belakang' | 'user_toko';

export interface Product {
    id: string;
    barcode: string;
    nama: string;
    merek: Merek;
    stok: number;
    lokasi_id: string | null;
    loker: string | null;
    deskripsi: string | null;
    created_at: string;
    updated_at: string;
}

export type LogAction = 'tambah' | 'edit' | 'hapus' | 'stok_masuk' | 'stok_keluar' | 'scan' | 'print' | 'login' | 'logout';

export interface ActivityLog {
    id: string;
    action: LogAction;
    user: string;
    description: string;
    productName?: string;
    timestamp: string;
}

export interface UserProfile {
    id: string;
    username: string;
    full_name: string | null;
    role: UserRole;
    created_at: string;
    updated_at: string;
}