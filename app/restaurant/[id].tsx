import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  Dimensions,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import {
  groupMembers,
  type CartItem,
} from "@/data/mockData";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const HERO_HEIGHT = SCREEN_HEIGHT * 0.42;
const COLLAPSED_HEADER_HEIGHT = 100;
const SCROLL_THRESHOLD = HERO_HEIGHT;

export default function RestaurantDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userCoords } = useLocation();

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


  // ==================================================
  // FETCH RESTAURANT & MENU FROM SUPABASE
  // ==================================================
  useEffect(() => {
    if (id) {
      fetchRestaurantData();
      fetchMenu();
    }
  }, [id]);

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
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    router.push(`/waitlist/${restaurant?.id}` as any);
  }, [router, restaurant?.id]);

  const handleToggleFavorite = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setIsFavorited((prev) => !prev);
  }, []);

  const joinBtnScale = useSharedValue(1);
  const joinBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: joinBtnScale.value }],
  }));

  const isClosed = restaurant?.waitStatus === "darkgrey";
  const noWait = restaurant?.waitTime != null && restaurant.waitTime < 0;

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
                      backgroundColor: "rgba(255, 153, 51, 0.2)",
                      borderWidth: 1,
                      borderColor: "rgba(255, 153, 51, 0.15)",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Manrope_600SemiBold",
                        color: "#FF9933",
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
          <Text
            style={{
              fontFamily: "Manrope_500Medium",
              color: "#999999",
              fontSize: 15,
              marginBottom: 12,
            }}
          >
            {restaurant.cuisine}
          </Text>

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

            <View style={{ width: 1, height: 30, backgroundColor: "#333333" }} />

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
                  {restaurant.queueLength}
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
                onPress={isClosed || noWait ? undefined : handleJoinWaitlist}
                disabled={isClosed || noWait}
                onPressIn={() => {
                  if (!isClosed && !noWait) joinBtnScale.value = withSpring(0.95);
                }}
                onPressOut={() => {
                  if (!isClosed && !noWait) joinBtnScale.value = withSpring(1);
                }}
                className="rounded-2xl py-4 items-center flex-row justify-center"
                style={{
                  backgroundColor: isClosed || noWait ? "#333333" : "#FF9933",
                  shadowColor: isClosed || noWait ? "transparent" : "#FF9933",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: isClosed || noWait ? 0 : 0.4,
                  shadowRadius: 16,
                  elevation: isClosed || noWait ? 0 : 10,
                }}
              >
                <Clock size={18} color={isClosed || noWait ? "#999999" : "#0f0f0f"} strokeWidth={2.5} />
                <Text
                  style={{
                    fontFamily: "BricolageGrotesque_700Bold",
                    color: isClosed || noWait ? "#999999" : "#0f0f0f",
                    fontSize: 17,
                    marginLeft: 8,
                  }}
                >
                  {isClosed ? "Currently Closed" : noWait ? "Join Waitlist" : `Join Waitlist · ${restaurant.waitTime} min`}
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
          onShare={() =>
            Alert.alert("Share Cart", "Group link copied to clipboard!")
          }
        />
      )}
    </View>
  );
}
