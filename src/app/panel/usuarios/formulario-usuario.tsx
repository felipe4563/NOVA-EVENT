"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Aviso, Campo, clases } from "@/components/ui";
import type { EstadoForm } from "./actions";
import { CampoContrasena } from "./campo-contrasena";

type Rol = { id: string; name: string; tipo: string; esProveedor: boolean };
type Proveedor = { id: string; name: string; categoria: string };

export function FormularioUsuario({
  accion,
  roles,
  proveedores,
  inicial,
  esNuevo,
  rolBloqueado,
}: {
  accion: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  roles: Rol[];
  proveedores: Proveedor[];
  inicial?: { nombre?: string; email?: string; rol?: string; proveedor?: string };
  esNuevo: boolean;
  /** Motivo por el que no se puede cambiar el rol (por ejemplo, es uno mismo). */
  rolBloqueado?: string;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, undefined);
  const [password, setPassword] = useState("");
  const e = estado?.errores ?? {};
  // Tras enviar, React limpia el formulario: se vuelve a poner lo escrito (o lo guardado).
  const v = { ...inicial, ...estado?.valores };
  const llave = JSON.stringify(estado ?? null);
  // El rol elegido decide si se pide el proveedor (vive fuera del formulario para no perderse al enviar).
  const [rolElegido, setRolElegido] = useState(v.rol ?? "");
  const esProveedor = roles.find((r) => r.id === rolElegido)?.esProveedor ?? false;

  // Agrupa los roles por tipo de cuenta en el desplegable.
  const tipos = [...new Set(roles.map((r) => r.tipo))];

  return (
    <form action={enviar} noValidate className="space-y-5" key={llave}>
      {estado?.ok && <Aviso>{estado.ok}</Aviso>}
      {estado?.error && <Aviso tipo="error">{estado.error}</Aviso>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="nombre" etiqueta="Nombre completo" error={e.nombre}>
          <input
            id="nombre"
            name="nombre"
            defaultValue={v.nombre}
            autoComplete="off"
            required
            aria-invalid={Boolean(e.nombre) || undefined}
            className={clases.campo}
          />
        </Campo>
        <Campo id="email" etiqueta="Correo electrónico" error={e.email} ayuda="Con este correo inicia sesión.">
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            defaultValue={v.email}
            autoComplete="off"
            required
            aria-invalid={Boolean(e.email) || undefined}
            className={clases.campo}
          />
        </Campo>
      </div>

      <Campo id="rol" etiqueta="Rol" error={e.rol} ayuda={rolBloqueado ?? "Define a qué módulos puede entrar."}>
        <select
          id="rol"
          name="rol"
          defaultValue={v.rol ?? ""}
          onChange={(ev) => setRolElegido(ev.target.value)}
          required
          disabled={Boolean(rolBloqueado)}
          aria-invalid={Boolean(e.rol) || undefined}
          className={clases.campo}
        >
          <option value="" disabled>
            Elige un rol…
          </option>
          {tipos.map((t) => (
            <optgroup key={t} label={t}>
              {roles
                .filter((r) => r.tipo === t)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        {/* Un select deshabilitado no se envía: se manda el valor actual aparte. */}
        {rolBloqueado && <input type="hidden" name="rol" value={inicial?.rol} />}
      </Campo>

      {esProveedor && (
        <Campo id="proveedor" etiqueta="Proveedor" error={e.proveedor} ayuda="La cuenta solo verá y manejará la agenda de este proveedor.">
          <select
            id="proveedor"
            name="proveedor"
            defaultValue={v.proveedor ?? ""}
            required
            aria-invalid={Boolean(e.proveedor) || undefined}
            className={clases.campo}
          >
            <option value="" disabled>
              {proveedores.length ? "Elige el proveedor…" : "Primero crea el proveedor en Proveedores"}
            </option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.categoria}
              </option>
            ))}
          </select>
        </Campo>
      )}

      {esNuevo && (
        <>
          <Campo id="password" etiqueta="Contraseña" error={e.password} ayuda="Mínimo 8 caracteres, con letras y números. Cópiala para entregársela.">
            <CampoContrasena error={e.password} valor={password} setValor={setPassword} />
          </Campo>
          <label className="flex items-start gap-3 rounded-xl border border-borde bg-superficie-2/50 p-4">
            <input type="checkbox" name="activo" defaultChecked={estado?.valores?.activo ?? true} className="mt-0.5 size-4 accent-primario" />
            <span>
              <span className="block text-sm font-medium text-texto">Cuenta activa</span>
              <span className="block text-xs text-texto-suave">Si la desmarcas, el usuario se crea pero no puede entrar hasta que lo actives.</span>
            </span>
          </label>
        </>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-borde pt-5 sm:flex-row sm:justify-end">
        {esNuevo && (
          <Link href="/panel/usuarios" className={clases.botonSecundario}>
            Cancelar
          </Link>
        )}
        <button type="submit" disabled={pendiente} className={clases.botonPrimario}>
          {pendiente ? "Guardando…" : esNuevo ? "Crear usuario" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

export function FormularioContrasena({ accion }: { accion: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm> }) {
  const [estado, enviar, pendiente] = useActionState(accion, undefined);
  const [password, setPassword] = useState("");
  // Si se guardó bien, se limpia el campo; si hubo error, se conserva lo escrito.
  const [ultimoOk, setUltimoOk] = useState<EstadoForm>(undefined);
  if (estado?.ok && estado !== ultimoOk) {
    setUltimoOk(estado);
    setPassword("");
  }
  return (
    <form action={enviar} noValidate className="space-y-4">
      {estado?.ok && <Aviso>{estado.ok}</Aviso>}
      {estado?.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <Campo id="nueva-password" etiqueta="Nueva contraseña" error={estado?.errores?.password} ayuda="Mínimo 8 caracteres, con letras y números.">
        <CampoContrasena id="nueva-password" error={estado?.errores?.password} valor={password} setValor={setPassword} />
      </Campo>
      <div className="flex justify-end">
        <button type="submit" disabled={pendiente} className={clases.botonPrimario}>
          {pendiente ? "Guardando…" : "Cambiar contraseña"}
        </button>
      </div>
    </form>
  );
}
