import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getRestaurantStatus, type RestaurantHour } from '@/lib/restaurant-hours';

/**
 * Fetches all restaurant_hours and returns a Set of restaurant IDs
 * that are currently CLOSED based on their hours.
 * Re-evaluates every 60 s so the UI stays live.
 */
export function useClosedRestaurantIds(): Set<string> {
    const [closedIds, setClosedIds] = useState<Set<string>>(new Set());

    async function fetchAndCompute() {
        try {
            const { data } = await supabase
                .from('restaurant_hours')
                .select('restaurant_id, day_of_week, open_time, close_time');
            if (!data) return;

            const grouped: Record<number, RestaurantHour[]> = {};
            for (const row of data) {
                if (!grouped[row.restaurant_id]) grouped[row.restaurant_id] = [];
                grouped[row.restaurant_id].push(row as RestaurantHour);
            }

            const closed = new Set<string>();
            for (const [id, hours] of Object.entries(grouped)) {
                if (getRestaurantStatus(hours).status === 'closed') {
                    closed.add(String(id));
                }
            }
            setClosedIds(closed);
        } catch (err) {
            console.error('useClosedRestaurantIds error:', err);
        }
    }

    useEffect(() => {
        fetchAndCompute();
        const interval = setInterval(fetchAndCompute, 60_000);
        return () => clearInterval(interval);
    }, []);

    return closedIds;
}
