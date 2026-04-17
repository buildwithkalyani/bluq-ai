import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: true }
    : { rejectUnauthorized: false },
});

export const auth = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
  user: {
    modelName: "users",
    fields: {
      emailVerified: "email_verified",
      image: "avatar_url",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    fields: {
      userId: "user_id",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  account: {
    fields: {
      userId: "user_id",
      accountId: "account_id",
      providerId: "provider_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  ...(process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_ID.startsWith("replace_") && {
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    },
  }),
  plugins: [
    emailOTP({
      sendVerificationOTP: async ({ email, otp }) => {
        const apiKey = process.env.RESEND_API_KEY;
        const from = process.env.RESEND_FROM_EMAIL || "BluQ <no-reply@bluq.ai>";

        if (!apiKey) {
          console.warn(`[OTP] RESEND_API_KEY not set. OTP for ${email} is: ${otp}`);
          return;
        }

        console.log(`[OTP] Sending to ${email} via Resend, from: ${from}`);

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [email],
            subject: "Your BluQ login code",
            html: `
              <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:32px 24px">
                <img src="https://bluq.ai/bluq-logo.png" alt="BluQ" style="height:18px;margin-bottom:24px" />
                <h2 style="font-size:20px;color:#24292f;margin:0 0 8px">Your login code</h2>
                <p style="color:#57606a;font-size:14px;margin:0 0 24px">Use the code below to sign in to BluQ. It expires in 10 minutes.</p>
                <div style="background:#f6f8fa;border:1px solid #D0D7DE;border-radius:8px;padding:20px 24px;text-align:center;margin-bottom:24px">
                  <span style="font-size:32px;font-weight:700;letter-spacing:10px;color:#24292f;font-family:monospace">${otp}</span>
                </div>
                <p style="color:#8C959F;font-size:12px;margin:0">If you didn't request this, you can safely ignore this email.</p>
              </div>
            `,
          }),
        }).then(async (res) => {
          if (!res.ok) {
            const body = await res.text();
            console.error("Resend OTP email failed:", res.status, body);
          }
        });
      },
    }),
  ],
});