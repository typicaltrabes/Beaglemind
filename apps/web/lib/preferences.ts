import { z } from 'zod/v4';

export const ThemeSchema = z.enum(['dark', 'light', 'auto']);
export const DefaultTabSchema = z.enum([
  'writers-room',
  'timeline',
  'boardroom',
  'canvas',
]);
export const DefaultVerbositySchema = z.enum(['quiet', 'normal', 'full']);
export const BrowserNotificationsSchema = z.enum(['on', 'off']);

/**
 * Full schema with every key REQUIRED — used to type the in-memory store
 * and the response shape from GET. PATCH bodies use `.partial()` of this.
 */
export const PreferencesSchema = z.object({
  theme: ThemeSchema,
  defaultTab: DefaultTabSchema,
  defaultVerbosity: DefaultVerbositySchema,
  browserNotifications: BrowserNotificationsSchema,
});

export type UserPreferences = z.infer<typeof PreferencesSchema>;

/**
 * The DEFAULT preferences applied when a user has no stored row, or when
 * a stored field is missing or fails validation. Per CONTEXT.md
 * `<decisions>` Item 6: theme default = 'dark', defaultTab = 'writers-room',
 * defaultVerbosity = 'normal', browserNotifications = 'off'.
 */
export const UserPreferencesDefault: UserPreferences = {
  theme: 'dark',
  defaultTab: 'writers-room',
  defaultVerbosity: 'normal',
  browserNotifications: 'off',
};

/**
 * Merges a partial set of preferences into a full default + existing.
 * Used by:
 *   - GET to project the stored partial JSONB onto the full shape.
 *   - PATCH to compute the final value before writing back to JSONB.
 *
 * Resilient to malformed stored data: if the existing JSONB has fields that
 * fail the schema, those fields are dropped and replaced with defaults.
 */
export function mergePreferences(
  base: UserPreferences,
  partial: unknown,
): UserPreferences {
  // Defensive: pick only known keys from `partial` and validate each
  // against its individual schema. Drop anything that fails.
  const safe: Partial<UserPreferences> = {};
  const obj = (partial && typeof partial === 'object' ? partial : {}) as Record<
    string,
    unknown
  >;
  const themeParse = ThemeSchema.safeParse(obj.theme);
  if (themeParse.success) safe.theme = themeParse.data;
  const tabParse = DefaultTabSchema.safeParse(obj.defaultTab);
  if (tabParse.success) safe.defaultTab = tabParse.data;
  const verbParse = DefaultVerbositySchema.safeParse(obj.defaultVerbosity);
  if (verbParse.success) safe.defaultVerbosity = verbParse.data;
  const notifParse = BrowserNotificationsSchema.safeParse(obj.browserNotifications);
  if (notifParse.success) safe.browserNotifications = notifParse.data;
  return { ...base, ...safe };
}

/** Schema used to validate PATCH bodies — every key is optional. */
export const PreferencesPatchSchema = PreferencesSchema.partial();
