import {
  DarkTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import "../global.css";
import {
  useFonts as useBricolage,
  BricolageGrotesque_800ExtraBold,
  BricolageGrotesque_700Bold,
} from "@expo-google-fonts/bricolage-grotesque";
import {
  useFonts as useManrope,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from "@expo-google-fonts/manrope";
import {
  useFonts as useJetBrains,
  JetBrainsMono_600SemiBold,
} from "@expo-google-fonts/jetbrains-mono";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LocationProvider } from "@/lib/location-context";

SplashScreen.preventAutoHideAsync();

const rasviaTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "#0f0f0f",
    card: "#1a1a1a",
    text: "#f5f5f5",
    border: "#333333",
    primary: "#FF9933",
  },
};

// ==========================================
// AUTH GATE: Redirects based on session
// ==========================================
function AuthGate() {
  const { session, loading, needsOnboarding } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthScreen = segments[0] === "auth";
    const inOnboarding = segments[0] === "onboarding";

    if (!session && !inAuthScreen) {
      router.replace("/auth");
    } else if (session && inAuthScreen) {
      if (needsOnboarding) {
        router.replace("/onboarding");
      } else {
        router.replace("/");
      }
    } else if (session && needsOnboarding && !inOnboarding) {
      router.replace("/onboarding");
    } else if (session && !needsOnboarding && inOnboarding) {
      router.replace("/");
    }
  }, [session, loading, needsOnboarding, segments]);

  // Block ALL rendering until auth state is known
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0f0f0f", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#FF9933" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={({ route }) => ({
        headerShown: !route.name.startsWith("tempobook"),
        contentStyle: { backgroundColor: "#0f0f0f" },
        animation: "slide_from_right",
      })}
    >
      <Stack.Screen name="auth" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="restaurant/[id]"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="cuisine/[name]"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="waitlist/[id]"
        options={{ headerShown: false, animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="profile"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="map"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [bricolageLoaded] = useBricolage({
    BricolageGrotesque_800ExtraBold,
    BricolageGrotesque_700Bold,
  });

  const [manropeLoaded] = useManrope({
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  const [jetbrainsLoaded] = useJetBrains({
    JetBrainsMono_600SemiBold,
  });

  const fontsLoaded = bricolageLoaded && manropeLoaded && jetbrainsLoaded;

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View className="flex-1 bg-rasvia-black items-center justify-center">
        <ActivityIndicator size="large" color="#FF9933" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={rasviaTheme}>
          <StatusBar style="light" />
          <AuthProvider>
            <LocationProvider>
              <AuthGate />
            </LocationProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
