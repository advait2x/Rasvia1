import { useEffect, useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, FlatList,
    Alert, ActivityIndicator, Modal, Platform, ScrollView,
    Pressable, Image,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useNotifications } from '../../lib/notifications-context';
import {
    ArrowLeft, ShoppingCart, Plus, X, Coffee, Sun, Moon,
    Star, Clock, Leaf, Flame, ChevronDown, ChevronUp,
    CheckCircle2, Users, DollarSign,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

// ─── Meal-Period Config ─────────────────────────────────────────────────────
type MealPeriod = 'breakfast' | 'lunch' | 'dinner' | 'specials' | 'all_day';

const MEAL_PERIOD_CFG: Record<MealPeriod, { label: string; color: string; bg: string; border: string; Icon: any }> = {
    breakfast: { label: 'Breakfast', color: '#F97316', bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.35)', Icon: Coffee },
    lunch:     { label: 'Lunch',     color: '#22C55E', bg: 'rgba(34,197,94,0.15)',  border: 'rgba(34,197,94,0.35)',  Icon: Sun  },
    dinner:    { label: 'Dinner',    color: '#818CF8', bg: 'rgba(129,140,248,0.15)',border: 'rgba(129,140,248,0.35)',Icon: Moon },
    specials:  { label: 'Specials',  color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.35)', Icon: Star },
    all_day:   { label: 'All Day',   color: '#94A3B8', bg: 'rgba(148,163,184,0.15)',border: 'rgba(148,163,184,0.35)',Icon: Clock },
};

function MealPeriodTag({ period }: { period: MealPeriod }) {
    const cfg = MEAL_PERIOD_CFG[period];
    if (!cfg) return null;
    const Icon = cfg.Icon;
    return (
        <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: cfg.bg, borderRadius: 20, borderWidth: 1,
            borderColor: cfg.border, paddingHorizontal: 10, paddingVertical: 4,
        }}>
            <Icon size={11} color={cfg.color} />
            <Text style={{ fontFamily: 'Manrope_600SemiBold', color: cfg.color, fontSize: 11 }}>
                {cfg.label}
            </Text>
        </View>
    );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function JoinPartyScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { addEvent } = useNotifications();

    const goBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/');
        }
    };

    const [guestName, setGuestName]         = useState('');
    const [isJoined, setIsJoined]           = useState(false);
    const [loading, setLoading]             = useState(true);
    const [menu, setMenu]                   = useState<any[]>([]);
    const [cartItems, setCartItems]         = useState<any[]>([]);
    const [restaurantName, setRestaurantName] = useState('');
    const [restaurantImage, setRestaurantImage] = useState<string | null>(null);
    const [showCartModal, setShowCartModal] = useState(false);
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
    const [isHost, setIsHost]               = useState(false);
    const [submitting, setSubmitting]       = useState(false);
    const [submitted, setSubmitted]         = useState(false);

    const totalItems = cartItems.length;
    const totalPrice = cartItems.reduce((sum, item) => {
        const price = item.menu_items?.price ?? item.price ?? 0;
        return sum + price;
    }, 0);

    useEffect(() => { if (id) initializeParty(); }, [id]);

    const initializeParty = async () => {
        try {
            const storedName = await AsyncStorage.getItem(`party_name_${id}`);
            if (storedName) { setGuestName(storedName); setIsJoined(true); }

            const { data: { user } } = await supabase.auth.getUser();

            const { data: session, error } = await supabase
                .from('party_sessions')
                .select('restaurant_id, host_user_id, status, restaurants(name, image_url)')
                .eq('id', id)
                .single();

            if (error || !session) { setLoading(false); return; }

            if (session.status === 'submitted') setSubmitted(true);

            if (user && session.host_user_id === user.id) {
                setIsHost(true);
                if (!storedName) {
                    setGuestName('Host'); setIsJoined(true);
                    AsyncStorage.setItem(`party_name_${id}`, 'Host');
                }
            }

            const rest = session.restaurants as any;
            setRestaurantName(rest?.name ?? 'Restaurant');
            setRestaurantImage(rest?.image_url ?? null);

            const { data: menuItems } = await supabase
                .from('menu_items')
                .select('*')
                .eq('restaurant_id', session.restaurant_id)
                .neq('is_available', false);

            setMenu(menuItems ?? []);
            fetchCart();

            const channel = supabase
                .channel(`party-${id}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'party_items', filter: `session_id=eq.${id}` }, fetchCart)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'party_sessions', filter: `id=eq.${id}` }, (payload) => {
                    if (payload.new?.status === 'submitted') setSubmitted(true);
                })
                .subscribe();

            return () => { supabase.removeChannel(channel); };
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchCart = async () => {
        const { data } = await supabase
            .from('party_items')
            .select('*, menu_items(name, price, description, image_url)')
            .eq('session_id', id)
            .order('created_at', { ascending: true });
        setCartItems(data ?? []);
    };

    const handleJoin = async () => {
        if (!guestName.trim()) return;
        await AsyncStorage.setItem(`party_name_${id}`, guestName);
        setIsJoined(true);
        if (!isHost) {
            addEvent({
                type: "group_joined",
                restaurantName,
                restaurantId: String(id),
                entryId: String(id),
                partySize: 1,
                timestamp: new Date().toISOString(),
            });
        }
    };

    const addToCart = async (item: any) => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const tempId = `temp-${Math.random()}`;
        const optimistic = { id: tempId, menu_items: item, added_by_name: guestName, price: item.price };
        setCartItems(prev => [...prev, optimistic]);

        const { error } = await supabase.from('party_items').insert({
            session_id: id,
            menu_item_id: item.id,
            added_by_name: guestName,
            quantity: 1,
        });

        if (error) {
            setCartItems(prev => prev.filter(i => i.id !== tempId));
            Alert.alert('Error', 'Could not add item. Please try again.');
        }
    };

    const submitOrderToKitchen = async () => {
        setSubmitting(true);
        try {
            // 1. Mark session as submitted
            const { error } = await supabase
                .from('party_sessions')
                .update({ status: 'submitted', submitted_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;

            // 2. Create a consolidated order summary record
            const orderSummary = cartItems.map(ci => ({
                name: ci.menu_items?.name ?? 'Unknown',
                price: ci.menu_items?.price ?? 0,
                added_by: ci.added_by_name,
            }));

            await supabase.from('group_orders').insert({
                party_session_id: id,
                restaurant_id: null, // populated server-side via join
                items: orderSummary,
                total: totalPrice,
                submitted_at: new Date().toISOString(),
            }).then(() => {}); // best-effort, ignore if table doesn't exist yet

            setSubmitted(true);
            setShowCartModal(false);
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            addEvent({
                type: "group_submitted",
                restaurantName,
                restaurantId: String(id),
                entryId: String(id),
                partySize: cartItems.length,
                timestamp: new Date().toISOString(),
            });
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setSubmitting(false);
        }
    };

    // ─── Loading ───────────────────────────────────────────────────────────
    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f0f' }}>
                <Stack.Screen options={{ headerShown: false }} />
                <ActivityIndicator size="large" color="#FF9933" />
            </View>
        );
    }

    // ─── Submitted State ──────────────────────────────────────────────────
    if (submitted) {
        return (
            <View style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
                <Stack.Screen options={{ headerShown: false }} />

                {/* Back button top-left */}
                <View style={{ paddingTop: Platform.OS === 'ios' ? 56 : 40, paddingHorizontal: 20 }}>
                    <Pressable
                        onPress={() => goBack()}
                        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <ArrowLeft size={20} color="#f5f5f5" />
                    </Pressable>
                </View>

                {/* Centered content */}
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 2, borderColor: 'rgba(34,197,94,0.4)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                        <CheckCircle2 size={40} color="#22C55E" />
                    </View>
                    <Text style={{ fontFamily: 'BricolageGrotesque_800ExtraBold', color: '#f5f5f5', fontSize: 26, textAlign: 'center', marginBottom: 12 }}>
                        Order Submitted!
                    </Text>
                    <Text style={{ fontFamily: 'Manrope_500Medium', color: '#999', fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
                        The host has sent your group order to the kitchen. Sit back and enjoy!
                    </Text>
                </View>
            </View>
        );
    }

    // ─── Join Screen ──────────────────────────────────────────────────────
    if (!isJoined) {
        return (
            <View style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
                <Stack.Screen options={{ headerShown: false }} />

                {/* Header image */}
                {restaurantImage && (
                    <Image source={{ uri: restaurantImage }} style={{ width: '100%', height: 220 }} resizeMode="cover" />
                )}

                <View style={{ flex: 1, padding: 28, justifyContent: 'center' }}>
                    {/* Back */}
                    <Pressable onPress={goBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 32 }}>
                        <ArrowLeft size={18} color="#999" />
                        <Text style={{ fontFamily: 'Manrope_500Medium', color: '#999', fontSize: 14 }}>Back</Text>
                    </Pressable>

                    <Text style={{ fontFamily: 'BricolageGrotesque_800ExtraBold', color: '#f5f5f5', fontSize: 28, letterSpacing: -0.5, marginBottom: 6 }}>
                        Join {restaurantName}
                    </Text>
                    <Text style={{ fontFamily: 'Manrope_500Medium', color: '#999', fontSize: 15, marginBottom: 32 }}>
                        Enter your name to join the group order.
                    </Text>

                    <View style={{ backgroundColor: '#1a1a1a', borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16, height: 56 }}>
                        <Users size={18} color="#666" />
                        <TextInput
                            style={{ flex: 1, color: '#f5f5f5', fontFamily: 'Manrope_500Medium', fontSize: 16, marginLeft: 12 }}
                            placeholder="Your name"
                            placeholderTextColor="#555"
                            value={guestName}
                            onChangeText={setGuestName}
                            onSubmitEditing={handleJoin}
                            returnKeyType="go"
                        />
                    </View>

                    <Pressable
                        onPress={handleJoin}
                        style={{ backgroundColor: '#FF9933', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
                    >
                        <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', color: '#0f0f0f', fontSize: 17 }}>
                            Start Ordering
                        </Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    // ─── Menu Screen ──────────────────────────────────────────────────────
    return (
        <View style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <Animated.View entering={FadeIn.duration(400)} style={{
                paddingTop: Platform.OS === 'ios' ? 56 : 40,
                paddingBottom: 16,
                paddingHorizontal: 20,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#0f0f0f',
                borderBottomWidth: 1,
                borderBottomColor: '#1e1e1e',
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <Pressable
                        onPress={() => goBack()}
                        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <ArrowLeft size={20} color="#f5f5f5" />
                    </Pressable>
                    <View>
                        <Text style={{ fontFamily: 'BricolageGrotesque_800ExtraBold', color: '#f5f5f5', fontSize: 20, letterSpacing: -0.3 }}>
                            {restaurantName}
                        </Text>
                        <Text style={{ fontFamily: 'Manrope_500Medium', color: '#666', fontSize: 12 }}>
                            Ordering as {guestName}
                        </Text>
                    </View>
                </View>

                {/* Cart button */}
                <Pressable
                    onPress={() => totalItems > 0 && setShowCartModal(true)}
                    style={{ position: 'relative', width: 44, height: 44, borderRadius: 22, backgroundColor: totalItems > 0 ? '#FF9933' : '#1a1a1a', borderWidth: 1, borderColor: totalItems > 0 ? '#FF9933' : '#2a2a2a', alignItems: 'center', justifyContent: 'center' }}
                >
                    <ShoppingCart size={20} color={totalItems > 0 ? '#0f0f0f' : '#666'} />
                    {totalItems > 0 && (
                        <View style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: '#0f0f0f', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', color: '#FF9933', fontSize: 10 }}>{totalItems}</Text>
                        </View>
                    )}
                </Pressable>
            </Animated.View>

            {/* Menu */}
            <FlatList
                data={menu}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
                renderItem={({ item, index }) => {
                    const isExpanded = expandedItemId === item.id.toString();
                    const mealPeriod = item.meal_period as MealPeriod | undefined;

                    return (
                        <Animated.View entering={FadeInDown.delay(index * 40).duration(400)}>
                            <Pressable
                                onPress={() => {
                                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                                    setExpandedItemId(isExpanded ? null : item.id.toString());
                                }}
                                style={{
                                    backgroundColor: '#1a1a1a',
                                    borderRadius: 20,
                                    borderWidth: 1,
                                    borderColor: isExpanded ? '#FF9933' : '#2a2a2a',
                                    marginBottom: 12,
                                    overflow: 'hidden',
                                }}
                            >
                                {/* Main row */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 }}>
                                    {/* Image */}
                                    {item.image_url ? (
                                        <Image source={{ uri: item.image_url }} style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: '#262626' }} resizeMode="cover" />
                                    ) : (
                                        <View style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: '#262626', alignItems: 'center', justifyContent: 'center' }}>
                                            <Text style={{ fontSize: 28 }}>🍽️</Text>
                                        </View>
                                    )}

                                    {/* Info */}
                                    <View style={{ flex: 1 }}>
                                        <Text numberOfLines={1} style={{ fontFamily: 'BricolageGrotesque_700Bold', color: '#f5f5f5', fontSize: 16, marginBottom: 4 }}>
                                            {item.name}
                                        </Text>

                                        {/* Tags row */}
                                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                                            {mealPeriod && <MealPeriodTag period={mealPeriod} />}
                                            {item.is_vegetarian && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)', paddingHorizontal: 8, paddingVertical: 3 }}>
                                                    <Leaf size={10} color="#22C55E" />
                                                    <Text style={{ fontFamily: 'Manrope_600SemiBold', color: '#22C55E', fontSize: 10 }}>Veg</Text>
                                                </View>
                                            )}
                                            {item.is_spicy && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', paddingHorizontal: 8, paddingVertical: 3 }}>
                                                    <Flame size={10} color="#EF4444" />
                                                    <Text style={{ fontFamily: 'Manrope_600SemiBold', color: '#EF4444', fontSize: 10 }}>Spicy</Text>
                                                </View>
                                            )}
                                        </View>

                                        <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', color: '#FF9933', fontSize: 15 }}>
                                            ${Number(item.price).toFixed(2)}
                                        </Text>
                                    </View>

                                    {/* Expand chevron */}
                                    {isExpanded ? <ChevronUp size={18} color="#FF9933" /> : <ChevronDown size={18} color="#555" />}
                                </View>

                                {/* Expanded detail panel */}
                                {isExpanded && (
                                    <Animated.View entering={FadeInDown.duration(250)} style={{ borderTopWidth: 1, borderTopColor: '#2a2a2a', padding: 16 }}>
                                        {item.description ? (
                                            <Text style={{ fontFamily: 'Manrope_500Medium', color: '#aaa', fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
                                                {item.description}
                                            </Text>
                                        ) : null}

                                        {/* Calories / extra details if present */}
                                        {item.calories ? (
                                            <Text style={{ fontFamily: 'Manrope_500Medium', color: '#666', fontSize: 13, marginBottom: 12 }}>
                                                {item.calories} kcal
                                            </Text>
                                        ) : null}

                                        <Pressable
                                            onPress={() => { addToCart(item); setExpandedItemId(null); }}
                                            style={{ backgroundColor: '#FF9933', borderRadius: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                                        >
                                            <Plus size={18} color="#0f0f0f" />
                                            <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', color: '#0f0f0f', fontSize: 15 }}>
                                                Add to Order
                                            </Text>
                                        </Pressable>
                                    </Animated.View>
                                )}
                            </Pressable>
                        </Animated.View>
                    );
                }}
            />

            {/* Floating cart bar */}
            {totalItems > 0 && (
                <View style={{ position: 'absolute', bottom: 32, left: 16, right: 16 }}>
                    <Pressable
                        onPress={() => setShowCartModal(true)}
                        style={{ backgroundColor: '#FF9933', borderRadius: 20, paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#FF9933', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 12 }}
                    >
                        <View style={{ backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                            <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', color: '#0f0f0f', fontSize: 14 }}>{totalItems}</Text>
                        </View>
                        <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', color: '#0f0f0f', fontSize: 16 }}>View Group Order</Text>
                        <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', color: '#0f0f0f', fontSize: 15 }}>${totalPrice.toFixed(2)}</Text>
                    </Pressable>
                </View>
            )}

            {/* Cart Modal */}
            <Modal visible={showCartModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCartModal(false)}>
                <View style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
                    {/* Modal header */}
                    <View style={{ paddingTop: 20, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#1e1e1e' }}>
                        <Text style={{ fontFamily: 'BricolageGrotesque_800ExtraBold', color: '#f5f5f5', fontSize: 22 }}>Group Cart</Text>
                        <Pressable onPress={() => setShowCartModal(false)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={18} color="#f5f5f5" />
                        </Pressable>
                    </View>

                    {cartItems.length === 0 ? (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <ShoppingCart size={48} color="#333" />
                            <Text style={{ fontFamily: 'Manrope_500Medium', color: '#555', fontSize: 15, marginTop: 12 }}>No items yet</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={cartItems}
                            keyExtractor={(item, i) => item.id?.toString() ?? i.toString()}
                            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
                            renderItem={({ item }) => (
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1a1a1a', borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a', padding: 14, marginBottom: 10 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', color: '#f5f5f5', fontSize: 15 }}>
                                            {item.menu_items?.name ?? 'Item'}
                                        </Text>
                                        <Text style={{ fontFamily: 'Manrope_500Medium', color: '#666', fontSize: 12, marginTop: 2 }}>
                                            Added by {item.added_by_name}
                                        </Text>
                                    </View>
                                    <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', color: '#FF9933', fontSize: 15 }}>
                                        ${Number(item.menu_items?.price ?? 0).toFixed(2)}
                                    </Text>
                                </View>
                            )}
                        />
                    )}

                    {/* Footer */}
                    <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: '#1e1e1e', paddingBottom: Platform.OS === 'ios' ? 40 : 20 }}>
                        {/* Total row */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ fontFamily: 'Manrope_600SemiBold', color: '#999', fontSize: 14 }}>Total</Text>
                            <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', color: '#f5f5f5', fontSize: 18 }}>${totalPrice.toFixed(2)}</Text>
                        </View>

                        {isHost ? (
                            <Pressable
                                onPress={submitOrderToKitchen}
                                disabled={submitting || cartItems.length === 0}
                                style={{ backgroundColor: '#22C55E', borderRadius: 16, paddingVertical: 16, alignItems: 'center', opacity: submitting || cartItems.length === 0 ? 0.6 : 1 }}
                            >
                                {submitting ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', color: '#fff', fontSize: 17 }}>
                                        Submit to Kitchen
                                    </Text>
                                )}
                            </Pressable>
                        ) : (
                            <View style={{ backgroundColor: '#1a1a1a', borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a', paddingVertical: 16, alignItems: 'center' }}>
                                <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', color: '#FF9933', fontSize: 16 }}>
                                    Waiting for host to submit…
                                </Text>
                                <Text style={{ fontFamily: 'Manrope_500Medium', color: '#666', fontSize: 12, marginTop: 4 }}>
                                    Keep adding items while you wait
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}
