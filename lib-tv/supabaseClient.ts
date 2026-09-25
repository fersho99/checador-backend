import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// La pantalla no tiene login de persona: inicia sesion una sola vez con la
// cuenta de servicio de solo lectura que crea Fernando en Supabase Auth.
export async function iniciarSesionPantalla() {
  const correo = process.env.EXPO_PUBLIC_PANTALLA_CORREO!;
  const contrasena = process.env.EXPO_PUBLIC_PANTALLA_CONTRASENA!;

  const { data, error } = await supabase.auth.signInWithPassword({
    email: correo,
    password: contrasena,
  });
  if (error) throw error;
  return data.session;
}
