import "dotenv/config";

const API_URL = "http://localhost:3000/api/agent/purchase";
const MANDATE_ID = "00000000-0000-0000-0000-000000000003";

async function simulatePurchase(item: string, amountPaise: number) {
  console.log(`\n🤖 AI Agent attempting to purchase: ${item} (₹${amountPaise / 100})`);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mandateId: MANDATE_ID,
        category: item,
        amountPaise: amountPaise,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log("✅ MandateOS APPROVED the transaction!");
      console.log(`   Transaction ID: ${data.transactionId}`);
      console.log(`   Razorpay Order: ${data.razorpayOrderId}`);
    } else {
      console.log("❌ MandateOS BLOCKED the transaction!");
      console.log(`   Reason: ${data.reason || data.error}`);
    }
  } catch (error) {
    console.error("Agent failed to connect to MandateOS:", error);
  }
}

async function runDemo() {
  console.log("=========================================");
  console.log("🚀 INITIATING AI AGENT DEMO SEQUENCE...");
  console.log("=========================================");

  await simulatePurchase("Cloud Servers", 250000);

  console.log("\n⏳ Waiting 3 seconds...\n");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  await simulatePurchase("Cloud Servers", 999999999);

  console.log("\n⏳ Waiting 3 seconds...\n");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  await simulatePurchase("Ferrari", 500000);

  console.log("\n✅ DEMO SEQUENCE COMPLETE.");
}

runDemo();
