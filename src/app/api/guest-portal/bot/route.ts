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
        // Return tonight's hardcoded celebration menu
        botResponse = `🍽️ **Tonight's Celebration Menu:**

🥗 **Salad**
• Winter Salad (Vegan, Vegan dressing)

🍢 **Starters**
• Spinach Fatayer (Vegan)
• Spring Rolls with Sweet Chili Sauce (Vegan)
• Shrimp Avocado Bites with Mayo (Vegetarian)

🍳 **Mains**
• Vegetable Noodles Stir Fry (Vegan)
• Fish Burger with Tartare Sauce & Cheese

🎉 Bon appétit! Let me know if you have any dietary concerns or allergies!`;
        break;
      }

      case "allergy_check": {
        // Check against the hardcoded celebration menu
        const ingredient = (query || "").toLowerCase().trim();
        if (!ingredient) {
          botResponse = `⚠️ Please specify an ingredient to check, e.g. "Does the food contain peanuts?"`;
          break;
        }

        // Hardcoded menu with key ingredients
        const menuItems = [
          {
            name: "Winter Salad",
            ingredients: [
              "lettuce",
              "vegetables",
              "salad",
              "greens",
              "vegan dressing",
            ],
          },
          {
            name: "Spinach Fatayer",
            ingredients: ["spinach", "pastry", "dough", "flour", "onion"],
          },
          {
            name: "Spring Rolls",
            ingredients: [
              "vegetables",
              "wrapper",
              "rice paper",
              "sweet chili sauce",
              "chili",
            ],
          },
          {
            name: "Shrimp Avocado Bites",
            ingredients: [
              "shrimp",
              "avocado",
              "mayo",
              "mayonnaise",
              "seafood",
              "egg",
            ],
          },
          {
            name: "Vegetable Noodles Stir Fry",
            ingredients: [
              "noodles",
              "vegetables",
              "soy sauce",
              "garlic",
              "ginger",
            ],
          },
          {
            name: "Fish Burger",
            ingredients: [
              "fish",
              "bread",
              "bun",
              "tartare sauce",
              "cheese",
              "mayo",
              "seafood",
              "egg",
              "dairy",
            ],
          },
        ];

        const found = menuItems.filter((item) =>
          item.ingredients.some(
            (ing) => ing.includes(ingredient) || ingredient.includes(ing),
          ),
        );

        if (found.length > 0) {
          botResponse = `⚠️ **Allergy Alert!** "${ingredient}" may be found in:\n\n${found.map((item) => `• **${item.name}**`).join("\n")}\n\n🚨 Please inform your host immediately so they can help you with alternatives!`;
        } else {
          botResponse = `✅ Great news! Based on tonight's menu, none of the dishes should contain "${ingredient}". However, always double-check with your host to be 100% sure! 😊`;
        }
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
        // Return the hardcoded celebration menu (same as "menu" intent)
        botResponse = `📖 **Tonight's Menu:**

🥗 **Salad**
• Winter Salad — Vegan with Vegan dressing

🍢 **Starters**
• Spinach Fatayer — Vegan
• Spring Rolls — Vegan, served with Sweet Chili Sauce
• Shrimp Avocado Bites — Vegetarian, with Mayo

🍳 **Mains**
• Vegetable Noodles Stir Fry — Vegan
• Fish Burger — with Tartare Sauce & Cheese

Check the **Menu** tab for more details! 🎉`;
        break;
      }

      case "greeting": {
        // Build contextual greeting based on available features
        const features: string[] = [];
        features.push("• 🛏️ What time we sleep & wake");
        features.push("• 📶 WiFi help");
        features.push("• 📋 House rules");
        features.push("• 🍽️ Tonight's menu");
        features.push("• ⚠️ Check food for allergens");
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
