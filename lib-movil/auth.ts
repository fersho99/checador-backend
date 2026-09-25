import { supabase } from "./supabaseClient";

export type Empleado = {
  id: string;
  nombre_completo: string;
  puesto: string | null;
  foto_url: string | null;
  rostro_registrado: boolean;
  activo: boolean;
};

export async function iniciarSesion(correo: string, contrasena: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: correo,
    password: contrasena,
  });
  if (error) throw error;
  return data.session;
}

export async function cerrarSesion() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function obtenerEmpleadoActual(): Promise<Empleado | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("empleados")
    .select("id, nombre_completo, puesto, foto_url, rostro_registrado, activo")
    .eq("auth_user_id", user.id)
    .single();

  if (error) throw error;
  return data;
}
