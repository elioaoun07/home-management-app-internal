// src/app/api/guest-portal/bot/route.ts
// Jarvis chatbot — answers guest questions from recipes, bio, schedule (no AI)
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
        const sleep = bio.sleep_time;
        const wake = bio.wake_time;
        if (sleep && wake) {
          botResponse = `🌙 The household usually winds down around **${sleep}** and wakes up at **${wake}**. Feel free to adjust to your own rhythm though — we just ask to keep noise low after ${sleep}. Sweet dreams! ✨`;
        } else if (sleep) {
          botResponse = `🌙 We typically head to bed around **${sleep}**. Please keep things quiet after that. Rest well! 😊`;
        } else {
          botResponse = `🌙 No specific bedtime is set, but we're usually night owls! Just be considerate of noise levels late at night. 😄`;
        }
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
        // Check today's meal plans
        const today = new Date().toISOString().split("T")[0];
        const { data: mealPlans } = await db
          .from("meal_plans")
          .select(
            "meal_type, recipe_id, notes, recipes(name, description, cuisine, category)",
          )
          .eq("user_id", tag.user_id)
          .eq("planned_date", today);

        if (mealPlans && mealPlans.length > 0) {
          const meals = mealPlans.map((mp) => {
            const recipe = mp.recipes as unknown as {
              name: string;
              description: string;
              cuisine: string;
              category: string;
            } | null;
            const mealLabel =
              mp.meal_type === "breakfast"
                ? "🌅 Breakfast"
                : mp.meal_type === "lunch"
                  ? "☀️ Lunch"
                  : mp.meal_type === "dinner"
                    ? "🌙 Dinner"
                    : `🍽️ ${mp.meal_type}`;

            if (recipe) {
              return `${mealLabel}: **${recipe.name}** ${recipe.cuisine ? `(${recipe.cuisine})` : ""}${recipe.description ? `\n  _${recipe.description}_` : ""}`;
            }
            return `${mealLabel}: ${mp.notes || "Not specified"}`;
          });

          botResponse = `🍽️ Today's menu:\n\n${meals.join("\n\n")}\n\nLet me know if you have any dietary concerns!`;
        } else {
          // Check if there are any recipes at all
          const { count } = await db
            .from("recipes")
            .select("id", { count: "exact", head: true })
            .eq("user_id", tag.user_id);

          if (count && count > 0) {
            botResponse = `🍽️ No specific meal plan set for today, but there are **${count} recipes** in our collection. Ask your host what they're thinking for dinner! 😋`;
          } else {
            botResponse = `🍽️ No meal plan for today yet — your host hasn't decided! Maybe suggest something? They might just surprise you! 🍕`;
          }
        }
        break;
      }

      case "allergy_check": {
        // Search recipes for a specific ingredient
        const ingredient = (query || "").toLowerCase().trim();
        if (!ingredient) {
          botResponse = `⚠️ Please specify an ingredient to check, e.g. "Does the food contain peanuts?"`;
          break;
        }

        // Get today's meal plans with recipe ingredients
        const today = new Date().toISOString().split("T")[0];
        const { data: mealPlans } = await db
          .from("meal_plans")
          .select("meal_type, recipes(name, ingredients)")
          .eq("user_id", tag.user_id)
          .eq("planned_date", today);

        if (!mealPlans || mealPlans.length === 0) {
          // Check all recent/favorite recipes
          const { data: recipes } = await db
            .from("recipes")
            .select("name, ingredients")
            .eq("user_id", tag.user_id)
            .eq("is_favorite", true)
            .limit(20);

          if (recipes && recipes.length > 0) {
            const matches = recipes.filter((r) => {
              const ingredients = (r.ingredients as RecipeIngredient[]) || [];
              return ingredients.some((ing) =>
                ing.name?.toLowerCase().includes(ingredient),
              );
            });

            if (matches.length > 0) {
              botResponse = `⚠️ **Alert!** The ingredient "${ingredient}" was found in the following recipes:\n\n${matches.map((r) => `• **${r.name}**`).join("\n")}\n\n🚨 Please let your host know about this allergy immediately!`;
            } else {
              botResponse = `✅ Good news! None of our favorite recipes contain "${ingredient}". However, always double-check with your host to be safe! 🙏`;
            }
          } else {
            botResponse = `🤔 I couldn't find any recipes to check against. Please ask your host directly about "${ingredient}" in today's food.`;
          }
          break;
        }

        const found: string[] = [];
        for (const mp of mealPlans) {
          const recipe = mp.recipes as unknown as {
            name: string;
            ingredients: RecipeIngredient[];
          } | null;
          if (recipe?.ingredients) {
            const hasIngredient = recipe.ingredients.some((ing) =>
              ing.name?.toLowerCase().includes(ingredient),
            );
            if (hasIngredient) {
              found.push(recipe.name);
            }
          }
        }

        if (found.length > 0) {
          botResponse = `⚠️ **Allergy Alert!** The ingredient "${ingredient}" was found in today's planned meals:\n\n${found.map((n) => `• **${n}**`).join("\n")}\n\n🚨 Please inform your host immediately so they can adjust the recipe or prepare an alternative!`;
        } else {
          botResponse = `✅ Great news! None of today's planned meals contain "${ingredient}". You should be safe, but always mention your allergies to your host just to be sure! 😊`;
        }
        break;
      }

      case "wifi_help": {
        botResponse = `📶 To connect to WiFi:\n\n1. Go to the **WiFi** tab in this portal\n2. Tap **"Copy Password"** to copy the WiFi password\n3. Open your phone's WiFi settings\n4. Select the network shown in the portal\n5. Paste the password\n\nNeed more help? Just ask! 🙂`;
        break;
      }

      case "house_rules": {
        let rules = `📋 **House Guidelines:**\n\n✅ **Do:**\n• Play music — ask for playlist suggestions!\n• Help yourself to anything in the fridge\n• Make yourself at home\n• Leave good vibes only ✨\n\n❌ **Don't:**\n• No smoking inside (balcony available)`;

        if (bio.house_rules_extra && bio.house_rules_extra.length > 0) {
          rules += `\n\n📌 **Additional Notes:**\n${bio.house_rules_extra.map((r) => `• ${r}`).join("\n")}`;
        }
        botResponse = rules;
        break;
      }

      case "recipes_list": {
        const { data: recipes } = await db
          .from("recipes")
          .select(
            "name, category, cuisine, difficulty, prep_time_minutes, cook_time_minutes, is_favorite",
          )
          .eq("user_id", tag.user_id)
          .order("is_favorite", { ascending: false })
          .limit(10);

        if (recipes && recipes.length > 0) {
          const list = recipes.map((r) => {
            const fav = r.is_favorite ? "⭐ " : "";
            const time =
              r.prep_time_minutes || r.cook_time_minutes
                ? ` (${(r.prep_time_minutes || 0) + (r.cook_time_minutes || 0)}min)`
                : "";
            return `${fav}**${r.name}**${time}${r.cuisine ? ` — ${r.cuisine}` : ""}`;
          });
          botResponse = `📖 Here are some of our recipes:\n\n${list.join("\n")}\n\nWant to know more about any of these? Just ask!`;
        } else {
          botResponse = `📖 No recipes added yet — but I'm sure your host has some delicious ideas! Ask them directly 😋`;
        }
        break;
      }

      case "greeting": {
        // Build contextual greeting based on what data is actually available
        const features: string[] = [];
        if (bio.sleep_time || bio.wake_time)
          features.push("• 🛏️ What time we sleep & wake");
        if (bio.schedule_today) features.push("• 📅 Today's schedule");
        features.push("• 📶 WiFi help");
        features.push("• 📋 House rules");

        // Check if recipes exist
        const { count: recipeCount } = await db
          .from("recipes")
          .select("id", { count: "exact", head: true })
          .eq("user_id", tag.user_id);
        if (recipeCount && recipeCount > 0) {
          features.push("• 🍽️ What's on today's menu");
          features.push("• ⚠️ Check food for allergens");
          features.push("• 📖 Our recipe collection");
        }

        features.push(
          "• 💬 Or just type anything — your host will be notified!",
        );

        botResponse = `Hey there! 👋 Welcome! I'm Jarvis, your host's assistant. Here's what I can help with:\n\n${features.join("\n")}\n\nJust tap a suggestion below or type your question!`;
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
