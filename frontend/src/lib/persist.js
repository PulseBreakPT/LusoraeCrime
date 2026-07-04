import { useEffect, useState } from "react";

// Estado de UI (aba ativa, filtros, ordenação, favoritos locais) que sobrevive
// a recarregamentos da página — sem tocar no servidor, só preferências pessoais
// do dispositivo. Cada painel usa uma chave própria para não colidirem entre si.
const PREFIX = "lusorae.ui.";

function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw != null ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

export function usePersistedState(key, fallback) {
  const [value, setValue] = useState(() => readStorage(key, fallback));

  useEffect(() => {
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      // armazenamento indisponível (modo privado, quota excedida) — ignora silenciosamente
    }
  }, [key, value]);

  return [value, setValue];
}
