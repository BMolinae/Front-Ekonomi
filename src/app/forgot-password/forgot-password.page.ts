import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IonicModule, NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { RecoveryService } from '../services/recovery.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule],
})


export class ForgotPasswordPage {
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private navCtrl: NavController,
    private recoveryService: RecoveryService
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  async onSubmit() {
    if (this.form.valid) {
      const email = this.form.value.email;
  
      try {
        const resetLink = await this.recoveryService.requestRecoveryLink(email);
        await this.recoveryService.sendRecoveryEmail(email, resetLink);
        console.log('Correo de recuperación enviado');
        alert('Hemos enviado un enlace de recuperación a: ' + email);
      } catch (error) {
        console.error('Error al enviar recuperación:', error);
        alert('No se pudo enviar el correo. Intenta más tarde.');
      }
    }
  }

  goBackToLogin() {
    this.navCtrl.navigateBack('/login');
  }
  goBack() {
    this.navCtrl.back();
  }
}
