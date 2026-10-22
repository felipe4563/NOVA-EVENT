"use client";

import { useEffect, useRef, useState } from "react";
import "pannellum/build/pannellum.css";

type Visor = { destroy: () => void };
declare global {
  interface Window {
    pannellum?: { viewer: (el: HTMLElement, config: Record<string, unknown>) => Visor };
  }
}

/**
 * Ángulos que cubre la foto según su forma:
 * 2:1 es una esfera completa (cámara 360); más ancha, una panorámica de celular que da la vuelta;
 * más angosta, una panorámica parcial.
 */
function angulos(ancho: number, alto: number) {
  const r = ancho / alto;
  if (r >= 1.9 && r <= 2.1) return { haov: 360, vaov: 180 };
  if (r > 2.1) return { haov: 360, vaov: Math.round(360 / r) };
  return { haov: Math.round(Math.min(360, r * 90)), vaov: 90 };
}

/** Visor de fotos 360°: se recorre arrastrando con el dedo o el mouse. Usa Pannellum (libre). */
export function Visor360({ src, ancho, alto, titulo }: { src: string; ancho: number; alto: number; titulo: string }) {
  const caja = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let visor: Visor | undefined;
    let cancelado = false;
    import("pannellum/build/pannellum.js")
      .then(() => {
        if (cancelado || !caja.current || !window.pannellum) return;
        const { haov, vaov } = angulos(ancho, alto);
        visor = window.pannellum.viewer(caja.current, {
          type: "equirectangular",
          panorama: src,
          autoLoad: true,
          haov,
          vaov,
          // Panorámicas parciales: no dejar mirar fuera de la foto.
          ...(vaov < 180 ? { minPitch: -vaov / 2, maxPitch: vaov / 2 } : {}),
          ...(haov < 360 ? { minYaw: -haov / 2, maxYaw: haov / 2 } : {}),
          autoRotate: -2,
          autoRotateInactivityDelay: 4000,
          showFullscreenCtrl: true,
          strings: { loadingLabel: "Cargando…", bylineLabel: "", loadButtonLabel: "Ver en 360°" },
        });
      })
      .catch(() => setError(true));
    return () => {
      cancelado = true;
      visor?.destroy();
    };
  }, [src, ancho, alto]);

  if (error) return <p className="p-6 text-center text-sm text-white">No se pudo cargar el visor 360°.</p>;
  return <div ref={caja} className="size-full" role="img" aria-label={`Foto 360° de ${titulo}. Arrastra para mirar alrededor.`} />;
}
