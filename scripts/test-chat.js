const SUPABASE_URL = "https://zfyetbnpjoairmrpvgyx.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmeWV0Ym5wam9haXJtcnB2Z3l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Njc3MzgsImV4cCI6MjA5MTI0MzczOH0.V5tBBEve3d9HK6DcC-WOz23kfKWEv9SSAuItcfAZWME";
const BUSINESS_ID = "491b3c9c-41cd-4bc8-8a16-1a4965a8566";

const tests = [
  { query: "hi", expectProducts: false, label: "Greeting" },
  { query: "show me shirts", expectProducts: true, label: "Shirts" },
  { query: "any tops?", expectProducts: true, label: "Tops" },
  { query: "show me sneakers", expectProducts: true, label: "Sneakers" },
  { query: "any shoes?", expectProducts: true, label: "Shoes" },
  { query: "show me footwear", expectProducts: true, label: "Footwear" },
  { query: "I want pants", expectProducts: true, label: "Pants" },
  { query: "any bottoms?", expectProducts: true, label: "Bottoms" },
  { query: "show me outerwear", expectProducts: true, label: "Outerwear" },
  { query: "any jackets?", expectProducts: true, label: "Jackets" },
  { query: "show me accessories", expectProducts: true, label: "Accessories" },
  { query: "something under 1000", expectProducts: true, label: "Under 1000" },
  { query: "anything below 1500", expectProducts: true, label: "Below 1500" },
  { query: "something under 3000", expectProducts: true, label: "Under 3000" },
  { query: "white sneakers", expectProducts: true, label: "White Sneakers" },
  { query: "linen shirt", expectProducts: true, label: "Linen Shirt" },
  { query: "wool sweater", expectProducts: true, label: "Wool Sweater" },
  { query: "leather belt", expectProducts: true, label: "Leather Belt" },
  { query: "blazer", expectProducts: true, label: "Blazer" },
  { query: "what's on sale?", expectProducts: true, label: "On Sale" },
  { query: "show me cheap options", expectProducts: true, label: "Cheap Options" },
  { query: "something formal", expectProducts: true, label: "Formal" },
  { query: "casual wear", expectProducts: true, label: "Casual" },
  { query: "thanks", expectProducts: false, label: "Thanks" },
  { query: "do you have anything in navy?", expectProducts: true, label: "Navy Color" },
];

async function runTest(test, index) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": ANON_KEY,
      },
      body: JSON.stringify({
        message: test.query,
        business_id: BUSINESS_ID,
        session_id: `test-session-${Date.now()}-${index}`,
        conversation_history: [],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.log(`❌ [${test.label}] ERROR: ${data.error}`);
      return false;
    }

    const hasProducts = data.products && data.products.length > 0;
    const passed = test.expectProducts ? hasProducts : !hasProducts;

    if (passed) {
      const productNames = hasProducts 
        ? data.products.map(p => p.name).join(", ")
        : "no products";
      console.log(`✅ [${test.label}] "${test.query}" → ${productNames}`);
    } else {
      if (test.expectProducts && !hasProducts) {
        console.log(`❌ [${test.label}] "${test.query}" → Expected products but got none. Reply: ${data.reply}`);
      } else {
        console.log(`❌ [${test.label}] "${test.query}" → Expected no products but got: ${data.products.map(p => p.name).join(", ")}`);
      }
    }
    return passed;
  } catch (err) {
    console.log(`❌ [${test.label}] NETWORK ERROR: ${err.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log("🚀 Starting ShopMind AI Chat Tests...\n");
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < tests.length; i++) {
    const result = await runTest(tests[i], i);
    if (result) passed++;
    else failed++;
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log(`\n📊 Results: ${passed}/${tests.length} passed`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Score: ${Math.round((passed/tests.length)*100)}%`);
}

runAllTests();
