import { Component } from '@angular/core';
import { IonicModule, NavController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms'; // Necesario para [(ngModel)]
import { EmailService } from '../services/email.service';

@Component({
  selector: 'app-contactenos',
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
  ],
  templateUrl: './contactenos.page.html',
  styleUrls: ['./contactenos.page.scss'],
})
export class ContactenosPage {
  nombre = '';
  correo = '';
  asunto = '';
  mensaje = '';

  constructor(
    private toastController: ToastController,
    private navCtrl: NavController,
    private emailService: EmailService
  ) { }

  goBack() {
    this.navCtrl.back();
  }

  async enviarMensaje() {
    if (!this.nombre || !this.correo || !this.asunto || !this.mensaje) {
      this.mostrarToast('Por favor, completa todos los campos.');
      return;
    }

    try {
      await this.emailService.sendContactEmail(this.nombre, this.correo, this.asunto, this.mensaje);
      this.mostrarToast('Mensaje enviado correctamente ✅');

      // Limpiar campos
      this.nombre = '';
      this.correo = '';
      this.asunto = '';
      this.mensaje = '';
    } catch (error) {
      console.error(error);
      this.mostrarToast('Error al enviar el mensaje ❌');
    }
  }

  async mostrarToast(mensaje: string) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 2000,
      position: 'bottom',
      cssClass: 'custom-toast',
      animated: true
    });
    await toast.present();
  }
}