import env from "../config/env.js";

const ALLOWED_PATH = /^\/(movie|trending|search)(\/[A-Za-z0-9_-]+)*$/;
const TMDB_TIMEOUT_MS = 5_000;

interface tmdbRequestSuccessResponse<T = any> {
  success: true;
  body: T;
}

interface tmdbRequestErrorResponse {
  success: false;
  error: string;
  statusCode?: number;
}

type tmdbRequestResponse<T = any> =
  | tmdbRequestSuccessResponse<T>
  | tmdbRequestErrorResponse;

export default async function tmdbRequest<T = any>(
  path: string,
  params: Record<string, string> = {},
): Promise<tmdbRequestResponse<T>> {
  const token = env.tmdbToken;

  if (!ALLOWED_PATH.test(path)) {
    return { success: false, error: "Invalid path" };
  }

  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") urlParams.set(key, value);
  }
  const queryString = urlParams.size > 0 ? `?${urlParams.toString()}` : "";

  try {
    const upstream = await fetch(
      `https://api.themoviedb.org/3${path}${queryString}`,
      {
        signal: AbortSignal.timeout(TMDB_TIMEOUT_MS),
        headers: {
          Authorization: `Bearer ${token}`,
          accept: "application/json",
        },
      },
    );

    const body = await upstream.json().catch((error) => {
      console.error("Failed to parse JSON response from TMDB:", error);
      return null;
    });

    if (!upstream.ok) {
      const errorMessage =
        (body as any)?.status_message ||
        upstream.statusText ||
        `TMDB request failed with status ${upstream.status}`;
      return {
        success: false,
        error: errorMessage,
        statusCode: upstream.status,
      };
    }

    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return {
        success: false,
        error: "Invalid JSON response from TMDB",
        statusCode: 502,
      };
    }

    return { success: true, body: body as T };
  } catch (err: unknown) {
    console.error("TMDB proxy fetch error:", err);

    if (err instanceof Error && err.name === "TimeoutError") {
      return {
        success: false,
        error: "TMDB request timed out",
        statusCode: 504,
      };
    }

    const message =
      err instanceof Error
        ? err.message
        : "Upstream request failed in catch block";
    return { success: false, error: message };
  }
}
