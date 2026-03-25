import { createClient } from "@supabase/supabase-js";
import { env, hasSupabaseEnv } from "./env";

export const supabase = hasSupabaseEnv
  ? createClient(env.supabaseUrl!, env.supabaseAnonKey!)
  : null;

export const backendMode = hasSupabaseEnv ? "supabase" : "mock";
