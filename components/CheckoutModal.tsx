import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    Pressable,
    Modal,
    ScrollView,
    TextInput,
    Alert,
    ActivityIndicator,
    Platform,
    KeyboardAvoidingView,
} from "react-native";
import {
    X,
    UtensilsCrossed,
    ShoppingBag,
    Clock,
    Truck,
    Minus,
    Plus,
    ChevronRight,
    CheckCircle2,
    Leaf,
    Coffee,
    Sun,
    Moon,
} from "lucide-react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { CartItem } from "@/data/mockData";
import type { OrderType, MealPeriod } from "@/lib/restaurant-types";

interface CheckoutModalProps {
    visible: boolean;
    restaurantId: string;
    restaurantName: string;
    cartItems: CartItem[];
    onClose: () => void;
    onOrderPlaced: (orderId: string, orderType: OrderType) => void;
    onUpdateQuantity: (itemId: string, delta: number) => void;
    /** Pre-select the order type (e.g. 'takeout' from the picker) */
    initialOrderType?: 'dine_in' | 'takeout';
    /** If customer is already on the waitlist — makes it a pre_order silently */
    waitlistEntryId?: string;
    /** If customer is already seated */
    isSeated?: boolean;
    existingOrderId?: string;
}

const MEAL_PERIODS: { key: MealPeriod; label: string; icon: any; color: string }[] = [
    { key: "breakfast", label: "Breakfast", icon: Coffee, color: "#F97316" },
    { key: "lunch",     label: "Lunch",     icon: Sun,    color: "#22C55E" },
    { key: "dinner",   label: "Dinner",     icon: Moon,   color: "#818CF8" },
];

const S = {
    card: {
        backgroundColor: "#1a1a1a",
        borderWidth: 1,
        borderColor: "#2a2a2a",
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    } as const,
    label: {
        fontFamily: "Manrope_600SemiBold",
        color: "#999",
        fontSize: 12,
        marginBottom: 6,
        textTransform: "uppercase" as const,
        letterSpacing: 0.5,
    },
    chip: (active: boolean, color = "#FF9933"): object => ({
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 20,
        borderWidth: 1,
        backgroundColor: active ? `${color}22` : "#0f0f0f",
        borderColor: active ? color : "#2a2a2a",
        marginRight: 8,
    }),
    chipText: (active: boolean, color = "#FF9933") => ({
        fontFamily: active ? "Manrope_700Bold" : "Manrope_500Medium",
        fontSize: 13,
        color: active ? color : "#777",
    }),
};

