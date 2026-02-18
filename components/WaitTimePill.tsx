import React from "react";
import { View, Text } from "react-native";
import { Star } from "lucide-react-native";

// ==========================================
// HELPERS
// ==========================================
function getPillColor(waitTime: number): string {
    if (waitTime < 15) return "#10B981";
    if (waitTime <= 45) return "#F59E0B";
    return "#E11D48";
}

// ==========================================
// INDIVIDUAL MARKER (zoomed in) — name, time, rating
// ==========================================
interface WaitTimePillProps {
    name: string;
    waitTime: number;
    rating?: number;
}

export function WaitTimePill({ name, waitTime, rating }: WaitTimePillProps) {
    const bgColor = getPillColor(waitTime);
    const displayName = name.length > 14 ? name.slice(0, 13) + "…" : name;

    return (
        <View style={{ alignItems: "center" }}>
            <View
                style={{
                    backgroundColor: bgColor,
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                    borderRadius: 14,
                    shadowColor: bgColor,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.5,
                    shadowRadius: 6,
                    elevation: 6,
                    alignItems: "center",
                    minWidth: 70,
                }}
            >
                {/* Restaurant name */}
                <Text
                    numberOfLines={1}
                    style={{
                        fontFamily: "Manrope_700Bold",
                        color: "#FFFFFF",
                        fontSize: 11,
                        letterSpacing: 0.1,
                    }}
                >
                    {displayName}
                </Text>

                {/* Wait time */}
                <Text
                    style={{
                        fontFamily: "JetBrainsMono_600SemiBold",
                        color: "rgba(255,255,255,0.9)",
                        fontSize: 10,
                        marginTop: 1,
                    }}
                >
                    {waitTime} min
                </Text>

                {/* Rating row (only when zoomed in) */}
                {rating != null && (
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginTop: 3,
                            backgroundColor: "rgba(0,0,0,0.2)",
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 8,
                        }}
                    >
                        <Star
                            size={9}
                            color="#FFFFFF"
                            fill="#FFFFFF"
                        />
                        <Text
                            style={{
                                fontFamily: "Manrope_600SemiBold",
                                color: "#FFFFFF",
                                fontSize: 9,
                                marginLeft: 3,
                            }}
                        >
                            {rating.toFixed(1)}
                        </Text>
                    </View>
                )}
            </View>

            {/* Triangle pointer */}
            <View
                style={{
                    width: 0,
                    height: 0,
                    borderLeftWidth: 6,
                    borderRightWidth: 6,
                    borderTopWidth: 6,
                    borderLeftColor: "transparent",
                    borderRightColor: "transparent",
                    borderTopColor: bgColor,
                    marginTop: -1,
                }}
            />
        </View>
    );
}

// ==========================================
// CLUSTER LIST CARD (zoomed out) — shows all restaurants
// ==========================================
interface ClusterRestaurant {
    name: string;
    current_wait_time: number;
}

interface ClusterPillProps {
    restaurants: ClusterRestaurant[];
}

export function ClusterPill({ restaurants }: ClusterPillProps) {
    return (
        <View style={{ alignItems: "center" }}>
            <View
                style={{
                    backgroundColor: "#1a1a1a",
                    borderWidth: 1.5,
                    borderColor: "#FF9933",
                    borderRadius: 16,
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    shadowColor: "#FF9933",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 6,
                    minWidth: 130,
                    maxWidth: 170,
                }}
            >
                {restaurants.map((r, i) => (
                    <View
                        key={i}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingVertical: 3,
                            borderBottomWidth: i < restaurants.length - 1 ? 1 : 0,
                            borderBottomColor: "#2a2a2a",
                        }}
                    >
                        {/* Name */}
                        <Text
                            numberOfLines={1}
                            style={{
                                fontFamily: "Manrope_600SemiBold",
                                color: "#f5f5f5",
                                fontSize: 10,
                                flex: 1,
                                marginRight: 6,
                            }}
                        >
                            {r.name.length > 14
                                ? r.name.slice(0, 13) + "…"
                                : r.name}
                        </Text>

                        {/* Wait time badge */}
                        <View
                            style={{
                                backgroundColor: getPillColor(
                                    r.current_wait_time
                                ),
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: 8,
                            }}
                        >
                            <Text
                                style={{
                                    fontFamily: "JetBrainsMono_600SemiBold",
                                    color: "#FFFFFF",
                                    fontSize: 9,
                                }}
                            >
                                {r.current_wait_time}m
                            </Text>
                        </View>
                    </View>
                ))}
            </View>

            {/* Triangle pointer */}
            <View
                style={{
                    width: 0,
                    height: 0,
                    borderLeftWidth: 6,
                    borderRightWidth: 6,
                    borderTopWidth: 6,
                    borderLeftColor: "transparent",
                    borderRightColor: "transparent",
                    borderTopColor: "#1a1a1a",
                    marginTop: -1,
                }}
            />
        </View>
    );
}
