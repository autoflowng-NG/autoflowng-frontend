import { useQuery } from "@tanstack/react-query";
import { connectionsAPI } from "../lib/api";

export function useConnections() {
  return useQuery({
    queryKey: ["connections"],
    queryFn: () =>
      connectionsAPI.list().then((d: any) => {
        const list = d.connections || d || [];
        return Array.isArray(list) ? list : [];
      }),
    staleTime: 60_000,
  });
}
