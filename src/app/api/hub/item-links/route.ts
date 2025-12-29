import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface ProductInfo {
  store_name: string;
  product_title: string;
  price: number | null;
  currency: string;
  stock_status: "in_stock" | "out_of_stock" | "low_stock" | "unknown";
  stock_quantity: number | null;
  image_url: string | null;
  extra_info: Record<string, unknown>;
}

interface ItemLink {
  id: string;
  message_id: string;
  url: string;
  store_name: string | null;
  product_title: string | null;
  price: number | null;
  currency: string;
  stock_status: string | null;
  stock_quantity: number | null;
  image_url: string | null;
  extra_info: Record<string, unknown> | null;
  last_fetched_at: string | null;
  fetch_error: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Extract domain/store name from URL
 */
function extractStoreName(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Remove www. prefix and get the main domain name
    const cleanHost = hostname.replace(/^www\./, "");
    // Known store mappings for better display names
    const storeMap: Record<string, string> = {
      "mojitech.net": "Mojitech",
      "abedtahan.com": "Abed Tahan",
      "amazon.com": "Amazon",
      "ebay.com": "eBay",
      "aliexpress.com": "AliExpress",
      "newegg.com": "Newegg",
    };
    return storeMap[cleanHost] || cleanHost.split(".")[0];
  } catch {
    return "Unknown Store";
  }
}

/**
 * Random delay to appear more human-like
 */
function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Try to extract basic product info from HTML without AI (fallback)
 */
