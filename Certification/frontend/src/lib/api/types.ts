/**
 * Shared wire types used by every feature API module.
 *
 * NOTE (integration): these describe the contract documented for the
 * Certification Academy backend. Each feature module documents the actual
 * route it calls; response shapes must be verified against the running
 * backend before a screen is marked production-complete.
 * See docs/INTEGRATION_BLOCKERS.md.
 */

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

/**
 * Query parameters accepted by list endpoints.
 *
 * Declared as a type alias (not an interface) so it carries an implicit
 * index signature and stays assignable to the API client's generic
 * `Record<string, …>` query parameter.
 */
export type ListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
};

/** snake_case error envelope normalized by the API client. */
export interface ApiErrorBody {
  detail?: string;
  message?: string;
  code?: string;
  errors?: Record<string, string[] | string>;
  request_id?: string;
}
