import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
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
} from "@/lib/restaurant-types";
import type { MenuItem } from "@/data/mockData";

export default function WaitlistStatus() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // ==========================================
  // SUPABASE STATE
  // ==========================================
  const [restaurant, setRestaurant] = useState<UIRestaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [position, setPosition] = useState(1);
  const [estimatedMinutes, setEstimatedMinutes] = useState(5);
  const [preOrderItems, setPreOrderItems] = useState<MenuItem[]>([]);

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
          const uiRestaurant = mapSupabaseToUI(restData as SupabaseRestaurant);
          setRestaurant(uiRestaurant);
          setPosition(uiRestaurant.queueLength);
          setEstimatedMinutes(uiRestaurant.waitTime);
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
  }, [id]);

  // Simulate live queue updates
  useEffect(() => {
    if (!restaurant) return;

    const interval = setInterval(() => {
      setPosition((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 1;
        }
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        return prev - 1;
      });
      setEstimatedMinutes((prev) => Math.max(1, prev - 3));
    }, 8000);
    return () => clearInterval(interval);
  }, [restaurant]);

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
          onPress: () => router.back(),
        },
      ]
    );
  }, [router]);

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
          </Animated.View>

          {/* Waitlist Ring */}
          <View className="items-center mb-10">
            <WaitlistRing
              position={position}
              totalInQueue={restaurant.queueLength}
              estimatedMinutes={estimatedMinutes}
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
                  {restaurant.partySize || 1}
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

          {/* Timeline */}
          <Animated.View
            entering={FadeInUp.delay(700).duration(500)}
            className="px-5 mt-8"
          >
            <Text
              style={{
                fontFamily: "BricolageGrotesque_800ExtraBold",
                color: "#f5f5f5",
                fontSize: 24,
                marginBottom: 16,
              }}
            >
              Queue Timeline
            </Text>

            {[
              {
                label: "Joined Queue",
                time: "Just now",
                active: true,
                color: "#22C55E",
              },
              {
                label: "Getting Closer",
                time: `~${Math.max(1, Math.round(estimatedMinutes / 2))} min`,
                active: position <= Math.ceil(restaurant.queueLength / 2),
                color: "#F59E0B",
              },
              {
                label: "Almost There",
                time: "~2 min",
                active: position <= 2,
                color: "#FF9933",
              },
              {
                label: "Table Ready!",
                time: "",
                active: position <= 1,
                color: "#FF9933",
              },
            ].map((step, index) => (
              <View key={step.label} className="flex-row mb-4">
                <View className="items-center mr-4" style={{ width: 20 }}>
                  <View
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor: step.active ? step.color : "#333333",
                      shadowColor: step.active ? step.color : "transparent",
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: step.active ? 0.7 : 0,
                      shadowRadius: 10,
                    }}
                  />
                  {index < 3 && (
                    <View
                      style={{
                        width: 2,
                        height: 32,
                        backgroundColor: step.active ? step.color : "#333333",
                        marginTop: 4,
                        opacity: step.active ? 0.6 : 0.3,
                      }}
                    />
                  )}
                </View>
                <View className="flex-1">
                  <Text
                    style={{
                      fontFamily: step.active
                        ? "Manrope_700Bold"
                        : "Manrope_500Medium",
                      color: step.active ? "#f5f5f5" : "#555555",
                      fontSize: 16,
                    }}
                  >
                    {step.label}
                  </Text>
                  {step.time && (
                    <Text
                      style={{
                        fontFamily: "JetBrainsMono_600SemiBold",
                        color: step.active ? step.color : "#444444",
                        fontSize: 12,
                        marginTop: 2,
                      }}
                    >
                      {step.time}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </Animated.View>
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
    </View>
  );
}
