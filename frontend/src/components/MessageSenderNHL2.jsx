import { useState, useRef, useEffect } from 'react';
import ReactCountryFlag from 'react-country-flag';
import './MessageSender.css';

const MessageSender = ({ isConnected, onMessageSent }) => {
  // Países disponibles
  const countries = [
    { code: '+51', name: 'Perú', countryCode: 'PE' },
    { code: '+34', name: 'España', countryCode: 'ES' },
    { code: '+1', name: 'Estados Unidos', countryCode: 'US' },
    { code: '+55', name: 'Brasil', countryCode: 'BR' },
    { code: '+57', name: 'Colombia', countryCode: 'CO' },
    { code: '+52', name: 'México', countryCode: 'MX' },
    { code: '+54', name: 'Argentina', countryCode: 'AR' },
    { code: '+56', name: 'Chile', countryCode: 'CL' },
    { code: '+58', name: 'Venezuela', countryCode: 'VE'},
    { code: '+507', name: 'Panamá', countryCode: 'PA' },
    { code: '+591', name: 'Bolivia', countryCode: 'BO' },
    { code: '+503', name: 'El Salvador', countryCode: 'SV' },
    { code: '+502', name: 'Guatemala', countryCode: 'GT' },
  ];

  // País por defecto (Perú)
  const defaultCountry = countries[0]; // Perú es el primer país

  const [formData, setFormData] = useState({
    phone: `${defaultCountry.code} `, // Inicia con "+51 "
    nombre: '',
    mensaje: '',
    countryCode: defaultCountry.code   // "+51"
  });

  const [file, setFile] = useState(null);       // imagen seleccionada
  const [preview, setPreview] = useState(null); // url de previsualización
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Estados para el dropdown de países
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(defaultCountry); // Perú seleccionado por defecto
  const dropdownRef = useRef(null);

  const apiBaseUrl = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:5111';
  const token = localStorage.getItem('token');

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCountrySelect = (country) => {
    setSelectedCountry(country);
    setFormData(prev => ({
      ...prev,
      phone: `${country.code} `,
      countryCode: country.code
    }));
    setIsDropdownOpen(false);
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value;
    const countryCode = formData.countryCode || '';
    
    if (countryCode) {
      const prefix = `${countryCode} `;
      
      if (!value.startsWith(prefix)) {
        setFormData(prev => ({ 
          ...prev, 
          phone: prefix 
        }));
        return;
      }
      
      const phoneNumber = value.substring(prefix.length);
      const cleanNumber = phoneNumber.replace(/[^\d\s\-\(\)]/g, '');
      
      setFormData(prev => ({ 
        ...prev, 
        phone: prefix + cleanNumber 
      }));
    } else {
      handleInputChange(e);
    }
  };

  const handleKeyDown = (e) => {
    const countryCode = formData.countryCode || '';
    if (countryCode) {
      const prefix = `${countryCode} `;
      const cursorPosition = e.target.selectionStart;
      
      if ((e.key === 'Backspace' || e.key === 'Delete') && cursorPosition <= prefix.length) {
        e.preventDefault();
      }
    }
  };

  const handleFocus = (e) => {
    const countryCode = formData.countryCode || '';
    if (countryCode) {
      const prefix = `${countryCode} `;
      setTimeout(() => {
        if (e.target.selectionStart < prefix.length) {
          e.target.setSelectionRange(prefix.length, prefix.length);
        }
      }, 0);
    }
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

    if (!file) {
      setError('Debes seleccionar un flyer (imagen)');
      return false;
    }

    return true;
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile)); // genera la URL de preview
    } else {
      setFile(null);
      setPreview(null);
    }
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
      // usamos FormData para enviar texto + archivo
      const bodyToSend = new FormData();
      bodyToSend.append('phone', formData.phone);
      bodyToSend.append('nombre', formData.nombre);
      bodyToSend.append('mensaje', formData.mensaje);

      // 🔹 si hay archivo, lo añadimos
      if (file) {
        bodyToSend.append('flyer', file); 
      }

      const response = await fetch(`${apiBaseUrl}/api/send-messageNHL`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}` // no poner content-type aquí
        },
        body: bodyToSend
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          const errorMessages = data.errors
            .map(err => `${err.field}: ${err.message}`)
            .join(', ');
          throw new Error(errorMessages);
        }
        throw new Error(data.message || 'Error al enviar mensaje');
      }

      setSuccess(`Mensaje enviado exitosamente a ${formData.phone}`);

      // 🔹 reset de todo - vuelve a Perú por defecto
      setFormData({
        phone: `${defaultCountry.code} `, // Vuelve a "+51 "
        nombre: '',
        mensaje: '',
        countryCode: defaultCountry.code   // Vuelve a "+51"
      });
      setSelectedCountry(defaultCountry); // Vuelve a Perú
      setFile(null);
      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (onMessageSent) {
        onMessageSent({
          phone: formData.phone,
          nombre: formData.nombre,
          mensaje: formData.mensaje,
          sentAt: new Date(),
          messageId: data.messageId || Date.now(),
          messagePreview: formData.mensaje.substring(0, 50) + '...',
        });
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
        {/* Dropdown personalizado con banderas */}
        <div className="form-group">
          <label>🌎 País *</label>
          <div className="country-dropdown" ref={dropdownRef}>
            <button
              type="button"
              className={`dropdown-button ${isDropdownOpen ? 'open' : ''}`}
              onClick={() => !loading && isConnected && setIsDropdownOpen(!isDropdownOpen)}
              disabled={loading || !isConnected}
            >
              <div className="dropdown-content">
                {selectedCountry ? (
                  <>
                    <ReactCountryFlag
                      countryCode={selectedCountry.countryCode}
                      svg
                      style={{
                        width: '24px',
                        height: '18px',
                        borderRadius: '2px',
                        marginRight: '8px'
                      }}
                    />
                    <span>{selectedCountry.name} ({selectedCountry.code})</span>
                  </>
                ) : (
                  <span className="placeholder">-- Selecciona un país --</span>
                )}
              </div>
              <span className={`dropdown-arrow ${isDropdownOpen ? 'rotate' : ''}`}>▼</span>
            </button>
            
            {isDropdownOpen && (
              <div className="dropdown-menu">
                {countries.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    className="dropdown-option"
                    onClick={() => handleCountrySelect(country)}
                  >
                    <ReactCountryFlag
                      countryCode={country.countryCode}
                      svg
                      style={{
                        width: '24px',
                        height: '18px',
                        borderRadius: '2px',
                        marginRight: '8px'
                      }}
                    />
                    <span>{country.name} ({country.code})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="phone">📞 Número de Teléfono *</label>
          <input 
            type="tel" 
            id="phone" 
            name="phone" 
            value={formData.phone} 
            onChange={handlePhoneChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            placeholder="987 654 321"
            disabled={loading || !isConnected} 
            required 
          />
        </div>

        <div className="form-group">
          <label htmlFor="nombre">🙍 Nombre del Cliente *</label>
          <input
            type="text"
            id="nombre"
            name="nombre"
            value={formData.nombre}
            onChange={handleInputChange}
            placeholder="Nombre del cliente"
            disabled={loading || !isConnected}
            required
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
          <label htmlFor="flyer">🖼️ Subir Flyer *</label>
          <input
            type="file"
            id="flyer"
            name="flyer"
            accept="image/*"
            onChange={handleFileChange}
            disabled={loading || !isConnected}
            ref={fileInputRef}
            required={!preview} // sólo requerido si no hay ya preview
          />

          {/* preview con botón X */}
          {preview && (
            <div className="flyer-preview" style={{ position: 'relative', display: 'inline-block' }}>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''; // 👉 limpiar input file
                  }
                }}
                style={{
                  position: 'absolute',
                  top: '5px',
                  right: '5px',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  lineHeight: '22px',
                  textAlign: 'center'
                }}
              >
                ✖
              </button>
              <img
                src={preview}
                alt="Vista previa del flyer"
                style={{
                  maxWidth: '250px',
                  margin: '10px auto', // centra horizontalmente
                  borderRadius: '8px',
                  display: 'block',
                }}
              />
            </div>
          )}
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