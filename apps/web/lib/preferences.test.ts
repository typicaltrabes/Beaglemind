import { describe, it, expect } from 'vitest';
import {
  PreferencesSchema,
  PreferencesPatchSchema,
  UserPreferencesDefault,
  mergePreferences,
} from './preferences';

describe('PreferencesSchema', () => {
  it('accepts the default object', () => {
    expect(PreferencesSchema.safeParse(UserPreferencesDefault).success).toBe(true);
  });
  it('rejects unknown theme', () => {
    expect(
      PreferencesSchema.safeParse({ ...UserPreferencesDefault, theme: 'pink' })
        .success,
    ).toBe(false);
  });
  it('PATCH schema accepts a single-field body', () => {
    expect(PreferencesPatchSchema.safeParse({ theme: 'light' }).success).toBe(true);
  });
  it('PATCH schema rejects unknown values', () => {
    expect(PreferencesPatchSchema.safeParse({ theme: 'pink' }).success).toBe(false);
  });
});

describe('mergePreferences', () => {
  it('returns base unchanged when partial is empty', () => {
    expect(mergePreferences(UserPreferencesDefault, {})).toEqual(UserPreferencesDefault);
  });
  it('overrides only the supplied keys', () => {
    expect(mergePreferences(UserPreferencesDefault, { theme: 'light' })).toEqual({
      theme: 'light',
      defaultTab: 'writers-room',
      defaultVerbosity: 'normal',
      browserNotifications: 'off',
    });
  });
  it('drops malformed fields and falls through to base', () => {
    expect(
      mergePreferences(UserPreferencesDefault, {
        theme: 'pink',
        defaultVerbosity: 'normal',
      }),
    ).toEqual({
      theme: 'dark', // pink dropped, default applied
      defaultTab: 'writers-room',
      defaultVerbosity: 'normal',
      browserNotifications: 'off',
    });
  });
  it('handles non-object partial gracefully', () => {
    expect(mergePreferences(UserPreferencesDefault, null)).toEqual(UserPreferencesDefault);
    expect(mergePreferences(UserPreferencesDefault, 'banana')).toEqual(
      UserPreferencesDefault,
    );
  });
});
