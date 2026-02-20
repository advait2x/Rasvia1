import React, { createContext, useContext, useEffect, useState } from "react";
import * as Location from "expo-location";

interface LocationContextType {
    userCoords: { latitude: number; longitude: number } | null;
}

const LocationContext = createContext<LocationContextType>({
    userCoords: null,
});

export function LocationProvider({ children }: { children: React.ReactNode }) {
    const [userCoords, setUserCoords] = useState<{
        latitude: number;
        longitude: number;
    } | null>(null);

    useEffect(() => {
        let subscription: Location.LocationSubscription | null = null;

        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") {
                console.warn("📍 Location permission denied");
                return;
            }

            // Get initial position with HIGH accuracy
            const loc = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });
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
                    setUserCoords({
                        latitude: newLoc.coords.latitude,
                        longitude: newLoc.coords.longitude,
                    });
                },
            );
        })();

        return () => {
            subscription?.remove();
        };
    }, []);

    return (
        <LocationContext.Provider value={{ userCoords }}>
            {children}
        </LocationContext.Provider>
    );
}

export function useLocation() {
    return useContext(LocationContext);
}
