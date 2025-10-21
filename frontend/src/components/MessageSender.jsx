import { useState } from 'react';
import './MessageSender.css';

const MessageSender = ({ isConnected, onMessageSent }) => {
  const [formData, setFormData] = useState({
    phone: '',
    templateOption: 'cita_gratis',
    psicologo: '',
    fecha: '',
    hora: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [preview, setPreview] = useState('');

  const apiBaseUrl = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:5111';
  const token = localStorage.getItem('token');

  // Obtener fecha mínima (hoy)
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Manejar cambios en el formulario
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Generar preview en tiempo real
    if (name === 'templateOption' || name === 'psicologo' || name === 'fecha' || name === 'hora') {
      generatePreview({
        ...formData,
        [name]: value
      });
    }
  };

  // Generar preview del mensaje
  const generatePreview = (data) => {
    if (!data.templateOption || !data.psicologo || !data.fecha || !data.hora) {
      setPreview('');
      return;
    }

    const templates = {
      cita_gratis: `¡Hola 👋

✅ Tu primera cita GRATUITA ha sido confirmada:

📅 Fecha: ${data.fecha}
🕐 Hora: ${data.hora}
👨‍⚕️ Psicólogo: ${data.psicologo}

🎉 ¡Recuerda que tu primera consulta es completamente GRATIS!

Si tienes alguna consulta, no dudes en contactarnos.

¡Te esperamos! 🌟`,

      cita_pagada: `¡Hola 👋

✅ Tu cita ha sido confirmada:

📅 Fecha: ${data.fecha}
🕐 Hora: ${data.hora}
👨‍⚕️ Psicólogo: ${data.psicologo}

Por favor, realiza el pago antes de la consulta para confirmar tu reserva.

Si tienes dudas, contáctanos.

¡Gracias por confiar en nosotros!`,

      recordatorio_cita: `¡Hola 👋

⏰ Te recordamos tu cita próxima:

📅 Fecha: ${data.fecha}
🕐 Hora: ${data.hora}
👨‍⚕️ Psicólogo: ${data.psicologo}

Por favor, confirma tu asistencia respondiendo a este mensaje.

¡Nos vemos pronto!`,

      confirmacion_asistencia: `¡Hola 👋

✅ Hemos recibido tu confirmación de asistencia para la cita:

📅 Fecha: ${data.fecha}
🕐 Hora: ${data.hora}
👨‍⚕️ Psicólogo: ${data.psicologo}

¡Gracias por avisarnos!`
    };

    setPreview(templates[data.templateOption] || '');
  };

  // Validar formulario
  const validateForm = () => {
    if (!formData.phone.trim()) {
      setError('El número de teléfono es requerido');
      return false;
    }

    if (!formData.psicologo.trim()) {
      setError('El nombre del psicólogo es requerido');
      return false;
    }

    if (!formData.fecha) {
      setError('La fecha es requerida');
      return false;
    }

    if (!formData.hora) {
      setError('La hora es requerida');
      return false;
    }

    // Validar formato de teléfono
    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      setError('El número de teléfono debe tener entre 10 y 15 dígitos');
      return false;
    }

    // Validar que la fecha no sea pasada
    const selectedDate = new Date(formData.fecha);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      setError('La fecha no puede ser en el pasado');
      return false;
    }

    return true;
  };

  // Enviar mensaje
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
      const response = await fetch(`${apiBaseUrl}/api/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
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
      
      // Limpiar formulario
      setFormData({
        phone: '',
        templateOption: 'cita_gratis',
        psicologo: '',
        fecha: '',
        hora: ''
      });
      setPreview('');

      // Notificar al componente padre
      if (onMessageSent) {
        onMessageSent(data);
      }

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Limpiar mensajes
  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  return (
    <div className="message-sender">
      <h2>📱 Enviar Mensaje WhatsApp</h2>
      
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
          <label htmlFor="phone">📞 Número de Teléfono *</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            placeholder="Ej: +34 123 456 789"
            disabled={loading || !isConnected}
            required
          />
          <small>Formato: +34 123 456 789 o 123456789</small>
        </div>

        <div className="form-group">
          <label htmlFor="templateOption">📝 Tipo de Mensaje *</label>
          <select
            id="templateOption"
            name="templateOption"
            value={formData.templateOption}
            onChange={handleInputChange}
            disabled={loading || !isConnected}
            required
          >
            <option value="cita_gratis">Cita Gratuita - Confirmación</option>
            <option value="cita_pagada">Cita Pagada - Confirmación</option>
            <option value="recordatorio_cita">Recordatorio de Cita</option>
            <option value="confirmacion_asistencia">Confirmación de Asistencia</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="psicologo">👨‍⚕️ Nombre del Psicólogo *</label>
          <input
            type="text"
            id="psicologo"
            name="psicologo"
            value={formData.psicologo}
            onChange={handleInputChange}
            placeholder="Nombre completo del psicólogo"
            disabled={loading || !isConnected}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="fecha">📅 Fecha *</label>
            <input
              type="date"
              id="fecha"
              name="fecha"
              value={formData.fecha}
              onChange={handleInputChange}
              min={getMinDate()}
              disabled={loading || !isConnected}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="hora">🕐 Hora *</label>
            <input
              type="time"
              id="hora"
              name="hora"
              value={formData.hora}
              onChange={handleInputChange}
              disabled={loading || !isConnected}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || !isConnected}
        >
          {loading ? '⏳ Enviando...' : '📤 Enviar Mensaje'}
        </button>
      </form>

      {preview && (
        <div className="message-preview">
          <h3>👀 Vista Previa del Mensaje</h3>
          <div className="preview-content">
            <pre>{preview}</pre>
          </div>
          <div className="preview-info">
            <span>📱 Destinatario: {formData.phone || 'No especificado'}</span>
            <span>📊 Caracteres: {preview.length}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageSender;
