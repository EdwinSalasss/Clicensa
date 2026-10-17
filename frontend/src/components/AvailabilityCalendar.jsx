const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function mesAnterior(mes) {
  const [anio, numeroMes] = mes.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, numeroMes - 2, 1));
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;
}

function mesSiguiente(mes) {
  const [anio, numeroMes] = mes.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, numeroMes, 1));
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function AvailabilityCalendar({
  mes,
  fechaSeleccionada,
  minimo,
  disponibilidad,
  cargando,
  onCambiarMes,
  onSeleccionarFecha,
}) {
  const [anio, numeroMes] = mes.split("-").map(Number);
  const primerDia = new Date(Date.UTC(anio, numeroMes - 1, 1));
  const diasEnMes = new Date(Date.UTC(anio, numeroMes, 0)).getUTCDate();
  const espaciosIniciales = (primerDia.getUTCDay() + 6) % 7;
  const dias = [
    ...Array(espaciosIniciales).fill(null),
    ...Array.from({ length: diasEnMes }, (_, indice) => indice + 1),
  ];
  const diasDisponibles = Object.values(disponibilidad).filter((horarios) => horarios.length).length;
  const mesMinimo = minimo.slice(0, 7);

  return (
    <section className="availability-calendar" aria-label="Calendario de disponibilidad">
      <div className="calendar-heading">
        <div>
          <h4>1. Elige un día disponible</h4>
          <p>Los días sin horarios libres no se pueden seleccionar.</p>
        </div>
        <div className="calendar-month-control">
          <button
            className="calendar-nav"
            type="button"
            aria-label="Mes anterior"
            disabled={mes <= mesMinimo || cargando}
            onClick={() => onCambiarMes(mesAnterior(mes))}
          >
            ‹
          </button>
          <strong>{MESES[numeroMes - 1]} {anio}</strong>
          <button
            className="calendar-nav"
            type="button"
            aria-label="Mes siguiente"
            disabled={cargando}
            onClick={() => onCambiarMes(mesSiguiente(mes))}
          >
            ›
          </button>
        </div>
      </div>
      <div className="calendar-grid calendar-weekdays" aria-hidden="true">
        {DIAS.map((dia) => <span key={dia}>{dia}</span>)}
      </div>
      {cargando ? (
        <p className="calendar-message" role="status">Buscando horarios libres...</p>
      ) : (
        <div className="calendar-grid calendar-days">
          {dias.map((dia, indice) => {
            if (!dia) return <span className="calendar-empty" key={`vacio-${indice}`} />;
            const fecha = `${mes}-${String(dia).padStart(2, "0")}`;
            const horarios = disponibilidad[fecha] || [];
            const disponible = fecha >= minimo && horarios.length > 0;
            const seleccionado = fechaSeleccionada === fecha;
            return (
              <button
                className={`calendar-day${disponible ? " is-available" : " is-unavailable"}${seleccionado ? " is-selected" : ""}`}
                type="button"
                key={fecha}
                disabled={!disponible}
                aria-pressed={seleccionado}
                aria-label={`${dia} de ${MESES[numeroMes - 1]}${disponible ? `, ${horarios.length} horarios disponibles` : ", sin horarios disponibles"}`}
                title={disponible ? `${horarios.length} horarios disponibles` : "Sin horarios disponibles"}
                onClick={() => onSeleccionarFecha(fecha)}
              >
                <strong>{dia}</strong>
                <span>{disponible ? `${horarios.length} ${horarios.length === 1 ? "hora" : "horas"}` : "—"}</span>
              </button>
            );
          })}
        </div>
      )}
      {!cargando && (
        <p className="calendar-legend" aria-live="polite">
          {diasDisponibles
            ? `${diasDisponibles} ${diasDisponibles === 1 ? "día disponible" : "días disponibles"} este mes. Selecciona uno resaltado.`
            : "No hay días con horarios libres este mes. Prueba el siguiente."}
        </p>
      )}
    </section>
  );
}
