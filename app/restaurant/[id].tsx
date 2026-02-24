import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  Dimensions,
  Alert,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  Star,
  MapPin,
  Clock,
  Users,
  Heart,
  Share2,
  ShoppingBag,
  Settings,
} from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { WaitBadge } from "@/components/WaitBadge";
import { MenuGridItem } from "@/components/MenuGridItem";
import { MenuEditor } from "@/components/MenuEditor";
import { FoodDetailModal } from "@/components/FoodDetailModal";
import { GroupCartDrawer } from "@/components/GroupCartDrawer";
import { HoursStatusBadge } from "@/components/HoursStatusBadge";
import { RestaurantEditModal } from "@/components/RestaurantEditModal";
import { useAdminMode } from "@/hooks/useAdminMode";
import { useRestaurantHours } from "@/hooks/useRestaurantHours";
import { supabase } from "@/lib/supabase";
import {
  type SupabaseRestaurant,
  type UIRestaurant,
  type SupabaseMenuItem,
  type UIMenuItem,
  mapSupabaseToUI,
  mapMenuItemToUI,
  haversineDistance,
  parseFavorites,
} from "@/lib/restaurant-types";
import { useLocation } from "@/lib/location-context";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/notifications-context";
import {
  groupMembers,
  type CartItem,
} from "@/data/mockData";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const HERO_HEIGHT = SCREEN_HEIGHT * 0.42;
const COLLAPSED_HEADER_HEIGHT = 100;
const SCROLL_THRESHOLD = HERO_HEIGHT;

