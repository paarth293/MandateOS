# MandateOS: The 3-Minute Hackathon Pitch

## 1. The Hook (0:00 - 0:20)
*Leave the dashboard open in the background, but look at the judges.*
"Right now, the world is obsessed with Autonomous AI Agents. But there is a massive problem: Trust. If you give an AutoGPT bot access to your corporate credit card to buy server space, how do you mathematically guarantee it won't hallucinate and buy a Ferrari?"

"The answer is **MandateOS**—a cryptographically secure, deterministic policy firewall for AI Agents."

## 2. The Architecture (0:20 - 0:45)
*Point to the Active Agent Policies on the Dashboard.*
"Humans use MandateOS to generate a cryptographic 'Mandate' for their AI. It sets strict rules: what it can buy, how much it can spend, and how it handles failures. The AI cannot bypass this, because the rules are evaluated using pure math, not prompts."

## 3. The E2E Demo (0:45 - 2:00)
*Open your terminal next to the browser window.*
"Let me prove it to you. I have a simulated AI Agent running on my terminal."
*Run `npx tsx src/scripts/simulateAgent.ts`*

"Watch what happens. The Agent tries to buy Cloud Servers for ₹2500. The mathematical policy engine verifies it, and the transaction succeeds on our live dashboard."
"Now, the Agent hallucinates. It tries to buy a Ferrari. MandateOS instantly blocks the transaction before it ever reaches the banking gateway."

## 4. The Chaos Engine & Security (2:00 - 3:00)
*Scroll down to the Chaos Console.*
"But what happens if the bank itself fails during a valid purchase? If the gateway times out, the AI might panic and retry 100 times, draining the account."

*Click the red 'Inject Catastrophic Failure' button on the Chaos Console.*
"I just simulated a 504 Gateway Timeout. Watch the dashboard."
*(Wait for the Red FAILED badge to appear).*

"Instead of panicking the AI, MandateOS uses an Inngest background worker to silently catch the failure. 30 seconds later, it automatically recovers the transaction via a secondary node."
*(Wait for the badge to flip to Blue RECOVERED).*

"Finally, every single action is analyzed by Google Gemini and mathematically locked into a SHA-256 Cryptographic Hash Chain. If anyone tampers with a single byte of this audit log, the chain breaks. It is 100% autonomous, and 100% un-hackable."

"Thank you."
