import React, { useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Platform,
  Image,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import {
  ArrowLeft,
  Bell,
  BellRing,
  Clock,
  Users,
  CheckCircle2,
  Utensils,
  MapPin,
  ChevronRight,
  Trash2,
  AlertCircle,
  Hash,
} from "lucide-react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  useNotifications,
  type NotificationEvent,
  type ActiveWaitlistEntry,
} from "@/lib/notifications-context";

// ==========================================
// RELATIVE TIME HELPER
// ==========================================

function timeAgo(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;

  if (diffMs < 60_000) return "just now";
  if (diffMs < 3_600_000) {
    const mins = Math.floor(diffMs / 60_000);
    return `${mins} min ago`;
  }
  if (diffMs < 86_400_000) {
    const hrs = Math.floor(diffMs / 3_600_000);
    return `${hrs}h ago`;
  }
  const days = Math.floor(diffMs / 86_400_000);
  return days === 1 ? "Yesterday" : `${days}d ago`;
}

function formatJoinTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ==========================================
// STATUS CONFIG
// ==========================================

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; pulse: boolean }
> = {
  waiting: {
    label: "In Queue",
    color: "#FF9933",
    bg: "rgba(255,153,51,0.12)",
    pulse: false,
  },
  notified: {
    label: "Table Ready!",
    color: "#22C55E",
    bg: "rgba(34,197,94,0.12)",
    pulse: true,
  },
};

const EVENT_CONFIG: Record<
  string,
  {
    label: (r: string) => string;
    color: string;
    icon: React.FC<any>;
  }
> = {
  joined: {
    label: (r) => `Joined ${r}'s waitlist`,
    color: "#3B82F6",
    icon: Users,
  },
  table_ready: {
    label: (r) => `Your table is ready at ${r}`,
    color: "#22C55E",
    icon: BellRing,
  },
  seated: {
    label: (r) => `You were seated at ${r}`,
    color: "#FF9933",
    icon: Utensils,
  },
  removed: {
    label: (r) => `Removed from ${r}'s waitlist`,
    color: "#EF4444",
    icon: AlertCircle,
  },
};

// ==========================================
// ACTIVE WAITLIST WIDGET
// ==========================================

