import React from "react";
import { View, Text, Pressable, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { WaitBadge } from "@/components/WaitBadge";
import { Star } from "lucide-react-native";
import type { UIRestaurant } from "@/lib/restaurant-types";
import Animated, {
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

interface RestaurantListCardProps {
  restaurant: UIRestaurant;
  index: number;
  onPress: () => void;
}

export function RestaurantListCard({
  restaurant,
  index,
  onPress,
}: RestaurantListCardProps) {
  const pressScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 50).duration(400)}
      style={[animatedStyle, { width: 200, marginRight: 12 }]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          pressScale.value = withSpring(0.95);
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1);
        }}
        className="rounded-xl overflow-hidden bg-rasvia-card"
        style={{ borderWidth: 1, borderColor: "#2a2a2a" }}
      >
        <View style={{ height: 130, position: "relative" }}>
          <Image
            source={{ uri: restaurant.image }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["transparent", "rgba(34,34,34,0.9)"]}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "50%",
            }}
          />
          <View className="absolute top-2 right-2">
            <WaitBadge
              waitTime={restaurant.waitTime}
              status={restaurant.waitStatus}
              size="sm"
            />
          </View>
        </View>
        <View className="p-3">
          <Text
            style={{
              fontFamily: "BricolageGrotesque_700Bold",
              color: "#f5f5f5",
              fontSize: 16,
              marginBottom: 2,
            }}
            numberOfLines={1}
          >
            {restaurant.name}
          </Text>
          <Text
            style={{
              fontFamily: "Manrope_500Medium",
              color: "#999999",
              fontSize: 12,
              marginBottom: 6,
            }}
            numberOfLines={1}
          >
            {restaurant.cuisine}
          </Text>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Star size={11} color="#FF9933" fill="#FF9933" />
              <Text
                style={{
                  fontFamily: "Manrope_600SemiBold",
                  color: "#f5f5f5",
                  fontSize: 12,
                  marginLeft: 3,
                }}
              >
                {restaurant.rating}
              </Text>
            </View>
            <Text
              style={{
                fontFamily: "JetBrainsMono_600SemiBold",
                color: "#FF9933",
                fontSize: 12,
              }}
            >
              {restaurant.priceRange}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}
