import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
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
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { WaitBadge } from "@/components/WaitBadge";
import { MenuGridItem } from "@/components/MenuGridItem";
import { FoodDetailModal } from "@/components/FoodDetailModal";
import { GroupCartDrawer } from "@/components/GroupCartDrawer";
import {
  restaurants,
  menuItems,
  groupMembers,
  type MenuItem,
  type CartItem,
} from "@/data/mockData";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function RestaurantDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const restaurant = restaurants.find((r) => r.id === id) || restaurants[0];

  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);

  const handleAddToCart = useCallback(
    (item: MenuItem) => {
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
    router.push(`/waitlist/${restaurant.id}` as any);
  }, [router, restaurant.id]);

  const handleToggleFavorite = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setIsFavorited((prev) => !prev);
  }, []);

  // Split menu into two columns for masonry layout
  const leftColumn = menuItems.filter((_, i) => i % 2 === 0);
  const rightColumn = menuItems.filter((_, i) => i % 2 !== 0);

  const joinBtnScale = useSharedValue(1);
  const joinBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: joinBtnScale.value }],
  }));

  return (
    <View className="flex-1 bg-rasvia-black">
      {/* Hero Image */}
      <View style={{ height: SCREEN_HEIGHT * 0.42, position: "relative" }}>
        <Image
          source={{ uri: restaurant.image }}
          style={{ width: "100%", height: "100%" }}
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

        {/* Top Nav */}
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
        <View className="absolute bottom-0 left-0 right-0 px-5 pb-2">
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
          <Animated.Text
            entering={FadeInDown.duration(500)}
            style={{
              fontFamily: "BricolageGrotesque_800ExtraBold",
              color: "#f5f5f5",
              fontSize: 40,
              lineHeight: 44,
              letterSpacing: -0.5,
            }}
          >
            {restaurant.name}
          </Animated.Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Info Section */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(500)}
          className="px-5 pt-3 pb-4"
        >
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

            <View
              style={{ width: 1, height: 30, backgroundColor: "#333333" }}
            />

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

            <View
              style={{ width: 1, height: 30, backgroundColor: "#333333" }}
            />

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
          <View className="flex-row items-center mt-4">
            <MapPin size={13} color="#999999" />
            <Text
              style={{
                fontFamily: "Manrope_500Medium",
                color: "#999999",
                fontSize: 13,
                marginLeft: 4,
              }}
            >
              {restaurant.address} · {restaurant.distance}
            </Text>
          </View>

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
        </Animated.View>

        {/* Menu Section */}
        <Animated.View entering={FadeInUp.delay(400).duration(500)}>
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

          {/* Masonry Grid */}
          <View className="px-4 flex-row">
            <View className="flex-1 mr-1.5">
              {leftColumn.map((item, index) => (
                <MenuGridItem
                  key={item.id}
                  item={item}
                  index={index * 2}
                  onPress={() => setSelectedItem(item)}
                  onQuickAdd={() => handleAddToCart(item)}
                />
              ))}
            </View>
            <View className="flex-1 ml-1.5" style={{ marginTop: 24 }}>
              {rightColumn.map((item, index) => (
                <MenuGridItem
                  key={item.id}
                  item={item}
                  index={index * 2 + 1}
                  onPress={() => setSelectedItem(item)}
                  onQuickAdd={() => handleAddToCart(item)}
                />
              ))}
            </View>
          </View>
        </Animated.View>
      </ScrollView>

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
            {/* Cart Button */}
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

            {/* Join Waitlist Button */}
            <Animated.View style={[joinBtnStyle, { flex: 1 }]}>
              <Pressable
                onPress={handleJoinWaitlist}
                onPressIn={() => {
                  joinBtnScale.value = withSpring(0.95);
                }}
                onPressOut={() => {
                  joinBtnScale.value = withSpring(1);
                }}
                className="rounded-2xl py-4 items-center flex-row justify-center"
                style={{
                  backgroundColor: "#FF9933",
                  shadowColor: "#FF9933",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.4,
                  shadowRadius: 16,
                  elevation: 10,
                }}
              >
                <Clock size={18} color="#0f0f0f" strokeWidth={2.5} />
                <Text
                  style={{
                    fontFamily: "BricolageGrotesque_700Bold",
                    color: "#0f0f0f",
                    fontSize: 17,
                    marginLeft: 8,
                  }}
                >
                  Join Waitlist · {restaurant.waitTime} min
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        </SafeAreaView>
      </View>

      {/* Food Detail Modal */}
      {selectedItem && (
        <FoodDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onAddToCart={() => handleAddToCart(selectedItem)}
        />
      )}

      {/* Group Cart Drawer */}
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