function WaitlistWidget({
  entry,
  onPress,
}: {
  entry: ActiveWaitlistEntry;
  onPress: () => void;
}) {
  const statusCfg = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.waiting;

  return (
    <Animated.View entering={FadeInDown.duration(400)} layout={LinearTransition}>
      <Pressable
        onPress={onPress}
        style={{
          backgroundColor: "#1a1a1a",
          borderRadius: 20,
          borderWidth: 1.5,
          borderColor:
            entry.status === "notified"
              ? "rgba(34,197,94,0.4)"
              : "#2a2a2a",
          overflow: "hidden",
          marginBottom: 12,
          shadowColor: entry.status === "notified" ? "#22C55E" : "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: entry.status === "notified" ? 0.2 : 0.12,
          shadowRadius: 12,
          elevation: 4,
        }}
      >
        {/* Header strip */}
        <View
          style={{
            backgroundColor: statusCfg.bg,
            paddingHorizontal: 16,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {entry.status === "notified" ? (
              <BellRing size={14} color={statusCfg.color} />
            ) : (
              <Clock size={14} color={statusCfg.color} />
            )}
            <Text
              style={{
                fontFamily: "BricolageGrotesque_700Bold",
                color: statusCfg.color,
                fontSize: 12,
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              {statusCfg.label}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: "Manrope_500Medium",
              color: "#666666",
              fontSize: 11,
            }}
          >
            Joined {formatJoinTime(entry.joinedAt)}
          </Text>
        </View>

        {/* Main content */}
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {/* Restaurant image */}
            <Image
              source={{ uri: entry.restaurantImage }}
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "#2a2a2a",
              }}
              resizeMode="cover"
            />

            {/* Info */}
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: "BricolageGrotesque_700Bold",
                  color: "#f5f5f5",
                  fontSize: 16,
                  letterSpacing: -0.2,
                  marginBottom: 4,
                }}
              >
                {entry.restaurantName}
              </Text>
              {entry.address ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    marginBottom: 4,
                  }}
                >
                  <MapPin size={10} color="#666" />
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: "Manrope_500Medium",
                      color: "#666666",
                      fontSize: 11,
                    }}
                  >
                    {entry.address}
                  </Text>
                </View>
              ) : null}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 3,
                    backgroundColor: "#262626",
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 8,
                  }}
                >
                  <Users size={10} color="#999" />
                  <Text
                    style={{
                      fontFamily: "JetBrainsMono_600SemiBold",
                      color: "#f5f5f5",
                      fontSize: 11,
                    }}
                  >
                    {entry.partySize}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 3,
                    backgroundColor: "#262626",
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 8,
                  }}
                >
                  <Clock size={10} color="#999" />
                  <Text
                    style={{
                      fontFamily: "JetBrainsMono_600SemiBold",
                      color: "#f5f5f5",
                      fontSize: 11,
                    }}
                  >
                    {entry.waitTime} min
                  </Text>
                </View>
              </View>
            </View>

            <ChevronRight size={18} color="#555" />
          </View>

          {/* Queue position bar */}
          {entry.status === "waiting" && entry.position !== null && (
            <View
              style={{
                marginTop: 14,
                backgroundColor: "#262626",
                borderRadius: 12,
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              {/* Position number */}
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: "rgba(255,153,51,0.12)",
                  borderWidth: 2,
                  borderColor: "#FF9933",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "BricolageGrotesque_700Bold",
                    color: "#FF9933",
                    fontSize: 18,
                  }}
                >
                  {entry.position}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "BricolageGrotesque_700Bold",
                    color: "#f5f5f5",
                    fontSize: 14,
                    marginBottom: 2,
                  }}
                >
                  {entry.position === 1
                    ? "You're next!"
                    : `${entry.position - 1} ${entry.position - 1 === 1 ? "party" : "parties"} ahead`}
                </Text>
                <Text
                  style={{
                    fontFamily: "Manrope_500Medium",
                    color: "#666666",
                    fontSize: 12,
                  }}
                >
                  {entry.totalInQueue} total in queue
                </Text>
              </View>

              {/* Mini queue dots */}
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  width: 52,
                  gap: 3,
                }}
              >
                {Array.from({ length: Math.min(entry.totalInQueue, 9) }).map(
                  (_, i) => (
                    <View
                      key={i}
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor:
                          i < (entry.position ?? 1) - 1
                            ? "#444"
                            : i === (entry.position ?? 1) - 1
                            ? "#FF9933"
                            : "#333",
                      }}
                    />
                  )
                )}
              </View>
            </View>
          )}

          {/* Table ready banner */}
          {entry.status === "notified" && (
            <View
              style={{
                marginTop: 14,
                backgroundColor: "rgba(34,197,94,0.1)",
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: "rgba(34,197,94,0.25)",
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <CheckCircle2 size={20} color="#22C55E" />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "BricolageGrotesque_700Bold",
                    color: "#22C55E",
                    fontSize: 14,
                  }}
                >
                  Your table is ready!
                </Text>
                {entry.notifiedAt && (
                  <Text
                    style={{
                      fontFamily: "Manrope_500Medium",
                      color: "rgba(34,197,94,0.7)",
                      fontSize: 11,
                      marginTop: 1,
                    }}
                  >
                    Notified {timeAgo(entry.notifiedAt)}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ==========================================
// NOTIFICATION EVENT ROW
// ==========================================

function NotificationRow({ event }: { event: NotificationEvent }) {
  const cfg = EVENT_CONFIG[event.type];
  if (!cfg) return null;
  const Icon = cfg.icon;

  return (
    <Animated.View
      entering={FadeInDown.duration(350)}
      layout={LinearTransition}
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#1e1e1e",
        backgroundColor: event.read ? "transparent" : "rgba(255,153,51,0.03)",
      }}
    >
      {/* Icon */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: `${cfg.color}18`,
          borderWidth: 1,
          borderColor: `${cfg.color}30`,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
          flexShrink: 0,
        }}
      >
        <Icon size={18} color={cfg.color} />
      </View>

      {/* Text */}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: "Manrope_600SemiBold",
            color: "#f5f5f5",
            fontSize: 14,
            lineHeight: 20,
            marginBottom: 4,
          }}
        >
          {cfg.label(event.restaurantName)}
        </Text>
        {event.partySize > 0 && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              marginBottom: 4,
            }}
          >
            <Users size={10} color="#555" />
            <Text
              style={{
                fontFamily: "Manrope_500Medium",
                color: "#555555",
                fontSize: 11,
              }}
            >
              Party of {event.partySize}
            </Text>
          </View>
        )}
        <Text
          style={{
            fontFamily: "Manrope_500Medium",
            color: "#555555",
            fontSize: 12,
          }}
        >
          {timeAgo(event.timestamp)}
        </Text>
      </View>

      {/* Unread dot */}
      {!event.read && (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: "#FF9933",
            marginTop: 6,
            marginLeft: 8,
            flexShrink: 0,
          }}
        />
      )}
    </Animated.View>
  );
}

