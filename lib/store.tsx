'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Product, LogAction, ActivityLog, UserRole } from '@/lib/types';

interface StoreContextType {
    // Auth
    username: string;
    setUsername: (name: string) => void;
    userRole: UserRole;
    setUserRole: (role: UserRole) => void;
    userId: string;
    setUserId: (id: string) => void;

    // Products
    products: Product[];
    setProducts: React.Dispatch<React.SetStateAction<Product[]>>;

    // Activity logs (local only for quick display)
    activityLogs: ActivityLog[];
    addLog: (action: LogAction, description: string, productName?: string) => void;
    clearLogs: () => void;

    // Permission helpers
    canAddProduct: () => boolean;
    canEditProduct: () => boolean;
    canDeleteProduct: () => boolean;
    canStokMasuk: () => boolean;
    canStokKeluar: () => boolean;
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
    const [username, setUsername] = useState('User');
    const [userRole, setUserRole] = useState<UserRole>('user_toko');
    const [userId, setUserId] = useState('');
    const [products, setProducts] = useState<Product[]>([]);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const addLog = useCallback((action: LogAction, description: string, productName?: string) => {
        const log: ActivityLog = {
            id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
            action,
            user: username,
            description,
            productName,
            timestamp: new Date().toISOString(),
        };
        setActivityLogs(prev => [log, ...prev]);
    }, [username]);

    const clearLogs = useCallback(() => setActivityLogs([]), []);

    // Permission helpers based on role
    const canAddProduct = useCallback(() => {
        return true; // All roles can add products
    }, []);

    const canEditProduct = useCallback(() => {
        return userRole === 'admin';
    }, [userRole]);

    const canDeleteProduct = useCallback(() => {
        return userRole === 'admin';
    }, [userRole]);

    const canStokMasuk = useCallback(() => {
        return true; // All roles can add stock
    }, []);

    const canStokKeluar = useCallback(() => {
        return userRole === 'admin'; // Only admin can reduce stock
    }, [userRole]);

    if (!mounted) {
        return null;
    }

    return (
        <StoreContext.Provider value={{
            username,
            setUsername,
            userRole,
            setUserRole,
            userId,
            setUserId,
            products,
            setProducts,
            activityLogs,
            addLog,
            clearLogs,
            canAddProduct,
            canEditProduct,
            canDeleteProduct,
            canStokMasuk,
            canStokKeluar,
        }}>
            {children}
        </StoreContext.Provider>
    );
}

export function useStore() {
    const ctx = useContext(StoreContext);
    if (!ctx) throw new Error('useStore must be used within StoreProvider');
    return ctx;
}
