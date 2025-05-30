import * as functions from 'firebase-functions';
import * as nodemailer from 'nodemailer';

// Configura el correo desde donde se enviarán los mensajes
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'EkonomiCBJ@gmail.com', // REEMPLAZA
        pass: 'fcwoeeavxvmdsnaz' // REEMPLAZA (usa una contraseña de aplicación si tienes 2FA)
    }
});
const enviarCorreoHandler = async (
  data: {
    nombre: string;
    correo: string;
    asunto: string;
    mensaje: string;
  },
  context: functions.https.CallableContext
) => {
  const { nombre, correo, asunto, mensaje } = data;

  const mailOptions = {
    from: '"Formulario Ekonomi" <EkonomiCBJ@gmail.com>',
    to: 'EkonomiCBJ@gmail.com',
    subject: `Nuevo mensaje de contacto: ${asunto}`,
    html: `
      <h2>Nuevo mensaje desde el formulario de contacto</h2>
      <p><strong>Nombre:</strong> ${nombre}</p>
      <p><strong>Correo:</strong> ${correo}</p>
      <p><strong>Mensaje:</strong><br>${mensaje}</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Error al enviar correo:', error);
    throw new functions.https.HttpsError('internal', 'No se pudo enviar el correo.');
  }
};

// ✅ Aquí se exporta la función Firebase
export const enviarCorreo = functions.https.onCall(enviarCorreoHandler);