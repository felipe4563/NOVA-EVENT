// PDF de la propuesta (lo reciben los novios por WhatsApp): misma estética que la propuesta web,
// en A4 vertical. Nunca notas internas ni contactos: solo usa lo que trae `Propuesta`.
import "server-only";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Circle, Document, Font, Image, Link, Page, Path, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import sharp from "sharp";
import { rutasMarca } from "@/lib/archivos";
import { estadoPresupuesto } from "@/lib/cotizacion/calculo";
import { formatoBs } from "@/lib/cotizacion/dinero";
import { fechaLarga } from "@/lib/fechas";
import type { LineaPropuesta, Propuesta, TemaNova, VersionPropuesta } from "./tipos";

const FOTOS_POR_LINEA = 4;

// Colores de marca (src/app/globals.css).
export const C = {
  vino50: "#fbf1f4",
  vino100: "#f4dde4",
  vino500: "#9c3a58",
  vino600: "#7a2944",
  vino700: "#5f1f35",
  vino800: "#461827",
  oro300: "#d9bf8f",
  oro500: "#b8935a",
  oro700: "#8c6c3c",
  agua100: "#e2efee",
  agua300: "#9fc6c4",
  agua500: "#5b9a99",
  agua700: "#3e7473",
  carbon: "#272c30",
  suave: "#5d6266",
  marmol: "#f9f2ef",
};

/* ── Fuentes (TTF estáticas, OFL) ────────────────────────────── */

// Ruta absoluta desde la raíz del proyecto: en Docker se copian con outputFileTracingIncludes (next.config.ts).
const fuente = (archivo: string) => path.join(process.cwd(), "src", "assets", "fonts", archivo);
Font.register({
  family: "Cinzel",
  fonts: [
    { src: fuente("Cinzel-Regular.ttf"), fontWeight: 400 },
    { src: fuente("Cinzel-Bold.ttf"), fontWeight: 700 },
  ],
});
Font.register({
  family: "Montserrat",
  fonts: [
    { src: fuente("Montserrat-Regular.ttf"), fontWeight: 400 },
    { src: fuente("Montserrat-SemiBold.ttf"), fontWeight: 600 },
    { src: fuente("Montserrat-Bold.ttf"), fontWeight: 700 },
  ],
});
// Sin guiones de corte (el corte por defecto es para inglés).
Font.registerHyphenationCallback((palabra) => [palabra]);

/* ── Imágenes fijas: logo y fondo de mármol (se preparan una vez) ── */

/** El PDF usa siempre el logo claro: el subido en Administración → Empresa o el original. Se recalcula si cambia. */
let logoPng: { clave: string; png: Promise<Buffer> } | null = null;
export async function logo() {
  const { subida, respaldo } = rutasMarca("logo-claro.webp");
  const info = await stat(subida).catch(() => null);
  const ruta = info?.isFile() ? subida : respaldo;
  const clave = info?.isFile() ? `${ruta}:${info.mtimeMs}` : ruta;
  if (logoPng?.clave !== clave) logoPng = { clave, png: sharp(ruta).resize({ width: 600, withoutEnlargement: true }).png().toBuffer() };
  return logoPng.png;
}

