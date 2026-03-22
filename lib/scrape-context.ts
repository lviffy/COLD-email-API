import { ApiError } from "@/lib/errors";

export type PersonalizePayload = {
  linkedinUrl?: string;
  company?: string;
  role?: string;
};

export type ScrapedContext = {
  inputType: "linkedin_url" | "company_name";
  sourceUrl: string | null;
  prospect: {
    name: string;
    role: string;
    company: string;
  };
  contextSummary: string;
};

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match?.[1]) {
    return null;
  }

  return match[1].replace(/\s+/g, " ").trim();
}

async function fetchPageTitle(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "cold-email-personalizer/1.0",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    return extractTitle(html);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseLinkedInProfile(urlValue: string): { profileUrl: string; profileSlug: string } {
  let parsed: URL;
  try {
    parsed = new URL(urlValue);
  } catch {
    throw new ApiError(400, "INVALID_URL", "LinkedIn URL could not be parsed.");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname.includes("linkedin.com")) {
    throw new ApiError(400, "INVALID_URL", "LinkedIn URL must point to linkedin.com.");
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2 || segments[0] !== "in") {
    throw new ApiError(400, "INVALID_URL", "LinkedIn URL must be a public profile URL.");
  }

  const profileSlug = segments[1];
  parsed.search = "";
  parsed.hash = "";

  return { profileUrl: parsed.toString(), profileSlug };
}

function toNameFromSlug(slug: string): string {
  const normalized = slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .trim();

  return normalized || "Unknown Prospect";
}

function buildCompanyWebsite(company: string): string {
  const base = company
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

  return `https://${base}.com`;
}

export async function scrapeContext(payload: PersonalizePayload): Promise<ScrapedContext> {
  const linkedinUrl = payload.linkedinUrl?.trim();
  const company = payload.company?.trim();
  const role = payload.role?.trim() || "Unknown role";

  if (!linkedinUrl && !company) {
    throw new ApiError(400, "MISSING_INPUT", "Provide either `linkedinUrl` or `company`.");
  }

  if (linkedinUrl) {
    const { profileUrl, profileSlug } = parseLinkedInProfile(linkedinUrl);
    const pageTitle = await fetchPageTitle(profileUrl);
    const name = toNameFromSlug(profileSlug);
    const contextParts = [
      `Prospect name: ${name}.`,
      `Source profile: ${profileUrl}.`,
      pageTitle ? `Public profile title: ${pageTitle}.` : "No public profile title was extracted.",
      `Role hint provided by user: ${role}.`,
    ];

    return {
      inputType: "linkedin_url",
      sourceUrl: profileUrl,
      prospect: {
        name,
        role,
        company: company || "Unknown company",
      },
      contextSummary: contextParts.join(" "),
    };
  }

  const companyName = company ?? "";
  const website = buildCompanyWebsite(companyName);
  const pageTitle = await fetchPageTitle(website);

  if (!pageTitle) {
    throw new ApiError(422, "NO_DATA_FOUND", "Could not find enough public context to personalize.");
  }

  const contextParts = [
    `Company: ${companyName}.`,
    `Website: ${website}.`,
    `Public website title: ${pageTitle}.`,
    `Target role: ${role}.`,
  ];

  return {
    inputType: "company_name",
    sourceUrl: website,
    prospect: {
      name: "Unknown Prospect",
      role,
      company: companyName,
    },
    contextSummary: contextParts.join(" "),
  };
}
