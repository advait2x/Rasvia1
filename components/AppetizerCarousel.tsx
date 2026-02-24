import React from "react";
import { View, Text, Pressable, Image, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Plus } from "lucide-react-native";
import type { MenuItem } from "@/data/mockData";
import Animated, {
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

interface AppetizerCarouselProps {
  items: MenuItem[];
  onAddItem: (item: MenuItem) => void;
}

export function AppetizerCarousel({ items, onAddItem }: AppetizerCarouselProps) {
  return (
    <View>
      <Text
        style={{
          fontFamily: "BricolageGrotesque_800ExtraBold",
          color: "#f5f5f5",
          fontSize: 22,
          marginBottom: 4,
          paddingHorizontal: 20,
        }}
      >
        While you wait...
      </Text>
      <Text
        style={{
          fontFamily: "Manrope_500Medium",
          color: "#999999",
          fontSize: 14,
          marginBottom: 16,
          paddingHorizontal: 20,
        }}
      >
        Pre-order appetizers to arrive with your table
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20 }}
      >
        {items.map((item, index) => (
          <AppetizerCard
            key={item.id}
            item={item}
            index={index}
            onAdd={() => onAddItem(item)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function AppetizerCard({
  item,
  index,
  onAdd,
}: {
  item: MenuItem;
  index: number;
  onAdd: () => void;
}) {
  const pressScale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 80).duration(400)}
      style={{ width: 150, marginRight: 12 }}
    >
      <Animated.View style={animatedStyle}>
        <Pressable
          onPressIn={() => {
            pressScale.value = withSpring(0.95);
          }}
          onPressOut={() => {
            pressScale.value = withSpring(1);
          }}
          className="rounded-xl overflow-hidden bg-rasvia-card"
        >
          <View style={{ height: 110, position: "relative" }}>
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
          </View>
          <View className="p-2.5">
            <Text
              style={{
                fontFamily: "Manrope_700Bold",
                color: "#f5f5f5",
                fontSize: 13,
                marginBottom: 2,
              }}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            {/* Category + meal time chips */}
            <View className="flex-row flex-wrap mb-1" style={{ gap: 3 }}>
              {item.category && item.category !== "Menu Item" && (
                <View style={{ backgroundColor: "rgba(255,153,51,0.12)", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2, borderWidth: 0.5, borderColor: "rgba(255,153,51,0.3)" }}>
                  <Text style={{ fontFamily: "Manrope_600SemiBold", color: "#FF9933", fontSize: 8, textTransform: "capitalize" }}>
                    {item.category}
                  </Text>
                </View>
              )}
              {item.mealTimes && item.mealTimes.slice(0, 2).map((mt, i) => (
                <View key={i} style={{ backgroundColor: "#2a2a2a", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 }}>
                  <Text style={{ fontFamily: "Manrope_600SemiBold", color: "#888", fontSize: 8, textTransform: "capitalize" }}>
                    {mt}
                  </Text>
                </View>
              ))}
            </View>
            <View className="flex-row items-center justify-between mt-1">
              <Text
                style={{
                  fontFamily: "JetBrainsMono_600SemiBold",
                  color: "#FF9933",
                  fontSize: 13,
                }}
              >
                ${item.price.toFixed(2)}
              </Text>
              <Pressable
                onPress={onAdd}
                style={{
                  backgroundColor: "#FF9933",
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Plus size={14} color="#0f0f0f" strokeWidth={3} />
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}
