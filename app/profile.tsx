import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  Platform,
  Switch,
  ActivityIndicator,
  Dimensions,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  User,
  LogOut,
  ChevronRight,
  ChevronDown,
  ShoppingBag,
  CreditCard,
  Bell,
  ArrowLeft,
  Leaf,
  Drumstick,
  Vegan,
  Ban,
  MapPin,
  Check,
  Sparkles,
  Utensils,
  Edit2,
  Activity,
  Shield,
  Phone,
} from "lucide-react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "@/lib/location-context";
import { useAdminMode } from "@/hooks/useAdminMode";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const DFW_CITIES = [
  "Frisco, TX",
  "Plano, TX",
  "Irving, TX",
  "Dallas, TX",
  "Fort Worth, TX",
  "Richardson, TX",
  "Allen, TX",
  "McKinney, TX",
  "Carrollton, TX",
  "Denton, TX",
  "Arlington, TX",
  "Garland, TX",
  "Grapevine, TX",
  "Southlake, TX",
  "Coppell, TX",
  "Prosper, TX",
  "Lewisville, TX",
  "Flower Mound, TX",
  "The Colony, TX",
  "Little Elm, TX",
];

const DIETARY_OPTIONS = [
  { key: "Vegetarian", label: "Vegetarian", icon: Leaf, color: "#22C55E" },
  { key: "Non-Veg", label: "Non-Veg", icon: Drumstick, color: "#EF4444" },
  { key: "Vegan", label: "Vegan", icon: Vegan, color: "#10B981" },
  { key: "Jain", label: "Jain", icon: Ban, color: "#F59E0B" },
];

