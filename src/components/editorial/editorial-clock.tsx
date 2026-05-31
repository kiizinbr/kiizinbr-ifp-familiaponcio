"use client";

import { useEffect, useState } from "react";
import styles from "./editorial.module.css";

/**
 * Relógio institucional da dateline (tema editorial).
 * aria-hidden: é decoração, não informação essencial (o leitor de tela ignora).
 * Atualiza a cada 15s — barato, e prefers-reduced-motion não cobre conteúdo,
 * então mantemos a cadência baixa de propósito.
 */
export function EditorialClock() {
  const [time, setTime] = useState("--:--");

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      setTime(`${hh}:${mm}`);
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={styles.clock} aria-hidden="true">
      {time}
    </div>
  );
}
