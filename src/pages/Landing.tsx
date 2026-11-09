import { Suspense, lazy, useCallback, useState } from "react";
import { Link } from "react-router-dom";
import BrandMark from "@/components/BrandMark";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  Check,
  Code2,
  Globe2,
  Headset,
  History,
  Languages,
  Lock,
  MessageSquareText,
  Palette,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAuth } from "@/hooks/useAuth";
import { Reveal, TiltCard } from "@/components/landing/effects";

// three.js lives in its own chunk, loaded after the page is interactive.
const HeroScene = lazy(() => import("@/components/landing/HeroScene"));

const NAV = [
  { href: "#demo", label: "How it sells" },
  { href: "#features", label: "Features" },
  { href: "#setup", label: "Setup" },
  { href: "#faq", label: "FAQ" },
];

const FEATURES = [
  {
    icon: Search,
    title: "Finds the right product",
    text: "Understands budgets, sizes and follow-ups like “anything cheaper?”, then shows real product cards.",
  },
  {
    icon: ShieldCheck,
    title: "Never makes things up",
    text: "Answers only from your catalog and store info. If it doesn’t know, it says so.",
  },
  {
    icon: BookOpen,
    title: "Knows your policies",
    text: "Delivery, returns, payment and size guides come straight from the documents you add.",
  },
  {
    icon: ShoppingCart,
    title: "Cart-aware add-ons",
    text: "Sees what’s in the cart and suggests items that go with it when the shopper is ready to buy.",
  },
  {
    icon: Headset,
    title: "Hands off to your team",
    text: "Shoppers tap “Talk to a person” and the chat lands in your Inbox. Reply right from the dashboard.",
  },
  {
    icon: History,
    title: "Remembers returning shoppers",
    text: "Picks up their size, colours and budget on the next visit. They can say “forget me” any time.",
  },
  {
    icon: BarChart3,
    title: "Shows what shoppers want",
    text: "Analytics on chats, product clicks and the things people asked for that you don’t carry yet.",
  },
  {
    icon: Palette,
    title: "Sounds like your brand",
    text: "Your colours, logo, greeting and tone: friendly, professional, playful or luxury.",
  },
];

const STEPS = [
  {
    icon: Upload,
    title: "Add your catalog",
    text: "Upload a CSV or Excel sheet of your products. Prices, stock, variants and promos are all understood.",
  },
  {
    icon: BookOpen,
    title: "Teach it your store",
    text: "Paste your delivery, returns and payment info so it can answer policy questions accurately.",
  },
  {
    icon: Code2,
    title: "Paste one line",
    text: "Add the script tag to your website. The assistant appears in the corner, styled to your brand.",
  },
];

const FAQ = [
  {
    q: "Which languages does it speak?",
    a: "English, Bangla and Banglish. It replies in the language the shopper writes in.",
  },
  {
    q: "Will it invent prices, discounts or policies?",
    a: "No. It only uses your product catalog and the store information you add. When something isn’t covered, it says it doesn’t have that information and suggests contacting you.",
  },
  {
    q: "What do I need to get started?",
    a: "A product list (CSV or Excel; a sample file is provided) and a website where you can add a script tag. Store documents are optional but make policy answers much better.",
  },
  {
    q: "Can shoppers reach a real person?",
    a: "Yes. They can tap “Talk to a person” or just ask for one. The assistant steps aside, the chat shows up in your Inbox, and your replies appear in their chat window.",
  },
  {
    q: "Which platforms does it work with?",
    a: "Any website where you can add a script tag. Your cart can be connected with a few lines of code; direct Shopify and WooCommerce catalog sync is in the works.",
  },
  {
    q: "What happens to shoppers’ data?",
    a: "Chats stay private to your store. Remembered preferences never include contact or payment details, are tied to an anonymous browser id, and are deleted after 90 days without a visit, or immediately when a shopper says “forget me”.",
  },
];

function SceneFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <div className="hero-orb-fallback" />
    </div>
  );
}

