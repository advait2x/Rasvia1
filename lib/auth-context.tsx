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
    // Track whether we're still checking onboarding status
    const [onboardingChecking, setOnboardingChecking] = useState(false);

    async function checkOnboardingStatus(userId: string) {
        setOnboardingChecking(true);
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
        } finally {
            setOnboardingChecking(false);
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
                await checkOnboardingStatus(session.user.id);
            } else {
                setNeedsOnboarding(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Combine both loading states: initial load + onboarding check
    const isLoading = loading || onboardingChecking;

    return (
        <AuthContext.Provider value={{ session, loading: isLoading, needsOnboarding, setNeedsOnboarding }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
