import { createClient } from '@/lib/supabase/server';
import { Database } from './database.types';

type Product = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductUpdate = Database['public']['Tables']['products']['Update'];
type ActivityLog = Database['public']['Tables']['activity_logs']['Row'];
type ActivityLogInsert = Database['public']['Tables']['activity_logs']['Insert'];
type StockMovement = Database['public']['Tables']['stock_movements']['Insert'];

// =====================================================
// PRODUCTS
// =====================================================

export async function getProducts() {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('products_view')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

export async function getProductById(id: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw error;
    return data;
}

export async function getProductByBarcode(barcode: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('barcode', barcode)
        .single();

    if (error) throw error;
    return data;
}

export async function createProduct(product: ProductInsert) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
        .from('products')
        .insert({
            ...product,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateProduct(id: string, product: ProductUpdate) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
        .from('products')
        .update({
            ...product,
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteProduct(id: string) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

export async function searchProducts(query: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('products_view')
        .select('*')
        .or(`nama.ilike.%${query}%,barcode.ilike.%${query}%`)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

export async function getLowStockProducts() {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('products_view')
        .select('*')
        .eq('low_stock', true)
        .order('stok', { ascending: true });

    if (error) throw error;
    return data;
}

// =====================================================
// STOCK MANAGEMENT
// =====================================================

export async function updateStock(
    productId: string,
    type: 'masuk' | 'keluar',
    quantity: number,
    notes?: string
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Get current product
    const { data: product, error: productError } = await supabase
        .from('products')
        .select('stok')
        .eq('id', productId)
        .single();

    if (productError) throw productError;

    const previousStock = product.stok;
    const newStock = type === 'masuk'
        ? previousStock + quantity
        : previousStock - quantity;

    if (newStock < 0) {
        throw new Error('Stok tidak mencukupi');
    }

    // Update product stock
    const { error: updateError } = await supabase
        .from('products')
        .update({ stok: newStock })
        .eq('id', productId);

    if (updateError) throw updateError;

    // Record stock movement
    const stockMovement: StockMovement = {
        product_id: productId,
        type,
        quantity,
        previous_stock: previousStock,
        new_stock: newStock,
        notes,
        user_id: user?.id,
    };

    const { error: movementError } = await supabase
        .from('stock_movements')
        .insert(stockMovement);

    if (movementError) throw movementError;

    return { previousStock, newStock };
}

export async function getStockMovements(productId?: string, limit: number = 50) {
    const supabase = await createClient();

    let query = supabase
        .from('stock_movements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (productId) {
        query = query.eq('product_id', productId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
}

// =====================================================
// LOCATIONS
// =====================================================

export async function getLocations() {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name');

    if (error) throw error;
    return data;
}

// =====================================================
// ACTIVITY LOGS
// =====================================================

export async function addActivityLog(log: Omit<ActivityLogInsert, 'user_id' | 'created_at'>) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
        .from('activity_logs')
        .insert({
            ...log,
            user_id: user?.id,
        });

    if (error) throw error;
}

export async function getActivityLogs(limit: number = 100) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('recent_activities')
        .select('*')
        .limit(limit);

    if (error) throw error;
    return data;
}

export async function clearActivityLogs() {
    const supabase = await createClient();

    // Only admins can clear logs (enforced by RLS)
    const { error } = await supabase
        .from('activity_logs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) throw error;
}

// =====================================================
// STATISTICS & REPORTS
// =====================================================

export async function getStockByLocation() {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('stock_by_location')
        .select('*');

    if (error) throw error;
    return data;
}

export async function getDashboardStats() {
    const supabase = await createClient();

    // Total products
    const { count: totalProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

    // Low stock items (stok < 10)
    const { count: lowStockCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .lt('stok', 10);

    // Total stock
    const { data: products } = await supabase
        .from('products')
        .select('stok');

    const totalStok = products?.reduce(
        (sum, p) => sum + (p.stok || 0),
        0
    ) || 0;

    // Recent activities
    const { data: recentActivities } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    return {
        totalProducts: totalProducts || 0,
        lowStockCount: lowStockCount || 0,
        totalStok,
        recentActivities: recentActivities || [],
    };
}

// =====================================================
// USER MANAGEMENT
// =====================================================

export async function getCurrentUser() {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) return null;

    const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

    if (profileError) return null;

    return { ...user, profile };
}

export async function updateUserProfile(updates: {
    username?: string;
    full_name?: string;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id);

    if (error) throw error;
}