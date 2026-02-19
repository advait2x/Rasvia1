import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  Platform,
  Dimensions,
  ActivityIndicator,
  Image,
  ScrollView,
  Animated as RNAnimated,
  PanResponder,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import MapView, { Marker, Callout, Region } from "react-native-maps";
import * as Location from "expo-location";
import {
  ArrowLeft,
  LocateFixed,
  Compass,
  Clock,
  Users,
  MapPin,
  Search,
  X,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut } from "react-native-reanimated";
import { supabase } from "@/lib/supabase";
import {
  type SupabaseRestaurant,
  type UIRestaurant,
  type WaitStatus,
  mapSupabaseToUI,
} from "@/lib/restaurant-types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Zoom threshold: below this latDelta = "zoomed in" (show cards), above = "zoomed out" (show dots)
const ZOOM_THRESHOLD = 0.08;
// Clustering active only when zoomed in somewhat (approx < 8 miles span)
const CLUSTERING_THRESHOLD = 0.12;

// Cluster radius for "Discover Nearby" — restaurants within 3 miles of each other
const NEARBY_CLUSTER_RADIUS_MILES = 3;

// Wait-status colors (matches WaitBadge)
const STATUS_COLORS: Record<WaitStatus, string> = {
  green: "#22C55E",
  amber: "#F59E0B",
  red: "#EF4444",
};
const STATUS_BG: Record<WaitStatus, string> = {
  green: "rgba(34, 197, 94, 0.2)",
  amber: "rgba(245, 158, 11, 0.2)",
  red: "rgba(239, 68, 68, 0.2)",
};

