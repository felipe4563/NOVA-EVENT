// Datos de la propuesta que ven los novios (pantalla completa, enlace público y PDF).
// Sin "server-only": el PDF también importa estos tipos.
import type { ContactoEmpresa } from "@/lib/empresa";
import type { VideoInfo } from "@/lib/videos";

export type TemaNova = "vino" | "oro" | "agua";

export type FotoPropuesta = { src: string; miniatura: string; titulo: string | null };

export type LineaPropuesta = {
  proveedor: string | null;
  paquete: string | null;
  /** Descripción del paquete del proveedor (no incluye notas ni contactos). */
  descripcion: string | null;
  etiqueta: string;
  /** Centavos. */
  total: number;
  portada: string | null;
  fotos: FotoPropuesta[];
  pano: { src: string; ancho: number; alto: number } | null;
  audio: string | null;
  video: VideoInfo | null;
};

export type VersionPropuesta = {
  id: string;
  nombre: string;
  nova: { nombre: string; precio: number; frase: string | null; incluye: string[]; theme: TemaNova } | null;
  secciones: { categoria: string; lineas: LineaPropuesta[] }[];
  totales: { proveedores: number; nova: number; general: number };
};

export type Propuesta = {
  codigo: string;
  cliente: string;
  tipo: string;
  /** "AAAA-MM-DD". */
  fecha: string;
  /** "18:00 – 23:00" o null si es todo el día. */
  horario: string | null;
  invitados: number | null;
  /** "AAAA-MM-DD" o null. */
  validez: string | null;
  mostrarPresupuesto: boolean;
  /** Centavos; solo viene si mostrarPresupuesto. */
  presupuesto: number | null;
  /** Si la barra cuenta también el paquete Nova. */
  incluyeNovaEnPresupuesto: boolean;
  versiones: VersionPropuesta[];
  /** Proveedores de las versiones mostradas (para autorizar sus archivos en el enlace público). */
  proveedoresVisibles: string[];
  /** Contacto de Nova Event para el pie (Administración → Empresa). */
  empresa: ContactoEmpresa;
};
