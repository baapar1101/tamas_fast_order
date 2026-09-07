export interface PageParams {
  page: number;
  perPage: number;
}

export function offsetOf({ page, perPage }: PageParams): number {
  return (page - 1) * perPage;
}

export function paged<T>(items: T[], total: number, params: PageParams) {
  return { items, total, page: params.page, perPage: params.perPage };
}
