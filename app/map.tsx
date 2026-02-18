import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
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
import { SafeAreaView } from "react-native-safe-area-context";
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
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { supabase } from "@/lib/supabase";
import {
  type SupabaseRestaurant,
  type UIRestaurant,
  type WaitStatus,
  mapSupabaseToUI,
} from "@/lib/restaurant-types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Zoom threshold: below this latDelta = "zoomed in" (show cards), above = "zoomed out" (show dots)
const ZOOM_THRESHOLD = 0.04;
// Clustering active only when zoomed in somewhat (approx < 8 miles span)
const CLUSTERING_THRESHOLD = 0.12;

// Clustering radius as a fraction of the visible latitude span
const CLUSTER_RADIUS_FACTOR = 0.25;

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
  latDelta: number
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
  lon2: number
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
  const [nearbyRestaurants, setNearbyRestaurants] = useState<UIRestaurant[]>([]);

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
          const updated = mapSupabaseToUI(
            payload.new as SupabaseRestaurant
          );
          setRestaurants((prev) =>
            prev.map((r) => (r.id === updated.id ? updated : r))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // ==============================
  // Preload restaurant images
  // ==============================
  useEffect(() => {
    if (restaurants.length > 0) {
      restaurants.forEach((r) => {
        if (r.image) {
          Image.prefetch(r.image).catch(() => {});
        }
      });
    }
  }, [restaurants]);

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

  // Restaurants with valid coordinates
  const mappableRestaurants = useMemo(
    () => restaurants.filter((r) => r.lat != null && r.long != null),
    [restaurants]
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
  }, [userLocation]);

  // Discover Nearby: find top 5 nearest, show list or zoom to single
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

    // Sort by distance, take top 5
    const withDist = mappableRestaurants.map((r) => ({
      restaurant: r,
      dist: haversineDistance(
        userLocation.latitude,
        userLocation.longitude,
        r.lat!,
        r.long!
      ),
    }));
    withDist.sort((a, b) => a.dist - b.dist);
    const topNearby = withDist.slice(0, 5).map((w) => w.restaurant);

    // Fit map to show all nearby restaurants
    const lats = topNearby.map((r) => r.lat!);
    const longs = topNearby.map((r) => r.long!);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLong = Math.min(...longs);
    const maxLong = Math.max(...longs);
    const centerLat = (minLat + maxLat) / 2;
    const centerLong = (minLong + maxLong) / 2;
    const spanLat = Math.max((maxLat - minLat) * 1.6, 0.008);
    const spanLong = Math.max((maxLong - minLong) * 1.6, 0.008);
    const fitRegion: Region = {
      latitude: centerLat,
      longitude: centerLong,
      latitudeDelta: spanLat,
      longitudeDelta: spanLong,
    };
    mapRef.current?.animateToRegion(fitRegion, 800);

    if (topNearby.length === 1) {
      setSelectedRestaurant(topNearby[0]);
    } else {
      // Prefetch images before showing overlay
      topNearby.forEach((r) => {
        if (r.image) Image.prefetch(r.image).catch(() => {});
      });
      setNearbyRestaurants(topNearby);
      // setTimeout 100ms to ensure map marker press event clears before state update
      setTimeout(() => setShowNearbyList(true), 100);
    }
  }, [userLocation, mappableRestaurants]);

  // Region change: track zoom level
  const handleRegionChange = useCallback((newRegion: Region) => {
    setRegion(newRegion);
    setIsZoomedIn(newRegion.latitudeDelta < ZOOM_THRESHOLD);
  }, []);

  // Restaurant press: navigate to detail
  const handleRestaurantPress = useCallback(
    (restaurant: UIRestaurant) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      router.push(`/restaurant/${restaurant.id}` as any);
    },
    [router]
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
        onRegionChange={handleRegionChange}
        showsUserLocation
        showsMyLocationButton={false}
        customMapStyle={darkMapStyle}
        userInterfaceStyle="dark"
      >
        {/* Conditional Clustering: Active only when zoomed in closer than threshold (~5-6 miles) */}
        {region.latitudeDelta < CLUSTERING_THRESHOLD
          ? // =================================
            // CLUSTERING ACTIVE
            // =================================
            clusterRestaurants(mappableRestaurants, region.latitudeDelta).map(
              (cluster) =>
                cluster.restaurants.length === 1 ? (
                  // Single Restaurant (Dot or Card based on Zoom)
                  <Marker
                    key={`single-${cluster.id}`}
                    coordinate={{
                      latitude: cluster.latitude,
                      longitude: cluster.longitude,
                    }}
                    onPress={() => {
                      if (isZoomedIn) {
                        // Start navigation directly if zoomed in (showing card)
                        handleRestaurantPress(cluster.restaurants[0]);
                      } else {
                        // Show popup if zoomed out (showing dot)
                        handleDotPress(cluster.restaurants[0]);
                      }
                    }}
                    tracksViewChanges={false}
                  >
                    {isZoomedIn ? (
                      <ZoomedInMarker restaurant={cluster.restaurants[0]} />
                    ) : (
                      <DotMarker
                        status={cluster.restaurants[0].waitStatus}
                        latDelta={region.latitudeDelta}
                      />
                    )}
                  </Marker>
                ) : (
                  // Cluster Group (Always Circle)
                  <Marker
                    key={`cluster-${cluster.id}`}
                    coordinate={{
                      latitude: cluster.latitude,
                      longitude: cluster.longitude,
                    }}
                    onPress={() => {
                      if (Platform.OS !== "web") {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                      // Prefetch images for this cluster
                      cluster.restaurants.forEach((r) => {
                        if (r.image) Image.prefetch(r.image).catch(() => {});
                      });
                      setNearbyRestaurants(cluster.restaurants);
                      setTimeout(() => setShowNearbyList(true), 100);
                    }}
                    tracksViewChanges={false}
                  >
                    <ClusterMarker restaurants={cluster.restaurants} />
                  </Marker>
                )
            )
          : // =================================
            // ZOOMED OUT FAR: Individual Dots (No Clustering)
            // =================================
            mappableRestaurants.map((restaurant) => (
              <Marker
                key={`dot-${restaurant.id}`}
                coordinate={{
                  latitude: restaurant.lat!,
                  longitude: restaurant.long!,
                }}
                onPress={() => handleDotPress(restaurant)}
                tracksViewChanges={false}
              >
                <DotMarker
                  status={restaurant.waitStatus}
                  latDelta={region.latitudeDelta}
                />
              </Marker>
            ))}
      </MapView>

      {/* Popup card when a pin is tapped (zoomed out) */}
      {!isZoomedIn && selectedRestaurant && (
        <Animated.View
          entering={FadeInUp.duration(250)}
          style={{
            position: "absolute",
            bottom: 40,
            left: 16,
            right: 16,
          }}
        >
          <Pressable
            onPress={() => handleRestaurantPress(selectedRestaurant)}
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
              source={{ uri: selectedRestaurant.image }}
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
                {selectedRestaurant.name}
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
                {selectedRestaurant.cuisine}
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
                    {selectedRestaurant.queueLength}
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
                      backgroundColor: STATUS_BG[selectedRestaurant.waitStatus],
                      borderRadius: 20,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      marginLeft: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "JetBrainsMono_600SemiBold",
                        color: STATUS_COLORS[selectedRestaurant.waitStatus],
                        fontSize: 11,
                      }}
                    >
                      {selectedRestaurant.waitTime} min
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
                  {selectedRestaurant.distance}
                </Text>
              </View>
            </View>
          </Pressable>
          {/* Dismiss */}
          <Pressable
            onPress={() => setSelectedRestaurant(null)}
            style={{ alignSelf: "center", marginTop: 8 }}
          >
            <Text
              style={{
                fontFamily: "Manrope_500Medium",
                color: "#666",
                fontSize: 12,
              }}
            >
              Dismiss
            </Text>
          </Pressable>
        </Animated.View>
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
                fontSize: 16,
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
            setShowNearbyList(false);
            router.push(`/restaurant/${r.id}` as any);
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
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#1a1a1a",
        borderRadius: 14,
        padding: 10,
        borderWidth: 1,
        borderColor: "#2a2a2a",
        width: 220,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 5,
      }}
    >
      {/* Thumbnail */}
      <Image
        source={{ uri: restaurant.image }}
        style={{
          width: 50,
          height: 50,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: "#2a2a2a",
        }}
        resizeMode="cover"
      />
      {/* Info */}
      <View style={{ flex: 1, marginLeft: 10 }}>
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
    </View>
  );
}

