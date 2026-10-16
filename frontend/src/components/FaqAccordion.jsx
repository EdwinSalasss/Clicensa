import React, { useState } from "react";

const faqData = [
  {
    q: "¿Cómo creo una rama en Git?",
    a: "Puedes usar el comando git switch -c nombre-de-la-rama.",
  },
  {
    q: "¿Afecta la rama principal al crear una nueva?",
    a: "No, la rama principal se mantiene completamente aislada hasta que decidas hacer un merge.",
  },
  {
    q: "¿Cómo subo mi rama al repositorio remoto?",
    a: "Utiliza el comando git push -u origin nombre-de-la-rama la primera vez.",
  },
];

export default function FaqAccordion() {
  const [activeIndex, setActiveIndex] = useState(null);

  const toggleAccordion = (index) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  const styles = {
    card: {
      maxWidth: "420px",
      margin: "20px auto",
      padding: "24px",
      borderRadius: "12px",
      backgroundColor: "#0f172a",
      color: "#f8fafc",
      fontFamily: "system-ui, sans-serif",
      border: "1px solid #1e293b",
      boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
    },
    item: {
      marginBottom: "10px",
      borderBottom: "1px solid #1e293b",
      paddingBottom: "10px",
    },
    question: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      cursor: "pointer",
      fontWeight: "600",
      fontSize: "0.95rem",
      color: "#e2e8f0",
    },
    answer: {
      marginTop: "8px",
      fontSize: "0.85rem",
      color: "#94a3b8",
      lineHeight: "1.4",
    },
  };

  return (
    <div style={styles.card}>
      <h3 style={{ marginTop: 0, marginBottom: "16px" }}>
        Preguntas Frecuentes (FAQ)
      </h3>
      {faqData.map((item, index) => (
        <div key={index} style={styles.item}>
          <div style={styles.question} onClick={() => toggleAccordion(index)}>
            <span>{item.q}</span>
            <span>{activeIndex === index ? "▲" : "▼"}</span>
          </div>
          {activeIndex === index && <div style={styles.answer}>{item.a}</div>}
        </div>
      ))}
    </div>
  );
}
