import React, { useState } from "react";

// Datos de prueba (Mock Data)
const initialTransactions = [
  {
    id: "TX-1001",
    date: "2026-10-12",
    description: "Suscripción GitHub Copilot",
    category: "Software",
    amount: -10.0,
    status: "Completado",
  },
  {
    id: "TX-1002",
    date: "2026-10-14",
    description: "Pago de Cliente - Proyecto Web",
    category: "Ingresos",
    amount: 450.0,
    status: "Completado",
  },
  {
    id: "TX-1003",
    date: "2026-10-15",
    description: "Servidores Vercel Pro",
    category: "Infraestructura",
    amount: -20.0,
    status: "Pendiente",
  },
  {
    id: "TX-1004",
    date: "2026-10-16",
    description: "Compra Dominios .com",
    category: "Infraestructura",
    amount: -35.5,
    status: "Completado",
  },
  {
    id: "TX-1005",
    date: "2026-10-16",
    description: "Reembolso Servicio Cloud",
    category: "Ingresos",
    amount: 15.0,
    status: "Completado",
  },
];

export default function TransactionHistoryTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("Todas");
  const [selectedTx, setSelectedTx] = useState(null);

  // Filtrado dinámico según búsqueda y categoría
  const filteredTransactions = initialTransactions.filter((tx) => {
    const matchesSearch =
      tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      filterCategory === "Todas" || tx.category === filterCategory;

    return matchesSearch && matchesCategory;
  });

  // Cálculo de totales
  const totalBalance = initialTransactions.reduce(
    (acc, curr) => acc + curr.amount,
    0,
  );

  // Estilos inline centralizados
  const styles = {
    container: {
      maxWidth: "850px",
      margin: "30px auto",
      padding: "24px",
      borderRadius: "16px",
      backgroundColor: "#0f172a",
      color: "#f8fafc",
      fontFamily: "Segoe UI, system-ui, sans-serif",
      boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
      border: "1px solid #1e293b",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "24px",
      flexWrap: "wrap",
      gap: "12px",
    },
    title: {
      fontSize: "1.4rem",
      fontWeight: "700",
      margin: 0,
    },
    balanceCard: {
      backgroundColor: "#1e293b",
      padding: "8px 16px",
      borderRadius: "8px",
      border: "1px solid #334155",
      fontSize: "0.9rem",
    },
    balanceValue: {
      fontWeight: "bold",
      color: totalBalance >= 0 ? "#4ade80" : "#f87171",
    },
    toolbar: {
      display: "flex",
      gap: "12px",
      marginBottom: "20px",
      flexWrap: "wrap",
    },
    input: {
      flex: 2,
      minWidth: "200px",
      padding: "10px 14px",
      borderRadius: "8px",
      border: "1px solid #334155",
      backgroundColor: "#1e293b",
      color: "#ffffff",
      fontSize: "0.9rem",
      outline: "none",
    },
    select: {
      flex: 1,
      minWidth: "140px",
      padding: "10px 14px",
      borderRadius: "8px",
      border: "1px solid #334155",
      backgroundColor: "#1e293b",
      color: "#ffffff",
      fontSize: "0.9rem",
      outline: "none",
    },
    tableWrapper: {
      overflowX: "auto",
      borderRadius: "8px",
      border: "1px solid #1e293b",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      textAlign: "left",
      fontSize: "0.9rem",
    },
    th: {
      backgroundColor: "#1e293b",
      color: "#94a3b8",
      padding: "12px 16px",
      fontWeight: "600",
      borderBottom: "1px solid #334155",
    },
    tr: {
      borderBottom: "1px solid #1e293b",
      transition: "background 0.2s",
      cursor: "pointer",
    },
    td: {
      padding: "12px 16px",
      color: "#e2e8f0",
    },
    amount: (value) => ({
      fontWeight: "600",
      color: value > 0 ? "#4ade80" : "#f87171",
    }),
    badge: (status) => ({
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: "12px",
      fontSize: "0.75rem",
      fontWeight: "600",
      backgroundColor: status === "Completado" ? "#064e3b" : "#78350f",
      color: status === "Completado" ? "#34d399" : "#fbbf24",
    }),
    modalOverlay: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.75)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    },
    modalContent: {
      backgroundColor: "#1e293b",
      padding: "24px",
      borderRadius: "12px",
      maxWidth: "400px",
      width: "90%",
      border: "1px solid #475569",
      color: "#ffffff",
    },
    closeBtn: {
      marginTop: "20px",
      width: "100%",
      padding: "10px",
      backgroundColor: "#3b82f6",
      color: "#ffffff",
      border: "none",
      borderRadius: "8px",
      fontWeight: "600",
      cursor: "pointer",
    },
  };

  return (
    <div style={styles.container}>
      {/* Encabezado */}
      <div style={styles.header}>
        <h2 style={styles.title}>Historial de Transacciones</h2>
        <div style={styles.balanceCard}>
          Balance Total:{" "}
          <span style={styles.balanceValue}>${totalBalance.toFixed(2)}</span>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div style={styles.toolbar}>
        <input
          type="text"
          placeholder="Buscar por ID o descripción..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.input}
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          style={styles.select}
        >
          <option value="Todas">Todas las categorías</option>
          <option value="Software">Software</option>
          <option value="Ingresos">Ingresos</option>
          <option value="Infraestructura">Infraestructura</option>
        </select>
      </div>

      {/* Tabla */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>Fecha</th>
              <th style={styles.th}>Descripción</th>
              <th style={styles.th}>Categoría</th>
              <th style={styles.th}>Monto</th>
              <th style={styles.th}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map((tx) => (
                <tr
                  key={tx.id}
                  style={styles.tr}
                  onClick={() => setSelectedTx(tx)}
                >
                  <td style={styles.td}>
                    <code>{tx.id}</code>
                  </td>
                  <td style={styles.td}>{tx.date}</td>
                  <td style={styles.td}>{tx.description}</td>
                  <td style={styles.td}>{tx.category}</td>
                  <td style={{ ...styles.td, ...styles.amount(tx.amount) }}>
                    {tx.amount > 0
                      ? `+$${tx.amount.toFixed(2)}`
                      : `-$${Math.abs(tx.amount).toFixed(2)}`}
                  </td>
                  <td style={styles.td}>
                    <span style={styles.badge(tx.status)}>{tx.status}</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="6"
                  style={{
                    ...styles.td,
                    textAlign: "center",
                    padding: "24px",
                    color: "#94a3b8",
                  }}
                >
                  No se encontraron transacciones.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Detalle */}
      {selectedTx && (
        <div style={styles.modalOverlay} onClick={() => setSelectedTx(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: "16px" }}>
              Detalles de Transacción
            </h3>
            <p>
              <strong>ID:</strong> {selectedTx.id}
            </p>
            <p>
              <strong>Fecha:</strong> {selectedTx.date}
            </p>
            <p>
              <strong>Descripción:</strong> {selectedTx.description}
            </p>
            <p>
              <strong>Categoría:</strong> {selectedTx.category}
            </p>
            <p>
              <strong>Monto:</strong> ${selectedTx.amount.toFixed(2)}
            </p>
            <p>
              <strong>Estado:</strong> {selectedTx.status}
            </p>
            <button style={styles.closeBtn} onClick={() => setSelectedTx(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
