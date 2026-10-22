/** Preferencia de tema guardada en el dispositivo (localStorage). Sin valor = seguir al sistema. */
export const TEMA_KEY = "nova-tema";

export type Tema = "claro" | "oscuro" | "sistema";

/**
 * Corre en <head> antes de que se pinte la página, para que no haya parpadeo
 * al cargar en modo oscuro. Debe ser autocontenido (no puede importar nada).
 */
export const TEMA_SCRIPT = `(function(){try{var t=localStorage.getItem("${TEMA_KEY}");var d=t==="oscuro"||(t!=="claro"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`;

/** Cookie con el estado del menú lateral en computadora ("plegado" | "abierto"). */
export const MENU_COOKIE = "nova-menu";