function extractBasicProductInfo(
  html: string,
  url: string
): Partial<ProductInfo> {
  const result: Partial<ProductInfo> = {};

  // Try to extract title from various common patterns
  const titlePatterns = [
    /<h1[^>]*class="[^"]*product[^"]*title[^"]*"[^>]*>([^<]+)</i,
    /<h1[^>]*>([^<]+)</i,
    /<title>([^<|]+)/i,
    /property="og:title"\s+content="([^"]+)"/i,
    /name="twitter:title"\s+content="([^"]+)"/i,
  ];

  for (const pattern of titlePatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      result.product_title = match[1].trim().replace(/\s+/g, " ");
      break;
    }
  }

  // Try to extract price - expanded patterns for Lebanese stores
  const pricePatterns = [
    // Standard price classes
    /class="[^"]*price[^"]*"[^>]*>\s*[\$€£]?\s*([\d,]+(?:\.\d{2})?)/i,
    /class="[^"]*amount[^"]*"[^>]*>\s*[\$€£]?\s*([\d,]+(?:\.\d{2})?)/i,
    // Data attributes
    /data-price="([\d.]+)"/i,
    /data-product-price="([\d.]+)"/i,
    // Schema.org
    /itemprop="price"\s+content="([\d.]+)"/i,
    /property="product:price:amount"\s+content="([\d.]+)"/i,
    // Currency with amount
    />\s*\$\s*([\d,]+(?:\.\d{2})?)\s*</,
    /USD\s*([\d,]+(?:\.\d{2})?)/i,
    /([\d,]+(?:\.\d{2})?)\s*USD/i,
    // Lebanese Pound
    /LBP\s*([\d,]+)/i,
    /([\d,]+)\s*LBP/i,
    /L\.L\.?\s*([\d,]+)/i,
    /([\d,]+)\s*L\.L\.?/i,
    // WooCommerce (common in Lebanese stores)
    /class="woocommerce-Price-amount[^"]*"[^>]*>([\d,]+(?:\.\d{2})?)/i,
    /<bdi>([\d,]+(?:\.\d{2})?)<\/bdi>/i,
    // Shopify
    /class="price[^"]*"[^>]*data-regular-price="([\d.]+)"/i,
    /class="price__regular[^"]*"[^>]*>\s*[\$€£]?\s*([\d,]+(?:\.\d{2})?)/i,
    // Generic price in span/div
    /<span[^>]*class="[^"]*price[^"]*"[^>]*>[\s\S]*?([\d,]+(?:\.\d{2})?)[\s\S]*?<\/span>/i,
  ];

  for (const pattern of pricePatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const priceStr = match[1].replace(/,/g, "");
      const price = parseFloat(priceStr);
      if (!isNaN(price) && price > 0) {
        result.price = price;
        // Detect currency
        if (
          /LBP/i.test(
            html.slice(
              Math.max(0, html.indexOf(match[0]) - 20),
              html.indexOf(match[0]) + match[0].length + 20
            )
          )
        ) {
          result.currency = "LBP";
        }
        break;
      }
    }
  }

  // Try to extract image
  const imagePatterns = [
    /property="og:image"\s+content="([^"]+)"/i,
    /class="[^"]*product[^"]*image[^"]*"[^>]*src="([^"]+)"/i,
    /data-zoom-image="([^"]+)"/i,
  ];

  for (const pattern of imagePatterns) {
    const match = html.match(pattern);
    if (match && match[1] && match[1].startsWith("http")) {
      result.image_url = match[1];
      break;
    }
  }

  // Try to detect stock status
  // IMPORTANT: Check for out-of-stock FIRST, as "Add to Cart" buttons may exist
  // elsewhere on the page (related products, navigation, etc.)

  // Explicit out-of-stock indicators - very specific patterns
  const outOfStockPatterns = [
    // WooCommerce stock status class
    /class="[^"]*stock[^"]*out-of-stock[^"]*"/i,
    /class="[^"]*out-of-stock[^"]*"/i,
    // Explicit text in stock area
    /<p[^>]*class="[^"]*stock[^"]*"[^>]*>[\s\S]*?out\s+of\s+stock/i,
    // Generic visible text
    />Out of stock</i,
    />out of stock</i,
    />Sold out</i,
    />sold out</i,
    // Schema.org markup
    /itemprop="availability"[^>]*OutOfStock/i,
    /"availability":\s*"https?:\/\/schema\.org\/OutOfStock"/i,
    /"availability":\s*"OutOfStock"/i,
    // Data attributes
    /data-availability="out-of-stock"/i,
    /data-stock-status="outofstock"/i,
    // WooCommerce specific
    /class="single_add_to_cart_button[^"]*disabled/i,
  ];

  // Check for explicit out-of-stock FIRST
  let isExplicitlyOutOfStock = false;
  for (const pattern of outOfStockPatterns) {
    if (pattern.test(html)) {
      isExplicitlyOutOfStock = true;
      result.stock_status = "out_of_stock";
      break;
    }
  }

  // Only check for Add to Cart if NOT explicitly out of stock
  if (!isExplicitlyOutOfStock) {
    // Look for Add to Cart in the main product area only
    // These patterns are more specific to avoid matching nav/footer buttons
    const addToCartPatterns = [
      // WooCommerce main add to cart button
      /class="single_add_to_cart_button[^"]*"[^>]*>[\s\S]*?add\s*to\s*cart/i,
      // Shopify add to cart
      /class="[^"]*product-form[^"]*"[\s\S]*?add\s*to\s*cart/i,
      // Button with product form context
      /<form[^>]*class="[^"]*cart[^"]*"[\s\S]*?add\s*to\s*cart/i,
      // Data action specifically for cart
      /data-action="add-to-cart"[^>]*class="[^"]*single/i,
    ];

    for (const pattern of addToCartPatterns) {
      if (pattern.test(html)) {
        result.stock_status = "in_stock";
        break;
      }
    }
  }

  // If still unknown, check for general "in stock" text
  if (!result.stock_status) {
    if (/class="[^"]*stock[^"]*"[^>]*>[\s\S]*?in\s+stock/i.test(html)) {
      result.stock_status = "in_stock";
    }
  }

  return result;
}

/**
 * Fetch webpage with multiple retry strategies
 */
async function fetchWithRetry(
  url: string
): Promise<{ html: string; success: boolean }> {
  // Different user agent strings to try
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  ];

  for (let i = 0; i < userAgents.length; i++) {
    try {
      // Add random delay between retries
      if (i > 0) {
        await randomDelay(1000, 3000);
      }

      const response = await fetch(url, {
        headers: {
          "User-Agent": userAgents[i],
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          "Sec-Ch-Ua":
            '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": '"Windows"',
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
          Referer: new URL(url).origin,
        },
        signal: AbortSignal.timeout(20000), // 20 second timeout
        redirect: "follow",
      });

      if (response.ok) {
        const html = await response.text();
        return { html, success: true };
      }

      // If 403, try next user agent
      if (response.status === 403 || response.status === 429) {
        console.log(
          `Attempt ${i + 1} failed with ${response.status}, trying different approach...`
        );
        continue;
      }

      // Other errors, throw
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      if (i === userAgents.length - 1) {
        console.error(`All fetch attempts failed for ${url}`);
        throw error;
      }
    }
  }

  return { html: "", success: false };
}

