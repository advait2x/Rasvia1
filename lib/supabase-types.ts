/**
 * This file contains TypeScript type definitions for your Supabase database schema.
 * 
 * To generate types automatically from your Supabase database:
 * 1. Install the Supabase CLI: npm install -g supabase
 * 2. Login: supabase login
 * 3. Generate types: supabase gen types typescript --project-id foermxfvridpykboihps > lib/supabase-types.ts
 * 
 * For now, you can manually define your database types here as you create tables.
 */

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            // Add your table definitions here
            // Example:
            // users: {
            //   Row: {
            //     id: string
            //     email: string
            //     created_at: string
            //   }
            //   Insert: {
            //     id?: string
            //     email: string
            //     created_at?: string
            //   }
            //   Update: {
            //     id?: string
            //     email?: string
            //     created_at?: string
            //   }
            // }
        }
        Views: {
            // Add your view definitions here
        }
        Functions: {
            // Add your function definitions here
        }
        Enums: {
            // Add your enum definitions here
        }
    }
}