// Default region (fallback if location unavailable)
const DEFAULT_REGION: Region = {
  latitude: 40.4237,
  longitude: -86.9212,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

// ==============================
// Cluster type
// ==============================
type Cluster = {
  id: string;
  latitude: number;
  longitude: number;
  restaurants: UIRestaurant[];
};

// Distance-based greedy clustering
function clusterRestaurants(
  restaurants: UIRestaurant[],
  latDelta: number,
): Cluster[] {
  // Cluster radius in degrees — proportional to visible area
  const radius = latDelta * 0.35;
  const used = new Set<string>();
  const clusters: Cluster[] = [];

  for (const r of restaurants) {
    if (used.has(r.id)) continue;
    // Start new cluster with this restaurant
    const group: UIRestaurant[] = [r];
    used.add(r.id);

    // Find all un-clustered restaurants within radius
    for (const other of restaurants) {
      if (used.has(other.id)) continue;
      const dLat = Math.abs(r.lat! - other.lat!);
      const dLon = Math.abs(r.long! - other.long!);
      if (dLat < radius && dLon < radius) {
        group.push(other);
        used.add(other.id);
      }
    }

    const avgLat = group.reduce((s, x) => s + x.lat!, 0) / group.length;
    const avgLong = group.reduce((s, x) => s + x.long!, 0) / group.length;
    clusters.push({
      id: group.map((x) => x.id).join("-"),
      latitude: avgLat,
      longitude: avgLong,
      restaurants: group,
    });
  }
  return clusters;
}

// Haversine distance in miles
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);

  // State
  const [restaurants, setRestaurants] = useState<UIRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] =
    useState<UIRestaurant | null>(null);
  const [showNearbyList, setShowNearbyList] = useState(false);
  const [nearbyRestaurants, setNearbyRestaurants] = useState<UIRestaurant[]>(
    [],
  );
  const [showMapSearch, setShowMapSearch] = useState(false);

  // Track which geographic cluster to show next (persists across renders)
  const nearbyClusterIndexRef = useRef(0);

  // Animated bottom position for search FAB
  const fabBottom = useRef(new RNAnimated.Value(40)).current;

  // ==============================
  // Fetch restaurants
  // ==============================
  useEffect(() => {
    async function fetchRestaurants() {
      try {
        const { data, error } = await supabase
          .from("restaurants")
          .select("*")
          .order("current_wait_time", { ascending: true });

        if (error) throw error;
        if (data) {
          setRestaurants(data.map(mapSupabaseToUI));
        }
      } catch (err) {
        console.error("Map: error fetching restaurants:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchRestaurants();

    // Realtime subscription
    const subscription = supabase
      .channel("map:restaurants")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "restaurants" },
        (payload) => {
          const updated = mapSupabaseToUI(payload.new as SupabaseRestaurant);
          setRestaurants((prev) =>
            prev.map((r) => (r.id === updated.id ? updated : r)),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // Image prefetch removed — was loading ALL restaurant images into memory
  // on every data change. Images load on-demand now.

  // ==============================
  // Get user location
  // ==============================
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.warn("Location permission denied");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setUserLocation(coords);

      // Center map on user
      const initialRegion: Region = {
        ...coords,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      };
      setRegion(initialRegion);
      mapRef.current?.animateToRegion(initialRegion, 600);
    })();
  }, []);

  // Restaurants with valid coordinates — this is the ONLY marker list.
  // It changes only when restaurant data changes (from Supabase), never during zoom.
  const mappableRestaurants = useMemo(
    () => restaurants.filter((r) => r.lat != null && r.long != null),
    [restaurants],
  );

  // ==============================
  // Handlers
  // ==============================

  // Location button: snap to current user location
  const handleLocationPress = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (!userLocation) {
      Alert.alert("Location Unavailable", "Could not determine your location.");
      return;
    }
    const target: Region = {
      ...userLocation,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    };
    mapRef.current?.animateToRegion(target, 600);
    setSelectedRestaurant(null);
    // Reset cluster cycle so next Discover Nearby starts from closest
    nearbyClusterIndexRef.current = 0;
  }, [userLocation]);

  // Discover Nearby: cycle through geographic clusters on each press
  const handleDiscoverNearby = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (!userLocation) {
      Alert.alert("Location Unavailable", "Could not determine your location.");
      return;
    }
    if (mappableRestaurants.length === 0) {
      Alert.alert("No Restaurants", "No restaurants with locations found.");
      return;
    }

    // Calculate distance from user for all restaurants and sort by distance
    const withDist = mappableRestaurants
      .map((r) => ({
        restaurant: r,
        dist: haversineDistance(
          userLocation.latitude,
          userLocation.longitude,
          r.lat!,
          r.long!,
        ),
      }))
      .filter((w) => w.dist <= 15) // only within 15 miles
      .sort((a, b) => a.dist - b.dist);

    if (withDist.length === 0) {
      Alert.alert("No Restaurants", "No nearby restaurants found within 15 miles.");
      return;
    }

    // Build geographic clusters: group restaurants within NEARBY_CLUSTER_RADIUS_MILES of each other
    // Greedy clustering on the sorted-by-distance list
    const used = new Set<string>();
    const clusters: UIRestaurant[][] = [];

    for (const item of withDist) {
      if (used.has(item.restaurant.id)) continue;
      const cluster: UIRestaurant[] = [item.restaurant];
      used.add(item.restaurant.id);

      for (const other of withDist) {
        if (used.has(other.restaurant.id)) continue;
        // Check if this restaurant is within the cluster radius of the seed
        const distBetween = haversineDistance(
          item.restaurant.lat!,
          item.restaurant.long!,
          other.restaurant.lat!,
          other.restaurant.long!,
        );
        if (distBetween <= NEARBY_CLUSTER_RADIUS_MILES) {
          cluster.push(other.restaurant);
          used.add(other.restaurant.id);
        }
      }
      clusters.push(cluster);
    }

    if (clusters.length === 0) {
      Alert.alert("No Restaurants", "No nearby restaurants found.");
      return;
    }

    // Limit to 4 closest clusters max
    const maxClusters = clusters.slice(0, 4);

    // Pick the current cluster (wrapping around)
    const idx = nearbyClusterIndexRef.current % maxClusters.length;
    const clusterRestaurants = maxClusters[idx];
    // Advance for next press
    nearbyClusterIndexRef.current = (idx + 1) % maxClusters.length;

    // Fit map to show all restaurants in this cluster
    // Offset center so pins appear in the VISIBLE area above the overlay.
    const lats = clusterRestaurants.map((r) => r.lat!);
    const longs = clusterRestaurants.map((r) => r.long!);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLong = Math.min(...longs);
    const maxLong = Math.max(...longs);
    const centerLat = (minLat + maxLat) / 2;
    const centerLong = (minLong + maxLong) / 2;
    const spanLat = Math.max((maxLat - minLat) * 1.6, 0.008);
    const spanLong = Math.max((maxLong - minLong) * 1.6, 0.008);
    // Shift center downward so pins land in the visible area above the overlay
    const overlayFraction = OVERLAY_HEIGHT / SCREEN_HEIGHT;
    const latOffset = spanLat * overlayFraction * 0.5;
    const fitRegion: Region = {
      latitude: centerLat - latOffset,
      longitude: centerLong,
      latitudeDelta: spanLat,
      longitudeDelta: spanLong,
    };
    mapRef.current?.animateToRegion(fitRegion, 800);

    if (clusterRestaurants.length === 1) {
      setSelectedRestaurant(clusterRestaurants[0]);
    } else {
      // Prefetch images before showing overlay
      clusterRestaurants.forEach((r) => {
        if (r.image) Image.prefetch(r.image).catch(() => {});
      });
      setNearbyRestaurants(clusterRestaurants);
      // setTimeout 100ms to ensure map marker press event clears before state update
      setTimeout(() => setShowNearbyList(true), 100);
    }
  }, [userLocation, mappableRestaurants]);

  // Track zoom level ONLY — does NOT change the marker list.
  // Markers stay permanently mounted, only their visual children swap.
  const handleRegionChangeComplete = useCallback((newRegion: Region) => {
    setIsZoomedIn(newRegion.latitudeDelta < ZOOM_THRESHOLD);
  }, []);

  // Smoothly animate FAB when overlays appear/disappear
  useEffect(() => {
    let target = 40; // default bottom
    if (showNearbyList) {
      target = OVERLAY_HEIGHT + 16;
    } else if (selectedRestaurant) {
      target = CARD_HEIGHT + 20;
    }
    RNAnimated.timing(fabBottom, {
      toValue: target,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [showNearbyList, selectedRestaurant, fabBottom]);

  // Restaurant press: navigate to detail
  const handleRestaurantPress = useCallback(
    (restaurant: UIRestaurant) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      router.push(`/restaurant/${restaurant.id}` as any);
    },
    [router],
  );

  // Dot marker press: show popup
  const handleDotPress = useCallback((restaurant: UIRestaurant) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    setSelectedRestaurant(restaurant);
  }, []);

  // ==============================
  // Render
  // ==============================
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0f0f0f",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color="#FF9933" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0f0f0f" }}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={region}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}
        userInterfaceStyle="dark"
      >
        {/* All restaurants permanently mounted — NEVER changes during zoom.
            Children swap (Dot ↔ Card) but the Marker instances stay. */}
        {mappableRestaurants.map((restaurant) => (
          <Marker
            key={restaurant.id}
            coordinate={{
              latitude: restaurant.lat!,
              longitude: restaurant.long!,
            }}
            tracksViewChanges={isZoomedIn}
            onPress={() =>
              isZoomedIn
                ? handleRestaurantPress(restaurant)
                : handleDotPress(restaurant)
            }
          >
            {isZoomedIn ? (
              <ZoomedInMarker restaurant={restaurant} />
            ) : (
              <DotMarker status={restaurant.waitStatus} />
            )}
          </Marker>
        ))}
      </MapView>

      {/* Popup card when a pin is tapped — swipe down to dismiss */}
      {selectedRestaurant && (
        <SelectedRestaurantCard
          restaurant={selectedRestaurant}
          onDismiss={() => setSelectedRestaurant(null)}
          onPress={() =>
            router.push(`/restaurant/${selectedRestaurant.id}` as any)
          }
        />
      )}

      {/* Top overlay: back + discover + location buttons */}
      <SafeAreaView
        edges={["top"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0 }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingTop: 8,
          }}
        >
          {/* Back button */}
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
            }}
          >
            <ArrowLeft size={20} color="#f5f5f5" />
          </Pressable>

          {/* Discover Nearby — centered pill */}
          <Pressable
            onPress={handleDiscoverNearby}
            style={{
              backgroundColor: "#1a1a1a",
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 22,
              paddingVertical: 14,
              borderRadius: 28,
              borderWidth: 1.5,
              borderColor: "#FF9933",
            }}
          >
            <Compass size={18} color="#FF9933" />
            <Text
              style={{
                fontFamily: "BricolageGrotesque_700Bold",
                color: "#FF9933",
                fontSize: 15,
                marginLeft: 8,
              }}
            >
              Discover Nearby
            </Text>
          </Pressable>

          {/* Location button */}
          <Pressable
            onPress={handleLocationPress}
            style={{
              backgroundColor: "#1a1a1a",
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "#2a2a2a",
            }}
          >
            <LocateFixed size={20} color="#FF9933" />
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Nearby list overlay with swipe-to-dismiss */}
      {showNearbyList && nearbyRestaurants.length > 0 && (
        <NearbyListOverlay
          restaurants={nearbyRestaurants}
          onClose={() => {
            if (Platform.OS !== "web") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            setShowNearbyList(false);
          }}
          onSelect={(r) => {
            if (Platform.OS !== "web") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            // Offset latitude so the pin lands in the visible area above the overlay
            // Overlay covers ~55% of screen, so shift center upward by that fraction
            const currentDelta = region.latitudeDelta || 0.015;
            const latOffset = currentDelta * (OVERLAY_HEIGHT / SCREEN_HEIGHT) * 0.5;
            const targetRegion: Region = {
              latitude: r.lat! - latOffset,
              longitude: r.long!,
              latitudeDelta: 0.008,
              longitudeDelta: 0.008,
            };
            mapRef.current?.animateToRegion(targetRegion, 600);
          }}
        />
      )}

      {/* Search FAB — bottom right, smoothly rises above overlays */}
      {!showMapSearch && (
        <RNAnimated.View
          style={{
            position: "absolute",
            right: 16,
            bottom: fabBottom,
          }}
        >
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              setShowMapSearch(true);
            }}
            style={{
              backgroundColor: "#1a1a1a",
              width: 50,
              height: 50,
              borderRadius: 25,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1.5,
              borderColor: "#FF9933",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.4,
              shadowRadius: 6,
              elevation: 6,
            }}
          >
            <Search size={22} color="#FF9933" />
          </Pressable>
        </RNAnimated.View>
      )}

      {/* Map Search Overlay */}
      {showMapSearch && (
        <MapSearchOverlay
          restaurants={mappableRestaurants}
          onClose={() => setShowMapSearch(false)}
          onSelect={(r) => {
            setShowMapSearch(false);
            setShowNearbyList(false);
            // Animate map to the restaurant
            const targetRegion: Region = {
              latitude: r.lat!,
              longitude: r.long!,
              latitudeDelta: 0.008,
              longitudeDelta: 0.008,
            };
            mapRef.current?.animateToRegion(targetRegion, 600);
          }}
        />
      )}
    </View>
  );
}

