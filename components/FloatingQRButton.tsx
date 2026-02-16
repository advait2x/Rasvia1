import React from "react";
import { Pressable, View, Text } from "react-native";
import { QrCode } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeIn,
} from "react-native-reanimated";

interface FloatingQRButtonProps {
  onPress: () => void;
  cartCount?: number;
}

export function FloatingQRButton({ onPress, cartCount }: FloatingQRButtonProps) {
  const pressScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.delay(800).duration(400)}
      style={[
        animatedStyle,
        {
          position: "absolute",
          bottom: 28,
          right: 20,
          zIndex: 50,
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          pressScale.value = withSpring(0.9);
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1);
        }}
        style={{
          backgroundColor: "#FF9933",
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#FF9933",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <QrCode size={26} color="#0f0f0f" strokeWidth={2.5} />
      </Pressable>

      {cartCount !== undefined && cartCount > 0 && (
        <View
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            backgroundColor: "#EF4444",
            width: 22,
            height: 22,
            borderRadius: 11,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: "#0f0f0f",
          }}
        >
          <Text
            style={{
              fontFamily: "JetBrainsMono_600SemiBold",
              color: "#fff",
              fontSize: 10,
            }}
          >
            {cartCount}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}
