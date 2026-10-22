/**
 * Saltos de línea de un formulario: el navegador envía «\r\n» por cada salto de un textarea.
 * Se pasan a «\n» antes de medir el largo, así el límite cuenta lo mismo que ve la persona.
 */
export function unirSaltos(texto: string): string {
  return texto.replace(/\r\n?/g, "\n");
}
