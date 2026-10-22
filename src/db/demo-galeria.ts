/**
 * Galería de EJEMPLO: dibuja imágenes de muestra (sin fotos reales ni textos) y genera audios cortos,
 * para ver cómo funciona la galería sin subir nada. Solo lo usa demo.ts.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { guardarAudio, guardarImagen, type TipoImagen } from "../lib/archivos";
import { db } from "./index";
import { supplierMedia } from "./schema";

/* ── Utilidades ───────────────────────────────────────────────── */

function generador(semilla: string) {
  let h = 2166136261;
  for (const c of semilla) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const svg = (w: number, h: number, cuerpo: string) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${cuerpo}</svg>`);

const degradado = (id: string, colores: string[], vertical = true) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}">${colores
    .map((c, i) => `<stop offset="${i / (colores.length - 1)}" stop-color="${c}"/>`)
    .join("")}</linearGradient>`;

/* ── Escenas (1600 × 1200) ────────────────────────────────────── */

const W = 1600;
const H = 1200;

function salonDeNoche(s: string) {
  const r = generador(s);
  let mesas = "";
  for (let fila = 0; fila < 4; fila++) {
    const y = 700 + fila * 130;
    const escala = 0.6 + fila * 0.25;
    for (let x = 120 + (fila % 2) * 90; x < W; x += 260 * escala) {
      mesas += `<ellipse cx="${x}" cy="${y}" rx="${95 * escala}" ry="${28 * escala}" fill="#f7efe8"/><rect x="${x - 95 * escala}" y="${y}" width="${190 * escala}" height="${55 * escala}" fill="#efe3d8"/>`;
      mesas += `<circle cx="${x}" cy="${y - 30 * escala}" r="${14 * escala}" fill="#e7b9c6"/><rect x="${x - 3}" y="${y - 30 * escala}" width="6" height="${30 * escala}" fill="#b8935a"/>`;
    }
  }
  let lamparas = "";
  for (let i = 0; i < 5; i++) {
    const x = 160 + i * 320 + r() * 40;
    lamparas += `<line x1="${x}" y1="0" x2="${x}" y2="${120 + r() * 60}" stroke="#d9bf8f" stroke-width="3"/><circle cx="${x}" cy="${170 + r() * 40}" r="90" fill="url(#luz)"/><circle cx="${x}" cy="${170}" r="26" fill="#fff6dd"/>`;
  }
  return svg(
    W,
    H,
    `<defs>${degradado("f", ["#2a1520", "#5f1f35", "#3a2a30"])}<radialGradient id="luz"><stop offset="0" stop-color="#ffe9b0" stop-opacity=".9"/><stop offset="1" stop-color="#ffe9b0" stop-opacity="0"/></radialGradient></defs>
     <rect width="${W}" height="${H}" fill="url(#f)"/><rect y="620" width="${W}" height="${H - 620}" fill="#2b1d22" opacity=".55"/>${lamparas}${mesas}`,
  );
}

function jardin(s: string) {
  const r = generador(s);
  let sillas = "";
  for (let fila = 0; fila < 6; fila++) {
    const y = 760 + fila * 70;
    for (const lado of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const x = W / 2 + lado * (90 + i * (60 + fila * 8));
        sillas += `<rect x="${x - 14}" y="${y - 30}" width="28" height="40" rx="4" fill="#ffffff" opacity=".95"/>`;
      }
    }
  }
  let flores = "";
  for (let a = 0; a <= 180; a += 6) {
    const rad = (a * Math.PI) / 180;
    const x = W / 2 + Math.cos(rad) * 230;
    const y = 700 - Math.sin(rad) * 300;
    flores += `<circle cx="${x}" cy="${y}" r="${20 + r() * 14}" fill="${["#f4dde4", "#e7b9c6", "#ffffff", "#ecc9bb"][Math.floor(r() * 4)]}"/>`;
  }
  return svg(
    W,
    H,
    `<defs>${degradado("cielo", ["#9fc6c4", "#e2efee", "#fbf1f4"])}${degradado("pasto", ["#7fa36b", "#5b7f4c"])}</defs>
     <rect width="${W}" height="${H}" fill="url(#cielo)"/>
     <path d="M0 640 Q 300 520 620 610 T 1200 580 T 1600 600 V 700 H 0 Z" fill="#8fb38a" opacity=".8"/>
     <rect y="660" width="${W}" height="${H - 660}" fill="url(#pasto)"/>
     <rect x="${W / 2 - 40}" y="660" width="80" height="${H - 660}" fill="#f4ede4" opacity=".9"/>
     <path d="M${W / 2 - 230} 700 A 230 300 0 0 1 ${W / 2 + 230} 700" fill="none" stroke="#5b7f4c" stroke-width="16"/>${flores}${sillas}`,
  );
}

