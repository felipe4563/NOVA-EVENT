import type { VideoInfo } from "@/lib/videos";

export type Tipo = "photo" | "plan" | "pano" | "audio" | "video";

export const TIPOS: Record<Tipo, { plural: string; accept: string; ayuda: string; ejemploAlbum: string; vacio: string }> = {
  photo: {
    plural: "Fotos",
    accept: "image/jpeg,image/png,image/webp",
    ayuda: "JPG, PNG o WebP, hasta 30 MB. Se optimizan solas para que carguen rápido.",
    ejemploAlbum: "Ej. Rústico, Elegante, Salón principal",
    vacio: "Todavía no hay fotos.",
  },
  plan: {
    plural: "Planos",
    accept: "image/jpeg,image/png,image/webp",
    ayuda: "Imagen del plano (JPG o PNG). Si lo tienes en PDF, sácale una captura.",
    ejemploAlbum: "Ej. Planta baja",
    vacio: "Todavía no hay planos.",
  },
  pano: {
    plural: "Fotos 360°",
    accept: "image/jpeg,image/png,image/webp",
    ayuda: "Foto de cámara 360° o panorámica del celular. Se recorre arrastrando.",
    ejemploAlbum: "Ej. Jardín, Salón",
    vacio: "Todavía no hay fotos 360°.",
  },
  audio: {
    plural: "Audios",
    accept: "audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,audio/wav,.mp3,.m4a,.ogg,.wav",
    ayuda: "MP3, M4A, OGG o WAV, hasta 20 MB.",
    ejemploAlbum: "Ej. Cumbia, Hora loca",
    vacio: "Todavía no hay audios.",
  },
  video: {
    plural: "Videos",
    accept: "",
    ayuda: "",
    ejemploAlbum: "",
    vacio: "Todavía no hay videos.",
  },
};

/** Lo que la galería necesita de cada archivo (ya listo para mostrar). */
export type ItemGaleria = {
  id: string;
  kind: Tipo;
  title: string | null;
  album: string | null;
  src: string | null;
  thumb: string | null;
  width: number | null;
  height: number | null;
  isCover: boolean;
  video: VideoInfo | null;
  url: string | null;
};
