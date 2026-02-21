import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  Ban,
  Bell,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { useAdminMode } from "@/hooks/useAdminMode";

type RestaurantRow = {
  id: number;
  name: string;
  current_wait_time: number;
  is_waitlist_open: boolean;
};

const CARD_STYLE = {
  backgroundColor: "#1a1a1a",
  borderWidth: 1,
  borderColor: "#2a2a2a",
  borderRadius: 16,
};

function getWaitColor(minutes: number): string {
  if (minutes < 15) return "#22C55E";
  if (minutes < 45) return "#F59E0B";
  return "#EF4444";
}

export default function AdminPulseScreen() {
  const router = useRouter();
  const { isAdmin, loading: adminLoading } = useAdminMode();
  const [restaurants, setRestaurants] = useState<RestaurantRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [shadowBanId, setShadowBanId] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [shadowBanLoading, setShadowBanLoading] = useState(false);
  const [bannerLoading, setBannerLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, current_wait_time, is_waitlist_open");

      if (error) {
        console.error("Admin Pulse: error fetching restaurants:", error);
        Alert.alert("Error", `Failed to fetch restaurants: ${error.message}`);
        return;
      }

      const sorted = (data || []).sort(
        (a, b) => (b.current_wait_time ?? 0) - (a.current_wait_time ?? 0)
      );
      setRestaurants(sorted);
    } catch (err) {
      console.error("Admin Pulse: fetch error:", err);
      Alert.alert("Error", "Failed to load queue health data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin, fetchData]);

  const onRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleShadowBan = async () => {
    const inputId = shadowBanId.trim();
    if (!inputId) {
      Alert.alert("Error", "Please enter a profile ID (UUID).");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShadowBanLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_shadow_banned: true })
        .eq("id", inputId);

      if (error) {
        Alert.alert("Error", `Shadow ban failed: ${error.message}`);
        return;
      }
      Alert.alert("Success", "User has been shadow banned.");
      setShadowBanId("");
    } catch (err) {
      console.error("Shadow ban error:", err);
      Alert.alert("Error", "Failed to shadow ban user.");
    } finally {
      setShadowBanLoading(false);
    }
  };

  const handlePushBanner = async () => {
    const msg = announcementMessage.trim();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBannerLoading(true);
    try {
      const { error } = await supabase
        .from("system_config")
        .upsert(
          { key: "announcement_banner", value: msg },
          { onConflict: "key" }
        );

      if (error) {
        Alert.alert("Error", `Push banner failed: ${error.message}`);
        return;
      }
      Alert.alert("Success", "Announcement banner has been updated.");
    } catch (err) {
      console.error("Push banner error:", err);
      Alert.alert("Error", "Failed to update announcement banner.");
    } finally {
      setBannerLoading(false);
    }
  };

  const handleClearBanner = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBannerLoading(true);
    try {
      const { error } = await supabase
        .from("system_config")
        .upsert(
          { key: "announcement_banner", value: "" },
          { onConflict: "key" }
        );

      if (error) {
        Alert.alert("Error", `Clear banner failed: ${error.message}`);
        return;
      }
      Alert.alert("Success", "Announcement banner has been cleared.");
      setAnnouncementMessage("");
    } catch (err) {
      console.error("Clear banner error:", err);
      Alert.alert("Error", "Failed to clear announcement banner.");
    } finally {
      setBannerLoading(false);
    }
  };

  const goBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  // Access guard
  if (!adminLoading && !isAdmin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f0f0f" }} edges={["top"]}>
        <View style={{ flex: 1, padding: 24, justifyContent: "center", alignItems: "center" }}>
          <Ban size={48} color="#EF4444" style={{ marginBottom: 16 }} />
          <Text
            style={{
              fontFamily: "BricolageGrotesque_700Bold",
              fontSize: 22,
              color: "#f5f5f5",
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            Access Denied
          </Text>
          <Pressable
            onPress={goBack}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingVertical: 12,
              paddingHorizontal: 20,
              backgroundColor: pressed ? "#2a2a2a" : "#1a1a1a",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#2a2a2a",
            })}
          >
            <ArrowLeft size={20} color="#f5f5f5" />
            <Text style={{ fontFamily: "Manrope_600SemiBold", fontSize: 16, color: "#f5f5f5" }}>
              Back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f0f0f" }} edges={["top"]}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: "#2a2a2a",
        }}
      >
        <Pressable
          onPress={goBack}
          hitSlop={12}
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
            padding: 8,
          })}
        >
          <ArrowLeft size={24} color="#f5f5f5" />
        </Pressable>
        <Text
          style={{
            fontFamily: "BricolageGrotesque_800ExtraBold",
            fontSize: 20,
            color: "#f5f5f5",
          }}
        >
          Admin Pulse
        </Text>
        <View style={{ width: 40, alignItems: "flex-end" }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: "#FF9933",
            }}
          />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF9933"
          />
        }
      >
        {/* Queue Health Card */}
        <View style={{ marginBottom: 24 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <Activity size={20} color="#FF9933" />
            <Text
              style={{
                fontFamily: "BricolageGrotesque_700Bold",
                fontSize: 18,
                color: "#f5f5f5",
              }}
            >
              Queue Health
            </Text>
          </View>
          <View style={{ ...CARD_STYLE, padding: 16 }}>
            {loading ? (
              <ActivityIndicator size="small" color="#FF9933" style={{ padding: 24 }} />
            ) : restaurants.length === 0 ? (
              <Text
                style={{
                  fontFamily: "Manrope_500Medium",
                  fontSize: 14,
                  color: "#999999",
                  textAlign: "center",
                  padding: 24,
                }}
              >
                No restaurants found
              </Text>
            ) : (
              restaurants.map((r, index) => {
                const wait = r.current_wait_time ?? 0;
                const isClosed = wait >= 999 || !r.is_waitlist_open;
                const noWait = wait < 0;
                
                const color = isClosed ? "#999999" : getWaitColor(wait);
                const isHighWait = !isClosed && wait >= 45;
                return (
                  <View
                    key={r.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 12,
                      borderBottomWidth: index < restaurants.length - 1 ? 1 : 0,
                      borderBottomColor: "#2a2a2a",
                    }}
                  >
                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {isHighWait && (
                        <AlertTriangle size={18} color="#EF4444" />
                      )}
                      <Text
                        style={{
                          fontFamily: "Manrope_600SemiBold",
                          fontSize: 15,
                          color: "#f5f5f5",
                        }}
                        numberOfLines={1}
                      >
                        {r.name}
                      </Text>
                      {isClosed && (
                        <Text
                          style={{
                            fontFamily: "Manrope_500Medium",
                            fontSize: 12,
                            color: "#999999",
                          }}
                        >
                          (closed)
                        </Text>
                      )}
                    </View>
                    <Text
                      style={{
                        fontFamily: "JetBrainsMono_600SemiBold",
                        fontSize: 15,
                        color,
                      }}
                    >
                      {isClosed || noWait ? '-- min' : `${wait} min`}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* Shadow Ban Section */}
        <View style={{ marginBottom: 24 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <Ban size={20} color="#EF4444" />
            <Text
              style={{
                fontFamily: "BricolageGrotesque_700Bold",
                fontSize: 18,
                color: "#f5f5f5",
              }}
            >
              Shadow Ban
            </Text>
          </View>
          <View style={{ ...CARD_STYLE, padding: 16 }}>
            <TextInput
              value={shadowBanId}
              onChangeText={setShadowBanId}
              placeholder="Profile ID (UUID)"
              placeholderTextColor="#999999"
              style={{
                fontFamily: "Manrope_500Medium",
                fontSize: 15,
                color: "#f5f5f5",
                backgroundColor: "#0f0f0f",
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: "#2a2a2a",
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              onPress={handleShadowBan}
              disabled={shadowBanLoading}
              style={({ pressed }) => ({
                backgroundColor: pressed ? "#b91c1c" : "#EF4444",
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
                opacity: shadowBanLoading ? 0.7 : 1,
              })}
            >
              {shadowBanLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text
                  style={{
                    fontFamily: "Manrope_600SemiBold",
                    fontSize: 16,
                    color: "#fff",
                  }}
                >
                  Shadow Ban
                </Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Announcement Banner Section */}
        <View style={{ marginBottom: 24 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <Bell size={20} color="#FF9933" />
            <Text
              style={{
                fontFamily: "BricolageGrotesque_700Bold",
                fontSize: 18,
                color: "#f5f5f5",
              }}
            >
              Announcement Banner
            </Text>
          </View>
          <View style={{ ...CARD_STYLE, padding: 16 }}>
            <TextInput
              value={announcementMessage}
              onChangeText={setAnnouncementMessage}
              placeholder="Announcement message..."
              placeholderTextColor="#999999"
              multiline
              numberOfLines={3}
              style={{
                fontFamily: "Manrope_500Medium",
                fontSize: 15,
                color: "#f5f5f5",
                backgroundColor: "#0f0f0f",
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: "#2a2a2a",
                minHeight: 80,
                textAlignVertical: "top",
              }}
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={handlePushBanner}
                disabled={bannerLoading}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: pressed ? "#e69500" : "#FF9933",
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                  opacity: bannerLoading ? 0.7 : 1,
                })}
              >
                {bannerLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text
                    style={{
                      fontFamily: "Manrope_600SemiBold",
                      fontSize: 16,
                      color: "#fff",
                    }}
                  >
                    Push Banner
                  </Text>
                )}
              </Pressable>
              <Pressable
                onPress={handleClearBanner}
                disabled={bannerLoading}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: pressed ? "#2a2a2a" : "#1a1a1a",
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "#2a2a2a",
                  opacity: bannerLoading ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    fontFamily: "Manrope_600SemiBold",
                    fontSize: 16,
                    color: "#f5f5f5",
                  }}
                >
                  Clear Banner
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