// ==========================================
// ZOOMED IN MARKER: rich info card
// ==========================================
function ZoomedInMarker({ restaurant }: { restaurant: UIRestaurant }) {
  return (
    <View
      style={{
        alignItems: "flex-start",
        backgroundColor: "#1a1a1a",
        borderRadius: 14,
        padding: 10,
        borderWidth: 1,
        borderColor: "#2a2a2a",
        maxWidth: 220,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 5,
      }}
    >
      {/* Info — no image */}
      <Text
        numberOfLines={1}
        style={{
          fontFamily: "BricolageGrotesque_700Bold",
          color: "#f5f5f5",
          fontSize: 13,
          letterSpacing: -0.2,
          marginBottom: 2,
        }}
      >
        {restaurant.name}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          fontFamily: "Manrope_500Medium",
          color: "#999999",
          fontSize: 10,
          marginBottom: 4,
        }}
      >
        {restaurant.cuisine}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Users size={10} color="#FF9933" />
        <Text
          style={{
            fontFamily: "JetBrainsMono_600SemiBold",
            color: "#f5f5f5",
            fontSize: 10,
            marginLeft: 3,
          }}
        >
          {restaurant.queueLength}
        </Text>
        <Text
          style={{
            fontFamily: "Manrope_500Medium",
            color: "#999999",
            fontSize: 9,
            marginLeft: 2,
          }}
        >
          in queue
        </Text>
        <View
          style={{
            backgroundColor: STATUS_BG[restaurant.waitStatus],
            borderRadius: 8,
            paddingHorizontal: 5,
            paddingVertical: 1,
            marginLeft: 8,
          }}
        >
          <Text
            style={{
              fontFamily: "JetBrainsMono_600SemiBold",
              color: STATUS_COLORS[restaurant.waitStatus],
              fontSize: 9,
            }}
          >
            {restaurant.waitTime}m
          </Text>
        </View>
      </View>
    </View>
  );
}

