// backend/utils/helpers.js
function normalizarTexto(txt) {
    if (!txt) return "";
    return txt
        .toString()
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

module.exports = { normalizarTexto };