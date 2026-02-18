export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            users: {
                Row: {
                    id: string
                    username: string
                    full_name: string | null
                    role: 'admin' | 'user_gudang_belakang' | 'user_toko'
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id: string
                    username: string
                    full_name?: string | null
                    role?: 'admin' | 'user_gudang_belakang' | 'user_toko'
                }
                Update: {
                    username?: string
                    full_name?: string | null
                    role?: 'admin' | 'user_gudang_belakang' | 'user_toko'
                }
            }
            locations: {
                Row: {
                    id: string
                    name: string
                    description: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    description?: string | null
                }
                Update: {
                    name?: string
                    description?: string | null
                }
            }
            products: {
                Row: {
                    id: string
                    barcode: string
                    nama: string
                    merek: 'Honda' | 'Yamaha' | 'Suzuki' | 'Kawasaki'
                    stok: number
                    lokasi_id: string | null
                    loker: string | null
                    deskripsi: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    barcode: string
                    nama: string
                    merek: 'Honda' | 'Yamaha' | 'Suzuki' | 'Kawasaki'
                    stok?: number
                    lokasi_id?: string | null
                    loker?: string | null
                    deskripsi?: string | null
                }
                Update: {
                    barcode?: string
                    nama?: string
                    merek?: 'Honda' | 'Yamaha' | 'Suzuki' | 'Kawasaki'
                    stok?: number
                    lokasi_id?: string | null
                    loker?: string | null
                    deskripsi?: string | null
                }
            }
            activity_logs: {
                Row: {
                    id: string
                    action: 'tambah' | 'edit' | 'hapus' | 'stok_masuk' | 'stok_keluar' | 'scan' | 'print' | 'login' | 'logout'
                    user_id: string | null
                    user_name: string
                    description: string
                    product_id: string | null
                    product_name: string | null
                    metadata: Json | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    action: 'tambah' | 'edit' | 'hapus' | 'stok_masuk' | 'stok_keluar' | 'scan' | 'print' | 'login' | 'logout'
                    user_id?: string | null
                    user_name: string
                    description: string
                    product_id?: string | null
                    product_name?: string | null
                    metadata?: Json | null
                }
                Update: {
                    action?: 'tambah' | 'edit' | 'hapus' | 'stok_masuk' | 'stok_keluar' | 'scan' | 'print' | 'login' | 'logout'
                    user_id?: string | null
                    user_name?: string
                    description?: string
                    product_id?: string | null
                    product_name?: string | null
                    metadata?: Json | null
                }
            }
            stock_movements: {
                Row: {
                    id: string
                    product_id: string
                    type: 'masuk' | 'keluar'
                    quantity: number
                    previous_stock: number
                    new_stock: number
                    notes: string | null
                    user_id: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    product_id: string
                    type: 'masuk' | 'keluar'
                    quantity: number
                    previous_stock: number
                    new_stock: number
                    notes?: string | null
                    user_id?: string | null
                }
                Update: {
                    product_id?: string
                    type?: 'masuk' | 'keluar'
                    quantity?: number
                    previous_stock?: number
                    new_stock?: number
                    notes?: string | null
                    user_id?: string | null
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
    }
}