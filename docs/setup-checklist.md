# Vetturo Setup Checklist

You do not need to block while the UI and app plumbing are being built.

You will need these when we move from mocked state to live infrastructure:

## Supabase
- Create a Supabase project
- Share:
  - project URL
  - anon key
  - service role key only if we add privileged server actions
- Create the storage buckets we agree on for:
  - documents
  - task attachments

## Vercel
- Create or connect a Vercel project
- Add environment variables from `.env.example`

## GitHub
- Optional while I keep building locally
- Helpful once you want:
  - source control
  - deploy previews
  - easier handoff and rollback

## Email
- Choose one:
  - Resend
  - Postmark
  - SendGrid
  - SMTP provider

## WhatsApp
- Choose one:
  - Meta WhatsApp Cloud API
  - Twilio WhatsApp

## What I can do without your credentials
- Finish frontend UX
- Build state and action architecture
- Add Supabase-ready client plumbing
- Add schema and storage model
- Prepare provider integration points

## What needs your credentials
- Real auth and invite flows
- Real storage uploads
- Real email sends
- Real WhatsApp sends
- Real webhook delivery/open/read/action tracking
