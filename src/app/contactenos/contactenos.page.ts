import { Component } from '@angular/core';
import { IonicModule, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms'; // Necesario para [(ngModel)]

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
  nombre: string = '';
  correo: string = '';
  asunto: string = '';
  mensaje: string = '';

  constructor(private toastController: ToastController) {}

  async enviarMensaje() {
    if (!this.nombre || !this.correo || !this.asunto || !this.mensaje) {
      this.mostrarToast('Por favor, completa todos los campos.');
      return;
    }

    // Simulación de envío
    this.mostrarToast('Mensaje enviado correctamente ✅');

    // Limpiar campos
    this.nombre = '';
    this.correo = '';
    this.asunto = '';
    this.mensaje = '';
  }

  async mostrarToast(mensaje: string) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 2000,
      position: 'bottom',
      cssClass: 'custom-toast', // <- Aplica tu estilo
      animated: true,
      color: '', // Lo manejamos por CSS
    });
    await toast.present();
  }
}
