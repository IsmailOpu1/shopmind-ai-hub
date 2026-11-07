# Launch checklist

What has to happen before real stores use ShopMind. Items marked **Owner** need
Opu's account, money or a decision; the rest is done in code.

## Done in code

- `vercel.json`: single-page-app routing (deep links like `/dashboard/analytics`
  load the app), security headers, long caching for hashed assets, 5-minute
  caching for `embed.js` so widget updates reach stores quickly.
- Page title and share text say "ShopMind AI" (was "Lovable App").
- Production builds leave out `embed-demo.html` (it chats with the demo store).
- A production build fails with a clear message if `VITE_SUPABASE_URL` or
  `VITE_SUPABASE_ANON_KEY` is missing, instead of shipping a broken widget.

## Owner: before launch

1. **Model capacity (costs money).** The free tiers allow about 20 Gemini
   replies and 50 OpenRouter replies a day for the whole product. Options:
   - add $10 of OpenRouter credits: the free-model limit goes from 50 to
     1000 requests a day (OpenRouter's own figure, from its rate-limit error);
   - enable billing on the Gemini key (pay per use).
   Set keys only as Supabase edge secrets (`GEMINI_API_KEY`,
   `OPENROUTER_API_KEY`), never in chat or in the repo.
2. **Vercel project.** Create a project from the GitHub repo (or let Claude
   create it). Environment variables (all public values, from `.env`):
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. **Domain.** Pick and connect the production domain in Vercel.
4. **Supabase Auth URLs.** Authentication → URL Configuration:
   Site URL = `https://<domain>`; add `https://<domain>/login` to Redirect URLs.
   Without this, sign-up confirmation emails link to localhost.
5. **Email sending.** Supabase's built-in email sender only allows a few emails
   an hour, which blocks sign-ups at launch. Connect a custom SMTP provider
   (Authentication → Emails → SMTP).
6. **Leaked-password protection.** Authentication → Attack Protection.
7. **Optional:** set an `IP_HASH_SALT` edge secret so hashed shopper IPs can't
   be matched across projects.
8. **Name.** The rename is still deferred; the code says "ShopMind AI".
9. **Privacy page.** The widget stores shopper messages and a hashed IP for
   rate limits and analytics. Stores need a privacy notice they can link to.
   Claude can draft one; the wording is the owner's to approve.

## After deploying

- Open `https://<domain>/login`, sign up with a new account, confirm the email
  link points at the domain.
- In Chatbot Settings, copy the embed snippet: it must show
  `https://<domain>/embed.js`.
- Paste the snippet into a test page and send a message.
