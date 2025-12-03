import React, { useState, useRef, useEffect } from "react";
import { FaRobot, FaPaperPlane, FaTimes, FaBrain } from "react-icons/fa";
import { API_BASE_URL, authFetch } from "../utils";
import { motion, AnimatePresence } from "framer-motion";

export default function ChatGerencia() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "system",
      content:
        "Hola Gerente. Tengo acceso a los datos de stock, producción y planes activos. ¿Qué necesitas saber hoy?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll al fondo
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input;
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    setLoading(true);

    try {
      const res = await authFetch(`${API_BASE_URL}/ia/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: userMsg }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "system", content: data.respuesta },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content:
              "Error: " + (data.msg || "No pude conectar con el cerebro."),
          },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "system", content: "Error de conexión." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botón Flotante (Cerebro) */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-full shadow-2xl z-[1000] border-2 border-white/20"
      >
        {isOpen ? <FaTimes size={24} /> : <FaBrain size={24} />}
      </motion.button>

      {/* Ventana de Chat */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-24 right-6 w-96 h-[500px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-[1000] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-slate-800 p-4 border-b border-slate-700 flex items-center gap-3">
              <div className="bg-purple-600 p-2 rounded-lg">
                <FaRobot className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white">Asistente Gerencial</h3>
                <p className="text-xs text-green-400 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Conectado a Base de Datos
                </p>
              </div>
            </div>

            {/* Mensajes */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-900/95"
            >
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-xl text-sm leading-relaxed shadow-sm ${
                      msg.role === "user"
                        ? "bg-purple-600 text-white rounded-br-none"
                        : "bg-slate-800 text-gray-200 rounded-bl-none border border-slate-700"
                    }`}
                  >
                    {/* Renderizado simple de saltos de línea y negritas */}
                    <div style={{ whiteSpace: "pre-wrap" }}>
                      {(msg.content || "") // <-- Usamos || "" para asegurar que siempre es una cadena
                        .replace(/\*\*/g, "")}
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 p-3 rounded-xl rounded-bl-none flex gap-1 border border-slate-700">
                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce delay-75"></span>
                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce delay-150"></span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={handleSend}
              className="p-3 bg-slate-800 border-t border-slate-700 flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pregunta sobre stock, producción..."
                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-purple-600 hover:bg-purple-500 text-white p-3 rounded-lg transition-colors disabled:opacity-50"
              >
                <FaPaperPlane />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
