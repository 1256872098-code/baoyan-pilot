import { isSupabaseConfigured } from "../lib/supabaseClient.js";

const initialMode = isSupabaseConfigured ? "supabase" : "local";
const initialReason = isSupabaseConfigured ? "" : "not-configured";
const initialFeatureStatus = isSupabaseConfigured ? "unknown" : "local";

const runtime = {
  reviews: { mode: initialMode, reason: initialReason },
  rpc: { status: initialFeatureStatus, error: null },
  likes: { status: initialFeatureStatus, error: null },
  dislikes: { status: initialFeatureStatus, error: null },
};

const requestLabels = {
  reviews: "reviews",
  rpc: "RPC",
  likes: "likes",
  dislikes: "dislikes",
};

function isDevelopment() {
  return Boolean(typeof import.meta.env !== "undefined" && import.meta.env.DEV);
}

function getSafeError(error) {
  const rootError = error?.cause || error;
  return {
    code: String(error?.code || rootError?.code || error?.status || error?.statusCode || rootError?.name || "unknown"),
    message: String(error?.message || error?.details || rootError?.message || "Unknown error"),
  };
}

export function logSchoolRatingRequest(area, error = null) {
  if (!isDevelopment() || typeof console === "undefined") return;
  const label = requestLabels[area] || String(area || "unknown");
  if (error) {
    // Only the public error code/message is logged. Supabase URL and keys are never included.
    // eslint-disable-next-line no-console
    console.warn(`[SchoolRating] ${label}: failed`, getSafeError(error));
    return;
  }
  // eslint-disable-next-line no-console
  console.info(`[SchoolRating] ${label}: ok`);
}

export function shouldUseLocalSchoolRating(area = "reviews") {
  if (area === "interactions") return runtime.reviews.mode === "local";
  return runtime.reviews.mode === "local";
}

export function activateLocalSchoolRatingFallback(area = "reviews", error = null) {
  if (area !== "reviews") return;
  runtime.reviews = {
    mode: "local",
    reason: isSupabaseConfigured ? "backend-unavailable" : "not-configured",
  };

  if (error && typeof console !== "undefined") {
    // Avoid exposing connection details in the UI while retaining a useful console breadcrumb.
    // eslint-disable-next-line no-console
    console.warn("School rating reviews switched to local fallback.", getSafeError(error));
  }
}

export function markSchoolRatingRequestOk(area) {
  if (area === "reviews") {
    runtime.reviews = { mode: "supabase", reason: "" };
  } else if (runtime[area]) {
    runtime[area] = { status: "ok", error: null };
  }
  logSchoolRatingRequest(area);
}

export function markSchoolRatingRequestFailed(area, error) {
  if (area !== "reviews" && runtime[area]) {
    runtime[area] = { status: "failed", error: getSafeError(error) };
  }
  logSchoolRatingRequest(area, error);
}

export function isSchoolRatingFeatureAvailable(area) {
  if (runtime.reviews.mode === "local") return true;
  return runtime[area]?.status !== "failed";
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
  runtime.rpc = { status: initialFeatureStatus, error: null };
  runtime.likes = { status: initialFeatureStatus, error: null };
  runtime.dislikes = { status: initialFeatureStatus, error: null };
}

export function getSchoolRatingRuntimeStatus() {
  const usesLocalReviews = runtime.reviews.mode === "local";
  return {
    reviewMode: runtime.reviews.mode,
    interactionMode: usesLocalReviews ? "local" : "supabase",
    reviewReason: runtime.reviews.reason,
    interactionReason: "",
    usesLocalReviews,
    usesLocalInteractions: usesLocalReviews,
    rpcAvailable: usesLocalReviews || runtime.rpc.status !== "failed",
    likesAvailable: usesLocalReviews || runtime.likes.status !== "failed",
    dislikesAvailable: usesLocalReviews || runtime.dislikes.status !== "failed",
    rpcStatus: runtime.rpc.status,
    likesStatus: runtime.likes.status,
    dislikesStatus: runtime.dislikes.status,
  };
}
