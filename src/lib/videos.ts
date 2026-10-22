/**
 * Videos de la galería: se guardan como enlace (YouTube, Vimeo, TikTok, Instagram)
 * y se muestran con el reproductor oficial de cada sitio.
 */
export type VideoInfo = {
  sitio: "YouTube" | "Vimeo" | "TikTok" | "Instagram";
  embed: string;
  miniatura: string | null;
  /** Formato vertical (TikTok, reels). */
  vertical: boolean;
};

export function infoVideo(enlace: string): VideoInfo | null {
  let u: URL;
  try {
    u = new URL(enlace.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^(www\.|m\.)/, "");
  const partes = u.pathname.split("/").filter(Boolean);
  const id = (re: RegExp, v?: string) => (v && re.test(v) ? v : null);

  if (host === "youtu.be" || host === "youtube.com" || host === "music.youtube.com") {
    const v =
      host === "youtu.be"
        ? partes[0]
        : partes[0] === "shorts" || partes[0] === "embed" || partes[0] === "live"
          ? partes[1]
          : (u.searchParams.get("v") ?? undefined);
    const yt = id(/^[\w-]{11}$/, v);
    if (!yt) return null;
    return {
      sitio: "YouTube",
      embed: `https://www.youtube-nocookie.com/embed/${yt}?rel=0`,
      miniatura: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
      vertical: partes[0] === "shorts",
    };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const vm = id(/^\d+$/, partes.find((p) => /^\d+$/.test(p)));
    return vm ? { sitio: "Vimeo", embed: `https://player.vimeo.com/video/${vm}`, miniatura: null, vertical: false } : null;
  }
  if (host === "tiktok.com") {
    const i = partes.indexOf("video");
    const tk = id(/^\d+$/, i >= 0 ? partes[i + 1] : undefined);
    return tk ? { sitio: "TikTok", embed: `https://www.tiktok.com/embed/v2/${tk}`, miniatura: null, vertical: true } : null;
  }
  if (host === "instagram.com") {
    const i = partes.findIndex((p) => p === "p" || p === "reel" || p === "reels" || p === "tv");
    const ig = id(/^[\w-]+$/, i >= 0 ? partes[i + 1] : undefined);
    return ig ? { sitio: "Instagram", embed: `https://www.instagram.com/p/${ig}/embed`, miniatura: null, vertical: partes[i] !== "p" } : null;
  }
  return null;
}
