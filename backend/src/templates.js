// Al inicio del archivo
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Para poder usar __dirname en ESModules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getTemplateNHL(option, params = {}) {
  const { nombre = '', telefono = '', mensaje = '' } = params;

  // ✅ Ruta correcta al flyer
  const imagePath = path.resolve(
    __dirname,
    '..',             // salir de src
    'public',
    'img',
    'flyers',
    `${option}-Flyer-2.webp`
  );

  // Validar que existe (opcional)
  if (!fs.existsSync(imagePath)) {
    console.warn(`⚠️ Imagen no encontrada en: ${imagePath}`);
  }

  // Texto del mensaje
  const text = `👋 Hola ${nombre}, te saluda NHL Decoración Comercial.

💬 Mensaje: ${mensaje}  
📝 Flyer: ${option}  

✨ Nuestro equipo está listo para asesorarte y ofrecerte las mejores ideas para tu negocio.`;

  return { text, imagePath };
}
/////////////////////////////////////////////////////////////////////
export function getTemplate(option, params = {}) {
  const {
    nombre = '',
    nombrePsicologo = '',
    fecha = '',
    hora = '',
    jitsi_url = ''
  } = params;

  //solo se agrega si existe link
  const linkLine = jitsi_url ? `\nIngresa a la reunion: ${jitsi_url}\n` : '';

  switch (option) {
    case 'cita_gratis':
      return `¡Hola, ${nombre}! 👋✨

Tu cita en el *Centro Psicológico Contigo Voy* ha sido reservada con éxito. 🏡💜  
Nos alegra mucho acompañarte en este proceso.

Aquí tienes los detalles de tu espacio:

            ✨ Día: 📅 ${fecha}
            ✨ Hora: ⏰ ${hora} hrs
            ✨ Especialista: 👩‍⚕️ ${nombrePsicologo}
    ${linkLine}

Nos vemos pronto para dar este paso juntos hacia tu bienestar.  
          ¡Te esperamos con mucha ilusión! 🌿`;

    case 'cita_pagada':
      return `¡Hola 👋

✅ Tu cita ha sido confirmada:

📅 Fecha: ${fecha}
🕐 Hora: ${hora}
👨‍⚕️ Psicólogo: ${nombrePsicologo}${linkLine}
Por favor, realiza el pago antes de la consulta para confirmar tu reserva.

Si tienes dudas, contáctanos.

¡Gracias por confiar en nosotros!`;

    case 'recordatorio_cita':
      return `¡Hola 👋

⏰ Te recordamos tu cita próxima:

📅 Fecha: ${fecha}
🕐 Hora: ${hora}
👨‍⚕️ Psicólogo: ${nombrePsicologo}${linkLine}
Por favor, confirma tu asistencia respondiendo a este mensaje.

¡Nos vemos pronto!`;

    case 'confirmacion_asistencia':
      return `¡Hola 👋

✅ Hemos recibido tu confirmación de asistencia para la cita:

📅 Fecha: ${fecha}
🕐 Hora: ${hora}
👨‍⚕️ Psicólogo: ${nombrePsicologo}${linkLine}
¡Gracias por avisarnos!`;

    default:
      return 'Opción de plantilla no válida.';
  }
}

// Template para mensaje de pago aceptado
export function getAcceptanceTemplate(comentario = '') {
  return `👋 Hola,

${comentario}

✨ Si necesitas ayuda, estamos para apoyarte.`;
}

// Template para mensaje de pago rechazado
export function getRejectionTemplate(comentario = '') {
  return `❌ COMPROBANTE RECHAZADO ❌

⚠️ Tu comprobante de pago no pudo ser aprobado.

📋 Estado de la revisión:
   • ❌ RECHAZADO
   • 📅 Fecha de revisión: ${new Date().toLocaleDateString('es-ES')}
   • 🕐 Hora: ${new Date().toLocaleTimeString('es-ES')}

${comentario ? `💬 Comentario del administrador:
"${comentario}"

` : ''}🔄 Para resolver este problema:

1. 📸 Sube una nueva foto del comprobante
2. 🔍 Asegúrate de que se vea claramente:
   - Número de referencia
   - Monto pagado
   - Fecha del pago
   - Nombre del remitente
3. 📱 La imagen debe estar nítida y completa

📞 Si necesitas ayuda, contáctanos inmediatamente.

¡Estamos aquí para ayudarte a resolverlo! 🤝`;
}

export function getLeadTemplate(option, params = {}) {
  const {
    nombre = '',
    categoria = ''
  } = params;

  switch (option) {
    case 'lead':
      return `¡Hola ${nombre} 😃 Gracias por dejarnos tus datos. Ya tienes tu 25% OFF asegurado en tu primera asesoría de diseño. (Oferta válida por tiempo limitado). ¿Cuándo te viene mejor agendar tu cita para empezar a trabajar en tu proyecto?`
  }
}
