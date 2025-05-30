// src/app/services/recovery.service.ts
import { Injectable } from '@angular/core';
import { Auth, sendPasswordResetEmail } from '@angular/fire/auth';

@Injectable({
  providedIn: 'root',
})
export class RecoveryService {
  constructor(private auth: Auth) {}

  // Solo se necesita el correo
  async requestRecoveryLink(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email);
  }
}
