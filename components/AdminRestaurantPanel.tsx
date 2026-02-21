import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import { X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";

interface AdminRestaurantPanelProps {
  restaurant: { id: string; name: string; waitTime: number; waitStatus: string };
  isWaitlistOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export function AdminRestaurantPanel({
  restaurant,
  isWaitlistOpen,
  onClose,
  onUpdated,
}: AdminRestaurantPanelProps) {
  const [publishLoading, setPublishLoading] = useState(false);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [waitTimeLoading, setWaitTimeLoading] = useState<string | null>(null);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [featuredAvailable, setFeaturedAvailable] = useState(true);

  const restaurantId = Number(restaurant.id);

  // Fetch is_featured on mount (column may not exist)
  useEffect(() => {
    async function fetchFeatured() {
      try {
        const { data, error } = await supabase
          .from("restaurants")
          .select("is_featured")
          .eq("id", restaurantId)
          .single();

        if (error) {
          if (error.message?.includes("is_featured") || error.code === "PGRST116") {
            setFeaturedAvailable(false);
          }
          return;
        }
        setIsFeatured(data?.is_featured ?? false);
      } catch {
        setFeaturedAvailable(false);
      }
    }
    fetchFeatured();
  }, [restaurantId]);

  const haptic = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePublishToggle = async () => {
    haptic();
    setPublishLoading(true);
    try {
      const { error } = await supabase
        .from("restaurants")
        .update({ is_waitlist_open: !isWaitlistOpen })
        .eq("id", restaurantId);

      if (error) throw error;
      onUpdated();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update publish status.");
    } finally {
      setPublishLoading(false);
    }
  };

  const handleFeaturedToggle = async () => {
    if (!featuredAvailable) return;
    haptic();
    setFeaturedLoading(true);
    try {
      const { error } = await supabase
        .from("restaurants")
        .update({ is_featured: !isFeatured })
        .eq("id", restaurantId);

      if (error) throw error;
      setIsFeatured(!isFeatured);
      onUpdated();
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("is_featured") || msg.includes("column")) {
        setFeaturedAvailable(false);
        Alert.alert(
          "Featured Unavailable",
          "The is_featured column may not exist yet. Add it to the restaurants table to enable this feature."
        );
      } else {
        Alert.alert("Error", msg || "Failed to update featured status.");
      }
    } finally {
      setFeaturedLoading(false);
    }
  };

  const handleWaitTimeOverride = async (minutes: number) => {
    haptic();
    const key = minutes === 999 ? "closed" : `${minutes}`;
    setWaitTimeLoading(key);
    try {
      const { error } = await supabase
        .from("restaurants")
        .update({ current_wait_time: minutes })
        .eq("id", restaurantId);

      if (error) throw error;
      onUpdated();
    } catch (err: any) {
      Alert.alert("Error", (err as Error).message || "Failed to update wait time.");
    } finally {
      setWaitTimeLoading(null);
    }
  };

  const handleNotAccepting = async () => {
    haptic();
    setEmergencyLoading(true);
    try {
      const { error } = await supabase
        .from("restaurants")
        .update({ is_waitlist_open: false, current_wait_time: 999 })
        .eq("id", restaurantId);

      if (error) throw error;
      onUpdated();
    } catch (err: any) {
      Alert.alert("Error", (err as Error).message || "Failed to update status.");
    } finally {
      setEmergencyLoading(false);
    }
  };

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: "#1a1a1a",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: Platform.OS === "ios" ? 40 : 24,
            borderWidth: 1,
            borderColor: "#2a2a2a",
            maxHeight: "85%",
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            <Text
              style={{
                fontFamily: "BricolageGrotesque_700Bold",
                color: "#f5f5f5",
                fontSize: 20,
                flex: 1,
              }}
              numberOfLines={1}
            >
              {restaurant.name}
            </Text>
            <Pressable
              onPress={() => {
                haptic();
                onClose();
              }}
              style={{
                padding: 8,
                marginLeft: 8,
                backgroundColor: "#2a2a2a",
                borderRadius: 12,
              }}
            >
              <X color="#999999" size={22} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Status: Published / Unpublished */}
            <View style={{ marginBottom: 20 }}>
              <Text
                style={{
                  fontFamily: "Manrope_600SemiBold",
                  color: "#999999",
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 10,
                }}
              >
                Status
              </Text>
              <Pressable
                onPress={handlePublishToggle}
                disabled={publishLoading}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: "#0f0f0f",
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: "#2a2a2a",
                  opacity: publishLoading ? 0.7 : 1,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Manrope_500Medium",
                    color: "#f5f5f5",
                    fontSize: 15,
                  }}
                >
                  {isWaitlistOpen ? "Published" : "Unpublished"}
                </Text>
                {publishLoading ? (
                  <ActivityIndicator size="small" color="#FF9933" />
                ) : (
                  <View
                    style={{
                      width: 48,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: isWaitlistOpen ? "#22C55E" : "#333333",
                      padding: 2,
                      justifyContent: "center",
                    }}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: "#f5f5f5",
                        alignSelf: isWaitlistOpen ? "flex-end" : "flex-start",
                      }}
                    />
                  </View>
                )}
              </Pressable>
            </View>

            {/* Featured */}
            {featuredAvailable && (
              <View style={{ marginBottom: 20 }}>
                <Text
                  style={{
                    fontFamily: "Manrope_600SemiBold",
                    color: "#999999",
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 10,
                  }}
                >
                  Featured
                </Text>
                <Pressable
                  onPress={handleFeaturedToggle}
                  disabled={featuredLoading}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "#0f0f0f",
                    borderRadius: 12,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: "#2a2a2a",
                    opacity: featuredLoading ? 0.7 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Manrope_500Medium",
                      color: "#f5f5f5",
                      fontSize: 15,
                    }}
                  >
                    {isFeatured ? "Featured" : "Not Featured"}
                  </Text>
                  {featuredLoading ? (
                    <ActivityIndicator size="small" color="#FF9933" />
                  ) : (
                    <View
                      style={{
                        width: 48,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: isFeatured ? "#FF9933" : "#333333",
                        padding: 2,
                        justifyContent: "center",
                      }}
                    >
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: "#f5f5f5",
                          alignSelf: isFeatured ? "flex-end" : "flex-start",
                        }}
                      />
                    </View>
                  )}
                </Pressable>
              </View>
            )}

            {/* Wait Time Override */}
            <View style={{ marginBottom: 20 }}>
              <Text
                style={{
                  fontFamily: "Manrope_600SemiBold",
                  color: "#999999",
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 10,
                }}
              >
                Wait Time Override
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                {[5, 10, 15, 30, 45, 60].map((mins) => {
                  const loading = waitTimeLoading === `${mins}`;
                  return (
                    <Pressable
                      key={mins}
                      onPress={() => handleWaitTimeOverride(mins)}
                      disabled={!!waitTimeLoading}
                      style={{
                        backgroundColor: "#0f0f0f",
                        borderRadius: 20,
                        paddingHorizontal: 18,
                        paddingVertical: 12,
                        borderWidth: 1,
                        borderColor: "#2a2a2a",
                        minWidth: 56,
                        alignItems: "center",
                        opacity: loading ? 0.7 : 1,
                      }}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color="#FF9933" />
                      ) : (
                        <Text
                          style={{
                            fontFamily: "JetBrainsMono_600SemiBold",
                            color: "#FF9933",
                            fontSize: 14,
                          }}
                        >
                          {mins}m
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => handleWaitTimeOverride(999)}
                  disabled={!!waitTimeLoading}
                  style={{
                    backgroundColor: "#0f0f0f",
                    borderRadius: 20,
                    paddingHorizontal: 18,
                    paddingVertical: 12,
                    borderWidth: 1,
                    borderColor: "#2a2a2a",
                    minWidth: 70,
                    alignItems: "center",
                    opacity: waitTimeLoading === "closed" ? 0.7 : 1,
                  }}
                >
                  {waitTimeLoading === "closed" ? (
                    <ActivityIndicator size="small" color="#999999" />
                  ) : (
                    <Text
                      style={{
                        fontFamily: "Manrope_600SemiBold",
                        color: "#999999",
                        fontSize: 13,
                      }}
                    >
                      Closed
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>

            {/* Emergency: Not Accepting */}
            <View>
              <Text
                style={{
                  fontFamily: "Manrope_600SemiBold",
                  color: "#999999",
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 10,
                }}
              >
                Emergency
              </Text>
              <Pressable
                onPress={handleNotAccepting}
                disabled={emergencyLoading}
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: "#EF4444",
                  alignItems: "center",
                  opacity: emergencyLoading ? 0.7 : 1,
                }}
              >
                {emergencyLoading ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <Text
                    style={{
                      fontFamily: "BricolageGrotesque_700Bold",
                      color: "#EF4444",
                      fontSize: 15,
                    }}
                  >
                    Not Accepting Joiners
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
