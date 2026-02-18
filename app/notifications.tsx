import React from "react";
import { View, Text, ScrollView, Pressable, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import { ArrowLeft, Bell } from "lucide-react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

export default function NotificationsScreen() {
    const router = useRouter();

    return (
        <View className="flex-1 bg-rasvia-black">
            <Stack.Screen options={{ headerShown: false }} />
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
                        Notifications
                    </Text>
                </Animated.View>

                {/* Empty State */}
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 40,
                    }}
                >
                    <Animated.View
                        entering={FadeInDown.delay(200).duration(500)}
                        style={{ alignItems: "center" }}
                    >
                        <View
                            style={{
                                width: 120,
                                height: 120,
                                borderRadius: 60,
                                backgroundColor: "#1a1a1a",
                                borderWidth: 1,
                                borderColor: "#2a2a2a",
                                alignItems: "center",
                                justifyContent: "center",
                                marginBottom: 24,
                            }}
                        >
                            <Bell size={48} color="#666666" />
                        </View>
                        <Text
                            style={{
                                fontFamily: "BricolageGrotesque_700Bold",
                                color: "#f5f5f5",
                                fontSize: 22,
                                textAlign: "center",
                                marginBottom: 8,
                            }}
                        >
                            No Notifications
                        </Text>
                        <Text
                            style={{
                                fontFamily: "Manrope_500Medium",
                                color: "#999999",
                                fontSize: 15,
                                textAlign: "center",
                                lineHeight: 22,
                            }}
                        >
                            You're all caught up! We'll notify you when there's
                            something new.
                        </Text>
                    </Animated.View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
