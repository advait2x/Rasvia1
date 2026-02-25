import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Clock,
  ShoppingBag,
  Truck,
  UtensilsCrossed,
  Leaf,
} from "lucide-react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { type SupabaseOrder, type OrderStatus, type OrderType, mapOrderToUI, type UIOrder } from "@/lib/restaurant-types";

const STATUS_COLORS: Record<OrderStatus, string> = {
  active: "#FF9933",
  preparing: "#F59E0B",
  ready: "#22C55E",
  served: "#818CF8",
  completed: "#10B981",
  cancelled: "#EF4444",
};

const ORDER_TYPE_ICONS: Record<OrderType, any> = {
  dine_in: UtensilsCrossed,
  pre_order: Clock,
  takeout: Truck,
};

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  dine_in: "Dine In",
  pre_order: "Pre-Order",
  takeout: "Takeout",
};

export default function MyOrdersScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<UIOrder[]>([]);

  const fetchOrders = useCallback(async () => {
    if (!session?.user?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          restaurants ( name, image_url ),
          order_items ( * )
        `)
        .eq("created_by", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped = (data as SupabaseOrder[]).map(mapOrderToUI);
      setOrders(mapped);
    } catch (e) {
      console.error("Error fetching orders:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    fetchOrders();
  }, [fetchOrders]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0f0f0f" }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Header */}
        <Animated.View
          entering={FadeIn.duration(400)}
          style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}
        >
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={{
              backgroundColor: "#1a1a1a",
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "#2a2a2a",
              marginRight: 16,
            }}
          >
            <ArrowLeft size={22} color="#f5f5f5" />
          </Pressable>
          <Text
            style={{
              fontFamily: "BricolageGrotesque_800ExtraBold",
              color: "#f5f5f5",
              fontSize: 28,
              letterSpacing: -0.5,
            }}
          >
            My Orders
          </Text>
        </Animated.View>

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color="#FF9933" size="large" />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FF9933"
              />
            }
          >
            {orders.length === 0 ? (
              <Animated.View
                entering={FadeInDown.delay(100).duration(500)}
                style={{ alignItems: "center", justifyContent: "center", marginTop: 60 }}
              >
                <View style={{
                  width: 80, height: 80, borderRadius: 40, backgroundColor: "#1a1a1a",
                  alignItems: "center", justifyContent: "center", marginBottom: 16,
                  borderWidth: 1, borderColor: "#2a2a2a",
                }}>
                  <ShoppingBag size={32} color="#666" />
                </View>
                <Text style={{ fontFamily: "BricolageGrotesque_700Bold", color: "#f5f5f5", fontSize: 20, marginBottom: 8 }}>
                  No orders yet
                </Text>
                <Text style={{ fontFamily: "Manrope_500Medium", color: "#999", fontSize: 15, textAlign: "center" }}>
                  Your dine-in, takeout, and pre-orders will appear here.
                </Text>
              </Animated.View>
            ) : (
              orders.map((order, index) => {
                const statusColor = STATUS_COLORS[order.status];
                const TypeIcon = ORDER_TYPE_ICONS[order.orderType];
                return (
                  <Animated.View
                    key={order.id}
                    entering={FadeInDown.delay(80 + index * 50).duration(500)}
                  >
                    <Pressable
                      onPress={() => {
                        if (Platform.OS !== "web") Haptics.selectionAsync();
                      }}
                      style={{
                        backgroundColor: "#1a1a1a",
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: "#2a2a2a",
                        padding: 16,
                        marginBottom: 14,
                      }}
                    >
                      {/* Header row */}
                      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{ fontFamily: "BricolageGrotesque_700Bold", color: "#f5f5f5", fontSize: 18, marginBottom: 3 }}
                            numberOfLines={1}
                          >
                            {order.restaurantName}
                          </Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Clock size={11} color="#777" />
                            <Text style={{ fontFamily: "Manrope_500Medium", color: "#777", fontSize: 12 }}>
                              {formatDate(order.createdAt)} · {formatTime(order.createdAt)}
                              {order.customerName ? ` · ${order.customerName}` : ""}
                            </Text>
                          </View>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={{ fontFamily: "BricolageGrotesque_700Bold", color: "#f5f5f5", fontSize: 18 }}>
                            ${order.subtotal.toFixed(2)}
                          </Text>
                          {order.tipAmount > 0 && (
                            <Text style={{ fontFamily: "Manrope_500Medium", color: "#666", fontSize: 11 }}>
                              +${order.tipAmount.toFixed(2)} tip
                            </Text>
                          )}
                        </View>
                      </View>

                      {/* Items summary */}
                      <Text
                        style={{ fontFamily: "Manrope_500Medium", color: "#666", fontSize: 13, marginBottom: 10 }}
                        numberOfLines={2}
                      >
                        {order.items.map(i => `${i.quantity}× ${i.name}`).join(", ")}
                      </Text>

                      {/* Footer: type + status */}
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#0f0f0f", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: "#2a2a2a" }}>
                          <TypeIcon size={12} color="#888" />
                          <Text style={{ fontFamily: "Manrope_600SemiBold", color: "#888", fontSize: 12 }}>
                            {ORDER_TYPE_LABELS[order.orderType]}
                          </Text>
                          {order.tableNumber !== "—" && (
                            <Text style={{ fontFamily: "Manrope_500Medium", color: "#666", fontSize: 11 }}>
                              · Table {order.tableNumber}
                            </Text>
                          )}
                        </View>
                        <View style={{
                          backgroundColor: `${statusColor}20`,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: `${statusColor}50`,
                        }}>
                          <Text style={{ fontFamily: "Manrope_700Bold", color: statusColor, fontSize: 11, textTransform: "uppercase" }}>
                            {order.status}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
