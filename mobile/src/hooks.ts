import { useQuery } from "@tanstack/react-query";
import type { BrandDTO, CategoryDTO } from "@tamas/shared";
import { api } from "./api";
export type Bootstrap = {
  categories: CategoryDTO[];
  brands: BrandDTO[];
  settings: Record<string, string>;
  slides: Array<{
    id: number;
    imageUrl: string;
    linkUrl?: string;
    title?: string;
  }>;
};
export function useBootstrap() {
  return useQuery({
    queryKey: ["bootstrap"],
    queryFn: ({ signal }) =>
      api.get<Bootstrap>("/catalog/bootstrap", undefined, signal),
    staleTime: 60_000,
  });
}
