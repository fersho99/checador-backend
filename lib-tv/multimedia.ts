import { supabase } from "./supabaseClient";

const BUCKET_MULTIMEDIA = "contenido-multimedia";

export type ContenidoMultimedia = {
  id: string;
  tipo: "imagen" | "video";
  orden: number;
  url: string;
};

export async function obtenerContenidoMultimedia(): Promise<ContenidoMultimedia[]> {
  const { data, error } = await supabase
    .from("contenido_multimedia")
    .select("id, tipo, orden, storage_path")
    .eq("activo", true)
    .order("orden", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((item) => ({
    id: item.id,
    tipo: item.tipo,
    orden: item.orden,
    url: supabase.storage.from(BUCKET_MULTIMEDIA).getPublicUrl(item.storage_path).data
      .publicUrl,
  }));
}
