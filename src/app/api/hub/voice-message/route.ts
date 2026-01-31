import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// POST - Upload voice message and create message entry
export async function POST(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const threadId = formData.get("thread_id") as string | null;
    const transcript = formData.get("transcript") as string | null;
    const durationStr = formData.get("duration") as string | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "Audio file required" },
        { status: 400 },
      );
    }

    if (!threadId) {
      return NextResponse.json(
        { error: "Thread ID required" },
        { status: 400 },
      );
    }

    // Validate file size
    if (audioFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 },
      );
    }

    // Validate file type
    const allowedTypes = [
      "audio/webm",
      "audio/mp4",
      "audio/mpeg",
      "audio/ogg",
      "audio/wav",
      "audio/x-m4a",
    ];
    if (
      !allowedTypes.some((type) => audioFile.type.includes(type.split("/")[1]))
    ) {
      return NextResponse.json(
        { error: "Invalid audio format. Supported: webm, mp4, mpeg, ogg, wav" },
        { status: 400 },
      );
    }

    // Get thread and verify access
    const { data: thread } = await supabase
      .from("hub_chat_threads")
      .select("id, household_id, purpose")
      .eq("id", threadId)
      .maybeSingle();

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // Verify user has access to this thread's household
    const { data: household } = await supabase
      .from("household_links")
      .select("id, owner_user_id, partner_user_id")
      .eq("id", thread.household_id)
      .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
      .eq("active", true)
      .maybeSingle();

    if (!household) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Generate unique file path
    const extension = audioFile.name.split(".").pop() || "webm";
    const fileName = `${user.id}/${threadId}/${Date.now()}.${extension}`;

    // Convert File to Buffer for upload
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Strip codec info from mime type (e.g., "audio/webm;codecs=opus" -> "audio/webm")
    // Supabase Storage doesn't accept mime types with codec specifications
    const contentType = audioFile.type.split(";")[0];

    // Upload to Supabase Storage using admin client
    // First check if bucket exists, create if not
    const adminClient = supabaseAdmin();

    const { data: buckets } = await adminClient.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === "voice-messages");

    if (!bucketExists) {
      const { error: createError } = await adminClient.storage.createBucket(
        "voice-messages",
        {
          public: false,
          fileSizeLimit: MAX_FILE_SIZE,
          allowedMimeTypes: allowedTypes,
        },
      );

      if (createError && !createError.message.includes("already exists")) {
        console.error("Error creating bucket:", createError);
        return NextResponse.json(
          { error: "Failed to initialize storage" },
          { status: 500 },
        );
      }
    }

    // Upload file
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from("voice-messages")
      .upload(fileName, buffer, {
        contentType: contentType,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload audio file" },
        { status: 500 },
      );
    }

    // Get signed URL for playback (valid for 1 year)
    const { data: signedUrlData } = await adminClient.storage
      .from("voice-messages")
      .createSignedUrl(fileName, 365 * 24 * 60 * 60); // 1 year

    const voiceUrl = signedUrlData?.signedUrl;

    if (!voiceUrl) {
      console.error("Failed to get signed URL");
      return NextResponse.json(
        { error: "Failed to generate audio URL" },
        { status: 500 },
      );
    }

    // Parse duration
    const duration = durationStr ? parseInt(durationStr, 10) : null;

    // Create message with voice data
    const { data: message, error: messageError } = await supabase
      .from("hub_messages")
      .insert({
        household_id: thread.household_id,
        thread_id: threadId,
        sender_user_id: user.id,
        message_type: "text",
        content: transcript?.trim() || null, // Store transcript as content for search
        voice_url: voiceUrl,
        voice_transcript: transcript?.trim() || null,
        voice_duration: duration,
      })
      .select()
      .single();

    if (messageError) {
      console.error("Message insert error:", messageError);
      // Try to clean up uploaded file
      await adminClient.storage.from("voice-messages").remove([fileName]);
      return NextResponse.json(
        { error: "Failed to create message" },
        { status: 500 },
      );
    }

    // Update thread's last_message_at
    await supabase
      .from("hub_chat_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", threadId);

    return NextResponse.json({
      success: true,
      message: {
        ...message,
        status: "sent",
      },
    });
  } catch (error) {
    console.error("Voice message error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
