import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Session } from '@supabase/supabase-js';

interface AuthContextType {
    session: Session | null;
    loading: boolean;
    needsOnboarding: boolean;
    setNeedsOnboarding: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    loading: true,
    needsOnboarding: false,
    setNeedsOnboarding: () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [needsOnboarding, setNeedsOnboarding] = useState(false);

    async function checkOnboardingStatus(userId: string) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('onboarding_completed')
                .eq('id', userId)
                .maybeSingle();

            if (error) {
                console.log('Profiles check skipped:', error.message);
                setNeedsOnboarding(false);
                return;
            }

            if (!data) {
                setNeedsOnboarding(true);
                return;
            }

            setNeedsOnboarding(!data.onboarding_completed);
        } catch {
            setNeedsOnboarding(false);
        }
    }

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            setSession(session);
            if (session?.user?.id) {
                await checkOnboardingStatus(session.user.id);
            }
            setLoading(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session);
            if (session?.user?.id) {
                // Keep loading=true until we know if onboarding is needed.
                // This prevents a flash of the home screen for new users.
                setLoading(true);
                // Small delay so the profile upsert (from auth.tsx signUp) can
                // complete before we read onboarding_completed.
                await new Promise(r => setTimeout(r, 800));
                await checkOnboardingStatus(session.user.id);
                setLoading(false);
            } else {
                setNeedsOnboarding(false);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ session, loading, needsOnboarding, setNeedsOnboarding }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
