// backend/services/emailService.js
const nodemailer = require("nodemailer");
require("dotenv").config();

// Configura esto en tu .env:
// EMAIL_HOST=smtp.gmail.com (o tu proveedor)
// EMAIL_PORT=587
// EMAIL_USER=tu_email@empresa.com
// EMAIL_PASS=tu_password_aplicacion

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // true para 465, false para otros
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const enviarNotificacionCambio = async (datos) => {
  const { producto, tipo, descripcion, responsable, fecha, destinatarios } =
    datos;

  // Plantilla HTML profesional
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #1e293b; padding: 20px; text-align: center;">
        <h2 style="color: #fff; margin: 0;">Notificación de Ingeniería</h2>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 5px;">Sistema de Gestión MRP</p>
      </div>
      
      <div style="padding: 30px;">
        <h3 style="color: #0f172a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
          ${tipo}: ${producto}
        </h3>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr>
            <td style="padding: 10px; font-weight: bold; color: #64748b;">Fecha:</td>
            <td style="padding: 10px;">${new Date(fecha).toLocaleDateString("es-AR")}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; color: #64748b;">Responsable:</td>
            <td style="padding: 10px;">${responsable}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; color: #64748b; vertical-align: top;">Detalle:</td>
            <td style="padding: 10px; background-color: #f8fafc; border-radius: 4px;">
              ${descripcion.replace(/\n/g, "<br>")}
            </td>
          </tr>
        </table>

        <div style="margin-top: 30px; text-align: center;">
          <a href="https://tu-app-url.com" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ver en Sistema</a>
        </div>
      </div>

      <div style="background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 11px; color: #64748b;">
        Este es un mensaje automático. Por favor no responder.
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Gestión MRP" <${process.env.EMAIL_USER}>`,
      to: destinatarios, // "gerencia@..., calidad@..."
      subject: `[${tipo}] Actualización: ${producto}`,
      html: htmlContent,
    });
    console.log("📧 Email de cambio enviado correctamente.");
    return true;
  } catch (error) {
    console.error("❌ Error enviando email:", error);
    return false;
  }
};

module.exports = { enviarNotificacionCambio };
