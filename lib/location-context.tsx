import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

interface LocationContextType {
    userCoords: { latitude: number; longitude: number } | null;
    isLiveLocationEnabled: boolean;
    reloadLocationPrefs: () => Promise<void>;
    setUserCoordsOverride: (coords: {latitude: number; longitude: number} | null) => void;
}

const LocationContext = createContext<LocationContextType>({
    userCoords: null,
    isLiveLocationEnabled: true,
    reloadLocationPrefs: async () => {},
    setUserCoordsOverride: () => {},
});

export function LocationProvider({ children }: { children: React.ReactNode }) {
    const { session } = useAuth();
    const [userCoords, setUserCoords] = useState<{
        latitude: number;
        longitude: number;
    } | null>(null);
    const [isLiveLocationEnabled, setIsLiveLocationEnabled] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

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
                    .select("home_lat, home_long")
                    .eq("id", session.user.id)
                    .maybeSingle();

                if (!error && data && data.home_lat && data.home_long) {
                    // Always set Supabase profile coordinates as the initial baseline/fallback
                    setUserCoords({
                        latitude: data.home_lat,
                        longitude: data.home_long,
                    });
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

        if (!isLiveLocationEnabled) {
            return;
        }

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
                setUserCoords(coords);

                // Watch for significant location changes (updates every ~100m movement)
                subscription = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.Balanced,
                        distanceInterval: 150, // meters before triggering update
                    },
                    (newLoc) => {
                        if (isActive) {
                            setUserCoords({
                                latitude: newLoc.coords.latitude,
                                longitude: newLoc.coords.longitude,
                            });
                        }
                    },
                );
            } catch (error) {
                console.warn("Location error, attempting fallback:", error);
                try {
                    const fallback = await Location.getLastKnownPositionAsync();
                    if (fallback && isActive) {
                        setUserCoords({
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
        };
    }, [isLiveLocationEnabled, isLoaded]);

    return (
        <LocationContext.Provider value={{ 
            userCoords, 
            isLiveLocationEnabled, 
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
