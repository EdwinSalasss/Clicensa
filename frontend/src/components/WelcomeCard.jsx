import React, { useState } from "react";

export default function UserProfileCard() {
  const [likes, setLikes] = useState(0);

  // Estilos con CSS puro (JavaScript objects)
  const styles = {
    card: {
      maxWidth: "380px",
      margin: "40px auto",
      padding: "24px",
      borderRadius: "16px",
      backgroundColor: "#1e293b",
      color: "#f8fafc",
      fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
      boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)",
      border: "1px solid #334155",
      textAlign: "center",
    },
    avatarContainer: {
      width: "80px",
      height: "80px",
      margin: "0 auto 16px",
      borderRadius: "50%",
      backgroundColor: "#3b82f6",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "32px",
      fontWeight: "bold",
      color: "#ffffff",
    },
    title: {
      fontSize: "1.4rem",
      fontWeight: "600",
      margin: "0 0 6px 0",
    },
    subtitle: {
      fontSize: "0.9rem",
      color: "#94a3b8",
      margin: "0 0 16px 0",
    },
    badgeContainer: {
      display: "flex",
      justifyContent: "center",
      gap: "8px",
      marginBottom: "20px",
      flexWrap: "wrap",
    },
    badge: {
      padding: "4px 12px",
      borderRadius: "20px",
      fontSize: "0.75rem",
      fontWeight: "600",
      backgroundColor: "#0f172a",
      color: "#38bdf8",
      border: "1px solid #1e293b",
    },
    button: {
      backgroundColor: "#3b82f6",
      color: "#ffffff",
      border: "none",
      padding: "10px 20px",
      borderRadius: "8px",
      fontSize: "0.9rem",
      fontWeight: "600",
      cursor: "pointer",
      transition: "background-color 0.2s ease",
    },
    stats: {
      marginTop: "16px",
      fontSize: "0.85rem",
      color: "#cbd5e1",
    },
  };

  return (
    <div style={styles.card}>
      <div style={styles.avatarContainer}>M</div>
      <h2 style={styles.title}>Maxin Branch Feature</h2>
      <p style={styles.subtitle}>Prueba de desarrollo en rama aislada</p>

      <div style={styles.badgeContainer}>
        <span style={styles.badge}>React</span>
        <span style={styles.badge}>Git</span>
        <span style={styles.badge}>Clean Code</span>
      </div>

      <button style={styles.button} onClick={() => setLikes(likes + 1)}>
        👍 Dar Like ({likes})
      </button>

      <div style={styles.stats}>
        <p>
          Estado: <strong>Commit listo para enviar</strong>
        </p>
      </div>
    </div>
  );
}
