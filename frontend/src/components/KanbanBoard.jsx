import React, { useState } from "react";

// Datos iniciales organizados por columnas
const initialColumns = {
  todo: {
    title: "📝 Por Hacer",
    taskIds: ["task-1", "task-2", "task-3"],
  },
  inProgress: {
    title: "🚀 En Progreso",
    taskIds: ["task-4"],
  },
  done: {
    title: "✅ Completado",
    taskIds: ["task-5"],
  },
};

const initialTasks = {
  "task-1": {
    id: "task-1",
    title: "Diseñar interfaz en Figma",
    priority: "Alta",
    tag: "UI/UX",
  },
  "task-2": {
    id: "task-2",
    title: "Configurar rutas con React Router",
    priority: "Media",
    tag: "Frontend",
  },
  "task-3": {
    id: "task-3",
    title: "Escribir pruebas unitarias",
    priority: "Baja",
    tag: "Testing",
  },
  "task-4": {
    id: "task-4",
    title: "Implementar ramas en Git",
    priority: "Alta",
    tag: "DevOps",
  },
  "task-5": {
    id: "task-5",
    title: "Estructura inicial del proyecto",
    priority: "Media",
    tag: "Setup",
  },
};

export default function KanbanBoard() {
  const [columns, setColumns] = useState(initialColumns);
  const [tasks, setTasks] = useState(initialTasks);
  const [newTaskText, setNewTaskText] = useState("");
  const [newPriority, setNewPriority] = useState("Media");
  const [newTag, setNewTag] = useState("General");

  // Función para mover tareas entre columnas de forma cíclica (Todo -> InProgress -> Done -> Todo)
  const moveTask = (taskId, currentColumnKey) => {
    let nextColumnKey = "todo";
    if (currentColumnKey === "todo") nextColumnKey = "inProgress";
    else if (currentColumnKey === "inProgress") nextColumnKey = "done";
    else if (currentColumnKey === "done") nextColumnKey = "todo";

    setColumns((prev) => {
      const sourceTaskIds = prev[currentColumnKey].taskIds.filter(
        (id) => id !== taskId,
      );
      const destTaskIds = [...prev[nextColumnKey].taskIds, taskId];

      return {
        ...prev,
        [currentColumnKey]: {
          ...prev[currentColumnKey],
          taskIds: sourceTaskIds,
        },
        [nextColumnKey]: { ...prev[nextColumnKey], taskIds: destTaskIds },
      };
    });
  };

  // Función para añadir una nueva tarea a la columna "Por Hacer"
  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    const newId = `task-${Date.now()}`;
    const newTaskObject = {
      id: newId,
      title: newTaskText,
      priority: newPriority,
      tag: newTag,
    };

    setTasks((prev) => ({ ...prev, [newId]: newTaskObject }));
    setColumns((prev) => ({
      ...prev,
      todo: { ...prev.todo, taskIds: [...prev.todo.taskIds, newId] },
    }));

    setNewTaskText("");
  };

  // Estilos inline centralizados
  const styles = {
    container: {
      maxWidth: "1000px",
      margin: "30px auto",
      padding: "24px",
      borderRadius: "16px",
      backgroundColor: "#0f172a",
      color: "#f8fafc",
      fontFamily: "Segoe UI, system-ui, sans-serif",
      boxShadow: "0 12px 35px rgba(0,0,0,0.45)",
      border: "1px solid #1e293b",
    },
    header: {
      marginBottom: "20px",
      borderBottom: "1px solid #1e293b",
      paddingBottom: "12px",
    },
    title: {
      fontSize: "1.5rem",
      fontWeight: "700",
      margin: 0,
    },
    form: {
      display: "flex",
      gap: "10px",
      marginBottom: "24px",
      flexWrap: "wrap",
      backgroundColor: "#1e293b",
      padding: "16px",
      borderRadius: "12px",
      border: "1px solid #334155",
    },
    input: {
      flex: 2,
      minWidth: "220px",
      padding: "10px 14px",
      borderRadius: "8px",
      border: "1px solid #475569",
      backgroundColor: "#0f172a",
      color: "#ffffff",
      fontSize: "0.9rem",
      outline: "none",
    },
    select: {
      flex: 1,
      minWidth: "120px",
      padding: "10px 14px",
      borderRadius: "8px",
      border: "1px solid #475569",
      backgroundColor: "#0f172a",
      color: "#ffffff",
      fontSize: "0.9rem",
      outline: "none",
    },
    button: {
      padding: "10px 20px",
      borderRadius: "8px",
      backgroundColor: "#3b82f6",
      color: "#ffffff",
      border: "none",
      fontWeight: "600",
      cursor: "pointer",
    },
    boardGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
      gap: "20px",
    },
    column: {
      backgroundColor: "#1e293b",
      borderRadius: "12px",
      padding: "16px",
      border: "1px solid #334155",
      display: "flex",
      flexDirection: "column",
      minHeight: "350px",
    },
    columnTitle: {
      fontSize: "1.1rem",
      fontWeight: "600",
      margin: "0 0 16px 0",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    counterBadge: {
      backgroundColor: "#0f172a",
      padding: "2px 8px",
      borderRadius: "12px",
      fontSize: "0.75rem",
      color: "#94a3b8",
    },
    taskList: {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      flex: 1,
    },
    taskCard: {
      backgroundColor: "#0f172a",
      padding: "14px",
      borderRadius: "8px",
      border: "1px solid #334155",
      boxShadow: "0 4px 6px rgba(0,0,0,0.2)",
    },
    taskHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "8px",
    },
    tag: {
      fontSize: "0.7rem",
      fontWeight: "600",
      padding: "2px 8px",
      borderRadius: "6px",
      backgroundColor: "#1e293b",
      color: "#38bdf8",
      border: "1px solid #334155",
    },
    priority: (prio) => ({
      fontSize: "0.7rem",
      fontWeight: "600",
      color:
        prio === "Alta" ? "#f87171" : prio === "Media" ? "#fbbf24" : "#34d399",
    }),
    taskTitleText: {
      fontSize: "0.9rem",
      color: "#e2e8f0",
      margin: "0 0 12px 0",
      lineHeight: "1.4",
    },
    moveBtn: {
      width: "100%",
      padding: "6px",
      backgroundColor: "#334155",
      color: "#f8fafc",
      border: "none",
      borderRadius: "6px",
      fontSize: "0.75rem",
      fontWeight: "600",
      cursor: "pointer",
      transition: "background 0.2s",
    },
  };

  return (
    <div style={styles.container}>
      {/* Encabezado */}
      <div style={styles.header}>
        <h2 style={styles.title}>Tablero Kanban de Proyecto</h2>
      </div>

      {/* Formulario para agregar tarea */}
      <form onSubmit={handleAddTask} style={styles.form}>
        <input
          type="text"
          placeholder="Título de la nueva tarea..."
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          style={styles.input}
        />
        <select
          value={newPriority}
          onChange={(e) => setNewPriority(e.target.value)}
          style={styles.select}
        >
          <option value="Alta">Prioridad Alta</option>
          <option value="Media">Prioridad Media</option>
          <option value="Baja">Prioridad Baja</option>
        </select>
        <select
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          style={styles.select}
        >
          <option value="General">General</option>
          <option value="UI/UX">UI/UX</option>
          <option value="Frontend">Frontend</option>
          <option value="Backend">Backend</option>
          <option value="DevOps">DevOps</option>
        </select>
        <button type="submit" style={styles.button}>
          Añadir Tarea
        </button>
      </form>

      {/* Columnas del Kanban */}
      <div style={styles.boardGrid}>
        {Object.entries(columns).map(([colKey, column]) => (
          <div key={colKey} style={styles.column}>
            <h3 style={styles.columnTitle}>
              <span>{column.title}</span>
              <span style={styles.counterBadge}>{column.taskIds.length}</span>
            </h3>

            <div style={styles.taskList}>
              {column.taskIds.map((taskId) => {
                const task = tasks[taskId];
                if (!task) return null;

                return (
                  <div key={task.id} style={styles.taskCard}>
                    <div style={styles.taskHeader}>
                      <span style={styles.tag}>{task.tag}</span>
                      <span style={styles.priority(task.priority)}>
                        {task.priority}
                      </span>
                    </div>
                    <p style={styles.taskTitleText}>{task.title}</p>
                    <button
                      style={styles.moveBtn}
                      onClick={() => moveTask(task.id, colKey)}
                    >
                      Mover ➔
                    </button>
                  </div>
                );
              })}
              {column.taskIds.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    color: "#64748b",
                    fontSize: "0.85rem",
                    marginTop: "40px",
                  }}
                >
                  Sin tareas en esta columna
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
