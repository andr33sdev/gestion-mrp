import React from "react";

export default function TabButton({ label, icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-4 font-bold border-b-2 transition-all ${
        active
          ? "border-blue-500 text-white"
          : "border-transparent text-gray-500 hover:text-gray-300"
      }`}
    >
      {icon} {label}
    </button>
  );
}
