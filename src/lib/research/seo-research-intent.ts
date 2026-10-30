export type SeoResearchIntent = {
  rawQuestion: string;
  industry: string | null;
  geography: string | null;
  country: string | null;
  requestedCompetitorCount: number | null;
  comparisonDimensions: string[];
  isCompetitorResearch: boolean;
  isLocalMarketResearch: boolean;
  timeframe: string | null;
};

const COMPETITOR_COUNT_PATTERN =
  /\b(?:top\s*)?(\d{1,2})\b(?:\s+\w+){0,4}\s*(competitors?|agencies?|companies|firms)\b/i;

const GEO_CITY_PATTERN =
  /\b(?:in|for|based in|located in)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\b/;

const KNOWN_CITIES = [
  "Chennai",
  "Mumbai",
  "Bengaluru",
  "Bangalore",
  "Delhi",
  "Hyderabad",
  "Pune",
  "Kolkata",
];

export function parseSeoResearchIntent(question: string): SeoResearchIntent {
  const rawQuestion = question.trim();
  const lower = rawQuestion.toLowerCase();

  let geography: string | null = null;
  for (const city of KNOWN_CITIES) {
    if (lower.includes(city.toLowerCase())) {
      geography = city === "Bangalore" ? "Bengaluru" : city;
      break;
    }
  }
  if (!geography) {
    const geoMatch = rawQuestion.match(GEO_CITY_PATTERN);
    geography = geoMatch?.[1]?.trim() ?? null;
  }

  let country: string | null = null;
  if (/\bindia\b/i.test(rawQuestion)) {
    country = "India";
  }

  let requestedCompetitorCount: number | null = null;
  const countMatch = rawQuestion.match(COMPETITOR_COUNT_PATTERN);
  if (countMatch?.[1]) {
    requestedCompetitorCount = Number.parseInt(countMatch[1], 10);
  }

  const isCompetitorResearch =
    /\b(competitors?|competition|competitive|rival|benchmark)\b/i.test(rawQuestion);

  let industry: string | null = null;
  if (/\bseo agenc(y|ies)\b/i.test(rawQuestion)) {
    industry = "SEO agency";
  } else if (/\bdigital marketing agenc(y|ies)\b/i.test(rawQuestion)) {
    industry = "digital marketing agency";
  } else if (/\bseo\b/i.test(rawQuestion)) {
    industry = "SEO services";
  }

  const comparisonDimensions: string[] = [];
  if (/\bservice(s)?\b/i.test(rawQuestion)) {
    comparisonDimensions.push("services");
  }
  if (/\bposition(ing)?\b/i.test(rawQuestion)) {
    comparisonDimensions.push("positioning");
  }
  if (/\bcontent\b/i.test(rawQuestion)) {
    comparisonDimensions.push("content themes");
  }
  if (/\bpricing\b/i.test(rawQuestion)) {
    comparisonDimensions.push("pricing signals");
  }

  let timeframe: string | null = null;
  const timeMatch = rawQuestion.match(/\b(20\d{2}|Q[1-4]\s*20\d{2})\b/i);
  if (timeMatch?.[1]) {
    timeframe = timeMatch[1];
  }

  return {
    rawQuestion,
    industry,
    geography,
    country,
    requestedCompetitorCount,
    comparisonDimensions,
    isCompetitorResearch,
    isLocalMarketResearch: Boolean(geography || country),
    timeframe,
  };
}
