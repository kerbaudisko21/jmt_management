import { Merek } from './types';

export const mereks: Merek[] = [
    'Honda',
    'Yamaha',
    'Suzuki',
    'Kawasaki',
];

// Location names for role-based filtering (matched against locations.name from DB)
export function getLocationsForRole(role: string): string[] {
    switch (role) {
        case 'user_gudang_belakang':
            return ['Gudang Belakang'];
        case 'user_toko':
            return ['Gudang Toko', 'Toko'];
        case 'admin':
            return ['Gudang Belakang', 'Gudang Toko', 'Toko'];
        default:
            return [];
    }
}