const DAYS = [
  { short: "M", full: "Mon" },
  { short: "T", full: "Tue" },
  { short: "W", full: "Wed" },
  { short: "T", full: "Thu" },
  { short: "F", full: "Fri" },
  { short: "S", full: "Sat" },
  { short: "S", full: "Sun" },
];

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { isAdmin } = useAdminMode();
  const { reloadLocationPrefs, setUserCoordsOverride } = useLocation();
  const [userEmail, setUserEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [tempFirstName, setTempFirstName] = useState("");
  const [tempLastInitial, setTempLastInitial] = useState("");
  const [editingPhone, setEditingPhone] = useState(false);
  const [tempPhone, setTempPhone] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // Dining Preferences State
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [city, setCity] = useState("Frisco, TX");
  const [dietaryType, setDietaryType] = useState("");
  const [restrictedDays, setRestrictedDays] = useState<string[]>([]);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [prefsChanged, setPrefsChanged] = useState(false);

  // Location Settings State
  const [savedAddress, setSavedAddress] = useState("");
  const [origSavedAddress, setOrigSavedAddress] = useState("");
  const [liveLocationEnabled, setLiveLocationEnabled] = useState(true);
  const [origLiveLocationEnabled, setOrigLiveLocationEnabled] = useState(true);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [locationPrefsChanged, setLocationPrefsChanged] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  type Coordinates = { lat: string | number | null, lon: string | number | null } | null;
  const [selectedCoords, setSelectedCoords] = useState<Coordinates>(null);
  const [origSelectedCoords, setOrigSelectedCoords] = useState<Coordinates>(null);

  // Original values (to detect changes)
  const [origCity, setOrigCity] = useState("");
  const [origDietary, setOrigDietary] = useState("");
  const [origDays, setOrigDays] = useState<string[]>([]);

  useEffect(() => {
    if (session?.user?.email) {
      setUserEmail(session.user.email);
    }
  }, [session]);

  // Load preferences from profiles table
  useEffect(() => {
    async function loadPrefs() {
      if (!session?.user?.id) {
        setLoadingPrefs(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select(
            "location_city, dietary_type, restricted_days, full_name, created_at, saved_address, home_lat, home_long, phone_number",
          )
          .eq("id", session.user.id)
          .maybeSingle();

        const localToggle = await AsyncStorage.getItem("live_location_enabled");
        if (localToggle !== null) {
          const isLive = JSON.parse(localToggle);
          setLiveLocationEnabled(isLive);
          setOrigLiveLocationEnabled(isLive);
        }

        if (!error && data) {
          const c = data.location_city || "Frisco, TX";
          const d = data.dietary_type || "";
          const r = data.restricted_days || [];
          setCity(c);
          setOrigCity(c);
          setDietaryType(d);
          setOrigDietary(d);
          setRestrictedDays(r);
          setOrigDays(r);

          setFullName(data.full_name || "");
          setPhoneNumber((data as any).phone_number || "");
          setCreatedAt(data.created_at);

          const sAddr = data.saved_address || "";
          setSavedAddress(sAddr);
          setOrigSavedAddress(sAddr);

          if (data.home_lat && data.home_long) {
              const coords = { lat: data.home_lat, lon: data.home_long };
              setSelectedCoords(coords);
              setOrigSelectedCoords(coords);
          }
        }
      } catch {}
      setLoadingPrefs(false);
    }
    loadPrefs();
  }, [session]);

  // Track Location Changes
  useEffect(() => {
    if (loadingPrefs) return;
    const changed =
      savedAddress !== origSavedAddress ||
      liveLocationEnabled !== origLiveLocationEnabled;
    setLocationPrefsChanged(changed);
  }, [
    savedAddress,
    liveLocationEnabled,
    origSavedAddress,
    origLiveLocationEnabled,
    loadingPrefs,
  ]);

  // Autocomplete fetch
  useEffect(() => {
    const timer = setTimeout(async () => {
        if (savedAddress && savedAddress.trim().length > 4 && savedAddress !== origSavedAddress) {
            setIsSearchingAddress(true);
            try {
                // Ensure the search is loosely bounded to Texas to give better hits before filtering
                const query = savedAddress.toLowerCase().includes("tx") || savedAddress.toLowerCase().includes("texas") 
                    ? savedAddress 
                    : `${savedAddress}, Texas`;

                const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=10`, {
                    headers: { "User-Agent": "RasviaApp/1.0" }
                });
                const data = await res.json();

                // Filter results to only include Texas
                const filtered = (data || []).filter((item: any) => {
                    return item.address?.state === "Texas";
                });

                // Take top 5
                setAddressSuggestions(filtered.slice(0, 5));
            } catch(e) {}
            setIsSearchingAddress(false);
        } else {
            setAddressSuggestions([]);
        }
    }, 600);
    return () => clearTimeout(timer);
  }, [savedAddress, origSavedAddress]);

  // Track changes (only after prefs are loaded)
  useEffect(() => {
    if (loadingPrefs) return; // Don't track changes while loading

    const changed =
      city !== origCity ||
      dietaryType !== origDietary ||
      JSON.stringify(restrictedDays.sort()) !== JSON.stringify(origDays.sort());
    setPrefsChanged(changed);
  }, [
    city,
    dietaryType,
    restrictedDays,
    origCity,
    origDietary,
    origDays,
    loadingPrefs,
  ]);

  const savePreferences = useCallback(async () => {
    if (!session?.user?.id || savingPrefs) return;
    setSavingPrefs(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          location_city: city,
          dietary_type: dietaryType,
          restricted_days: dietaryType === "Non-Veg" ? restrictedDays : [],
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.user.id);

      if (error) throw error;

      // Update originals so button disables
      setOrigCity(city);
      setOrigDietary(dietaryType);
      setOrigDays(dietaryType === "Non-Veg" ? restrictedDays : []);

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Saved!", "Your preferences have been updated.");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Could not save preferences.");
    }
    setSavingPrefs(false);
  }, [session, city, dietaryType, restrictedDays, savingPrefs]);

  const handleSaveName = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const newFullName = `${tempFirstName.trim()} ${tempLastInitial.trim().toUpperCase()}.`;
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: newFullName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.user.id);

      if (error) throw error;

      setFullName(newFullName);
      setEditingName(false);

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Could not update name.");
    }
  }, [session, tempFirstName, tempLastInitial]);

  function formatPhoneNumber(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits.length ? `(${digits}` : "";
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  const handleSavePhone = useCallback(async () => {
    if (!session?.user?.id) return;
    const cleaned = tempPhone.replace(/\D/g, "").trim();
    if (!cleaned) {
      Alert.alert("Error", "Phone number cannot be empty.");
      return;
    }
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ phone_number: cleaned, updated_at: new Date().toISOString() })
        .eq("id", session.user.id);

      if (error) throw error;

              setPhoneNumber(formatPhoneNumber(cleaned));
              setEditingPhone(false);

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Could not update phone number.");
    }
  }, [session, tempPhone]);

  async function handleLogout() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          setLoggingOut(true);
          try {
            // Don't remove the user-scoped active group order key —
            // it lets the user recover their group order after re-login.
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            router.replace("/auth");
          } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to log out.");
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  }

  const logoutScale = useSharedValue(1);
  const logoutStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoutScale.value }],
  }));

  const saveScale = useSharedValue(1);
  const saveStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveScale.value }],
  }));

  const handleSaveLocationSettings = useCallback(async () => {
    if (!session?.user?.id || isSavingLocation) return;
    setIsSavingLocation(true);

    try {
      let lat = null;
      let lng = null;
      const addressToSave = savedAddress.trim();

      if (addressToSave) {
        if (selectedCoords && selectedCoords.lat && selectedCoords.lon) {
           lat = parseFloat(selectedCoords.lat.toString());
           lng = parseFloat(selectedCoords.lon.toString());
        } else {
            Alert.alert("Address Required", "Please select a specific address from the suggestions dropdown to ensure map accuracy.");
            setIsSavingLocation(false);
            return;
        }
      }

      // Save the toggle to local storage
      await AsyncStorage.setItem(
        "live_location_enabled",
        JSON.stringify(liveLocationEnabled),
      );

      // Save the address and coords to supabase
      const { error } = await supabase
        .from("profiles")
        .update({
          saved_address: addressToSave,
          home_lat: lat,
          home_long: lng,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.user.id);

      if (error) throw error;

      // Optimistic location update for immediate Map sync
      if (lat && lng) {
        setUserCoordsOverride({ latitude: lat, longitude: lng });
      }

      setOrigSavedAddress(addressToSave);
      setOrigSelectedCoords({ lat: lat ?? null, lon: lng ?? null });
      setOrigLiveLocationEnabled(liveLocationEnabled);
      setAddressSuggestions([]);

      await reloadLocationPrefs();

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Saved!", "Your location settings have been updated.");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Could not save location settings.");
    }
    setIsSavingLocation(false);
  }, [session, savedAddress, liveLocationEnabled, isSavingLocation]);

  const saveLocScale = useSharedValue(1);
  const saveLocStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveLocScale.value }],
  }));

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
            My Profile
          </Text>
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* User Info Card */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(500)}
            className="mx-5 mt-4 mb-8"
            style={{
              backgroundColor: "#1a1a1a",
              borderRadius: 20,
              borderWidth: 1,
              borderColor: "#2a2a2a",
              padding: 24,
              alignItems: "center",
            }}
          >
            <Pressable
              onPress={() => {
                // Parse full_name to get first name and last initial
                const parts = fullName.split(" ");
                const first = parts.slice(0, -1).join(" ");
                const lastInit =
                  parts[parts.length - 1]?.replace(".", "") || "";
                setTempFirstName(first);
                setTempLastInitial(lastInit);
                setEditingName(true);
              }}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: "#262626",
                borderWidth: 1,
                borderColor: "#333333",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Edit2 size={14} color="#FF9933" />
            </Pressable>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: "#262626",
                borderWidth: 2,
                borderColor: "#FF9933",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <User size={36} color="#FF9933" />
            </View>
            <Text
              style={{
                fontFamily: "Manrope_600SemiBold",
                color: "#f5f5f5",
                fontSize: 16,
                marginBottom: 4,
              }}
              numberOfLines={1}
            >
              {fullName || userEmail || "User"}
            </Text>
            <Text
              style={{
                fontFamily: "Manrope_500Medium",
                color: "#999999",
                fontSize: 13,
                marginBottom: 2,
              }}
            >
              {userEmail || ""}
            </Text>

            {/* Phone row with edit button */}
            <Pressable
              onPress={() => {
                setTempPhone(phoneNumber);
                setEditingPhone(true);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <Phone size={11} color="#666666" style={{ marginRight: 4 }} />
              <Text
                style={{
                  fontFamily: "Manrope_500Medium",
                  color: phoneNumber ? "#999999" : "#555555",
                  fontSize: 13,
                  marginRight: 4,
                }}
              >
                {phoneNumber || "Add phone number"}
              </Text>
              <Edit2 size={10} color="#FF9933" />
            </Pressable>

            <Text
              style={{
                fontFamily: "Manrope_500Medium",
                color: "#999999",
                fontSize: 13,
              }}
            >
              {createdAt
                ? `Foodie since ${new Date(createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`
                : "Foodie since 2026"}
            </Text>
          </Animated.View>

          {/* ==========================================
                        DINING PREFERENCES SECTION
                    ========================================== */}
          <Animated.View
            entering={FadeInDown.delay(150).duration(500)}
            className="mx-5 mb-8"
          >
            {/* Section Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <Utensils size={18} color="#FF9933" />
              <Text
                style={{
                  fontFamily: "BricolageGrotesque_700Bold",
                  color: "#f5f5f5",
                  fontSize: 18,
                  marginLeft: 8,
                }}
              >
                Dining Preferences
              </Text>
            </View>

            <View
              style={{
                backgroundColor: "#1a1a1a",
                borderRadius: 20,
                borderWidth: 1,
                borderColor: "#2a2a2a",
                padding: 20,
              }}
            >
              {loadingPrefs ? (
                <View style={{ paddingVertical: 40, alignItems: "center" }}>
                  <ActivityIndicator color="#FF9933" />
                </View>
              ) : (
                <>
                  {/* === Location === */}
                  <Text
                    style={{
                      fontFamily: "Manrope_600SemiBold",
                      color: "#999",
                      fontSize: 12,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      marginBottom: 8,
                    }}
                  >
                    Location
                  </Text>
                  <Pressable
                    onPress={() => setShowCityPicker((p) => !p)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: "#262626",
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: "#333",
                      paddingHorizontal: 14,
                      height: 48,
                      marginBottom: showCityPicker ? 8 : 20,
                    }}
                  >
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <MapPin size={16} color="#FF9933" />
                      <Text
                        style={{
                          fontFamily: "Manrope_600SemiBold",
                          color: "#f5f5f5",
                          fontSize: 15,
                          marginLeft: 8,
                        }}
                      >
                        {city}
                      </Text>
                    </View>
                    <ChevronDown
                      size={18}
                      color="#999"
                      style={{
                        transform: [
                          { rotate: showCityPicker ? "180deg" : "0deg" },
                        ],
                      }}
                    />
                  </Pressable>

                  {showCityPicker && (
                    <View
                      style={{
                        backgroundColor: "#222",
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: "#2a2a2a",
                        maxHeight: 180,
                        marginBottom: 20,
                        overflow: "hidden",
                      }}
                    >
                      <ScrollView
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled
                      >
                        {DFW_CITIES.map((c) => (
                          <Pressable
                            key={c}
                            onPress={() => {
                              setCity(c);
                              setShowCityPicker(false);
                              if (Platform.OS !== "web")
                                Haptics.selectionAsync();
                            }}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              paddingHorizontal: 14,
                              paddingVertical: 12,
                              borderBottomWidth: 1,
                              borderBottomColor: "#2a2a2a",
                              backgroundColor:
                                city === c
                                  ? "rgba(255,153,51,0.08)"
                                  : "transparent",
                            }}
                          >
                            <Text
                              style={{
                                fontFamily: "Manrope_500Medium",
                                color: city === c ? "#FF9933" : "#f5f5f5",
                                fontSize: 14,
                              }}
                            >
                              {c}
                            </Text>
                            {city === c && <Check size={16} color="#FF9933" />}
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* === Dietary Type === */}
                  <Text
                    style={{
                      fontFamily: "Manrope_600SemiBold",
                      color: "#999",
                      fontSize: 12,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      marginBottom: 10,
                    }}
                  >
                    Dietary Preference
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 10,
                      marginBottom: 20,
                    }}
                  >
                    {DIETARY_OPTIONS.map((option) => {
                      const isSelected = dietaryType === option.key;
                      const Icon = option.icon;
                      return (
                        <Pressable
                          key={option.key}
                          onPress={() => {
                            setDietaryType(option.key);
                            if (Platform.OS !== "web") Haptics.selectionAsync();
                          }}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: isSelected
                              ? "rgba(255,153,51,0.12)"
                              : "#262626",
                            borderWidth: isSelected ? 1.5 : 1,
                            borderColor: isSelected ? "#FF9933" : "#333",
                            borderRadius: 12,
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                          }}
                        >
                          <Icon
                            size={16}
                            color={isSelected ? "#FF9933" : option.color}
                          />
                          <Text
                            style={{
                              fontFamily: "Manrope_600SemiBold",
                              color: isSelected ? "#FF9933" : "#ccc",
                              fontSize: 14,
                              marginLeft: 8,
                            }}
                          >
                            {option.label}
                          </Text>
                          {isSelected && (
                            <View
                              style={{
                                marginLeft: 6,
                                width: 18,
                                height: 18,
                                borderRadius: 9,
                                backgroundColor: "#FF9933",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Check
                                size={11}
                                color="#0f0f0f"
                                strokeWidth={3}
                              />
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* === Veg-Only Days (Non-Veg only) === */}
                  {dietaryType === "Non-Veg" && (
                    <>
                      <Text
                        style={{
                          fontFamily: "Manrope_600SemiBold",
                          color: "#999",
                          fontSize: 12,
                          letterSpacing: 1,
                          textTransform: "uppercase",
                          marginBottom: 10,
                        }}
                      >
                        Veg-Only Days
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          marginBottom: 10,
                        }}
                      >
                        {DAYS.map((day, index) => {
                          const isActive = restrictedDays.includes(day.full);
                          return (
                            <Pressable
                              key={day.full + index}
                              onPress={() => {
                                setRestrictedDays((prev) =>
                                  prev.includes(day.full)
                                    ? prev.filter((d) => d !== day.full)
                                    : [...prev, day.full],
                                );
                                if (Platform.OS !== "web")
                                  Haptics.selectionAsync();
                              }}
                              style={{
                                alignItems: "center",
                              }}
                            >
                              <View
                                style={{
                                  width: 38,
                                  height: 38,
                                  borderRadius: 19,
                                  alignItems: "center",
                                  justifyContent: "center",
                                  backgroundColor: isActive
                                    ? "#10B981"
                                    : "#262626",
                                  borderWidth: isActive ? 0 : 1,
                                  borderColor: "#333",
                                }}
                              >
                                <Text
                                  style={{
                                    fontFamily: "BricolageGrotesque_700Bold",
                                    color: isActive ? "#fff" : "#999",
                                    fontSize: 13,
                                  }}
                                >
                                  {day.short}
                                </Text>
                              </View>
                              <Text
                                style={{
                                  fontFamily: "Manrope_500Medium",
                                  color: isActive ? "#10B981" : "#555",
                                  fontSize: 9,
                                  marginTop: 4,
                                }}
                              >
                                {day.full}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <Text
                        style={{
                          fontFamily: "Manrope_500Medium",
                          color: "#666",
                          fontSize: 12,
                          marginBottom: 10,
                        }}
                      >
                        {restrictedDays.length === 0
                          ? "No restrictions — you'll see all dishes every day."
                          : `Vegetarian only on ${restrictedDays.join(", ")}.`}
                      </Text>
                    </>
                  )}

                  {/* === Save Button === */}
                  {prefsChanged && (
                    <Animated.View style={saveStyle}>
                      <Pressable
                        onPress={savePreferences}
                        onPressIn={() => {
                          saveScale.value = withSpring(0.96);
                        }}
                        onPressOut={() => {
                          saveScale.value = withSpring(1);
                        }}
                        disabled={savingPrefs}
                        style={{
                          backgroundColor: "#FF9933",
                          borderRadius: 14,
                          height: 48,
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "row",
                          marginTop: 8,
                          shadowColor: "#FF9933",
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.3,
                          shadowRadius: 12,
                          elevation: 8,
                          opacity: savingPrefs ? 0.7 : 1,
                        }}
                      >
                        {savingPrefs ? (
                          <ActivityIndicator color="#0f0f0f" />
                        ) : (
                          <>
                            <Sparkles size={16} color="#0f0f0f" />
                            <Text
                              style={{
                                fontFamily: "BricolageGrotesque_700Bold",
                                color: "#0f0f0f",
                                fontSize: 15,
                                marginLeft: 6,
                              }}
                            >
                              Save Preferences
                            </Text>
                          </>
                        )}
                      </Pressable>
                    </Animated.View>
                  )}
                </>
              )}
            </View>
          </Animated.View>

          {/* ==========================================
                        LOCATION SETTINGS SECTION
                    ========================================== */}
          <Animated.View
            entering={FadeInDown.delay(175).duration(500)}
            className="mx-5 mb-8"
          >
            {/* Section Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <MapPin size={18} color="#FF9933" />
              <Text
                style={{
                  fontFamily: "BricolageGrotesque_700Bold",
                  color: "#f5f5f5",
                  fontSize: 18,
                  marginLeft: 8,
                }}
              >
                Location Settings
              </Text>
            </View>

            <View
              style={{
                backgroundColor: "#1a1a1a",
                borderRadius: 20,
                borderWidth: 1,
                borderColor: "#2a2a2a",
                padding: 20,
              }}
            >
              {/* === Live Location Toggle === */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                <View style={{ flex: 1, marginRight: 16 }}>
                  <Text
                    style={{
                      fontFamily: "Manrope_600SemiBold",
                      color: "#f5f5f5",
                      fontSize: 15,
                      marginBottom: 4,
                    }}
                  >
                    Live Location Tracking
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Manrope_500Medium",
                      color: "#999",
                      fontSize: 12,
                    }}
                  >
                    Automatically find nearby restaurants using device GPS
                  </Text>
                </View>
                <Switch
                  value={liveLocationEnabled}
                  onValueChange={(val) => {
                    setLiveLocationEnabled(val);
                    if (Platform.OS !== "web") Haptics.selectionAsync();
                  }}
                  trackColor={{
                    false: "#333333",
                    true: "rgba(255,153,51,0.4)",
                  }}
                  thumbColor={liveLocationEnabled ? "#FF9933" : "#666666"}
                />
              </View>

              <Divider />

              {/* === Saved Address Input === */}
              <View style={{ marginTop: 16 }}>
                <Text
                  style={{
                    fontFamily: "Manrope_600SemiBold",
                    color: "#999",
                    fontSize: 12,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Saved Address (Overrides GPS)
                </Text>
                <TextInput
                  value={savedAddress}
                  onChangeText={(val) => {
                    setSavedAddress(val);
                    setSelectedCoords(null);
                  }}
                  style={{
                    backgroundColor: "#262626",
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#333",
                    paddingHorizontal: 14,
                    height: 48,
                    color: "#f5f5f5",
                    fontFamily: "Manrope_500Medium",
                    fontSize: 15,
                  }}
                  placeholder="Enter full address, e.g. 123 Main St..."
                  placeholderTextColor="#666"
                  autoCorrect={false}
                />
                
                {/* Autocomplete Suggestions */}
                {addressSuggestions.length > 0 && (
                  <View style={{ 
                    backgroundColor: "#2a2a2a", 
                    borderRadius: 12, 
                    marginTop: 8, 
                    borderWidth: 1,
                    borderColor: "#333",
                    overflow: 'hidden' 
                  }}>
                    {addressSuggestions.map((item, idx) => (
                      <Pressable
                        key={idx}
                        style={{ 
                          padding: 12, 
                          borderBottomWidth: idx < addressSuggestions.length - 1 ? 1 : 0, 
                          borderColor: "#3a3a3a" 
                        }}
                        onPress={() => {
                          setSavedAddress(item.display_name);
                          setSelectedCoords({ lat: item.lat, lon: item.lon });
                          setAddressSuggestions([]);
                          if (Platform.OS !== "web") Haptics.selectionAsync();
                        }}
                      >
                        <Text style={{ color: "#f5f5f5", fontFamily: "Manrope_500Medium", fontSize: 13, lineHeight: 18 }}>
                          {item.display_name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                {isSearchingAddress && (
                  <Text style={{color: "#666", fontSize: 11, fontFamily: "Manrope_500Medium", marginTop: 6, marginLeft: 4}}>Searching...</Text>
                )}
              </View>

              {/* === Save Location Button === */}
              {locationPrefsChanged && (
                <Animated.View style={saveLocStyle}>
                  <Pressable
                    onPress={handleSaveLocationSettings}
                    onPressIn={() => {
                      saveLocScale.value = withSpring(0.96);
                    }}
                    onPressOut={() => {
                      saveLocScale.value = withSpring(1);
                    }}
                    disabled={isSavingLocation}
                    style={{
                      backgroundColor: "#FF9933",
                      borderRadius: 14,
                      height: 48,
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                      marginTop: 16,
                      shadowColor: "#FF9933",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 12,
                      elevation: 8,
                      opacity: isSavingLocation ? 0.7 : 1,
                    }}
                  >
                    {isSavingLocation ? (
                      <ActivityIndicator color="#0f0f0f" />
                    ) : (
                      <>
                        <MapPin size={16} color="#0f0f0f" />
                        <Text
                          style={{
                            fontFamily: "BricolageGrotesque_700Bold",
                            color: "#0f0f0f",
                            fontSize: 15,
                            marginLeft: 6,
                          }}
                        >
                          Save Location Settings
                        </Text>
                      </>
                    )}
                  </Pressable>
                </Animated.View>
              )}
            </View>
          </Animated.View>

          {/* Settings List */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(500)}
            className="mx-5 mb-8"
            style={{
              backgroundColor: "#1a1a1a",
              borderRadius: 20,
              borderWidth: 1,
              borderColor: "#2a2a2a",
              overflow: "hidden",
            }}
          >
            <SettingsRow
              icon={<ShoppingBag size={20} color="#FF9933" />}
              label="My Orders"
              hasChevron
              onPress={() => {
                if (Platform.OS !== "web") Haptics.selectionAsync();
              }}
            />
            <Divider />
            <SettingsRow
              icon={<CreditCard size={20} color="#FF9933" />}
              label="Payment Methods"
              hasChevron
              onPress={() => {
                if (Platform.OS !== "web") Haptics.selectionAsync();
              }}
            />
            <Divider />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 20,
                paddingVertical: 16,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: "rgba(255, 153, 51, 0.12)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 14,
                }}
              >
                <Bell size={20} color="#FF9933" />
              </View>
              <Text
                style={{
                  flex: 1,
                  fontFamily: "Manrope_600SemiBold",
                  color: "#f5f5f5",
                  fontSize: 15,
                }}
              >
                Notifications
              </Text>
              <Switch
                value={notificationsEnabled}
                onValueChange={(val) => {
                  setNotificationsEnabled(val);
                  if (Platform.OS !== "web") Haptics.selectionAsync();
                }}
                trackColor={{ false: "#333333", true: "rgba(255,153,51,0.4)" }}
                thumbColor={notificationsEnabled ? "#FF9933" : "#666666"}
              />
            </View>
          </Animated.View>

          {/* Admin Pulse — only visible to admins */}
          {isAdmin && (
            <Animated.View
              entering={FadeInDown.delay(280).duration(500)}
              className="mx-5 mb-4"
            >
              <Pressable
                onPress={() => {
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/admin-pulse" as any);
                }}
                style={{
                  backgroundColor: "rgba(255,153,51,0.08)",
                  borderWidth: 1,
                  borderColor: "rgba(255,153,51,0.25)",
                  borderRadius: 16,
                  paddingVertical: 16,
                  paddingHorizontal: 20,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Shield size={18} color="#FF9933" />
                  <Text style={{ fontFamily: "Manrope_700Bold", color: "#FF9933", fontSize: 16, marginLeft: 10 }}>
                    Admin Pulse
                  </Text>
                </View>
                <ChevronRight size={18} color="#FF9933" />
              </Pressable>
            </Animated.View>
          )}

          {/* Log Out */}
          <Animated.View
            entering={FadeInDown.delay(300).duration(500)}
            style={[logoutStyle]}
            className="mx-5"
          >
            <Pressable
              onPress={handleLogout}
              onPressIn={() => {
                logoutScale.value = withSpring(0.97);
              }}
              onPressOut={() => {
                logoutScale.value = withSpring(1);
              }}
              disabled={loggingOut}
              style={{
                borderWidth: 1,
                borderColor: "rgba(239, 68, 68, 0.3)",
                borderRadius: 16,
                paddingVertical: 16,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                backgroundColor: "rgba(239, 68, 68, 0.06)",
                opacity: loggingOut ? 0.5 : 1,
              }}
            >
              <LogOut size={18} color="#EF4444" />
              <Text
                style={{
                  fontFamily: "Manrope_700Bold",
                  color: "#EF4444",
                  fontSize: 16,
                  marginLeft: 8,
                }}
              >
                Log Out
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>

        {/* Phone Edit Modal */}
        {editingPhone && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 24,
            }}
          >
            <View
              style={{
                backgroundColor: "#1a1a1a",
                borderRadius: 20,
                borderWidth: 1,
                borderColor: "#2a2a2a",
                padding: 24,
                width: "100%",
                maxWidth: 400,
              }}
            >
              <Text
                style={{
                  fontFamily: "BricolageGrotesque_700Bold",
                  color: "#f5f5f5",
                  fontSize: 20,
                  marginBottom: 16,
                }}
              >
                Edit Phone Number
              </Text>
              <Text
                style={{
                  fontFamily: "Manrope_600SemiBold",
                  color: "#999",
                  fontSize: 12,
                  marginBottom: 8,
                }}
              >
                Phone Number
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#262626",
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#333",
                  paddingHorizontal: 14,
                  height: 48,
                  marginBottom: 20,
                }}
              >
                <Phone size={16} color="#999999" />
                <TextInput
                  value={tempPhone}
                  onChangeText={(v) => setTempPhone(formatPhoneNumber(v))}
                  style={{
                    flex: 1,
                    color: "#f5f5f5",
                    fontFamily: "Manrope_500Medium",
                    fontSize: 15,
                    marginLeft: 10,
                  }}
                  placeholderTextColor="#666"
                  placeholder="e.g. 9725551234"
                  keyboardType="phone-pad"
                  autoFocus
                />
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Pressable
                  onPress={() => setEditingPhone(false)}
                  style={{
                    flex: 1,
                    backgroundColor: "#262626",
                    borderRadius: 12,
                    height: 48,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: "#333",
                  }}
                >
                  <Text style={{ fontFamily: "Manrope_600SemiBold", color: "#999", fontSize: 15 }}>
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSavePhone}
                  style={{
                    flex: 1,
                    backgroundColor: "#FF9933",
                    borderRadius: 12,
                    height: 48,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontFamily: "BricolageGrotesque_700Bold", color: "#0f0f0f", fontSize: 15 }}>
                    Save
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Name Edit Modal */}
        {editingName && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 24,
            }}
          >
            <View
              style={{
                backgroundColor: "#1a1a1a",
                borderRadius: 20,
                borderWidth: 1,
                borderColor: "#2a2a2a",
                padding: 24,
                width: "100%",
                maxWidth: 400,
              }}
            >
              <Text
                style={{
                  fontFamily: "BricolageGrotesque_700Bold",
                  color: "#f5f5f5",
                  fontSize: 20,
                  marginBottom: 16,
                }}
              >
                Edit Name
              </Text>
              <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: "Manrope_600SemiBold",
                      color: "#999",
                      fontSize: 12,
                      marginBottom: 8,
                    }}
                  >
                    First Name
                  </Text>
                  <TextInput
                    value={tempFirstName}
                    onChangeText={setTempFirstName}
                    style={{
                      backgroundColor: "#262626",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#333",
                      paddingHorizontal: 14,
                      height: 48,
                      color: "#f5f5f5",
                      fontFamily: "Manrope_500Medium",
                      fontSize: 15,
                    }}
                    placeholderTextColor="#666"
                    autoCapitalize="words"
                  />
                </View>
                <View style={{ width: 80 }}>
                  <Text
                    style={{
                      fontFamily: "Manrope_600SemiBold",
                      color: "#999",
                      fontSize: 12,
                      marginBottom: 8,
                    }}
                  >
                    Last Initial
                  </Text>
                  <TextInput
                    value={tempLastInitial}
                    onChangeText={(text) =>
                      setTempLastInitial(text.slice(0, 1))
                    }
                    maxLength={1}
                    style={{
                      backgroundColor: "#262626",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#333",
                      paddingHorizontal: 14,
                      height: 48,
                      color: "#f5f5f5",
                      fontFamily: "Manrope_500Medium",
                      fontSize: 15,
                      textAlign: "center",
                    }}
                    placeholderTextColor="#666"
                    autoCapitalize="characters"
                  />
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Pressable
                  onPress={() => setEditingName(false)}
                  style={{
                    flex: 1,
                    backgroundColor: "#262626",
                    borderRadius: 12,
                    height: 48,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: "#333",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Manrope_600SemiBold",
                      color: "#999",
                      fontSize: 15,
                    }}
                  >
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveName}
                  style={{
                    flex: 1,
                    backgroundColor: "#FF9933",
                    borderRadius: 12,
                    height: 48,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "BricolageGrotesque_700Bold",
                      color: "#0f0f0f",
                      fontSize: 15,
                    }}
                  >
                    Save
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

// ==========================================
// HELPER COMPONENTS
// ==========================================

function SettingsRow({
  icon,
  label,
  hasChevron,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  hasChevron?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 16,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: "rgba(255, 153, 51, 0.12)",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 14,
        }}
      >
        {icon}
      </View>
      <Text
        style={{
          flex: 1,
          fontFamily: "Manrope_600SemiBold",
          color: "#f5f5f5",
          fontSize: 15,
        }}
      >
        {label}
      </Text>
      {hasChevron && <ChevronRight size={18} color="#666666" />}
    </Pressable>
  );
}

function Divider() {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: "#2a2a2a",
        marginHorizontal: 20,
      }}
    />
  );
}
