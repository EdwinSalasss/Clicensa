import React, { useState, useEffect } from "react";

export default function PomodoroTimer() {
  const [secondsLeft, setSecondsLeft] = useState(1500); // 25 minutos
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval = null;
    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => prev - 1);
      }, 1000);
    } else if (secondsLeft === 0) {
      setIsActive(false);
    }
    return () => clearInterval(interval);
  }, [isActive, secondsLeft]);

  const toggleTimer = () => setIsActive(!isActive);
  const resetTimer = () => {
    setIsActive(false);
    setSecondsLeft(1500);
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const styles = {
    card: {
      maxWidth: "360px",
      margin: "20px auto",
      padding: "24px",
      borderRadius: "12px",
      backgroundColor: "#18181b",
      color: "#f4f4f5",
      textAlign: "center",
      fontFamily: "system-ui, sans-serif",
      border: "1px solid #27272a",
      boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
    },
    display: {
      fontSize: "3rem",
      fontWeight: "bold",
      color: "#38bdf8",
      margin: "20px 0",
    },
    btnGroup: {
      display: "flex",
      gap: "10px",
      justifyContent: "center",
    },
    btnPrimary: {
      padding: "10px 20px",
      borderRadius: "8px",
      backgroundColor: isActive ? "#f59e0b" : "#22c55e",
      color: "#fff",
      border: "none",
      fontWeight: "600",
      cursor: "pointer",
    },
    btnSecondary: {
      padding: "10px 20px",
      borderRadius: "8px",
      backgroundColor: "#3f3f46",
      color: "#fff",
      border: "none",
      fontWeight: "600",
      cursor: "pointer",
    },
  };

  return (
    <div style={styles.card}>
      <h3 style={{ margin: 0, color: "#a1a1aa" }}>Temporizador de Enfoque</h3>
      <div style={styles.display}>{formattedTime}</div>
      <div style={styles.btnGroup}>
        <button style={styles.btnPrimary} onClick={toggleTimer}>
          {isActive ? "Pausar" : "Iniciar"}
        </button>
        <button style={styles.btnSecondary} onClick={resetTimer}>
          Reiniciar
        </button>
      </div>
    </div>
  );
}