function plano() {
  let mesas = "";
  const pos: [number, number][] = [];
  for (let f = 0; f < 3; f++) for (let c = 0; c < 4; c++) pos.push([300 + c * 220, 330 + f * 220]);
  for (const [x, y] of pos) {
    mesas += `<circle cx="${x}" cy="${y}" r="55" fill="#fbf1f4" stroke="#5f1f35" stroke-width="4"/>`;
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      mesas += `<circle cx="${x + Math.cos(a) * 78}" cy="${y + Math.sin(a) * 78}" r="11" fill="#fff" stroke="#9c3a58" stroke-width="3"/>`;
    }
  }
  let pista = "";
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) pista += `<rect x="${1150 + i * 50}" y="${450 + j * 50}" width="50" height="50" fill="${(i + j) % 2 ? "#d9bf8f" : "#f6ecd9"}"/>`;
  return svg(
    W,
    H,
    `<rect width="${W}" height="${H}" fill="#ffffff"/>
     <defs><pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#e8eef0" stroke-width="2"/></pattern></defs>
     <rect width="${W}" height="${H}" fill="url(#g)"/>
     <rect x="120" y="120" width="1360" height="960" fill="none" stroke="#272c30" stroke-width="14"/>
     <rect x="560" y="140" width="480" height="90" fill="#e7b9c6" stroke="#5f1f35" stroke-width="4"/>
     ${mesas}${pista}
     <rect x="1180" y="160" width="260" height="110" fill="#9fc6c4" stroke="#3e7473" stroke-width="4"/>
     <rect x="1360" y="820" width="100" height="240" fill="#d9bf8f" stroke="#8c6c3c" stroke-width="4"/>
     <path d="M700 1080 v-120 a120 120 0 0 1 120 120" fill="none" stroke="#272c30" stroke-width="6"/>
     <rect x="700" y="1072" width="120" height="16" fill="#ffffff"/>`,
  );
}

/** Panorámica 360° (4096 × 2048, se une sin cortes en los bordes). */
function panoramica(s: string) {
  const r = generador(s);
  const PW = 4096;
  const PH = 2048;
  const n = 16;
  const paso = PW / n;
  let arcos = "";
  let luces = "";
  let mesas = "";
  for (let i = 0; i < n; i++) {
    const x = i * paso;
    arcos += `<rect x="${x - 22}" y="560" width="44" height="560" fill="#f3ebe0"/><path d="M${x + 22} 700 Q ${x + paso / 2} 470 ${x + paso - 22} 700" fill="none" stroke="#f3ebe0" stroke-width="26"/>`;
    for (let k = 1; k < 8; k++) {
      const t = k / 8;
      const lx = x + t * paso;
      const ly = 520 + Math.sin(t * Math.PI) * 90;
      luces += `<circle cx="${lx}" cy="${ly}" r="9" fill="#fff3c4"/><circle cx="${lx}" cy="${ly}" r="26" fill="#fff3c4" opacity=".25"/>`;
    }
    const mx = x + paso / 2;
    mesas += `<ellipse cx="${mx}" cy="${1330 + (i % 2) * 120}" rx="110" ry="34" fill="#fbf6f0"/><rect x="${mx - 110}" y="${1330 + (i % 2) * 120}" width="220" height="60" fill="#efe3d8"/><circle cx="${mx}" cy="${1300 + (i % 2) * 120}" r="${16 + r() * 6}" fill="#e7b9c6"/>`;
  }
  return svg(
    PW,
    PH,
    `<defs>${degradado("c", ["#1d2a3a", "#4b3a55", "#d98f7a", "#f4c9a8"])}${degradado("p", ["#6b7f5a", "#3f5236"])}</defs>
     <rect width="${PW}" height="1124" fill="url(#c)"/><rect y="1120" width="${PW}" height="${PH - 1120}" fill="url(#p)"/>
     <rect y="1100" width="${PW}" height="40" fill="#e9dccb"/>${arcos}${luces}${mesas}`,
  );
}

