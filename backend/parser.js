// backend/parser.js

function parsearLog(textoCrudo) {
  const registros = [];
  const currentState = { 1: null, 2: null };

  const lineas = textoCrudo.split("\n");

  // Definimos DOS "traductores", uno para Eventos y otro para Alarmas
  const regexEvento = /^E#(\d{2}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+(.*)$/;
  const regexAlarma = /^A#(\d{2}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+(.*)$/;

  let duplicadosIgnorados = 0;
  let lineasNoCoincidentes = 0;
  let encendidoIgnorado = 0;

  console.log(
    `[Parser] Texto crudo recibido. Procesando ${lineas.length} líneas...`
  );

  for (const linea of lineas) {
    const lineaLimpia = linea.trim();

    // Intentamos "traducir" como Evento
    const matchEvento = lineaLimpia.match(regexEvento);
    // Intentamos "traducir" como Alarma
    const matchAlarma = lineaLimpia.match(regexAlarma);

    try {
      if (matchEvento) {
        // --- ES UN EVENTO E# ---
        const fechaOriginal = matchEvento[1];
        const hora = matchEvento[2];
        const accionLimpia = matchEvento[3].trim();

        if (accionLimpia.toUpperCase() === "ENCENDIÓ EL HORNO") {
          encendidoIgnorado++;
          continue;
        }

        let stationId = null;
        let newState = null;

        if (accionLimpia.includes("Estacion 1")) stationId = 1;
        else if (accionLimpia.includes("Estacion 2")) stationId = 2;

        if (accionLimpia.includes("Se inicio ciclo")) newState = "cocinando";
        else if (accionLimpia.includes("Enfriando")) newState = "enfriando";

        if (stationId && newState) {
          if (currentState[stationId] !== newState) {
            currentState[stationId] = newState;
            const fechaFormateada = `20${fechaOriginal.split("-")[2]}-${
              fechaOriginal.split("-")[1]
            }-${fechaOriginal.split("-")[0]}`;
            // Añadimos el 'tipo'
            registros.push({
              fecha: fechaFormateada,
              hora,
              accion: accionLimpia,
              tipo: "EVENTO",
            });
          } else {
            duplicadosIgnorados++;
          }
        } else {
          const fechaFormateada = `20${fechaOriginal.split("-")[2]}-${
            fechaOriginal.split("-")[1]
          }-${fechaOriginal.split("-")[0]}`;
          registros.push({
            fecha: fechaFormateada,
            hora,
            accion: accionLimpia,
            tipo: "EVENTO",
          });
        }
      } else if (matchAlarma) {
        // --- ¡ES UNA ALARMA A#! ---
        // No filtramos duplicados, solo la guardamos
        const fechaOriginal = matchAlarma[1];
        const hora = matchAlarma[2];
        const accionLimpia = matchAlarma[3].trim();

        const fechaFormateada = `20${fechaOriginal.split("-")[2]}-${
          fechaOriginal.split("-")[1]
        }-${fechaOriginal.split("-")[0]}`;
        // Añadimos el 'tipo'
        registros.push({
          fecha: fechaFormateada,
          hora,
          accion: accionLimpia,
          tipo: "ALARMA",
        });
      } else if (lineaLimpia.length > 0) {
        lineasNoCoincidentes++;
      }
    } catch (e) {
      console.warn(`Error parseando línea: "${lineaLimpia}"`, e);
    }
  }

  console.log(`[Parser] Total de registros parseados: ${registros.length}`);
  console.log(
    `[Parser] Total de líneas E# duplicadas ignoradas: ${duplicadosIgnorados}`
  );
  console.log(
    `[Parser] Total de líneas "ENCENDIÓ EL HORNO" ignoradas: ${encendidoIgnorado}`
  );
  console.log(
    `[Parser] Total de líneas no-E# / no-A# ignoradas: ${lineasNoCoincidentes}`
  );

  return registros;
}

module.exports = { parsearLog };
