"use client";

/**
 * Atalho de marcação em massa (F1). Botões Client que emitem o `CustomEvent`
 * `ifp:presenca-todos` ouvido por cada `<PresencaToggle>`. Mantém o card como
 * Server Component — só este pedaço precisa de `onClick`.
 */
export function PresencaAtalho() {
  function marcarTodos(presente: boolean) {
    window.dispatchEvent(new CustomEvent("ifp:presenca-todos", { detail: { presente } }));
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => marcarTodos(true)}>
        Todos presentes
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => marcarTodos(false)}>
        Todas faltas
      </button>
    </div>
  );
}
