import { useEffect, useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, ActivityIndicator, Modal, Platform } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export default function JoinPartyScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();

    // State
    const [guestName, setGuestName] = useState('');
    const [isJoined, setIsJoined] = useState(false);
    const [loading, setLoading] = useState(true);
    const [menu, setMenu] = useState<any[]>([]);
    const [cartItems, setCartItems] = useState<any[]>([]);
    const [restaurantName, setRestaurantName] = useState('');
    const [showCartModal, setShowCartModal] = useState(false);

    // Host Logic
    const [isHost, setIsHost] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Derived State
    const totalItems = cartItems.length;
    const totalPrice = cartItems.reduce((sum, item) => {
        // Handle both "joined" data (from DB) and "optimistic" data (local)
        const price = item.menu_items?.price || item.price || 0;
        return sum + price;
    }, 0);

    useEffect(() => {
        if (id) initializeParty();
    }, [id]);

    const initializeParty = async () => {
        try {
            // 1. Identify User (Guest Name)
            const storedName = await AsyncStorage.getItem(`party_name_${id}`);
            if (storedName) {
                setGuestName(storedName);
                setIsJoined(true);
            }

            // 2. Identify Host (Are YOU the owner?)
            const { data: { user } } = await supabase.auth.getUser();

            // 3. Fetch Session & Restaurant
            const { data: session, error } = await supabase
                .from('party_sessions')
                .select('restaurant_id, host_user_id, status, restaurants(name)')
                .eq('id', id)
                .single();

            if (error || !session) {
                setLoading(false);
                return;
            }

            // Check if current user is the host
            if (user && session.host_user_id === user.id) {
                setIsHost(true);
                // Hosts auto-join with their profile name if possible, or just "Host"
                if (!storedName) {
                    setGuestName("Host");
                    setIsJoined(true);
                    AsyncStorage.setItem(`party_name_${id}`, "Host");
                }
            }

            setRestaurantName((session.restaurants as any)?.name || "Restaurant");

            // 4. Fetch Menu
            const { data: menuItems } = await supabase
                .from('menu_items')
                .select('*')
                .eq('restaurant_id', session.restaurant_id);

            setMenu(menuItems || []);

            // 5. Fetch Cart & Listen
            fetchCart();

            const channel = supabase.channel(`party-${id}`)
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'party_items', filter: `session_id=eq.${id}` },
                    () => fetchCart()
                )
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
            .select('*, menu_items(name, price)')
            .eq('session_id', id);
        setCartItems(data || []);
    };

    const handleJoin = async () => {
        if (!guestName.trim()) return;
        await AsyncStorage.setItem(`party_name_${id}`, guestName);
        setIsJoined(true);
    };

    const addToCart = async (item: any) => {
        // 1. Instant Feedback (Haptics)
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        // 2. Optimistic Update (Fake it 'til you make it)
        // We add a temporary item to the list so it feels instant
        const tempId = Math.random().toString();
        const newItem = {
            id: tempId,
            menu_items: item, // Nest it so it matches DB structure
            added_by_name: guestName,
            price: item.price // Fallback
        };

        setCartItems(prev => [...prev, newItem]);

        // 3. Actual DB Insert
        const { error } = await supabase.from('party_items').insert({
            session_id: id,
            menu_item_id: item.id,
            added_by_name: guestName,
            quantity: 1,
        });

        if (error) {
            // Rollback if failed
            setCartItems(prev => prev.filter(i => i.id !== tempId));
            Alert.alert("Error", "Could not add item.");
        } else {
            // Success! The Realtime subscription will eventually replace our fake item with the real one.
            // We don't need to do anything else.
        }
    };

    const submitOrderToKitchen = async () => {
        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('party_sessions')
                .update({ status: 'submitted' })
                .eq('id', id);

            if (error) throw error;

            Alert.alert("Success!", "Order sent to kitchen!");
            setShowCartModal(false);
            // Optional: Navigate away or show a success screen
        } catch (e: any) {
            Alert.alert("Error", e.message);
        } finally {
            setSubmitting(false);
        }
    };

    // --- RENDER ---

    if (loading) {
        return <View className="flex-1 justify-center items-center bg-black"><ActivityIndicator color="#FF9933" /></View>;
    }

    // STATE 1: Enter Name
    if (!isJoined) {
        return (
            <View className="flex-1 justify-center bg-black p-6">
                <Stack.Screen options={{ headerShown: false }} />
                <Text className="text-3xl font-bold mb-2 text-white">Join {restaurantName}</Text>
                <Text className="text-gray-400 mb-8">Enter your name to join the group order.</Text>

                <TextInput
                    className="bg-gray-900 text-white p-4 rounded-lg mb-6 text-lg border border-gray-800"
                    placeholder="Your Name"
                    placeholderTextColor="#666"
                    value={guestName}
                    onChangeText={setGuestName}
                />
                <TouchableOpacity onPress={handleJoin} className="bg-[#FF9933] p-4 rounded-lg items-center">
                    <Text className="text-black font-bold text-lg">Start Ordering</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // STATE 2: The Menu (Ordering)
    return (
        <View className="flex-1 bg-black">
            <Stack.Screen options={{
                title: restaurantName,
                headerStyle: { backgroundColor: 'black' },
                headerTintColor: 'white',
                headerShadowVisible: false,
            }} />

            {/* Menu List */}
            <FlatList
                data={menu}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
                renderItem={({ item }) => (
                    <View className="flex-row justify-between items-center mb-4 p-4 bg-gray-900 rounded-xl border border-gray-800">
                        <View className="flex-1 mr-4">
                            <Text className="font-bold text-lg text-white">{item.name}</Text>
                            <Text className="text-gray-400 mt-1">${item.price}</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => addToCart(item)}
                            className="bg-white w-10 h-10 rounded-full items-center justify-center active:bg-gray-300"
                        >
                            <Ionicons name="add" size={24} color="black" />
                        </TouchableOpacity>
                    </View>
                )}
            />

            {/* FLOATING CART BUTTON */}
            {totalItems > 0 && (
                <View className="absolute bottom-10 left-5 right-5">
                    <TouchableOpacity
                        onPress={() => setShowCartModal(true)}
                        className="bg-[#FF9933] p-4 rounded-xl flex-row justify-between items-center shadow-lg"
                    >
                        <View className="bg-black/20 px-3 py-1 rounded-md">
                            <Text className="font-bold text-black">{totalItems}</Text>
                        </View>
                        <Text className="font-bold text-black text-lg">View Group Order</Text>
                        <Text className="font-bold text-black">${totalPrice.toFixed(2)}</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* CART MODAL */}
            <Modal visible={showCartModal} animationType="slide" presentationStyle="pageSheet">
                <View className="flex-1 bg-gray-900">
                    {/* Header */}
                    <View className="p-4 flex-row justify-between items-center border-b border-gray-800 bg-gray-900">
                        <Text className="text-xl font-bold text-white">Group Cart 🛒</Text>
                        <TouchableOpacity onPress={() => setShowCartModal(false)}>
                            <Text className="text-[#FF9933] font-bold text-lg">Close</Text>
                        </TouchableOpacity>
                    </View>

                    {/* List */}
                    <FlatList
                        data={cartItems}
                        keyExtractor={(item, index) => item.id || index.toString()}
                        contentContainerStyle={{ padding: 16 }}
                        renderItem={({ item }) => (
                            <View className="flex-row justify-between items-center mb-4 p-3 bg-black rounded-lg border border-gray-800">
                                <View>
                                    <Text className="text-white font-bold text-lg">{item.menu_items?.name || "Item"}</Text>
                                    <Text className="text-gray-500 text-sm">Added by {item.added_by_name}</Text>
                                </View>
                                <Text className="text-white font-bold">${item.menu_items?.price}</Text>
                            </View>
                        )}
                    />

                    {/* Footer Logic: Host vs Guest */}
                    <View className="p-6 bg-black border-t border-gray-800 safe-area-bottom">
                        {isHost ? (
                            <TouchableOpacity
                                onPress={submitOrderToKitchen}
                                disabled={submitting}
                                className="bg-[#22C55E] p-4 rounded-xl items-center shadow-lg"
                            >
                                {submitting ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text className="text-black font-bold text-xl">
                                        Submit Order (${totalPrice.toFixed(2)})
                                    </Text>
                                )}
                            </TouchableOpacity>
                        ) : (
                            <View className="items-center">
                                <Text className="text-gray-500 mb-1">Total: ${totalPrice.toFixed(2)}</Text>
                                <Text className="text-[#FF9933] font-bold text-lg animate-pulse">
                                    Waiting for host to submit...
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

        </View>
    );
}
