import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Search, Bell, MapPin, TrendingUp, Zap } from "lucide-react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { HeroCard } from "@/components/HeroCard";
import { RestaurantListCard } from "@/components/RestaurantListCard";
import { FilterBar } from "@/components/FilterBar";
import { FloatingQRButton } from "@/components/FloatingQRButton";
import { SearchOverlay } from "@/components/SearchOverlay";
import { type FilterType } from "@/data/mockData";
import { supabase } from "@/lib/supabase";
import {
  type SupabaseRestaurant,
  type UIRestaurant,
  mapSupabaseToUI
} from "@/lib/restaurant-types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function DiscoveryFeed() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [showSearch, setShowSearch] = useState(false);

  // ==================================================
  // STATE MANAGEMENT - Replace Mock Data
  // ==================================================
  const [restaurants, setRestaurants] = useState<UIRestaurant[]>([]);
  const [loading, setLoading] = useState(true);

  // ==================================================
  // THE "CHALO" REALTIME ENGINE
  // ==================================================
  useEffect(() => {
    fetchRestaurants();

    // This listens for changes to 'restaurants' table
    const subscription = supabase
      .channel('public:restaurants')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'restaurants' },
        (payload) => {
          console.log('Realtime Update:', payload);
          // Instant UI update without refreshing
          const updatedRestaurant = mapSupabaseToUI(payload.new as SupabaseRestaurant);
          setRestaurants((currentData) =>
            currentData.map((item) =>
              item.id === updatedRestaurant.id ? updatedRestaurant : item
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  async function fetchRestaurants() {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('current_wait_time', { ascending: true }); // Show fastest first

      if (error) throw error;
      if (data) {
        const uiRestaurants = data.map(mapSupabaseToUI);
        setRestaurants(uiRestaurants);
      }
    } catch (error) {
      console.error('Error fetching restaurants:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredRestaurants = restaurants.filter((r) => {
    if (activeFilter === "all") return true;
    return r.waitStatus === activeFilter;
  });

  const trendingRestaurants = restaurants.slice(0, 3);
  const nearbyRestaurants = filteredRestaurants;

  const handleRestaurantPress = useCallback(
    (id: string) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      router.push(`/restaurant/${id}` as any);
    },
    [router]
  );

  const handleQRPress = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    Alert.alert("QR Scanner", "Camera access needed for QR scanning", [
      { text: "OK" },
    ]);
  }, []);

  const handleFilterChange = useCallback((filter: FilterType) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    setActiveFilter(filter);
  }, []);

  return (
    <View className="flex-1 bg-rasvia-black">
      <SafeAreaView className="flex-1" edges={["top"]}>
        {/* Header */}
        <Animated.View
          entering={FadeIn.duration(500)}
          className="flex-row items-center justify-between px-5 pt-2 pb-4"
        >
          <View>
            <View className="flex-row items-center mb-1">
              <MapPin size={13} color="#FF9933" />
              <Text
                style={{
                  fontFamily: "Manrope_500Medium",
                  color: "#999999",
                  fontSize: 12,
                  marginLeft: 4,
                }}
              >
                Downtown
              </Text>
            </View>
            <Text
              style={{
                fontFamily: "BricolageGrotesque_800ExtraBold",
                color: "#f5f5f5",
                fontSize: 32,
                letterSpacing: -0.5,
              }}
            >
              rasvia
            </Text>
          </View>
          <View className="flex-row items-center">
            <Pressable
              className="mr-3"
              onPress={() => setShowSearch(true)}
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
              <Search size={20} color="#f5f5f5" />
            </Pressable>
            <Pressable
              style={{
                backgroundColor: "#1a1a1a",
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: "#2a2a2a",
                position: "relative",
              }}
            >
              <Bell size={20} color="#f5f5f5" />
              <View
                style={{
                  position: "absolute",
                  top: 10,
                  right: 11,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: "#EF4444",
                  borderWidth: 1.5,
                  borderColor: "#1a1a1a",
                }}
              />
            </Pressable>
          </View>
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* Trending Section */}
          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            <View className="px-5 mb-4">
              <View className="flex-row items-center mb-1">
                <TrendingUp size={18} color="#FF9933" />
                <Text
                  style={{
                    fontFamily: "BricolageGrotesque_800ExtraBold",
                    color: "#f5f5f5",
                    fontSize: 24,
                    marginLeft: 8,
                  }}
                >
                  Trending Now
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: "Manrope_500Medium",
                  color: "#999999",
                  fontSize: 14,
                  marginTop: 2,
                }}
              >
                Popular spots with live wait times
              </Text>
            </View>
          </Animated.View>

          {/* Hero Carousel */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4 }}
            decelerationRate="fast"
            snapToInterval={SCREEN_WIDTH - 48 + 16}
            snapToAlignment="start"
          >
            {trendingRestaurants.map((restaurant, index) => (
              <HeroCard
                key={restaurant.id}
                restaurant={restaurant}
                index={index}
                onPress={() => handleRestaurantPress(restaurant.id)}
              />
            ))}
          </ScrollView>

          {/* Filter Section */}
          <View className="mt-8 mb-4">
            <View className="px-5 mb-3">
              <Text
                style={{
                  fontFamily: "BricolageGrotesque_800ExtraBold",
                  color: "#f5f5f5",
                  fontSize: 24,
                }}
              >
                Nearby
              </Text>
              <Text
                style={{
                  fontFamily: "Manrope_500Medium",
                  color: "#999999",
                  fontSize: 14,
                  marginTop: 2,
                }}
              >
                Filter by wait time
              </Text>
            </View>
            <FilterBar
              activeFilter={activeFilter}
              onFilterChange={handleFilterChange}
            />
          </View>

          {/* Nearby Restaurants List */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4 }}
          >
            {nearbyRestaurants.map((restaurant, index) => (
              <RestaurantListCard
                key={restaurant.id}
                restaurant={restaurant}
                index={index}
                onPress={() => handleRestaurantPress(restaurant.id)}
              />
            ))}
          </ScrollView>

          {/* Quick Bites Section */}
          <Animated.View entering={FadeInDown.delay(400).duration(500)}>
            <View className="px-5 mt-8 mb-4">
              <View className="flex-row items-center mb-1">
                <Zap size={18} color="#22C55E" />
                <Text
                  style={{
                    fontFamily: "BricolageGrotesque_800ExtraBold",
                    color: "#f5f5f5",
                    fontSize: 24,
                    marginLeft: 8,
                  }}
                >
                  Quick Bites
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: "Manrope_500Medium",
                  color: "#999999",
                  fontSize: 14,
                  marginTop: 2,
                }}
              >
                Under 15 min wait
              </Text>
            </View>
          </Animated.View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4 }}
          >
            {restaurants
              .filter((r) => r.waitStatus === "green")
              .map((restaurant, index) => (
                <RestaurantListCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  index={index}
                  onPress={() => handleRestaurantPress(restaurant.id)}
                />
              ))}
          </ScrollView>

          {/* Popular Cuisines */}
          <Animated.View entering={FadeInDown.delay(500).duration(500)}>
            <View className="px-5 mt-8 mb-4">
              <Text
                style={{
                  fontFamily: "BricolageGrotesque_800ExtraBold",
                  color: "#f5f5f5",
                  fontSize: 24,
                }}
              >
                Explore Cuisines
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
            >
              {[
                { emoji: "🍛", label: "North Indian" },
                { emoji: "🥘", label: "South Indian" },
                { emoji: "🍢", label: "Pakistani" },
                { emoji: "🦐", label: "Sri Lankan" },
                { emoji: "🥡", label: "Indo-Chinese" },
                { emoji: "🍰", label: "Desserts" },
              ].map((cuisine, i) => (
                <CuisineChip
                  key={cuisine.label}
                  cuisine={cuisine}
                  index={i}
                  onPress={() => router.push(`/cuisine/${encodeURIComponent(cuisine.label)}` as any)}
                />
              ))}
            </ScrollView>
          </Animated.View>
        </ScrollView>

        {/* Floating QR Button */}
        <FloatingQRButton onPress={handleQRPress} />

        {/* Search Overlay */}
        {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} />}
      </SafeAreaView>
    </View>
  );
}

function CuisineChip({
  cuisine,
  index,
  onPress,
}: {
  cuisine: { emoji: string; label: string };
  index: number;
  onPress: () => void;
}) {
  const pressScale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 60).duration(400)}
      style={[animatedStyle]}
    >
      <Pressable
        className="items-center mr-4"
        style={{ width: 76 }}
        onPress={() => {
          if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          onPress();
        }}
        onPressIn={() => {
          pressScale.value = withSpring(0.92);
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1);
        }}
      >
        <View
          className="items-center justify-center mb-2"
          style={{
            width: 66,
            height: 66,
            borderRadius: 33,
            backgroundColor: "#1a1a1a",
            borderWidth: 1,
            borderColor: "#2a2a2a",
          }}
        >
          <Text style={{ fontSize: 28 }}>{cuisine.emoji}</Text>
        </View>
        <Text
          style={{
            fontFamily: "Manrope_600SemiBold",
            color: "#999999",
            fontSize: 11,
            textAlign: "center",
          }}
          numberOfLines={1}
        >
          {cuisine.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