// ==========================================
// ZOOMED OUT MARKER: 3-ring pin
// outer = wait color, middle = black, center = white
// Size scales with zoom level
// ==========================================
function DotMarker({ status }: { status: WaitStatus }) {
  // Fixed size — no dynamic props means the marker bitmap is never re-rasterized
  return (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: STATUS_COLORS[status],
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.4,
        shadowRadius: 3,
        elevation: 4,
      }}
    >
      {/* Black middle ring */}
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: "#111111",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* White center dot */}
        <View
          style={{
            width: 5,
            height: 5,
            borderRadius: 2.5,
            backgroundColor: "#ffffff",
          }}
        />
      </View>
    </View>
  );
}

// ==========================================
// SELECTED RESTAURANT CARD — swipe-down to dismiss
// ==========================================
const CARD_HEIGHT = 130; // approximate card height for slide animation

function SelectedRestaurantCard({
  restaurant,
  onDismiss,
  onPress,
}: {
  restaurant: UIRestaurant;
  onDismiss: () => void;
  onPress: () => void;
}) {
  const translateY = useRef(new RNAnimated.Value(CARD_HEIGHT)).current;

  // Slide in on mount
  useEffect(() => {
    RNAnimated.timing(translateY, {
      toValue: 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, []);

  // Slide out then dismiss
  const dismiss = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    RNAnimated.timing(translateY, {
      toValue: CARD_HEIGHT + 40,
      duration: 200,
      useNativeDriver: false,
    }).start(() => onDismiss());
  }, [onDismiss, translateY]);

  // PanResponder for swipe-down gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) {
          translateY.setValue(g.dy);
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 60 || g.vy > 0.4) {
          dismiss();
        } else {
          RNAnimated.timing(translateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  return (
    <RNAnimated.View
      {...panResponder.panHandlers}
      style={{
        position: "absolute",
        bottom: 40,
        left: 16,
        right: 16,
        transform: [{ translateY }],
      }}
    >
      {/* Drag handle */}
      <View
        style={{
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: "#555",
          alignSelf: "center",
          marginBottom: 8,
        }}
      />
      <Pressable
        onPress={onPress}
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#1a1a1a",
          borderRadius: 16,
          padding: 12,
          borderWidth: 1,
          borderColor: "#2a2a2a",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        {/* Image */}
        <Image
          source={{ uri: restaurant.image }}
          style={{
            width: 60,
            height: 60,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "#2a2a2a",
          }}
          resizeMode="cover"
        />

        {/* Info */}
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: "BricolageGrotesque_700Bold",
              color: "#f5f5f5",
              fontSize: 17,
              letterSpacing: -0.3,
              marginBottom: 3,
            }}
          >
            {restaurant.name}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: "Manrope_500Medium",
              color: "#999999",
              fontSize: 12,
              marginBottom: 6,
            }}
          >
            {restaurant.cuisine}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginRight: 14 }}>
              <Users size={12} color="#FF9933" />
              <Text
                style={{
                  fontFamily: "JetBrainsMono_600SemiBold",
                  color: "#f5f5f5",
                  fontSize: 12,
                  marginLeft: 4,
                }}
              >
                {restaurant.queueLength}
              </Text>
              <Text
                style={{
                  fontFamily: "Manrope_500Medium",
                  color: "#999999",
                  fontSize: 10,
                  marginLeft: 3,
                }}
              >
                in queue
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Clock size={12} color="#FF9933" />
              <View
                style={{
                  backgroundColor: STATUS_BG[restaurant.waitStatus],
                  borderRadius: 20,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  marginLeft: 4,
                }}
              >
                <Text
                  style={{
                    fontFamily: "JetBrainsMono_600SemiBold",
                    color: STATUS_COLORS[restaurant.waitStatus],
                    fontSize: 11,
                  }}
                >
                  {restaurant.waitTime} min
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Distance */}
        <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <MapPin size={11} color="#999999" />
            <Text
              style={{
                fontFamily: "Manrope_500Medium",
                color: "#999999",
                fontSize: 11,
                marginLeft: 3,
              }}
            >
              {restaurant.distance}
            </Text>
          </View>
        </View>
      </Pressable>
    </RNAnimated.View>
  );
}

