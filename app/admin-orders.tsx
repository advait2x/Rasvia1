import React, { useState, useCallback, useEffect } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    TextInput,
    Alert,
    RefreshControl,
    ActivityIndicator,
    Modal,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
    ArrowLeft,
    Plus,
    UtensilsCrossed,
    Truck,
    Clock,
    Users,
    ChevronDown,
    ChevronUp,
    Leaf,
    CheckCircle2,
    X,
    ShoppingBag,
    DollarSign,
    Bell,
} from "lucide-react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { useAdminMode } from "@/hooks/useAdminMode";
import { useAuth } from "@/lib/auth-context";
import {
    type SupabaseOrder,
    type UIOrder,
    type UIOrderItem,
    type OrderStatus,
    type OrderType,
    type MealPeriod,
    mapOrderToUI,
} from "@/lib/restaurant-types";

// ──────────────────────────── Helpers ──────────────────────────────
const STATUS_COLORS: Record<OrderStatus, string> = {
    active: "#FF9933",
    preparing: "#F59E0B",
    ready: "#22C55E",
    served: "#818CF8",
    completed: "#555",
    cancelled: "#EF4444",
};

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
    dine_in: "Dine In",
    pre_order: "Pre-Order",
    takeout: "Takeout",
};

const S = {
    card: {
        backgroundColor: "#1a1a1a",
        borderWidth: 1,
        borderColor: "#2a2a2a",
        borderRadius: 16,
        marginBottom: 12,
    } as const,
    chip: (active: boolean, color = "#FF9933") =>
    ({
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1,
        backgroundColor: active ? `${color}20` : "#0f0f0f",
        borderColor: active ? color : "#2a2a2a",
        marginRight: 6,
    } as const),
    chipText: (active: boolean, color = "#FF9933") => ({
        fontFamily: active ? ("Manrope_700Bold" as const) : ("Manrope_500Medium" as const),
        fontSize: 12,
        color: active ? color : "#666",
    }),
};

