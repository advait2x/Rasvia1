import React from "react";
import { View, Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { useEffect } from "react";

interface WaitBadgeProps {
  waitTime: number;
  status: "green" | "amber" | "red";
  size?: "sm" | "md" | "lg";
}

const statusColors = {
  green: { bg: "rgba(34, 197, 94, 0.2)", text: "#22C55E", glow: "#22C55E" },
  amber: { bg: "rgba(245, 158, 11, 0.2)", text: "#F59E0B", glow: "#F59E0B" },
  red: { bg: "rgba(239, 68, 68, 0.2)", text: "#EF4444", glow: "#EF4444" },
};

export function WaitBadge({ waitTime, status, size = "md" }: WaitBadgeProps) {
  const scale = useSharedValue(1);
  const colors = statusColors[status];

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000 }),
        withTiming(1.0, { duration: 1000 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const sizeClasses = {
    sm: "px-2 py-0.5",
    md: "px-3 py-1",
    lg: "px-4 py-1.5",
  };

  const textSizes = {
    sm: 11,
    md: 13,
    lg: 16,
  };

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          backgroundColor: colors.bg,
          borderRadius: 20,
          shadowColor: colors.glow,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 8,
          elevation: 4,
        },
      ]}
      className={sizeClasses[size]}
    >
      <Text
        style={{
          color: colors.text,
          fontFamily: "JetBrainsMono_600SemiBold",
          fontSize: textSizes[size],
        }}
      >
        {waitTime} min
      </Text>
    </Animated.View>
  );
}
