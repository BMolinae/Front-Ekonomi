import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import emailjs, { EmailJSResponseStatus } from 'emailjs-com';

@Injectable({
  providedIn: 'root'
})
export class RecoveryService {
  private recoveryApiUrl = 'http://127.0.0.1:8000/api/recover-password/';

  constructor(private http: HttpClient) {}

  requestRecoveryLink(email: string): Promise<string> {
    return this.http.post<any>(this.recoveryApiUrl, { email }).toPromise()
      .then(response => {
        if (response.status === 'Success') {
          return response.recoveryLink;
        } else {
          throw new Error(response.message || 'No se pudo obtener el enlace de recuperación.');
        }
      });
  }

  async sendRecoveryEmail(email: string, resetLink: string): Promise<EmailJSResponseStatus> {
    return await emailjs.send(
      'Ekonomi_ID',
      'Ekonomi_TMID',
      {
        to_email: email,
        name: email,
        reset_link: resetLink
      },
      'f2k2gBuvEBGJ-kYbe'
    );
  }
}
