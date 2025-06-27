import nodemailer from 'nodemailer';
import functions from 'firebase-functions';
import admin from 'firebase-admin';


admin.initializeApp(); // 👈 Asegúrate de que esté al principio

// Configura el correo
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'EkonomiCBJ@gmail.com',
    pass: 'fcwoeeavxvmdsnaz'
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

// ✅ Exportar función de correo
export const enviarCorreo = functions.https.onCall(enviarCorreoHandler);

// ✅ Nueva función para notificación de gasto
export const notificarGastoPorCorreo = functions.firestore
  .document('users/{uid}/movimientos/{movId}')
  .onCreate(async (snap, context) => {
    const { uid } = context.params;
    const data = snap.data();

    if (data.tipo !== 'gasto') return;

    const userRef = admin.firestore().doc(`users/${uid}`);
    const userSnap = await userRef.get();
    const user = userSnap.data();

    if (!user || !user.correo) return;

    const { saldoTarjeta = 0, limiteMensual = 0, email } = user;
    const correo = email;


    if (!limiteMensual || !correo) return;

    const porcentajeGastado = ((limiteMensual - saldoTarjeta) / limiteMensual) * 100;

    if (porcentajeGastado >= 80) {
      const mailOptions = {
        from: '"Ekonomi Alertas" <EkonomiCBJ@gmail.com>',
        to: correo,
        subject: 'Alerta de Gasto Excesivo',
        html: `
          <h2>Has alcanzado el ${Math.round(porcentajeGastado)}% de tu límite mensual</h2>
          <p>Saldo actual: $${saldoTarjeta.toLocaleString()}</p>
          <p>Límite mensual: $${limiteMensual.toLocaleString()}</p>
          <p>Te recomendamos revisar tus gastos para no exceder tu presupuesto.</p>
        `
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`Correo enviado a ${correo}`);
      } catch (error) {
        console.error('Error al enviar correo:', error);
      }
    }
  });
