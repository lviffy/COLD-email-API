import { NextResponse } from "next/server";
import { ApiError, toApiError } from "@/lib/errors";
import { generateLines } from "@/lib/generate-lines";
import { scrapeContext, type PersonalizePayload } from "@/lib/scrape-context";
import { getMonthlyUsageStats, logUsage, validateAndConsumeApiKey } from "@/lib/validate-key";

type PersonalizeResponse = {
  prospect: {
    name: string;
    role: string;
    company: string;
  };
  lines: Array<{
    tone: "curious" | "direct" | "compliment";
    text: string;
  }>;
  usage: {
    requests_used: number;
    requests_limit: number;
  };
};

export async function POST(request: Request) {
  const apiKeyHeader = request.headers.get("x-api-key") ?? "";
  let keyContext: { id: string; requestsLimit: number } | null = null;
  let resourceIdForLog: string | null = null;

  try {
    keyContext = await validateAndConsumeApiKey(apiKeyHeader);

    let payload: PersonalizePayload = {};
    try {
      payload = (await request.json()) as PersonalizePayload;
    } catch {
      throw new ApiError(400, "MISSING_INPUT", "A JSON body is required.");
    }

    const scraped = await scrapeContext(payload);
    resourceIdForLog = scraped.sourceUrl ?? scraped.prospect.company;

    const lines = await generateLines({
      contextSummary: scraped.contextSummary,
    });

    const usage = await getMonthlyUsageStats(keyContext.id, keyContext.requestsLimit);

    const result: PersonalizeResponse = {
      prospect: scraped.prospect,
      lines,
      usage: {
        requests_used: usage.used,
        requests_limit: usage.limit,
      },
    };

    await logUsage({
      apiKeyId: keyContext.id,
      endpoint: "/api/v1/personalize",
      resourceId: resourceIdForLog,
      statusCode: 200,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const apiError = toApiError(error);

    if (keyContext) {
      await logUsage({
        apiKeyId: keyContext.id,
        endpoint: "/api/v1/personalize",
        resourceId: resourceIdForLog,
        statusCode: apiError.status,
      });
    }

    return NextResponse.json(
      {
        error: {
          code: apiError.code,
          message: apiError.message,
        },
      },
      { status: apiError.status },
    );
  }
}
