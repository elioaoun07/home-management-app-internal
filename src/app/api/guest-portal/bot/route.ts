// src/app/api/guest-portal/bot/route.ts
// ERA chatbot — answers guest questions from recipes, bio, schedule (no AI)
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface BioData {
  sleep_time?: string;
  wake_time?: string;
  schedule_today?: string | null;
  house_rules_extra?: string[];
  custom_answers?: Record<string, string>;
}

interface RecipeIngredient {
  name: string;
  quantity?: string;
  unit?: string;
  notes?: string;
  optional?: boolean;
}

// POST - Process a bot query
export async function POST(request: NextRequest) {
  try {
    const { tag_id, intent, query } = await request.json();

    if (!tag_id || !intent) {
      return NextResponse.json(
        { error: "tag_id and intent required" },
        { status: 400 },
      );
    }

    const db = supabaseAdmin();

    // Get the tag with bio data and user_id
    const { data: tag } = await db
      .from("guest_portal_tags")
      .select("user_id, bio_data")
      .eq("id", tag_id)
      .maybeSingle();

    if (!tag) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    const bio = (tag.bio_data || {}) as BioData;
    let botResponse = "";

    switch (intent) {
      case "bedtime": {
        // Special celebration mode - override normal schedule
        botResponse = `🌙 Normally, we sleep around **12 AM** and wake up around **9 AM** (since it's the weekend).

🎉 **But tonight is special!** Since we're celebrating, who knows when we'll sleep — probably never! Let's party! 🥳✨`;
        break;
      }

      case "schedule": {
        const schedule = bio.schedule_today;
        if (schedule) {
          botResponse = `📅 Here's what's on the agenda today:\n\n${schedule}\n\nFeel free to ask if you need more details!`;
        } else {
          botResponse = `📅 No specific schedule planned for today — it's a free day! 🎉 Relax, explore, and enjoy yourself. If something comes up, your host will let you know.`;
        }
        break;
      }

      case "menu": {
        // Tonight we're ordering from Toters
        botResponse = `🍕 **Tonight's Food Situation:**

The kitchen is off-duty tonight — but we've got an inside man at **Toters** who's been cooking all day! 🛵

👉 **Order here:** https://dlct3.app.link/

Pick whatever you're craving. Got allergies? No problem — you can customize your order right in the Toters app. Full control is yours! 🤝`;
        break;
      }

      case "allergy_check": {
        // Redirect to Toters where they can customize their order
        botResponse = `⚠️ Good thinking! Tonight we're ordering from **Toters**, so you have full control over what you eat.

👉 **Order here:** https://dlct3.app.link/

You can customize your order, add special instructions, and avoid any ingredients you're allergic to. If you need help, just ask your host! 🤝`;
        break;
      }

      case "wifi_help": {
        botResponse = `📶 To connect to WiFi:\n\n1. Go to the **WiFi** tab in this portal\n2. Tap **"Copy Password"** to copy the WiFi password\n3. Open your phone's WiFi settings\n4. Select the network shown in the portal\n5. Paste the password\n\nNeed more help? Just ask! 🙂`;
        break;
      }

      case "house_rules": {
        let rules = `📋 **House Guidelines:**\n\n✅ **Do:**\n• Settle in, relax, and enjoy every moment 😊\n• Help yourself to anything in the fridge. Mi casa es su casa 🏡\n• You're here to have fun, not to iron. But if you insist, the board's behind the door 👔\n\n❌ **Don't:**\n• No smoking indoors. The balcony is all yours for that 🚭\n\n📌 **Good to Know:**\n• We run on Metal & Classical here. Other genres? Sure, but headphones exist for a reason 🎧`;

        if (bio.house_rules_extra && bio.house_rules_extra.length > 0) {
          rules += `\n\n📌 **Additional Notes:**\n${bio.house_rules_extra.map((r) => `• ${r}`).join("\n")}`;
        }
        botResponse = rules;
        break;
      }

      case "recipes_list": {
        // Toters ordering tonight
        botResponse = `🛵 **Tonight's Food:**

We're ordering from **Toters** tonight — the kitchen is taking a well-deserved break! 😄

👉 **Order here:** https://dlct3.app.link/

Pick whatever you like. Got dietary needs? Customize your order right in the app!`;
        break;
      }

      case "greeting": {
        // Build contextual greeting based on available features
        const features: string[] = [];
        features.push("• 🛏️ What time we sleep & wake");
        features.push("• 📶 WiFi help");
        features.push("• 📋 House rules");
        features.push("• 🍽️ Tonight's food (ordering from Toters)");
        features.push("• ⚠️ Dietary needs? Customize your Toters order");
        features.push("• 🍷 Choose your drink");

        features.push(
          "• 💬 Or just type anything — your host will be notified!",
        );

        botResponse = `Hey there! 👋 Welcome! I'm ERA, your host's AI concierge. Here's what I can help with:\n\n${features.join("\n")}\n\nJust tap a suggestion below or type your question!`;
        break;
      }

      default: {
        // Try to match freeform text against known intents
        const q = (query || "").toLowerCase();
        if (q.includes("sleep") || q.includes("bed") || q.includes("night")) {
          return POST(
            new NextRequest(request.url, {
              method: "POST",
              body: JSON.stringify({ tag_id, intent: "bedtime", query }),
            }),
          );
        }
        if (
          q.includes("menu") ||
          q.includes("food") ||
          q.includes("eat") ||
          q.includes("dinner") ||
          q.includes("lunch") ||
          q.includes("breakfast")
        ) {
          return POST(
            new NextRequest(request.url, {
              method: "POST",
              body: JSON.stringify({ tag_id, intent: "menu", query }),
            }),
          );
        }
        if (
          q.includes("schedule") ||
          q.includes("plan") ||
          q.includes("today") ||
          q.includes("agenda")
        ) {
          return POST(
            new NextRequest(request.url, {
              method: "POST",
              body: JSON.stringify({ tag_id, intent: "schedule", query }),
            }),
          );
        }
        if (
          q.includes("wifi") ||
          q.includes("internet") ||
          q.includes("connect")
        ) {
          return POST(
            new NextRequest(request.url, {
              method: "POST",
              body: JSON.stringify({ tag_id, intent: "wifi_help", query }),
            }),
          );
        }
        if (
          q.includes("rule") ||
          q.includes("smok") ||
          q.includes("allowed") ||
          q.includes("can i")
        ) {
          return POST(
            new NextRequest(request.url, {
              method: "POST",
              body: JSON.stringify({ tag_id, intent: "house_rules", query }),
            }),
          );
        }
        if (q.includes("recipe") || q.includes("cook")) {
          return POST(
            new NextRequest(request.url, {
              method: "POST",
              body: JSON.stringify({ tag_id, intent: "recipes_list", query }),
            }),
          );
        }
        if (
          q.includes("allerg") ||
          q.includes("contain") ||
          q.includes("ingredient")
        ) {
          // Extract the ingredient from the query
          const words = q
            .replace(
              /does|the|food|has|have|contain|contains|any|is|there|in|it/g,
              "",
            )
            .trim();
          return POST(
            new NextRequest(request.url, {
              method: "POST",
              body: JSON.stringify({
                tag_id,
                intent: "allergy_check",
                query: words,
              }),
            }),
          );
        }

        botResponse = `💬 I've forwarded your message to your host — they'll get a notification and can reply here!\n\nIn the meantime, here are some things I can answer directly:\n\n• 🛏️ "What time do we sleep?"\n• 📶 "How do I connect to WiFi?"\n• 📋 "What are the house rules?"\n\nYour host usually responds quickly! 😊`;
        break;
      }
    }

    return NextResponse.json({ response: botResponse, intent });
  } catch (err) {
    console.error("[GuestBot] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
