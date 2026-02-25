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
    is_enabled: boolean;
    waitlist_open: boolean;
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
export type WaitStatus = 'green' | 'amber' | 'red' | 'grey' | 'darkgrey';

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
    isEnabled: boolean;
    waitlistOpen: boolean;
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
    if (waitTime >= 999) return 'darkgrey';
    if (waitTime < 0) return 'grey';
    if (waitTime < 15) return 'green';
    if (waitTime < 45) return 'amber';
    return 'red';
}

/**
 * Haversine distance in miles between two lat/long points
 */
export function haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
): number {
    const R = 3958.8; // Earth radius in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Map Supabase restaurant data to UI format.
 * Pass userCoords to get live distance calculation.
 *
 * STRICT coordinate handling:
 *  - Force Number() coercion (Supabase numeric columns can arrive as strings)
 *  - Reject NaN / zero coordinates
 *  - Log mismatches for debugging
 */
export function mapSupabaseToUI(
    restaurant: SupabaseRestaurant,
    userCoords?: { latitude: number; longitude: number } | null,
): UIRestaurant {
    const waitTime = restaurant.current_wait_time;
    const cuisineTags = restaurant.cuisine_tags || [];

    // --- Strict coordinate parsing ---
    const rawLat = restaurant.lat;
    const rawLong = restaurant.long;
    const lat = rawLat != null ? Number(rawLat) : null;
    const lng = rawLong != null ? Number(rawLong) : null;

    // Validate: reject NaN or (0,0) coordinates
    const hasValidCoords =
        lat !== null &&
        lng !== null &&
        !Number.isNaN(lat) &&
        !Number.isNaN(lng) &&
        !(lat === 0 && lng === 0);

    if ((rawLat != null || rawLong != null) && !hasValidCoords) {
        console.warn(
            `⚠️ Invalid coordinates for restaurant "${restaurant.name}" (ID: ${restaurant.id}):`,
            { rawLat, rawLong, parsedLat: lat, parsedLng: lng }
        );
    }

    // Calculate distance strictly
    let distance = '—';
    if (userCoords && hasValidCoords) {
        const dist = haversineDistance(
            userCoords.latitude,
            userCoords.longitude,
            lat!,
            lng!,
        );
        distance = `${dist.toFixed(1)} mi`;
    }

    return {
        id: restaurant.id.toString(),
        name: restaurant.name,
        cuisine: cuisineTags.join(' • ') || 'Restaurant',
        rating: Number(restaurant.rating) || 0,
        reviewCount: 0,
        distance,
        waitTime,
        waitStatus: getWaitStatus(waitTime),
        capacity: 0,
        partySize: 0,
        image: restaurant.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
        priceRange: restaurant.price_range || '$$',
        address: restaurant.address || '',
        description: restaurant.description || '',
        tags: cuisineTags,
        queueLength: waitTime >= 999 ? 0 : Math.ceil(waitTime / 5),
        lat: hasValidCoords ? lat : null,
        long: hasValidCoords ? lng : null,
        isEnabled: restaurant.is_enabled !== false, // default true if column missing
        waitlistOpen: restaurant.waitlist_open !== false, // default true if column missing
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
    category: string | null;         // plain text category name (e.g. "Mains", "Starters")
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
    is_available: boolean;
    is_vegetarian: boolean;
    is_spicy: boolean;
    meal_times?: string[] | null;    // e.g. ["breakfast", "lunch", "dinner", "special"]
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
    mealTimes: string[];            // e.g. ["breakfast", "lunch"]
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
        category: item.category || 'Menu Item',
        isPopular: false,
        isVegetarian: item.is_vegetarian,
        spiceLevel: item.is_spicy ? 2 : 0,
        mealTimes: item.meal_times || [],
    };
}

/**
 * Robustly parses a favorite_restaurants column value from Supabase into a number array.
 * This handles cases where the column is accidentally created as a JSON string, a Postgres array string `"{1,2}"`, or a native array.
 */
export function parseFavorites(data: any): number[] {
    if (!data) return [];
    if (Array.isArray(data)) return data.map(Number);
    if (typeof data === 'string') {
        // Try parsing as JSON first
        try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) return parsed.map(Number);
        } catch { }

        // Handle Postgres array literal format "{1,2}"
        if (data.startsWith('{') && data.endsWith('}')) {
            return data
                .slice(1, -1)
                .split(',')
                .map(s => Number(s.trim()))
                .filter(n => !isNaN(n));
        }
    }
    return [];
}

// ==========================================
// 5. ORDERS
// ==========================================

export type OrderType = 'dine_in' | 'pre_order' | 'takeout';
export type OrderStatus = 'active' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled';
export type MealPeriod = 'breakfast' | 'lunch' | 'dinner' | 'special';

export interface SupabaseOrder {
    id: number;
    restaurant_id: number;
    table_number: string | null;
    party_size: number;
    order_type: OrderType;
    status: OrderStatus;
    meal_period: MealPeriod;
    subtotal: number;
    tip_amount: number;
    tip_percent: number | null;
    payment_method: string;
    notes: string | null;
    waitlist_entry_id: string | null;
    party_session_id: string | null;
    customer_name: string | null;
    created_at: string;
    closed_at: string | null;
    created_by: string | null;
    restaurants?: { name: string; image_url: string | null } | null;
    order_items?: SupabaseOrderItem[];
}

export interface SupabaseOrderItem {
    id: number;
    order_id: number;
    menu_item_id: number | null;
    name: string;
    price: number;
    quantity: number;
    is_vegetarian: boolean;
    notes: string | null;
    created_at: string;
}

export interface UIOrder {
    id: string;
    restaurantId: string;
    restaurantName: string;
    tableNumber: string;
    partySize: number;
    orderType: OrderType;
    status: OrderStatus;
    mealPeriod: MealPeriod;
    subtotal: number;
    tipAmount: number;
    tipPercent: number | null;
    paymentMethod: string;
    customerName: string | null;
    notes: string;
    items: UIOrderItem[];
    createdAt: string;
    closedAt: string | null;
    elapsedMinutes: number;
}

export interface UIOrderItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    isVegetarian: boolean;
    notes: string;
    lineTotal: number;
}

export function mapOrderToUI(order: SupabaseOrder): UIOrder {
    const items: UIOrderItem[] = (order.order_items || []).map(item => ({
        id: item.id.toString(),
        name: item.name,
        price: Number(item.price),
        quantity: item.quantity,
        isVegetarian: item.is_vegetarian,
        notes: item.notes || '',
        lineTotal: Number(item.price) * item.quantity,
    }));
    const now = new Date();
    const created = new Date(order.created_at);
    const elapsedMinutes = Math.floor((now.getTime() - created.getTime()) / 60000);
    return {
        id: order.id.toString(),
        restaurantId: order.restaurant_id.toString(),
        restaurantName: order.restaurants?.name || 'Restaurant',
        tableNumber: order.table_number || '—',
        partySize: order.party_size,
        orderType: order.order_type,
        status: order.status,
        mealPeriod: order.meal_period,
        subtotal: Number(order.subtotal),
        tipAmount: Number(order.tip_amount),
        tipPercent: order.tip_percent ? Number(order.tip_percent) : null,
        paymentMethod: order.payment_method,
        customerName: order.customer_name || null,
        notes: order.notes || '',
        items,
        createdAt: order.created_at,
        closedAt: order.closed_at,
        elapsedMinutes,
    };
}
