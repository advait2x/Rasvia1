/**
 * Notifications Context
 *
 * - Persists notification events (table ready, seated, joined) in AsyncStorage
 * - Watches the current user's active waitlist entries in real-time via Supabase
 * - Provides both the notification history and live waitlist widgets
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { useAuth } from "./auth-context";

// ==========================================
// TYPES
// ==========================================

export type NotificationEventType =
  | "joined"
  | "table_ready"
  | "seated"
  | "removed";

export interface NotificationEvent {
  id: string;
  type: NotificationEventType;
  restaurantName: string;
  restaurantId: string;
  entryId: string;
  partySize: number;
  timestamp: string; // ISO string
  read: boolean;
}

export interface ActiveWaitlistEntry {
  entryId: string;
  restaurantId: string;
  restaurantName: string;
  restaurantImage: string;
  address: string;
  position: number | null;
  totalInQueue: number;
  waitTime: number;
  partySize: number;
  status: "waiting" | "notified" | "seated";
  joinedAt: string;
  notifiedAt: string | null;
}

interface NotificationsContextValue {
  events: NotificationEvent[];
  activeEntries: ActiveWaitlistEntry[];
  unreadCount: number;
  addEvent: (event: Omit<NotificationEvent, "id" | "read">) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  refreshActive: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue>({
  events: [],
  activeEntries: [],
  unreadCount: 0,
  addEvent: async () => {},
  markAllRead: async () => {},
  clearAll: async () => {},
  refreshActive: async () => {},
});

const STORAGE_KEY = "rasvia:notifications:v2";

// ==========================================
// HELPERS
// ==========================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function loadStoredEvents(): Promise<NotificationEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as NotificationEvent[];
  } catch {
    return [];
  }
}

async function saveEvents(events: NotificationEvent[]): Promise<void> {
  try {
    // Keep only the last 100 events
    const trimmed = events.slice(0, 100);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // silently ignore
  }
}

// ==========================================
// PROVIDER
// ==========================================

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [activeEntries, setActiveEntries] = useState<ActiveWaitlistEntry[]>([]);

  // Track entry IDs we're already watching to avoid duplicate subscriptions
  const watchedEntryIds = useRef<Set<string>>(new Set());
  const channelsRef = useRef<any[]>([]);

  // ==========================================
  // Load persisted events on mount
  // ==========================================
  useEffect(() => {
    loadStoredEvents().then(setEvents);
  }, []);

  // ==========================================
  // Fetch + watch active waitlist entries
  // ==========================================
  const refreshActive = useCallback(async () => {
    if (!session?.user?.id) {
      setActiveEntries([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("waitlist_entries")
        .select(`
          id,
          restaurant_id,
          party_size,
          status,
          created_at,
          notified_at,
          restaurants (
            id,
            name,
            image_url,
            address,
            current_wait_time
          )
        `)
        .eq("profile_id", session.user.id)
        .in("status", ["waiting", "notified"])
        .order("created_at", { ascending: false });

      if (error || !data) return;

      const entries: ActiveWaitlistEntry[] = await Promise.all(
        data.map(async (row: any) => {
          const rest = row.restaurants;

          // Calculate position
          let position: number | null = null;
          let total = 0;
          try {
            const { data: myEntry } = await supabase
              .from("waitlist_entries")
              .select("created_at")
              .eq("id", row.id)
              .single();

            const { count: ahead } = await supabase
              .from("waitlist_entries")
              .select("*", { count: "exact", head: true })
              .eq("restaurant_id", row.restaurant_id)
              .eq("status", "waiting")
              .lt("created_at", myEntry?.created_at ?? "");

            const { count: totalCount } = await supabase
              .from("waitlist_entries")
              .select("*", { count: "exact", head: true })
              .eq("restaurant_id", row.restaurant_id)
              .eq("status", "waiting");

            position = (ahead ?? 0) + 1;
            total = totalCount ?? 0;
          } catch {
            // silently ignore
          }

          return {
            entryId: row.id,
            restaurantId: String(row.restaurant_id),
            restaurantName: rest?.name ?? "Restaurant",
            restaurantImage:
              rest?.image_url ??
              "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
            address: rest?.address ?? "",
            position,
            totalInQueue: total,
            waitTime: rest?.current_wait_time ?? 0,
            partySize: row.party_size ?? 1,
            status: row.status,
            joinedAt: row.created_at,
            notifiedAt: row.notified_at ?? null,
          };
        })
      );

      setActiveEntries(entries);

      // Subscribe to any new entry IDs we haven't watched yet
      entries.forEach((entry) => {
        if (!watchedEntryIds.current.has(entry.entryId)) {
          watchedEntryIds.current.add(entry.entryId);
          subscribeToEntry(entry.entryId, entry.restaurantName, entry.restaurantId, entry.partySize);
        }
      });
    } catch {
      // silently ignore
    }
  }, [session]);

  // ==========================================
  // Subscribe to a single entry for status changes
  // ==========================================
  const subscribeToEntry = useCallback(
    (entryId: string, restaurantName: string, restaurantId: string, partySize: number) => {
      const channel = supabase
        .channel(`notif-entry:${entryId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "waitlist_entries",
            filter: `id=eq.${entryId}`,
          },
          (payload) => {
            const newRow = payload.new as any;
            const oldRow = payload.old as any;

            if (newRow.notified_at && !oldRow.notified_at) {
              // Table ready event
              addEvent({
                type: "table_ready",
                restaurantName,
                restaurantId,
                entryId,
                partySize,
                timestamp: new Date().toISOString(),
              });
              // Update active entry status
              setActiveEntries((prev) =>
                prev.map((e) =>
                  e.entryId === entryId
                    ? { ...e, status: "notified", notifiedAt: newRow.notified_at }
                    : e
                )
              );
            }

            if (newRow.status === "seated" && oldRow.status !== "seated") {
              addEvent({
                type: "seated",
                restaurantName,
                restaurantId,
                entryId,
                partySize,
                timestamp: new Date().toISOString(),
              });
              // Remove from active entries
              setActiveEntries((prev) => prev.filter((e) => e.entryId !== entryId));
            }

            if (
              (newRow.status === "cancelled" || newRow.status === "removed") &&
              oldRow.status === "waiting"
            ) {
              addEvent({
                type: "removed",
                restaurantName,
                restaurantId,
                entryId,
                partySize,
                timestamp: new Date().toISOString(),
              });
              setActiveEntries((prev) => prev.filter((e) => e.entryId !== entryId));
            }
          }
        )
        .subscribe();

      channelsRef.current.push(channel);
    },
    [session]
  );

  // ==========================================
  // Refresh when session changes
  // ==========================================
  useEffect(() => {
    // Cleanup old channels
    channelsRef.current.forEach((ch) => supabase.removeChannel(ch));
    channelsRef.current = [];
    watchedEntryIds.current.clear();

    refreshActive();
  }, [session?.user?.id]);

  // Also refresh every 60s to catch any missed updates
  useEffect(() => {
    const interval = setInterval(refreshActive, 60_000);
    return () => clearInterval(interval);
  }, [refreshActive]);

  // ==========================================
  // Cleanup on unmount
  // ==========================================
  useEffect(() => {
    return () => {
      channelsRef.current.forEach((ch) => supabase.removeChannel(ch));
    };
  }, []);

  // ==========================================
  // Event management
  // ==========================================
  const addEvent = useCallback(
    async (event: Omit<NotificationEvent, "id" | "read">) => {
      const newEvent: NotificationEvent = {
        ...event,
        id: generateId(),
        read: false,
      };
      setEvents((prev) => {
        const updated = [newEvent, ...prev];
        saveEvents(updated);
        return updated;
      });
    },
    []
  );

  const markAllRead = useCallback(async () => {
    setEvents((prev) => {
      const updated = prev.map((e) => ({ ...e, read: true }));
      saveEvents(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(async () => {
    setEvents([]);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const unreadCount = events.filter((e) => !e.read).length;

  return (
    <NotificationsContext.Provider
      value={{
        events,
        activeEntries,
        unreadCount,
        addEvent,
        markAllRead,
        clearAll,
        refreshActive,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
