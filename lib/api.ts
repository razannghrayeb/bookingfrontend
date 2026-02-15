import type {
  AuthTokens,
  SignUpResponse,
  Resource,
  AvailableResource,
  Booking,
  PaginatedResponse,
  CancelBookingResponse,
  ResourceType,
  ApiError,
} from "./types";

// Use Next.js rewrite proxy to avoid CORS issues.
// In production you'd point NEXT_PUBLIC_API_BASE directly at your API gateway.
function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    // Client-side: call backend via `/api` (rewritten to your API target in next.config)
    return "/api";
  }
  // Server-side: call directly (for SSR if needed)
  const raw = process.env.NEXT_PUBLIC_API_URL || "https://localhost:7110";
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

// ============================================
// Token Management
// ============================================

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  if (typeof window !== "undefined") {
    localStorage.setItem("accessToken", access);
    localStorage.setItem("refreshToken", refresh);
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== "undefined") {
    accessToken = localStorage.getItem("accessToken");
  }
  return accessToken;
}

export function getRefreshToken(): string | null {
  if (refreshToken) return refreshToken;
  if (typeof window !== "undefined") {
    refreshToken = localStorage.getItem("refreshToken");
  }
  return refreshToken;
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
  }
}

// ============================================
// HTTP Helpers
// ============================================

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: ApiError;
    try {
      errorData = await response.json();
    } catch {
      errorData = {
        title: "Error",
        status: response.status,
        detail: response.statusText || "An unexpected error occurred",
      };
    }
    console.log("[v0] API error:", response.status, errorData);
    throw errorData;
  }

  // Handle 204 No Content
  const text = await response.text();
  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const rt = getRefreshToken();
  if (!rt) return false;

  const BASE_URL = getBaseUrl();

  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: rt }),
    });

    if (!response.ok) {
      clearTokens();
      return false;
    }

    const data: { userId: string; accessToken: string; refreshToken: string; refreshTokenExpiresAtUtc: string } =
      await response.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

async function authFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response = await fetch(url, { ...options, headers });

  // If 401, try refreshing
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${getAccessToken()}`;
      response = await fetch(url, { ...options, headers });
    } else {
      clearTokens();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw { title: "Session Expired", status: 401, detail: "Please log in again." } as ApiError;
    }
  }

  return handleResponse<T>(response);
}

// ============================================
// Auth API
// ============================================

export async function signup(name: string, email: string, password: string): Promise<SignUpResponse> {
  const BASE_URL = getBaseUrl();
  const response = await fetch(`${BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  return handleResponse<SignUpResponse>(response);
}

export async function login(email: string, password: string): Promise<AuthTokens> {
  const BASE_URL = getBaseUrl();
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse<AuthTokens>(response);
}

// ============================================
// Resources API
// ============================================

export async function getResources(
  type?: ResourceType,
  pageNumber = 1,
  pageSize = 100
): Promise<PaginatedResponse<Resource>> {
  const BASE_URL = getBaseUrl();
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  params.set("pageNumber", String(pageNumber));
  params.set("pageSize", String(pageSize));

  const response = await fetch(`${BASE_URL}/resources?${params.toString()}`);
  return handleResponse<PaginatedResponse<Resource>>(response);
}

export async function getAvailableResources(
  type: ResourceType,
  startUtc: string,
  endUtc: string
): Promise<{ resources: AvailableResource[] }> {
  const BASE_URL = getBaseUrl();
  const params = new URLSearchParams({
    type,
    startUtc,
    endUtc,
  });

  const response = await fetch(`${BASE_URL}/resources/available?${params.toString()}`);
  return handleResponse<{ resources: AvailableResource[] }>(response);
}

// New: fetch slot-based availability for a whole day/time range
export async function getResourcesAvailability(
  type: ResourceType,
  date: string,
  startTime: string,
  endTime: string,
  slotDuration = 60
): Promise<{ resources: import("./types").ResourceAvailability[] }> {
  const BASE_URL = getBaseUrl();
  const params = new URLSearchParams({
    type,
    date,
    startTime,
    endTime,
    slotDuration: String(slotDuration),
  });

  const response = await fetch(`${BASE_URL}/resources/availability?${params.toString()}`);
  return handleResponse<{ resources: import("./types").ResourceAvailability[] }>(response);
}

// ============================================
// Bookings API
// ============================================

export async function createBooking(
  resourceId: string,
  userId: string,
  startUtc: string,
  endUtc: string
): Promise<Booking> {
  const BASE_URL = getBaseUrl();
  return authFetch<Booking>(`${BASE_URL}/bookings`, {
    method: "POST",
    body: JSON.stringify({ resourceId, userId, startUtc, endUtc }),
  });
}

export async function getBookingById(id: string): Promise<Booking> {
  const BASE_URL = getBaseUrl();
  return authFetch<Booking>(`${BASE_URL}/bookings/${id}`);
}

export async function getUserBookings(
  userId: string,
  pageNumber = 1,
  pageSize = 20
): Promise<PaginatedResponse<Booking>> {
  const BASE_URL = getBaseUrl();
  const params = new URLSearchParams({
    pageNumber: String(pageNumber),
    pageSize: String(pageSize),
  });
  return authFetch<PaginatedResponse<Booking>>(`${BASE_URL}/bookings/user/${userId}?${params.toString()}`);
}

export async function cancelBooking(bookingId: string, userId: string): Promise<CancelBookingResponse> {
  const BASE_URL = getBaseUrl();
  return authFetch<CancelBookingResponse>(`${BASE_URL}/bookings/${bookingId}/cancel`, {
    method: "DELETE",
    body: JSON.stringify({ userId }),
  });
}
