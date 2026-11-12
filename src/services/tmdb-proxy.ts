import "dotenv/config";

const ALLOWED_PATH = /^\/(movie|trending|search)(\/[A-Za-z0-9_-]+)*$/;

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
  const token = process.env.TMDB_TOKEN;
  if (!token) {
    return { success: false, error: "Server is missing TMDB_TOKEN" };
  }

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
    return { success: true, body: body as T };
  } catch (err: unknown) {
    console.error("TMDB proxy fetch error:", err);
    const message =
      err instanceof Error ? err.message : "Upstream request failed in catch block";
    return { success: false, error: message };
  }
}
