import { useState, useEffect } from "react";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import "./App.css";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthStatus = () => {
      const token = localStorage.getItem("token");
      const userData = localStorage.getItem("user");

      if (token && userData) {
        try {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
          setIsAuthenticated(true);
        } catch (error) {
          console.log(error);
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setIsAuthenticated(false);
          setUser(null);
        }
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
      setIsLoading(false);
    };

    checkAuthStatus();
  }, []);

  const handleLoginSuccess = (loginData) => {
    // Asegurar que los datos se guarden correctamente
    const userData = {
      username:
        loginData.username ||
        loginData.user?.username ||
        loginData.user?.username,
      role: loginData.role,
    };

    // Guardar en localStorage primero
    localStorage.setItem("user", JSON.stringify(userData));

    // Luego actualizar el estado
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    // Limpiar estado primero
    setIsLoading(true);
    setIsAuthenticated(false);
    setUser(null);

    // Limpiar localStorage
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    // Forzar un pequeño delay para evitar parpadeo y luego resetear loading
    setTimeout(() => {
      setIsLoading(false);
    }, 100);
  };

  // Mostrar loading mientras se verifica la autenticación
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontSize: "18px",
        }}
      >
        Cargando...
      </div>
    );
  }

  if (isAuthenticated && user) {
    return <Dashboard user={user} onLogout={handleLogout} />;
  }

  return <Login onLoginSuccess={handleLoginSuccess} />;
}

export default App;
