import React from "react";

const Tab = ({ label, active, onClick, icon }) => (
  <button
    onClick={onClick}
    className={`px-4 md:px-6 py-4 font-bold transition-all border-b-2 flex items-center gap-2 text-sm md:text-base ${
      active
        ? "border-blue-500 text-white bg-white/5"
        : "border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5"
    }`}
  >
    {icon} <span className="hidden md:inline">{label}</span>
  </button>
);

export default Tab;
