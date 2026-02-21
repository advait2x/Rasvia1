import React from "react";
import { View, Text, Pressable, Image, Dimensions, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Plus, Leaf, Flame } from "lucide-react-native";
import type { MenuItem } from "@/data/mockData";
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const COLUMN_GAP = 10;
const PADDING = 16;
const COLUMN_WIDTH = (SCREEN_WIDTH - PADDING * 2 - COLUMN_GAP) / 2;

interface MenuGridItemProps {
  item: MenuItem;
  index: number;
  onPress: () => void;
  onQuickAdd: () => void;
}

export function MenuGridItem({
  item,
  index,
  onPress,
  onQuickAdd,
}: MenuGridItemProps) {
  const pressScale = useSharedValue(1);
  const isEven = index % 2 === 0;
  const imageHeight = isEven ? 180 : 220;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 50).duration(500)}
      style={{
        width: COLUMN_WIDTH,
        marginBottom: COLUMN_GAP,
      }}
    >
      <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          pressScale.value = withSpring(0.96);
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1);
        }}
        className="rounded-xl overflow-hidden bg-rasvia-card"
      >
        <View style={{ height: imageHeight, position: "relative" }}>
          <Image
            source={{ uri: item.image }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["transparent", "rgba(34,34,34,0.95)"]}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "50%",
            }}
          />

          {/* Quick Add Button */}
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              onQuickAdd();
            }}
            className="absolute bottom-2 right-2"
            style={{
              backgroundColor: "#FF9933",
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#FF9933",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.4,
              shadowRadius: 6,
              elevation: 5,
            }}
          >
            <Plus size={18} color="#0f0f0f" strokeWidth={3} />
          </Pressable>

          {/* Popular Badge */}
          {item.isPopular && (
            <View
              className="absolute top-2 left-2 px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "rgba(255, 153, 51, 0.25)" }}
            >
              <Text
                style={{
                  fontFamily: "Manrope_600SemiBold",
                  color: "#FF9933",
                  fontSize: 10,
                }}
              >
                Popular
              </Text>
            </View>
          )}
        </View>

        <View className="p-2.5">
          <View className="flex-row items-center mb-1">
            {item.isVegetarian && (
              <Leaf size={11} color="#22C55E" style={{ marginRight: 4 }} />
            )}
            {item.spiceLevel > 0 && (
              <View className="flex-row items-center">
                {Array.from({ length: item.spiceLevel }).map((_, i) => (
                  <Flame
                    key={i}
                    size={10}
                    color="#EF4444"
                    fill="#EF4444"
                    style={{ marginRight: 1 }}
                  />
                ))}
              </View>
            )}
          </View>
          <Text
            style={{
              fontFamily: "BricolageGrotesque_700Bold",
              color: "#f5f5f5",
              fontSize: 14,
              marginBottom: 2,
            }}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text
            style={{
              fontFamily: "Manrope_500Medium",
              color: "#999999",
              fontSize: 11,
              lineHeight: 15,
              marginBottom: 4,
            }}
            numberOfLines={2}
          >
            {item.description}
          </Text>
          <Text
            style={{
              fontFamily: "JetBrainsMono_600SemiBold",
              color: "#FF9933",
              fontSize: 14,
            }}
          >
            ${item.price.toFixed(2)}
          </Text>
        </View>
      </Pressable>
      </Animated.View>
    </Animated.View>
  );
}
