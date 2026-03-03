/**
 * usePersonalization — derives user-specific data from order history.
 *
 * Returns:
 *  - orderedRestaurantIds  : IDs of restaurants the user has ordered from (most recent first)
 *  - topCuisineTags        : cuisine tags ordered by how often the user has visited them
 *  - lastOrderByRestaurant : map of restaurantId → last order info (for "Order Again")
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export interface LastOrder {
  orderId: string;
  restaurantId: string;
  restaurantName: string;
  createdAt: string;
  /** Short summary of what was ordered, e.g. "Butter Chicken, Naan (×2)" */
  itemsSummary: string;
  subtotal: number;
}

export interface PersonalizationData {
  /** Restaurant IDs the user has ordered from, most-recent-first, deduplicated */
  orderedRestaurantIds: string[];
  /** Cuisine tags ranked by visit frequency */
  topCuisineTags: string[];
  /** Most recent completed order per restaurant */
  lastOrderByRestaurant: Record<string, LastOrder>;
  loading: boolean;
}

export function usePersonalization(): PersonalizationData {
  const { session } = useAuth();
  const [data, setData] = useState<PersonalizationData>({
    orderedRestaurantIds: [],
    topCuisineTags: [],
    lastOrderByRestaurant: {},
    loading: true,
  });

  const fetchPersonalization = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) {
      setData((d) => ({ ...d, loading: false }));
      return;
    }

    try {
      // Fetch user's last 30 completed/served orders, newest first
      const { data: orders, error } = await supabase
        .from("orders")
        .select(`
          id,
          restaurant_id,
          status,
          subtotal,
          created_at,
          restaurants ( name, cuisine_tags ),
          order_items ( name, quantity )
        `)
        .eq("created_by", userId)
        .in("status", ["completed", "served", "active", "preparing", "ready"])
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      if (!orders || orders.length === 0) {
        setData({ orderedRestaurantIds: [], topCuisineTags: [], lastOrderByRestaurant: {}, loading: false });
        return;
      }

      // ── Deduplicated restaurant IDs (most recent first) ──
      const seenIds = new Set<string>();
      const orderedRestaurantIds: string[] = [];
      for (const o of orders) {
        const rid = o.restaurant_id?.toString();
        if (rid && !seenIds.has(rid)) {
          seenIds.add(rid);
          orderedRestaurantIds.push(rid);
        }
      }

      // ── Cuisine tag frequency map ──
      const tagCount: Record<string, number> = {};
      for (const o of orders) {
        const tags: string[] = (o.restaurants as any)?.cuisine_tags ?? [];
        for (const tag of tags) {
          tagCount[tag] = (tagCount[tag] ?? 0) + 1;
        }
      }
      const topCuisineTags = Object.entries(tagCount)
        .sort((a, b) => b[1] - a[1])
        .map(([tag]) => tag)
        .slice(0, 5);

      // ── Last order per restaurant ──
      const lastOrderByRestaurant: Record<string, LastOrder> = {};
      for (const o of orders) {
        const rid = o.restaurant_id?.toString();
        if (!rid || lastOrderByRestaurant[rid]) continue; // already have the most recent

        const items: { name: string; quantity: number }[] = (o.order_items as any) ?? [];
        const itemsSummary = items
          .slice(0, 3)
          .map((i) => (i.quantity > 1 ? `${i.name} (×${i.quantity})` : i.name))
          .join(", ");

        lastOrderByRestaurant[rid] = {
          orderId: o.id.toString(),
          restaurantId: rid,
          restaurantName: (o.restaurants as any)?.name ?? "Restaurant",
          createdAt: o.created_at,
          itemsSummary,
          subtotal: Number(o.subtotal),
        };
      }

      setData({ orderedRestaurantIds, topCuisineTags, lastOrderByRestaurant, loading: false });
    } catch (err) {
      console.error("usePersonalization error:", err);
      setData((d) => ({ ...d, loading: false }));
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchPersonalization();
  }, [fetchPersonalization]);

  return data;
}
