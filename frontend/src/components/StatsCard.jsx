import React, { useState } from "react";

export default function StatsCard() {
  const [count, setCount] = useState(12);

  const styles = {
    card: {
      maxWidth: "360px",
      margin: "20px auto",
      padding: "20px",
      borderRadius: "12px",
      backgroundColor: "#0f172a",
      color: "#f8fafc",
      fontFamily: "system-ui, -apple-system, sans-serif",
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
      border: "1px solid #1e293b",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "16px",
    },
    title: {
      fontSize: "1.1rem",
      fontWeight: "600",
      color: "#94a3b8",
      margin: 0,
    },
    value: {
      fontSize: "2.5rem",
      fontWeight: "bold",
      color: "#38bdf8",
      margin: "8px 0 20px 0",
      textAlign: "center",
    },
    controls: {
      display: "flex",
      gap: "10px",
    },
    button: {
      flex: 1,
      padding: "8px 0",
      borderRadius: "6px",
      border: "none",
      fontSize: "1rem",
      fontWeight: "bold",
      cursor: "pointer",
      backgroundColor: "#334155",
      color: "#ffffff",
    },
    btnActive: {
      backgroundColor: "#0284c7",
    },
  };

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <h3 style={styles.title}>Tareas Completadas</h3>
        <span style={{ fontSize: "1.2rem" }}>📊</span>
      </div>
      <div style={styles.value}>{count}</div>
      <div style={styles.controls}>
        <button
          style={styles.button}
          onClick={() => setCount((prev) => Math.max(0, prev - 1))}
        >
          -
        </button>
        <button
          style={{ ...styles.button, ...styles.btnActive }}
          onClick={() => setCount((prev) => prev + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
