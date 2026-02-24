import React from 'react';
import { View, Text } from 'react-native';
import type { RestaurantStatusResult, RestaurantOpenStatus } from '@/lib/restaurant-hours';

interface HoursStatusBadgeProps {
    statusResult: RestaurantStatusResult | null;
    /** 'sm' = compact (for cards/lists), 'md' = default, 'lg' = hero/detail view */
    size?: 'sm' | 'md' | 'lg';
}

const STATUS_COLORS: Record<RestaurantOpenStatus, { dot: string; bg: string; text: string }> = {
    open: { dot: '#22C55E', bg: 'rgba(34,197,94,0.12)', text: '#22C55E' },
    opening_soon: { dot: '#F59E0B', bg: 'rgba(245,158,11,0.12)', text: '#F59E0B' },
    closed: { dot: '#EF4444', bg: 'rgba(239,68,68,0.12)', text: '#EF4444' },
};

const FONT_SIZES = { sm: 10, md: 12, lg: 13 } as const;
const DOT_SIZES = { sm: 5, md: 6, lg: 7 } as const;
const H_PADDING = { sm: 6, md: 8, lg: 10 } as const;
const V_PADDING = { sm: 2, md: 3, lg: 4 } as const;

/**
 * Displays a coloured pill showing whether a restaurant is Open, Closed, or Opening Soon.
 *
 * Usage:
 *   <HoursStatusBadge statusResult={statusResult} size="md" />
 */
export function HoursStatusBadge({ statusResult, size = 'md' }: HoursStatusBadgeProps) {
    if (!statusResult) return null;

    const { status, label } = statusResult;
    const colors = STATUS_COLORS[status];
    const fontSize = FONT_SIZES[size];
    const dotSize = DOT_SIZES[size];
    const hPad = H_PADDING[size];
    const vPad = V_PADDING[size];

    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'flex-start',
                backgroundColor: colors.bg,
                borderRadius: 20,
                paddingHorizontal: hPad,
                paddingVertical: vPad,
                gap: 5,
            }}
        >
            {/* Pulsing dot — solid for now, easy to animate with Reanimated if desired */}
            <View
                style={{
                    width: dotSize,
                    height: dotSize,
                    borderRadius: dotSize / 2,
                    backgroundColor: colors.dot,
                }}
            />
            <Text
                style={{
                    fontFamily: 'Manrope_600SemiBold',
                    color: colors.text,
                    fontSize,
                }}
                numberOfLines={1}
            >
                {label}
            </Text>
        </View>
    );
}
