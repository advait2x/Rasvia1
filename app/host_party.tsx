import { useState } from 'react';
import { View, Text, TouchableOpacity, Share, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth-context';

export default function HostPartyScreen() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { session } = useAuth(); // getting auth session

    // HARDCODED FOR DEMO: In real app, pass this from the previous screen
    const RESTAURANT_ID = 1;
    const USER_ID = session?.user?.id || "00000000-0000-0000-0000-000000000000";

    const startParty = async () => {
        if (!session?.user?.id) {
            Alert.alert("Error", "You must be logged in to host a party.");
            return;
        }
        setLoading(true);

        try {
            // 1. Create Session in DB
            const { data, error } = await supabase
                .from('party_sessions')
                .insert({
                    restaurant_id: RESTAURANT_ID,
                    host_user_id: USER_ID,
                    status: 'open'
                })
                .select()
                .single();

            if (error) throw error;

            // 2. Generate the "Smart Link"
            // Note: We point to your Web Bridge (Side B)
            const shareUrl = `http://172.20.10.5:5173/join?id=${data.id}`;

            // 3. Open Native Share Sheet
            await Share.share({
                message: `Let's order food! 🍔 Join my group cart here: ${shareUrl}`,
            });

            // 4. Navigate Host to the "Join" screen too (so they can order)
            router.push(`/join/${data.id}`);

        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 justify-center items-center bg-white p-6">
            <Text className="text-2xl font-bold mb-4">Eating with a Group?</Text>
            <Text className="text-gray-500 text-center mb-8">
                Start a shared cart. Everyone can add their own items from their own phone.
            </Text>

            <TouchableOpacity
                onPress={startParty}
                disabled={loading}
                className="bg-black w-full p-4 rounded-lg flex-row justify-center"
            >
                {loading ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <Text className="text-white font-bold text-lg">Start Group Order</Text>
                )}
            </TouchableOpacity>
        </View>
    );
}