function flores(s: string, paleta: string[]) {
  const r = generador(s);
  let capas = "";
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2;
    const x = 380 + Math.cos(a) * 160 * r() + r() * 840;
    const y = 680 + Math.sin(a) * 100 * r();
    capas += `<ellipse cx="${x - 40}" cy="${y + 50}" rx="70" ry="22" fill="#5b7f4c" transform="rotate(${r() * 60 - 30} ${x} ${y})"/>`;
  }
  for (let i = 0; i < 60; i++) {
    const x = 300 + r() * 1000;
    const y = 480 + r() * 340;
    const tam = 30 + r() * 55;
    const c = paleta[Math.floor(r() * paleta.length)];
    capas += `<circle cx="${x}" cy="${y}" r="${tam}" fill="${c}"/><circle cx="${x}" cy="${y}" r="${tam * 0.45}" fill="#ffffff" opacity=".35"/>`;
  }
  return svg(
    W,
    H,
    `<defs>${degradado("f", ["#fbf1f4", "#f4ede4"])}</defs><rect width="${W}" height="${H}" fill="url(#f)"/>
     <rect x="0" y="900" width="${W}" height="300" fill="#e9dccb"/><rect x="560" y="820" width="480" height="140" rx="20" fill="#b8935a"/>${capas}`,
  );
}

function torta(s: string) {
  const r = generador(s);
  const pisos = 3 + Math.floor(r() * 2);
  let cuerpo = "";
  for (let i = 0; i < pisos; i++) {
    const w = 560 - i * 120;
    const y = 900 - (i + 1) * 150;
    cuerpo += `<rect x="${W / 2 - w / 2}" y="${y}" width="${w}" height="150" rx="16" fill="#fffaf5" stroke="#ecc9bb" stroke-width="4"/><path d="M${W / 2 - w / 2} ${y + 20} q ${w / 8} 30 ${w / 4} 0 t ${w / 4} 0 t ${w / 4} 0 t ${w / 4} 0" fill="none" stroke="#e7b9c6" stroke-width="8"/>`;
  }
  for (let i = 0; i < 9; i++) cuerpo += `<circle cx="${W / 2 - 80 + r() * 160}" cy="${900 - pisos * 150 - 10 + r() * 30}" r="${18 + r() * 10}" fill="${["#9c3a58", "#e7b9c6", "#ffffff"][i % 3]}"/>`;
  return svg(
    W,
    H,
    `<defs>${degradado("f", ["#f4dde4", "#fbf1f4"])}</defs><rect width="${W}" height="${H}" fill="url(#f)"/>
     <ellipse cx="${W / 2}" cy="930" rx="420" ry="50" fill="#d9bf8f"/><rect x="${W / 2 - 30}" y="930" width="60" height="200" fill="#b8935a"/>${cuerpo}`,
  );
}

function platos(s: string) {
  const r = generador(s);
  let p = "";
  for (let i = 0; i < 6; i++) {
    const x = 330 + (i % 3) * 470;
    const y = 380 + Math.floor(i / 3) * 440;
    p += `<circle cx="${x}" cy="${y}" r="170" fill="#ffffff" stroke="#e5dcd4" stroke-width="10"/>`;
    for (let k = 0; k < 5; k++) p += `<circle cx="${x - 60 + r() * 120}" cy="${y - 60 + r() * 120}" r="${24 + r() * 30}" fill="${["#c0784a", "#7fa36b", "#e8c26e", "#9c3a58", "#f2e6d0"][k]}"/>`;
  }
  return svg(W, H, `<rect width="${W}" height="${H}" fill="#6b4a3a"/><rect width="${W}" height="${H}" fill="#3a2a22" opacity=".25"/>${p}`);
}

function luces(s: string, base: string[]) {
  const r = generador(s);
  let b = "";
  for (let i = 0; i < 70; i++) b += `<circle cx="${r() * W}" cy="${r() * H}" r="${20 + r() * 110}" fill="${base[Math.floor(r() * base.length)]}" opacity="${0.15 + r() * 0.45}"/>`;
  return svg(W, H, `<defs>${degradado("f", ["#272c30", "#5f1f35"])}</defs><rect width="${W}" height="${H}" fill="url(#f)"/>${b}`);
}

/* ── Audio de muestra (WAV) ───────────────────────────────────── */

