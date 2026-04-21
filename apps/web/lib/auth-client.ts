import { createAuthClient } from 'better-auth/react';
import { organizationClient, twoFactorClient } from 'better-auth/client/plugins';

const client = createAuthClient({
  plugins: [
    organizationClient(),
    twoFactorClient({
      twoFactorPage: '/mfa-challenge',
    }),
  ],
});

export const signIn = client.signIn;
export const signUp = client.signUp;
export const signOut = client.signOut;
export const useSession = client.useSession;

// Plugin clients
export const orgClient = client.organization;
export const twoFactor = client.twoFactor;