export default function RestaurantDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userCoords } = useLocation();
  const userCoordsRef = useRef(userCoords);
  useEffect(() => { userCoordsRef.current = userCoords; }, [userCoords]);
  const { isAdmin } = useAdminMode();
  const { session } = useAuth();
  const { addEvent, refreshActive } = useNotifications();
  const { statusResult: hoursStatus } = useRestaurantHours(id);

  // ==================================================
  // STATE MANAGEMENT - Supabase Data
  // ==================================================
  const [restaurant, setRestaurant] = useState<UIRestaurant | null>(null);
  const [menu, setMenu] = useState<UIMenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedItem, setSelectedItem] = useState<UIMenuItem | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Party size + join flow
  const [showPartySizePicker, setShowPartySizePicker] = useState(false);
  const [partySize, setPartySize] = useState(2);
  const [customParty, setCustomParty] = useState("");
  const [joining, setJoining] = useState(false);
  const [partyLeaderName, setPartyLeaderName] = useState("");
  const [existingEntry, setExistingEntry] = useState<{ id: string; party_size: number } | null>(null);

  // Live queue count from waitlist_entries
  const [liveQueueCount, setLiveQueueCount] = useState<number | null>(null);
  // Active group session for this restaurant (if any)
  const [hasActiveGroupSession, setHasActiveGroupSession] = useState(false);


  // Fetch party leader name + check for existing active entry
  useEffect(() => {
    if (!session?.user?.id) return;

    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => { if (data?.full_name) setPartyLeaderName(data.full_name); });

    if (id) {
      supabase
        .from("waitlist_entries")
        .select("id, party_size")
        .eq("restaurant_id", Number(id))
        .eq("user_id", session.user.id)
        .eq("status", "waiting")
        .maybeSingle()
        .then(({ data }) => {
          if (data) setExistingEntry({ id: data.id, party_size: data.party_size });
        });
    }
  }, [session?.user?.id, id]);

  // Check for an active group session for this restaurant on mount
  useEffect(() => {
    if (!session?.user?.id) return;
    const key = `rasvia:active_group_order:${session.user.id}`;
    AsyncStorage.getItem(key).then((raw) => {
      if (!raw) return;
      try {
        const stored = JSON.parse(raw);
        // Verify the party session still exists and is open
        supabase
          .from("party_sessions")
          .select("id, restaurant_id, status")
          .eq("id", stored.sessionId)
          .eq("status", "open")
          .single()
          .then(({ data }) => {
            setHasActiveGroupSession(!!data && String(data.restaurant_id) === String(id));
          });
      } catch {
        // corrupt data, ignore
      }
    });
  }, [session?.user?.id, id]);

  // Re-validate existing entry when screen regains focus (e.g. returning from waitlist)
  useFocusEffect(
    useCallback(() => {
      if (!existingEntry?.id) return;
      supabase
        .from("waitlist_entries")
        .select("status")
        .eq("id", existingEntry.id)
        .single()
        .then(({ data }) => {
          if (!data || data.status !== "waiting") {
            setExistingEntry(null);
          }
        });
    }, [existingEntry?.id])
  );

  // ==================================================
  // FETCH RESTAURANT & MENU FROM SUPABASE
  // ==================================================
  useEffect(() => {
    if (!id) return;

    fetchRestaurantData();
    fetchMenu();
    fetchQueueCount();

    // Real-time: restaurant row changes
    const restSub = supabase
      .channel(`restaurant:${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "restaurants", filter: `id=eq.${id}` },
        (payload) => {
          setRestaurant((prev) => {
            const mapped = mapSupabaseToUI(payload.new as SupabaseRestaurant, userCoordsRef.current ?? undefined);
            // Preserve computed distance if userCoords unavailable
            if (!userCoordsRef.current && prev?.distance) {
              return { ...mapped, distance: prev.distance };
            }
            return mapped;
          });
        }
      )
      .subscribe();

    // Real-time: waitlist_entries changes → refresh queue count
    const queueSub = supabase
      .channel(`queue-count:${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "waitlist_entries", filter: `restaurant_id=eq.${id}` },
        () => { fetchQueueCount(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(restSub);
      supabase.removeChannel(queueSub);
    };
  }, [id]);

  async function fetchQueueCount() {
    try {
      const { count } = await supabase
        .from("waitlist_entries")
        .select("*", { count: "exact", head: true })
        .eq("restaurant_id", Number(id))
        .eq("status", "waiting");
      setLiveQueueCount(count ?? 0);
    } catch {
      // silently ignore — fall back to calculated value
    }
  }

  async function fetchRestaurantData() {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        setRestaurant(mapSupabaseToUI(data as SupabaseRestaurant, userCoords));
      }

      // Check if this restaurant is favorited by the current user
      if (session?.user?.id) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("favorite_restaurants")
          .eq("id", session.user.id)
          .single();

        if (profileData && profileData.favorite_restaurants) {
          const arr = parseFavorites(profileData.favorite_restaurants);
          setIsFavorited(arr.includes(Number(id)));
        }
      }
    } catch (error) {
      console.error('Error fetching restaurant:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMenu() {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', id)
        .eq('is_available', true); // Only show available items

      if (error) throw error;
      if (data) {
        const uiMenuItems = data.map(item => mapMenuItemToUI(item as SupabaseMenuItem));
        setMenu(uiMenuItems);
      }
    } catch (error) {
      console.error('Error fetching menu:', error);
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

  // ==================================================
  // SCROLL ANIMATIONS (Friend's UI improvement)
  // ==================================================
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Hero: fixed height container, image parallaxes up inside
  const heroInnerStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, SCROLL_THRESHOLD],
      [0, -SCROLL_THRESHOLD * 0.3],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      scrollY.value,
      [0, SCROLL_THRESHOLD * 0.6],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ translateY }],
      opacity,
    };
  });

  // Collapsed header fades in
  const collapsedHeaderStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [SCROLL_THRESHOLD * 0.7, SCROLL_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      scrollY.value,
      [SCROLL_THRESHOLD * 0.7, SCROLL_THRESHOLD],
      [-10, 0],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  // Hero content (name/tags) fades out on scroll
  const heroContentStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, SCROLL_THRESHOLD * 0.4],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      scrollY.value,
      [0, SCROLL_THRESHOLD * 0.4],
      [0, -20],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const handleAddToCart = useCallback(
    (item: UIMenuItem) => {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setCartItems((prev) => {
        const existing = prev.find((ci) => ci.id === item.id);
        if (existing) {
          return prev.map((ci) =>
            ci.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
          );
        }
        return [
          ...prev,
          { ...item, quantity: 1, addedBy: groupMembers[0] },
        ];
      });
      setSelectedItem(null);
    },
    []
  );

  const handleUpdateQuantity = useCallback(
    (itemId: string, delta: number) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setCartItems((prev) => {
        const updated = prev.map((ci) =>
          ci.id === itemId
            ? { ...ci, quantity: Math.max(0, ci.quantity + delta) }
            : ci
        );
        return updated.filter((ci) => ci.quantity > 0);
      });
    },
    []
  );

  const handleJoinWaitlist = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (existingEntry) {
      router.push(`/waitlist/${restaurant?.id}?entry_id=${existingEntry.id}&party_size=${existingEntry.party_size}` as any);
      return;
    }
    setCustomParty("");
    setShowPartySizePicker(true);
  }, [existingEntry, restaurant?.id, router]);

  const handleConfirmJoin = useCallback(async () => {
    const size = customParty.trim() !== "" ? parseInt(customParty, 10) : partySize;
    if (isNaN(size) || size < 1) {
      Alert.alert("Invalid", "Please enter a valid party size.");
      return;
    }
    if (!session?.user?.id) {
      Alert.alert("Not signed in", "Please sign in to join a waitlist.");
      return;
    }
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setJoining(true);
    try {
      const { data, error } = await supabase
        .from("waitlist_entries")
        .insert({
          restaurant_id: Number(restaurant?.id),
          user_id: session.user.id,
          party_size: size,
          party_leader_name: partyLeaderName || null,
          status: "waiting",
        })
        .select("id, created_at")
        .single();

      if (error) throw error;
      setExistingEntry({ id: data.id, party_size: size });
      setShowPartySizePicker(false);

      // Record "joined" notification event and refresh active entries
      addEvent({
        type: "joined",
        restaurantName: restaurant?.name ?? "Restaurant",
        restaurantId: String(restaurant?.id),
        entryId: data.id,
        partySize: size,
        timestamp: new Date().toISOString(),
      });
      refreshActive();

      router.push(`/waitlist/${restaurant?.id}?entry_id=${data.id}&party_size=${size}` as any);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Could not join waitlist.");
    } finally {
      setJoining(false);
    }
  }, [partySize, customParty, session, restaurant?.id, router]);

  const handleToggleFavorite = useCallback(async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (!session?.user?.id) {
      Alert.alert("Sign In Required", "You must be signed in to favorite restaurants.");
      return;
    }

    const newFavoritedState = !isFavorited;
    setIsFavorited(newFavoritedState); // Optimistic generic update

    try {
      // First, get current favorites
      const { data: profileData, error: fetchError } = await supabase
        .from("profiles")
        .select("favorite_restaurants")
        .eq("id", session.user.id)
        .single();

      if (fetchError) throw fetchError;

      let currentFavorites = parseFavorites(profileData?.favorite_restaurants);

      if (newFavoritedState) {
        // Add if not present
        if (!currentFavorites.includes(Number(id))) {
          currentFavorites.push(Number(id));
        }
      } else {
        // Remove if present
        currentFavorites = currentFavorites.filter(favId => favId !== Number(id));
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ favorite_restaurants: currentFavorites })
        .eq("id", session.user.id);

      if (updateError) throw updateError;
    } catch (error) {
      console.error("Error toggling favorite:", error);
      // Revert optimistic update
      setIsFavorited(!newFavoritedState);
      Alert.alert("Error", "Could not update favorites. Please try again.");
    }
  }, [isFavorited, session, id]);

  const joinBtnScale = useSharedValue(1);
  const joinBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: joinBtnScale.value }],
  }));

  const isClosed = restaurant?.waitStatus === "darkgrey";
  const noWait = restaurant?.waitTime != null && restaurant.waitTime < 0;
  const waitlistClosed = restaurant?.waitlistOpen === false;

  // Show loading or error state
  if (!restaurant) {
    return (
      <View className="flex-1 bg-rasvia-black items-center justify-center">
        <Text style={{ color: '#999999', fontFamily: 'Manrope_500Medium' }}>
          {loading ? 'Loading...' : 'Restaurant not found'}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-rasvia-black">
      {/* Collapsed Sticky Header */}
      <Animated.View
        style={[
          collapsedHeaderStyle,
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            backgroundColor: "rgba(15, 15, 15, 0.97)",
            borderBottomWidth: 1,
            borderBottomColor: "#222222",
          },
        ]}
      >
        <SafeAreaView edges={["top"]}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}
          >
            <Pressable
              onPress={() => router.back()}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#1a1a1a",
                borderWidth: 1,
                borderColor: "#2a2a2a",
              }}
            >
              <ArrowLeft size={20} color="#f5f5f5" />
            </Pressable>

            <Image
              source={{ uri: restaurant.image }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                marginLeft: 12,
                borderWidth: 1,
                borderColor: "#2a2a2a",
              }}
              resizeMode="cover"
            />

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: "BricolageGrotesque_700Bold",
                  color: "#f5f5f5",
                  fontSize: 17,
                  letterSpacing: -0.3,
                }}
              >
                {restaurant.name}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                {restaurant.tags.slice(0, 2).map((tag) => (
                  <View
                    key={tag}
                    style={{
                      backgroundColor: "rgba(255, 153, 51, 0.15)",
                      borderRadius: 10,
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                      marginRight: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Manrope_500Medium",
                        color: "#FF9933",
                        fontSize: 9,
                      }}
                    >
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Pressable
                onPress={handleToggleFavorite}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#1a1a1a",
                  borderWidth: 1,
                  borderColor: "#2a2a2a",
                  marginRight: 6,
                }}
              >
                <Heart
                  size={16}
                  color={isFavorited ? "#EF4444" : "#f5f5f5"}
                  fill={isFavorited ? "#EF4444" : "transparent"}
                />
              </Pressable>
              <Pressable
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#1a1a1a",
                  borderWidth: 1,
                  borderColor: "#2a2a2a",
                }}
              >
                <Share2 size={16} color="#f5f5f5" />
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>

      {/* Main ScrollView */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Hero — fixed height container, content parallaxes inside */}
        <View style={{ height: HERO_HEIGHT, overflow: "hidden" }}>
          <Animated.View
            style={[heroInnerStyle, { position: "absolute", top: 0, left: 0, right: 0, height: HERO_HEIGHT }]}
          >
            <Image
              source={{ uri: restaurant.image }}
              style={{ width: "100%", height: HERO_HEIGHT, position: "absolute", top: 0, left: 0, right: 0 }}
              resizeMode="cover"
            />
            <LinearGradient
              colors={[
                "rgba(15,15,15,0.5)",
                "transparent",
                "rgba(15,15,15,0.7)",
                "rgba(15,15,15,1)",
              ]}
              locations={[0, 0.3, 0.7, 1]}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            />

            {/* Top Nav over hero */}
            <SafeAreaView edges={["top"]} className="absolute top-0 left-0 right-0">
              <View className="flex-row items-center justify-between px-5 pt-2">
                <Pressable
                  onPress={() => router.back()}
                  style={{
                    backgroundColor: "rgba(15, 15, 15, 0.6)",
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.08)",
                  }}
                >
                  <ArrowLeft size={22} color="#f5f5f5" />
                </Pressable>
                <View className="flex-row">
                  {isAdmin && (
                    <Pressable
                      className="mr-2"
                      onPress={() => {
                        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowEditModal(true);
                      }}
                      style={{
                        backgroundColor: "rgba(15, 15, 15, 0.6)",
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: "rgba(255,153,51,0.4)",
                      }}
                    >
                      <Settings size={20} color="#FF9933" />
                    </Pressable>
                  )}
                  <Pressable
                    className="mr-2"
                    onPress={handleToggleFavorite}
                    style={{
                      backgroundColor: "rgba(15, 15, 15, 0.6)",
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.08)",
                    }}
                  >
                    <Heart
                      size={20}
                      color={isFavorited ? "#EF4444" : "#f5f5f5"}
                      fill={isFavorited ? "#EF4444" : "transparent"}
                    />
                  </Pressable>
                  <Pressable
                    style={{
                      backgroundColor: "rgba(15, 15, 15, 0.6)",
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.08)",
                    }}
                  >
                    <Share2 size={20} color="#f5f5f5" />
                  </Pressable>
                </View>
              </View>
            </SafeAreaView>

            {/* Bottom Content on Image */}
            <Animated.View
              style={[heroContentStyle, { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 8 }]}
            >
              <View className="flex-row items-center mb-2">
                {restaurant.tags.map((tag) => (
                  <View
                    key={tag}
                    className="rounded-full px-2.5 py-0.5 mr-2"
                    style={{
                      backgroundColor: "rgba(255, 153, 51, 0.35)",
                      borderWidth: 1,
                      borderColor: "rgba(255, 153, 51, 0.5)",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Manrope_600SemiBold",
                        color: "rgba(255,153,51,0.95)",
                        fontSize: 11,
                      }}
                    >
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
              <Text
                style={{
                  fontFamily: "BricolageGrotesque_800ExtraBold",
                  color: "#f5f5f5",
                  fontSize: 40,
                  lineHeight: 44,
                  letterSpacing: -0.5,
                }}
              >
                {restaurant.name}
              </Text>
            </Animated.View>
          </Animated.View>
        </View>

        {/* Info Section */}
        <View className="px-5 pt-3 pb-4">
          {/* Stats Row */}
          <View
            className="flex-row items-center justify-between py-4 px-4 rounded-2xl"
            style={{
              backgroundColor: "#1a1a1a",
              borderWidth: 1,
              borderColor: "#2a2a2a",
            }}
          >
            <View className="items-center">
              <View className="flex-row items-center">
                <Star size={14} color="#FF9933" fill="#FF9933" />
                <Text
                  style={{
                    fontFamily: "JetBrainsMono_600SemiBold",
                    color: "#f5f5f5",
                    fontSize: 16,
                    marginLeft: 4,
                  }}
                >
                  {restaurant.rating}
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: "Manrope_500Medium",
                  color: "#999999",
                  fontSize: 11,
                  marginTop: 2,
                }}
              >
                {restaurant.reviewCount.toLocaleString()} reviews
              </Text>
            </View>

            {/* Divider + Wait time — only show when restaurant is currently open */}
            {(!hoursStatus || hoursStatus.status === 'open') && (
              <>
                <View style={{ width: 1, height: 30, backgroundColor: "#333333" }} />
                <View className="items-center">
                  <View className="flex-row items-center">
                    <Clock size={14} color="#FF9933" />
                    <WaitBadge
                      waitTime={restaurant.waitTime}
                      status={restaurant.waitStatus}
                      size="sm"
                    />
                  </View>
                  <Text
                    style={{
                      fontFamily: "Manrope_500Medium",
                      color: "#999999",
                      fontSize: 11,
                      marginTop: 2,
                    }}
                  >
                    wait time
                  </Text>
                </View>
              </>
            )}

            <View className="items-center">
              <View className="flex-row items-center">
                <Users size={14} color="#FF9933" />
                <Text
                  style={{
                    fontFamily: "JetBrainsMono_600SemiBold",
                    color: "#f5f5f5",
                    fontSize: 16,
                    marginLeft: 4,
                  }}
                >
                  {liveQueueCount ?? restaurant.queueLength}
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: "Manrope_500Medium",
                  color: "#999999",
                  fontSize: 11,
                  marginTop: 2,
                }}
              >
                in queue
              </Text>
            </View>
          </View>

          {/* Address */}
          <Pressable
            className="flex-row items-center mt-4"
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              if (restaurant.lat && restaurant.long) {
                router.push(
                  `/map?targetLat=${restaurant.lat}&targetLng=${restaurant.long}&restaurantId=${restaurant.id}` as any
                );
              }
            }}
          >
            <MapPin size={13} color="#999999" />
            <Text
              style={{
                fontFamily: "Manrope_500Medium",
                color: "#999999",
                fontSize: 13,
                marginLeft: 4,
                textDecorationLine: "underline",
              }}
            >
              {restaurant.address} · {restaurant.distance}
            </Text>
          </Pressable>

          {/* Hours status badge */}
          {hoursStatus && (
            <View style={{ marginTop: 8 }}>
              <HoursStatusBadge statusResult={hoursStatus} size="md" />
            </View>
          )}

          {/* Description */}
          <Text
            style={{
              fontFamily: "Manrope_500Medium",
              color: "#777777",
              fontSize: 15,
              lineHeight: 23,
              marginTop: 12,
            }}
          >
            {restaurant.description}
          </Text>
        </View>

        {/* Menu Section */}
        <View>
          <View className="px-5 mt-4 mb-4">
            <Text
              style={{
                fontFamily: "BricolageGrotesque_800ExtraBold",
                color: "#f5f5f5",
                fontSize: 24,
              }}
            >
              Visual Menu
            </Text>
            <Text
              style={{
                fontFamily: "Manrope_500Medium",
                color: "#999999",
                fontSize: 14,
                marginTop: 2,
              }}
            >
              Tap to explore, + to add to cart
            </Text>
          </View>

          <View className="px-4">
            <MenuEditor
              menu={menu}
              setMenu={setMenu}
              onItemPress={(item) => setSelectedItem(item)}
              onQuickAdd={(item) => handleAddToCart(item)}
              restaurantId={id}
            />
          </View>
        </View>
      </Animated.ScrollView>

      {/* Sticky Footer */}
      <View
        className="absolute bottom-0 left-0 right-0"
        style={{
          backgroundColor: "rgba(15, 15, 15, 0.97)",
          borderTopWidth: 1,
          borderTopColor: "#222222",
        }}
      >
        <SafeAreaView edges={["bottom"]}>
          <View className="flex-row items-center px-5 py-3">
            {cartItems.length > 0 && (
              <Pressable
                onPress={() => {
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setShowCart(true);
                }}
                className="mr-3"
                style={{
                  backgroundColor: "#1a1a1a",
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "#333333",
                  position: "relative",
                }}
              >
                <ShoppingBag size={22} color="#f5f5f5" />
                <View
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    backgroundColor: "#FF9933",
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: "#0f0f0f",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "JetBrainsMono_600SemiBold",
                      color: "#0f0f0f",
                      fontSize: 10,
                    }}
                  >
                    {cartItems.reduce((sum, ci) => sum + ci.quantity, 0)}
                  </Text>
                </View>
              </Pressable>
            )}

            <Animated.View style={[joinBtnStyle, { flex: 1 }]}>
              <Pressable
                onPress={isClosed || noWait || waitlistClosed ? undefined : handleJoinWaitlist}
                disabled={isClosed || noWait || waitlistClosed}
                onPressIn={() => {
                  if (!isClosed && !noWait && !waitlistClosed) joinBtnScale.value = withSpring(0.95);
                }}
                onPressOut={() => {
                  if (!isClosed && !noWait && !waitlistClosed) joinBtnScale.value = withSpring(1);
                }}
                className="rounded-2xl py-4 items-center flex-row justify-center"
                style={{
                  backgroundColor: isClosed || noWait || waitlistClosed ? "#333333" : "#FF9933",
                  shadowColor: isClosed || noWait || waitlistClosed ? "transparent" : "#FF9933",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: isClosed || noWait || waitlistClosed ? 0 : 0.4,
                  shadowRadius: 16,
                  elevation: isClosed || noWait || waitlistClosed ? 0 : 10,
                }}
              >
                <Clock size={18} color={isClosed || noWait || waitlistClosed ? "#999999" : "#0f0f0f"} strokeWidth={2.5} />
                <Text
                  style={{
                    fontFamily: "BricolageGrotesque_700Bold",
                    color: isClosed || noWait || waitlistClosed ? "#999999" : "#0f0f0f",
                    fontSize: 17,
                    marginLeft: 8,
                  }}
                >
                  {waitlistClosed ? "Waitlist Closed" : isClosed ? "Currently Closed" : noWait ? "Join Waitlist" : `Join Waitlist · ${restaurant.waitTime} min`}
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        </SafeAreaView>
      </View>

      {selectedItem && (
        <FoodDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onAddToCart={() => handleAddToCart(selectedItem)}
        />
      )}

      {showCart && (
        <GroupCartDrawer
          items={cartItems}
          members={groupMembers}
          onClose={() => setShowCart(false)}
          onUpdateQuantity={handleUpdateQuantity}
          isGroupMode={hasActiveGroupSession}
          onShare={() =>
            Alert.alert("Share Cart", "Group link copied to clipboard!")
          }
        />
      )}

      {/* Party Size Picker */}
      <Modal visible={showPartySizePicker} transparent animationType="fade" onRequestClose={() => setShowPartySizePicker(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
            <Pressable style={{ flex: 1 }} onPress={() => setShowPartySizePicker(false)} />
            <View style={{
              backgroundColor: "#1a1a1a",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 28,
              paddingBottom: Platform.OS === "ios" ? 44 : 28,
              borderWidth: 1,
              borderColor: "#2a2a2a",
            }}>
              <Text style={{ fontFamily: "BricolageGrotesque_700Bold", color: "#f5f5f5", fontSize: 22, marginBottom: 6 }}>
                Party Size
              </Text>
              <Text style={{ fontFamily: "Manrope_500Medium", color: "#999", fontSize: 14, marginBottom: 24 }}>
                How many guests are in your party?
              </Text>

              {/* Quick select 1-5 */}
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const selected = customParty === "" && partySize === n;
                  return (
                    <Pressable
                      key={n}
                      onPress={() => { setPartySize(n); setCustomParty(""); if (Platform.OS !== "web") Haptics.selectionAsync(); }}
                      style={{
                        flex: 1,
                        aspectRatio: 1,
                        borderRadius: 16,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: selected ? "#FF9933" : "#0f0f0f",
                        borderWidth: 1.5,
                        borderColor: selected ? "#FF9933" : "#2a2a2a",
                      }}
                    >
                      <Text style={{ fontFamily: "BricolageGrotesque_700Bold", color: selected ? "#0f0f0f" : "#f5f5f5", fontSize: 22 }}>
                        {n}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Custom number input */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 28 }}>
                <TextInput
                  value={customParty}
                  onChangeText={(v) => setCustomParty(v.replace(/[^0-9]/g, ""))}
                  keyboardType="number-pad"
                  placeholder="Larger party? Enter number…"
                  placeholderTextColor="#555"
                  style={{
                    flex: 1,
                    backgroundColor: "#0f0f0f",
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: customParty !== "" ? "#FF9933" : "#2a2a2a",
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                    color: "#f5f5f5",
                    fontFamily: "JetBrainsMono_600SemiBold",
                    fontSize: 16,
                  }}
                />
              </View>

              {/* Confirm button */}
              <Pressable
                onPress={handleConfirmJoin}
                disabled={joining}
                style={{
                  backgroundColor: "#FF9933",
                  borderRadius: 16,
                  padding: 18,
                  alignItems: "center",
                  opacity: joining ? 0.7 : 1,
                }}
              >
                {joining ? (
                  <ActivityIndicator color="#0f0f0f" />
                ) : (
                  <Text style={{ fontFamily: "BricolageGrotesque_700Bold", color: "#0f0f0f", fontSize: 18 }}>
                    Join Waitlist · {customParty !== "" ? (parseInt(customParty) || "?") : partySize} {(customParty !== "" ? (parseInt(customParty) || 1) : partySize) === 1 ? "guest" : "guests"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {showEditModal && restaurant && (
        <RestaurantEditModal
          restaurantId={restaurant.id}
          initial={{
            name: restaurant.name,
            address: restaurant.address,
            description: restaurant.description,
            cuisine: restaurant.tags.join(", "),
          }}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => {
            setRestaurant((prev) =>
              prev
                ? {
                  ...prev,
                  name: updated.name,
                  address: updated.address,
                  description: updated.description,
                  cuisine: updated.cuisine,
                  tags: updated.cuisine.split(",").map((t) => t.trim()).filter(Boolean),
                }
                : prev
            );
            setShowEditModal(false);
          }}
        />
      )}
    </View>
  );
}
