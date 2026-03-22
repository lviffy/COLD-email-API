import { ApiError } from "@/lib/errors";
import { getServiceSupabase } from "@/lib/supabase";

type ApiKeyProjection = {
  id: string;
  key: string;
  is_active: boolean;
  requests_used: number;
  requests_limit: number;
};

type QueryError = { message: string } | null;

type ApiKeysUpdater = {
  update(values: { requests_used: number }): {
    eq(column: "id", value: string): Promise<{ error: QueryError }>;
  };
};

type UsageLogsInserter = {
  insert(values: {
    api_key_id: string;
    endpoint: string;
    resource_id: string | null;
    status_code: number;
  }): Promise<{ error: QueryError }>;
};

type UsageLogsCounter = {
  select(
    columns: "id",
    options: { count: "exact"; head: true },
  ): {
    eq(column: "api_key_id", value: string): {
      gte(column: "created_at", value: string): {
        lt(column: "created_at", value: string): Promise<{ count: number | null; error: QueryError }>;
      };
    };
  };
};

export type ValidatedApiKey = {
  id: string;
  requestsLimit: number;
};

function getCurrentMonthRangeUtc(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    monthLabel: now.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
  };
}

export async function getMonthlyUsageStats(apiKeyId: string, monthlyLimit: number) {
  const supabase = getServiceSupabase();
  const usageLogsTable = supabase.from("usage_logs") as unknown as UsageLogsCounter;
  const monthRange = getCurrentMonthRangeUtc();

  const { count, error } = await usageLogsTable
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", apiKeyId)
    .gte("created_at", monthRange.startIso)
    .lt("created_at", monthRange.endIso);

  if (error) {
    throw new ApiError(500, "FETCH_FAILED", "Failed to read monthly usage.");
  }

  const used = count ?? 0;
  const remaining = Math.max(monthlyLimit - used, 0);

  return {
    monthLabel: monthRange.monthLabel,
    used,
    remaining,
    limit: monthlyLimit,
  };
}

export async function consumeQuotaForApiKey(apiKeyId: string, monthlyLimit: number): Promise<void> {
  const monthlyUsage = await getMonthlyUsageStats(apiKeyId, monthlyLimit);

  if (monthlyUsage.remaining <= 0) {
    throw new ApiError(402, "LIMIT_EXCEEDED", "Monthly request limit reached.");
  }

  const supabase = getServiceSupabase();
  const apiKeysTable = supabase.from("api_keys") as unknown as ApiKeysUpdater;
  const { error } = await apiKeysTable.update({ requests_used: monthlyUsage.used + 1 }).eq("id", apiKeyId);

  if (error) {
    throw new ApiError(500, "FETCH_FAILED", "Failed to update API key usage.");
  }
}

export async function validateAndConsumeApiKey(rawApiKey: string): Promise<ValidatedApiKey> {
  const apiKey = rawApiKey.trim();
  if (!apiKey) {
    throw new ApiError(401, "INVALID_API_KEY", "API key is required.");
  }

  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from("api_keys")
    .select("id,key,is_active,requests_used,requests_limit")
    .eq("key", apiKey)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "FETCH_FAILED", "Failed to validate API key.");
  }

  const row = data as unknown as ApiKeyProjection | null;

  if (!row || !row.is_active) {
    throw new ApiError(401, "INVALID_API_KEY", "API key is invalid or inactive.");
  }

  await consumeQuotaForApiKey(row.id, row.requests_limit);

  return {
    id: row.id,
    requestsLimit: row.requests_limit,
  };
}

export async function logUsage(params: {
  apiKeyId: string;
  endpoint: string;
  resourceId: string | null;
  statusCode: number;
}): Promise<void> {
  const supabase = getServiceSupabase();

  const usageLogsTable = supabase.from("usage_logs") as unknown as UsageLogsInserter;

  const { error } = await usageLogsTable.insert({
    api_key_id: params.apiKeyId,
    endpoint: params.endpoint,
    resource_id: params.resourceId,
    status_code: params.statusCode,
  });

  if (error) {
    console.error("Failed to write usage log", error.message);
  }
}
