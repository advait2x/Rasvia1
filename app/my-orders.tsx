import React, { useState, useEffect } from "react";
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
import { ArrowLeft, Clock, ShoppingBag } from "lucide-react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

// Interfaces for our joined query
interface GroupOrderData {
  id: number;
  restaurant_id: number;
  status: string;
  total_amount: number;
  created_at: string;
  restaurants: {
    name: string;
    image_url: string;
  } | null;
}

interface PartySessionData {
  id: string;
  host_user_id: string;
  created_at: string;
  group_orders: GroupOrderData[];
}

export default function MyOrdersScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<GroupOrderData[]>([]);

  const fetchOrders = async () => {
    if (!session?.user?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      // Query party_sessions where the user is the host,
      // and join the associated group_orders and restaurant info.
      const { data, error } = await supabase
        .from('party_sessions')
        .select(`
          id,
          host_user_id,
          created_at,
          group_orders (
            id,
            restaurant_id,
            status,
            total_amount,
            created_at,
            restaurants (
              name,
              image_url
            )
          )
        `)
        .eq('host_user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Flatten the nested structure into a list of orders
      const allOrders: GroupOrderData[] = [];
      if (data) {
        data.forEach((session: any) => {
          if (session.group_orders && Array.isArray(session.group_orders)) {
            session.group_orders.forEach((order: any) => {
                // Ensure it's not a draft
                if (order.status !== 'draft') {
                    allOrders.push(order);
                }
            });
          }
        });
      }

      // Sort by creation date descending
      allOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setOrders(allOrders);
    } catch (e) {
      console.error("Error fetching orders:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [session]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, [session]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const getStatusColor = (status: string) => {
    switch(status) {
        case 'completed': return '#10B981'; // Green
        case 'active': return '#FF9933'; // Orange
        case 'cancelled': return '#EF4444'; // Red
        default: return '#999999'; // Grey
    }
  }

  return (
    <View className="flex-1 bg-rasvia-black">
      <SafeAreaView className="flex-1" edges={["top"]}>
        {/* Header */}
        <Animated.View
          entering={FadeIn.duration(400)}
          className="flex-row items-center px-5 pt-2 pb-4"
        >
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
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
          <View className="flex-1 items-center justify-center">
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
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 60,
                }}
              >
                <View style={{
                    width: 80, height: 80, borderRadius: 40, backgroundColor: "#1a1a1a", 
                    alignItems: "center", justifyContent: "center", marginBottom: 16,
                    borderWidth: 1, borderColor: "#2a2a2a"
                }}>
                    <ShoppingBag size={32} color="#666" />
                </View>
                <Text
                  style={{
                    fontFamily: "BricolageGrotesque_700Bold",
                    color: "#f5f5f5",
                    fontSize: 20,
                    marginBottom: 8,
                  }}
                >
                  No past orders
                </Text>
                <Text
                  style={{
                    fontFamily: "Manrope_500Medium",
                    color: "#999",
                    fontSize: 15,
                    textAlign: "center",
                  }}
                >
                  When you host a group order, your history will appear here.
                </Text>
              </Animated.View>
            ) : (
              orders.map((order, index) => (
                <Animated.View
                  key={order.id}
                  entering={FadeInDown.delay(100 + index * 50).duration(500)}
                >
                  <Pressable
                    onPress={() => {
                        if (Platform.OS !== "web") Haptics.selectionAsync();
                        // Potentially navigate to a detailed receipt view in the future
                    }}
                    style={{
                      flexDirection: "row",
                      backgroundColor: "#1a1a1a",
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: "#2a2a2a",
                      padding: 16,
                      marginBottom: 16,
                      alignItems: "center",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: "BricolageGrotesque_700Bold",
                          color: "#f5f5f5",
                          fontSize: 18,
                          marginBottom: 4,
                        }}
                        numberOfLines={1}
                      >
                        {order.restaurants?.name || "Unknown Restaurant"}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                        <Clock size={12} color="#999" />
                        <Text
                          style={{
                            fontFamily: "Manrope_500Medium",
                            color: "#999",
                            fontSize: 13,
                            marginLeft: 4,
                          }}
                        >
                          {formatDate(order.created_at)}
                        </Text>
                      </View>
                      
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <View style={{ 
                              backgroundColor: `${getStatusColor(order.status)}20`, 
                              paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                              borderWidth: 1, borderColor: `${getStatusColor(order.status)}50` 
                           }}>
                            <Text style={{ 
                                fontFamily: "Manrope_600SemiBold", 
                                color: getStatusColor(order.status), 
                                fontSize: 11, textTransform: "uppercase" 
                            }}>
                                {order.status}
                            </Text>
                          </View>
                      </View>
                      
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontFamily: "BricolageGrotesque_700Bold", color: "#f5f5f5", fontSize: 18 }}>
                            ${order.total_amount ? order.total_amount.toFixed(2) : "0.00"}
                        </Text>
                        <Text style={{ fontFamily: "Manrope_500Medium", color: "#666", fontSize: 12, marginTop: 4 }}>
                            Order #{order.id}
                        </Text>
                    </View>
                  </Pressable>
                </Animated.View>
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
