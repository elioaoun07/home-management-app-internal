"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Please enter email and password" };
  }

  const cookieStore = await cookies();
  const supabase = await supabaseServer(cookieStore);

  let data, error;
  try {
    const result = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    data = result.data;
    error = result.error;
  } catch (e: any) {
    console.error("Login error (catch):", e);
    return {
      error:
        "Unable to connect to authentication service. Please try again later.",
      details: e.message,
    };
  }

  if (error) {
    console.error("Login error:", error);

    // Provide more specific error messages
    if (error.message?.includes("Invalid login credentials")) {
      return { error: "Invalid email or password" };
    }
    if (error.message?.includes("Internal")) {
      return {
        error:
          "Authentication service is temporarily unavailable. Please try again.",
      };
    }

    return { error: error.message || "Invalid email or password" };
  }

  if (!data.session) {
    return { error: "Login failed - no session" };
  }

  // Successfully logged in
  redirect("/expense");
}
