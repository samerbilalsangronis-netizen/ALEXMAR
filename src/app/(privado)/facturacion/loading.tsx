export default function CargandoFacturacion() {
  return (
    <div role="status" aria-live="polite" className="factura-cargando">
      <p>Cargando facturación…</p>
      <div className="panel" aria-hidden="true">
        <div />
        <div />
        <div />
      </div>
    </div>
  );
}
