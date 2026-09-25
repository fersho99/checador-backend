import { supabase } from "./supabaseClient";

export type Aviso = {
  id: string;
  titulo: string;
  mensaje: string;
  activo_desde: string;
  activo_hasta: string | null;
};

export async function obtenerAvisosActivos(): Promise<Aviso[]> {
  const ahora = new Date().toISOString();

  const { data, error } = await supabase
    .from("avisos_tablero")
    .select("id, titulo, mensaje, activo_desde, activo_hasta")
    .lte("activo_desde", ahora)
    .or(`activo_hasta.is.null,activo_hasta.gte.${ahora}`)
    .order("activo_desde", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export function suscribirseAAvisos(alCambiar: (avisos: Aviso[]) => void) {
  const canal = supabase
    .channel("avisos-tablero")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "avisos_tablero" },
      async () => {
        alCambiar(await obtenerAvisosActivos());
      }
    )
    .subscribe();

  return canal;
}
