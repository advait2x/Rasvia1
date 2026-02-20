import React, { useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Platform,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Star, MapPin, Clock, Users } from "lucide-react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { WaitBadge } from "@/components/WaitBadge";
import { supabase } from "@/lib/supabase";
import { type UIRestaurant, mapSupabaseToUI, type SupabaseRestaurant, haversineDistance } from "@/lib/restaurant-types";
import { useLocation } from "@/lib/location-context";

const cuisineEmojis: Record<string, string> = {
  "North Indian": "🍛",
  "South Indian": "🥘",
  "Pakistani": "🍢",
  "Sri Lankan": "🦐",
  "Indo-Chinese": "🥡",
  "Desserts": "🍰",
};

export default function CuisinePage() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const { userCoords } = useLocation();
  const [restaurants, setRestaurants] = useState<UIRestaurant[]>([]);
  const [loading, setLoading] = useState(true);

  const decodedName = decodeURIComponent(name || "");
  const emoji = cuisineEmojis[decodedName] || "🍽️";

  useEffect(() => {
    async function fetchRestaurants() {
      try {
        const { data, error } = await supabase
          .from('restaurants')
          .select('*')
          .ilike('cuisine_category', decodedName)
          .order('current_wait_time', { ascending: true });

        if (error) throw error;
        if (data) {
          const uiRestaurants = data.map((r: SupabaseRestaurant) => mapSupabaseToUI(r, userCoords));
          setRestaurants(uiRestaurants);
        }
      } catch (error) {
        console.error('Error fetching restaurants for cuisine:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchRestaurants();
  }, [decodedName]);

  // Recalculate distances when userCoords arrives after initial fetch
  useEffect(() => {
    if (!userCoords) return;
    setRestaurants((prev) =>
      prev.map((r) => {
        if (r.lat == null || r.long == null) return r;
        const dist = haversineDistance(
          userCoords.latitude, userCoords.longitude, r.lat, r.long,
        );
        return { ...r, distance: `${dist.toFixed(1)} mi` };
      }),
    );
  }, [userCoords]);

  const matchingRestaurants = restaurants;

  const handleRestaurantPress = useCallback(
    (id: string) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      router.push(`/restaurant/${id}` as any);
    },
    [router]
  );

  return (
    <View className="flex-1 bg-rasvia-black">
      <SafeAreaView className="flex-1" edges={["top"]}>
        <Animated.View
          entering={FadeIn.duration(400)}
          className="flex-row items-center px-5 pt-2 pb-4"
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
          <View style={{ marginLeft: 14, flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ fontSize: 26, marginRight: 8 }}>{emoji}</Text>
              <Text
                style={{
                  fontFamily: "BricolageGrotesque_800ExtraBold",
                  color: "#f5f5f5",
                  fontSize: 28,
                  letterSpacing: -0.5,
                }}
              >
                {decodedName}
              </Text>
            </View>
            <Text
              style={{
                fontFamily: "Manrope_500Medium",
                color: "#999999",
                fontSize: 13,
                marginTop: 2,
              }}
            >
              {matchingRestaurants.length} restaurant
              {matchingRestaurants.length !== 1 ? "s" : ""} found
            </Text>
          </View>
        </Animated.View>


        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        >
          {loading ? (
            <View style={{ paddingVertical: 60, alignItems: "center" }}>
              <ActivityIndicator size="large" color="#FF9933" />
              <Text
                style={{
                  fontFamily: "Manrope_500Medium",
                  color: "#999999",
                  fontSize: 14,
                  marginTop: 16,
                }}
              >
                Loading restaurants...
              </Text>
            </View>
          ) : matchingRestaurants.length === 0 ? (
            <Animated.View
              entering={FadeInDown.delay(200).duration(500)}
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 80,
              }}
            >
              <Text style={{ fontSize: 48, marginBottom: 16 }}>🍽️</Text>
              <Text
                style={{
                  fontFamily: "BricolageGrotesque_700Bold",
                  color: "#f5f5f5",
                  fontSize: 20,
                  textAlign: "center",
                  marginBottom: 8,
                }}
              >
                No restaurants yet
              </Text>
              <Text
                style={{
                  fontFamily: "Manrope_500Medium",
                  color: "#999999",
                  fontSize: 14,
                  textAlign: "center",
                }}
              >
                We're adding more {decodedName} spots soon!
              </Text>
            </Animated.View>
          ) : (
            matchingRestaurants.map((restaurant, index) => (
              <CuisineRestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                index={index}
                onPress={() => handleRestaurantPress(restaurant.id)}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function CuisineRestaurantCard({
  restaurant,
  index,
  onPress,
}: {
  restaurant: UIRestaurant;
  index: number;
  onPress: () => void;
}) {
  const pressScale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 80).duration(500)}
      style={[animatedStyle, { marginBottom: 16 }]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          pressScale.value = withSpring(0.97);
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1);
        }}
        style={{
          borderRadius: 20,
          overflow: "hidden",
          backgroundColor: "#1a1a1a",
          borderWidth: 1,
          borderColor: "#2a2a2a",
        }}
      >
        <Image
          source={{ uri: restaurant.image }}
          style={{ width: "100%", height: 180 }}
          resizeMode="cover"
        />
        <View style={{ position: "absolute", top: 12, right: 12 }}>
          <WaitBadge
            waitTime={restaurant.waitTime}
            status={restaurant.waitStatus}
            size="md"
          />
        </View>
        <View style={{ padding: 16 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: "BricolageGrotesque_800ExtraBold",
              color: "#f5f5f5",
              fontSize: 22,
              letterSpacing: -0.3,
              marginBottom: 4,
            }}
          >
            {restaurant.name}
          </Text>
          <Text
            style={{
              fontFamily: "Manrope_500Medium",
              color: "#999999",
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {restaurant.cuisine}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Star size={13} color="#FF9933" fill="#FF9933" />
              <Text
                style={{
                  fontFamily: "Manrope_700Bold",
                  color: "#f5f5f5",
                  fontSize: 14,
                  marginLeft: 4,
                }}
              >
                {restaurant.rating}
              </Text>
              <Text
                style={{
                  fontFamily: "Manrope_500Medium",
                  color: "#999999",
                  fontSize: 12,
                  marginLeft: 4,
                }}
              >
                ({restaurant.reviewCount.toLocaleString()})
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Users size={13} color="#FF9933" />
              <Text
                style={{
                  fontFamily: "JetBrainsMono_600SemiBold",
                  color: "#f5f5f5",
                  fontSize: 13,
                  marginLeft: 4,
                }}
              >
                {restaurant.queueLength}
              </Text>
              <Text
                style={{
                  fontFamily: "Manrope_500Medium",
                  color: "#999999",
                  fontSize: 11,
                  marginLeft: 4,
                }}
              >
                in queue
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <MapPin size={12} color="#999999" />
              <Text
                style={{
                  fontFamily: "Manrope_500Medium",
                  color: "#999999",
                  fontSize: 12,
                  marginLeft: 3,
                }}
              >
                {restaurant.distance}
              </Text>
            </View>
            <Text
              style={{
                fontFamily: "JetBrainsMono_600SemiBold",
                color: "#FF9933",
                fontSize: 13,
              }}
            >
              {restaurant.priceRange}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            {restaurant.tags.map((tag) => (
              <View
                key={tag}
                style={{
                  backgroundColor: "rgba(255, 153, 51, 0.12)",
                  borderRadius: 12,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  marginRight: 6,
                  marginBottom: 4,
                  borderWidth: 1,
                  borderColor: "rgba(255, 153, 51, 0.1)",
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
        </View>
      </Pressable>
    </Animated.View>
  );
}
