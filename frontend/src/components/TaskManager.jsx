import React, { useState } from "react";

export default function TaskManager() {
  const [tasks, setTasks] = useState([
    { id: 1, text: "Configurar repositorio en Git", completed: true },
    { id: 2, text: "Crear componentes base en React", completed: false },
  ]);
  const [inputText, setInputText] = useState("");

  const addTask = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setTasks([...tasks, { id: Date.now(), text: inputText, completed: false }]);
    setInputText("");
  };

  const toggleTask = (id) => {
    setTasks(
      tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );
  };

  const deleteTask = (id) => {
    setTasks(tasks.filter((t) => t.id !== id));
  };

  const styles = {
    card: {
      maxWidth: "400px",
      margin: "20px auto",
      padding: "24px",
      borderRadius: "12px",
      backgroundColor: "#0f172a",
      color: "#f8fafc",
      fontFamily: "system-ui, sans-serif",
      boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
      border: "1px solid #1e293b",
    },
    form: {
      display: "flex",
      gap: "8px",
      marginBottom: "16px",
    },
    input: {
      flex: 1,
      padding: "10px",
      borderRadius: "8px",
      border: "1px solid #334155",
      backgroundColor: "#1e293b",
      color: "#fff",
      outline: "none",
    },
    button: {
      padding: "10px 16px",
      borderRadius: "8px",
      backgroundColor: "#3b82f6",
      color: "#fff",
      border: "none",
      fontWeight: "600",
      cursor: "pointer",
    },
    list: {
      listStyle: "none",
      padding: 0,
      margin: 0,
    },
    item: (completed) => ({
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "10px 12px",
      marginBottom: "8px",
      borderRadius: "8px",
      backgroundColor: "#1e293b",
      textDecoration: completed ? "line-through" : "none",
      color: completed ? "#94a3b8" : "#f8fafc",
    }),
    deleteBtn: {
      background: "none",
      border: "none",
      color: "#f87171",
      cursor: "pointer",
      fontWeight: "bold",
    },
  };

  return (
    <div style={styles.card}>
      <h3 style={{ marginTop: 0, marginBottom: "16px" }}>
        Mis Tareas Pendientes
      </h3>
      <form onSubmit={addTask} style={styles.form}>
        <input
          type="text"
          placeholder="Nueva tarea..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          style={styles.input}
        />
        <button type="submit" style={styles.button}>
          Añadir
        </button>
      </form>
      <ul style={styles.list}>
        {tasks.map((task) => (
          <li key={task.id} style={styles.item(task.completed)}>
            <span
              onClick={() => toggleTask(task.id)}
              style={{ cursor: "pointer", flex: 1 }}
            >
              {task.text}
            </span>
            <button
              style={styles.deleteBtn}
              onClick={() => deleteTask(task.id)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
