const REFRESH_TOKEN_KEY = "po_refresh_token";

let accessToken: string | null = null;
let refreshToken: string | null =
  typeof window !== "undefined" ? window.localStorage.getItem(REFRESH_TOKEN_KEY) : null;

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  return refreshToken;
}

export function setTokens(tokens: { access_token: string; refresh_token: string }) {
  accessToken = tokens.access_token;
  refreshToken = tokens.refresh_token;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  }
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}
