import React from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  Dimensions,
} from "react-native";
import { X, Minus, Plus, Users, Share2 } from "lucide-react-native";
import type { CartItem, GroupMember } from "@/data/mockData";
import Animated, {
  FadeIn,
  FadeInLeft,
  SlideInDown,
} from "react-native-reanimated";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface GroupCartDrawerProps {
  items: CartItem[];
  members: GroupMember[];
  onClose: () => void;
  onUpdateQuantity: (itemId: string, delta: number) => void;
  onShare: () => void;
}

export function GroupCartDrawer({
  items,
  members,
  onClose,
  onUpdateQuantity,
  onShare,
}: GroupCartDrawerProps) {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <Animated.View
      entering={SlideInDown.duration(500).springify()}
      className="absolute bottom-0 left-0 right-0 bg-rasvia-dark rounded-t-3xl"
      style={{
        maxHeight: SCREEN_HEIGHT * 0.7,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.3,
        shadowRadius: 24,
        elevation: 20,
        borderTopWidth: 1,
        borderTopColor: "#2a2a2a",
      }}
    >
      {/* Handle */}
      <View className="items-center pt-3 pb-2">
        <View className="w-10 h-1 rounded-full bg-rasvia-border" />
      </View>

      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pb-4">
        <View>
          <Text
            style={{
              fontFamily: "BricolageGrotesque_800ExtraBold",
              color: "#f5f5f5",
              fontSize: 22,
            }}
          >
            Group Cart
          </Text>
          <Text
            style={{
              fontFamily: "Manrope_500Medium",
              color: "#999999",
              fontSize: 13,
              marginTop: 2,
            }}
          >
            {items.length} items · {members.length} members
          </Text>
        </View>
        <View className="flex-row items-center">
          <Pressable
            onPress={onShare}
            className="mr-3"
            style={{
              backgroundColor: "#2a2a2a",
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Share2 size={18} color="#FF9933" />
          </Pressable>
          <Pressable
            onPress={onClose}
            style={{
              backgroundColor: "#2a2a2a",
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} color="#f5f5f5" />
          </Pressable>
        </View>
      </View>

      {/* Member Avatars */}
      <View className="px-5 pb-4">
        <View className="flex-row items-center">
          {members.map((member, index) => (
            <Animated.View
              key={member.id}
              entering={FadeInLeft.delay(index * 80).duration(400)}
              style={{ marginRight: -8, zIndex: members.length - index }}
            >
              <Image
                source={{ uri: member.avatar }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  borderWidth: 2,
                  borderColor: member.color,
                }}
              />
            </Animated.View>
          ))}
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "#2a2a2a",
              borderWidth: 2,
              borderColor: "#333333",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: 0,
            }}
          >
            <Users size={14} color="#999999" />
          </View>
        </View>
      </View>

      {/* Items */}
      <ScrollView
        className="px-5"
        style={{ maxHeight: SCREEN_HEIGHT * 0.35 }}
        showsVerticalScrollIndicator={false}
      >
        {items.map((item, index) => (
          <Animated.View
            key={item.id}
            entering={FadeIn.delay(index * 60).duration(400)}
            className="flex-row items-center py-3"
            style={{
              borderBottomWidth: index < items.length - 1 ? 1 : 0,
              borderBottomColor: "#2a2a2a",
            }}
          >
            <Image
              source={{ uri: item.image }}
              style={{ width: 50, height: 50, borderRadius: 10 }}
            />
            <View className="flex-1 ml-3">
              <View className="flex-row items-center">
                <Text
                  style={{
                    fontFamily: "Manrope_700Bold",
                    color: "#f5f5f5",
                    fontSize: 14,
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Image
                  source={{ uri: item.addedBy.avatar }}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: item.addedBy.color,
                    marginLeft: 6,
                  }}
                />
              </View>
              <View className="flex-row items-center justify-between mt-1">
                <Text
                  style={{
                    fontFamily: "JetBrainsMono_600SemiBold",
                    color: "#FF9933",
                    fontSize: 13,
                  }}
                >
                  ${(item.price * item.quantity).toFixed(2)}
                </Text>
                <View className="flex-row items-center bg-rasvia-muted rounded-full">
                  <Pressable
                    onPress={() => onUpdateQuantity(item.id, -1)}
                    className="px-2.5 py-1"
                  >
                    <Minus size={14} color="#f5f5f5" />
                  </Pressable>
                  <Text
                    style={{
                      fontFamily: "JetBrainsMono_600SemiBold",
                      color: "#f5f5f5",
                      fontSize: 13,
                      minWidth: 20,
                      textAlign: "center",
                    }}
                  >
                    {item.quantity}
                  </Text>
                  <Pressable
                    onPress={() => onUpdateQuantity(item.id, 1)}
                    className="px-2.5 py-1"
                  >
                    <Plus size={14} color="#f5f5f5" />
                  </Pressable>
                </View>
              </View>
            </View>
          </Animated.View>
        ))}
      </ScrollView>

      {/* Footer */}
      <View
        className="px-5 pt-4 pb-8"
        style={{ borderTopWidth: 1, borderTopColor: "#2a2a2a" }}
      >
        <View className="flex-row items-center justify-between mb-4">
          <Text
            style={{
              fontFamily: "Manrope_600SemiBold",
              color: "#999999",
              fontSize: 15,
            }}
          >
            Total
          </Text>
          <Text
            style={{
              fontFamily: "JetBrainsMono_600SemiBold",
              color: "#f5f5f5",
              fontSize: 22,
            }}
          >
            ${total.toFixed(2)}
          </Text>
        </View>
        <Pressable
          className="rounded-2xl py-4 items-center"
          style={{ backgroundColor: "#FF9933" }}
        >
          <Text
            style={{
              fontFamily: "BricolageGrotesque_700Bold",
              color: "#0f0f0f",
              fontSize: 17,
            }}
          >
            Place Group Order
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
