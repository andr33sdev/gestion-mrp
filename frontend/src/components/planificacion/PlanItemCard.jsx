import { FaTrash, FaEdit, FaCheckCircle } from "react-icons/fa";

export default function PlanItemCard({
  item,
  onRemove,
  onEdit,
  isPlanCerrado,
}) {
  // Calculamos porcentaje de avance
  const avance = item.cantidad > 0 ? (item.producido / item.cantidad) * 100 : 0;
  const isCompleto = item.producido >= item.cantidad;

  const handleEdit = () => {
    if (isPlanCerrado) return;
    const nuevaCantidad = prompt(
      `Editar meta para "${item.semielaborado.nombre}":`,
      item.cantidad
    );

    if (nuevaCantidad !== null) {
      const numero = Number(nuevaCantidad);
      if (!isNaN(numero) && numero > 0) {
        onEdit(numero);
      } else {
        alert("Por favor ingrese un número válido mayor a 0.");
      }
    }
  };

  return (
    <li className="bg-slate-700 p-4 rounded-xl border border-slate-600 shadow-sm flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2">
      {/* Encabezado: Nombre y Código */}
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-bold text-white text-lg leading-tight">
            {item.semielaborado.nombre}
          </h4>
          <span className="text-xs text-gray-400 font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-600 mt-1 inline-block">
            {item.semielaborado.codigo}
          </span>
        </div>

        {/* Botones de Acción */}
        {!isPlanCerrado && (
          <div className="flex gap-2">
            <button
              onClick={handleEdit}
              className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
              title="Editar Cantidad Meta"
            >
              <FaEdit />
            </button>
            <button
              onClick={onRemove}
              className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
              title="Eliminar del Plan"
            >
              <FaTrash />
            </button>
          </div>
        )}
      </div>

      {/* Barra de Progreso y Métricas */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm font-medium">
          <span className="text-gray-300">
            Progreso:{" "}
            <span className="text-white font-bold">{item.producido}</span> /{" "}
            {item.cantidad} u.
          </span>
          <span className={isCompleto ? "text-green-400" : "text-blue-400"}>
            {avance.toFixed(1)}%
          </span>
        </div>

        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-600/50">
          <div
            className={`h-full transition-all duration-500 ${
              isCompleto ? "bg-green-500" : "bg-blue-500"
            }`}
            style={{ width: `${Math.min(avance, 100)}%` }}
          />
        </div>
      </div>
    </li>
  );
}
