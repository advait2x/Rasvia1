import {
  DarkTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View, ActivityIndicator, Platform, Alert } from "react-native";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
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
import { NotificationsProvider, useNotifications } from "@/lib/notifications-context";
import { InAppNotification } from "@/components/InAppNotification";

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
// GLOBAL TABLE-READY BANNER
// ==========================================
function GlobalTableReadyBanner() {
  const { tableReadyAlert, clearTableReadyAlert, seatedAlert, clearSeatedAlert } = useNotifications();

  useEffect(() => {
    if (tableReadyAlert && Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 150);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 350);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 600);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 750);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 950);
    }
  }, [tableReadyAlert]);

  useEffect(() => {
    if (seatedAlert && Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 400);
    }
  }, [seatedAlert]);

  // Show seated (blue) banner on top if present, otherwise table ready (green)
  if (seatedAlert) {
    return (
      <InAppNotification
        visible
        message={`Enjoy your meal at ${seatedAlert.restaurantName}!`}
        type="seated"
        onDismiss={clearSeatedAlert}
        duration={8000}
      />
    );
  }

  return (
    <InAppNotification
      visible={!!tableReadyAlert}
      message={tableReadyAlert ? `Your table is ready at ${tableReadyAlert.restaurantName}` : ""}
      type="table_ready"
      onDismiss={clearTableReadyAlert}
      duration={8000}
    />
  );
}

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

  // ── Global deep link handler for checkout/cancel & error ──
  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      const { path, queryParams } = Linking.parse(event.url);

      if (path === 'checkout/cancel') {
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          'Payment Cancelled',
          'Your payment was not processed. No charges were made.',
          [{ text: 'OK', onPress: () => router.replace('/') }],
        );
      } else if (path === 'checkout/error') {
        const reason = (queryParams as any)?.reason || 'unknown';
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'Payment Error',
          reason === 'payment_incomplete'
            ? 'Your payment could not be confirmed. Please try again.'
            : `Something went wrong. Please try again.`,
          [{ text: 'OK', onPress: () => router.replace('/') }],
        );
      } else if (path === 'order-confirmation') {
        // Navigate to the order confirmation screen with params
        const params = queryParams as any;
        router.push({
          pathname: '/order-confirmation' as any,
          params: {
            order_id: params?.order_id || '',
            restaurant_name: params?.restaurant_name || '',
            order_type: params?.order_type || 'dine_in',
            total: params?.total || '0',
            party_session_id: params?.party_session_id || '',
          },
        });
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);
    Linking.getInitialURL().then(url => {
      if (url) handleUrl({ url });
    });

    return () => subscription.remove();
  }, [router]);

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
      <Stack.Screen
        name="admin-pulse"
        options={{ headerShown: false, animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="admin-orders"
        options={{ headerShown: false, animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="join/[id]"
        options={{ headerShown: false, animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="favorites"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="my-orders"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="order-confirmation"
        options={{ headerShown: false, animation: "slide_from_bottom" }}
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
              <NotificationsProvider>
                <AuthGate />
                <GlobalTableReadyBanner />
              </NotificationsProvider>
            </LocationProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
