# Dash Nexus Invite Example

This example demonstrates a production-friendly Next.js App Router invite flow using Supabase and Resend.

## Setup

Copy or define these env vars in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM` (optional)
- `NEXT_PUBLIC_APP_URL`

## Install

```bash
cd examples/next-invite
npm install
```

## Run

```bash
npm run dev
```

## Notes

- `SUPABASE_SERVICE_ROLE_KEY` must stay secret and only be used server-side.
- This example uses a server API route for invite creation and a client App Router page for accept/reject.
- For production, add stronger request-rate limiting and background email delivery.
