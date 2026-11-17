/** Ilustraciones propias orientativas: no representan un año ni certifican ajuste. */
export function VehiculoImagen({ nombre }: { nombre: string }) {
  const camion = /npr|fvr|isuzu|iveco|cargo|815|1721/i.test(nombre);
  const pickup =
    /ranger|hilux|duty|trit|150|silverado|cheyenne|d-max|l200|bt-50/i.test(
      nombre,
    );
  return (
    <svg
      className="vehiculo-imagen"
      viewBox="0 0 320 150"
      role="img"
      aria-label={`Ilustración de ${camion ? "camión" : pickup ? "camioneta" : "automóvil"} · ${nombre}`}
    >
      <ellipse
        cx="164"
        cy="127"
        rx="133"
        ry="9"
        fill="currentColor"
        opacity=".08"
      />
      <path d="M32 124H289" stroke="currentColor" opacity=".2" />
      {camion ? (
        <>
          <path
            d="M25 47h175v69H25z"
            fill="var(--vehiculo-panel)"
            stroke="var(--vehiculo-trazo)"
            strokeWidth="2"
          />
          <path
            d="M202 56h44l33 35v25h-77z"
            fill="var(--vehiculo-color)"
            stroke="var(--vehiculo-trazo)"
            strokeWidth="2"
          />
          <path d="M212 64h29l23 26h-52z" fill="var(--vehiculo-vidrio)" />
          <path
            d="M36 60h151M36 70h151M36 80h151"
            stroke="var(--vehiculo-trazo)"
            opacity=".2"
          />
          <path d="M263 100h14v9h-14z" fill="#ffe3a0" />
        </>
      ) : pickup ? (
        <>
          <path
            d="M28 82h92l25-36h57l32 36 48 13v21H28z"
            fill="var(--vehiculo-color)"
            stroke="var(--vehiculo-trazo)"
            strokeWidth="2"
          />
          <path d="m150 54-20 28h90l-24-28z" fill="var(--vehiculo-vidrio)" />
          <path
            d="M171 54v29M122 84v28M29 91h78"
            stroke="var(--vehiculo-trazo)"
            strokeWidth="2"
            opacity=".5"
          />
          <path d="m263 94 17 4v10h-17z" fill="#ffe3a0" />
        </>
      ) : (
        <>
          <path
            d="m29 96 27-13 52-36q8-5 21-5h64q10 0 21 9l39 34 32 10 4 21H26z"
            fill="var(--vehiculo-color)"
            stroke="var(--vehiculo-trazo)"
            strokeWidth="2"
          />
          <path
            d="m113 53-40 30h165l-32-29q-4-3-15-3h-61q-10 0-17 2z"
            fill="var(--vehiculo-vidrio)"
          />
          <path
            d="M157 51v33M96 89v24M219 89v25M168 92h12"
            stroke="var(--vehiculo-trazo)"
            strokeWidth="2"
            opacity=".55"
          />
          <path d="m265 94 17 5 1 9h-18z" fill="#ffe3a0" />
          <path d="M29 98h13v10H28z" fill="#ff7f66" />
        </>
      )}
      {[75, 246].map((x) => (
        <g key={x}>
          <circle cx={x} cy="116" r="19" fill="#242a33" />
          <circle cx={x} cy="116" r="10" fill="#b6c0cb" />
          <circle cx={x} cy="116" r="5" fill="#657384" />
        </g>
      ))}
    </svg>
  );
}
