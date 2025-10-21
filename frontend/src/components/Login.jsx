import { useState, useEffect } from "react";
import "./Login.css";

const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL || "http://localhost:5111";

const Login = ({ onLoginSuccess }) => {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Limpiar estado cuando el componente se monta
  useEffect(() => {
    setLoading(false);
    setError("");
    setFormData({
      username: "",
      password: "",
    });
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Limpiar error cuando el usuario empiece a escribir
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validación básica antes de enviar
    if (!formData.username.trim() || !formData.password.trim()) {
      setError("Por favor completa todos los campos");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Llamada directa al backend
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        // Guardar el token en localStorage primero
        localStorage.setItem("token", data.token);

        // Preparar los datos del usuario
        const userData = {
          username: formData.username,
          role: data.role || "user", // valor por defecto si no viene role
        };

        // Guardar los datos del usuario
        localStorage.setItem("user", JSON.stringify(userData));

        // Llamar a la función de éxito con los datos correctos
        onLoginSuccess({
          username: formData.username,
          role: data.role || "user",
          token: data.token,
        });
      } else {
        setError(data.message || "Error en el inicio de sesión");
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

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Iniciar Sesión</h1>
          <p>Ingresa tus credenciales para acceder</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Usuario</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Ingresa tu usuario"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Ingresa tu contraseña"
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="login-button"
            disabled={loading || !formData.username || !formData.password}
          >
            {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
