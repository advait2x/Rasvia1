import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

interface LocationContextType {
    userCoords: { latitude: number; longitude: number } | null;
    isLiveLocationEnabled: boolean;
    locationLabel: string | null;
    reloadLocationPrefs: () => Promise<void>;
    setUserCoordsOverride: (coords: {latitude: number; longitude: number} | null) => void;
}

const LocationContext = createContext<LocationContextType>({
    userCoords: null,
    isLiveLocationEnabled: true,
    locationLabel: null,
    reloadLocationPrefs: async () => {},
    setUserCoordsOverride: () => {},
});

async function reverseGeocodeLabel(coords: { latitude: number; longitude: number }): Promise<string | null> {
    try {
        const results = await Location.reverseGeocodeAsync(coords);
        if (results && results.length > 0) {
            const r = results[0];
            return r.city || null;
        }
    } catch {
        // silently ignore geocoding errors
    }
    return null;
}

/**
 * Extract the city from a Nominatim display_name string.
 * Format: "Name, Street, City, County, State, ZIP, Country"
 * The city is always the segment immediately before the "County" segment.
 */
function extractCity(address: string): string {
    const parts = address.split(",").map((p) => p.trim());
    const countyIdx = parts.findIndex((p) => /county|parish/i.test(p));
    if (countyIdx > 0) return parts[countyIdx - 1];
    // Fallback: second segment, or first if only one
    return parts[1] ?? parts[0];
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
    const { session } = useAuth();
    const [userCoords, setUserCoords] = useState<{
        latitude: number;
        longitude: number;
    } | null>(null);
    const [isLiveLocationEnabled, setIsLiveLocationEnabled] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [locationLabel, setLocationLabel] = useState<string | null>(null);
    const [savedAddress, setSavedAddress] = useState<string | null>(null);
    const liveRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const reloadLocationPrefs = useCallback(async () => {
        try {
            const localToggle = await AsyncStorage.getItem("live_location_enabled");
            let liveEnabled = true;
            if (localToggle !== null) {
                liveEnabled = JSON.parse(localToggle);
                setIsLiveLocationEnabled(liveEnabled);
            } else {
                setIsLiveLocationEnabled(true);
            }

            if (session?.user?.id) {
                const { data, error } = await supabase
                    .from("profiles")
                    .select("home_lat, home_long, saved_address")
                    .eq("id", session.user.id)
                    .maybeSingle();

                if (!error && data) {
                    const addr = data.saved_address || null;
                    setSavedAddress(addr);

                    if (data.home_lat && data.home_long) {
                        // Always set Supabase profile coordinates as the initial baseline/fallback
                        const coords = {
                            latitude: data.home_lat,
                            longitude: data.home_long,
                        };
                        setUserCoords(coords);

                        // If live location is off, use the city from saved address or reverse geocode
                        if (!liveEnabled) {
                            const label = addr ? extractCity(addr) : await reverseGeocodeLabel(coords);
                            setLocationLabel(label);
                        }
                    } else if (addr && !liveEnabled) {
                        // No coords but have a saved address string
                        setLocationLabel(extractCity(addr));
                    }
                }
            }
        } catch (err) {
            console.warn("Error fetching location prefs:", err);
        } finally {
            setIsLoaded(true);
        }
    }, [session]);

    useEffect(() => {
        reloadLocationPrefs();
    }, [reloadLocationPrefs]);

    useEffect(() => {
        if (!isLoaded) return;
        
        let subscription: Location.LocationSubscription | null = null;
        let isActive = true;

        // Clear any existing label refresh interval
        if (liveRefreshIntervalRef.current) {
            clearInterval(liveRefreshIntervalRef.current);
            liveRefreshIntervalRef.current = null;
        }

        if (!isLiveLocationEnabled) {
            return;
        }

        const updateCoordsAndLabel = async (coords: { latitude: number; longitude: number }) => {
            if (!isActive) return;
            setUserCoords(coords);
            const label = await reverseGeocodeLabel(coords);
            if (isActive && label) setLocationLabel(label);
        };

        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (!isActive || status !== "granted") {
                if (status !== "granted") console.warn("📍 Location permission denied");
                return;
            }

            try {
                // Get initial position with Balanced accuracy to reduce timeout/simulator exceptions
                let loc = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                
                if (!isActive) return;

                const coords = {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                };
                console.log(
                    `📍 User location: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`,
                    `\n   https://maps.google.com/?q=${coords.latitude},${coords.longitude}`,
                );
                await updateCoordsAndLabel(coords);

                // Watch for significant location changes (updates every ~150m movement)
                subscription = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.Balanced,
                        distanceInterval: 150, // meters before triggering update
                    },
                    (newLoc) => {
                        if (isActive) {
                            updateCoordsAndLabel({
                                latitude: newLoc.coords.latitude,
                                longitude: newLoc.coords.longitude,
                            });
                        }
                    },
                );

                // Refresh label every 30 seconds for live location
                liveRefreshIntervalRef.current = setInterval(async () => {
                    if (!isActive) return;
                    try {
                        const fresh = await Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.Balanced,
                        });
                        await updateCoordsAndLabel({
                            latitude: fresh.coords.latitude,
                            longitude: fresh.coords.longitude,
                        });
                    } catch {
                        // silently ignore periodic refresh errors
                    }
                }, 60_000);
            } catch (error) {
                console.warn("Location error, attempting fallback:", error);
                try {
                    const fallback = await Location.getLastKnownPositionAsync();
                    if (fallback && isActive) {
                        await updateCoordsAndLabel({
                            latitude: fallback.coords.latitude,
                            longitude: fallback.coords.longitude,
                        });
                    }
                } catch (fallbackErr) {
                    console.error("Total location failure:", fallbackErr);
                }
            }
        })();

        return () => {
            isActive = false;
            subscription?.remove();
            if (liveRefreshIntervalRef.current) {
                clearInterval(liveRefreshIntervalRef.current);
                liveRefreshIntervalRef.current = null;
            }
        };
    }, [isLiveLocationEnabled, isLoaded]);

    return (
        <LocationContext.Provider value={{ 
            userCoords, 
            isLiveLocationEnabled, 
            locationLabel,
            reloadLocationPrefs,
            setUserCoordsOverride: setUserCoords
        }}>
            {children}
        </LocationContext.Provider>
    );
}

export function useLocation() {
    return useContext(LocationContext);
}
