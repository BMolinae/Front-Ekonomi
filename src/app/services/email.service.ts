// src/app/services/email.service.ts
import { Injectable } from '@angular/core';
import emailjs from 'emailjs-com';

@Injectable({
  providedIn: 'root'
})
export class EmailService {
  sendContactEmail(nombre: string, correo: string, asunto: string, mensaje: string) {
    const templateParams = {
      from_name: nombre,
      from_email: correo,
      subject: asunto,
      message: mensaje,
      email: 'EkonomiCBJ@gmail.com'
    };

    return emailjs.send(
      'Notification',
      'notificaciones1',
      templateParams,
      'f2k2gBuvEBGJ-kYbe'
    );
  }

  sendGastoAlertaEmail(data: {
    to_email: string;
    user_name: string;
    saldo_tarjeta: number;
    limite_mensual: number;
    porcentaje_gastado: number;
  }) {
    return emailjs.send(
      'Notification',
      'Ekonomi_TMID', 
      data,
      'f2k2gBuvEBGJ-kYbe'
    );
  }
}