// ==========================================
// MAIN SCREEN
// ==========================================

export default function NotificationsScreen() {
  const router = useRouter();
  const {
    events,
    activeEntries,
    unreadCount,
    markAllRead,
    clearAll,
    refreshActive,
  } = useNotifications();

  const [refreshing, setRefreshing] = React.useState(false);

  // Mark all read when screen opens
  useEffect(() => {
    if (unreadCount > 0) {
      markAllRead();
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await refreshActive();
    setRefreshing(false);
  }, [refreshActive]);

  const handleClearAll = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    clearAll();
  };

  const isEmpty = activeEntries.length === 0 && events.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: "#0f0f0f" }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Header */}
        <Animated.View
          entering={FadeIn.duration(400)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
              style={{
                backgroundColor: "#1a1a1a",
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: "#2a2a2a",
              }}
            >
              <ArrowLeft size={22} color="#f5f5f5" />
            </Pressable>
            <Text
              style={{
                fontFamily: "BricolageGrotesque_800ExtraBold",
                color: "#f5f5f5",
                fontSize: 28,
                letterSpacing: -0.5,
              }}
            >
              Notifications
            </Text>
          </View>

          {events.length > 0 && (
            <Pressable
              onPress={handleClearAll}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: "#1a1a1a",
                borderRadius: 20,
                borderWidth: 1,
                borderColor: "#2a2a2a",
              }}
            >
              <Trash2 size={13} color="#666" />
              <Text
                style={{
                  fontFamily: "Manrope_600SemiBold",
                  color: "#666666",
                  fontSize: 12,
                }}
              >
                Clear
              </Text>
            </Pressable>
          )}
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={isEmpty ? { flex: 1 } : { paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FF9933"
            />
          }
        >
          {isEmpty ? (
            /* ====== Empty State ====== */
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 40,
              }}
            >
              <Animated.View
                entering={FadeInDown.delay(200).duration(500)}
                style={{ alignItems: "center" }}
              >
                <View
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: 60,
                    backgroundColor: "#1a1a1a",
                    borderWidth: 1,
                    borderColor: "#2a2a2a",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 24,
                  }}
                >
                  <Bell size={48} color="#666666" />
                </View>
                <Text
                  style={{
                    fontFamily: "BricolageGrotesque_700Bold",
                    color: "#f5f5f5",
                    fontSize: 22,
                    textAlign: "center",
                    marginBottom: 8,
                  }}
                >
                  No Notifications
                </Text>
                <Text
                  style={{
                    fontFamily: "Manrope_500Medium",
                    color: "#999999",
                    fontSize: 15,
                    textAlign: "center",
                    lineHeight: 22,
                  }}
                >
                  Join a waitlist to see your position and get notified when your
                  table is ready.
                </Text>
              </Animated.View>
            </View>
          ) : (
            <>
              {/* ====== Active Waitlist Widgets ====== */}
              {activeEntries.length > 0 && (
                <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }}>
                  <Text
                    style={{
                      fontFamily: "Manrope_600SemiBold",
                      color: "#666666",
                      fontSize: 11,
                      letterSpacing: 1.2,
                      textTransform: "uppercase",
                      marginBottom: 12,
                    }}
                  >
                    Active Waitlists
                  </Text>
                  {activeEntries.map((entry) => (
                    <WaitlistWidget
                      key={entry.entryId}
                      entry={entry}
                      onPress={() => {
                        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push(
                          `/waitlist/${entry.restaurantId}?entry_id=${entry.entryId}&party_size=${entry.partySize}` as any
                        );
                      }}
                    />
                  ))}
                </View>
              )}

              {/* ====== Notification History ====== */}
              {events.length > 0 && (
                <View>
                  <View
                    style={{
                      paddingHorizontal: 16,
                      paddingBottom: 12,
                      paddingTop: activeEntries.length > 0 ? 8 : 4,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Manrope_600SemiBold",
                        color: "#666666",
                        fontSize: 11,
                        letterSpacing: 1.2,
                        textTransform: "uppercase",
                      }}
                    >
                      History
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: "#1a1a1a",
                      marginHorizontal: 16,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: "#2a2a2a",
                      overflow: "hidden",
                    }}
                  >
                    {events.map((event) => (
                      <NotificationRow key={event.id} event={event} />
                    ))}
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
