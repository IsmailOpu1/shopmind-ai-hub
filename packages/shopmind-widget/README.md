# shopmind-widget

Add the **ShopMind AI** shopping assistant to a website built with code.
It loads the same chat as the copy-paste snippet in your ShopMind dashboard.

Your **store ID** is in ShopMind → **Chatbot settings** → *Add the chat to your website*.

## React / Next.js

```bash
npm install shopmind-widget
```

Put it once in your root layout (App Router: `app/layout.tsx`; Pages Router: `_app.tsx`):

```tsx
import { ShopMindChat } from "shopmind-widget/react";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ShopMindChat businessId="YOUR-STORE-ID" />
      </body>
    </html>
  );
}
```

Tell the assistant what's in the cart (SKUs or product IDs and quantities) so it can
answer about it and suggest items that go with it:

```tsx
<ShopMindChat businessId="YOUR-STORE-ID" cart={cart.map((i) => ({ sku: i.sku, quantity: i.qty }))} />
```

## Any other site (Vue, Svelte, plain JavaScript)

```ts
import { loadShopMind, setShopMindCart } from "shopmind-widget";

loadShopMind({ businessId: "YOUR-STORE-ID" });
setShopMindCart([{ sku: "SHT-OXF-01", quantity: 1 }]);
```

## Options

Everything is optional except `businessId`. Settings you save in the dashboard apply
automatically; options passed here override them.

| Option | Example | |
| --- | --- | --- |
| `botName` | `"Mira"` | Assistant name |
| `greeting` | `"Hi! Looking for something?"` | First message |
| `primaryColor` | `"#1E40AF"` | Button and accent colour |
| `position` | `"bottom-left"` | Corner of the chat button |
| `currency` | `"USD"` | Currency shown on prices |
| `proactiveDelay` | `45` or `"off"` | Seconds before the "Need help?" prompt |
| `cartMode` | `"event"` | Show *Add to cart* on product cards; listen for the `shopmind:add-to-cart` window event |
| `scriptUrl` | `"https://your-domain/embed.js"` | Load the widget from your own ShopMind domain |

`unloadShopMind()` (or `<ShopMindChat removeOnUnmount />`) removes the chat from the page.

The package does nothing during server-side rendering and never loads the chat twice,
even if the snippet is also in your theme.