// ==========================================
// NEARBY LIST OVERLAY — animated bottom sheet
// Uses RN's built-in Animated + PanResponder
// (NOT Reanimated — avoids transform conflicts)
// ==========================================
const SCREEN_HEIGHT = Dimensions.get("window").height;
const OVERLAY_HEIGHT = SCREEN_HEIGHT * 0.35;

function NearbyListOverlay({
  restaurants,
  onClose,
  onSelect,
}: {
  restaurants: UIRestaurant[];
  onClose: () => void;
  onSelect: (r: UIRestaurant) => void;
}) {
  // Prefetch images for the overlay restaurants
  useEffect(() => {
    restaurants.forEach((r) => {
      if (r.image) Image.prefetch(r.image).catch(() => {});
    });
  }, [restaurants]);

  // Animated translateY — starts off-screen, slides up
  const translateY = useRef(new RNAnimated.Value(OVERLAY_HEIGHT)).current;

  // Slide in on mount — fast timing, not spring
  useEffect(() => {
    RNAnimated.timing(translateY, {
      toValue: 0,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, []);

  // Slide out and call onClose
  const dismiss = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Animate out then close
    RNAnimated.timing(translateY, {
      toValue: OVERLAY_HEIGHT,
      duration: 200,
      useNativeDriver: false,
    }).start(() => onClose());
  }, [onClose, translateY]);

  // PanResponder for the drag handle ONLY
  const handlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) {
          translateY.setValue(g.dy);
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.4) {
          dismiss();
        } else {
          RNAnimated.timing(translateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
          }).start();
        }
      },
    }),
  ).current;

  return (
    <RNAnimated.View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: OVERLAY_HEIGHT,
        backgroundColor: "#1a1a1a",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 0,
        paddingBottom: 40,
        borderTopWidth: 1,
        borderTopColor: "#2a2a2a",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 10,
        transform: [{ translateY }],
      }}
    >
      {/* Drag handle area — ONLY this area responds to swipe-to-dismiss */}
      <View {...handlePanResponder.panHandlers} style={{ paddingVertical: 12, alignItems: "center" }}>
        <View
          style={{
            width: 40,
            height: 5,
            borderRadius: 3,
            backgroundColor: "#555",
          }}
        />
      </View>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            fontFamily: "BricolageGrotesque_700Bold",
            color: "#f5f5f5",
            fontSize: 18,
          }}
        >
          Nearby Restaurants
        </Text>
        <Pressable
          onPress={dismiss}
          style={{
            backgroundColor: "#2a2a2a",
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 5,
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope_600SemiBold",
              color: "#FF9933",
              fontSize: 13,
            }}
          >
            Close
          </Text>
        </Pressable>
      </View>
      {/* Scrollable restaurant list */}
      <ScrollView
        style={{ paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {restaurants.map((r, i) => (
          <Pressable
            key={r.id}
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              onSelect(r);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 12,
              borderTopWidth: i > 0 ? 1 : 0,
              borderTopColor: "#2a2a2a",
            }}
          >
            {/* Image */}
            <Image
              source={{ uri: r.image }}
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#2a2a2a",
              }}
              resizeMode="cover"
            />
            {/* Info */}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: "BricolageGrotesque_700Bold",
                  color: "#f5f5f5",
                  fontSize: 15,
                  letterSpacing: -0.2,
                  marginBottom: 2,
                }}
              >
                {r.name}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: "Manrope_500Medium",
                  color: "#999999",
                  fontSize: 12,
                }}
              >
                {r.cuisine}
              </Text>
            </View>
            {/* Wait badge */}
            <View
              style={{
                backgroundColor: STATUS_BG[r.waitStatus],
                borderRadius: 12,
                paddingHorizontal: 8,
                paddingVertical: 3,
                marginLeft: 8,
              }}
            >
              <Text
                style={{
                  fontFamily: "JetBrainsMono_600SemiBold",
                  color: STATUS_COLORS[r.waitStatus],
                  fontSize: 11,
                }}
              >
                {r.waitTime}m
              </Text>
            </View>
            {/* Distance */}
            <View style={{ marginLeft: 8 }}>
              <Text
                style={{
                  fontFamily: "Manrope_500Medium",
                  color: "#999999",
                  fontSize: 11,
                }}
              >
                {r.distance}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </RNAnimated.View>
  );
}

