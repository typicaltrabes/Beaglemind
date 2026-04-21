import { betterAuth } from 'better-auth';
import { organization, twoFactor } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { db } from '@beagle-console/db';
import * as authSchema from '@beagle-console/db/schema/auth-schema';
import { sendInviteEmail } from './email';

export const auth = betterAuth({
  appName: 'Beagle Agent Console',
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true, // D-05: invite-only, no public registration
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily
    cookieCache: {
      enabled: true,
      maxAge: 300, // 5 min cache
    },
  },
  plugins: [
    organization({
      async sendInvitationEmail(data) {
        const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite/${data.id}`;
        await sendInviteEmail({
          to: data.email,
          inviterName: data.inviter.user.name,
          orgName: data.organization.name,
          inviteLink,
          role: data.role,
        });
      },
      allowUserToCreateOrganization: false, // Only provisioning script creates orgs
      creatorRole: 'owner',
    }),
    twoFactor({
      issuer: 'Beagle Agent Console',
      totpOptions: { digits: 6, period: 30 },
      backupCodeOptions: { amount: 10, length: 8 },
    }),
    nextCookies(), // Required for Next.js cookie handling
  ],
});

export type Session = typeof auth.$Infer.Session;
