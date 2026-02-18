/**
 * Type definitions for Restaurant data
 * Maps between Supabase database schema (snake_case) and UI layer
 */

// ==========================================
// 1. DATABASE SCHEMA (From Supabase)
// ==========================================
export interface SupabaseRestaurant {
    id: number;
    name: string;
    address: string | null;
    description: string | null;
    image_url: string | null;
    current_wait_time: number;
    is_waitlist_open: boolean;
    rating: number;
    price_range: string;
    cuisine_tags: string[] | null;
    lat: number | null;
    long: number | null;
    owner_id: string | null;
    created_at: string;
}

// ==========================================
// 2. UI LAYER (For Components)
// ==========================================
export type WaitStatus = 'green' | 'amber' | 'red';

export interface UIRestaurant {
    id: string;
    name: string;
    cuisine: string;
    rating: number;
    reviewCount: number;
    distance: string;
    waitTime: number;
    waitStatus: WaitStatus;
    capacity: number;
    partySize: number;
    image: string;
    priceRange: string;
    address: string;
    description: string;
    tags: string[];
    queueLength: number;
    lat: number | null;
    long: number | null;
}

// ==========================================
// 3. HELPER FUNCTIONS
// ==========================================

/**
 * Calculate wait status based on wait time (Traffic Light Logic)
 * Green: < 15 minutes
 * Amber: 15-44 minutes
 * Red: >= 45 minutes
 */
export function getWaitStatus(waitTime: number): WaitStatus {
    if (waitTime < 15) return 'green';
    if (waitTime < 45) return 'amber';
    return 'red';
}

/**
 * Map Supabase restaurant data to UI format
 */
export function mapSupabaseToUI(restaurant: SupabaseRestaurant): UIRestaurant {
    const waitTime = restaurant.current_wait_time;
    const cuisineTags = restaurant.cuisine_tags || [];

    return {
        id: restaurant.id.toString(),
        name: restaurant.name,
        cuisine: cuisineTags.join(' • ') || 'Restaurant',
        rating: Number(restaurant.rating) || 0,
        reviewCount: 0, // Not in database yet - can add later
        distance: '0.5 mi', // TODO: Calculate from lat/long when available
        waitTime,
        waitStatus: getWaitStatus(waitTime),
        capacity: 0, // Not in database - can add later
        partySize: 0, // Not in database - user preference
        image: restaurant.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
        priceRange: restaurant.price_range || '$$',
        address: restaurant.address || '',
        description: restaurant.description || '',
        tags: cuisineTags,
        queueLength: Math.ceil(waitTime / 5), // Rough estimate: 1 party per 5 min
        lat: restaurant.lat ?? null,
        long: restaurant.long ?? null,
    };
}

// ==========================================
// 4. MENU ITEMS
// ==========================================

/**
 * Database schema for menu_items table
 */
export interface SupabaseMenuItem {
    id: number;
    restaurant_id: number;
    category_id: number | null;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
    is_available: boolean;
    is_vegetarian: boolean;
    is_spicy: boolean;
}

/**
 * UI format for menu items (compatible with existing components)
 */
export interface UIMenuItem {
    id: string;
    name: string;
    description: string;
    price: number;
    image: string;
    category: string;
    isPopular: boolean;
    isVegetarian: boolean;
    spiceLevel: number;
}

/**
 * Map Supabase menu item to UI format
 */
export function mapMenuItemToUI(item: SupabaseMenuItem): UIMenuItem {
    return {
        id: item.id.toString(),
        name: item.name,
        description: item.description || '',
        price: Number(item.price),
        image: item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80',
        category: 'Menu Item', // Can enhance with category lookup later
        isPopular: false, // Can enhance with analytics later
        isVegetarian: item.is_vegetarian,
        spiceLevel: item.is_spicy ? 2 : 0, // Simple mapping, can enhance later
    };
}
