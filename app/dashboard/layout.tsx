'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Shield, Warehouse, Store } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { StoreProvider, useStore } from '@/lib/store';
import { ToastProvider } from '@/components/Toast';
import { createClient } from '@/lib/supabase/client';
import { UserRole } from '@/lib/types';

const roleLabels: Record<UserRole, string> = {
    admin: 'Admin',
    user_gudang_belakang: 'Gudang Belakang',
    user_toko: 'Gudang Toko',
};

const roleIcons: Record<UserRole, typeof Shield> = {
    admin: Shield,
    user_gudang_belakang: Warehouse,
    user_toko: Store,
};

function DashboardContent({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { username, setUsername, userRole, setUserRole, setUserId } = useStore();
    const [loading, setLoading] = useState(true);

    const checkAuth = useCallback(async () => {
        try {
            const supabase = createClient();
            const { data: { user }, error } = await supabase.auth.getUser();

            if (error || !user) {
                router.push('/login');
                return;
            }

            setUserId(user.id);

            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileError || !profile) {
                const userUsername = user.user_metadata?.username ||
                    user.email?.split('@')[0] ||
                    'User';
                setUsername(userUsername);
                setUserRole('user_toko');
            } else {
                setUsername(profile.username || user.email?.split('@')[0] || 'User');
                setUserRole(profile.role as UserRole);
            }

            setLoading(false);
        } catch (err) {
            console.error('Auth error:', err);
            router.push('/login');
        }
    }, [router, setUsername, setUserRole, setUserId]);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    const handleLogout = useCallback(async () => {
        try {
            const supabase = createClient();
            try {
                const { data: { user } } = await supabase.auth.getUser();
                await supabase.from('activity_logs').insert({
                    action: 'logout',
                    user_id: user?.id || null,
                    user_name: username,
                    description: 'Logout dari sistem',
                });
            } catch { /* ignore */ }
            await supabase.auth.signOut();
            router.push('/login');
        } catch (err) {
            console.error('Logout error:', err);
        }
    }, [router, username]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-sm text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    const RoleIcon = roleIcons[userRole] || Shield;

    return (
        <div className="min-h-screen bg-gray-50 flex">
            <Sidebar />

            <div className="flex-1 flex flex-col min-w-0">
                <nav className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 shrink-0">
                    <p className="text-xs text-blue-600 font-medium">

                    </p>

                    <div className="flex items-center space-x-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-medium text-gray-900">{username}</p>
                            <div className="flex items-center justify-end space-x-1">
                                <RoleIcon className="w-3 h-3 text-gray-400" />
                                <p className="text-xs text-gray-500">{roleLabels[userRole]}</p>
                            </div>
                        </div>

                        <button
                            onClick={handleLogout}
                            className="flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition border border-red-200"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline font-medium">Logout</span>
                        </button>
                    </div>
                </nav>

                <main className="flex-1 overflow-y-auto p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}

export default function DashboardLayout({
                                            children
                                        }: {
    children: React.ReactNode
}) {
    return (
        <StoreProvider>
            <ToastProvider>
                <DashboardContent>{children}</DashboardContent>
            </ToastProvider>
        </StoreProvider>
    );
}