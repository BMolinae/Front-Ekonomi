import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IonicModule, NavController, ToastController, AnimationController } from '@ionic/angular';
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
  
  // Variables para mensaje visual
  message: string | null = null;
  messageColor: 'success' | 'danger' = 'success';
  isSubmitting: boolean = false;
  
  constructor(
    private fb: FormBuilder,
    private navCtrl: NavController,
    private recoveryService: RecoveryService,
    private toastController: ToastController,
    private animationCtrl: AnimationController
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }
  
  // Enviar enlace de recuperación
  async onSubmit() {
    if (this.form.valid) {
      this.isSubmitting = true;
      const email = this.form.value.email;
      
      try {
        const resetLink = await this.recoveryService.requestRecoveryLink(email);
        await this.recoveryService.sendRecoveryEmail(email, resetLink);
        
        // Mostrar mensaje visual mejorado
        this.message = `Enlace de recuperación enviado a ${this.maskEmail(email)}`;
        this.messageColor = 'success';
        
        // Animar el mensaje
        this.animateSuccessMessage();
        
        // Limpiar formulario
        this.form.reset();
        
        // Redirigir automáticamente después de 4 segundos
        setTimeout(() => {
          this.navCtrl.navigateBack('/login');
        }, 4000);
        
      } catch (error) {
        console.error('Error al enviar recuperación:', error);
        
        // Mostrar error visual
        this.message = 'No se pudo enviar el correo. Intenta más tarde.';
        this.messageColor = 'danger';
        
        // Mostrar toast con error detallado
        this.presentErrorToast();
      } finally {
        this.isSubmitting = false;
      }
    }
  }
  
  // Oculta parte del correo electrónico por privacidad
  private maskEmail(email: string): string {
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    
    const name = parts[0];
    const domain = parts[1];
    
    // Ocultar parte del nombre de usuario
    const maskedName = name.length <= 3 
      ? name 
      : name.substring(0, 2) + '●●●';
    
    return `${maskedName}@${domain}`;
  }
  
  // Animación del mensaje de éxito
  private animateSuccessMessage() {
    const messageElement = document.querySelector('.message-box.success') as HTMLElement;
    if (messageElement) {
      const animation = this.animationCtrl.create()
        .addElement(messageElement)
        .duration(600)
        .iterations(1)
        .keyframes([
          { offset: 0, transform: 'scale(0.95)', opacity: '0.8' },
          { offset: 0.5, transform: 'scale(1.02)', opacity: '1' },
          { offset: 1, transform: 'scale(1)', opacity: '1' }
        ]);
      
      animation.play();
    }
  }
  
  // Mostrar toast de error
  private async presentErrorToast() {
    const toast = await this.toastController.create({
      message: 'Error en el servidor. Por favor intenta más tarde.',
      duration: 3000,
      position: 'bottom',
      color: 'danger',
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });
    toast.present();
  }
  
  goBackToLogin() {
    this.navCtrl.navigateBack('/login');
  }
  
  goBack() {
    this.navCtrl.back();
  }
}