/**
 * Fetch webpage content and extract product info using regex patterns
 * No AI/Gemini required - pure HTML parsing
 */
async function scrapeProductInfo(url: string): Promise<ProductInfo> {
  const storeName = extractStoreName(url);

  // Default result for failures
  const defaultResult: ProductInfo = {
    store_name: storeName,
    product_title: "Click to view",
    price: null,
    currency: "USD",
    stock_status: "unknown",
    stock_quantity: null,
    image_url: null,
    extra_info: {},
  };

  try {
    // Try to fetch the webpage
    const { html, success } = await fetchWithRetry(url);

    if (!success || !html) {
      console.log(`Could not fetch ${url}, returning basic info`);
      return {
        ...defaultResult,
        extra_info: {
          note: "Website blocked automated access. Click link to view manually.",
        },
      };
    }

    // Clean HTML for processing
    const cleanedHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "")
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "")
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // Extract product info using regex patterns
    const basicInfo = extractBasicProductInfo(cleanedHtml, url);

    console.log(`Basic extraction for ${url}:`, basicInfo);

    return {
      store_name: storeName,
      product_title: basicInfo.product_title || "View product",
      price: basicInfo.price || null,
      currency: basicInfo.currency || "USD",
      stock_status: basicInfo.stock_status || "unknown",
      stock_quantity: null,
      image_url: basicInfo.image_url || null,
      extra_info: { extraction_method: "basic" },
    };
  } catch (error) {
    console.error(`Failed to scrape ${url}:`, error);

    return {
      ...defaultResult,
      extra_info: {
        error: error instanceof Error ? error.message : "Unknown error",
        note: "Could not fetch product info. Click link to view manually.",
      },
    };
  }
}

/**
 * GET /api/hub/item-links?message_id=xxx
 * Get all links for a shopping item
 */
