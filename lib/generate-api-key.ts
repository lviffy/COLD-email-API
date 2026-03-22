import { customAlphabet } from "nanoid";
import { ApiError } from "@/lib/errors";
import { getServiceSupabase } from "@/lib/supabase";

const makeId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 24);

type KeyRow = {
  id: string;
  key: string;
  user_id: string;
  requests_limit: number;
};

type QueryError = { message: string; code?: string } | null;

type ApiKeysInserter = {
  insert(values: {
    key: string;
    user_id: string;
    requests_limit: number;
    requests_used: number;
    is_active: boolean;
  }): {
    select(columns: "id,key,user_id,requests_limit"): {
      single(): Promise<{ data: KeyRow | null; error: QueryError }>;
    };
  };
};

export function generateApiKey(): string {
  return `ce_live_${makeId()}`;
}

export async function ensureUserApiKey(userId: string): Promise<KeyRow> {
  const supabase = getServiceSupabase();
  const apiKeysTable = supabase.from("api_keys") as unknown as ApiKeysInserter;

  const { data: existing, error: existingError } = await supabase
    .from("api_keys")
    .select("id,key,user_id,requests_limit")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    throw new ApiError(500, "FETCH_FAILED", "Failed to read API key.");
  }

  if (existing) {
    return existing as unknown as KeyRow;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const key = generateApiKey();
    const { data, error } = await apiKeysTable
      .insert({
        key,
        user_id: userId,
        requests_limit: 1000,
        requests_used: 0,
        is_active: true,
      })
      .select("id,key,user_id,requests_limit")
      .single();

    if (!error && data) {
      return data as unknown as KeyRow;
    }

    if (!error?.message?.toLowerCase().includes("duplicate") && error?.code !== "23505") {
      throw new ApiError(500, "FETCH_FAILED", "Failed to generate API key.");
    }
  }

  throw new ApiError(500, "FETCH_FAILED", "Failed to generate a unique API key.");
}
