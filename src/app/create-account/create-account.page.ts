import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AuthService } from '../services/auth.service'; // Asegúrate de que la ruta sea correcta

@Component({
  selector: 'app-create-account',
  templateUrl: 'create-account.page.html',
  styleUrls: ['create-account.page.scss'],
  standalone: true,
  imports: [IonicModule, ReactiveFormsModule],
})
export class CreateAccountPage {
  registerForm: FormGroup;

  constructor(
    private router: Router, 
    private fb: FormBuilder,
    private authService: AuthService // Inyecta el servicio aquí
  ) {
    this.registerForm = this.fb.group({
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  registerAccount() {
    if (this.registerForm.valid) {
      const userData = this.registerForm.value;
      
      this.authService.register(userData).subscribe(
        response => {
          console.log('✅ Cuenta creada exitosamente');
          this.router.navigate(['/login']);
        },
        error => {
          console.error('❌ Error al crear cuenta:', error);
          // Mostrar mensaje de error
        }
      );
    } else {
      console.log('Formulario inválido');
    }
  }
}
