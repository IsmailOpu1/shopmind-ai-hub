/**
 * ShopMind AI embed widget — vanilla JS source.
 * Built to public/embed.js by Vite (shopmindEmbedPlugin) using the same
 * VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY as import.meta.env in the app.
 */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) {
    var candidates = document.querySelectorAll("script[src*='embed.js']");
    script = candidates.length ? candidates[candidates.length - 1] : null;
  }
  if (!script) {
    console.error("[ShopMind] Could not resolve embed script element");
    return;
  }

  var businessId = script.getAttribute("data-business-id");
  if (!businessId || !String(businessId).trim()) {
    console.error("[ShopMind] data-business-id is required on the script tag");
    return;
  }

  // Settings come from the dashboard (loaded below); data-* attributes override.
  var attr = function (name) {
    var v = script.getAttribute(name);
    return v && String(v).trim() ? String(v).trim() : null;
  };
  var config = {
    bot_name: attr("data-bot-name") || "ShopMind AI",
    greeting: attr("data-greeting") || "Hi! I'm your shopping assistant. What are you looking for today?",
    primary_color: attr("data-primary-color") || "#1E40AF",
    fab_position: (attr("data-position") || "bottom-right").toLowerCase(),
    currency: attr("data-currency") || "BDT",
  };
  var overridden = {
    bot_name: !!attr("data-bot-name"),
    greeting: !!attr("data-greeting"),
    primary_color: !!attr("data-primary-color"),
    fab_position: !!attr("data-position"),
    currency: !!attr("data-currency"),
  };
  var enableCart = attr("data-enable-cart") === "true";
  var proactiveAttr = attr("data-proactive-delay");
  var proactiveDelay = proactiveAttr === "off" ? 0 : Number(proactiveAttr || 30);
  if (!isFinite(proactiveDelay) || proactiveDelay < 0) proactiveDelay = 30;

  var CURRENCY_SYMBOLS = { BDT: "\u09F3", USD: "$", EUR: "\u20AC", GBP: "\u00A3", INR: "\u20B9" };
  function formatPrice(price) {
    var n = Number(price);
    if (price == null || price === "" || !isFinite(n)) return "";
    var symbol = CURRENCY_SYMBOLS[config.currency] || config.currency + " ";
    return symbol + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  function safeUrl(u) {
    return typeof u === "string" && /^https?:\/\//i.test(u) ? u : null;
  }

  var SM_SUPABASE_URL = __SM_VITE_SUPABASE_URL__;
  var SM_ANON_KEY = __SM_VITE_SUPABASE_ANON_KEY__;

  if (!SM_SUPABASE_URL || !SM_ANON_KEY) {
    console.error("[ShopMind] Missing Supabase URL or anon key (build env not set)");
  }

  // One chat session per browser tab and store; the server keeps the history.
  function newSessionId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "s-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
  }
  var sessionKey = "shopmind_session_" + businessId;
  var sessionId = null;
  try {
    sessionId = window.sessionStorage.getItem(sessionKey);
  } catch (e) {
    /* storage blocked */
  }
  if (!sessionId) {
    sessionId = newSessionId();
    try {
      window.sessionStorage.setItem(sessionKey, sessionId);
    } catch (e) {
      /* storage blocked */
    }
  }

  var base = String(SM_SUPABASE_URL).replace(/\/+$/, "");
  var chatUrl = base + "/functions/v1/chat";

  var NS = "shopmind-embed-" + Math.random().toString(36).slice(2, 9);
  var styleId = NS + "-styles";
  if (document.getElementById(styleId)) return;

  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var css =
    "#" +
    NS +
    " .sm-fab{position:fixed;z-index:2147483000;right:24px;bottom:24px;" +
    "display:flex;align-items:center;gap:10px;padding:12px 20px;border-radius:9999px;border:none;cursor:pointer;font-family:system-ui,-apple-system,sans-serif;font-size:14px;font-weight:600;color:#fff;box-shadow:0 10px 25px rgba(0,0,0,.2);transition:transform .2s,box-shadow .2s;background:var(--sm-primary);}" +
    "#" +
    NS +
    " .sm-fab:hover{transform:scale(1.04);box-shadow:0 12px 28px rgba(0,0,0,.25);}" +
    "#" +
    NS +
    " .sm-panel{position:fixed;z-index:2147483001;right:0;top:0;bottom:0;" +
    "width:100%;max-width:380px;height:100vh;height:100dvh;background:#fff;box-shadow:-8px 0 32px rgba(0,0,0,.12);display:flex;flex-direction:column;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;transform:translateX(100%);opacity:0;transition:transform .28s ease,opacity .28s ease;}" +
    "#" +
    NS +
    " .sm-panel.sm-open{transform:translateX(0);opacity:1;}" +
    "#" + NS + ".sm-left .sm-fab{left:24px;right:auto;}" +
    "#" + NS + ".sm-left .sm-panel{left:0;right:auto;transform:translateX(-100%);box-shadow:8px 0 32px rgba(0,0,0,.12);}" +
    "#" + NS + ".sm-left .sm-panel.sm-open{transform:translateX(0);}" +
    "#" + NS + " .sm-nudge{position:fixed;z-index:2147483000;right:24px;bottom:84px;max-width:260px;background:#fff;color:#111827;border:1px solid #e5e7eb;border-radius:14px;padding:12px 32px 12px 14px;font:14px/1.4 system-ui,-apple-system,sans-serif;box-shadow:0 10px 25px rgba(0,0,0,.15);cursor:pointer;animation:sm-pop .25s ease;}" +
    "#" + NS + ".sm-left .sm-nudge{left:24px;right:auto;}" +
    "#" + NS + " .sm-nudge-close{position:absolute;top:4px;right:6px;background:none;border:none;color:#9ca3af;font-size:16px;cursor:pointer;padding:4px;}" +
    "@keyframes sm-pop{from{transform:translateY(8px);opacity:0;}to{transform:none;opacity:1;}}" +
    "#" + NS + " .sm-fab-pulse{animation:sm-pulse 2s infinite;}" +
    "@keyframes sm-pulse{0%{box-shadow:0 0 0 0 rgba(0,0,0,.25);}70%{box-shadow:0 0 0 14px rgba(0,0,0,0);}100%{box-shadow:0 0 0 0 rgba(0,0,0,0);}}" +
    "#" + NS + " .sm-card-actions{display:flex;gap:8px;margin-top:10px;}" +
    "#" + NS + " .sm-card-btn{flex:1;text-align:center;font-size:12px;font-weight:600;padding:8px 10px;border-radius:8px;text-decoration:none;cursor:pointer;border:1px solid var(--sm-primary);color:var(--sm-primary);background:#fff;}" +
    "#" + NS + " .sm-card-btn-primary{background:var(--sm-primary);color:#fff;}" +
    "#" + NS + " .sm-powered{font-size:10px;color:#9ca3af;text-align:center;padding:0 0 8px;background:#fff;}" +
    "#" +
    NS +
    " .sm-header{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #e5e7eb;background:#f9fafb;}" +
    "#" +
    NS +
    " .sm-header-title{font-size:15px;font-weight:600;margin:0;color:#111;}" +
    "#" +
    NS +
    " .sm-header-sub{font-size:12px;color:#6b7280;margin:2px 0 0;}" +
    "#" +
    NS +
    " .sm-close{background:transparent;border:none;cursor:pointer;padding:8px;border-radius:8px;color:#6b7280;font-size:20px;line-height:1;}" +
    "#" +
    NS +
    " .sm-close:hover{background:#e5e7eb;}" +
    "#" +
    NS +
    " .sm-thread{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;background:#fff;}" +
    "#" +
    NS +
    " .sm-row{display:flex;}" +
    "#" +
    NS +
    " .sm-row-user{justify-content:flex-end;}" +
    "#" +
    NS +
    " .sm-row-asst{justify-content:flex-start;}" +
    "#" +
    NS +
    " .sm-bubble{max-width:85%;padding:10px 14px;border-radius:18px;font-size:14px;line-height:1.45;word-break:break-word;}" +
    "#" +
    NS +
    " .sm-bubble-user{background:var(--sm-primary);color:#fff;border-bottom-right-radius:6px;}" +
    "#" +
    NS +
    " .sm-bubble-asst{background:#f3f4f6;color:#111827;border-bottom-left-radius:6px;}" +
    "#" +
    NS +
    " .sm-bubble-err{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;}" +
    "#" +
    NS +
    " .sm-typing{display:flex;gap:4px;padding:8px 12px;}" +
    "#" +
    NS +
    " .sm-dot{width:8px;height:8px;border-radius:50%;background:#9ca3af;animation:sm-bounce 1.2s infinite ease-in-out;}" +
    "#" +
    NS +
    " .sm-dot:nth-child(2){animation-delay:0.15s;}" +
    "#" +
    NS +
    " .sm-dot:nth-child(3){animation-delay:0.3s;}" +
    "@keyframes sm-bounce{0%,80%,100%{transform:scale(0.75);opacity:.5;}40%{transform:scale(1);opacity:1;}}" +
    "#" +
    NS +
    " .sm-inputbar{flex-shrink:0;display:flex;gap:8px;padding:12px;border-top:1px solid #e5e7eb;background:#fff;}" +
    "#" +
    NS +
    " .sm-input{flex:1;border:1px solid #d1d5db;border-radius:10px;padding:10px 12px;font-size:14px;outline:none;}" +
    "#" +
    NS +
    " .sm-input:focus{border-color:var(--sm-primary);box-shadow:0 0 0 2px rgba(30,64,175,.2);}" +
    "#" +
    NS +
    " .sm-send{border:none;border-radius:10px;padding:10px 14px;cursor:pointer;background:var(--sm-primary);color:#fff;font-weight:600;}" +
    "#" +
    NS +
    " .sm-send:disabled{opacity:.55;cursor:not-allowed;}" +
    "#" +
    NS +
    " .sm-products{display:flex;flex-direction:column;gap:12px;margin-top:10px;}" +
    "#" +
    NS +
    " .sm-card{max-width:100%;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.06);}" +
    "#" +
    NS +
    " .sm-card-img{height:140px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:13px;}" +
    "#" +
    NS +
    " .sm-card-img img{width:100%;height:100%;object-fit:cover;}" +
    "#" +
    NS +
    " .sm-card-body{padding:12px;}" +
    "#" +
    NS +
    " .sm-card-title{font-weight:700;font-size:14px;margin:0 0 8px;color:#111;}" +
    "#" +
    NS +
    " .sm-badges{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;}" +
    "#" +
    NS +
    " .sm-badge{font-size:11px;padding:2px 8px;border-radius:6px;background:#e5e7eb;color:#374151;}" +
    "#" +
    NS +
    " .sm-badge-stock-in{background:#dbeafe;color:#1e40af;}" +
    "#" +
    NS +
    " .sm-badge-stock-out{background:#fee2e2;color:#991b1b;}" +
    "#" +
    NS +
    " .sm-badge-promo{background:#fef9c3;color:#854d0e;border:1px solid #fde047;}" +
    "#" +
    NS +
    " .sm-card-price{font-size:18px;font-weight:700;color:var(--sm-primary);margin:0 0 6px;}" +
    "#" +
    NS +
    " .sm-card-desc{font-size:12px;color:#6b7280;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}" +
    "@media (max-width:768px){" +
    "#" +
    NS +
    " .sm-panel{max-width:none;width:100%;}" +
    "}";

  var styleEl = document.createElement("style");
  styleEl.id = styleId;
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  var root = document.createElement("div");
  root.id = NS;
  function applyConfig() {
    root.style.setProperty("--sm-primary", config.primary_color);
    if (config.fab_position === "bottom-left") root.classList.add("sm-left");
    else root.classList.remove("sm-left");
    if (titleEl) titleEl.textContent = config.bot_name;
  }

  var iconSvg =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

  root.innerHTML =
    '<button type="button" class="sm-fab" aria-label="Open chat">' +
    iconSvg +
    '<span>Go AI</span></button>' +
    '<div class="sm-panel" role="dialog" aria-modal="true" aria-label="Chat">' +
    '<div class="sm-header">' +
    "<div>" +
    '<p class="sm-header-title"></p>' +
    '<p class="sm-header-sub"><span style="color:#22c55e">●</span> Online</p>' +
    "</div>" +
    '<button type="button" class="sm-close" aria-label="Close chat">×</button>' +
    "</div>" +
    '<div class="sm-thread"></div>' +
    '<div class="sm-inputbar">' +
    '<input type="text" class="sm-input" placeholder="Ask me anything..." maxlength="500" autocomplete="off" />' +
    '<button type="button" class="sm-send">Send</button>' +
    "</div>" +
    '<div class="sm-powered">Powered by ShopMind</div>' +
    "</div>";

  document.body.appendChild(root);

  var fab = root.querySelector(".sm-fab");
  var panel = root.querySelector(".sm-panel");
  var thread = root.querySelector(".sm-thread");
  var input = root.querySelector(".sm-input");
  var sendBtn = root.querySelector(".sm-send");
  var closeBtn = root.querySelector(".sm-close");
  var titleEl = root.querySelector(".sm-header-title");
  applyConfig();
  fab.classList.add("sm-fab-pulse");

  var messages = [];
  var typing = false;
  var msgId = 0;

  function scrollThread() {
    thread.scrollTop = thread.scrollHeight;
  }

  function renderProductCard(p) {
    var imgHtml = p.image_url
      ? '<div class="sm-card-img"><img src="' +
        esc(p.image_url) +
        '" alt="' +
        esc(p.name) +
        '" loading="lazy"/></div>'
      : '<div class="sm-card-img">No image</div>';
    var stock = (p.stock_status || "").toLowerCase() === "in_stock" ? "in" : "out";
    var badges =
      (p.category
        ? '<span class="sm-badge">' + esc(p.category) + "</span>"
        : "") +
      '<span class="sm-badge sm-badge-stock-' +
      stock +
      '">' +
      (stock === "in" ? "In Stock" : "Out of Stock") +
      "</span>" +
      (p.promo ? '<span class="sm-badge sm-badge-promo">' + esc(p.promo) + "</span>" : "");
    var priceHtml =
      p.price != null && p.price !== ""
        ? '<p class="sm-card-price">' + esc(formatPrice(p.price)) + "</p>"
        : "";
    return (
      '<div class="sm-card">' +
      imgHtml +
      '<div class="sm-card-body">' +
      '<p class="sm-card-title">' +
      esc(p.name) +
      "</p>" +
      '<div class="sm-badges">' +
      badges +
      "</div>" +
      priceHtml +
      (p.description
        ? '<p class="sm-card-desc">' + esc(p.description) + "</p>"
        : "") +
      renderCardActions(p) +
      "</div></div>"
    );
  }

  function renderCardActions(p) {
    var url = safeUrl(p.product_url);
    var html = "";
    if (url) {
      html +=
        '<a class="sm-card-btn" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">View product</a>';
    }
    if (enableCart && p.stock_status === "in_stock") {
      html += '<button type="button" class="sm-card-btn sm-card-btn-primary" data-sm-cart="' + esc(p.id) + '">Add to cart</button>';
    }
    return html ? '<div class="sm-card-actions">' + html + "</div>" : "";
  }

  var productsById = {};

  function renderMessages() {
    var html = "";
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      var rowClass = m.role === "user" ? "sm-row-user" : "sm-row-asst";
      var bubClass =
        m.role === "user"
          ? "sm-bubble-user"
          : m.isError
            ? "sm-bubble-err"
            : "sm-bubble-asst";
      html +=
        '<div class="sm-row ' +
        rowClass +
        '">' +
        '<div class="sm-bubble ' +
        bubClass +
        '">' +
        esc(m.content) +
        "</div></div>";
      if (m.role === "assistant" && m.products && m.products.length) {
        html += '<div class="sm-row sm-row-asst"><div style="max-width:100%;width:100%">';
        html += '<div class="sm-products">';
        for (var j = 0; j < m.products.length; j++) {
          productsById[m.products[j].id] = m.products[j];
          html += renderProductCard(m.products[j]);
        }
        html += "</div></div></div>";
      }
    }
    if (typing) {
      html +=
        '<div class="sm-row sm-row-asst"><div class="sm-bubble sm-bubble-asst"><div class="sm-typing">' +
        '<span class="sm-dot"></span><span class="sm-dot"></span><span class="sm-dot"></span>' +
        "</div></div></div>";
    }
    thread.innerHTML = html;
    scrollThread();
  }

  function addWelcome(text) {
    messages.push({
      id: ++msgId,
      role: "assistant",
      content: text || config.greeting,
      welcome: !text,
    });
    renderMessages();
  }

  // Load the store's saved settings; attributes on the script tag win.
  if (SM_SUPABASE_URL && SM_ANON_KEY) {
    fetch(chatUrl + "?business_id=" + encodeURIComponent(businessId), {
      headers: { apikey: SM_ANON_KEY },
    })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (saved) {
        if (!saved) return;
        Object.keys(config).forEach(function (k) {
          if (!overridden[k] && saved[k]) config[k] = saved[k];
        });
        applyConfig();
        if (messages.length === 1 && messages[0].welcome) {
          messages[0].content = config.greeting;
        }
        renderMessages();
      })
      .catch(function () {
        /* keep defaults */
      });
  }

  function markEngaged() {
    try {
      window.sessionStorage.setItem(sessionKey + "_engaged", "1");
    } catch (e) {
      /* storage blocked */
    }
  }

  function openPanel(welcomeText) {
    hideNudge();
    markEngaged();
    fab.classList.remove("sm-fab-pulse");
    panel.classList.add("sm-open");
    if (messages.length === 0) addWelcome(welcomeText);
    else renderMessages();
    input.focus();
  }

  fab.addEventListener("click", function () {
    openPanel();
  });

  // "Add to cart" is a DOM event the store's own code can listen for.
  thread.addEventListener("click", function (e) {
    var target = e.target;
    if (!target || !target.getAttribute) return;
    var cartId = target.getAttribute("data-sm-cart");
    if (cartId && productsById[cartId]) {
      var p = productsById[cartId];
      window.dispatchEvent(
        new CustomEvent("shopmind:add-to-cart", {
          detail: { id: p.id, name: p.name, price: p.price, product_url: p.product_url || null },
        })
      );
      target.textContent = "Added";
    }
  });

  // Proactive nudge after the shopper lingers (PRD: 30s on a page).
  var nudgeEl = null;
  function hideNudge() {
    if (nudgeEl && nudgeEl.parentNode) nudgeEl.parentNode.removeChild(nudgeEl);
    nudgeEl = null;
  }
  function nudgeText() {
    var title = (document.title || "").split(/\s[|\-\u2013\u2014]\s/)[0].trim();
    if (title && title.length <= 60 && /product|item|\/p\/|\d/i.test(location.pathname)) {
      return "Questions about " + title + "? I can help you decide.";
    }
    return "Need help finding something? Ask me anything!";
  }
  if (proactiveDelay > 0) {
    var engaged = false;
    try {
      engaged = window.sessionStorage.getItem(sessionKey + "_engaged") === "1";
    } catch (e) {
      /* storage blocked */
    }
    if (!engaged) {
      setTimeout(function () {
        if (panel.classList.contains("sm-open") || messages.length > 0) return;
        var text = nudgeText();
        nudgeEl = document.createElement("div");
        nudgeEl.className = "sm-nudge";
        nudgeEl.setAttribute("role", "status");
        nudgeEl.innerHTML = esc(text) + '<button type="button" class="sm-nudge-close" aria-label="Dismiss">\u00D7</button>';
        nudgeEl.addEventListener("click", function (e) {
          if (e.target && e.target.classList.contains("sm-nudge-close")) {
            e.stopPropagation();
            hideNudge();
            markEngaged();
            return;
          }
          openPanel(text);
        });
        root.appendChild(nudgeEl);
      }, proactiveDelay * 1000);
    }
  }

  closeBtn.addEventListener("click", function () {
    panel.classList.remove("sm-open");
  });

  async function send() {
    var text = (input.value || "").trim();
    if (!text || typing) return;


    messages.push({ id: ++msgId, role: "user", content: text });
    input.value = "";
    typing = true;
    renderMessages();

    if (!SM_SUPABASE_URL || !SM_ANON_KEY) {
      typing = false;
      messages.push({
        id: ++msgId,
        role: "assistant",
        content: "Chat is not configured (missing Supabase credentials in build).",
        isError: true,
      });
      renderMessages();
      return;
    }

    try {
      var res = await fetch(chatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SM_ANON_KEY,
        },
        body: JSON.stringify({
          message: text,
          business_id: businessId,
          session_id: sessionId,
          page: { title: document.title || "", url: location.origin + location.pathname },
        }),
      });

      var data = {};
      try {
        data = await res.json();
      } catch (e) {
        data = {};
      }

      if (!res.ok) {
        messages.push({
          id: ++msgId,
          role: "assistant",
          content:
            (typeof data.error === "string" && data.error) ||
            "Something went wrong (" + res.status + "). Please try again.",
          isError: true,
        });
      } else {
        var reply =
          typeof data.reply === "string" && data.reply.trim()
            ? data.reply.trim()
            : "I didn't get a reply. Please try again.";
        var products = Array.isArray(data.products) ? data.products : [];
        messages.push({
          id: ++msgId,
          role: "assistant",
          content: reply,
          products: products.length ? products : undefined,
        });
      }
    } catch (e) {
      messages.push({
        id: ++msgId,
        role: "assistant",
        content: "Network error. Check your connection and try again.",
        isError: true,
      });
    } finally {
      typing = false;
      renderMessages();
    }
  }

  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
})();
