import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { MovimientosService } from '../services/movimientos.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-modal-tarjeta',
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule, FormsModule],
  templateUrl: './modal-tarjeta.page.html',
  styleUrls: ['./modal-tarjeta.page.scss'],
})
export class ModalTarjetaPage {
  movimiento = {
    descripcion: '',
    monto: null,
    tipo: 'gasto',
    categoria: 'Otros',
    tarjeta: '' // Nuevo campo para la tarjeta
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
    private movimientosService: MovimientosService,
    private router: Router,
    private toastController: ToastController
  ) { }

  async guardarMovimiento() {
    if (!this.validarFormulario()) return;

    try {
      const montoNumber = Math.abs(Number(this.movimiento.monto)); // Asegurar positivo
      await this.movimientosService.agregarMovimiento(
        this.movimiento.tipo as 'ingreso' | 'gasto',
        this.movimiento.descripcion.trim(),
        montoNumber, // Enviar siempre positivo
        this.movimiento.categoria
      );

      await this.mostrarToast('Movimiento guardado correctamente');
      this.router.navigate(['/dashboard']);
    } catch (error) {
      console.error('Error guardando movimiento:', error);
      this.mostrarToast('Error al guardar movimiento');
    }
  }

  cancelar() {
    this.router.navigate(['/dashboard']); // Redirige sin guardar
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