// El mármol claro de la web (bg-marmol-claro), dibujado una vez como JPEG del tamaño de la hoja.
const SVG_MARMOL = `<svg xmlns="http://www.w3.org/2000/svg" width="1190" height="1684">
  <defs>
    <radialGradient id="a" cx="0" cy="1" r="0.75"><stop offset="0" stop-color="#c9899a" stop-opacity="0.5"/><stop offset="0.7" stop-color="#c9899a" stop-opacity="0"/></radialGradient>
    <radialGradient id="b" cx="1" cy="0" r="0.65"><stop offset="0" stop-color="#5b9a99" stop-opacity="0.42"/><stop offset="0.7" stop-color="#5b9a99" stop-opacity="0"/></radialGradient>
    <radialGradient id="c" cx="0.92" cy="0.92" r="0.45"><stop offset="0" stop-color="#dfb2bd" stop-opacity="0.55"/><stop offset="0.7" stop-color="#dfb2bd" stop-opacity="0"/></radialGradient>
    <radialGradient id="d" cx="0.08" cy="0.06" r="0.4"><stop offset="0" stop-color="#9fc6c4" stop-opacity="0.45"/><stop offset="0.7" stop-color="#9fc6c4" stop-opacity="0"/></radialGradient>
    <linearGradient id="e" x1="0" y1="1" x2="1" y2="0.2"><stop offset="0.38" stop-color="#fff" stop-opacity="0"/><stop offset="0.46" stop-color="#fff" stop-opacity="0.55"/><stop offset="0.54" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="f" x1="0" y1="0.2" x2="1" y2="1"><stop offset="0.58" stop-color="#b8935a" stop-opacity="0"/><stop offset="0.62" stop-color="#b8935a" stop-opacity="0.12"/><stop offset="0.66" stop-color="#b8935a" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="${C.marmol}"/>
  <rect width="100%" height="100%" fill="url(#a)"/><rect width="100%" height="100%" fill="url(#b)"/>
  <rect width="100%" height="100%" fill="url(#c)"/><rect width="100%" height="100%" fill="url(#d)"/>
  <rect width="100%" height="100%" fill="url(#e)"/><rect width="100%" height="100%" fill="url(#f)"/>
</svg>`;
let marmolJpg: Promise<Buffer> | null = null;
function marmol() {
  marmolJpg ??= sharp(Buffer.from(SVG_MARMOL)).jpeg({ quality: 80 }).toBuffer();
  return marmolJpg;
}

type Imagen = { data: Buffer; format: "jpg" | "png" };
const jpg = (data: Buffer): Imagen => ({ data, format: "jpg" });

/* ── Estilos ─────────────────────────────────────────────────── */

const s = StyleSheet.create({
  pagina: { paddingTop: 46, paddingBottom: 58, paddingHorizontal: 46, fontFamily: "Montserrat", fontSize: 9.5, color: C.carbon, backgroundColor: "#ffffff" },
  fondo: { position: "absolute", top: 0, left: 0, width: 595.28, height: 841.89 },
  marco: { position: "absolute", top: 16, left: 16, right: 16, bottom: 16, borderWidth: 0.75, borderColor: C.oro300, borderRadius: 10 },
  pie: { position: "absolute", bottom: 26, left: 46, right: 46, flexDirection: "row", justifyContent: "space-between", fontSize: 7, letterSpacing: 1.5, color: C.oro700 },
  rotulo: { fontSize: 7.5, fontWeight: 600, letterSpacing: 2.6, color: C.oro700, textTransform: "uppercase", textAlign: "center" },
  titulo: { fontFamily: "Cinzel", fontSize: 19, color: C.vino600, textAlign: "center", marginTop: 4 },
  tarjeta: { borderRadius: 10, borderWidth: 0.75, borderColor: C.oro300, backgroundColor: "#ffffff", marginBottom: 14 },
  suave: { color: C.suave },
});

/* ── Adornos ─────────────────────────────────────────────────── */

export function Ornamento({ ancho = 150, color = C.oro500, margen = 8 }: { ancho?: number; color?: string; margen?: number }) {
  return (
    <View style={{ alignItems: "center", marginTop: margen }}>
      <Svg viewBox="0 0 220 14" style={{ width: ancho, height: (ancho * 14) / 220 }}>
        <Path d="M0 7h92M128 7h92" stroke={color} strokeWidth={1} />
        <Path d="M110 1l6 6-6 6-6-6z" fill={color} />
        <Circle cx={98} cy={7} r={1.6} fill={color} />
        <Circle cx={122} cy={7} r={1.6} fill={color} />
      </Svg>
    </View>
  );
}

function Rotulo({ children, color, alinear = "center" }: { children: string; color?: string; alinear?: "center" | "left" | "right" }) {
  return <Text style={[s.rotulo, { textAlign: alinear }, color ? { color } : {}]}>{children}</Text>;
}