function HeroVisual() {
  const [failed, setFailed] = useState(false);
  const onError = useCallback(() => setFailed(true), []);
  return (
    <div className="relative h-[340px] sm:h-[440px] lg:h-[560px]">
      <div className="absolute inset-0 hero-visual-glow" aria-hidden="true" />
      {failed ? (
        <SceneFallback />
      ) : (
        <Suspense fallback={<SceneFallback />}>
          <HeroScene onError={onError} className="absolute inset-0" />
        </Suspense>
      )}
      {/* Floating chat bubbles: what the orb is doing. */}
      <div className="pointer-events-none absolute left-0 top-[12%] sm:left-[2%] max-w-[230px] sm:max-w-[260px] animate-bob">
        <div className="glass rounded-2xl rounded-bl-md px-4 py-3 text-sm text-slate-200 shadow-2xl">
          I need a jacket under ৳6,000
        </div>
      </div>
      <div className="pointer-events-none absolute right-0 bottom-[10%] sm:right-[2%] max-w-[250px] sm:max-w-[280px] animate-bob [animation-delay:1.6s]">
        <div className="rounded-2xl rounded-br-md bg-gradient-to-br from-blue-600 to-violet-600 px-4 py-3 text-sm text-white shadow-2xl shadow-blue-900/40">
          The Camel Wool Blazer is ৳5,999, an Italian wool blend that fits your budget. Want to see it?
        </div>
      </div>
    </div>
  );
}

function DemoChat() {
  return (
    <TiltCard className="mx-auto w-full max-w-md" max={6}>
      <div className="glass-strong overflow-hidden rounded-3xl shadow-[0_40px_120px_-30px_rgba(59,130,246,0.45)]">
        <div className="flex items-center gap-3 border-b border-white/10 bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Mira · Store assistant</p>
            <p className="text-xs text-white/75">Replies instantly</p>
          </div>
        </div>
        <div className="space-y-3 px-4 py-5 text-sm">
          <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-blue-600 px-3.5 py-2.5 text-white">
            amar jonno ekta shirt dekhao, size L
          </div>
          <div className="w-fit max-w-[88%] rounded-2xl rounded-bl-md bg-white/[0.06] px-3.5 py-2.5 text-slate-200">
            Size L e duto shirt ache! Cream Linen Shirt ta breathable, gorome perfect. Konta dekhben?
          </div>
          <div className="tilt-pop grid grid-cols-2 gap-3 pt-1">
            {[
              { name: "Cream Linen Shirt", price: "৳1,299", tone: "from-amber-200/80 to-orange-300/70" },
              { name: "Oxford Button-Down", price: "৳1,599", tone: "from-sky-300/80 to-blue-400/70" },
            ].map((p) => (
              <div key={p.name} className="rounded-xl border border-white/10 bg-slate-900/70 p-2.5">
                <div className={`mb-2 h-20 rounded-lg bg-gradient-to-br ${p.tone}`} />
                <p className="truncate text-xs font-medium text-white">{p.name}</p>
                <p className="text-xs text-blue-300">{p.price}</p>
                <div className="mt-2 rounded-md bg-blue-600/90 py-1 text-center text-[11px] font-medium text-white">
                  View product
                </div>
              </div>
            ))}
          </div>
          <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-blue-600 px-3.5 py-2.5 text-white">
            Do you deliver outside Dhaka?
          </div>
          <div className="w-fit max-w-[88%] rounded-2xl rounded-bl-md bg-white/[0.06] px-3.5 py-2.5 text-slate-200">
            Yes, all over Bangladesh in 3-5 working days. Orders over ৳3,000 ship free.
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3">
          <div className="flex-1 rounded-full bg-white/[0.05] px-4 py-2 text-xs text-slate-500">Type a message...</div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
            <ArrowRight className="h-4 w-4 text-white" />
          </div>
        </div>
      </div>
    </TiltCard>
  );
}

