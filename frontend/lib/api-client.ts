import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./token-store";
import type { TokenResponse, UserOut } from "@/types/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.detail ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new ApiError(res.status, await parseErrorMessage(res));
  const tokens: TokenResponse = await res.json();
  setTokens(tokens);
  return tokens;
}

export async function refresh(): Promise<TokenResponse | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) {
    clearTokens();
    return null;
  }
  const tokens: TokenResponse = await res.json();
  setTokens(tokens);
  return tokens;
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    // Best-effort — don't block clearing local state on network success.
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch(() => undefined);
  }
  clearTokens();
}

export async function getMe(): Promise<UserOut> {
  return authedFetch<UserOut>("/auth/me");
}

/**
 * Fetch wrapper for any authenticated API call. Attaches the current
 * access token; on a 401, tries exactly one silent refresh and retries
 * the request once before giving up. This is the function the rest of
 * the app should use for authenticated requests, not raw fetch().
 */
export async function authedFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const doFetch = () =>
    fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${getAccessToken()}`,
      },
    });

  let res = await doFetch();

  if (res.status === 401) {
    const refreshed = await refresh();
    if (!refreshed) {
      throw new ApiError(401, "Session expired");
    }
    res = await doFetch();
  }

  if (!res.ok) throw new ApiError(res.status, await parseErrorMessage(res));
  if (res.status === 204) return undefined as T;
  return res.json();
}
