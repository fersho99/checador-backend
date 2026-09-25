import { supabase } from "./supabaseClient";

export type TipoChecada = "entrada" | "salida";
export type MetodoBiometrico = "huella" | "rostro";

export type Checada = {
  id: string;
  tipo: TipoChecada;
  hora: string;
  metodo_biometrico: MetodoBiometrico;
};

export type ChecadaConPuntualidad = Checada & {
  puntual: boolean | null; // null cuando no aplica (checadas de salida)
};

export type DiaTrabajado = {
  fecha: string; // YYYY-MM-DD
  entrada: string | null;
  salida: string | null;
  horasTrabajadas: number | null;
};

// Solo para checadas por huella (validada en el dispositivo). Las checadas por rostro
// las registra el servicio facial: ver checarConRostro() en rostro.ts.
export async function registrarChecado(tipo: TipoChecada, metodo: "huella" = "huella") {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay sesion activa");

  const { data: empleado, error: errorEmpleado } = await supabase
    .from("empleados")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (errorEmpleado || !empleado) throw errorEmpleado ?? new Error("Empleado no encontrado");

  const { error } = await supabase.from("checadas").insert({
    empleado_id: empleado.id,
    tipo,
    metodo_biometrico: metodo,
  });
  if (error) throw error;
}

export async function obtenerMisCheckadas(): Promise<ChecadaConPuntualidad[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay sesion activa");

  const { data: empleado, error: errorEmpleado } = await supabase
    .from("empleados")
    .select("id, hora_entrada_esperada")
    .eq("auth_user_id", user.id)
    .single();
  if (errorEmpleado || !empleado) throw errorEmpleado ?? new Error("Empleado no encontrado");

  const { data, error } = await supabase
    .from("checadas")
    .select("id, tipo, hora, metodo_biometrico")
    .eq("empleado_id", empleado.id)
    .order("hora", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((checada) => ({
    ...checada,
    puntual:
      checada.tipo === "entrada"
        ? calcularPuntualidad(checada.hora, empleado.hora_entrada_esperada)
        : null,
  }));
}

export function calcularPuntualidad(horaChecada: string, horaEsperada: string): boolean {
  const hora = new Date(horaChecada);
  const [horaEsp, minEsp] = horaEsperada.split(":").map(Number);

  const limite = new Date(hora);
  limite.setHours(horaEsp, minEsp, 0, 0);

  return hora.getTime() <= limite.getTime();
}

function fechaLocal(iso: string): string {
  const d = new Date(iso);
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export async function obtenerHorasDelDia(fecha: string): Promise<DiaTrabajado> {
  const checadas = await obtenerMisCheckadas();
  // `hora` viene en UTC; se compara el dia en la zona horaria local del dispositivo.
  const delDia = checadas.filter((c) => fechaLocal(c.hora) === fecha);

  // obtenerMisCheckadas viene de la mas reciente a la mas antigua: la primera entrada
  // del dia es la ultima del arreglo y la salida final es la primera.
  const entrada = [...delDia].reverse().find((c) => c.tipo === "entrada")?.hora ?? null;
  const salida = delDia.find((c) => c.tipo === "salida")?.hora ?? null;

  return {
    fecha,
    entrada,
    salida,
    horasTrabajadas: calcularHorasDelDia(entrada, salida),
  };
}

export function calcularHorasDelDia(entrada: string | null, salida: string | null): number | null {
  if (!entrada || !salida) return null;
  const diffMs = new Date(salida).getTime() - new Date(entrada).getTime();
  return Math.max(0, Math.round((diffMs / 1000 / 60 / 60) * 100) / 100);
}