function Check({ color }: { color: string }) {
  return (
    <Svg viewBox="0 0 20 20" style={{ width: 9, height: 9, marginTop: 1.5, marginRight: 6 }}>
      <Path d="m4 10.5 4 4 8-9" stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Marco dorado y número de página en todas las hojas de contenido. */
function Fijos({ codigo }: { codigo: string }) {
  return (
    <>
      <View fixed style={s.marco} />
      <View fixed style={s.pie}>
        <Text>NOVA EVENT · {codigo}</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </>
  );
}

/* ── 1. Portada ──────────────────────────────────────────────── */

function Portada({ p, logo, fondo }: { p: Propuesta; logo: Imagen; fondo: Imagen }) {
  const datos: [string, string][] = [
    ["Fecha", fechaLarga(p.fecha)],
    ...(p.horario ? ([["Horario", p.horario]] as [string, string][]) : []),
    ...(p.invitados ? ([["Invitados", `${p.invitados} ${p.invitados === 1 ? "persona" : "personas"}`]] as [string, string][]) : []),
  ];
  return (
    <Page size="A4" style={[s.pagina, { paddingTop: 0, paddingBottom: 0, justifyContent: "center", alignItems: "center", backgroundColor: C.marmol }]}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf: las imágenes del PDF no llevan texto alternativo */}
      <Image fixed src={fondo} style={s.fondo} />
      <View style={s.marco} />
      <View style={{ width: 420, alignItems: "center", backgroundColor: "#ffffff", borderRadius: 14, borderWidth: 0.75, borderColor: C.oro300, paddingVertical: 44, paddingHorizontal: 30 }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf */}
        <Image src={logo} style={{ width: 170 }} />
        <Ornamento margen={22} />
        <View style={{ marginTop: 22 }}>
          <Rotulo>Propuesta para</Rotulo>
        </View>
        <Text style={{ fontFamily: "Cinzel", fontSize: 28, lineHeight: 1.2, color: C.vino600, textAlign: "center", marginTop: 10 }}>{p.cliente}</Text>
        <Text style={{ fontFamily: "Cinzel", fontSize: 14, color: C.vino500, textAlign: "center", marginTop: 8, letterSpacing: 0.5 }}>{p.tipo}</Text>
        <View style={{ marginTop: 28, width: "100%", gap: 7 }}>
          {datos.map(([k, v]) => (
            <View key={k} style={{ backgroundColor: C.vino50, borderWidth: 0.75, borderColor: C.vino100, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignItems: "center" }}>
              <Rotulo>{k}</Rotulo>
              <Text style={{ marginTop: 3, fontSize: 10.5, fontWeight: 600 }}>{v.charAt(0).toUpperCase() + v.slice(1)}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={{ position: "absolute", bottom: 34, left: 0, right: 0, textAlign: "center", fontFamily: "Cinzel", fontSize: 9.5, color: C.vino600 }}>{p.empresa.lema ?? p.empresa.nombre}</Text>
    </Page>
  );
}

/* ── 2–4. Una versión: proveedores, paquete Nova y totales ───── */

type Recursos = { imagenes: Map<string, Imagen>; qr: string | null; logo: Imagen };

function Version({ v, p, varias, r }: { v: VersionPropuesta; p: Propuesta; varias: boolean; r: Recursos }) {
  return (
    <View>
      {varias && (
        <View style={{ marginBottom: 18, paddingBottom: 12, borderBottomWidth: 0.75, borderBottomColor: C.oro300 }}>
          <Rotulo>Opción</Rotulo>
          <Text style={[s.titulo, { fontSize: 22 }]}>{v.nombre}</Text>
        </View>
      )}
      {v.secciones.map((sec, i) => (
        <View key={`${sec.categoria}-${i}`} style={{ marginBottom: 10 }}>
          {/* El título nunca queda solo al pie de una hoja: va pegado a la primera línea. */}
          <View wrap={false}>
            <View style={{ marginBottom: 12 }}>
              <Rotulo>{String(i + 1).padStart(2, "0")}</Rotulo>
              <Text style={s.titulo}>{sec.categoria}</Text>
              <Ornamento ancho={110} margen={5} />
            </View>
            {sec.lineas[0] && <Linea l={sec.lineas[0]} r={r} />}
          </View>
          {sec.lineas.slice(1).map((l, j) => (
            <Linea key={j} l={l} r={r} />
          ))}
        </View>
      ))}
      {v.nova && <PaqueteNova nova={v.nova} />}
      <Totales v={v} p={p} />
    </View>
  );
}

function Precio({ total, color = C.vino600 }: { total: number; color?: string }) {
  return (
    <View style={{ alignItems: "flex-end", marginLeft: 12 }}>
      <Rotulo alinear="right">Inversión</Rotulo>
      <Text style={{ fontFamily: "Cinzel", fontSize: 15, color, marginTop: 2 }}>{formatoBs(total)}</Text>
    </View>
  );
}

function Linea({ l, r }: { l: LineaPropuesta; r: Recursos }) {
  const nombre = l.proveedor ?? l.etiqueta;
  // Igual que la web: "Monto manual" no dice nada a los novios.
  const subtitulo = l.proveedor ? (l.paquete ?? (l.etiqueta !== "Monto manual" && l.etiqueta !== l.proveedor ? l.etiqueta : null)) : null;
  const portada = l.portada ? r.imagenes.get(l.portada) : undefined;
  const fotos = l.fotos.flatMap((f) => r.imagenes.get(f.miniatura) ?? []).slice(0, FOTOS_POR_LINEA);
  const medios = [l.audio && "audio", l.video && "video", l.pano && "recorrido 360°"].filter(Boolean) as string[];

  // Línea libre, sin proveedor ni fotos: renglón sencillo.
  if (!l.proveedor && !l.portada) {
    return (
      <View wrap={false} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.vino50, borderWidth: 0.75, borderColor: C.vino100, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 12 }}>
        <Text style={{ fontFamily: "Cinzel", fontSize: 12, color: C.vino700, flex: 1 }}>{nombre}</Text>
        <Precio total={l.total} />
      </View>
    );
  }

  // Una tarjeta normal cabe en una hoja: no se corta (solo una descripción muy larga la deja partirse).
  return (
    <View wrap={(l.descripcion?.length ?? 0) > 700} style={s.tarjeta}>
      {portada ? (
        <View wrap={false} style={{ height: 190, borderTopLeftRadius: 10, borderTopRightRadius: 10, overflow: "hidden", backgroundColor: C.vino50 }}>
          {/* La sombra para leer el nombre ya viene en la imagen (ver portadaJpeg). */}
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf */}
          <Image src={portada} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, objectFit: "cover" }} />
          <View style={{ position: "absolute", left: 16, right: 16, bottom: 14 }}>
            <Text style={{ fontFamily: "Cinzel", fontSize: 20, color: "#ffffff" }}>{nombre}</Text>
            {subtitulo && <Text style={{ marginTop: 3, fontSize: 9.5, fontWeight: 600, color: C.oro300 }}>{subtitulo}</Text>}
          </View>
        </View>
      ) : (
        <View wrap={false} style={{ backgroundColor: C.vino50, borderTopLeftRadius: 10, borderTopRightRadius: 10, paddingVertical: 14, paddingHorizontal: 16 }}>
          <Text style={{ fontFamily: "Cinzel", fontSize: 18, color: C.vino600 }}>{nombre}</Text>
          {subtitulo && <Text style={{ marginTop: 3, fontSize: 9.5, fontWeight: 600, color: C.oro700 }}>{subtitulo}</Text>}
        </View>
      )}

      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Text style={[s.suave, { flex: 1, lineHeight: 1.5 }]}>{l.descripcion ?? ""}</Text>
          <Precio total={l.total} />
        </View>

        {fotos.length > 0 && (
          <View wrap={false} style={{ flexDirection: "row", gap: 6, marginTop: 12 }}>
            {fotos.map((f, i) => (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf
              <Image key={i} src={f} style={{ width: 113, height: 85, objectFit: "cover", borderRadius: 5 }} />
            ))}
          </View>
        )}

        {medios.length > 0 && (
          <View wrap={false} style={{ flexDirection: "row", alignItems: "center", marginTop: 12, paddingTop: 10, borderTopWidth: 0.75, borderTopColor: C.oro300 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf */}
            {r.qr && <Image src={r.qr} style={{ width: 54, height: 54, marginRight: 10 }} />}
            <View style={{ flex: 1 }}>
              <Rotulo alinear="left">{`Con ${medios.join(", ")}`}</Rotulo>
              <Text style={{ marginTop: 3, color: C.vino600, fontWeight: 600 }}>
                {r.qr ? "Escúchalo / míralo en el enlace: escanea el código." : "Escúchalo / míralo en el enlace de la propuesta."}
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const TEMA: Record<TemaNova, { fondo: string; texto: string; suave: string; marca: string }> = {
  agua: { fondo: C.agua700, texto: C.agua100, suave: C.agua100, marca: C.agua300 },
  vino: { fondo: C.vino600, texto: C.vino50, suave: C.vino100, marca: C.oro300 },
  oro: { fondo: C.oro700, texto: C.oro300, suave: C.oro300, marca: "#ffffff" },
};

function PaqueteNova({ nova }: { nova: NonNullable<VersionPropuesta["nova"]> }) {
  const t = TEMA[nova.theme];
  return (
    <View wrap={false} style={{ marginTop: 4, marginBottom: 16 }}>
      <View style={{ marginBottom: 12 }}>
        <Rotulo>Organización</Rotulo>
        <Text style={s.titulo}>Paquete Nova Event</Text>
        <Ornamento ancho={110} margen={5} />
      </View>
      <View style={{ backgroundColor: t.fondo, borderRadius: 12, borderWidth: 0.75, borderColor: C.oro300, padding: 20 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingBottom: 12, borderBottomWidth: 0.75, borderBottomColor: t.marca }}>
          <View style={{ flex: 1 }}>
            <Rotulo alinear="left" color={t.marca}>Paquete</Rotulo>
            <Text style={{ fontFamily: "Cinzel", fontSize: 22, color: t.texto, marginTop: 3 }}>{nova.nombre}</Text>
            {nova.frase && <Text style={{ marginTop: 4, fontSize: 9, fontStyle: "normal", color: t.suave }}>{nova.frase}</Text>}
          </View>
          <Text style={{ fontFamily: "Cinzel", fontSize: 20, color: t.texto, marginLeft: 12 }}>{formatoBs(nova.precio)}</Text>
        </View>
        {nova.incluye.length > 0 && (
          <>
            <View style={{ marginTop: 12 }}>
              <Rotulo alinear="left" color={t.marca}>Incluye</Rotulo>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
              {nova.incluye.map((item, i) => (
                <View key={i} style={{ width: "50%", flexDirection: "row", paddingRight: 10, marginTop: 5 }}>
                  <Check color={t.marca} />
                  <Text style={{ flex: 1, color: t.texto }}>{item}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const BARRA = { verde: C.agua500, amarillo: C.oro500, rojo: C.vino500, ninguno: C.vino100 } as const;

function Totales({ v, p }: { v: VersionPropuesta; p: Propuesta }) {
  const t = v.totales;
  const presupuesto = p.mostrarPresupuesto ? p.presupuesto : null;
  const gastado = p.incluyeNovaEnPresupuesto ? t.general : t.proveedores;
  const e = estadoPresupuesto(gastado, presupuesto);
  const fila = { flexDirection: "row" as const, justifyContent: "space-between" as const, marginTop: 6 };
  return (
    <View wrap={false} style={{ alignSelf: "center", width: 360, marginTop: 6, backgroundColor: C.vino50, borderWidth: 0.75, borderColor: C.vino100, borderRadius: 12, padding: 20 }}>
      <Rotulo>Resumen</Rotulo>
      <Text style={s.titulo}>Tu inversión</Text>
      <View style={{ marginTop: 10 }}>
        <View style={fila}>
          <Text style={s.suave}>Proveedores</Text>
          <Text style={{ fontWeight: 600 }}>{formatoBs(t.proveedores)}</Text>
        </View>
        {v.nova && (
          <View style={fila}>
            <Text style={s.suave}>Paquete Nova Event</Text>
            <Text style={{ fontWeight: 600 }}>{formatoBs(t.nova)}</Text>
          </View>
        )}
        <View style={[fila, { alignItems: "flex-end", marginTop: 10, paddingTop: 10, borderTopWidth: 0.75, borderTopColor: C.oro300 }]}>
          <Text style={{ fontFamily: "Cinzel", fontSize: 13, color: C.vino700 }}>Total</Text>
          <Text style={{ fontFamily: "Cinzel", fontSize: 22, color: C.vino600 }}>{formatoBs(t.general)}</Text>
        </View>
      </View>
      {e.tono !== "ninguno" && presupuesto !== null && (
        <View style={{ marginTop: 12 }}>
          <View style={{ height: 7, borderRadius: 4, backgroundColor: "#ffffff", borderWidth: 0.5, borderColor: C.vino100 }}>
            <View style={{ height: "100%", borderRadius: 4, backgroundColor: BARRA[e.tono], width: `${Math.min(100, Math.max(0, e.porcentaje))}%` }} />
          </View>
          <View style={[fila, { fontSize: 9 }]}>
            <Text style={{ fontWeight: 600, color: C.vino700 }}>{e.restante >= 0 ? `Te quedan ${formatoBs(e.restante)}` : `Supera tu presupuesto por ${formatoBs(-e.restante)}`}</Text>
            <Text style={s.suave}>
              {Math.round(e.porcentaje)} % de {formatoBs(presupuesto)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

/* ── 5. Pie ──────────────────────────────────────────────────── */

function Pie({ p, logo }: { p: Propuesta; logo: Imagen }) {
  return (
    <View wrap={false} style={{ marginTop: 26, paddingTop: 18, borderTopWidth: 0.75, borderTopColor: C.oro300, alignItems: "center" }}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf */}
      <Image src={logo} style={{ width: 80 }} />
      <Text style={{ marginTop: 8, fontFamily: "Cinzel", fontSize: 10.5, color: C.vino600 }}>
        {p.empresa.nombre}
        {p.empresa.lema ? ` · ${p.empresa.lema}` : ""}
      </Text>
      <Contacto e={p.empresa} />
      <Ornamento ancho={110} />
      {p.validez && <Text style={[s.suave, { marginTop: 8 }]}>Propuesta válida hasta el {fechaLarga(p.validez)}.</Text>}
      <Text style={{ marginTop: 4, fontSize: 7.5, letterSpacing: 2, color: C.suave }}>{p.codigo}</Text>
    </View>
  );
}

/** Contacto de la empresa con enlaces que funcionan al tocar el PDF en el celular. */
export function Contacto({ e }: { e: Propuesta["empresa"] }) {
  const enlace = { color: C.vino600, textDecoration: "none" } as const;
  const linea1 = [
    e.whatsapp && (
      <Link key="wa" src={e.whatsapp.enlace} style={enlace}>
        WhatsApp {e.whatsapp.texto}
      </Link>
    ),
    e.telefono && (
      <Link key="tel" src={e.telefono.enlace} style={enlace}>
        Tel. {e.telefono.texto}
      </Link>
    ),
    e.correo && (
      <Link key="correo" src={`mailto:${e.correo}`} style={enlace}>
        {e.correo}
      </Link>
    ),
  ].filter(Boolean);
  const linea2 = [
    e.web && (
      <Link key="web" src={e.web.enlace} style={enlace}>
        {e.web.texto}
      </Link>
    ),
    ...e.redes.map((r) => (
      <Link key={r.red} src={r.enlace} style={enlace}>
        {r.red} {r.usuario}
      </Link>
    )),
  ].filter(Boolean);
  const fila = (items: React.ReactNode[]) => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 4, fontSize: 8.5 }}>{items}</View>
  );
  if (!linea1.length && !linea2.length && !e.direccion) return null;
  return (
    <View style={{ marginTop: 6, alignItems: "center" }}>
      {linea1.length > 0 && fila(linea1)}
      {e.direccion && <Text style={[s.suave, { marginTop: 4, fontSize: 8.5 }]}>{e.direccion}</Text>}
      {linea2.length > 0 && fila(linea2)}
    </View>
  );
}

/* ── Documento ───────────────────────────────────────────────── */

/** WebP de la galería → JPEG (máx. 1200 px de ancho). null si falta o no se puede leer. */
async function aJpeg(datos: Buffer | null): Promise<Imagen | null> {
  if (!datos) return null;
  try {
    const salida = await sharp(datos).flatten({ background: "#ffffff" }).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
    return jpg(salida);
  } catch {
    return null;
  }
}

// Portada de cada proveedor: recortada al tamaño de la tarjeta (≈ 503 × 190 pt) y con la sombra inferior
// de la web (de transparente a carbón) ya pintada, para que el nombre en blanco siempre se lea.
const PORTADA = { ancho: 1200, alto: 453 };
const SOMBRA = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${PORTADA.ancho}" height="${PORTADA.alto}">
  <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0.3" stop-color="${C.carbon}" stop-opacity="0"/><stop offset="0.65" stop-color="${C.carbon}" stop-opacity="0.2"/><stop offset="1" stop-color="${C.carbon}" stop-opacity="0.85"/>
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#s)"/>
</svg>`);

async function portadaJpeg(datos: Buffer | null): Promise<Imagen | null> {
  if (!datos) return null;
  try {
    const salida = await sharp(datos)
      .resize({ width: PORTADA.ancho, height: PORTADA.alto, fit: "cover" })
      .composite([{ input: SOMBRA }])
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
    return jpg(salida);
  } catch {
    return null;
  }
}

/**
 * PDF de la propuesta. `p` debe armarse con las claves de archivo como direcciones
 * (`datosPropuesta(id, (clave) => clave)`): cada imagen se pide con `leerImagen(clave)`,
 * que decide qué archivos se pueden usar. `enlace` (si el enlace público está activo) va en un QR
 * donde la web tiene audio, video o 360°.
 */
export async function documentoPropuesta(p: Propuesta, leerImagen: (clave: string) => Promise<Buffer | null>, enlace: string | null): Promise<Buffer> {
  // Clave → conversión (una sola vez aunque el proveedor aparezca en varias versiones).
  const claves = new Map<string, typeof aJpeg>();
  for (const v of p.versiones)
    for (const sec of v.secciones)
      for (const l of sec.lineas) {
        if (l.portada) claves.set(l.portada, portadaJpeg);
        // Miniaturas (640 px): bastan para 4 fotos por fila y el archivo queda liviano.
        for (const f of l.fotos.slice(0, FOTOS_POR_LINEA + 2)) if (!claves.has(f.miniatura)) claves.set(f.miniatura, aJpeg);
      }
  const [imagenes, qr, logoBuf, fondoBuf] = await Promise.all([
    Promise.all([...claves].map(async ([k, convertir]) => [k, await convertir(await leerImagen(k).catch(() => null))] as const)),
    enlace ? QRCode.toDataURL(enlace, { margin: 1, width: 320, errorCorrectionLevel: "M", color: { dark: C.vino800, light: "#ffffff" } }) : Promise.resolve(null),
    logo(),
    marmol(),
  ]);
  const r: Recursos = {
    imagenes: new Map(imagenes.flatMap(([k, img]) => (img ? [[k, img] as const] : []))),
    qr,
    logo: { data: logoBuf, format: "png" },
  };
  const varias = p.versiones.length > 1;

  return renderToBuffer(
    <Document title={`Propuesta ${p.codigo}`} author="Nova Event" creator="Nova Event" producer="Nova Event" language="es">
      <Portada p={p} logo={r.logo} fondo={jpg(fondoBuf)} />
      {p.versiones.length === 0 ? (
        <Page size="A4" style={s.pagina}>
          <Fijos codigo={p.codigo} />
          <Text style={[s.suave, { textAlign: "center", marginTop: 120 }]}>Estamos preparando tu propuesta. Muy pronto podrás verla aquí.</Text>
          <Pie p={p} logo={r.logo} />
        </Page>
      ) : (
        p.versiones.map((v, i) => (
          // Cada versión empieza en una hoja nueva.
          <Page key={v.id} size="A4" style={s.pagina}>
            <Fijos codigo={p.codigo} />
            <Version v={v} p={p} varias={varias} r={r} />
            {i === p.versiones.length - 1 && <Pie p={p} logo={r.logo} />}
          </Page>
        ))
      )}
    </Document>,
  );
}

/** Respuesta de descarga: nombre con el código de la cotización y sin guardar en caché. */
export function respuestaPdf(codigo: string, pdf: Buffer, disposicion: "attachment" | "inline" = "attachment"): Response {
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposicion}; filename="${codigo}.pdf"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
