// frontend/src/pages/LoginPage.jsx
import { useState } from "react";
import { FaKey, FaLock, FaSpinner } from "react-icons/fa";

export default function LoginPage({ onLoginAttempt, title }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Intentamos loguear con la función que nos pasa el padre (App.jsx)
    const success = await onLoginAttempt(input);

    if (success) {
      // Si es exitoso, el componente se desmontará solo por el cambio de estado en App
    } else {
      setError("Clave incorrecta o error de conexión");
      setInput("");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center pt-10">
      <div className="bg-slate-800 rounded-xl shadow-2xl p-8 w-full max-w-md">
        <h2 className="text-3xl font-bold text-white mb-2 text-center flex justify-center gap-2 items-center">
          <FaLock className="text-blue-500" /> {title}
        </h2>
        <p className="text-gray-400 text-center text-sm mb-6">
          Ingrese su clave de seguridad
        </p>
        <form onSubmit={handleSubmit}>
          <div className="relative mb-6">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
              <FaKey />
            </span>
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full p-3 pl-10 bg-slate-900 text-white rounded-lg border border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="********"
              autoFocus
              disabled={loading}
            />
          </div>
          {error && (
            <p className="text-red-400 text-center text-xs mb-4 bg-red-900/20 p-2 rounded border border-red-900">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg transition-transform active:scale-95 flex justify-center items-center gap-2"
          >
            {loading ? <FaSpinner className="animate-spin" /> : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}