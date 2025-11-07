/* Borramos la tabla 'registros' si es que ya existe,
  para empezar de cero sin conflictos.
*/
DROP TABLE IF EXISTS registros;

/* Creamos la nueva tabla con tu estructura deseada.
*/
CREATE TABLE registros (
  id SERIAL PRIMARY KEY,       -- Un identificador único automático
  fecha DATE,                  -- El campo para la fecha (ej: 2025-11-06)
  hora TIME,                   -- El campo para la hora (ej: 14:30:00)
  accion TEXT                  -- Un texto largo para la acción (ej: "Inicio ciclo 3")
);