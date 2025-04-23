import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IonicModule, NavController } from '@ionic/angular';
import { AuthService } from '../services/auth.service';

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
    private navCtrl: NavController,
    private authService: AuthService
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
        () => {
          console.log('✅ Cuenta creada exitosamente');
          // Si todo se guarda bien, redirige
          this.router.navigate(['/home']);
        },
        error => {
          const errorMsg = error?.error?.error || 'Error al crear cuenta.';
          console.error('❌', errorMsg);
          alert(errorMsg); // o muestra un toast
        }
      );
    } else {
      console.log('Formulario inválido');
    }
  }

  goBack() {
    this.navCtrl.back();
  }
}