// ==========================================
// ZOOMED OUT MARKER: 3-ring pin
// outer = wait color, middle = black, center = white
// Size scales with zoom level
// ==========================================
function DotMarker({ status, latDelta }: { status: WaitStatus; latDelta: number }) {
  // Scale: pins stay large until quite zoomed out
  // latDelta range: ~0.04 (threshold) to ~0.5+ (zoomed way out)
  // At threshold (0.04) => scale 1.0, at 0.2 => ~0.7, clamp min 0.7
  const scale = Math.max(0.7, Math.min(1.0, 0.04 / Math.max(latDelta, 0.04)));
  const outerSize = Math.round(22 * scale);
  const middleSize = Math.round(14 * scale);
  const innerSize = Math.round(6 * scale);

  return (
    <View
      style={{
        width: outerSize,
        height: outerSize,
        borderRadius: outerSize / 2,
        backgroundColor: STATUS_COLORS[status], // outer ring color
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
          width: middleSize,
          height: middleSize,
          borderRadius: middleSize / 2,
          backgroundColor: "#111111",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* White center dot */}
        <View
          style={{
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            backgroundColor: "#ffffff",
          }}
        />
      </View>
    </View>
  );
}

// ==========================================
// NEARBY LIST OVERLAY — animated bottom sheet
// Uses RN's built-in Animated + PanResponder
// (NOT Reanimated — avoids transform conflicts)
// ==========================================
const SCREEN_HEIGHT = Dimensions.get("window").height;
const OVERLAY_HEIGHT = SCREEN_HEIGHT * 0.55;

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

  // PanResponder for swipe-down-to-dismiss
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
        if (g.dy > 80 || g.vy > 0.4) {
          // Swiped far or fast → dismiss smoothly (animate out)
          dismiss();
        } else {
          // Snap back smoothly
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
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: OVERLAY_HEIGHT,
        backgroundColor: "#1a1a1a",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 12,
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
      {/* Handle bar — visual drag indicator */}
      <View
        style={{
          width: 40,
          height: 5,
          borderRadius: 3,
          backgroundColor: "#555",
          alignSelf: "center",
          marginBottom: 12,
        }}
      />
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
function ClusterMarker({
  restaurants,
}: {
  restaurants: UIRestaurant[];
}) {
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
// Dark map style (Google Maps)
// ==========================================
const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#1d1d1d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1d1d1d" }] },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road",
    elementType: "geometry.fill",
    stylers: [{ color: "#2c2c2c" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1d1d1d" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.fill",
    stylers: [{ color: "#3a3a3a" }],
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0e0e0e" }],
  },
];