/** Melodía simple con ritmo, ~10 s. Sirve para probar el reproductor. */
function melodia(notas: number[], bpm: number) {
  const tasa = 22050;
  const negra = 60 / bpm;
  const total = Math.floor(notas.length * negra * tasa);
  const datos = Buffer.alloc(44 + total * 2);
  datos.write("RIFF", 0);
  datos.writeUInt32LE(36 + total * 2, 4);
  datos.write("WAVEfmt ", 8);
  datos.writeUInt32LE(16, 16);
  datos.writeUInt16LE(1, 20);
  datos.writeUInt16LE(1, 22);
  datos.writeUInt32LE(tasa, 24);
  datos.writeUInt32LE(tasa * 2, 28);
  datos.writeUInt16LE(2, 32);
  datos.writeUInt16LE(16, 34);
  datos.write("data", 36);
  datos.writeUInt32LE(total * 2, 40);
  for (let i = 0; i < total; i++) {
    const t = i / tasa;
    const n = Math.floor(t / negra);
    const enNota = t - n * negra;
    const f = 440 * 2 ** ((notas[n] - 69) / 12);
    const envolvente = Math.exp(-enNota * 4);
    const bajo = Math.sin(2 * Math.PI * (f / 4) * t) * 0.25 * Math.exp(-enNota * 8);
    const golpe = enNota < 0.03 ? (Math.random() * 2 - 1) * 0.3 : 0;
    const v = (Math.sin(2 * Math.PI * f * t) * 0.5 + Math.sin(4 * Math.PI * f * t) * 0.15) * envolvente + bajo + golpe;
    datos.writeInt16LE(Math.max(-1, Math.min(1, v * 0.6)) * 32767, 44 + i * 2);
  }
  return datos;
}

const CUMBIA = [67, 69, 71, 72, 71, 69, 67, 64, 65, 67, 69, 67, 65, 64, 62, 60, 67, 69, 71, 72, 74, 72, 71, 69];
const VALS = [72, 76, 79, 77, 76, 74, 72, 71, 72, 74, 76, 72, 69, 67, 69, 71, 72, 76, 79, 81, 79, 77, 76, 72];

/* ── Qué tiene cada proveedor de ejemplo ──────────────────────── */

type Pieza =
  | { tipo: TipoImagen; titulo: string; album?: string; imagen: () => Buffer }
  | { tipo: "audio"; titulo: string; album?: string; audio: () => Buffer }
  | { tipo: "video"; titulo: string; album?: string; url: string };

const ROSAS = ["#f4dde4", "#e7b9c6", "#ffffff", "#ecc9bb", "#9c3a58"];
const SILVESTRES = ["#f6ecd9", "#e8c26e", "#d9bf8f", "#ffffff", "#c0784a"];

const salon = (n: string): Pieza[] => [
  { tipo: "photo", titulo: "Salón de noche", album: "Salón principal", imagen: () => salonDeNoche(n + 1) },
  { tipo: "photo", titulo: "Montaje para 200 personas", album: "Salón principal", imagen: () => salonDeNoche(n + 2) },
  { tipo: "photo", titulo: "Ceremonia en el jardín", album: "Jardín", imagen: () => jardin(n + 3) },
  { tipo: "plan", titulo: "Plano general con mesas", imagen: plano },
  { tipo: "pano", titulo: "Recorrido 360° del jardín", album: "Jardín", imagen: () => panoramica(n) },
];