// ==========================================
// CLUSTER MARKER: combined card for grouped restaurants
// ==========================================
function ClusterMarker({ restaurants }: { restaurants: UIRestaurant[] }) {
  return (
    <View
      style={{
        backgroundColor: "#1a1a1a",
        borderRadius: 14,
        padding: 10,
        borderWidth: 1,
        borderColor: "#FF9933",
        width: 200,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 5,
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <View
          style={{
            backgroundColor: "rgba(255, 153, 51, 0.2)",
            borderRadius: 10,
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
        >
          <Text
            style={{
              fontFamily: "JetBrainsMono_600SemiBold",
              color: "#FF9933",
              fontSize: 11,
            }}
          >
            {restaurants.length} Nearby
          </Text>
        </View>
      </View>

      {/* List of restaurants (max 4) */}
      {restaurants.slice(0, 4).map((r, i) => (
        <View
          key={r.id}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 4,
            borderTopWidth: i > 0 ? 1 : 0,
            borderTopColor: "#2a2a2a",
          }}
        >
          {/* Status dot */}
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: STATUS_COLORS[r.waitStatus],
              marginRight: 6,
            }}
          />
          <Text
            numberOfLines={1}
            style={{
              fontFamily: "Manrope_600SemiBold",
              color: "#f5f5f5",
              fontSize: 11,
              flex: 1,
            }}
          >
            {r.name}
          </Text>
          <View
            style={{
              backgroundColor: STATUS_BG[r.waitStatus],
              borderRadius: 6,
              paddingHorizontal: 4,
              paddingVertical: 1,
              marginLeft: 4,
            }}
          >
            <Text
              style={{
                fontFamily: "JetBrainsMono_600SemiBold",
                color: STATUS_COLORS[r.waitStatus],
                fontSize: 9,
              }}
            >
              {r.waitTime}m
            </Text>
          </View>
        </View>
      ))}
      {restaurants.length > 4 && (
        <Text
          style={{
            fontFamily: "Manrope_500Medium",
            color: "#666",
            fontSize: 10,
            textAlign: "center",
            marginTop: 4,
          }}
        >
          +{restaurants.length - 4} more
        </Text>
      )}
    </View>
  );
}

