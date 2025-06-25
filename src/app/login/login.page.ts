import { Component } from '@angular/core';
import { IonicModule, NavController } from '@ionic/angular';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { ToastController } from '@ionic/angular';


@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonicModule, ReactiveFormsModule]
})
export class LoginPage {
  loginForm: FormGroup;



  showPassword = false;

  constructor(
    private router: Router,
    private fb: FormBuilder,
    private navCtrl: NavController,
    private authService: AuthService,
    private toastController: ToastController
  ) {
    // Crear el formulario con validaciones
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
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

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
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
          this.presentToast(error);
        });

    } else {
      this.presentToast('Por favor completa todos los campos correctamente');
    }
  }


  async presentToast(message: string, color: string = 'danger') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color,
    });
    await toast.present();
  }

}
