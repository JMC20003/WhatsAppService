import { useState } from 'react';
import './MessageSender.css';

const MessageSender = ({ isConnected, onMessageSent }) => {
  const [formData, setFormData] = useState({
    phone: '',
    nombre: '',
    templateOption: 'flyer_promocion',
    mensaje: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const apiBaseUrl = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:5111';
  const token = localStorage.getItem('token');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.phone.trim()) {
      setError('El número de teléfono es requerido');
      return false;
    }

    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      setError('El número de teléfono debe tener entre 10 y 15 dígitos');
      return false;
    }

    if (!formData.mensaje.trim()) {
      setError('El mensaje es requerido');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isConnected) {
      setError('Debes estar conectado a WhatsApp para enviar mensajes');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const bodyToSend = {
        phone: formData.phone,
        nombre: formData.nombre,
        mensaje: formData.mensaje,
        templateOption: formData.templateOption
      };

      const response = await fetch(`${apiBaseUrl}/api/send-messageNHL`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bodyToSend)
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          const errorMessages = data.errors.map(err => `${err.field}: ${err.message}`).join(', ');
          throw new Error(errorMessages);
        }
        throw new Error(data.message || 'Error al enviar mensaje');
      }

      setSuccess(`Mensaje enviado exitosamente a ${formData.phone}`);

      // reset
      setFormData({
        phone: '',
        nombre: '',
        templateOption: 'flyer_promocion',
        mensaje: ''
      });

      if (onMessageSent) {
        onMessageSent(data);
      }

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  return (
    <div className="message-sender">
      <h2>📢 Enviar Mensaje / Flyer a Cliente</h2>

      {!isConnected && (
        <div className="warning-message">
          ⚠️ Debes estar conectado a WhatsApp para enviar mensajes
        </div>
      )}

      {error && (
        <div className="error-message" onClick={clearMessages}>
          ❌ {error}
          <span className="close-btn">×</span>
        </div>
      )}

      {success && (
        <div className="success-message" onClick={clearMessages}>
          ✅ {success}
          <span className="close-btn">×</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="message-form">
        <div className="form-group">
        <label htmlFor="country">🌎 País</label>
        <select
            id="country"
            name="country"
            onChange={(e) => {
            // cuando cambie el país, rellenamos automáticamente el input phone con su código
            const code = e.target.value;
            setFormData(prev => ({
                ...prev,
                phone: code // reemplaza lo que haya en phone con el prefijo del país
            }));
            }}
            disabled={loading || !isConnected}
            //defaultValue="+51" // Perú por defecto
            required
        >
            <option value="">-- Selecciona un país --</option>
            <option value="+51">Perú (+51)</option>
            <option value="+34">España (+34)</option>
            <option value="+1">Estados Unidos (+1)</option>
            <option value="+55">Brasil (+55)</option>
            <option value="+57">Colombia (+57)</option>
            {/* agrega más países aquí */}
        </select>
        </div>

        <div className="form-group">
        <label htmlFor="phone">📞 Número de Teléfono *</label>
        <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange} // puedes seguir editándolo a mano
            placeholder="Ej: +51 987 654 321"
            disabled={loading || !isConnected}
            required
        />
        </div>

        <div className="form-group">
          <label htmlFor="nombre">🙍 Nombre del Cliente</label>
          <input
            type="text"
            id="nombre"
            name="nombre"
            value={formData.nombre}
            onChange={handleInputChange}
            placeholder="Nombre del cliente (obligatorio)"
            disabled={loading || !isConnected}
          />
        </div>

        <div className="form-group">
          <label htmlFor="mensaje">✍️ Mensaje *</label>
          <textarea
            id="mensaje"
            name="mensaje"
            value={formData.mensaje}
            onChange={handleInputChange}
            placeholder="Escribe aquí el mensaje..."
            rows={5}
            disabled={loading || !isConnected}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="templateOption">📝 Flayer</label>
          <select
            id="templateOption"
            name="templateOption"
            value={formData.templateOption}
            onChange={handleInputChange}
            disabled={loading || !isConnected}
          >
            <option value="">-- Selecciona un Flyer --</option>
            <option value="Bar">Flyer Bar</option>
            <option value="Cevicheria">Flyer Cevichería</option>
            <option value="ClinicaDental">Flyer Clínica Dental</option>
            <option value="Departamento">Flyer Departamento</option>
            <option value="Discoteca">Flyer Discoteca</option>
            <option value="DisenoInterior">Flyer Diseño Interior</option>
            <option value="DormitorioPersonalizado">Flyer Dormitorio Personalizado</option>
            <option value="EspacioIndustrialUrbano">Flyer Espacio Industrial Urbano</option>
            <option value="FastFood">Flyer Fast Food</option>
            <option value="FuenteSoda">Flyer Fuente Soda</option>
            <option value="Gimnasio">Flyer Gimnasio</option>
            <option value="Heladeria">Flyer Heladería</option>
            <option value="Hoteles">Flyer Hoteles</option>
            <option value="Minimarket">Flyer Minimarket</option>
            <option value="PanaderiaArtesanal">Flyer Panadería Artesanal</option>
            <option value="Pizzeria">Flyer Pizzería</option>
            <option value="Polleria">Flyer Pollería</option>
            <option value="Recepciones">Flyer Recepciones</option>
            <option value="Restaurante">Flyer Restaurante</option>
            <option value="Restobar">Flyer Restobar</option>
            <option value="SalonBelleza">Flyer Salón Belleza</option>
            <option value="SalonSpa">Flyer Salón Spa</option>
            <option value="Sangucheria">Flyer Sanguchería</option>
            <option value="Terraza">Flyer Terraza</option>
            <option value="TiendaRopa">Flyer Tienda Ropa</option>
            <option value="Veterinaria">Flyer Veterinaria</option>
          </select>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || !isConnected}
        >
          {loading ? '⏳ Enviando...' : '📤 Enviar Mensaje'}
        </button>
      </form>
    </div>
  );
};

export default MessageSender;
