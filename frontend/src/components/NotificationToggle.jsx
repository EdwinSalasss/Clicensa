import React, { useState } from "react";

export default function NotificationToggle() {
  const [settings, setSettings] = useState({
    email: true,
    push: false,
    updates: true,
  });

  const toggle = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const styles = {
    card: {
      maxWidth: "360px",
      margin: "20px auto",
      padding: "20px",
      borderRadius: "12px",
      backgroundColor: "#18181b",
      color: "#f4f4f5",
      fontFamily: "system-ui, -apple-system, sans-serif",
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
      border: "1px solid #27272a",
    },
    title: {
      fontSize: "1.2rem",
      margin: "0 0 16px 0",
      color: "#fafafa",
    },
    row: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 0",
      borderBottom: "1px solid #27272a",
    },
    label: {
      fontSize: "0.9rem",
      color: "#a1a1aa",
    },
    switch: (active) => ({
      width: "44px",
      height: "24px",
      borderRadius: "12px",
      backgroundColor: active ? "#22c55e" : "#3f3f46",
      display: "flex",
      alignItems: "center",
      padding: "2px",
      cursor: "pointer",
      transition: "background-color 0.2s ease",
    }),
    circle: (active) => ({
      width: "20px",
      height: "20px",
      borderRadius: "50%",
      backgroundColor: "#ffffff",
      transform: active ? "translateX(20px)" : "translateX(0)",
      transition: "transform 0.2s ease",
    }),
  };

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>Preferencias de Notificación</h3>

      <div style={styles.row}>
        <span style={styles.label}>Correos electrónicos</span>
        <div
          style={styles.switch(settings.email)}
          onClick={() => toggle("email")}
        >
          <div style={styles.circle(settings.email)} />
        </div>
      </div>

      <div style={styles.row}>
        <span style={styles.label}>Notificaciones Push</span>
        <div
          style={styles.switch(settings.push)}
          onClick={() => toggle("push")}
        >
          <div style={styles.circle(settings.push)} />
        </div>
      </div>

      <div style={{ ...styles.row, borderBottom: "none" }}>
        <span style={styles.label}>Novedades de la App</span>
        <div
          style={styles.switch(settings.updates)}
          onClick={() => toggle("updates")}
        >
          <div style={styles.circle(settings.updates)} />
        </div>
      </div>
    </div>
  );
}
