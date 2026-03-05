import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getRestaurantStatus, type RestaurantHour } from '@/lib/restaurant-hours';

/**
 * Fetches all restaurant_hours and returns a Set of restaurant IDs
 * that are currently CLOSED based on their hours.
 * Restaurants with NO hours rows are also treated as closed (hours unavailable).
 * Re-evaluates every 60 s so the UI stays live.
 */
export function useClosedRestaurantIds(): Set<string> {
    const [closedIds, setClosedIds] = useState<Set<string>>(new Set());

    async function fetchAndCompute() {
        try {
            // Fetch all restaurant IDs and all hours rows in parallel
            const [restaurantsRes, hoursRes] = await Promise.all([
                supabase.from('restaurants').select('id').eq('is_enabled', true),
                supabase.from('restaurant_hours').select('restaurant_id, day_of_week, open_time, close_time'),
            ]);

            const allIds: string[] = (restaurantsRes.data ?? []).map((r: any) => String(r.id));

            // Group hours by restaurant_id
            const grouped: Record<number, RestaurantHour[]> = {};
            for (const row of hoursRes.data ?? []) {
                if (!grouped[row.restaurant_id]) grouped[row.restaurant_id] = [];
                grouped[row.restaurant_id].push(row as RestaurantHour);
            }

            const closed = new Set<string>();

            for (const id of allIds) {
                const hours = grouped[Number(id)];
                // No hours rows → treat as closed (hours unavailable)
                if (!hours || hours.length === 0) {
                    closed.add(id);
                    continue;
                }
                if (getRestaurantStatus(hours).status === 'closed') {
                    closed.add(id);
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
