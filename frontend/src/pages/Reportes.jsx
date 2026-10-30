import { useEffect, useMemo, useState } from "react";
import NavBar from "../components/NavBar.jsx";
import { api } from "../api/client.js";
import { getUsuario } from "../api/session.js";

const ahora = new Date();
const fechaHoy = [
  ahora.getFullYear(),
  String(ahora.getMonth() + 1).padStart(2, "0"),
  String(ahora.getDate()).padStart(2, "0"),
].join("-");
const inicioMes = `${fechaHoy.slice(0, 8)}01`;
const fechaMaximaReporte = (fecha) => {
  const maximo = new Date(`${fecha}T00:00:00.000Z`);
  maximo.setUTCDate(maximo.getUTCDate() + 365);
  return maximo.toISOString().slice(0, 10);
};
const ESTADOS = ["PENDIENTE", "CONFIRMADA", "CANCELADA", "ATENDIDA", "VENCIDA"];
const COLUMNAS = ["Fecha", "Hora", "Paciente", "Médico", "Servicio", "Estado", "Precio"];

function formatoImporte(valor) {
  return Number(valor || 0).toLocaleString("es-NI", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function csvCell(valor) {
  const texto = String(valor ?? "");
  const protegido = /^[\t\r\n ]*[=+\-@]/.test(texto) ? `'${texto}` : texto;
  return `"${protegido.replaceAll('"', '""')}"`;
}

function descargarCsv(reporte) {
  const celdas = [
    ["Reporte de citas", `${reporte.desde} - ${reporte.hasta}`],
    ["Total de citas", reporte.resumen.totalCitas],
    ["Citas pendientes", reporte.resumen.porEstado.PENDIENTE],
    ["Citas confirmadas", reporte.resumen.porEstado.CONFIRMADA],
    ["Citas atendidas", reporte.resumen.porEstado.ATENDIDA],
    ["Citas canceladas", reporte.resumen.porEstado.CANCELADA],
    ["Citas vencidas", reporte.resumen.porEstado.VENCIDA],
    ["Ingresos atendidos", formatoImporte(reporte.resumen.ingresosAtendidos)],
    ["Ingresos por atender", formatoImporte(reporte.resumen.ingresosPendientes)],
    [],
    [...COLUMNAS, "Ingreso atendido", "Ingreso por atender"],
    ...reporte.citas.map((cita) => [
      cita.fecha,
      cita.hora,
      cita.paciente,
      cita.medico,
      cita.servicio,
      cita.estado,
      formatoImporte(cita.precio),
      formatoImporte(cita.estado === "ATENDIDA" ? cita.precio : 0),
      formatoImporte(["PENDIENTE", "CONFIRMADA"].includes(cita.estado) ? cita.precio : 0),
    ]),
  ];
  const contenido = celdas
    .map((fila) => fila.map(csvCell).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${contenido}`], { type: "text/csv;charset=utf-8" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `reporte-citas-${reporte.desde}-${reporte.hasta}.csv`;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function descargarPdf(reporte) {
  const { jsPDF } = await import("jspdf");
  const documento = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const ancho = documento.internal.pageSize.getWidth();
  const alto = documento.internal.pageSize.getHeight();
  const columnas = [
    { titulo: "Fecha", x: 10, ancho: 24 },
    { titulo: "Hora", x: 35, ancho: 15 },
    { titulo: "Paciente", x: 52, ancho: 36 },
    { titulo: "Médico", x: 90, ancho: 36 },
    { titulo: "Servicio", x: 128, ancho: 42 },
    { titulo: "Estado", x: 172, ancho: 27 },
    { titulo: "Precio", x: 201, ancho: 25 },
    { titulo: "Atendido", x: 228, ancho: 29 },
    { titulo: "Pendiente", x: 259, ancho: 28 },
  ];
  const escribirEncabezado = () => {
    documento.setFillColor(30, 58, 138);
    documento.rect(9, 48, ancho - 18, 8, "F");
    documento.setFont("helvetica", "bold");
    documento.setFontSize(8);
    documento.setTextColor(255, 255, 255);
    columnas.forEach(({ titulo, x }) => documento.text(titulo, x + 1, 53.3));
  };

  documento.setTextColor(30, 58, 138);
  documento.setFont("helvetica", "bold");
  documento.setFontSize(18);
  documento.text("Reporte de citas CLISENSA", 10, 16);
  documento.setFont("helvetica", "normal");
  documento.setFontSize(10);
  documento.setTextColor(55, 65, 81);
  documento.text(`Periodo: ${reporte.desde} al ${reporte.hasta}`, 10, 23);
  documento.text(`Citas: ${reporte.resumen.totalCitas}`, 10, 31);
  documento.text(`Atendidas: ${formatoImporte(reporte.resumen.ingresosAtendidos)}`, 70, 31);
  documento.text(`Por atender: ${formatoImporte(reporte.resumen.ingresosPendientes)}`, 145, 31);
  documento.text(
    `Estados: ${ESTADOS.map((estado) => `${estado} ${reporte.resumen.porEstado[estado]}`).join(" · ")}`,
    10,
    39
  );
  escribirEncabezado();

  let y = 62;
  documento.setFont("helvetica", "normal");
  documento.setFontSize(7.5);
  documento.setTextColor(31, 41, 55);
  for (const cita of reporte.citas) {
    if (y > alto - 12) {
      documento.addPage();
      escribirEncabezado();
      y = 62;
      documento.setFont("helvetica", "normal");
      documento.setFontSize(7.5);
      documento.setTextColor(31, 41, 55);
    }
    const valores = [
      cita.fecha,
      cita.hora,
      cita.paciente,
      cita.medico,
      cita.servicio,
      cita.estado,
      formatoImporte(cita.precio),
      cita.estado === "ATENDIDA" ? formatoImporte(cita.precio) : "0.00",
      ["PENDIENTE", "CONFIRMADA"].includes(cita.estado) ? formatoImporte(cita.precio) : "0.00",
    ];
    const valoresEnvuelta = valores.map((valor, indice) =>
      documento.splitTextToSize(String(valor), columnas[indice].ancho - 2)
    );
    const altoFila = Math.max(7, ...valoresEnvuelta.map((lineas) => lineas.length * 3.5));
    if (y + altoFila > alto - 8) {
      documento.addPage();
      escribirEncabezado();
      y = 62;
      documento.setFont("helvetica", "normal");
      documento.setFontSize(7.5);
      documento.setTextColor(31, 41, 55);
    }
    valoresEnvuelta.forEach((lineas, indice) => {
      const { x } = columnas[indice];
      documento.text(lineas, x + 1, y);
    });
    documento.setDrawColor(226, 232, 240);
    documento.line(9, y + altoFila - 2, ancho - 9, y + altoFila - 2);
    y += altoFila;
  }
  documento.save(`reporte-citas-${reporte.desde}-${reporte.hasta}.pdf`);
}

export default function Reportes() {
  const usuario = getUsuario();
  const [desde, setDesde] = useState(inicioMes);
  const [hasta, setHasta] = useState(fechaHoy);
  const [filtros, setFiltros] = useState({ desde: inicioMes, hasta: fechaHoy });
  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [exportandoPdf, setExportandoPdf] = useState(false);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError("");
    api.reporteCitas(filtros.desde, filtros.hasta)
      .then((resultado) => {
        if (vigente) setReporte(resultado);
      })
      .catch((err) => {
        if (vigente) {
          setReporte(null);
          setError(err.message);
        }
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => { vigente = false; };
  }, [filtros]);

  const nombreRol = usuario?.rol === "MEDICO" || usuario?.rol === "medico"
    ? "médico"
    : "hospital";
  const resumen = reporte?.resumen;
  const tarjetas = useMemo(() => resumen ? [
    { titulo: "Citas en el periodo", valor: resumen.totalCitas },
    { titulo: "Ingresos atendidos", valor: formatoImporte(resumen.ingresosAtendidos) },
    { titulo: "Ingresos por atender", valor: formatoImporte(resumen.ingresosPendientes) },
    { titulo: "Ingresos potenciales", valor: formatoImporte(resumen.ingresosPotenciales) },
  ] : [], [resumen]);

  function consultar(event) {
    event.preventDefault();
    if (!desde || !hasta) {
      setError("Selecciona una fecha de inicio y una fecha de fin.");
      return;
    }
    if (hasta < desde || hasta > fechaMaximaReporte(desde)) {
      setError("El periodo debe ser válido y no puede superar 366 días.");
      return;
    }
    setError("");
    setFiltros({ desde, hasta });
  }

  async function exportarPdf() {
    setError("");
    setExportandoPdf(true);
    try {
      await descargarPdf(reporte);
    } catch (err) {
      console.error("No se pudo exportar el reporte a PDF:", err);
      setError("No se pudo generar el PDF. Inténtalo nuevamente.");
    } finally {
      setExportandoPdf(false);
    }
  }

  return (
    <>
      <NavBar />
      <main className="panel">
        <h2>Reportes del {nombreRol}</h2>
        <p className="subtitle">Consulta citas e ingresos estimados dentro de un periodo.</p>
        <section className="card report-filters">
          <form onSubmit={consultar}>
            <label>
              DESDE
              <input type="date" max={hasta || undefined} value={desde} onChange={(event) => setDesde(event.target.value)} required />
            </label>
            <label>
              HASTA
              <input type="date" value={hasta} min={desde} max={desde ? fechaMaximaReporte(desde) : undefined} onChange={(event) => setHasta(event.target.value)} required />
            </label>
            <button type="submit" disabled={cargando}>Consultar</button>
          </form>
        </section>
        {error && <p className="error" role="alert">{error}</p>}
        {cargando ? <p>Cargando reporte...</p> : reporte && (
          <>
            <div className="card-grid report-summary">
              {tarjetas.map((tarjeta) => (
                <section className="card" key={tarjeta.titulo}>
                  <h3>{tarjeta.titulo}</h3>
                  <strong className="big">{tarjeta.valor}</strong>
                </section>
              ))}
            </div>
            <section className="card report-details">
              <div className="section-heading">
                <div>
                  <h3>Detalle de citas</h3>
                  <p className="muted">
                    Los ingresos son estimados con los precios de los servicios:
                    solo las citas atendidas se cuentan como realizadas.
                  </p>
                </div>
                <div className="report-actions">
                  <button type="button" className="ghost" onClick={() => descargarCsv(reporte)}>Exportar CSV</button>
                  <button type="button" onClick={exportarPdf} disabled={exportandoPdf}>
                    {exportandoPdf ? "Generando PDF..." : "Exportar PDF"}
                  </button>
                </div>
              </div>
              <div className="report-statuses" aria-label="Citas por estado">
                {ESTADOS.map((estado) => (
                  <span className={`badge ${estado.toLowerCase()}`} key={estado}>
                    {estado}: {resumen.porEstado[estado]}
                  </span>
                ))}
              </div>
              {reporte.citas.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr><th>Fecha</th><th>Hora</th><th>Paciente</th><th>Médico</th><th>Servicio</th><th>Estado</th><th>Precio</th></tr>
                    </thead>
                    <tbody>
                      {reporte.citas.map((cita) => (
                        <tr key={cita.id}>
                          <td>{cita.fecha}</td>
                          <td>{cita.hora}</td>
                          <td>{cita.paciente}</td>
                          <td>{cita.medico}</td>
                          <td>{cita.servicio}</td>
                          <td><span className={`badge ${cita.estado.toLowerCase()}`}>{cita.estado}</span></td>
                          <td>{formatoImporte(cita.precio)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="muted">No hay citas en el periodo seleccionado.</p>}
            </section>
          </>
        )}
      </main>
    </>
  );
}
