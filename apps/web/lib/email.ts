import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendInviteEmail(params: {
  to: string;
  inviterName: string;
  orgName: string;
  inviteLink: string;
  role: string;
}) {
  const { to, inviterName, orgName, inviteLink, role } = params;

  if (!resend) {
    // Dev fallback: log invite link when RESEND_API_KEY is not configured
    console.log(
      `[DEV] Invite email for ${to} to join ${orgName} as ${role}:\n` +
        `  Invited by: ${inviterName}\n` +
        `  Accept link: ${inviteLink}`
    );
    return;
  }

  await resend.emails.send({
    from: 'Beagle Console <noreply@beaglemind.ai>',
    to,
    subject: `You've been invited to ${orgName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; background: #0f1115; color: #e5e7eb;">
        <h2 style="color: #ffffff; margin-bottom: 8px;">Join ${orgName} on Beagle Console</h2>
        <p style="color: #9ca3af; margin-bottom: 24px;">${inviterName} has invited you as <strong style="color: #e5e7eb;">${role}</strong>.</p>
        <a href="${inviteLink}" style="
          display: inline-block;
          padding: 12px 24px;
          background: #f7b733;
          color: #0f1115;
          text-decoration: none;
          border-radius: 6px;
          font-weight: bold;
        ">Accept Invitation</a>
        <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">If you did not expect this invitation, you can safely ignore this email.</p>
      </div>
    `,
  });
}
