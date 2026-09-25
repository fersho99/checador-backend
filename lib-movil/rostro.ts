import { supabase } from "./supabaseClient";
import type { TipoChecada } from "./checador";

const FACE_SERVICE_URL = process.env.EXPO_PUBLIC_FACE_SERVICE_URL!;

type RespuestaChecada = {
  coincide: boolean;
  confianza: number;
};

async function construirPeticion(
  fotoUri: string,
  campos: Record<string, string> = {}
): Promise<{ headers: Record<string, string>; body: FormData }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("No hay sesion activa");

  const body = new FormData();
  for (const [clave, valor] of Object.entries(campos)) body.append(clave, valor);
  body.append("foto", {
    uri: fotoUri,
    name: "foto.jpg",
    type: "image/jpeg",
  } as unknown as Blob);

  return { headers: { Authorization: `Bearer ${session.access_token}` }, body };
}

async function leerError(respuesta: Response, mensajePorDefecto: string): Promise<Error> {
  const detalle = await respuesta.json().catch(() => null);
  return new Error(typeof detalle?.detail === "string" ? detalle.detail : mensajePorDefecto);
}

// El servicio identifica al empleado por su sesion, ya no se envia empleado_id.
export async function registrarRostro(fotoUri: string): Promise<void> {
  const respuesta = await fetch(`${FACE_SERVICE_URL}/registrar-rostro`, {
    method: "POST",
    ...(await construirPeticion(fotoUri)),
  });

  if (!respuesta.ok) throw await leerError(respuesta, "No se pudo registrar el rostro.");
}

// Verifica el rostro y, si coincide, el servicio registra la checada.
export async function checarConRostro(
  fotoUri: string,
  tipo: TipoChecada
): Promise<RespuestaChecada> {
  const respuesta = await fetch(`${FACE_SERVICE_URL}/checar`, {
    method: "POST",
    ...(await construirPeticion(fotoUri, { tipo })),
  });

  if (!respuesta.ok) throw await leerError(respuesta, "No se pudo registrar la checada.");

  return respuesta.json();
}
