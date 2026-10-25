declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    ANTHROPIC_API_KEY?: string;
    ANTHROPIC_MODEL?: string;
    RESEND_API_KEY?: string;
    INVITE_FROM_EMAIL?: string;
    PUBLIC_SITE_URL?: string;
    BUCKET?: R2Bucket;
  }
}
