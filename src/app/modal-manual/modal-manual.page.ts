import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { ManualTransactionService } from '../services/manual-transaction.service';
import { FormsModule } from '@angular/forms';

@Component({
  
  
  selector: 'app-modal-manual',
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule, FormsModule],
  templateUrl: './modal-manual.page.html',
  styleUrls: ['./modal-manual.page.scss'],
})
export class ModalManualPage {
  movimiento = {
    descripcion: '',
    monto: null,
    tipo: 'gasto',
    categoria: 'Otros'
  };

  categorias = [
    { value: 'Transporte', label: 'Transporte' },
    { value: 'Alimentacion', label: 'Alimentación' },
    { value: 'Salud', label: 'Salud' },
    { value: 'Educacion', label: 'Educación' },
    { value: 'Entretenimiento', label: 'Entretenimiento' },
    { value: 'Servicios', label: 'Servicios' },
    { value: 'Compras', label: 'Compras' },
    { value: 'Vivienda', label: 'Vivienda' },
    { value: 'Ropa', label: 'Ropa' },
    { value: 'Regalos', label: 'Regalos' },
    { value: 'Otros', label: 'Otros' }
  ];

  constructor(
    private manualTransactionService: ManualTransactionService,
    private router: Router,
    private toastController: ToastController
  ) { }

  async guardarMovimiento() {
    if (!this.validarFormulario()) return;

    try {
      const montoNumber = Number(this.movimiento.monto);
      await this.manualTransactionService.addTransaction({
        descripcion: this.movimiento.descripcion.trim(),
        monto: this.movimiento.tipo === 'ingreso' ? montoNumber : -montoNumber,
        tipo: this.movimiento.tipo,
        categoria: this.movimiento.categoria,
        fecha: new Date().toISOString()
      });

      await this.mostrarToast('Movimiento guardado correctamente');
      this.router.navigate(['/modo-dashboard']); // Redirige de vuelta
    } catch (error) {
      console.error('Error guardando movimiento:', error);
      this.mostrarToast('Error al guardar movimiento');
    }
  }

  cancelar() {
    this.router.navigate(['/modo-dashboard']); // Redirige sin guardar
  }

  private validarFormulario(): boolean {
    if (!this.movimiento.descripcion || !this.movimiento.monto) {
      this.mostrarToast('Descripción y monto son requeridos');
      return false;
    }

    const montoNumber = Number(this.movimiento.monto);
    if (isNaN(montoNumber)) {
      this.mostrarToast('El monto debe ser un número válido');
      return false;
    }

    if (montoNumber <= 0) {
      this.mostrarToast('El monto debe ser mayor a cero');
      return false;
    }

    return true;
  }

  private async mostrarToast(mensaje: string) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 3000,
      position: 'top'
    });
    await toast.present();
  }
}