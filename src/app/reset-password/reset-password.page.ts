import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IonicModule, NavController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-reset-password',
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
  imports: [CommonModule, IonicModule, ReactiveFormsModule]
})
export class ResetPasswordPage {
  resetForm: FormGroup;
  showPassword = false;
  showConfirmPassword = false;
  isSubmitting = false;
  message: string | null = null;
  messageColor: 'success' | 'danger' = 'success';
  resetToken: string | null = null;

  constructor(
    private fb: FormBuilder,
    private navCtrl: NavController,
    private http: HttpClient,
    private route: ActivatedRoute
  ) {
    this.resetForm = this.fb.group(
      {
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', Validators.required]
      },
      { validators: this.passwordsMatch }
    );

    this.route.queryParams.subscribe(params => {
      this.resetToken = params['token'] || null;
    });
  }

  passwordsMatch(group: FormGroup) {
    const pass = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pass === confirm ? null : { passwordMismatch: true };
  }

  togglePasswordVisibility(field: 'password' | 'confirm') {
    if (field === 'password') this.showPassword = !this.showPassword;
    else this.showConfirmPassword = !this.showConfirmPassword;
  }

  getPasswordStrengthClass(): string {
    const password = this.resetForm.get('password')?.value;
    if (!password) return '';
    if (password.length >= 12) return 'strong';
    if (password.length >= 8) return 'medium';
    return 'weak';
  }

  getPasswordStrengthText(): string {
    const strength = this.getPasswordStrengthClass();
    if (strength === 'strong') return 'Segura';
    if (strength === 'medium') return 'Moderada';
    return 'Débil';
  }

  onSubmit() {
    if (this.resetForm.invalid || !this.resetToken) {
      this.message = '❌ Datos inválidos o token no encontrado.';
      this.messageColor = 'danger';
      return;
    }

    this.isSubmitting = true;

    this.http.post('http://127.0.0.1:8000/api/reset-password/', {
      token: this.resetToken,
      new_password: this.resetForm.value.password
    }).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.message = '✅ Contraseña restablecida correctamente';
        this.messageColor = 'success';
        this.resetForm.reset();
      },
      error: () => {
        this.isSubmitting = false;
        this.message = '❌ Token inválido o expirado';
        this.messageColor = 'danger';
      }
    });
  }

  goBack() {
    this.navCtrl.back();
  }

  goToLogin() {
    this.navCtrl.navigateBack('/login');
  }
}