const GALERIAS: Record<string, Pieza[]> = {
  "Hacienda Los Sauces": salon("hacienda"),
  "Salón Cristal": salon("cristal").slice(0, 2).concat({ tipo: "plan", titulo: "Plano del salón", imagen: plano }),
  "Jardín del Valle": [salon("valle")[2], { ...salon("valle")[4], titulo: "Vista 360° del jardín" } as Pieza],
  "Sabores de la Abuela Catering": [
    { tipo: "photo", titulo: "Menú criollo", album: "Platos de fondo", imagen: () => platos("abuela1") },
    { tipo: "photo", titulo: "Entradas", album: "Entradas", imagen: () => platos("abuela2") },
  ],
  "Gourmet Andino": [{ tipo: "photo", titulo: "Estación de quinua y trucha", imagen: () => platos("andino") }],
  "DJ Marco Beats": [
    { tipo: "audio", titulo: "Mix bailable (muestra)", album: "Hora loca", audio: () => melodia(CUMBIA, 128) },
    { tipo: "audio", titulo: "Entrada de los novios (muestra)", album: "Ceremonia", audio: () => melodia(VALS, 90) },
    { tipo: "video", titulo: "Repertorio: Vivir mi vida", album: "Hora loca", url: "https://www.youtube.com/watch?v=YXnjy5YlDwk" },
    { tipo: "video", titulo: "Repertorio: Perfect (primer baile)", album: "Ceremonia", url: "https://www.youtube.com/watch?v=2Vv-BfVoq4g" },
    { tipo: "photo", titulo: "Cabina e iluminación", imagen: () => luces("dj", ["#9fc6c4", "#e7b9c6", "#d9bf8f"]) },
  ],
  "Grupo Sensación": [
    { tipo: "audio", titulo: "Cumbia en vivo (muestra)", audio: () => melodia(CUMBIA, 110) },
    { tipo: "video", titulo: "Repertorio: Despacito", url: "https://www.youtube.com/watch?v=kJQP7kiw5Fk" },
  ],
  "Luz y Momento Fotografía": [
    { tipo: "photo", titulo: "Sesión preboda", album: "Preboda", imagen: () => jardin("foto1") },
    { tipo: "photo", titulo: "Fiesta", album: "Boda", imagen: () => luces("foto2", ["#ffe9b0", "#ecc9bb", "#ffffff"]) },
    { tipo: "video", titulo: "Video de boda (referencia): All of Me", url: "https://www.youtube.com/watch?v=450p7goxZqg" },
  ],
  "Flores del Sol": [
    { tipo: "photo", titulo: "Centro de mesa de rosas", album: "Elegante", imagen: () => flores("sol1", ROSAS) },
    { tipo: "photo", titulo: "Arreglo de flores silvestres", album: "Rústico", imagen: () => flores("sol2", SILVESTRES) },
    { tipo: "photo", titulo: "Ramo de novia", album: "Elegante", imagen: () => flores("sol3", ROSAS) },
  ],
  "Detalles Mágicos Deco": [
    { tipo: "photo", titulo: "Montaje rústico", album: "Rústico", imagen: () => jardin("deco1") },
    { tipo: "photo", titulo: "Montaje elegante", album: "Elegante", imagen: () => salonDeNoche("deco2") },
    { tipo: "photo", titulo: "Flores de mesa", album: "Rústico", imagen: () => flores("deco3", SILVESTRES) },
  ],
  "Dulce Encanto Pastelería": [
    { tipo: "photo", titulo: "Torta de 3 pisos", album: "Tortas de boda", imagen: () => torta("dulce1") },
    { tipo: "photo", titulo: "Torta de 4 pisos con flores", album: "Tortas de boda", imagen: () => torta("dulce2") },
  ],
  "Bar Móvil La Barra": [{ tipo: "photo", titulo: "Barra iluminada", imagen: () => luces("bar", ["#e8c26e", "#9fc6c4"]) }],
  "Studio Bella Novia": [{ tipo: "photo", titulo: "Maquillaje de novia", imagen: () => luces("bella", ["#f4dde4", "#ecc9bb", "#ffffff"]) }],
};

/** Carga la galería de ejemplo de los proveedores que todavía no tienen ninguna. */
export async function cargarGalerias(proveedores: { id: string; name: string }[]) {
  let total = 0;
  for (const p of proveedores) {
    const piezas = GALERIAS[p.name];
    if (!piezas) continue;
    const [ya] = await db.select({ id: supplierMedia.id }).from(supplierMedia).where(eq(supplierMedia.supplierId, p.id)).limit(1);
    if (ya) continue;

    let portada = true;
    for (const pieza of piezas) {
      const id = randomUUID();
      const base = { id, supplierId: p.id, kind: pieza.tipo, title: pieza.titulo, album: pieza.album ?? null };
      if (pieza.tipo === "video") {
        await db.insert(supplierMedia).values({ ...base, url: pieza.url });
      } else if (pieza.tipo === "audio") {
        await db.insert(supplierMedia).values({ ...base, ...(await guardarAudio(p.id, id, pieza.audio())) });
      } else {
        const archivo = await guardarImagen(p.id, id, pieza.tipo, pieza.imagen());
        await db.insert(supplierMedia).values({ ...base, ...archivo, isCover: portada && pieza.tipo === "photo" });
        if (pieza.tipo === "photo") portada = false;
      }
      total++;
    }
  }
  return total;
}