const Landing = () => {
  const { user } = useAuth();

  return (
    <div className="landing relative min-h-screen overflow-x-hidden text-slate-200">
      <div className="landing-bg" aria-hidden="true" />

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#070b17]/70 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6" aria-label="Main">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-lg font-semibold tracking-tight text-white">ShopMind AI</span>
          </Link>
          <div className="hidden items-center gap-8 text-sm text-slate-400 md:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="transition-colors hover:text-white">
                {n.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <Button asChild size="sm" className="btn-glow">
                <Link to="/dashboard">
                  Open dashboard <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="text-slate-300 hover:bg-white/5 hover:text-white">
                  <Link to="/login">Log in</Link>
                </Button>
                <Button asChild size="sm" className="btn-glow">
                  <Link to="/signup">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative mx-auto grid max-w-7xl items-center gap-6 px-4 pb-12 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-20 lg:pt-16">
          <div className="relative z-10">
            <div className="hero-in" style={{ animationDelay: "0ms" }}>
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3.5 py-1.5 text-xs font-medium text-blue-200">
                <Sparkles className="h-3.5 w-3.5" /> AI shopping assistant for online stores
              </span>
            </div>
            <div className="hero-in" style={{ animationDelay: "80ms" }}>
              <h1 className="mt-6 text-[2.6rem] font-bold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-[4.2rem]">
                Your store&rsquo;s best salesperson,{" "}
                <span className="text-gradient-hero">awake 24/7.</span>
              </h1>
            </div>
            <div className="hero-in" style={{ animationDelay: "160ms" }}>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
                ShopMind answers shoppers instantly, recommends the right products from your catalog, explains your
                delivery and returns, and hands tricky chats to your team. All from one line of code.
              </p>
            </div>
            <div className="hero-in" style={{ animationDelay: "240ms" }}>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="btn-glow h-12 px-7 text-base">
                  <Link to={user ? "/dashboard" : "/signup"}>
                    {user ? "Open dashboard" : "Create your assistant"} <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 border-white/15 bg-white/[0.03] px-7 text-base text-white hover:bg-white/[0.08] hover:text-white"
                >
                  <a href="#demo">See it in action</a>
                </Button>
              </div>
            </div>
            <div className="hero-in" style={{ animationDelay: "320ms" }}>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-400">
                {[
                  { icon: Languages, text: "English, Bangla & Banglish" },
                  { icon: ShieldCheck, text: "Answers only from your data" },
                  { icon: Code2, text: "One script tag" },
                ].map((b) => (
                  <li key={b.text} className="flex items-center gap-2">
                    <b.icon className="h-4 w-4 text-blue-400" /> {b.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <HeroVisual />
        </section>

        {/* Demo */}
        <section id="demo" className="scroll-mt-20 border-y border-white/[0.06] bg-white/[0.015] py-20 sm:py-28">
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <Reveal>
                <p className="section-eyebrow">How it sells</p>
                <h2 className="section-title">Conversations that end at checkout.</h2>
                <p className="mt-5 max-w-lg text-slate-400">
                  Shoppers ask the way they talk. ShopMind understands what they mean, picks products that actually fit,
                  and answers the questions that usually stop a sale.
                </p>
              </Reveal>
              <ul className="mt-8 space-y-5">
                {[
                  {
                    icon: MessageSquareText,
                    title: "Talks like a shop assistant",
                    text: "Budgets, sizes, colours and “the cheaper one?” follow-ups, in the shopper’s own language.",
                  },
                  {
                    icon: ShoppingCart,
                    title: "Shows products, not just text",
                    text: "Every recommendation comes with a card that links straight to the product page.",
                  },
                  {
                    icon: Globe2,
                    title: "Answers policy questions",
                    text: "Delivery areas, fees, returns and payment methods, from your own store documents.",
                  },
                ].map((p, i) => (
                  <Reveal as="li" key={p.title} delay={i * 90} className="flex gap-4">
                    <span className="icon-chip">
                      <p.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-semibold text-white">{p.title}</p>
                      <p className="mt-1 text-sm text-slate-400">{p.text}</p>
                    </div>
                  </Reveal>
                ))}
              </ul>
            </div>
            <Reveal delay={120}>
              <DemoChat />
              <p className="mt-4 text-center text-xs text-slate-500">Example conversation</p>
            </Reveal>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="section-eyebrow">Features</p>
              <h2 className="section-title">Everything a great salesperson does.</h2>
              <p className="mt-5 text-slate-400">Built for real stores, with the guardrails that keep it trustworthy.</p>
            </Reveal>
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={(i % 4) * 80}>
                  <TiltCard className="h-full">
                    <div className="feature-card h-full">
                      <span className="icon-chip tilt-pop">
                        <f.icon className="h-5 w-5" />
                      </span>
                      <h3 className="mt-5 font-semibold text-white">{f.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.text}</p>
                    </div>
                  </TiltCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Setup */}
        <section id="setup" className="scroll-mt-20 border-y border-white/[0.06] bg-white/[0.015] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="section-eyebrow">Setup</p>
              <h2 className="section-title">Live on your site in an afternoon.</h2>
            </Reveal>
            <ol className="relative mt-14 grid gap-6 lg:grid-cols-3">
              <div
                className="absolute left-[16%] right-[16%] top-11 hidden h-px bg-gradient-to-r from-blue-500/0 via-blue-500/40 to-violet-500/0 lg:block"
                aria-hidden="true"
              />
              {STEPS.map((s, i) => (
                <Reveal as="li" key={s.title} delay={i * 110} className="relative">
                  <div className="feature-card h-full text-center">
                    <span className="step-badge mx-auto">
                      <s.icon className="h-6 w-6" />
                      <span className="step-number">{i + 1}</span>
                    </span>
                    <h3 className="mt-6 text-lg font-semibold text-white">{s.title}</h3>
                    <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-400">{s.text}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
            <Reveal delay={150} className="mx-auto mt-10 max-w-2xl">
              <TiltCard max={4}>
                <div className="glass-strong overflow-hidden rounded-2xl">
                  <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3" aria-hidden="true">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
                    <span className="ml-3 text-xs text-slate-500">your-store.html</span>
                  </div>
                  <pre className="overflow-x-auto px-5 py-5 text-[13px] leading-relaxed">
                    <code>
                      <span className="text-violet-300">&lt;script</span>
                      {"\n  "}
                      <span className="text-sky-300">src</span>=<span className="text-emerald-300">"https://…/embed.js"</span>
                      {"\n  "}
                      <span className="text-sky-300">data-business-id</span>=<span className="text-emerald-300">"YOUR_STORE_ID"</span>
                      <span className="text-violet-300">&gt;&lt;/script&gt;</span>
                    </code>
                  </pre>
                </div>
              </TiltCard>
            </Reveal>
          </div>
        </section>

        {/* Trust */}
        <section className="py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <Reveal>
              <div className="trust-panel grid gap-10 rounded-3xl p-8 sm:p-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
                <div>
                  <span className="icon-chip">
                    <Lock className="h-5 w-5" />
                  </span>
                  <h2 className="section-title mt-5">Built to be trusted.</h2>
                  <p className="mt-4 text-slate-400">
                    An assistant that talks to your customers has to be safe. These guardrails are on for every store.
                  </p>
                </div>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {[
                    "Answers only from your products and store documents",
                    "Never asks for passwords or card numbers",
                    "Ignores attempts to change its instructions",
                    "Each store's data is isolated from every other store",
                    "Rate limits protect your quota from abuse",
                    "Shoppers can ask it to forget them at any time",
                  ].map((t) => (
                    <li key={t} className="flex gap-3 text-sm text-slate-300">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 pb-20 sm:pb-28">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <Reveal className="text-center">
              <p className="section-eyebrow">FAQ</p>
              <h2 className="section-title">Questions store owners ask.</h2>
            </Reveal>
            <Reveal delay={100}>
              <Accordion type="single" collapsible className="mt-10 space-y-3">
                {FAQ.map((f, i) => (
                  <AccordionItem
                    key={f.q}
                    value={`q${i}`}
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 data-[state=open]:bg-white/[0.045]"
                  >
                    <AccordionTrigger className="text-left text-base font-medium text-white hover:no-underline">
                      {f.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm leading-relaxed text-slate-400">{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Reveal>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 pb-20 sm:px-6 sm:pb-28">
          <Reveal>
            <div className="cta-panel relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] px-6 py-14 text-center sm:px-12 sm:py-20">
              <div className="cta-glow" aria-hidden="true" />
              <h2 className="relative text-3xl font-bold tracking-tight text-white sm:text-5xl">
                Give every shopper a personal assistant.
              </h2>
              <p className="relative mx-auto mt-5 max-w-xl text-blue-100/80">
                Upload your catalog, add your store info and go live with one line of code.
              </p>
              <Button asChild size="lg" className="relative mt-8 h-12 bg-white px-8 text-base text-slate-900 hover:bg-blue-50">
                <Link to={user ? "/dashboard" : "/signup"}>
                  {user ? "Open dashboard" : "Create your assistant"} <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <BrandMark className="h-6 w-6" />
            <span>ShopMind AI</span>
          </div>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-white">
              Privacy
            </Link>
            {user ? (
              <Link to="/dashboard" className="hover:text-white">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="hover:text-white">
                  Log in
                </Link>
                <Link to="/signup" className="hover:text-white">
                  Sign up
                </Link>
              </>
            )}
          </div>
          <p>© {new Date().getFullYear()} ShopMind AI</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
