// Recibo de un cobro (carta, una hoja): lo recibe la pareja. Solo usa lo que trae `DatosRecibo`.
import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatoBs } from "@/lib/cotizacion/dinero";
import type { ContactoEmpresa } from "@/lib/empresa";
import { montoEnLetras } from "@/lib/saldos/letras";
import { C, Contacto, Ornamento, logo } from "../cotizaciones/_propuesta/pdf";

export type DatosRecibo = {
  codigo: string;
  /** Fecha del cobro, ya en texto largo. */
  fecha: string;
  cliente: string;
  monto: number;
  codigoCotizacion: string;
  fechaEvento: string;
  forma: string;
  referencia: string | null;
  total: number;
  pagado: number;
  saldo: number;
  recibidoPor: string | null;
  anulado: boolean;
  empresa: ContactoEmpresa;
};

const s = StyleSheet.create({
  pagina: { paddingTop: 50, paddingBottom: 50, paddingHorizontal: 54, fontFamily: "Montserrat", fontSize: 10, color: C.carbon, backgroundColor: "#ffffff" },
  marco: { position: "absolute", top: 18, left: 18, right: 18, bottom: 18, borderWidth: 0.75, borderColor: C.oro300, borderRadius: 10 },
  rotulo: { fontSize: 7.5, fontWeight: 600, letterSpacing: 2.2, color: C.oro700, textTransform: "uppercase" },
  suave: { color: C.suave },
  fila: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 7 },
});

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={s.rotulo}>{k}</Text>
      <Text style={{ marginTop: 3, fontSize: 11.5, fontWeight: 600, lineHeight: 1.4 }}>{v}</Text>
    </View>
  );
}

/** Recibo en PDF; si está anulado lleva «ANULADO» en diagonal. */
export async function documentoRecibo(r: DatosRecibo): Promise<Buffer> {
  const logoBuf = await logo();
  return renderToBuffer(
    <Document title={`Recibo ${r.codigo}`} author="Nova Event" creator="Nova Event" producer="Nova Event" language="es">
      <Page size="LETTER" style={s.pagina}>
        <View style={s.marco} />

        <View style={{ alignItems: "center" }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf */}
          <Image src={{ data: logoBuf, format: "png" }} style={{ width: 120 }} />
          <Text style={{ marginTop: 8, fontFamily: "Cinzel", fontSize: 12, color: C.vino600 }}>{r.empresa.nombre}</Text>
          {r.empresa.lema && <Text style={[s.suave, { marginTop: 2, fontSize: 8.5 }]}>{r.empresa.lema}</Text>}
          <Ornamento ancho={120} margen={12} />
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 18 }}>
          <View>
            <Text style={s.rotulo}>Recibo</Text>
            <Text style={{ fontFamily: "Cinzel", fontSize: 22, color: C.vino600, marginTop: 2 }}>{r.codigo}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.rotulo}>Fecha</Text>
            <Text style={{ marginTop: 3, fontWeight: 600 }}>{r.fecha}</Text>
          </View>
        </View>

        <Dato k="Recibimos de" v={r.cliente} />

        <View style={{ marginTop: 16, backgroundColor: C.vino50, borderWidth: 0.75, borderColor: C.vino100, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 18, alignItems: "center" }}>
          <Text style={s.rotulo}>La suma de</Text>
          <Text style={{ fontFamily: "Cinzel", fontSize: 32, color: C.vino600, marginTop: 4 }}>{formatoBs(r.monto)}</Text>
          <Text style={{ marginTop: 6, fontSize: 10, textAlign: "center", lineHeight: 1.4 }}>Son: {montoEnLetras(r.monto)}</Text>
        </View>

        <Dato k="Por concepto de" v={`Pago a cuenta de ${r.codigoCotizacion} · ${r.cliente} · ${r.fechaEvento}`} />
        <Dato k="Forma de pago" v={r.referencia ? `${r.forma} · Ref. ${r.referencia}` : r.forma} />

        <View style={{ marginTop: 20, borderWidth: 0.75, borderColor: C.oro300, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 }}>
          <View style={[s.fila, { marginTop: 0 }]}>
            <Text style={s.suave}>Total del evento</Text>
            <Text style={{ fontWeight: 600 }}>{formatoBs(r.total)}</Text>
          </View>
          <View style={s.fila}>
            <Text style={s.suave}>Pagado a la fecha (incluye este recibo)</Text>
            <Text style={{ fontWeight: 600 }}>{formatoBs(r.pagado)}</Text>
          </View>
          <View style={[s.fila, { marginTop: 9, paddingTop: 9, borderTopWidth: 0.75, borderTopColor: C.oro300 }]}>
            <Text style={{ fontFamily: "Cinzel", fontSize: 12, color: C.vino700 }}>Saldo</Text>
            <Text style={{ fontFamily: "Cinzel", fontSize: 15, color: C.vino600 }}>{formatoBs(r.saldo)}</Text>
          </View>
        </View>

        {r.recibidoPor && (
          <View style={{ marginTop: 30, alignItems: "center" }}>
            <View style={{ width: 220, borderTopWidth: 0.75, borderTopColor: C.suave, paddingTop: 5, alignItems: "center" }}>
              <Text style={{ fontWeight: 600 }}>Recibido por: {r.recibidoPor}</Text>
            </View>
          </View>
        )}

        <View style={{ position: "absolute", bottom: 40, left: 54, right: 54, alignItems: "center" }}>
          <Contacto e={r.empresa} />
        </View>

        {r.anulado && (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: "Cinzel", fontWeight: 700, fontSize: 110, color: C.vino600, opacity: 0.2, transform: "rotate(-35deg)" }}>ANULADO</Text>
          </View>
        )}
      </Page>
    </Document>,
  );
}
