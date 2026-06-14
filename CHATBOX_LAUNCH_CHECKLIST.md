# BCF Chatbox – Launch Checklist

Operational checklist for configuring and launching the BCF Confection chatbox
email handoff. Recipients and provider credentials are **server-side only** and
are never exposed to the frontend.

## 1. Local development configuration

- [ ] `APP_ENV=development`
- [ ] `CHATBOX_HANDOFF_TEST_TO` is set and used for all test emails
- [ ] `CHATBOX_HANDOFF_TO` is **not** used in development (production recipient only)
- [ ] `CHATBOX_MAIL_FROM` may use `onboarding@resend.dev` for local testing
- [ ] `.env` must **not** be committed (it is git-ignored; keep it that way)

In development/staging the backend routes every handoff email to
`CHATBOX_HANDOFF_TEST_TO`. If that variable is missing, the handoff fails safely
(generic `503`) rather than falling back to the production recipient.

## 2. Production configuration

- [ ] `APP_ENV=production`
- [ ] `CHATBOX_HANDOFF_TO` is the **approved client recipient**
- [ ] `CHATBOX_HANDOFF_TEST_TO` is ignored in production
- [ ] `CHATBOX_MAIL_FROM` uses a **verified sender / domain** (not a sandbox sender)
- [ ] Real provider credentials (e.g. `RESEND_API_KEY` or SMTP settings) are
      configured **server-side only**

In production the backend routes every handoff email to `CHATBOX_HANDOFF_TO`. If
that variable is missing, the handoff fails safely (generic `503`) and never
falls back to the test recipient.

## 3. Pre-launch checks

- [ ] All backend tests pass (`python -m pytest`)
- [ ] Chatbox answers **only** from approved intents (`chatbox-intents.nl.json`)
- [ ] Unsupported questions fall back safely (no guessing)
- [ ] Email handoff requires explicit **consent** and a **confirmation** step
- [ ] No full conversation history is sent to the backend
- [ ] No secrets, recipients, or provider details appear in frontend code
- [ ] Session-only storage works (survives refresh, cleared when tab closes)
- [ ] Keyboard focus trap works while the chatbox is open
- [ ] Mobile layout remains usable
- [ ] Rate limiting works on the handoff endpoint

## 4. Launch decision

- [ ] **Do not** switch `APP_ENV=production` until the client approves real email
      delivery
- [ ] **Do not** use `onboarding@resend.dev` for final production
- [ ] Verify exactly **one** production email **only after** client approval
