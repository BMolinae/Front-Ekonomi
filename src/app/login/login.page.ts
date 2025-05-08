import { Component } from '@angular/core';
import { IonicModule, NavController } from '@ionic/angular';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonicModule, ReactiveFormsModule]
})
export class LoginPage {
  loginForm: FormGroup;

  constructor(
    private router: Router,
    private fb: FormBuilder,
    private navCtrl: NavController,
    private authService: AuthService
  ) {
    // Crear el formulario con validaciones
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  goToCreateAccount() {
    this.router.navigate(['/create-account']);
  }

  goToForgotPassword() {
    this.router.navigate(['/forgot-password']);
  }

  goBack() {
    this.navCtrl.back();
  }

  login() {
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;

      this.authService.login(email, password)
        .then(() => {
          console.log('✅ Autenticado');
          this.router.navigate(['/dashboard']);
        })
        .catch(error => {
          console.error('❌ Error al iniciar sesión:', error.message);
        });

    } else {
      console.warn('⚠️ Formulario inválido');
    }
  }
}