export async function GET(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const messageId = searchParams.get("message_id");

  if (!messageId) {
    return NextResponse.json({ error: "message_id required" }, { status: 400 });
  }

  // Verify user has access to this message's household
  const { data: message } = await supabase
    .from("hub_messages")
    .select(
      `
      id,
      thread:hub_chat_threads!thread_id (
        id,
        household_id,
        household:household_links!household_id (
          id,
          owner_user_id,
          partner_user_id,
          active
        )
      )
    `
    )
    .eq("id", messageId)
    .single();

  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const household = (message.thread as any)?.household;
  if (
    !household ||
    !household.active ||
    (household.owner_user_id !== user.id &&
      household.partner_user_id !== user.id)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Fetch all links for this message
  const { data: links, error } = await supabase
    .from("shopping_item_links")
    .select("*")
    .eq("message_id", messageId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch links:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(links || []);
}

/**
 * POST /api/hub/item-links
 * Add a new link to a shopping item and optionally scrape product info
 */
export async function POST(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { message_id, url, auto_fetch = true } = body;

  if (!message_id || !url) {
    return NextResponse.json(
      { error: "message_id and url required" },
      { status: 400 }
    );
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Verify user has access to this message's household
  const { data: message } = await supabase
    .from("hub_messages")
    .select(
      `
      id,
      thread:hub_chat_threads!thread_id (
        id,
        household_id,
        household:household_links!household_id (
          id,
          owner_user_id,
          partner_user_id,
          active
        )
      )
    `
    )
    .eq("id", message_id)
    .single();

  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const household = (message.thread as any)?.household;
  if (
    !household ||
    !household.active ||
    (household.owner_user_id !== user.id &&
      household.partner_user_id !== user.id)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Check if link already exists
  const { data: existingLink } = await supabase
    .from("shopping_item_links")
    .select("id")
    .eq("message_id", message_id)
    .eq("url", url)
    .single();

  if (existingLink) {
    return NextResponse.json(
      { error: "This URL is already added to this item" },
      { status: 409 }
    );
  }

  // Extract store name from URL
  const storeName = extractStoreName(url);

  // Create the link first
  const linkData: Partial<ItemLink> = {
    message_id,
    url,
    store_name: storeName,
    currency: "USD",
  };

  const { data: link, error } = await supabase
    .from("shopping_item_links")
    .insert({ ...linkData, user_id: user.id })
    .select()
    .single();

  if (error) {
    console.error("Failed to create link:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If auto_fetch is true, scrape product info in the background
  if (auto_fetch) {
    // Don't await - let it run in background
    scrapeAndUpdateLink(supabase, link.id, url).catch(console.error);
  }

  return NextResponse.json(link, { status: 201 });
}

/**
 * Scrape product info and update the link
 */
async function scrapeAndUpdateLink(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  linkId: string,
  url: string
) {
  try {
    const productInfo = await scrapeProductInfo(url);

    await supabase
      .from("shopping_item_links")
      .update({
        store_name: productInfo.store_name,
        product_title: productInfo.product_title,
        price: productInfo.price,
        currency: productInfo.currency,
        stock_status: productInfo.stock_status,
        stock_quantity: productInfo.stock_quantity,
        image_url: productInfo.image_url,
        extra_info: productInfo.extra_info,
        last_fetched_at: new Date().toISOString(),
        fetch_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", linkId);
  } catch (error) {
    console.error(`Failed to scrape and update link ${linkId}:`, error);

    await supabase
      .from("shopping_item_links")
      .update({
        fetch_error: error instanceof Error ? error.message : "Unknown error",
        last_fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", linkId);
  }
}

/**
 * PATCH /api/hub/item-links
 * Refresh product info for a link
 */
export async function PATCH(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { link_id, action } = body;

  if (!link_id) {
    return NextResponse.json({ error: "link_id required" }, { status: 400 });
  }

  // Get the link and verify ownership
  const { data: link } = await supabase
    .from("shopping_item_links")
    .select("*, message:hub_messages!message_id(id, thread_id)")
    .eq("id", link_id)
    .single();

  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  if (action === "refresh") {
    // Re-scrape product info
    const productInfo = await scrapeProductInfo(link.url);

    const { data: updatedLink, error } = await supabase
      .from("shopping_item_links")
      .update({
        store_name: productInfo.store_name,
        product_title: productInfo.product_title,
        price: productInfo.price,
        currency: productInfo.currency,
        stock_status: productInfo.stock_status,
        stock_quantity: productInfo.stock_quantity,
        image_url: productInfo.image_url,
        extra_info: productInfo.extra_info,
        last_fetched_at: new Date().toISOString(),
        fetch_error: (productInfo.extra_info?.error as string) || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", link_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(updatedLink);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

/**
 * DELETE /api/hub/item-links?link_id=xxx
 * Remove a link from a shopping item
 */
export async function DELETE(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const linkId = searchParams.get("link_id");

  if (!linkId) {
    return NextResponse.json({ error: "link_id required" }, { status: 400 });
  }

  // Verify ownership (user can only delete their own links)
  const { data: link } = await supabase
    .from("shopping_item_links")
    .select("id, user_id")
    .eq("id", linkId)
    .single();

  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  if (link.user_id !== user.id) {
    return NextResponse.json(
      { error: "You can only delete your own links" },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("shopping_item_links")
    .delete()
    .eq("id", linkId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/**
 * Batch refresh all links for a message
 * POST /api/hub/item-links/refresh-all
 */
export async function refreshAllLinks(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  messageId: string
) {
  const { data: links } = await supabase
    .from("shopping_item_links")
    .select("id, url")
    .eq("message_id", messageId);

  if (!links || links.length === 0) return;

  // Refresh all links in parallel with rate limiting
  const results = await Promise.allSettled(
    links.map(async (link, index) => {
      // Stagger requests to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, index * 500));
      return scrapeAndUpdateLink(supabase, link.id, link.url);
    })
  );

  return results;
}
