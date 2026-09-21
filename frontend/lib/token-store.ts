const REFRESH_TOKEN_KEY = "po_refresh_token";

let accessToken: string | null = null;

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens: {
  access_token: string;
  refresh_token: string;
}) {
  accessToken = tokens.access_token;

  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      REFRESH_TOKEN_KEY,
      tokens.refresh_token
    );
  }
}

export function clearTokens() {
  accessToken = null;

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}