export function CheckoutModal({
    visible,
    restaurantId,
    restaurantName,
    cartItems,
    onClose,
    onOrderPlaced,
    onUpdateQuantity,
    initialOrderType,
    waitlistEntryId,
    isSeated = false,
    existingOrderId,
}: CheckoutModalProps) {
    const { session } = useAuth();

    // If we have a waitlist entry it's a silent pre_order; otherwise use initialOrderType or dine_in.
    const defaultType: OrderType = waitlistEntryId
        ? "pre_order"
        : (initialOrderType ?? "dine_in");

    const [orderType, setOrderType] = useState<OrderType>(defaultType);
    const [customerName, setCustomerName] = useState(
        session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || ""
    );
    const [mealPeriod, setMealPeriod] = useState<MealPeriod>("dinner");
    const [tableNumber, setTableNumber] = useState("");
    const [notes, setNotes] = useState("");
    const [placing, setPlacing] = useState(false);
    const [done, setDone] = useState(false);
    const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

    const subtotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);

    const reset = useCallback(() => {
        setOrderType(defaultType);
        setCustomerName(session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || "");
        setMealPeriod("dinner");
        setTableNumber("");
        setNotes("");
        setPlacing(false);
        setDone(false);
        setPlacedOrderId(null);
    }, [defaultType, session]);

    const handleClose = () => {
        reset();
        onClose();
    };

    const handlePlaceOrder = async () => {
        if (cartItems.length === 0) {
            Alert.alert("Empty Cart", "Add some items before placing an order.");
            return;
        }
        if (!session?.user?.id) {
            Alert.alert("Sign In Required", "Please sign in to place an order.");
            return;
        }

        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setPlacing(true);

        try {
            let orderId: string;

            if (existingOrderId) {
                // ── Adding to an existing order (seated add-on) ──
                orderId = existingOrderId;
                const newItems = cartItems.map((i) => ({
                    order_id: Number(existingOrderId),
                    menu_item_id: Number(i.id),
                    name: i.name,
                    price: i.price,
                    quantity: i.quantity,
                    is_vegetarian: i.isVegetarian,
                }));
                const { error: itemsErr } = await supabase.from("order_items").insert(newItems);
                if (itemsErr) throw itemsErr;

                // Recalculate subtotal
                const { data: allItems } = await supabase
                    .from("order_items")
                    .select("price, quantity")
                    .eq("order_id", Number(existingOrderId));
                const newSubtotal = (allItems || []).reduce(
                    (s: number, i: any) => s + Number(i.price) * i.quantity,
                    0
                );
                const { error: updErr } = await supabase
                    .from("orders")
                    .update({ subtotal: newSubtotal })
                    .eq("id", Number(existingOrderId));
                if (updErr) throw updErr;
            } else {
                // ── Brand new order ──
                const { data: orderData, error: orderErr } = await supabase
                    .from("orders")
                    .insert({
                        restaurant_id: Number(restaurantId),
                        table_number: tableNumber.trim() || null,
                        party_size: 1,
                        order_type: orderType,
                        status:
                            orderType === "takeout"
                                ? "preparing"
                                : orderType === "pre_order"
                                    ? "active"
                                    : "active",
                        meal_period: mealPeriod,
                        subtotal,
                        tip_amount: 0,
                        payment_method: "cash",
                        notes: notes.trim() || null,
                        waitlist_entry_id: waitlistEntryId || null,
                        customer_name: customerName.trim() || null,
                        created_by: session.user.id,
                    })
                    .select("id")
                    .single();

                if (orderErr) throw orderErr;
                orderId = orderData.id.toString();

                // Insert line items
                const items = cartItems.map((i) => ({
                    order_id: orderData.id,
                    menu_item_id: Number(i.id),
                    name: i.name,
                    price: i.price,
                    quantity: i.quantity,
                    is_vegetarian: i.isVegetarian,
                }));
                const { error: itemsErr } = await supabase.from("order_items").insert(items);
                if (itemsErr) throw itemsErr;
            }

            if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setPlacedOrderId(orderId);
            setDone(true);
            onOrderPlaced(orderId, orderType);
        } catch (err: any) {
            console.error("Order placement error:", err);
            Alert.alert("Error", err.message || "Could not place your order. Please try again.");
        } finally {
            setPlacing(false);
        }
    };

    // ────────────────────────────────────────────────────────────
    // SUCCESS SCREEN
    // ────────────────────────────────────────────────────────────
    if (done) {
        return (
            <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 24 }}>
                    <Animated.View
                        entering={FadeIn.duration(400)}
                        style={{ backgroundColor: "#1a1a1a", borderRadius: 24, padding: 32, alignItems: "center", width: "100%", borderWidth: 1, borderColor: "#2a2a2a" }}
                    >
                        <CheckCircle2 size={56} color="#22C55E" style={{ marginBottom: 16 }} />
                        <Text style={{ fontFamily: "BricolageGrotesque_800ExtraBold", color: "#f5f5f5", fontSize: 26, marginBottom: 8, textAlign: "center" }}>
                            Order Placed!
                        </Text>
                        <Text style={{ fontFamily: "Manrope_500Medium", color: "#999", fontSize: 15, textAlign: "center", marginBottom: 4 }}>
                            {orderType === "takeout"
                                ? `Your takeout order at ${restaurantName} is being prepared.`
                                : orderType === "pre_order"
                                    ? `Your pre-order at ${restaurantName} is confirmed! It'll arrive with your table.`
                                    : `Your order at ${restaurantName} has been received.`}
                        </Text>
                        {orderType === "takeout" && (
                            <View style={{ backgroundColor: "rgba(255,153,51,0.1)", borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: "rgba(255,153,51,0.2)", width: "100%" }}>
                                <Text style={{ fontFamily: "Manrope_600SemiBold", color: "#FF9933", fontSize: 13, textAlign: "center" }}>
                                    You'll be notified when your order is ready for pickup 🛍️
                                </Text>
                            </View>
                        )}
                        <Text style={{ fontFamily: "JetBrainsMono_600SemiBold", color: "#555", fontSize: 12, marginTop: 16 }}>
                            Order #{placedOrderId}
                        </Text>
                        <Pressable
                            onPress={handleClose}
                            style={{ marginTop: 24, backgroundColor: "#FF9933", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 }}
                        >
                            <Text style={{ fontFamily: "BricolageGrotesque_700Bold", color: "#0f0f0f", fontSize: 17 }}>Done</Text>
                        </Pressable>
                    </Animated.View>
                </View>
            </Modal>
        );
    }

    // ────────────────────────────────────────────────────────────
    // MAIN CHECKOUT SHEET
    // ────────────────────────────────────────────────────────────
    // Only show dine_in and takeout as user choices. pre_order is transparent (set via waitlistEntryId).
    const orderTypeOptions: { key: OrderType; label: string; icon: any; desc: string }[] = [
        { key: "dine_in", label: "Dine In", icon: UtensilsCrossed, desc: "At your table" },
        { key: "takeout", label: "Takeout", icon: Truck, desc: "Ready for pickup" },
    ];

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
                    <Pressable style={{ flex: 1 }} onPress={handleClose} />

                    <View
                        style={{
                            backgroundColor: "#0f0f0f",
                            borderTopLeftRadius: 28,
                            borderTopRightRadius: 28,
                            maxHeight: "92%",
                            borderTopWidth: 1,
                            borderTopColor: "#2a2a2a",
                        }}
                    >
                        {/* Handle */}
                        <View style={{ alignItems: "center", paddingTop: 12 }}>
                            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "#2a2a2a" }} />
                        </View>

                        {/* Header */}
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 }}>
                            <View>
                                <Text style={{ fontFamily: "BricolageGrotesque_800ExtraBold", color: "#f5f5f5", fontSize: 24 }}>
                                    {existingOrderId ? "Add to Order" : "Checkout"}
                                </Text>
                                <Text style={{ fontFamily: "Manrope_500Medium", color: "#777", fontSize: 13, marginTop: 2 }}>
                                    {restaurantName}
                                </Text>
                            </View>
                            <Pressable onPress={handleClose} style={{ backgroundColor: "#1a1a1a", width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#2a2a2a" }}>
                                <X size={18} color="#f5f5f5" />
                            </Pressable>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 40 }}>

                            {/* ── Order Type ── */}
                            {!existingOrderId && (
                                <Animated.View entering={FadeInDown.delay(50).duration(400)} style={S.card}>
                                    <Text style={S.label}>Order Type</Text>
                                    <View style={{ flexDirection: "row" }}>
                                        {orderTypeOptions.map(({ key, label, icon: Icon, desc }) => {
                                            const active = orderType === key;
                                            return (
                                                <Pressable
                                                    key={key}
                                                    onPress={() => {
                                                        if (Platform.OS !== "web") Haptics.selectionAsync();
                                                        setOrderType(key);
                                                    }}
                                                    style={{
                                                        flex: 1,
                                                        marginRight: key !== "takeout" ? 8 : 0,
                                                        backgroundColor: active ? "rgba(255,153,51,0.12)" : "#0f0f0f",
                                                        borderRadius: 14,
                                                        borderWidth: 1.5,
                                                        borderColor: active ? "#FF9933" : "#2a2a2a",
                                                        padding: 12,
                                                        alignItems: "center",
                                                    }}
                                                >
                                                    <Icon size={20} color={active ? "#FF9933" : "#666"} />
                                                    <Text style={{ fontFamily: "Manrope_700Bold", color: active ? "#FF9933" : "#f5f5f5", fontSize: 12, marginTop: 6 }}>{label}</Text>
                                                    <Text style={{ fontFamily: "Manrope_500Medium", color: "#666", fontSize: 10, marginTop: 2, textAlign: "center" }}>{desc}</Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                </Animated.View>
                            )}

                            {/* ── Customer Name ── */}
                            {!existingOrderId && (
                                <Animated.View entering={FadeInDown.delay(70).duration(400)} style={S.card}>
                                    <Text style={S.label}>Your Name</Text>
                                    <TextInput
                                        value={customerName}
                                        onChangeText={setCustomerName}
                                        placeholder="e.g. John Doe"
                                        placeholderTextColor="#555"
                                        style={{
                                            backgroundColor: "#0f0f0f",
                                            borderRadius: 12,
                                            borderWidth: 1,
                                            borderColor: customerName ? "#FF9933" : "#2a2a2a",
                                            paddingHorizontal: 14,
                                            paddingVertical: 12,
                                            color: "#f5f5f5",
                                            fontFamily: "Manrope_600SemiBold",
                                            fontSize: 15,
                                        }}
                                    />
                                </Animated.View>
                            )}

                            {/* ── Meal Period (dine-in / pre-order) ── */}
                            {orderType !== "takeout" && !existingOrderId && (
                                <Animated.View entering={FadeInDown.delay(80).duration(400)} style={S.card}>
                                    <Text style={S.label}>Meal Period</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        {MEAL_PERIODS.map(({ key, label, icon: Icon, color }) => {
                                            const active = mealPeriod === key;
                                            return (
                                                <Pressable
                                                    key={key}
                                                    onPress={() => {
                                                        if (Platform.OS !== "web") Haptics.selectionAsync();
                                                        setMealPeriod(key);
                                                    }}
                                                    style={S.chip(active, color)}
                                                >
                                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                                        <Icon size={13} color={active ? color : "#666"} />
                                                        <Text style={S.chipText(active, color)}>{label}</Text>
                                                    </View>
                                                </Pressable>
                                            );
                                        })}
                                    </ScrollView>
                                </Animated.View>
                            )}

                            {/* ── Table number (dine-in only) ── */}
                            {(orderType === "dine_in" || isSeated) && !existingOrderId && (
                                <Animated.View entering={FadeInDown.delay(100).duration(400)} style={S.card}>
                                    <Text style={S.label}>Table Number (optional)</Text>
                                    <TextInput
                                        value={tableNumber}
                                        onChangeText={setTableNumber}
                                        placeholder="e.g. 12"
                                        placeholderTextColor="#555"
                                        keyboardType="default"
                                        style={{
                                            backgroundColor: "#0f0f0f",
                                            borderRadius: 12,
                                            borderWidth: 1,
                                            borderColor: tableNumber ? "#FF9933" : "#2a2a2a",
                                            paddingHorizontal: 14,
                                            paddingVertical: 12,
                                            color: "#f5f5f5",
                                            fontFamily: "Manrope_600SemiBold",
                                            fontSize: 15,
                                        }}
                                    />
                                </Animated.View>
                            )}

                            {/* ── Cart Items ── */}
                            <Animated.View entering={FadeInDown.delay(120).duration(400)} style={S.card}>
                                <Text style={S.label}>Your Items ({cartItems.reduce((s, i) => s + i.quantity, 0)})</Text>
                                {cartItems.map((item, idx) => (
                                    <View
                                        key={item.id}
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            paddingVertical: 10,
                                            borderBottomWidth: idx < cartItems.length - 1 ? 1 : 0,
                                            borderBottomColor: "#222",
                                        }}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                                <Text style={{ fontFamily: "Manrope_700Bold", color: "#f5f5f5", fontSize: 14, flex: 1 }} numberOfLines={1}>
                                                    {item.name}
                                                </Text>
                                                {item.isVegetarian && <Leaf size={12} color="#22C55E" />}
                                            </View>
                                            <Text style={{ fontFamily: "JetBrainsMono_600SemiBold", color: "#FF9933", fontSize: 13, marginTop: 2 }}>
                                                ${(item.price * item.quantity).toFixed(2)}
                                            </Text>
                                        </View>
                                        {/* Quantity controls */}
                                        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#262626", borderRadius: 20, paddingHorizontal: 4, borderWidth: 1, borderColor: "#333" }}>
                                            <Pressable onPress={() => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onUpdateQuantity(item.id, -1); }} style={{ padding: 7 }}>
                                                <Minus size={13} color="#f5f5f5" />
                                            </Pressable>
                                            <Text style={{ fontFamily: "JetBrainsMono_600SemiBold", color: "#f5f5f5", fontSize: 13, minWidth: 22, textAlign: "center" }}>{item.quantity}</Text>
                                            <Pressable onPress={() => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onUpdateQuantity(item.id, 1); }} style={{ padding: 7 }}>
                                                <Plus size={13} color="#f5f5f5" />
                                            </Pressable>
                                        </View>
                                    </View>
                                ))}
                            </Animated.View>

                            {/* ── Notes ── */}
                            <Animated.View entering={FadeInDown.delay(140).duration(400)} style={S.card}>
                                <Text style={S.label}>Special Instructions (optional)</Text>
                                <TextInput
                                    value={notes}
                                    onChangeText={setNotes}
                                    placeholder="Allergies, preferences, requests..."
                                    placeholderTextColor="#555"
                                    multiline
                                    numberOfLines={3}
                                    style={{
                                        backgroundColor: "#0f0f0f",
                                        borderRadius: 12,
                                        borderWidth: 1,
                                        borderColor: notes ? "#FF9933" : "#2a2a2a",
                                        paddingHorizontal: 14,
                                        paddingVertical: 12,
                                        color: "#f5f5f5",
                                        fontFamily: "Manrope_500Medium",
                                        fontSize: 14,
                                        minHeight: 72,
                                        textAlignVertical: "top",
                                    }}
                                />
                            </Animated.View>

                            {/* ── Summary ── */}
                            <Animated.View entering={FadeInDown.delay(160).duration(400)} style={{ ...S.card, marginBottom: 20 }}>
                                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                                    <Text style={{ fontFamily: "Manrope_600SemiBold", color: "#999", fontSize: 14 }}>Subtotal</Text>
                                    <Text style={{ fontFamily: "JetBrainsMono_600SemiBold", color: "#f5f5f5", fontSize: 16 }}>${subtotal.toFixed(2)}</Text>
                                </View>
                                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                    <Text style={{ fontFamily: "Manrope_600SemiBold", color: "#999", fontSize: 14 }}>Payment</Text>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                        <Text style={{ fontFamily: "Manrope_700Bold", color: "#22C55E", fontSize: 14 }}>Cash ✓</Text>
                                    </View>
                                </View>
                            </Animated.View>

                            {/* ── Place Order Button ── */}
                            <Pressable
                                onPress={handlePlaceOrder}
                                disabled={placing || cartItems.length === 0 || (!existingOrderId && !customerName.trim())}
                                style={{
                                    backgroundColor: (cartItems.length === 0 || (!existingOrderId && !customerName.trim())) ? "#333" : "#FF9933",
                                    borderRadius: 18,
                                    paddingVertical: 17,
                                    alignItems: "center",
                                    flexDirection: "row",
                                    justifyContent: "center",
                                    gap: 10,
                                    opacity: placing ? 0.8 : 1,
                                    shadowColor: "#FF9933",
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: cartItems.length > 0 ? 0.3 : 0,
                                    shadowRadius: 12,
                                    elevation: cartItems.length > 0 ? 8 : 0,
                                }}
                            >
                                {placing ? (
                                    <ActivityIndicator color="#0f0f0f" />
                                ) : (
                                    <>
                                        {orderType === "takeout"
                                            ? <Truck size={18} color="#0f0f0f" />
                                            : orderType === "pre_order"
                                                ? <Clock size={18} color="#0f0f0f" />
                                                : <ShoppingBag size={18} color="#0f0f0f" />}
                                        <Text style={{ fontFamily: "BricolageGrotesque_700Bold", color: "#0f0f0f", fontSize: 17 }}>
                                            {existingOrderId
                                                ? `Add Items · $${subtotal.toFixed(2)}`
                                                : orderType === "takeout"
                                                    ? `Place Takeout · $${subtotal.toFixed(2)}`
                                                    : orderType === "pre_order"
                                                        ? `Pre-Order · $${subtotal.toFixed(2)}`
                                                        : `Place Order · $${subtotal.toFixed(2)}`}
                                        </Text>
                                    </>
                                )}
                            </Pressable>
                        </ScrollView>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
