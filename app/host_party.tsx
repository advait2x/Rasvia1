import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Share,
  ActivityIndicator,
  Alert,
  Platform,
  Clipboard,
  TextInput,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Stack } from "expo-router";
import {
  ArrowLeft,
  Users,
  ChevronRight,
  Copy,
  Check,
  Share2,
  UtensilsCrossed,
  Search,
  Clock,
  MapPin,
} from "lucide-react-native";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { useNotifications } from "../lib/notifications-context";
import { useLocation } from "../lib/location-context";
import { haversineDistance } from "../lib/restaurant-types";
import * as Linking from "expo-linking";

interface Restaurant {
  id: number;
  name: string;
  cuisine_tags: string[];
  image_url: string | null;
  current_wait_time: number | null;
  lat: number | null;
  long: number | null;
}

type SortOption = "none" | "waitTime" | "distance";

type Step = "select" | "starting" | "created";

export default function HostPartyScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { addEvent } = useNotifications();
  const { userCoords } = useLocation();

  const [step, setStep] = useState<Step>("select");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [selectedRestaurant, setSelectedRestaurant] =
    useState<Restaurant | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("none");

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    setLoadingRestaurants(true);
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select(
          "id, name, cuisine_tags, image_url, current_wait_time, lat, long",
        )
        .or("is_enabled.is.null,is_enabled.eq.true")
        .order("name", { ascending: true });
      if (!error && data) {
        setRestaurants(data as Restaurant[]);
      }
    } catch (e) {
      console.error("fetchRestaurants error:", e);
    } finally {
      setLoadingRestaurants(false);
    }
  };

  const getDist = (r: Restaurant): number => {
    if (!userCoords || r.lat == null || r.long == null) return 9999;
    return haversineDistance(
      userCoords.latitude,
      userCoords.longitude,
      r.lat,
      r.long,
    );
  };

  const filteredRestaurants = restaurants
    .filter((r) => {
      const q = (search || "").toLowerCase().trim();
      if (!q) return true;
      const matchName = r.name ? r.name.toLowerCase().includes(q) : false;
      const matchTag = Array.isArray(r.cuisine_tags)
        ? r.cuisine_tags.some(
            (t) => typeof t === "string" && t.toLowerCase().includes(q),
          )
        : false;
      return matchName || matchTag;
    })
    .sort((a, b) => {
      if (sortBy === "waitTime") {
        const aw = a.current_wait_time ?? 9999;
        const bw = b.current_wait_time ?? 9999;
        return aw - bw;
      }
      if (sortBy === "distance") return getDist(a) - getDist(b);
      const nameA = a.name || "";
      const nameB = b.name || "";
      return nameA.localeCompare(nameB);
    });

  const waitLabel = (wt: number | null): { text: string; color: string } => {
    if (wt === null || wt < 0) return { text: "No wait", color: "#888" };
    if (wt >= 999) return { text: "Closed", color: "#555" };
    if (wt < 15) return { text: `${wt} min`, color: "#22C55E" };
    if (wt < 45) return { text: `${wt} min`, color: "#F59E0B" };
    return { text: `${wt} min`, color: "#EF4444" };
  };

  const handleSelectRestaurant = (r: Restaurant) => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedRestaurant(r);
  };

  const handleStart = async () => {
    if (!selectedRestaurant) return;
    if (!session?.user?.id) {
      Alert.alert("Error", "You must be logged in to host a party.");
      return;
    }
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep("starting");

    try {
      const { data, error } = await supabase
        .from("party_sessions")
        .insert({
          restaurant_id: selectedRestaurant.id,
          host_user_id: session.user.id,
          status: "open",
        })
        .select()
        .single();

      if (error) throw error;

      const url = Linking.createURL(`/join/${data.id}`);
      setSessionId(data.id);
      setShareUrl(url);
      setStep("created");
      addEvent({
        type: "group_created",
        restaurantName: selectedRestaurant!.name,
        restaurantId: String(selectedRestaurant!.id),
        entryId: data.id,
        partySize: 1,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      Alert.alert("Error", err.message);
      setStep("select");
    }
  };

  const handleCopyLink = async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === "web") {
      await navigator.clipboard?.writeText(shareUrl);
    } else {
      Clipboard.setString(shareUrl);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `Join my group order at ${selectedRestaurant?.name}! 🍽️\n${shareUrl}`,
        url: shareUrl,
      });
    } catch {}
  };

  const handleJoinAsHost = () => {
    if (!sessionId) return;
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace(`/join/${sessionId}` as any);
  };

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [router]);

  return (
    <>
      <Stack.Screen
        options={{ headerShown: false, gestureEnabled: step !== "created" }}
      />
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "#0f0f0f" }}
        edges={["top"]}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingTop: 4,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: "#1a1a1a",
          }}
        >
          <Pressable
            onPress={goBack}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "#1a1a1a",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <ArrowLeft size={20} color="#f5f5f5" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: "BricolageGrotesque_800ExtraBold",
                color: "#f5f5f5",
                fontSize: 22,
                letterSpacing: -0.3,
              }}
            >
              Group Order
            </Text>
            <Text
              style={{
                fontFamily: "Manrope_500Medium",
                color: "#666",
                fontSize: 13,
                marginTop: 1,
              }}
            >
              {step === "select"
                ? "Choose a restaurant to get started"
                : step === "starting"
                  ? "Setting up your group order…"
                  : `Hosting at ${selectedRestaurant?.name}`}
            </Text>
          </View>
          <UtensilsCrossed size={22} color="#FF9933" />
        </View>

        {/* ── STEP: SELECT ── */}
        {step === "select" && (
          <>
            {/* Search bar */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginHorizontal: 16,
                marginTop: 12,
                marginBottom: 8,
                backgroundColor: "#141414",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#1e1e1e",
                paddingHorizontal: 12,
                gap: 8,
              }}
            >
              <Search size={16} color="#555" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search restaurants or cuisine…"
                placeholderTextColor="#444"
                style={{
                  flex: 1,
                  fontFamily: "Manrope_500Medium",
                  color: "#f5f5f5",
                  fontSize: 14,
                  paddingVertical: 12,
                }}
              />
            </View>

            {/* Sort pills */}
            <View
              style={{
                flexDirection: "row",
                paddingHorizontal: 16,
                paddingBottom: 8,
                gap: 8,
              }}
            >
              {(["waitTime", "distance"] as SortOption[]).map((opt) => {
                const active = sortBy === opt;
                const Icon = opt === "waitTime" ? Clock : MapPin;
                const label = opt === "waitTime" ? "Wait Time" : "Distance";
                return (
                  <Pressable
                    key={opt}
                    onPress={() => {
                      if (Platform.OS !== "web") Haptics.selectionAsync();
                      setSortBy(active ? "none" : opt);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                      backgroundColor: active
                        ? "rgba(255,153,51,0.2)"
                        : "#141414",
                      borderRadius: 20,
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderWidth: 1,
                      borderColor: active ? "#FF9933" : "#2a2a2a",
                    }}
                  >
                    <Icon size={12} color={active ? "#FF9933" : "#999"} />
                    <Text
                      style={{
                        fontFamily: "Manrope_600SemiBold",
                        color: active ? "#FF9933" : "#999",
                        fontSize: 12,
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 120 }}
              keyboardShouldPersistTaps="handled"
            >
              {loadingRestaurants ? (
                <View style={{ paddingTop: 80, alignItems: "center" }}>
                  <ActivityIndicator color="#FF9933" size="large" />
                  <Text
                    style={{
                      fontFamily: "Manrope_500Medium",
                      color: "#666",
                      fontSize: 14,
                      marginTop: 12,
                    }}
                  >
                    Loading restaurants…
                  </Text>
                </View>
              ) : (
                <View style={{ paddingTop: 4 }}>
                  {filteredRestaurants.map((r, i) => {
                    const isSelected = selectedRestaurant?.id === r.id;
                    const wt = waitLabel(r.current_wait_time);
                    return (
                      <Animated.View
                        key={r.id}
                        entering={FadeInDown.delay(i * 30).duration(250)}
                      >
                        <Pressable
                          onPress={() => handleSelectRestaurant(r)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginHorizontal: 16,
                            marginVertical: 4,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            borderRadius: 14,
                            backgroundColor: isSelected
                              ? "rgba(255,153,51,0.12)"
                              : "#141414",
                            borderWidth: 1,
                            borderColor: isSelected ? "#FF9933" : "#1e1e1e",
                            gap: 12,
                          }}
                        >
                          {/* Restaurant image */}
                          {r.image_url ? (
                            <Image
                              source={{ uri: r.image_url }}
                              style={{
                                width: 52,
                                height: 52,
                                borderRadius: 10,
                                backgroundColor: "#1e1e1e",
                              }}
                              resizeMode="cover"
                            />
                          ) : (
                            <View
                              style={{
                                width: 52,
                                height: 52,
                                borderRadius: 10,
                                backgroundColor: "#1e1e1e",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <UtensilsCrossed size={22} color="#333" />
                            </View>
                          )}

                          {/* Name + cuisine */}
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontFamily: "BricolageGrotesque_700Bold",
                                color: "#f5f5f5",
                                fontSize: 15,
                                letterSpacing: -0.2,
                              }}
                              numberOfLines={1}
                            >
                              {r.name}
                            </Text>
                            {r.cuisine_tags?.length > 0 && (
                              <Text
                                style={{
                                  fontFamily: "Manrope_500Medium",
                                  color: "#666",
                                  fontSize: 12,
                                  marginTop: 2,
                                }}
                                numberOfLines={1}
                              >
                                {r.cuisine_tags.join(" · ")}
                              </Text>
                            )}
                          </View>

                          {/* Wait time */}
                          <View style={{ alignItems: "flex-end", gap: 4 }}>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <Clock size={11} color={wt.color} />
                              <Text
                                style={{
                                  fontFamily: "Manrope_600SemiBold",
                                  color: wt.color,
                                  fontSize: 12,
                                }}
                              >
                                {wt.text}
                              </Text>
                            </View>

                            {/* Check circle */}
                            <View
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: 10,
                                borderWidth: 2,
                                borderColor: isSelected ? "#FF9933" : "#333",
                                backgroundColor: isSelected
                                  ? "#FF9933"
                                  : "transparent",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {isSelected && (
                                <Check
                                  size={11}
                                  color="#0f0f0f"
                                  strokeWidth={3}
                                />
                              )}
                            </View>
                          </View>
                        </Pressable>
                      </Animated.View>
                    );
                  })}
                  {filteredRestaurants.length === 0 && !loadingRestaurants && (
                    <View style={{ alignItems: "center", paddingTop: 48 }}>
                      <Text
                        style={{
                          fontFamily: "Manrope_500Medium",
                          color: "#555",
                          fontSize: 14,
                        }}
                      >
                        No restaurants match "{search}"
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            {/* Start Button */}
            <View
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                paddingHorizontal: 20,
                paddingBottom: 36,
                paddingTop: 16,
                backgroundColor: "#0f0f0f",
                borderTopWidth: 1,
                borderTopColor: "#1a1a1a",
              }}
            >
              <Pressable
                onPress={handleStart}
                disabled={!selectedRestaurant}
                style={{
                  backgroundColor: selectedRestaurant ? "#FF9933" : "#1a1a1a",
                  borderRadius: 14,
                  paddingVertical: 16,
                  paddingHorizontal: 20,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                }}
              >
                <Users
                  size={18}
                  color={selectedRestaurant ? "#0f0f0f" : "#444"}
                  style={{ flexShrink: 0 }}
                />
                <Text
                  style={{
                    fontFamily: "BricolageGrotesque_700Bold",
                    color: selectedRestaurant ? "#0f0f0f" : "#444",
                    fontSize: 17,
                    letterSpacing: -0.2,
                    flexShrink: 1,
                    textAlign: "center",
                  }}
                >
                  {selectedRestaurant
                    ? `Start Group Order at ${selectedRestaurant.name}`
                    : "Select a Restaurant First"}
                </Text>
              </Pressable>
            </View>
          </>
        )}

        {/* ── STEP: STARTING ── */}
        {step === "starting" && (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <ActivityIndicator color="#FF9933" size="large" />
            <Text
              style={{
                fontFamily: "Manrope_500Medium",
                color: "#888",
                fontSize: 15,
              }}
            >
              Creating your group order session…
            </Text>
          </View>
        )}

        {/* ── STEP: CREATED ── */}
        {step === "created" && (
          <Animated.View
            entering={FadeIn.duration(400)}
            style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24 }}
          >
            {/* Success header */}
            <View
              style={{
                backgroundColor: "rgba(255,153,51,0.1)",
                borderRadius: 16,
                padding: 20,
                borderWidth: 1,
                borderColor: "rgba(255,153,51,0.25)",
                marginBottom: 24,
              }}
            >
              <Text
                style={{
                  fontFamily: "BricolageGrotesque_800ExtraBold",
                  color: "#FF9933",
                  fontSize: 20,
                  letterSpacing: -0.3,
                  marginBottom: 6,
                }}
              >
                Group Order Created!
              </Text>
              <Text
                style={{
                  fontFamily: "Manrope_500Medium",
                  color: "#aaa",
                  fontSize: 14,
                  lineHeight: 20,
                }}
              >
                Share the link below with your group. Everyone can add their own
                items from their phone.
              </Text>
            </View>

            {/* Link card */}
            <Text
              style={{
                fontFamily: "Manrope_600SemiBold",
                color: "#666",
                fontSize: 12,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Invite Link
            </Text>
            <View
              style={{
                backgroundColor: "#141414",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#1e1e1e",
                padding: 14,
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  fontFamily: "JetBrainsMono_400Regular",
                  color: "#f5f5f5",
                  fontSize: 13,
                  lineHeight: 18,
                }}
                numberOfLines={2}
              >
                {shareUrl}
              </Text>
            </View>

            {/* Action buttons */}
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
              <Pressable
                onPress={handleCopyLink}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  backgroundColor: "#141414",
                  borderRadius: 12,
                  paddingVertical: 14,
                  borderWidth: 1,
                  borderColor: copied ? "#FF9933" : "#1e1e1e",
                }}
              >
                {copied ? (
                  <Check size={16} color="#FF9933" />
                ) : (
                  <Copy size={16} color="#f5f5f5" />
                )}
                <Text
                  style={{
                    fontFamily: "Manrope_600SemiBold",
                    color: copied ? "#FF9933" : "#f5f5f5",
                    fontSize: 14,
                  }}
                >
                  {copied ? "Copied!" : "Copy Link"}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleShare}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  backgroundColor: "#141414",
                  borderRadius: 12,
                  paddingVertical: 14,
                  borderWidth: 1,
                  borderColor: "#1e1e1e",
                }}
              >
                <Share2 size={16} color="#f5f5f5" />
                <Text
                  style={{
                    fontFamily: "Manrope_600SemiBold",
                    color: "#f5f5f5",
                    fontSize: 14,
                  }}
                >
                  Share
                </Text>
              </Pressable>
            </View>

            {/* Join as host */}
            <Pressable
              onPress={handleJoinAsHost}
              style={{
                backgroundColor: "#FF9933",
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Users size={18} color="#0f0f0f" />
              <Text
                style={{
                  fontFamily: "BricolageGrotesque_700Bold",
                  color: "#0f0f0f",
                  fontSize: 17,
                  letterSpacing: -0.2,
                }}
              >
                Join as Host
              </Text>
              <ChevronRight size={18} color="#0f0f0f" />
            </Pressable>

            <Text
              style={{
                fontFamily: "Manrope_500Medium",
                color: "#555",
                fontSize: 12,
                textAlign: "center",
                marginTop: 16,
                lineHeight: 18,
              }}
            >
              You can also share the link first and join later. The session
              stays open until the order is submitted.
            </Text>
          </Animated.View>
        )}
      </SafeAreaView>
    </>
  );
}
