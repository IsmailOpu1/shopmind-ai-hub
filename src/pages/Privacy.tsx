import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import { PRIVACY_UPDATED, SUPPORT_EMAIL } from "@/lib/legal";

/** Public privacy policy: what ShopMind stores for store owners and shoppers. */
export default function Privacy() {
  useEffect(() => {
    document.title = "Privacy · ShopMind AI";
  }, []);

  return (
    <div className="landing relative min-h-screen text-slate-300">
      <div className="landing-bg" aria-hidden="true" />
      <header className="relative border-b border-white/[0.06]">
        <nav className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6" aria-label="Main">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-lg font-semibold tracking-tight text-white">ShopMind AI</span>
          </Link>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
        </nav>
      </header>

      <main className="relative mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Privacy policy</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated {PRIVACY_UPDATED}</p>

        <div className="privacy-body mt-8 space-y-8 text-[15px] leading-relaxed">
          <Section title="Who we are">
            <p>
              ShopMind AI is an AI shopping assistant that online stores add to their websites. This policy explains
              what we store about <strong>store owners</strong> who use the ShopMind dashboard and about{" "}
              <strong>shoppers</strong> who chat with a store's assistant. Each store decides to use ShopMind on its own
              website; for shoppers, the store is responsible for its own site, and we process chats on its behalf.
            </p>
          </Section>

          <Section title="What we store about store owners">
            <ul>
              <li>Your email address and password (passwords are stored hashed, never in readable form).</li>
              <li>Your store name, chatbot settings and logo.</li>
              <li>
                Your products and store information (policies, FAQs) that you upload, or that we import from your
                Shopify or WooCommerce store's public product listing when you connect it.
              </li>
              <li>The address of the website where your chat was last seen, so we can confirm it's installed.</li>
            </ul>
          </Section>

          <Section title="What we store about shoppers">
            <ul>
              <li>
                <strong>Chat messages</strong> and the products the assistant showed, so the store can review
                conversations and reply in its Inbox.
              </li>
              <li>
                <strong>A scrambled (hashed) version of the IP address</strong>, used only to limit abuse. We don't store
                the IP address itself.
              </li>
              <li>
                <strong>Simple activity</strong>: product clicks and add-to-cart taps in the chat, for the store's
                analytics. When the store connects its cart, the assistant receives product codes and quantities, not
                names, payment or address details.
              </li>
              <li>
                <strong>Shopper memory</strong> (only if the store turns it on): a few lasting preferences you mention,
                like a size or favourite colour, and recently shown products, linked to a random ID saved in your
                browser. We never store emails, phone numbers, addresses or payment details in it. It's deleted after
                90 days without a visit, and you can type <em>"forget me"</em> in the chat to delete it at once.
              </li>
            </ul>
            <p>
              The chat doesn't use tracking cookies. It saves a random visitor ID and your chat settings in your
              browser's local storage; clearing your browser data removes them.
            </p>
          </Section>

          <Section title="How we use it">
            <ul>
              <li>To answer shoppers' questions with the store's products and policies.</li>
              <li>To let the store's team take over a chat when a shopper asks for a person.</li>
              <li>To show the store owner analytics and conversations.</li>
              <li>To keep the service secure and prevent abuse.</li>
            </ul>
            <p>We don't sell personal data and we don't use it for advertising.</p>
          </Section>

          <Section title="Services we use">
            <ul>
              <li>
                <strong>Supabase</strong> stores the data and runs our servers.
              </li>
              <li>
                <strong>Vercel</strong> hosts the website and dashboard.
              </li>
              <li>
                <strong>Google Gemini</strong> and <strong>OpenRouter</strong> (AI model providers) process chat
                messages to write the assistant's replies.
              </li>
            </ul>
            <p>These providers process data for us under their own security and privacy terms.</p>
          </Section>

          <Section title="How long we keep it">
            <p>
              Store and chat data are kept while the store's account is active. Shopper memory is deleted after 90 days
              without a visit, or immediately on "forget me". When a store deletes its account, its products, settings
              and conversations are deleted with it.
            </p>
          </Section>

          <Section title="Your choices">
            <ul>
              <li>Shoppers: type "forget me" in the chat, or contact the store you chatted with.</li>
              <li>Store owners: you can edit or delete your products and store information at any time.</li>
              <li>Anyone can ask us to access, correct or delete their personal data.</li>
            </ul>
          </Section>

          <Section title="Contact">
            <p>
              {SUPPORT_EMAIL ? (
                <>
                  Questions or requests: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
                </>
              ) : (
                <>Questions or requests: contact us from your ShopMind account, or through the store you chatted with.</>
              )}
            </p>
            <p>If we change this policy, we'll update the date at the top of this page.</p>
          </Section>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold text-white">{title}</h2>
      <div className="space-y-3 [&_a]:text-blue-300 [&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_strong]:text-slate-100 [&_ul]:space-y-2">
        {children}
      </div>
    </section>
  );
}
