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
} from "lucide-react-native";
import Animated, {
    FadeIn,
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const DFW_CITIES = [
    "Frisco, TX", "Plano, TX", "Irving, TX", "Dallas, TX", "Fort Worth, TX",
    "Richardson, TX", "Allen, TX", "McKinney, TX", "Carrollton, TX", "Denton, TX",
    "Arlington, TX", "Garland, TX", "Grapevine, TX", "Southlake, TX", "Coppell, TX",
    "Prosper, TX", "Lewisville, TX", "Flower Mound, TX", "The Colony, TX", "Little Elm, TX",
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
    const [userEmail, setUserEmail] = useState("");
    const [fullName, setFullName] = useState("");
    const [createdAt, setCreatedAt] = useState<string | null>(null);
    const [editingName, setEditingName] = useState(false);
    const [tempFirstName, setTempFirstName] = useState("");
    const [tempLastInitial, setTempLastInitial] = useState("");
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
            if (!session?.user?.id) { setLoadingPrefs(false); return; }
            try {
                const { data, error } = await supabase
                    .from("profiles")
                    .select("location_city, dietary_type, restricted_days, full_name, created_at")
                    .eq("id", session.user.id)
                    .maybeSingle();

                if (!error && data) {
                    const c = data.location_city || "Frisco, TX";
                    const d = data.dietary_type || "";
                    const r = data.restricted_days || [];
                    setCity(c); setOrigCity(c);
                    setDietaryType(d); setOrigDietary(d);
                    setRestrictedDays(r); setOrigDays(r);
                    
                    // Set name and date
                    setFullName(data.full_name || "");
                    setCreatedAt(data.created_at);
                }
            } catch { }
            setLoadingPrefs(false);
        }
        loadPrefs();
    }, [session]);

    // Track changes (only after prefs are loaded)
    useEffect(() => {
        if (loadingPrefs) return; // Don't track changes while loading
        
        const changed =
            city !== origCity ||
            dietaryType !== origDietary ||
            JSON.stringify(restrictedDays.sort()) !== JSON.stringify(origDays.sort());
        setPrefsChanged(changed);
    }, [city, dietaryType, restrictedDays, origCity, origDietary, origDays, loadingPrefs]);

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
                        const { error } = await supabase.auth.signOut();
                        if (error) throw error;
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

    return (
        <View className="flex-1 bg-rasvia-black">
            <SafeAreaView className="flex-1" edges={["top"]}>
                {/* Header */}
                <Animated.View
                    entering={FadeIn.duration(400)}
                    className="flex-row items-center px-5 pt-2 pb-4"
                >
                    <Pressable
                        onPress={() => router.back()}
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
                                const parts = fullName.split(' ');
                                const first = parts.slice(0, -1).join(' ');
                                const lastInit = parts[parts.length - 1]?.replace('.', '') || '';
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
                        <Text
                            style={{
                                fontFamily: "Manrope_500Medium",
                                color: "#999999",
                                fontSize: 13,
                            }}
                        >
                            {createdAt 
                                ? `Foodie since ${new Date(createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
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
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
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
                                    <Text style={{ fontFamily: "Manrope_600SemiBold", color: "#999", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
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
                                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                                            <MapPin size={16} color="#FF9933" />
                                            <Text style={{ fontFamily: "Manrope_600SemiBold", color: "#f5f5f5", fontSize: 15, marginLeft: 8 }}>
                                                {city}
                                            </Text>
                                        </View>
                                        <ChevronDown size={18} color="#999" style={{ transform: [{ rotate: showCityPicker ? "180deg" : "0deg" }] }} />
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
                                            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
                                                {DFW_CITIES.map((c) => (
                                                    <Pressable
                                                        key={c}
                                                        onPress={() => {
                                                            setCity(c);
                                                            setShowCityPicker(false);
                                                            if (Platform.OS !== "web") Haptics.selectionAsync();
                                                        }}
                                                        style={{
                                                            flexDirection: "row",
                                                            alignItems: "center",
                                                            justifyContent: "space-between",
                                                            paddingHorizontal: 14,
                                                            paddingVertical: 12,
                                                            borderBottomWidth: 1,
                                                            borderBottomColor: "#2a2a2a",
                                                            backgroundColor: city === c ? "rgba(255,153,51,0.08)" : "transparent",
                                                        }}
                                                    >
                                                        <Text style={{ fontFamily: "Manrope_500Medium", color: city === c ? "#FF9933" : "#f5f5f5", fontSize: 14 }}>
                                                            {c}
                                                        </Text>
                                                        {city === c && <Check size={16} color="#FF9933" />}
                                                    </Pressable>
                                                ))}
                                            </ScrollView>
                                        </View>
                                    )}

                                    {/* === Dietary Type === */}
                                    <Text style={{ fontFamily: "Manrope_600SemiBold", color: "#999", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
                                        Dietary Preference
                                    </Text>
                                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
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
                                                        backgroundColor: isSelected ? "rgba(255,153,51,0.12)" : "#262626",
                                                        borderWidth: isSelected ? 1.5 : 1,
                                                        borderColor: isSelected ? "#FF9933" : "#333",
                                                        borderRadius: 12,
                                                        paddingHorizontal: 14,
                                                        paddingVertical: 10,
                                                    }}
                                                >
                                                    <Icon size={16} color={isSelected ? "#FF9933" : option.color} />
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
                                                        <View style={{ marginLeft: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: "#FF9933", alignItems: "center", justifyContent: "center" }}>
                                                            <Check size={11} color="#0f0f0f" strokeWidth={3} />
                                                        </View>
                                                    )}
                                                </Pressable>
                                            );
                                        })}
                                    </View>

                                    {/* === Veg-Only Days (Non-Veg only) === */}
                                    {dietaryType === "Non-Veg" && (
                                        <>
                                            <Text style={{ fontFamily: "Manrope_600SemiBold", color: "#999", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
                                                Veg-Only Days
                                            </Text>
                                            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
                                                {DAYS.map((day, index) => {
                                                    const isActive = restrictedDays.includes(day.full);
                                                    return (
                                                        <Pressable
                                                            key={day.full + index}
                                                            onPress={() => {
                                                                setRestrictedDays((prev) =>
                                                                    prev.includes(day.full) ? prev.filter((d) => d !== day.full) : [...prev, day.full]
                                                                );
                                                                if (Platform.OS !== "web") Haptics.selectionAsync();
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
                                                                    backgroundColor: isActive ? "#10B981" : "#262626",
                                                                    borderWidth: isActive ? 0 : 1,
                                                                    borderColor: "#333",
                                                                }}
                                                            >
                                                                <Text style={{ fontFamily: "BricolageGrotesque_700Bold", color: isActive ? "#fff" : "#999", fontSize: 13 }}>
                                                                    {day.short}
                                                                </Text>
                                                            </View>
                                                            <Text style={{ fontFamily: "Manrope_500Medium", color: isActive ? "#10B981" : "#555", fontSize: 9, marginTop: 4 }}>
                                                                {day.full}
                                                            </Text>
                                                        </Pressable>
                                                    );
                                                })}
                                            </View>
                                            <Text style={{ fontFamily: "Manrope_500Medium", color: "#666", fontSize: 12, marginBottom: 10 }}>
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
                                                onPressIn={() => { saveScale.value = withSpring(0.96); }}
                                                onPressOut={() => { saveScale.value = withSpring(1); }}
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
                                                        <Text style={{ fontFamily: "BricolageGrotesque_700Bold", color: "#0f0f0f", fontSize: 15, marginLeft: 6 }}>
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

                    {/* Log Out */}
                    <Animated.View
                        entering={FadeInDown.delay(300).duration(500)}
                        style={[logoutStyle]}
                        className="mx-5"
                    >
                        <Pressable
                            onPress={handleLogout}
                            onPressIn={() => { logoutScale.value = withSpring(0.97); }}
                            onPressOut={() => { logoutScale.value = withSpring(1); }}
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
                                        onChangeText={(text) => setTempLastInitial(text.slice(0, 1))}
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