// ==========================================
// MAP SEARCH OVERLAY — search restaurants, pan map to selection
// ==========================================
function MapSearchOverlay({
  restaurants,
  onClose,
  onSelect,
}: {
  restaurants: UIRestaurant[];
  onClose: () => void;
  onSelect: (r: UIRestaurant) => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return restaurants;
    const q = query.toLowerCase().trim();
    return restaurants.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.cuisine.toLowerCase().includes(q)
    );
  }, [query, restaurants]);

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "#0f0f0f",
        zIndex: 1000,
      }}
    >
      {/* Search Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          backgroundColor: "#0f0f0f",
          borderBottomWidth: 1,
          borderBottomColor: "#1a1a1a",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#1a1a1a",
              borderRadius: 16,
              borderWidth: 1.5,
              borderColor: "#FF9933",
              paddingHorizontal: 14,
              height: 50,
            }}
          >
            <Search size={20} color="#FF9933" />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder="Search restaurants..."
              placeholderTextColor="#666666"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={{
                flex: 1,
                marginLeft: 10,
                fontFamily: "Manrope_500Medium",
                color: "#f5f5f5",
                fontSize: 16,
                height: 50,
              }}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")} hitSlop={8}>
                <X size={16} color="#999999" />
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              onClose();
            }}
            style={{ marginLeft: 12, paddingVertical: 8, paddingHorizontal: 4 }}
          >
            <Text
              style={{
                fontFamily: "Manrope_600SemiBold",
                color: "#FF9933",
                fontSize: 15,
              }}
            >
              Cancel
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Results */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: insets.bottom + 40,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {query.trim() !== "" && results.length === 0 ? (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={{
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 60,
            }}
          >
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🔍</Text>
            <Text
              style={{
                fontFamily: "BricolageGrotesque_700Bold",
                color: "#f5f5f5",
                fontSize: 18,
                textAlign: "center",
                marginBottom: 6,
              }}
            >
              No results found
            </Text>
            <Text
              style={{
                fontFamily: "Manrope_500Medium",
                color: "#999999",
                fontSize: 14,
                textAlign: "center",
              }}
            >
              Try a different search term
            </Text>
          </Animated.View>
        ) : (
          <View>
            <Text
              style={{
                fontFamily: "Manrope_600SemiBold",
                color: "#999999",
                fontSize: 12,
                marginTop: 4,
                marginBottom: 12,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {query.trim()
                ? `${results.length} result${results.length !== 1 ? "s" : ""}`
                : "All Restaurants"}
            </Text>
            {results.map((r, index) => (
              <Animated.View
                key={r.id}
                entering={FadeInDown.delay(index * 30).duration(200)}
              >
                <Pressable
                  onPress={() => {
                    if (Platform.OS !== "web") {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    onSelect(r);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#1a1a1a",
                    borderRadius: 16,
                    padding: 12,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: "#2a2a2a",
                  }}
                >
                  {/* Image */}
                  <Image
                    source={{ uri: r.image }}
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#2a2a2a",
                    }}
                    resizeMode="cover"
                  />
                  {/* Info */}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: "BricolageGrotesque_700Bold",
                        color: "#f5f5f5",
                        fontSize: 16,
                        letterSpacing: -0.3,
                        marginBottom: 2,
                      }}
                    >
                      {r.name}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: "Manrope_500Medium",
                        color: "#999999",
                        fontSize: 12,
                        marginBottom: 4,
                      }}
                    >
                      {r.cuisine}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Clock size={11} color="#FF9933" />
                      <View
                        style={{
                          backgroundColor: STATUS_BG[r.waitStatus],
                          borderRadius: 8,
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                          marginLeft: 4,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "JetBrainsMono_600SemiBold",
                            color: STATUS_COLORS[r.waitStatus],
                            fontSize: 10,
                          }}
                        >
                          {r.waitTime} min
                        </Text>
                      </View>
                    </View>
                  </View>
                  {/* Distance */}
                  <View style={{ marginLeft: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <MapPin size={11} color="#999999" />
                      <Text
                        style={{
                          fontFamily: "Manrope_500Medium",
                          color: "#999999",
                          fontSize: 11,
                          marginLeft: 3,
                        }}
                      >
                        {r.distance}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
}
