import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useNotifications } from "@/lib/notifications-context";
import {
  ArrowLeft,
  X,
  MapPin,
  UtensilsCrossed,
  Bell,
  Share2,
} from "lucide-react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { WaitlistRing } from "@/components/WaitlistRing";
import { AppetizerCarousel } from "@/components/AppetizerCarousel";
import { supabase } from "@/lib/supabase";
import {
  type SupabaseRestaurant,
  type UIRestaurant,
  type SupabaseMenuItem,
  type UIMenuItem,
  mapSupabaseToUI,
  mapMenuItemToUI,
  haversineDistance,
} from "@/lib/restaurant-types";
import { useLocation } from "@/lib/location-context";
import { useAuth } from "@/lib/auth-context";
import type { MenuItem } from "@/data/mockData";

export default function WaitlistStatus() {
  const { id, entry_id, party_size } = useLocalSearchParams<{ id: string; entry_id?: string; party_size?: string }>();
  const router = useRouter();
  const { userCoords } = useLocation();
  const { session } = useAuth();
  const { addEvent, dismissEntry } = useNotifications();

  // ==========================================
  // SUPABASE STATE
  // ==========================================
  const [restaurant, setRestaurant] = useState<UIRestaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [position, setPosition] = useState<number | null>(null);
  const [totalInQueue, setTotalInQueue] = useState<number>(0);
  const [preOrderItems, setPreOrderItems] = useState<MenuItem[]>([]);
  const [showTableReady, setShowTableReady] = useState(false);
  const [showSeated, setShowSeated] = useState(false);
  const [partyOwnerName, setPartyOwnerName] = useState<string>("");
  const myPartySize = party_size ? parseInt(party_size, 10) : 1;

  // ==========================================
  // FETCH FROM SUPABASE
  // ==========================================
  useEffect(() => {
    async function fetchData() {
      try {
        // 1. Fetch the restaurant
        const { data: restData, error: restError } = await supabase
          .from("restaurants")
          .select("*")
          .eq("id", Number(id))
          .single();

        if (restError) {
          console.error("❌ Error fetching restaurant:", restError);
          Alert.alert("Error", "Could not load restaurant data.");
          return;
        }

        if (restData) {
          const uiRestaurant = mapSupabaseToUI(restData as SupabaseRestaurant, userCoords);
          setRestaurant(uiRestaurant);
        }

        // 2. Fetch menu items for this restaurant
        const { data: menuData, error: menuError } = await supabase
          .from("menu_items")
          .select("*")
          .eq("restaurant_id", Number(id))
          .eq("is_available", true);

        if (menuError) {
          console.error("❌ Error fetching menu items:", menuError);
        }

        if (menuData && menuData.length > 0) {
          const uiMenuItems = (menuData as SupabaseMenuItem[]).map(
            (item): MenuItem => {
              const mapped = mapMenuItemToUI(item);
              return {
                id: mapped.id,
                name: mapped.name,
                description: mapped.description,
                price: mapped.price,
                image: mapped.image,
                category: mapped.category,
                isPopular: mapped.isPopular,
                isVegetarian: mapped.isVegetarian,
                spiceLevel: mapped.spiceLevel,
              };
            }
          );
          setMenuItems(uiMenuItems);
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    fetchPartyOwnerName();
    if (entry_id) {
      fetchPosition(entry_id);
      checkEntryStatus(entry_id);
    }

    // Real-time: restaurant row changes (wait time, etc.)
    const restSub = supabase
      .channel(`waitlist-restaurant:${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "restaurants", filter: `id=eq.${id}` },
        (payload) => {
          const updated = mapSupabaseToUI(payload.new as SupabaseRestaurant, userCoords);
          setRestaurant(updated);
        }
      )
      .subscribe();

    // Real-time: waitlist_entries changes → refresh position
    const queueSub = supabase
      .channel(`waitlist-queue:${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "waitlist_entries", filter: `restaurant_id=eq.${id}` },
        () => { if (entry_id) fetchPosition(entry_id); }
      )
      .subscribe();

    // Real-time: watch OUR entry for notified_at or seated status
    const notifySub = entry_id
      ? supabase
          .channel(`my-entry:${entry_id}`)
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "waitlist_entries", filter: `id=eq.${entry_id}` },
            (payload) => {
              if (payload.new?.status === "seated" && payload.old?.status !== "seated") {
                triggerSeated();
              } else if (payload.new?.notified_at && !payload.old?.notified_at) {
                triggerTableReady();
              }
            }
          )
          .subscribe()
      : null;

    return () => {
      supabase.removeChannel(restSub);
      supabase.removeChannel(queueSub);
      if (notifySub) supabase.removeChannel(notifySub);
    };
  }, [id, entry_id]);

  async function fetchPartyOwnerName() {
    if (!session?.user?.id) return;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .single();
      if (data?.full_name) setPartyOwnerName(data.full_name);
    } catch {
      // silently ignore
    }
  }

  async function checkEntryStatus(entryId: string) {
    try {
      const { data } = await supabase
        .from("waitlist_entries")
        .select("notified_at, status")
        .eq("id", entryId)
        .single();
      if (data?.status === "seated") {
        triggerSeated();
      } else if (data?.notified_at) {
        triggerTableReady();
      }
    } catch {
      // silently ignore
    }
  }

  function triggerTableReady() {
    setShowTableReady(true);
    if (Platform.OS !== "web") {
      // Deep, patterned haptic sequence so the user really feels it
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 150);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 350);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 600);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 750);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 950);
    }
  }

  function triggerSeated() {
    setShowTableReady(false);
    setShowSeated(true);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 500);
    }
    // Auto-navigate back after 4 seconds
    setTimeout(() => router.replace("/"), 4000);
  }

  async function fetchPosition(entryId: string) {
    try {
      // Get our entry's created_at
      const { data: myEntry } = await supabase
        .from("waitlist_entries")
        .select("created_at")
        .eq("id", entryId)
        .single();

      if (!myEntry) return;

      // Count entries ahead of us (earlier created_at, still waiting)
      const { count: ahead } = await supabase
        .from("waitlist_entries")
        .select("*", { count: "exact", head: true })
        .eq("restaurant_id", Number(id))
        .eq("status", "waiting")
        .lt("created_at", myEntry.created_at);

      // Total waiting
      const { count: total } = await supabase
        .from("waitlist_entries")
        .select("*", { count: "exact", head: true })
        .eq("restaurant_id", Number(id))
        .eq("status", "waiting");

      setPosition((ahead ?? 0) + 1);
      setTotalInQueue(total ?? 0);
    } catch {
      // silently ignore
    }
  }

  // Recalculate distance when userCoords arrives after initial fetch
  useEffect(() => {
    if (!userCoords) return;
    setRestaurant((prev) => {
      if (!prev || prev.lat == null || prev.long == null) return prev;
      const dist = haversineDistance(
        userCoords.latitude, userCoords.longitude, prev.lat, prev.long,
      );
      return { ...prev, distance: `${dist.toFixed(1)} mi` };
    });
  }, [userCoords]);


  const handleLeaveQueue = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    Alert.alert(
      "Leave Queue",
      "Are you sure you want to leave the waitlist?",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            if (entry_id) {
              await supabase
                .from("waitlist_entries")
                .update({ status: "cancelled" })
                .eq("id", entry_id);
              // Add "left" event and remove the active widget
              addEvent({
                type: "left",
                restaurantName: restaurant?.name ?? "Restaurant",
                restaurantId: String(id),
                entryId: entry_id,
                partySize: myPartySize,
                timestamp: new Date().toISOString(),
              });
              dismissEntry(entry_id);
            }
            router.back();
          },
        },
      ]
    );
  }, [router, entry_id, restaurant?.name, id, myPartySize, addEvent, dismissEntry]);

  const handleAddAppetizer = useCallback((item: MenuItem) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setPreOrderItems((prev) => [...prev, item]);
    Alert.alert("Added!", `${item.name} added to your pre-order`, [
      { text: "OK" },
    ]);
  }, []);

  const handleShareWaitlist = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Alert.alert("Share Waitlist", "Invite friends to join your group!", [
      { text: "Copy Link" },
      { text: "Cancel", style: "cancel" },
    ]);
  }, []);

  const menuBtnScale = useSharedValue(1);
  const menuBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: menuBtnScale.value }],
  }));

  // ==========================================
  // LOADING STATE
  // ==========================================
  if (loading || !restaurant) {
    return (
      <View className="flex-1 bg-rasvia-black items-center justify-center">
        <ActivityIndicator size="large" color="#FF9933" />
        <Text
          style={{
            fontFamily: "Manrope_500Medium",
            color: "#999999",
            fontSize: 14,
            marginTop: 12,
          }}
        >
          Loading waitlist...
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-rasvia-black">
      <Stack.Screen options={{ gestureEnabled: false }} />
      <SafeAreaView className="flex-1" edges={["top"]}>
        {/* Header */}
        <Animated.View
          entering={FadeIn.duration(400)}
          className="flex-row items-center justify-between px-5 pt-2 pb-4"
        >
          <Pressable
            onPress={() => router.back()}
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
              fontFamily: "BricolageGrotesque_700Bold",
              color: "#f5f5f5",
              fontSize: 18,
            }}
          >
            Waitlist Status
          </Text>
          <Pressable
            onPress={handleLeaveQueue}
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgba(239, 68, 68, 0.2)",
            }}
          >
            <X size={20} color="#EF4444" />
          </Pressable>
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Restaurant Info */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(500)}
            className="px-5 mb-6"
          >
            <Text
              style={{
                fontFamily: "BricolageGrotesque_800ExtraBold",
                color: "#f5f5f5",
                fontSize: 32,
                letterSpacing: -0.5,
              }}
            >
              {restaurant.name}
            </Text>
            <View className="flex-row items-center mt-2">
              <MapPin size={13} color="#999999" />
              <Text
                style={{
                  fontFamily: "Manrope_500Medium",
                  color: "#999999",
                  fontSize: 13,
                  marginLeft: 4,
                }}
              >
                {restaurant.address}
              </Text>
            </View>
            {partyOwnerName !== "" && (
              <View className="flex-row items-center mt-1">
                <UtensilsCrossed size={13} color="#FF9933" />
                <Text
                  style={{
                    fontFamily: "Manrope_600SemiBold",
                    color: "#FF9933",
                    fontSize: 13,
                    marginLeft: 4,
                  }}
                >
                  Party under {partyOwnerName}
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Waitlist Ring */}
          <View className="items-center mb-10">
            <WaitlistRing
              position={position ?? 1}
              totalInQueue={totalInQueue || restaurant.queueLength}
              estimatedMinutes={restaurant.waitTime > 0 ? restaurant.waitTime : 0}
              restaurantName={restaurant.name}
            />
          </View>

          {/* Status Cards */}
          <Animated.View
            entering={FadeInUp.delay(400).duration(500)}
            className="px-5 mb-6"
          >
            <View className="flex-row">
              <View
                className="flex-1 mr-2 p-4 rounded-2xl"
                style={{
                  backgroundColor: "#1a1a1a",
                  borderWidth: 1,
                  borderColor: "#2a2a2a",
                }}
              >
                <View className="flex-row items-center mb-2">
                  <UtensilsCrossed size={16} color="#FF9933" />
                  <Text
                    style={{
                      fontFamily: "Manrope_600SemiBold",
                      color: "#999999",
                      fontSize: 12,
                      marginLeft: 6,
                    }}
                  >
                    Party Size
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: "JetBrainsMono_600SemiBold",
                    color: "#f5f5f5",
                    fontSize: 28,
                  }}
                >
                  {myPartySize}
                </Text>
                <Text
                  style={{
                    fontFamily: "Manrope_500Medium",
                    color: "#999999",
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  guests
                </Text>
              </View>

              <View
                className="flex-1 ml-2 p-4 rounded-2xl"
                style={{
                  backgroundColor: "#1a1a1a",
                  borderWidth: 1,
                  borderColor: "#2a2a2a",
                }}
              >
                <View className="flex-row items-center mb-2">
                  <Bell size={16} color="#FF9933" />
                  <Text
                    style={{
                      fontFamily: "Manrope_600SemiBold",
                      color: "#999999",
                      fontSize: 12,
                      marginLeft: 6,
                    }}
                  >
                    Notifications
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: "JetBrainsMono_600SemiBold",
                    color: "#22C55E",
                    fontSize: 16,
                  }}
                >
                  Active
                </Text>
                <Text
                  style={{
                    fontFamily: "Manrope_500Medium",
                    color: "#999999",
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  We'll ping you
                </Text>
              </View>
            </View>

            {/* Share Button */}
            <Pressable
              onPress={handleShareWaitlist}
              className="flex-row items-center justify-center mt-3 py-3 rounded-2xl"
              style={{
                backgroundColor: "#1a1a1a",
                borderWidth: 1,
                borderColor: "#2a2a2a",
              }}
            >
              <Share2 size={16} color="#FF9933" />
              <Text
                style={{
                  fontFamily: "Manrope_700Bold",
                  color: "#FF9933",
                  fontSize: 14,
                  marginLeft: 8,
                }}
              >
                Share & Start Group Order
              </Text>
            </Pressable>
          </Animated.View>

          {/* Pre-order count */}
          {preOrderItems.length > 0 && (
            <Animated.View
              entering={FadeIn.duration(400)}
              className="px-5 mb-6"
            >
              <View
                className="p-4 rounded-2xl flex-row items-center justify-between"
                style={{
                  backgroundColor: "rgba(255, 153, 51, 0.1)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 153, 51, 0.2)",
                }}
              >
                <View>
                  <Text
                    style={{
                      fontFamily: "Manrope_700Bold",
                      color: "#FF9933",
                      fontSize: 15,
                    }}
                  >
                    Pre-Order Ready
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Manrope_500Medium",
                      color: "#999999",
                      fontSize: 13,
                      marginTop: 2,
                    }}
                  >
                    {preOrderItems.length} items will arrive with your table
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: "JetBrainsMono_600SemiBold",
                    color: "#FF9933",
                    fontSize: 20,
                  }}
                >
                  $
                  {preOrderItems
                    .reduce((sum, i) => sum + i.price, 0)
                    .toFixed(2)}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Appetizer Carousel — only if menu items exist */}
          {menuItems.length > 0 && (
            <Animated.View entering={FadeInUp.delay(600).duration(500)}>
              <AppetizerCarousel
                items={menuItems}
                onAddItem={handleAddAppetizer}
              />
            </Animated.View>
          )}

        </ScrollView>

        {/* Bottom Action */}
        <View
          className="px-5 pt-3 pb-2"
          style={{
            borderTopWidth: 1,
            borderTopColor: "#222222",
            backgroundColor: "#0f0f0f",
          }}
        >
          <SafeAreaView edges={["bottom"]}>
            <Animated.View style={menuBtnStyle}>
              <Pressable
                onPress={() => {
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  router.push(`/restaurant/${restaurant.id}` as any);
                }}
                onPressIn={() => {
                  menuBtnScale.value = withSpring(0.95);
                }}
                onPressOut={() => {
                  menuBtnScale.value = withSpring(1);
                }}
                className="rounded-2xl py-4 items-center flex-row justify-center"
                style={{
                  backgroundColor: "#1a1a1a",
                  borderWidth: 1,
                  borderColor: "#333333",
                }}
              >
                <UtensilsCrossed size={18} color="#FF9933" />
                <Text
                  style={{
                    fontFamily: "BricolageGrotesque_700Bold",
                    color: "#f5f5f5",
                    fontSize: 16,
                    marginLeft: 8,
                  }}
                >
                  Browse Full Menu
                </Text>
              </Pressable>
            </Animated.View>
          </SafeAreaView>
        </View>
      </SafeAreaView>

      {/* Seated / Enjoy Your Meal screen */}
      <Modal visible={showSeated} transparent animationType="fade" onRequestClose={() => {}}>
        <View
          style={{
            flex: 1,
            backgroundColor: "#0f0f0f",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
          }}
        >
          <Animated.View entering={FadeInDown.springify().damping(14)} style={{ alignItems: "center" }}>
            <View
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: "rgba(255,153,51,0.15)",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 28,
                borderWidth: 2,
                borderColor: "rgba(255,153,51,0.4)",
              }}
            >
              <UtensilsCrossed size={44} color="#FF9933" />
            </View>
            <Text
              style={{
                fontFamily: "BricolageGrotesque_800ExtraBold",
                color: "#f5f5f5",
                fontSize: 34,
                textAlign: "center",
                marginBottom: 12,
                letterSpacing: -0.5,
              }}
            >
              Enjoy your meal!
            </Text>
            <Text
              style={{
                fontFamily: "Manrope_500Medium",
                color: "#999999",
                fontSize: 16,
                textAlign: "center",
                lineHeight: 24,
                marginBottom: 8,
              }}
            >
              {partyOwnerName ? `${partyOwnerName}'s party` : "Your party"} has been seated at {restaurant?.name}.
            </Text>
            <Text
              style={{
                fontFamily: "Manrope_400Regular",
                color: "#555",
                fontSize: 13,
                textAlign: "center",
              }}
            >
              Taking you back in a moment…
            </Text>
          </Animated.View>
        </View>
      </Modal>

      {/* Table Ready Notification */}
      <Modal visible={showTableReady} transparent animationType="fade" onRequestClose={() => {}}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.85)",
            alignItems: "center",
            justifyContent: "center",
            padding: 28,
          }}
        >
          <Animated.View
            entering={FadeInDown.springify().damping(14)}
            style={{
              backgroundColor: "#1a1a1a",
              borderRadius: 28,
              padding: 32,
              alignItems: "center",
              borderWidth: 1.5,
              borderColor: "#22C55E",
              width: "100%",
              shadowColor: "#22C55E",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.4,
              shadowRadius: 24,
              elevation: 20,
            }}
          >
            {/* Pulsing icon */}
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: "rgba(34,197,94,0.15)",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
                borderWidth: 2,
                borderColor: "rgba(34,197,94,0.4)",
              }}
            >
              <UtensilsCrossed size={36} color="#22C55E" />
            </View>

            <Text
              style={{
                fontFamily: "BricolageGrotesque_800ExtraBold",
                color: "#f5f5f5",
                fontSize: 28,
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              Your Table is Ready!
            </Text>
            <Text
              style={{
                fontFamily: "Manrope_500Medium",
                color: "#999999",
                fontSize: 15,
                textAlign: "center",
                marginBottom: 32,
                lineHeight: 22,
              }}
            >
              {restaurant?.name} is ready for your party of {myPartySize}. Please head to the host stand.
            </Text>

            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                setShowTableReady(false);
              }}
              style={{
                backgroundColor: "#22C55E",
                borderRadius: 16,
                paddingVertical: 16,
                paddingHorizontal: 32,
                alignItems: "center",
                width: "100%",
              }}
            >
              <Text
                style={{
                  fontFamily: "BricolageGrotesque_700Bold",
                  color: "#0f0f0f",
                  fontSize: 18,
                }}
              >
                I'm on my way! 🙌
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}
