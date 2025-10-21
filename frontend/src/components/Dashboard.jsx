import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import MessageSenderNHL from "./MessageSenderNHL";
import MessageSender from "./MessageSender";
import MessageSenderNHL2 from "./MessageSenderNHL2";
import "./Dashboard.css";

const Dashboard = ({ user, onLogout }) => {
  // Estados principales
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({
    hasActiveQR: false,
    isConnected: false,
    qrInfo: null,
    connectionState: {},
  });
  const [notifications, setNotifications] = useState([]);
  const [qrString, setQrString] = useState("");
  const [sentMessages, setSentMessages] = useState([]);

  // Referencias
  const countdownRef = useRef(null);
  const socketRef = useRef(null);
  const apiBaseUrl =
    import.meta.env?.VITE_API_BASE_URL || "http://localhost:5111";
  const token = localStorage.getItem("token");

  // Formatear tiempo
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const timeString = `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;

    let className = "time-normal";
    if (seconds <= 10) className = "time-critical";
    else if (seconds <= 30) className = "time-warning";

    return { timeString, className };
  };

  // Agregar notificación
  const addNotification = (message, type = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; // ID más único
    setNotifications((prev) => [...prev, { id, message, type }]);

    // Auto-eliminar después de 5 segundos
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  };

  // Manejar mensaje enviado exitosamente
  const handleMessageSent = (messageData) => {
    setSentMessages((prev) => [messageData, ...prev.slice(0, 9)]); // Mantener solo los últimos 10
    addNotification(
      `Mensaje enviado exitosamente a ${messageData.phone}`,
      "success",
    );
  };

  const handleResetAuth = async (e) => {
    try {
      setLoading(true);

      // Llamada directa al backend
      const response = await fetch(`${apiBaseUrl}/api/auth/reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        addNotification("Carpeta Auth eliminada correctamente", "success");
        // Actualizar el estado después de eliminar auth
        setTimeout(() => {
          getStatus();
        }, 1000);
      } else {
        setError(data.message || "Error al eliminar la carpeta auth");
      }
    } catch (err) {
      console.log(err);
      setError(
        "Error de conexión. Verifica que el backend esté funcionando en el puerto 5111.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Verificar estado de auth
  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth-status`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        if (data.authStatus.exists) {
          addNotification(
            `Carpeta auth_info existe (${data.authStatus.details.size} bytes)`,
            "info",
          );
        } else {
          addNotification("Carpeta auth_info no existe", "warning");
        }
      } else {
        setError(data.message || "Error al verificar estado de auth");
      }
    } catch (err) {
      console.log(err);
      setError("Error de conexión al verificar estado de auth");
    }
  };

  // Conectar WebSocket
  const connectWebSocket = useCallback(() => {
    if (!token || socketRef.current?.connected) return;

    try {
      console.log("🔌 Conectando WebSocket...");

      const socket = io(apiBaseUrl, {
        auth: { token: token },
        reconnectionAttempts: 5,
        reconnectionDelay: 2000, // Aumentado a 2 segundos
        reconnectionDelayMax: 5000,
        maxReconnectionAttempts: 3,
        timeout: 10000,
        transports: ["websocket"],
        forceNew: true, // Fuerza una nueva conexión
      });

      socket.on("connect", () => {
        console.log("✅ WebSocket conectado");
        addNotification("Conexión en tiempo real establecida", "success");
      });

      socket.on("disconnect", (reason) => {
        console.log("❌ WebSocket desconectado:", reason);

        // NO reconectes automáticamente - deja que socket.io maneje esto
        // Solo notifica al usuario
        if (reason === "io server disconnect") {
          addNotification("Servidor desconectado", "warning");
        } else if (reason === "io client disconnect") {
          addNotification("Desconectado por cliente", "info");
        } else {
          addNotification("Conexión perdida", "warning");
        }
      });

      socket.on("reconnect", (attemptNumber) => {
        console.log("🔄 Reconectado después de", attemptNumber, "intentos");
        addNotification("Reconectado exitosamente", "success");
      });

      socket.on("reconnect_error", (error) => {
        console.error("❌ Error de reconexión:", error);
        addNotification("Error al reconectar", "error");
      });

      socket.on("reconnect_failed", () => {
        console.error("❌ Falló la reconexión después de todos los intentos");
        addNotification("No se pudo reconectar. Recarga la página.", "error");
      });

      socket.on("connect_error", (err) => {
        console.error("❌ Error de conexión WebSocket:", err.message);
        addNotification(`Error de conexión: ${err.message}`, "error");
      });

      socket.on("qr-status-update", (status) => {
        console.log("📊 Actualización de estado:", status);
        handleStatusUpdate(status);
      });

      socketRef.current = socket;
    } catch (error) {
      console.error("❌ Error al conectar WebSocket:", error);
      addNotification("Error al conectar con el servidor", "error");
    }
  }, [token, apiBaseUrl]);

  // Desconectar WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners(); // Limpia todos los listeners
      socketRef.current.disconnect();
      socketRef.current = null;
      console.log("❌ WebSocket desconectado y limpiado");
    }
  }, []);

  // Manejar actualizaciones de estado
  const handleStatusUpdate = useCallback((data) => {
    console.log("📊 Actualizando estado:", data);

    setConnectionStatus((prev) => ({
      ...prev,
      hasActiveQR: data.hasActiveQR || false,
      isConnected: data.isConnected || false,
      qrInfo: data.qrData || null,
      connectionState: data.connectionState || {},
    }));

    setTokenExpired(false);
    setError("");

    if (data.qrData?.image) {
      setQrData({
        qrCode: data.qrData.image,
        expiresAt: data.qrData.expiresAt,
        createdAt: data.qrData.createdAt,
      });

      const now = Date.now();
      const expiresAt = new Date(data.qrData.expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));

      console.log(`⏰ Tiempo restante calculado: ${remaining}s`);
      setTimeRemaining(remaining);

      if (remaining > 0) {
        startCountdown(remaining);
      } else {
        stopCountdown();
        setQrData(null);
      }
    } else {
      setQrData(null);
      stopCountdown();
      setTimeRemaining(0);
    }
  }, []);

  // Llamadas API reales
  const apiCall = useCallback(
    async (endpoint, options = {}) => {
      if (!token) {
        setTokenExpired(true);
        setError("No hay token de autenticación");
        throw new Error("No token available");
      }

      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${apiBaseUrl}${endpoint}`, {
          method: options.method || "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
        });

        if (response.status === 401) {
          setTokenExpired(true);
          throw new Error("Token expirado");
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Error en la solicitud");
        }

        return data;
      } catch (error) {
        console.error(`❌ Error en API ${endpoint}:`, error);
        setError(error.message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [token, apiBaseUrl],
  );

  // Solicitar nuevo QR
  const requestNewQR = useCallback(async () => {
    try {
      const result = await apiCall("/api/qr-request", { method: "POST" });

      if (result.success && result.currentStatus) {
        // Actualizar el estado inmediatamente con la respuesta del servidor
        handleStatusUpdate(result.currentStatus);
        addNotification("Nuevo QR solicitado correctamente", "success");

        // Si el QR está procesándose, hacer polling cada 2 segundos hasta que se genere
        if (result.status === "processing") {
          const pollInterval = setInterval(async () => {
            try {
              const status = await apiCall("/api/qr-status");
              if (status.hasActiveQR && status.qrData) {
                handleStatusUpdate(status);
                clearInterval(pollInterval);
                addNotification("QR generado exitosamente", "success");
              }
            } catch (error) {
              console.error("Error polling QR status:", error);
              clearInterval(pollInterval);
            }
          }, 2000);

          // Limpiar el intervalo después de 30 segundos para evitar polling infinito
          setTimeout(() => {
            clearInterval(pollInterval);
          }, 30000);
        }
      } else {
        addNotification(
          "QR solicitado, pero no se pudo obtener el estado actual",
          "warning",
        );
      }
    } catch (error) {
      addNotification(`Error al solicitar QR: ${error.message}`, "error");
    }
  }, [apiCall, handleStatusUpdate]);

  // Expirar QR manualmente
  const expireQR = useCallback(async () => {
    try {
      await apiCall("/api/qr-expire", { method: "POST" });
      addNotification("QR expirado manualmente", "success");
    } catch (error) {
      addNotification(`Error al expirar QR: ${error.message}`, "error");
    }
  }, [apiCall]);

  // Obtener estado actual
  const getStatus = useCallback(async () => {
    try {
      const status = await apiCall("/api/qr-status");
      handleStatusUpdate(status);
      addNotification("Estado actualizado", "info");
    } catch (error) {
      addNotification(`Error al obtener estado: ${error.message}`, "error");
    }
  }, [apiCall, handleStatusUpdate]);

  // Iniciar contador
  const startCountdown = (initialTime) => {
    stopCountdown();

    if (initialTime <= 0) return;

    setTimeRemaining(initialTime);

    countdownRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = prev - 1;

        if (newTime <= 0) {
          stopCountdown();
          setQrData(null);
          return 0;
        }
        return newTime;
      });
    }, 1000);
  };

  // Detener contador
  const stopCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  // Efecto para conexión inicial
  useEffect(() => {
    let mounted = true;

    const initializeConnection = async () => {
      if (!mounted) return;

      connectWebSocket();

      // Pequeño delay antes de obtener el estado inicial
      setTimeout(() => {
        if (mounted) {
          getStatus();
        }
      }, 1000);
    };

    initializeConnection();

    return () => {
      mounted = false;
      disconnectWebSocket();
      stopCountdown();
    };
  }, []);

  // Efecto para manejar cambios en el QR
  useEffect(() => {
    if (qrData?.qrCode) {
      // Extraer el string del QR de la URL de datos
      const match = qrData.qrCode.match(/data:image\/[^;]+;base64,[^"]+/);
      if (match) {
        setQrString(match[0]);
      }
    }
  }, [qrData]);

  // Renderizar notificaciones
  const renderNotifications = () => (
    <div className="notifications-container">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification ${notification.type}`}
        >
          {notification.message}
        </div>
      ))}
    </div>
  );

  // Renderizar contenido principal
  const renderContent = () => {
    if (loading) {
      return (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando...</p>
        </div>
      );
    }

    if (tokenExpired) {
      return (
        <div className="status-card error">
          <h3>Sesión Expirada</h3>
          <p>Su sesión ha expirado. Por favor, inicie sesión nuevamente.</p>
          <button onClick={onLogout} className="btn btn-primary">
            Volver a Iniciar Sesión
          </button>
        </div>
      );
    }

    if (connectionStatus.isConnected) {
      return (
        <div className="status-card connected">
          <h3>✅ WhatsApp Conectado</h3>
          <p>
            La conexión con WhatsApp está activa y funcionando correctamente.
          </p>
          <div className="connection-details">
            <p>
              <strong>Estado:</strong> Conectado
            </p>
            <p>
              <strong>Última actualización:</strong>{" "}
              {new Date().toLocaleTimeString()}
            </p>
          </div>
          <button onClick={getStatus} className="btn btn-secondary">
            Actualizar Estado
          </button>
          <button onClick={handleResetAuth} className="btn btn-secondary">
            Eliminar Auth_info
          </button>
          <button onClick={checkAuthStatus} className="btn btn-secondary">
            Verificar Auth
          </button>
        </div>
      );
    }

    if (qrData) {
      const { timeString, className } = formatTime(timeRemaining);

      return (
        <div className="qr-container">
          <div className="qr-display">
            {qrString ? (
              <img src={qrString} />
            ) : (
              <div className="qr-placeholder">
                <p>Cargando código QR...</p>
              </div>
            )}

            <div className={`qr-timer ${className}`}>{timeString}</div>
          </div>

          <div className="qr-controls">
            <div className="qr-info">
              <p>
                <strong>Expira:</strong>{" "}
                {new Date(qrData.expiresAt).toLocaleTimeString()}
              </p>
              <p>
                <strong>Generado:</strong>{" "}
                {new Date(qrData.createdAt).toLocaleTimeString()}
              </p>
            </div>

            <div className="qr-actions">
              <button onClick={expireQR} className="btn btn-danger">
                Expirar QR
              </button>
              <button onClick={getStatus} className="btn btn-secondary">
                Actualizar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="status-card disconnected">
        <h3>❌ WhatsApp Desconectado</h3>
        <p>No hay una conexión activa con WhatsApp.</p>
        <button
          onClick={requestNewQR}
          className="btn btn-primary"
          disabled={loading}
        >
          Generar Nuevo QR
        </button>
      </div>
    );
  };

  return (
    <div className="dashboard-container">
      {renderNotifications()}

      <header className="dashboard-header">
        <div className="header-content">
          <h1>WhatsApp Service Dashboard</h1>
          <div className="user-info">
            <span>
              {user?.username} ({user?.role})
            </span>
            <button onClick={onLogout} className="btn btn-logout">
              Cerrar Sesión
            </button>
          </div>
        </div>

        <div className="connection-status">
          <span
            className={`status-indicator ${connectionStatus.isConnected ? "connected" : "disconnected"}`}
          >
            {connectionStatus.isConnected ? "✅ Conectado" : "❌ Desconectado"}
          </span>
          <span className="socket-status">
            {socketRef.current?.connected ? "🟢 WebSocket" : "🔴 WebSocket"}
          </span>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-grid">
          {/* Sección QR y Estado */}
          <div className="dashboard-column">
            <section className="qr-section">
              <h2>Autenticación WhatsApp</h2>
              <div className="qr-instructions">
                <ol>
                  <li>Abre WhatsApp en tu teléfono</li>
                  <li>Ve a Configuración → Dispositivos vinculados</li>
                  <li>Toca "Vincular un dispositivo"</li>
                  <li>Escanea el código QR mostrado</li>
                </ol>
              </div>

              <div className="qr-content">{renderContent()}</div>
            </section>

            <section className="status-section">
              <h2>Estado del Servicio</h2>
              <div className="status-details">
                <div className="status-item">
                  <span>Conexión WhatsApp:</span>
                  <span
                    className={
                      connectionStatus.isConnected
                        ? "connected"
                        : "disconnected"
                    }
                  >
                    {connectionStatus.isConnected ? "Activa" : "Inactiva"}
                  </span>
                </div>

                <div className="status-item">
                  <span>Estado QR:</span>
                  <span>
                    {connectionStatus.hasActiveQR ? "Activo" : "Inactivo"}
                  </span>
                </div>

                <div className="status-item">
                  <span>Tiempo restante:</span>
                  <span>{formatTime(timeRemaining).timeString}</span>
                </div>

                <div className="status-item">
                  <span>Socket:</span>
                  <span
                    className={
                      socketRef.current?.connected
                        ? "connected"
                        : "disconnected"
                    }
                  >
                    {socketRef.current?.connected
                      ? "Conectado"
                      : "Desconectado"}
                  </span>
                </div>
              </div>

              <div className="status-actions">
                <button onClick={getStatus} className="btn btn-secondary">
                  Actualizar Estado
                </button>
                <button onClick={handleResetAuth} className="btn btn-secondary">
                  Eliminar Auth
                </button>
                <button onClick={checkAuthStatus} className="btn btn-secondary">
                  Verificar Auth
                </button>
              </div>
            </section>
          </div>

          {/* Sección Mensajes */}
          <div className="dashboard-column">
            {/* Envío de mensajes */}
            {connectionStatus.isConnected && (
              <MessageSenderNHL2
                isConnected={connectionStatus.isConnected}
                onMessageSent={handleMessageSent}
              />
            )}

            {/* Mensajes enviados */}
            {sentMessages.length > 0 && (
              <section className="sent-messages-section">
                <h2>📤 Mensajes Enviados Recientemente</h2>
                <div className="sent-messages-list">
                  {sentMessages.map((message, index) => (
                <div key={index} className="sent-message-item">
                  <div className="message-header">
                    <span className="cliente"> 🙍Cliente: {message.nombre}</span>
                    <span className="phone-number">📱Teléfono: {message.phone}</span>
                  </div>
                  <div className="message-details">
                    <span className="sent-time">🕐 {new Date(message.sentAt).toLocaleString()}</span>
                  </div>
                  <div className="message-preview">
                    👋 Hola {message.nombre}, te saluda NHL Decoración Comercial.
                    💬 Mensaje:{message.mensaje}
                  </div>
                </div>
              ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>

      <footer className="dashboard-footer">
        <p>WhatsApp Service v1.0 - {new Date().toLocaleString()}</p>
      </footer>
    </div>
  );
};

export default Dashboard;
