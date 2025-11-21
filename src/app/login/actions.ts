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

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("Login error:", error);
    return { error: "Invalid email or password" };
  }

  if (!data.session) {
    return { error: "Login failed - no session" };
  }

  // Successfully logged in
  redirect("/expense");
}
