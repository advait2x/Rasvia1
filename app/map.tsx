import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
    View,
    Text,
    Pressable,
    Platform,
    ActivityIndicator,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import MapView, { Marker, Callout, PROVIDER_GOOGLE, Region } from "react-native-maps";
import * as Location from "expo-location";
import { ArrowLeft, Navigation } from "lucide-react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { type SupabaseRestaurant } from "@/lib/restaurant-types";
import { WaitTimePill, ClusterPill } from "@/components/WaitTimePill";
import { MapCalloutCard } from "@/components/MapCalloutCard";

// ==========================================
// DARK MAP STYLE
// ==========================================
const DARK_MAP_STYLE = [
    { elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#666666" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a1a" }] },
    {
        featureType: "administrative",
        elementType: "geometry",
        stylers: [{ color: "#333333" }],
    },
    {
        featureType: "poi",
        stylers: [{ visibility: "off" }],
    },
    {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#2a2a2a" }],
    },
    {
        featureType: "road",
        elementType: "geometry.stroke",
        stylers: [{ color: "#333333" }],
    },
    {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [{ color: "#333333" }],
    },
    {
        featureType: "transit",
        stylers: [{ visibility: "off" }],
    },
    {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#0f0f0f" }],
    },
    {
        featureType: "road",
        elementType: "labels",
        stylers: [{ visibility: "off" }],
    },
];

// ==========================================
// REGIONS & BOUNDARIES
// ==========================================
const FRISCO_REGION: Region = {
    latitude: 33.1507,
    longitude: -96.8236,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
};


// Clustering threshold — when latitudeDelta exceeds this, start clustering
const CLUSTER_DELTA_THRESHOLD = 0.06;
// Distance in degrees to consider two markers "close" for clustering
const CLUSTER_PROXIMITY = 0.015;

// ==========================================
// TYPES
// ==========================================
interface MapRestaurant {
    id: number;
    name: string;
    lat: number;
    long: number;
    current_wait_time: number;
    image_url: string | null;
    rating: number;
}

interface Cluster {
    id: string;
    latitude: number;
    longitude: number;
    restaurants: MapRestaurant[];
}

// ==========================================
// HELPERS
// ==========================================
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
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function clusterRestaurants(
    restaurants: MapRestaurant[],
    proximity: number
): Cluster[] {
    const used = new Set<number>();
    const clusters: Cluster[] = [];

    for (const r of restaurants) {
        if (used.has(r.id)) continue;

        const group: MapRestaurant[] = [r];
        used.add(r.id);

        for (const other of restaurants) {
            if (used.has(other.id)) continue;
            const dist = Math.sqrt(
                Math.pow(r.lat - other.lat, 2) + Math.pow(r.long - other.long, 2)
            );
            if (dist < proximity) {
                group.push(other);
                used.add(other.id);
            }
        }

        // Calculate centroid
        const avgLat = group.reduce((s, g) => s + g.lat, 0) / group.length;
        const avgLong = group.reduce((s, g) => s + g.long, 0) / group.length;

        clusters.push({
            id: `cluster-${group.map((g) => g.id).join("-")}`,
            latitude: avgLat,
            longitude: avgLong,
            restaurants: group,
        });
    }

    return clusters;
}

// ==========================================
// COMPONENT
// ==========================================
export default function MapDiscoveryScreen() {
    const router = useRouter();
    const mapRef = useRef<MapView>(null);

    const [restaurants, setRestaurants] = useState<MapRestaurant[]>([]);
    const [loading, setLoading] = useState(true);
    const [userLocation, setUserLocation] = useState<{
        latitude: number;
        longitude: number;
    } | null>(null);
    const [tracksChanges, setTracksChanges] = useState(true);
    const [currentDelta, setCurrentDelta] = useState(FRISCO_REGION.latitudeDelta);

    // Determine whether to cluster based on zoom level
    const shouldCluster = currentDelta > CLUSTER_DELTA_THRESHOLD;

    const clusters = useMemo(() => {
        if (!shouldCluster) return null;
        return clusterRestaurants(restaurants, CLUSTER_PROXIMITY);
    }, [restaurants, shouldCluster]);

    // ======================
    // FETCH RESTAURANTS
    // ======================
    useEffect(() => {
        fetchRestaurants();

        const subscription = supabase
            .channel("map:restaurants")
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "restaurants" },
                (payload) => {
                    const updated = payload.new as SupabaseRestaurant;
                    if (updated.lat != null && updated.long != null) {
                        setRestaurants((prev) =>
                            prev.map((r) =>
                                r.id === updated.id
                                    ? {
                                        ...r,
                                        current_wait_time:
                                            updated.current_wait_time,
                                        name: updated.name,
                                        image_url: updated.image_url,
                                        rating: updated.rating,
                                    }
                                    : r
                            )
                        );
                        setTracksChanges(true);
                        setTimeout(() => setTracksChanges(false), 500);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, []);

    async function fetchRestaurants() {
        try {
            const { data, error } = await supabase
                .from("restaurants")
                .select(
                    "id, name, lat, long, current_wait_time, image_url, rating"
                );

            if (error) throw error;

            if (data) {
                const withLocation = data.filter(
                    (r: any) => r.lat != null && r.long != null
                ) as MapRestaurant[];
                setRestaurants(withLocation);
            }
        } catch (err) {
            console.error("Map fetch error:", err);
        } finally {
            setLoading(false);
            setTimeout(() => setTracksChanges(false), 1000);
        }
    }

    // ======================
    // USER LOCATION
    // ======================
    useEffect(() => {
        (async () => {
            const { status } =
                await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") return;

            const loc = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            const coords = {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
            };
            setUserLocation(coords);

            mapRef.current?.animateToRegion(
                {
                    ...coords,
                    latitudeDelta: 0.04,
                    longitudeDelta: 0.04,
                },
                1000
            );
        })();
    }, []);


    // ======================
    // NAVIGATE TO NEAREST
    // ======================
    const handleNearestPress = useCallback(() => {
        if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        if (!userLocation) {
            Alert.alert(
                "Location Required",
                "Please enable location services to find the nearest restaurant.",
                [{ text: "OK" }]
            );
            return;
        }

        if (restaurants.length === 0) return;

        let nearest = restaurants[0];
        let minDist = Infinity;

        for (const r of restaurants) {
            const d = haversineDistance(
                userLocation.latitude,
                userLocation.longitude,
                r.lat,
                r.long
            );
            if (d < minDist) {
                minDist = d;
                nearest = r;
            }
        }

        router.push(`/restaurant/${nearest.id}` as any);
    }, [userLocation, restaurants, router]);

    // ======================
    // HANDLE REGION CHANGE
    // ======================
    const handleRegionChange = useCallback((region: Region) => {
        setCurrentDelta(region.latitudeDelta);
    }, []);

    // ======================
    // ZOOM INTO CLUSTER
    // ======================
    const handleClusterPress = useCallback((cluster: Cluster) => {
        if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        const lats = cluster.restaurants.map((r) => r.lat);
        const longs = cluster.restaurants.map((r) => r.long);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLong = Math.min(...longs);
        const maxLong = Math.max(...longs);

        mapRef.current?.animateToRegion(
            {
                latitude: (minLat + maxLat) / 2,
                longitude: (minLong + maxLong) / 2,
                latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.02),
                longitudeDelta: Math.max((maxLong - minLong) * 1.5, 0.02),
            },
            600
        );
    }, []);

    return (
        <View style={{ flex: 1, backgroundColor: "#0f0f0f" }}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Map */}
            <MapView
                ref={mapRef}
                style={{ flex: 1 }}
                provider={
                    Platform.OS === "android" ? PROVIDER_GOOGLE : undefined
                }
                initialRegion={FRISCO_REGION}
                customMapStyle={DARK_MAP_STYLE}
                showsUserLocation={true}
                showsMyLocationButton={false}
                showsCompass={false}
                showsScale={false}
                showsPointsOfInterest={false}
                userInterfaceStyle="dark"

                onRegionChangeComplete={handleRegionChange}
            >
                {shouldCluster && clusters
                    ? // ---- CLUSTERED VIEW ----
                    clusters.map((cluster) =>
                        cluster.restaurants.length === 1 ? (
                            // Single restaurant in "cluster" — show normal pill
                            <Marker
                                key={cluster.restaurants[0].id}
                                coordinate={{
                                    latitude: cluster.restaurants[0].lat,
                                    longitude: cluster.restaurants[0].long,
                                }}
                                tracksViewChanges={tracksChanges}
                            >
                                <WaitTimePill
                                    name={cluster.restaurants[0].name}
                                    waitTime={
                                        cluster.restaurants[0]
                                            .current_wait_time
                                    }
                                />
                                <Callout
                                    tooltip
                                    onPress={() => {
                                        if (Platform.OS !== "web") {
                                            Haptics.impactAsync(
                                                Haptics.ImpactFeedbackStyle
                                                    .Light
                                            );
                                        }
                                        router.push(
                                            `/restaurant/${cluster.restaurants[0].id}` as any
                                        );
                                    }}
                                >
                                    <MapCalloutCard
                                        name={cluster.restaurants[0].name}
                                        rating={cluster.restaurants[0].rating}
                                        imageUrl={
                                            cluster.restaurants[0]
                                                .image_url ||
                                            "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80"
                                        }
                                    />
                                </Callout>
                            </Marker>
                        ) : (
                            // Actual cluster — show cluster pill
                            <Marker
                                key={cluster.id}
                                coordinate={{
                                    latitude: cluster.latitude,
                                    longitude: cluster.longitude,
                                }}
                                tracksViewChanges={tracksChanges}
                                onPress={() => handleClusterPress(cluster)}
                            >
                                <ClusterPill
                                    restaurants={cluster.restaurants}
                                />
                            </Marker>
                        )
                    )
                    : // ---- INDIVIDUAL VIEW ----
                    restaurants.map((restaurant) => (
                        <Marker
                            key={restaurant.id}
                            coordinate={{
                                latitude: restaurant.lat,
                                longitude: restaurant.long,
                            }}
                            tracksViewChanges={tracksChanges}
                        >
                            <WaitTimePill
                                name={restaurant.name}
                                waitTime={restaurant.current_wait_time}
                                rating={restaurant.rating}
                            />
                            <Callout
                                tooltip
                                onPress={() => {
                                    if (Platform.OS !== "web") {
                                        Haptics.impactAsync(
                                            Haptics.ImpactFeedbackStyle.Light
                                        );
                                    }
                                    router.push(
                                        `/restaurant/${restaurant.id}` as any
                                    );
                                }}
                            >
                                <MapCalloutCard
                                    name={restaurant.name}
                                    rating={restaurant.rating}
                                    imageUrl={
                                        restaurant.image_url ||
                                        "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80"
                                    }
                                />
                            </Callout>
                        </Marker>
                    ))}
            </MapView>

            {/* Overlay Controls */}
            <SafeAreaView
                edges={["top"]}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                }}
                pointerEvents="box-none"
            >
                <Animated.View
                    entering={FadeIn.duration(400)}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingHorizontal: 16,
                        paddingTop: 8,
                    }}
                >
                    {/* Back Button */}
                    <Pressable
                        onPress={() => {
                            if (Platform.OS !== "web") {
                                Haptics.impactAsync(
                                    Haptics.ImpactFeedbackStyle.Light
                                );
                            }
                            router.back();
                        }}
                        style={{
                            backgroundColor: "rgba(26, 26, 26, 0.9)",
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 1,
                            borderColor: "#2a2a2a",
                        }}
                    >
                        <ArrowLeft size={22} color="#f5f5f5" />
                    </Pressable>

                    {/* Title Badge */}
                    <View
                        style={{
                            backgroundColor: "rgba(26, 26, 26, 0.9)",
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: "#2a2a2a",
                        }}
                    >
                        <Text
                            style={{
                                fontFamily: "BricolageGrotesque_700Bold",
                                color: "#f5f5f5",
                                fontSize: 15,
                            }}
                        >
                            Discover Nearby
                        </Text>
                    </View>

                    {/* Nearest Restaurant Button */}
                    <Pressable
                        onPress={handleNearestPress}
                        style={{
                            backgroundColor: "rgba(26, 26, 26, 0.9)",
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 1,
                            borderColor: "#2a2a2a",
                        }}
                    >
                        <Navigation size={20} color="#FF9933" />
                    </Pressable>
                </Animated.View>
            </SafeAreaView>

            {/* Loading Overlay */}
            {loading && (
                <View
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(15, 15, 15, 0.6)",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <ActivityIndicator size="large" color="#FF9933" />
                </View>
            )}
        </View>
    );
}
