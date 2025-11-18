import React from "react";

export const PlanPdf = React.forwardRef(({ plan, items, explosion }, ref) => {
  // Si no hay plan, mostramos algo básico para que no rompa
  const nombrePlan = plan?.nombre || "Sin Nombre";
  const fecha = new Date().toLocaleDateString("es-AR");

  return (
    <div ref={ref} className="p-10 bg-white text-black font-sans h-full w-full">
      {/* Encabezado */}
      <div className="border-b-2 border-gray-800 pb-4 mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-wider">
            Orden de Producción
          </h1>
          <p className="text-gray-600 mt-1">
            Sistema de Gestión - Horno Rotomoldeo
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">{nombrePlan}</p>
          <p className="text-sm text-gray-500">{fecha}</p>
        </div>
      </div>

      {/* Sección 1: Ítems a Producir */}
      <div className="mb-10">
        <h3 className="text-lg font-bold bg-gray-200 px-3 py-1 mb-3 border-l-4 border-gray-800 uppercase">
          1. Plan de Trabajo
        </h3>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-400">
              <th className="text-left py-2 font-bold">Semielaborado</th>
              <th className="text-right py-2 font-bold">Cantidad</th>
              <th className="text-right py-2 font-bold">Avance Actual</th>
            </tr>
          </thead>
          <tbody>
            {items && items.length > 0 ? (
              items.map((item, i) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="py-3">
                    {item.semielaborado?.nombre || "Desconocido"}
                  </td>
                  <td className="py-3 text-right font-bold">{item.cantidad}</td>
                  <td className="py-3 text-right text-gray-500">
                    {item.producido}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="3"
                  className="py-4 text-center italic text-gray-500"
                >
                  Sin ítems asignados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Sección 2: Materiales (MRP) */}
      <div>
        <h3 className="text-lg font-bold bg-gray-200 px-3 py-1 mb-3 border-l-4 border-gray-800 uppercase">
          2. Requerimiento de Materiales (MRP)
        </h3>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-400">
              <th className="text-left py-2 font-bold">Materia Prima</th>
              <th className="text-left py-2 font-bold">Código</th>
              <th className="text-right py-2 font-bold">Necesario</th>
              <th className="text-right py-2 font-bold">Stock</th>
              <th className="text-right py-2 font-bold">Balance</th>
            </tr>
          </thead>
          <tbody>
            {explosion && explosion.length > 0 ? (
              explosion.map((mp, i) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="py-2">{mp.nombre}</td>
                  <td className="py-2 font-mono text-xs">{mp.codigo}</td>
                  <td className="py-2 text-right">{mp.necesario}</td>
                  <td className="py-2 text-right">{mp.stock}</td>
                  <td
                    className={`py-2 text-right font-bold ${
                      mp.balance < 0 ? "text-red-600" : "text-green-700"
                    }`}
                  >
                    {mp.balance}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="5"
                  className="py-4 text-center italic text-gray-500"
                >
                  No hay requerimientos pendientes calculados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-12 border-t border-gray-300 pt-4 text-xs text-center text-gray-400">
        Documento generado automáticamente.
      </div>
    </div>
  );
});
