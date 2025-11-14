import { useState } from "react";
import { FaKey, FaLock } from "react-icons/fa";

export default function LoginPage({ onLoginSuccess, expectedPassword, title }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const handleSubmit = (e) => {
    e.preventDefault();
    if (input === expectedPassword) onLoginSuccess();
    else {
      setError("Contraseña incorrecta");
      setInput("");
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
            />
          </div>
          {error && (
            <p className="text-red-400 text-center text-xs mb-4 bg-red-900/20 p-2 rounded border border-red-900">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg transition-transform active:scale-95"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
