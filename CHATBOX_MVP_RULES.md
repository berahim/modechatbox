# BCF Chatbox MVP Rules

## Goal
Build a Dutch MVP chatbox for the BCF Confection website.

The chatbox must be secure, performant, privacy-conscious, accessible, and simple.

## Core rule
The chatbox may only answer using the approved Dutch intent matrix.

If the answer is not clearly available in the approved matrix, the chatbox must not guess. It must politely refuse and offer to forward the question by email.

## MVP behavior
- Floating chat button.
- Open/close chat panel.
- Dutch welcome message.
- Quick buttons.
- Free-text input.
- Session-only conversation history.
- No permanent conversation storage.
- Email handoff only after user consent.
- Final confirmation before sending email.

## Not allowed
- Do not invent answers.
- Do not estimate prices.
- Do not answer from general knowledge.
- Do not store full conversations permanently.
- Do not expose secrets or email credentials client-side.
- Do not hardcode the internal email destination in public frontend code.
- Do not collect personal data unless the user agrees to email handoff.
- Do not send email without final confirmation.

## Email handoff
When the chatbox cannot answer, ask:

“Ik kan deze vraag niet met zekerheid beantwoorden op basis van de informatie op onze website. Wilt u dat ik uw vraag doorstuur naar BCF Confection?”

If yes, collect:
- name, required
- email, required
- question, required
- company name, optional

Then show a confirmation summary and ask for final approval.

## Security
- Treat all user input as untrusted.
- Validate inputs.
- Escape displayed user messages.
- Rate-limit chat and email submissions.
- Keep email sending server-side.
- Keep secrets in environment variables.
- Prevent duplicate submissions.

## Performance
- Do not block initial page load.
- Load minimal chat UI first.
- Keep the chatbox lightweight.
- Show loading and error states.

## Accessibility
- Keyboard usable.
- Clear labels.
- Correct focus behavior.
- Mobile friendly.
- Good contrast.
- Escape closes the chat panel.