import { isSupabaseConfigured } from "../lib/supabaseClient.js";

const initialMode = isSupabaseConfigured ? "supabase" : "local";
const initialReason = isSupabaseConfigured ? "" : "not-configured";

const runtime = {
  reviews: { mode: initialMode, reason: initialReason },
  interactions: { mode: initialMode, reason: initialReason },
};

function normalizeArea(area) {
  return area === "interactions" ? "interactions" : "reviews";
}

export function shouldUseLocalSchoolRating(area = "reviews") {
  return runtime[normalizeArea(area)].mode === "local";
}

export function activateLocalSchoolRatingFallback(area = "reviews", error = null) {
  const key = normalizeArea(area);
  runtime[key] = {
    mode: "local",
    reason: isSupabaseConfigured ? "backend-unavailable" : "not-configured",
  };
  if (key === "reviews") {
    runtime.interactions = {
      mode: "local",
      reason: runtime[key].reason,
    };
  }

  if (error && typeof console !== "undefined") {
    // Avoid exposing connection details in the UI while retaining a useful console breadcrumb.
    // eslint-disable-next-line no-console
    console.warn(`School rating ${key} switched to local fallback.`, error?.code || error?.message || "unknown error");
  }
}

export function isSchoolRatingFallbackError(error) {
  const code = String(error?.code || "");
  const status = Number(error?.status || error?.statusCode || 0);
  const message = [error?.message, error?.details, error?.hint, error?.name].filter(Boolean).join(" ");
  return (
    ["42P01", "42883", "PGRST202"].includes(code) ||
    status >= 500 ||
    /fetch failed|failed to fetch|networkerror|network request|enotfound|econn(?:refused|reset)|aborterror|timed?\s*out/i.test(message)
  );
}

export function resetSchoolRatingRuntime() {
  runtime.reviews = { mode: initialMode, reason: initialReason };
  runtime.interactions = { mode: initialMode, reason: initialReason };
}

export function getSchoolRatingRuntimeStatus() {
  return {
    reviewMode: runtime.reviews.mode,
    interactionMode: runtime.interactions.mode,
    reviewReason: runtime.reviews.reason,
    interactionReason: runtime.interactions.reason,
    usesLocalReviews: runtime.reviews.mode === "local",
    usesLocalInteractions: runtime.interactions.mode === "local",
  };
}
