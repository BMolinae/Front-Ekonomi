import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IonicModule, NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule],
})
export class ForgotPasswordPage {
  form: FormGroup;

  constructor(private fb: FormBuilder, private navCtrl: NavController) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  onSubmit() {
    if (this.form.valid) {
      const email = this.form.value.email;
      console.log('Enviar solicitud de recuperación a:', email);
      // Aquí conectas con el backend
    }
  }

  goBack() {
    this.navCtrl.back();
  }

  goBackToLogin() {
    this.navCtrl.navigateBack('/login');
  }
}
