/**
 * Esta función "parsea" (traduce) el contenido crudo del .txt
 * a un array de objetos que la base de datos entiende,
 * FILTRANDO eventos duplicados y de "encendido".
 */
function parsearLog(textoCrudo) {
  const registros = []; // Aquí irán los registros filtrados

  // 1. Mantenemos un "mapa" del estado actual de cada estación
  const currentState = {
    1: null, // Estado de la Estación 1 (ej: 'cocinando' o 'enfriando')
    2: null, // Estado de la Estación 2
  };

  // 2. Dividimos el texto en líneas. Asumimos que la MÁS ANTIGUA está PRIMERO.
  const lineas = textoCrudo.split("\n");
  const regex = /^E#(\d{2}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+(.*)$/;

  let duplicadosIgnorados = 0;
  let lineasNoCoincidentes = 0;
  let encendidoIgnorado = 0; // <-- Contador para los "ENCENDIÓ EL HORNO"

  console.log(
    `[Parser] Texto crudo recibido. Procesando ${lineas.length} líneas...`
  );

  // 3. Recorremos cada línea (de la más antigua a la más nueva)
  for (const linea of lineas) {
    const lineaLimpia = linea.trim();
    const match = lineaLimpia.match(regex);

    if (match) {
      try {
        // Datos crudos del log
        const fechaOriginal = match[1];
        const hora = match[2];
        const accionLimpia = match[3].trim();

        // --- ¡NUEVO FILTRO! ---
        // Ignoramos la línea si es "ENCENDIÓ EL HORNO"
        if (accionLimpia.toUpperCase() === "ENCENDIÓ EL HORNO") {
          encendidoIgnorado++; // Contamos el evento ignorado
          continue; // <-- Salta al siguiente loop, ignorando esta línea
        }
        // --- FIN DEL NUEVO FILTRO ---

        let stationId = null;
        let newState = null;

        // Determinamos la estación y el nuevo estado del evento
        if (accionLimpia.includes("Estacion 1")) stationId = 1;
        else if (accionLimpia.includes("Estacion 2")) stationId = 2;

        if (accionLimpia.includes("Se inicio ciclo")) newState = "cocinando";
        else if (accionLimpia.includes("Enfriando")) newState = "enfriando";

        // 4. LA LÓGICA DE FILTRADO
        // Si este evento tiene una estación y un estado...
        if (stationId && newState) {
          // Comparamos el estado del evento (newState) con el guardado (currentState[stationId])
          if (currentState[stationId] !== newState) {
            // ¡HUBO UN CAMBIO DE ESTADO!
            // 1. Guardamos el nuevo estado
            currentState[stationId] = newState;

            // 2. Formateamos y guardamos el registro en la base de datos
            const partesFecha = fechaOriginal.split("-");
            const fechaFormateada = `20${partesFecha[2]}-${partesFecha[1]}-${partesFecha[0]}`;
            registros.push({
              fecha: fechaFormateada,
              hora,
              accion: accionLimpia,
            });
          } else {
            // NO HUBO CAMBIO (ej: E1 ya estaba 'cocinando' y llegó otro 'Se inicio ciclo E1')
            // Ignoramos este evento duplicado.
            duplicadosIgnorados++;
          }
        } else {
          // Es un evento E# pero no es 'cocinando' ni 'enfriando'
          // (ej: "Mantenimiento"). Lo guardamos.
          const partesFecha = fechaOriginal.split("-");
          const fechaFormateada = `20${partesFecha[2]}-${partesFecha[1]}-${partesFecha[0]}`;
          registros.push({
            fecha: fechaFormateada,
            hora,
            accion: accionLimpia,
          });
        }
      } catch (e) {
        console.warn(`Error parseando línea: "${lineaLimpia}"`, e);
      }
    } else if (lineaLimpia.length > 0) {
      // Líneas que no son E# (como las A# de alarma)
      lineasNoCoincidentes++;
    }
  }

  console.log(`[Parser] Total de registros parseados: ${registros.length}`);
  console.log(
    `[Parser] Total de líneas E# duplicadas ignoradas: ${duplicadosIgnorados}`
  );
  console.log(
    `[Parser] Total de líneas "ENCENDIÓ EL HORNO" ignoradas: ${encendidoIgnorado}`
  ); // <-- Nuevo log
  console.log(
    `[Parser] Total de líneas no-E# (Alarmas, etc.) ignoradas: ${lineasNoCoincidentes}`
  );

  return registros;
}

module.exports = { parsearLog };
