import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    Pressable,
    Alert,
    Platform,
    KeyboardAvoidingView,
    ActivityIndicator,
    Dimensions,
    Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Mail, Lock, Eye, EyeOff } from "lucide-react-native";
import Animated, {
    FadeIn,
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { InAppNotification } from "@/components/InAppNotification";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function AuthScreen() {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastInitial, setLastInitial] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState<{
        visible: boolean;
        message: string;
        type: "error" | "success" | "info";
    }>({ visible: false, message: "", type: "error" });

    const btnScale = useSharedValue(1);
    const btnStyle = useAnimatedStyle(() => ({
        transform: [{ scale: btnScale.value }],
    }));

    async function handleAuth() {
        if (!email || !password) {
            setNotification({
                visible: true,
                message: "Please enter both email and password.",
                type: "error",
            });
            return;
        }

        if (isSignUp && (!firstName || !lastInitial)) {
            setNotification({
                visible: true,
                message: "Please enter your first name and last initial.",
                type: "error",
            });
            return;
        }

        setLoading(true);
        try {
            if (isSignUp) {
                const { data, error } = await supabase.auth.signUp({
                    email: email.trim(),
                    password,
                });
                if (error) throw error;

                // Create profile with name
                if (data.user) {
                    const fullName = `${firstName.trim()} ${lastInitial.trim().toUpperCase()}.`;
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .upsert({
                            id: data.user.id,
                            full_name: fullName,
                            created_at: new Date().toISOString(),
                        });
                    if (profileError) console.error('Profile creation error:', profileError);
                }
                // Session change will be handled by AuthProvider → auto redirect
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email: email.trim(),
                    password,
                });
                if (error) throw error;
                // Session change will be handled by AuthProvider → auto redirect
            }
        } catch (error: any) {
            // Show in-app notification instead of Alert
            const message = error.message || "Something went wrong.";
            setNotification({
                visible: true,
                message: message.includes("already registered")
                    ? "This account already exists.\nPlease sign in instead."
                    : message,
                type: "error",
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <View className="flex-1 bg-rasvia-black">
            {/* In-App Notification */}
            <InAppNotification
                visible={notification.visible}
                message={notification.message}
                type={notification.type}
                onDismiss={() => setNotification({ ...notification, visible: false })}
            />

            {/* Background Image */}
            <Image
                source={{
                    uri: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=1200&q=80",
                }}
                style={{ width: "100%", height: "100%", position: "absolute" }}
                resizeMode="cover"
            />

            {/* Dark Gradient Overlay */}
            <LinearGradient
                colors={[
                    "rgba(15,15,15,0.3)",
                    "rgba(15,15,15,0.6)",
                    "rgba(15,15,15,0.95)",
                    "#0f0f0f",
                ]}
                locations={[0, 0.3, 0.65, 0.85]}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                }}
            />

            <SafeAreaView className="flex-1" edges={["top"]}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    className="flex-1 justify-end"
                >
                    {/* Header Logo */}
                    <Animated.View
                        entering={FadeIn.duration(800)}
                        className="items-center mb-6"
                        style={{ paddingTop: SCREEN_HEIGHT * 0.08 }}
                    >
                        <Text
                            style={{
                                fontFamily: "BricolageGrotesque_800ExtraBold",
                                color: "#FF9933",
                                fontSize: 48,
                                letterSpacing: -1,
                            }}
                        >
                            rasvia
                        </Text>
                        <Text
                            style={{
                                fontFamily: "Manrope_500Medium",
                                color: "#999999",
                                fontSize: 16,
                                marginTop: 4,
                            }}
                        >
                            The Path to Flavor.
                        </Text>
                    </Animated.View>

                    {/* Glassmorphism Form Card */}
                    <Animated.View
                        entering={FadeInUp.delay(300).duration(600)}
                        style={{
                            backgroundColor: "rgba(26, 26, 26, 0.92)",
                            borderTopLeftRadius: 32,
                            borderTopRightRadius: 32,
                            borderTopWidth: 1,
                            borderLeftWidth: 1,
                            borderRightWidth: 1,
                            borderColor: "rgba(255, 255, 255, 0.06)",
                            paddingHorizontal: 24,
                            paddingTop: 32,
                            paddingBottom: 40,
                        }}
                    >
                        {/* Title */}
                        <Text
                            style={{
                                fontFamily: "BricolageGrotesque_700Bold",
                                color: "#f5f5f5",
                                fontSize: 26,
                                marginBottom: 6,
                            }}
                        >
                            {isSignUp ? "Create Account" : "Welcome Back"}
                        </Text>
                        <Text
                            style={{
                                fontFamily: "Manrope_500Medium",
                                color: "#999999",
                                fontSize: 14,
                                marginBottom: 28,
                            }}
                        >
                            {isSignUp
                                ? "Join the waitlist revolution."
                                : "Sign in to skip the line."}
                        </Text>

                        {/* Name Inputs (Sign Up Only) */}
                        {isSignUp && (
                            <>
                                <View
                                    style={{
                                        flexDirection: "row",
                                        marginBottom: 6,
                                        gap: 12,
                                    }}
                                >
                                    <View
                                        style={{
                                            flex: 1,
                                            flexDirection: "row",
                                            alignItems: "center",
                                            backgroundColor: "#262626",
                                            borderRadius: 16,
                                            borderWidth: 1,
                                            borderColor: "#333333",
                                            paddingHorizontal: 16,
                                            height: 56,
                                        }}
                                    >
                                        <TextInput
                                            style={{
                                                flex: 1,
                                                color: "#f5f5f5",
                                                fontFamily: "Manrope_500Medium",
                                                fontSize: 15,
                                            }}
                                            placeholder="First name"
                                            placeholderTextColor="#666666"
                                            value={firstName}
                                            onChangeText={setFirstName}
                                            autoCapitalize="words"
                                            autoCorrect={false}
                                        />
                                    </View>
                                    <View
                                        style={{
                                            width: 80,
                                            flexDirection: "row",
                                            alignItems: "center",
                                            backgroundColor: "#262626",
                                            borderRadius: 16,
                                            borderWidth: 1,
                                            borderColor: "#333333",
                                            paddingHorizontal: 16,
                                            height: 56,
                                        }}
                                    >
                                        <TextInput
                                            style={{
                                                flex: 1,
                                                color: "#f5f5f5",
                                                fontFamily: "Manrope_500Medium",
                                                fontSize: 15,
                                                textAlign: "center",
                                            }}
                                            placeholder="L"
                                            placeholderTextColor="#666666"
                                            value={lastInitial}
                                            onChangeText={(text) => setLastInitial(text.slice(0, 1))}
                                            maxLength={1}
                                            autoCapitalize="characters"
                                            autoCorrect={false}
                                        />
                                    </View>
                                </View>
                                <Text
                                    style={{
                                        fontFamily: "Manrope_500Medium",
                                        color: "#666666",
                                        fontSize: 12,
                                        marginBottom: 14,
                                        marginLeft: 4,
                                    }}
                                >
                                    First name, last initial
                                </Text>
                            </>
                        )}

                        {/* Email Input */}
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                backgroundColor: "#262626",
                                borderRadius: 16,
                                borderWidth: 1,
                                borderColor: "#333333",
                                paddingHorizontal: 16,
                                marginBottom: 14,
                                height: 56,
                            }}
                        >
                            <Mail size={18} color="#999999" />
                            <TextInput
                                style={{
                                    flex: 1,
                                    color: "#f5f5f5",
                                    fontFamily: "Manrope_500Medium",
                                    fontSize: 15,
                                    marginLeft: 12,
                                }}
                                placeholder="Email address"
                                placeholderTextColor="#666666"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        {/* Password Input */}
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                backgroundColor: "#262626",
                                borderRadius: 16,
                                borderWidth: 1,
                                borderColor: "#333333",
                                paddingHorizontal: 16,
                                marginBottom: 24,
                                height: 56,
                            }}
                        >
                            <Lock size={18} color="#999999" />
                            <TextInput
                                style={{
                                    flex: 1,
                                    color: "#f5f5f5",
                                    fontFamily: "Manrope_500Medium",
                                    fontSize: 15,
                                    marginLeft: 12,
                                }}
                                placeholder="Password"
                                placeholderTextColor="#666666"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                            />
                            <Pressable
                                onPress={() => setShowPassword(!showPassword)}
                                hitSlop={10}
                            >
                                {showPassword ? (
                                    <EyeOff size={18} color="#999999" />
                                ) : (
                                    <Eye size={18} color="#999999" />
                                )}
                            </Pressable>
                        </View>

                        {/* Action Button */}
                        <Animated.View style={btnStyle}>
                            <Pressable
                                onPress={() => {
                                    if (Platform.OS !== "web") {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    }
                                    handleAuth();
                                }}
                                onPressIn={() => {
                                    btnScale.value = withSpring(0.96);
                                }}
                                onPressOut={() => {
                                    btnScale.value = withSpring(1);
                                }}
                                disabled={loading}
                                style={{
                                    backgroundColor: "#FF9933",
                                    borderRadius: 16,
                                    height: 56,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    shadowColor: "#FF9933",
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.35,
                                    shadowRadius: 16,
                                    elevation: 10,
                                    opacity: loading ? 0.7 : 1,
                                }}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#0f0f0f" />
                                ) : (
                                    <Text
                                        style={{
                                            fontFamily: "BricolageGrotesque_700Bold",
                                            color: "#0f0f0f",
                                            fontSize: 17,
                                        }}
                                    >
                                        {isSignUp ? "Get Started" : "Welcome Back"}
                                    </Text>
                                )}
                            </Pressable>
                        </Animated.View>

                        {/* Toggle Sign In / Sign Up */}
                        <Pressable
                            onPress={() => {
                                if (Platform.OS !== "web") {
                                    Haptics.selectionAsync();
                                }
                                setIsSignUp(!isSignUp);
                            }}
                            style={{
                                marginTop: 20,
                                alignItems: "center",
                            }}
                        >
                            <Text
                                style={{
                                    fontFamily: "Manrope_500Medium",
                                    color: "#999999",
                                    fontSize: 14,
                                }}
                            >
                                {isSignUp ? "Already have an account? " : "New to Rasvia? "}
                                <Text
                                    style={{
                                        fontFamily: "Manrope_700Bold",
                                        color: "#FF9933",
                                    }}
                                >
                                    {isSignUp ? "Log In" : "Create Account"}
                                </Text>
                            </Text>
                        </Pressable>
                    </Animated.View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}
