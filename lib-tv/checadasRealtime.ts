import { supabase } from "./supabaseClient";

export type ChecadaEnVivo = {
  id: string;
  tipo: "entrada" | "salida";
  hora: string;
  empleado: {
    nombre_completo: string;
    foto_url: string | null;
  };
};

export function suscribirseAChecadas(alLlegarChecada: (checada: ChecadaEnVivo) => void) {
  const canal = supabase
    .channel("checadas-en-vivo")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "checadas" },
      async (payload) => {
        const nueva = payload.new as {
          id: string;
          tipo: "entrada" | "salida";
          hora: string;
          empleado_id: string;
        };

        const { data: empleado } = await supabase
          .from("empleados")
          .select("nombre_completo, foto_url")
          .eq("id", nueva.empleado_id)
          .single();

        alLlegarChecada({
          id: nueva.id,
          tipo: nueva.tipo,
          hora: nueva.hora,
          empleado: empleado ?? { nombre_completo: "Empleado", foto_url: null },
        });
      }
    )
    .subscribe();

  return canal;
}

export async function obtenerResumenDelDia(): Promise<{ checaron: number; total: number }> {
  const hoy = new Date().toISOString().slice(0, 10);

  const { count: total } = await supabase
    .from("empleados")
    .select("id", { count: "exact", head: true })
    .eq("activo", true);

  const { data: checadasHoy } = await supabase
    .from("checadas")
    .select("empleado_id")
    .eq("tipo", "entrada")
    .gte("hora", `${hoy}T00:00:00`)
    .lte("hora", `${hoy}T23:59:59`);

  const empleadosUnicos = new Set((checadasHoy ?? []).map((c) => c.empleado_id));

  return { checaron: empleadosUnicos.size, total: total ?? 0 };
}
