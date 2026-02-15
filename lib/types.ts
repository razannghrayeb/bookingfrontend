// ============================================
// API Response Types
// ============================================

export type ResourceType = "Room" | "Desk" | "ParkingSpot";

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  location: string;
  capacity: number;
  isActive: boolean;
}

export interface AvailableResource {
  id: string;
  name: string;
}

// Availability response for the slot-based endpoint (/resources/availability)
export interface TimeSlotAvailability {
  startTime: string; // e.g. "07:00" or ISO "2026-02-20T07:00:00"
  endTime: string; // e.g. "08:00" or ISO
  status: "available" | "booked" | string;
  bookingId?: string | null;
  isUserBooking?: boolean | null;
}

export interface ResourceAvailability {
  id: string;
  name: string;
  type: ResourceType;
  location: string;
  capacity: number;
  isActive: boolean;
  timeSlots: TimeSlotAvailability[];
}

export interface ResourcesAvailabilityResponse {
  date?: string;
  resources: ResourceAvailability[];
}

export interface Booking {
  id: string;
  userId: string;
  resourceId: string;
  startUtc: string;
  endUtc: string;
  createdAtUtc: string;
  status: "Active" | "Cancelled";
  cancelledAtUtc?: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface AuthTokens {
  userId: string;
  email: string;
  name: string;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
}

export interface SignUpResponse {
  userId: string;
  email: string;
  name: string;
  createdAtUtc: string;
}

export interface CancelBookingResponse {
  id: string;
  status: string;
  cancelledAtUtc: string;
}

export interface ApiError {
  type?: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  traceId?: string;
}

// ============================================
// UI Types
// ============================================

export interface TimeSlot {
  hour: number;
  label: string;
  startUtc: string;
  endUtc: string;
}

export interface SlotStatus {
  status: "available" | "yours" | "unavailable" | "past";
  bookingId?: string;
}

export interface DayColumn {
  date: Date;
  label: string;
  isWithin3Days: boolean;
  slots: TimeSlot[];
}
