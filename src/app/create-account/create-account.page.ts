import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicModule, NavController } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-create-account',
  templateUrl: 'create-account.page.html',
  styleUrls: ['create-account.page.scss'],
  standalone: true,
  imports: [IonicModule,
    ReactiveFormsModule,
    FormsModule,
  ],
})
export class CreateAccountPage implements OnInit {
  registerForm!: FormGroup;

  hasMinLength = false;
  hasUppercase = false;
  hasSymbol = false;
  hasNumber = false;
  showPassword = false;
  password: string = '';


  constructor(
    private router: Router,
    private fb: FormBuilder,
    private navCtrl: NavController,
    private authService: AuthService
  ) {
    this.registerForm = this.fb.group({
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  ngOnInit() {
    this.registerForm.get('password')!.valueChanges.subscribe((password: string) => {
      this.hasMinLength = password.length >= 6;
      this.hasUppercase = /[A-Z]/.test(password);
      this.hasSymbol = /[.,*_\-@]/.test(password);
      this.hasNumber = /[0-9]/.test(password);
    });
  }

  registerAccount() {
    if (this.registerForm.valid) {
      const { email, password, username } = this.registerForm.value;

      this.authService.register(email, password, username)
        .then(() => {
          console.log('✅ Cuenta creada exitosamente');
          this.router.navigate(['/home']);
        })
        .catch(error => {
          const errorMsg = error?.error?.error || 'Error al crear cuenta.';
          console.error('❌', errorMsg);
          alert(errorMsg);
        });
    } else {
      console.log('Formulario inválido');
    }
  }

  get isPasswordValid(): boolean {
    return this.hasMinLength && this.hasUppercase && this.hasSymbol && this.hasNumber;
  }



  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }



  goBack() {
    this.navCtrl.back();
  }
}
