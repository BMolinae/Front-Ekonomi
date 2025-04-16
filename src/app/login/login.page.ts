import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service'; // Asegúrate de que la ruta sea correcta

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonicModule, ReactiveFormsModule], // Elimina HttpClientModule si ya lo has importado correctamente en un módulo superior
})
export class LoginPage {
  loginForm: FormGroup;

  constructor(
    private router: Router,
    private fb: FormBuilder,
    private authService: AuthService // Inyecta solo AuthService
  ) {
    // Crear el formulario con validaciones
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  // Redirige a la vista de crear cuenta
  goToCreateAccount() {
    this.router.navigate(['/create-account']);
  }

  // Ejecuta el login
  login() {
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;
      
      this.authService.login(email, password).subscribe(
        response => {
          console.log('✅ Autenticado:', response);
          this.router.navigate(['/dashboard']);
        },
        error => {
          console.error('❌ Error al iniciar sesión:', error);
        }
      );
    } else {
      console.warn('⚠️ Formulario inválido');
    }
  }
}
