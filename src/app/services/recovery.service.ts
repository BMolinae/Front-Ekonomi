import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import emailjs, { EmailJSResponseStatus } from 'emailjs-com';

@Injectable({
  providedIn: 'root'
})
export class RecoveryService {
  private recoveryApiUrl = 'http://127.0.0.1:8000/api/'; // tu endpoint real de recuperación

  constructor(private http: HttpClient) {}

  // Solicita al backend el enlace de recuperación
  requestRecoveryLink(email: string): Promise<string> {
    return this.http.post<any>(this.recoveryApiUrl, { email }).toPromise()
      .then(response => {
        if (response.status === 'Success') {
          return response.recoveryLink;
        } else {
          throw new Error('No se pudo obtener el enlace de recuperación.');
        }
      });
  }

  // Enviar correo con EmailJS
  async sendRecoveryEmail(email: string, resetLink: string): Promise<EmailJSResponseStatus> {
    return await emailjs.send(
      'CorreoLogin',           // ID del servicio de EmailJS
      'LoginPassword',         // ID de la plantilla
      {
        to_email: email,
        name: email,
        reset_link: resetLink
      },
      '0NOvUMPdB6iz0BoOK'       // Tu user/public key de EmailJS
    );
  }
}
