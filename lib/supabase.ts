import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Database = {
  public: {
    Tables: {
      api_keys: {
        Row: {
          id: string;
          key: string;
          user_id: string;
          created_at: string;
          requests_used: number;
          requests_limit: number;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          key: string;
          user_id: string;
          created_at?: string;
          requests_used?: number;
          requests_limit?: number;
          is_active?: boolean;
        };
        Update: {
          key?: string;
          user_id?: string;
          requests_used?: number;
          requests_limit?: number;
          is_active?: boolean;
        };
      };
      usage_logs: {
        Row: {
          id: string;
          api_key_id: string;
          endpoint: string;
          resource_id: string | null;
          status_code: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          api_key_id: string;
          endpoint: string;
          resource_id?: string | null;
          status_code: number;
          created_at?: string;
        };
        Update: {
          endpoint?: string;
          resource_id?: string | null;
          status_code?: number;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let cachedClient: SupabaseClient<Database> | null = null;

function getEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getServiceSupabase() {
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  cachedClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}

export function getRequiredEnv(name: string): string {
  return getEnv(name);
}
