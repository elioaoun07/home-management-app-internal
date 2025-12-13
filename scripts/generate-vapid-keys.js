// scripts/generate-vapid-keys.js
// Run with: node scripts/generate-vapid-keys.js
// This generates VAPID keys for Web Push notifications

const webpush = require("web-push");

const vapidKeys = webpush.generateVAPIDKeys();

console.log("\n=== VAPID Keys Generated ===\n");
console.log("Add these to your .env.local file:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:your-email@example.com`);
console.log("\n============================\n");
console.log("Note: The public key is safe to expose in the browser.");
console.log("The private key must be kept secret on the server.\n");
