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
    nombrePsicologo = '',
    fecha = '',
    hora = ''
  } = params;

  switch (option) {
    case 'cita_gratis':
      return `¡Hola 👋

✅ Tu primera cita GRATUITA ha sido confirmada:

📅 Fecha: ${fecha}
🕐 Hora: ${hora}
👨‍⚕️ Psicólogo: ${nombrePsicologo}

🎉 ¡Recuerda que tu primera consulta es completamente GRATIS!

Si tienes alguna consulta, no dudes en contactarnos.

¡Te esperamos! 🌟`;

    case 'cita_pagada':
      return `¡Hola 👋

✅ Tu cita ha sido confirmada:

📅 Fecha: ${fecha}
🕐 Hora: ${hora}
👨‍⚕️ Psicólogo: ${nombrePsicologo}

Por favor, realiza el pago antes de la consulta para confirmar tu reserva.

Si tienes dudas, contáctanos.

¡Gracias por confiar en nosotros!`;

    case 'recordatorio_cita':
      return `¡Hola 👋

⏰ Te recordamos tu cita próxima:

📅 Fecha: ${fecha}
🕐 Hora: ${hora}
👨‍⚕️ Psicólogo: ${nombrePsicologo}

Por favor, confirma tu asistencia respondiendo a este mensaje.

¡Nos vemos pronto!`;

    case 'confirmacion_asistencia':
      return `¡Hola 👋

✅ Hemos recibido tu confirmación de asistencia para la cita:

📅 Fecha: ${fecha}
🕐 Hora: ${hora}
👨‍⚕️ Psicólogo: ${nombrePsicologo}

¡Gracias por avisarnos!`;

    default:
      return 'Opción de plantilla no válida.';
  }
}

// Template para mensaje de pago aceptado
export function getAcceptanceTemplate(comentario = '') {
  return `✅ COMPROBANTE APROBADO ✅

🎉 ¡Excelente! Tu comprobante de pago ha sido revisado y aprobado.

📋 Estado de la revisión:
   • ✅ APROBADO
   • 📅 Fecha de revisión: ${new Date().toLocaleDateString('es-ES')}
   • 🕐 Hora: ${new Date().toLocaleTimeString('es-ES')}

${comentario ? `💬 Comentario del administrador:
"${comentario}"

` : ''}🔒 Tu información está segura con nosotros.

Si tienes alguna pregunta sobre tu pago, no dudes en contactarnos.

¡Gracias por tu paciencia! 🌟`;
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

export function getLeadTemplate(option, params={}){
  const {
    nombre = '',
    categoria = ''
  } = params;

  switch (option) {
    case 'lead':
      return `¡Hola ${nombre} 😃 Gracias por dejarnos tus datos. Ya tienes tu 25% OFF asegurado en tu primera asesoría de diseño. (Oferta válida por tiempo limitado). ¿Cuándo te viene mejor agendar tu cita para empezar a trabajar en tu proyecto?`
  }
}