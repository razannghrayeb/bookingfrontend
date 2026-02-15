import useSWR, { mutate as globalMutate } from "swr";
import {
  getResources,
  getAvailableResources,
  getUserBookings,
  getResourcesAvailability,
} from "./api";
import type { ResourceType } from "./types";

export function useResources(type?: ResourceType, pageSize = 100) {
  return useSWR(
    type ? ["resources", type, pageSize] : null,
    () => getResources(type!, 1, pageSize),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      errorRetryCount: 2,
      onError: (err) => {
        console.log("  useResources error for type", type, err);
      },
    }
  );
}

export function useAvailableResources(
  type: ResourceType | null,
  startUtc: string | null,
  endUtc: string | null
) {
  return useSWR(
    type && startUtc && endUtc
      ? ["available-resources", type, startUtc, endUtc]
      : null,
    () => getAvailableResources(type!, startUtc!, endUtc!),
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      errorRetryCount: 2,
    }
  );
}

export function useAvailability(type: ResourceType | null, dateStr: string | null) {
  return useSWR(
    type && dateStr ? ["availability", type, dateStr] : null,
    async () => {
      const apiResult = await getResourcesAvailability(type!, dateStr!, "07:00", "19:00", 60);
      const map = new Map<string, Set<string>>();

      for (const res of apiResult.resources || []) {
        for (const ts of res.timeSlots || []) {
          if (ts.status !== "available") continue;

          const parseHour = (t: string) => {
            const m = t.match(/(\d{2}):\d{2}/);
            if (m) return parseInt(m[1], 10);
            const d = new Date(t);
            if (!isNaN(d.getTime())) return d.getUTCHours();
            return NaN;
          };

          const startHour = parseHour(ts.startTime);
          const endHour = parseHour(ts.endTime);
          if (Number.isNaN(startHour) || Number.isNaN(endHour)) continue;

          for (let h = startHour; h < endHour; h++) {
            const set = map.get(String(h)) ?? new Set<string>();
            set.add(res.id);
            map.set(String(h), set);
          }
        }
      }

      return map;
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      errorRetryCount: 2,
      onError: (err) => console.log("  useAvailability error:", err),
    }
  );
}

export function useUserBookings(userId: string | null, pageNumber = 1, pageSize = 20) {
  return useSWR(
    userId ? ["user-bookings", userId, pageNumber, pageSize] : null,
    () => getUserBookings(userId!, pageNumber, pageSize),
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
      errorRetryCount: 2,
      onError: (err) => {
        console.log("  useUserBookings error:", err);
      },
    }
  );
}

export function invalidateBookings() {
  globalMutate(
    (key: unknown) => {
      if (Array.isArray(key)) {
        return key[0] === "user-bookings" || key[0] === "available-resources";
      }
      return false;
    },
    undefined,
    { revalidate: true }
  );
}

export function invalidateResources(type?: ResourceType) {
  globalMutate(
    (key: unknown) => {
      if (!Array.isArray(key)) return false;
      if (key[0] !== "resources") return false;
      if (!type) return true;
      return key[1] === type;
    },
    undefined,
    { revalidate: true }
  );

  try {
    globalMutate("resources-refresh-signal", Date.now(), false);
  } catch (err) {
  }
}

export async function refreshResourcesNow(type?: ResourceType, pageSize = 100) {
  if (type) {
    const key = ["resources", type, pageSize];
    await globalMutate(key, undefined, { revalidate: true });

    await globalMutate("resources-refresh-signal", Date.now(), false);
    return;
  }

  await globalMutate(
    (key: unknown) => Array.isArray(key) && key[0] === "resources",
    undefined,
    { revalidate: true }
  );

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  await globalMutate("resources-refresh-signal", Date.now(), false);
}