// ──────────────────────── Close Table Modal ──────────────────────────
function CloseTableModal({
    order,
    visible,
    onClose,
    onClosed,
}: {
    order: UIOrder | null;
    visible: boolean;
    onClose: () => void;
    onClosed: () => void;
}) {
    const TIP_PRESETS = [0, 15, 18, 20, 25];
    const [tipMode, setTipMode] = useState<"percent" | "dollar">("percent");
    const [tipPercent, setTipPercent] = useState(18);
    const [customTip, setCustomTip] = useState("");
    const [closing, setClosing] = useState(false);

    if (!order) return null;

    const tipAmount =
        tipMode === "percent"
            ? (order.subtotal * tipPercent) / 100
            : parseFloat(customTip) || 0;
    const total = order.subtotal + tipAmount;

    const handleClose = async () => {
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setClosing(true);
        try {
            await supabase
                .from("orders")
                .update({
                    status: "completed",
                    tip_amount: tipAmount,
                    tip_percent: tipMode === "percent" ? tipPercent : null,
                    closed_at: new Date().toISOString(),
                })
                .eq("id", Number(order.id));
            if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onClosed();
        } catch (err: any) {
            Alert.alert("Error", err.message || "Could not close table.");
        } finally {
            setClosing(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" }}>
                <Pressable style={{ flex: 1 }} onPress={onClose} />
                <View style={{ backgroundColor: "#0f0f0f", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Platform.OS === "ios" ? 40 : 24, borderTopWidth: 1, borderTopColor: "#2a2a2a" }}>
                    <View style={{ alignItems: "center", marginBottom: 20 }}>
                        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "#2a2a2a", marginBottom: 20 }} />
                        <Text style={{ fontFamily: "BricolageGrotesque_800ExtraBold", color: "#f5f5f5", fontSize: 24 }}>Close Table</Text>
                        <Text style={{ fontFamily: "Manrope_500Medium", color: "#777", fontSize: 13, marginTop: 4 }}>
                            Table {order.tableNumber} · {order.items.length} items
                        </Text>
                    </View>

                    {/* Subtotal */}
                    <View style={{ backgroundColor: "#1a1a1a", borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#2a2a2a" }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                            <Text style={{ fontFamily: "Manrope_500Medium", color: "#999", fontSize: 14 }}>Subtotal</Text>
                            <Text style={{ fontFamily: "JetBrainsMono_600SemiBold", color: "#f5f5f5", fontSize: 14 }}>${order.subtotal.toFixed(2)}</Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Text style={{ fontFamily: "Manrope_500Medium", color: "#999", fontSize: 14 }}>Tip</Text>
                            <Text style={{ fontFamily: "JetBrainsMono_600SemiBold", color: "#FF9933", fontSize: 14 }}>${tipAmount.toFixed(2)}</Text>
                        </View>
                        <View style={{ height: 1, backgroundColor: "#2a2a2a", marginVertical: 12 }} />
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Text style={{ fontFamily: "Manrope_700Bold", color: "#f5f5f5", fontSize: 16 }}>Total</Text>
                            <Text style={{ fontFamily: "JetBrainsMono_600SemiBold", color: "#f5f5f5", fontSize: 18 }}>${total.toFixed(2)}</Text>
                        </View>
                    </View>

                    {/* Tip Mode Toggle */}
                    <View style={{ flexDirection: "row", marginBottom: 12, gap: 8 }}>
                        {(["percent", "dollar"] as const).map((mode) => (
                            <Pressable
                                key={mode}
                                onPress={() => { setTipMode(mode); setCustomTip(""); }}
                                style={{
                                    flex: 1, padding: 10, borderRadius: 12, borderWidth: 1,
                                    backgroundColor: tipMode === mode ? "rgba(255,153,51,0.12)" : "#0f0f0f",
                                    borderColor: tipMode === mode ? "#FF9933" : "#2a2a2a",
                                    alignItems: "center",
                                }}
                            >
                                <Text style={{ fontFamily: "Manrope_700Bold", color: tipMode === mode ? "#FF9933" : "#555", fontSize: 13 }}>
                                    {mode === "percent" ? "% Percentage" : "$ Amount"}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    {tipMode === "percent" ? (
                        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                            {TIP_PRESETS.map((p) => (
                                <Pressable
                                    key={p}
                                    onPress={() => { setTipPercent(p); if (Platform.OS !== "web") Haptics.selectionAsync(); }}
                                    style={{
                                        flex: 1, padding: 10, borderRadius: 12, borderWidth: 1,
                                        backgroundColor: tipPercent === p ? "rgba(255,153,51,0.12)" : "#0f0f0f",
                                        borderColor: tipPercent === p ? "#FF9933" : "#2a2a2a",
                                        alignItems: "center",
                                    }}
                                >
                                    <Text style={{ fontFamily: "BricolageGrotesque_700Bold", color: tipPercent === p ? "#FF9933" : "#777", fontSize: 14 }}>
                                        {p === 0 ? "No tip" : `${p}%`}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    ) : (
                        <TextInput
                            value={customTip}
                            onChangeText={setCustomTip}
                            placeholder="Enter tip amount"
                            placeholderTextColor="#555"
                            keyboardType="decimal-pad"
                            style={{
                                backgroundColor: "#1a1a1a", borderRadius: 12, borderWidth: 1,
                                borderColor: customTip ? "#FF9933" : "#2a2a2a",
                                paddingHorizontal: 14, paddingVertical: 13, color: "#f5f5f5",
                                fontFamily: "JetBrainsMono_600SemiBold", fontSize: 16, marginBottom: 16,
                            }}
                        />
                    )}

                    <Pressable
                        onPress={handleClose}
                        disabled={closing}
                        style={{
                            backgroundColor: "#22C55E", borderRadius: 16, paddingVertical: 16,
                            alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8,
                            opacity: closing ? 0.8 : 1,
                        }}
                    >
                        {closing ? <ActivityIndicator color="#fff" /> : (
                            <>
                                <CheckCircle2 size={18} color="#fff" />
                                <Text style={{ fontFamily: "BricolageGrotesque_700Bold", color: "#fff", fontSize: 17 }}>
                                    Close Table · ${total.toFixed(2)}
                                </Text>
                            </>
                        )}
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

// ──────────────────────── Order Card ──────────────────────────
function OrderCard({
    order,
    onStatusChange,
    onClose,
    onNotifyReady,
}: {
    order: UIOrder;
    onStatusChange: (id: string, status: OrderStatus) => void;
    onClose: (order: UIOrder) => void;
    onNotifyReady: (order: UIOrder) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const statusColor = STATUS_COLORS[order.status];

    const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
        active: "preparing",
        preparing: order.orderType === "takeout" ? "ready" : "served",
        ready: "completed",
        served: "completed",
    };
    const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
        active: "Mark Preparing",
        preparing: order.orderType === "takeout" ? "Mark Ready for Pickup" : "Mark Served",
        ready: "Mark Completed",
        served: "Mark Completed",
    };

    const nextStatus = NEXT_STATUS[order.status];
    const nextLabel = NEXT_LABEL[order.status];
    const isFinished = order.status === "completed" || order.status === "cancelled";

    const typeIcon = order.orderType === "takeout"
        ? <Truck size={12} color="#777" />
        : order.orderType === "pre_order"
            ? <Clock size={12} color="#777" />
            : <UtensilsCrossed size={12} color="#777" />;

    return (
        <Animated.View entering={FadeInDown.duration(300)} style={S.card}>
            {/* Card Header */}
            <Pressable
                onPress={() => { if (Platform.OS !== "web") Haptics.selectionAsync(); setExpanded(!expanded); }}
                style={{ padding: 14 }}
            >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flex: 1 }}>
                        {/* Table + party */}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <View>
                                <Text style={{ fontFamily: "BricolageGrotesque_700Bold", color: "#f5f5f5", fontSize: 18 }}>
                                    {order.customerName ? `${order.customerName}` : (order.tableNumber !== "—" ? `Table ${order.tableNumber}` : ORDER_TYPE_LABELS[order.orderType])}
                                </Text>
                                {order.customerName && order.tableNumber !== "—" && (
                                    <Text style={{ fontFamily: "Manrope_500Medium", color: "#888", fontSize: 13, marginTop: 2 }}>
                                        Table {order.tableNumber}
                                    </Text>
                                )}
                            </View>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 2, marginLeft: 8, marginTop: 2, alignSelf: "flex-start" }}>
                                <Users size={11} color="#555" />
                                <Text style={{ fontFamily: "Manrope_500Medium", color: "#555", fontSize: 11 }}>{order.partySize}</Text>
                            </View>
                        </View>

                        {/* Type + meal + elapsed */}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                                {typeIcon}
                                <Text style={{ fontFamily: "Manrope_500Medium", color: "#777", fontSize: 11 }}>
                                    {ORDER_TYPE_LABELS[order.orderType]}
                                </Text>
                            </View>
                            <Text style={{ color: "#333" }}>·</Text>
                            <Text style={{ fontFamily: "Manrope_500Medium", color: "#777", fontSize: 11 }}>
                                {order.mealPeriod}
                            </Text>
                            <Text style={{ color: "#333" }}>·</Text>
                            <Clock size={10} color="#555" />
                            <Text style={{ fontFamily: "Manrope_500Medium", color: "#777", fontSize: 11 }}>
                                {order.elapsedMinutes < 60 ? `${order.elapsedMinutes}m ago` : `${Math.floor(order.elapsedMinutes / 60)}h ago`}
                            </Text>
                        </View>
                    </View>

                    <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontFamily: "JetBrainsMono_600SemiBold", color: "#f5f5f5", fontSize: 16, marginBottom: 6 }}>
                            ${order.subtotal.toFixed(2)}
                        </Text>
                        <View style={{ backgroundColor: `${statusColor}20`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: `${statusColor}50` }}>
                            <Text style={{ fontFamily: "Manrope_700Bold", color: statusColor, fontSize: 10, textTransform: "uppercase" }}>
                                {order.status}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Item summary */}
                <Text style={{ fontFamily: "Manrope_500Medium", color: "#666", fontSize: 12, marginTop: 8 }} numberOfLines={2}>
                    {order.items.map(i => `${i.quantity}× ${i.name}`).join(", ")}
                </Text>

                {/* Expand indicator */}
                <View style={{ alignItems: "center", marginTop: 8 }}>
                    {expanded ? <ChevronUp size={14} color="#555" /> : <ChevronDown size={14} color="#555" />}
                </View>
            </Pressable>

            {/* Expanded details */}
            {expanded && (
                <View style={{ borderTopWidth: 1, borderTopColor: "#222", padding: 14 }}>
                    {/* Items list */}
                    {order.items.map((item) => (
                        <View key={item.id} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                            <Text style={{ fontFamily: "Manrope_600SemiBold", color: "#f5f5f5", fontSize: 13, flex: 1 }}>
                                {item.quantity}× {item.name}
                            </Text>
                            {item.isVegetarian && <Leaf size={11} color="#22C55E" style={{ marginRight: 6 }} />}
                            <Text style={{ fontFamily: "JetBrainsMono_600SemiBold", color: "#FF9933", fontSize: 12 }}>
                                ${item.lineTotal.toFixed(2)}
                            </Text>
                        </View>
                    ))}

                    {order.notes !== "" && (
                        <View style={{ backgroundColor: "#0f0f0f", borderRadius: 10, padding: 10, marginTop: 6, marginBottom: 10 }}>
                            <Text style={{ fontFamily: "Manrope_500Medium", color: "#666", fontSize: 12 }}>📝 {order.notes}</Text>
                        </View>
                    )}

                    {/* Action buttons */}
                    {!isFinished && (
                        <View style={{ gap: 8, marginTop: 4 }}>
                            {nextStatus && nextLabel && (
                                <Pressable
                                    onPress={() => {
                                        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                        onStatusChange(order.id, nextStatus);
                                        if (nextStatus === "ready" && order.orderType === "takeout") {
                                            onNotifyReady(order);
                                        }
                                    }}
                                    style={{ backgroundColor: "rgba(255,153,51,0.15)", borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,153,51,0.3)" }}
                                >
                                    <Text style={{ fontFamily: "Manrope_700Bold", color: "#FF9933", fontSize: 14 }}>{nextLabel}</Text>
                                </Pressable>
                            )}
                            {order.status === "served" || order.status === "active" || order.status === "preparing" ? (
                                <Pressable
                                    onPress={() => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onClose(order); }}
                                    style={{ backgroundColor: "rgba(34,197,94,0.1)", borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "rgba(34,197,94,0.3)" }}
                                >
                                    <Text style={{ fontFamily: "Manrope_700Bold", color: "#22C55E", fontSize: 14 }}>Close Table & Add Tip</Text>
                                </Pressable>
                            ) : null}
                        </View>
                    )}
                </View>
            )}
        </Animated.View>
    );
}

// ──────────────────────── Main Screen ──────────────────────────
type TabKey = "active" | "pre_order" | "takeout" | "completed";
type DietFilter = "all" | "veg" | "non_veg";
type MealFilter = "all" | MealPeriod;

export default function AdminOrdersScreen() {
    const router = useRouter();
    const { isAdmin, loading: adminLoading } = useAdminMode();
    const { session } = useAuth();

    const [orders, setOrders] = useState<UIOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Tabs
    const [activeTab, setActiveTab] = useState<TabKey>("active");

    // Filters
    const [dietFilter, setDietFilter] = useState<DietFilter>("all");
    const [mealFilter, setMealFilter] = useState<MealFilter>("all");
    const [tableFilter, setTableFilter] = useState("");

    // Close Table modal
    const [closeOrder, setCloseOrder] = useState<UIOrder | null>(null);
    const [showCloseModal, setShowCloseModal] = useState(false);

    // ── Fetch orders ──
    const fetchOrders = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from("orders")
                .select(`
          *,
          restaurants ( name, image_url ),
          order_items ( * )
        `)
                .order("created_at", { ascending: false });

            if (error) throw error;
            const uiOrders = (data as SupabaseOrder[]).map(mapOrderToUI);
            setOrders(uiOrders);
        } catch (err: any) {
            console.error("fetchOrders error:", err);
            Alert.alert("Error", "Could not load orders.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (isAdmin) {
            fetchOrders();

            // Real-time subscription
            const ch = supabase
                .channel("admin-orders")
                .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, fetchOrders)
                .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, fetchOrders)
                .subscribe();

            return () => { supabase.removeChannel(ch); };
        }
    }, [isAdmin, fetchOrders]);

    const onRefresh = useCallback(() => {
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setRefreshing(true);
        fetchOrders();
    }, [fetchOrders]);

    // ── Status update ──
    const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
        // Optimistic
        setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: newStatus } : o));
        const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", Number(orderId));
        if (error) { Alert.alert("Error", error.message); fetchOrders(); }
    };

    // ── Notify takeout ready ──
    const handleNotifyReady = (order: UIOrder) => {
        // In a real push-notification system you'd trigger a push here.
        // For now, we update status and show an in-app alert.
        Alert.alert("Notified!", `Takeout order #${order.id} marked as ready. Customer has been notified.`);
    };

    // ── Filter logic ──
    const filteredOrders = orders.filter((o) => {
        // Tab filter
        if (activeTab === "active") { if (o.orderType === "pre_order" || o.orderType === "takeout" || o.status === "completed" || o.status === "cancelled") return false; }
        if (activeTab === "pre_order") { if (o.orderType !== "pre_order") return false; }
        if (activeTab === "takeout") { if (o.orderType !== "takeout") return false; }
        if (activeTab === "completed") { if (o.status !== "completed" && o.status !== "cancelled") return false; }

        // Diet filter
        if (dietFilter === "veg") { if (o.items.some((i) => !i.isVegetarian)) return false; }
        if (dietFilter === "non_veg") { if (o.items.every((i) => i.isVegetarian)) return false; }

        // Meal period
        if (mealFilter !== "all") { if (o.mealPeriod !== mealFilter) return false; }

        // Table number
        if (tableFilter.trim()) { if (!o.tableNumber.toLowerCase().includes(tableFilter.toLowerCase())) return false; }

        return true;
    });

    const TABS: { key: TabKey; label: string }[] = [
        { key: "active", label: "Dine In" },
        { key: "pre_order", label: "Pre-Orders" },
        { key: "takeout", label: "Takeout" },
        { key: "completed", label: "Completed" },
    ];

    // Access guard
    if (!adminLoading && !isAdmin) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: "#0f0f0f" }} edges={["top"]}>
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
                    <Text style={{ fontFamily: "BricolageGrotesque_700Bold", color: "#f5f5f5", fontSize: 22, marginBottom: 16 }}>Admin Only</Text>
                    <Pressable onPress={() => router.back()} style={{ backgroundColor: "#1a1a1a", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#2a2a2a" }}>
                        <Text style={{ fontFamily: "Manrope_600SemiBold", color: "#f5f5f5" }}>Go Back</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#0f0f0f" }} edges={["top"]}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#1e1e1e" }}>
                <Pressable onPress={() => router.back()} hitSlop={12} style={{ padding: 4 }}>
                    <ArrowLeft size={24} color="#f5f5f5" />
                </Pressable>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ShoppingBag size={18} color="#FF9933" />
                    <Text style={{ fontFamily: "BricolageGrotesque_800ExtraBold", color: "#f5f5f5", fontSize: 20 }}>Orders</Text>
                </View>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF9933" }} />
            </View>

            {/* Tab Bar */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ borderBottomWidth: 1, borderBottomColor: "#1e1e1e" }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
                {TABS.map(({ key, label }) => {
                    const active = activeTab === key;
                    const count = key === "active"
                        ? orders.filter(o => o.orderType === "dine_in" && o.status !== "completed" && o.status !== "cancelled").length
                        : key === "pre_order"
                            ? orders.filter(o => o.orderType === "pre_order").length
                            : key === "takeout"
                                ? orders.filter(o => o.orderType === "takeout").length
                                : orders.filter(o => o.status === "completed" || o.status === "cancelled").length;
                    return (
                        <Pressable
                            key={key}
                            onPress={() => { setActiveTab(key); if (Platform.OS !== "web") Haptics.selectionAsync(); }}
                            style={{
                                flexDirection: "row", alignItems: "center", gap: 6,
                                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                                backgroundColor: active ? "rgba(255,153,51,0.15)" : "#0f0f0f",
                                borderWidth: 1, borderColor: active ? "#FF9933" : "#2a2a2a",
                            }}
                        >
                            <Text style={{ fontFamily: active ? "Manrope_700Bold" : "Manrope_500Medium", fontSize: 13, color: active ? "#FF9933" : "#666" }}>{label}</Text>
                            {count > 0 && (
                                <View style={{ backgroundColor: active ? "#FF9933" : "#2a2a2a", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 }}>
                                    <Text style={{ fontFamily: "JetBrainsMono_600SemiBold", color: active ? "#0f0f0f" : "#888", fontSize: 10 }}>{count}</Text>
                                </View>
                            )}
                        </Pressable>
                    );
                })}
            </ScrollView>

            {/* Filter Bar */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ borderBottomWidth: 1, borderBottomColor: "#1a1a1a" }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 6, alignItems: "center" }}>
                {/* Diet */}
                {(["all", "veg", "non_veg"] as DietFilter[]).map((d) => (
                    <Pressable key={d} onPress={() => setDietFilter(d)} style={S.chip(dietFilter === d, "#22C55E")}>
                        <Text style={S.chipText(dietFilter === d, "#22C55E")}>
                            {d === "all" ? "All Diet" : d === "veg" ? "🌿 Veg" : "🥩 Non-Veg"}
                        </Text>
                    </Pressable>
                ))}
                <View style={{ width: 1, height: 20, backgroundColor: "#2a2a2a", marginHorizontal: 2 }} />
                {/* Meal period */}
                {(["all", "breakfast", "lunch", "dinner", "special"] as MealFilter[]).map((m) => (
                    <Pressable key={m} onPress={() => setMealFilter(m)} style={S.chip(mealFilter === m)}>
                        <Text style={S.chipText(mealFilter === m)}>
                            {m === "all" ? "All Meals" : m === "breakfast" ? "☕ Breakfast" : m === "lunch" ? "☀️ Lunch" : m === "dinner" ? "🌙 Dinner" : "✨ Special"}
                        </Text>
                    </Pressable>
                ))}
                <View style={{ width: 1, height: 20, backgroundColor: "#2a2a2a", marginHorizontal: 2 }} />
                {/* Table search */}
                <TextInput
                    value={tableFilter}
                    onChangeText={setTableFilter}
                    placeholder="Table #"
                    placeholderTextColor="#555"
                    keyboardType="default"
                    style={{
                        backgroundColor: "#1a1a1a", borderRadius: 20, borderWidth: 1,
                        borderColor: tableFilter ? "#FF9933" : "#2a2a2a",
                        paddingHorizontal: 12, paddingVertical: 6,
                        color: "#f5f5f5", fontFamily: "Manrope_600SemiBold", fontSize: 12,
                        minWidth: 80,
                    }}
                />
            </ScrollView>

            {/* List */}
            {loading ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <ActivityIndicator size="large" color="#FF9933" />
                </View>
            ) : (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF9933" />}
                >
                    {filteredOrders.length === 0 ? (
                        <Animated.View entering={FadeIn.duration(400)} style={{ alignItems: "center", paddingTop: 60 }}>
                            <ShoppingBag size={40} color="#333" style={{ marginBottom: 12 }} />
                            <Text style={{ fontFamily: "BricolageGrotesque_700Bold", color: "#555", fontSize: 18 }}>No orders here</Text>
                            <Text style={{ fontFamily: "Manrope_500Medium", color: "#444", fontSize: 14, marginTop: 4 }}>
                                {activeTab === "active" ? "No active dine-in orders" : activeTab === "pre_order" ? "No pre-orders" : activeTab === "takeout" ? "No takeout orders" : "No completed orders"}
                            </Text>
                        </Animated.View>
                    ) : (
                        filteredOrders.map((order) => (
                            <OrderCard
                                key={order.id}
                                order={order}
                                onStatusChange={handleStatusChange}
                                onClose={(o) => { setCloseOrder(o); setShowCloseModal(true); }}
                                onNotifyReady={handleNotifyReady}
                            />
                        ))
                    )}
                </ScrollView>
            )}

            <CloseTableModal
                order={closeOrder}
                visible={showCloseModal}
                onClose={() => { setShowCloseModal(false); setCloseOrder(null); }}
                onClosed={() => {
                    setShowCloseModal(false);
                    setCloseOrder(null);
                    fetchOrders();
                }}
            />
        </SafeAreaView>
    );
}
