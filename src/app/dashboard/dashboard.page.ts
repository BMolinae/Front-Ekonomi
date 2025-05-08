// src/app/dashboard/dashboard.page.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { AlertController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription, interval, switchMap, tap, of, catchError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { MovimientosService } from '../services/movimientos.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule],
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage implements OnInit, OnDestroy {
  user: any = null;
  movimientos: any[] = [];

  saldo = 0;
  tarjeta = '';
  ingresoMes = 0;
  gastosMes = 0;
  limitLeft = 0;
  percentOfLimit = 0;
  monthlyLimit = 0;

  isBalanceHidden = false;
  isUserPanelExpanded = false;

  private pollSub?: Subscription;

  constructor(
    private router: Router,
    private alertCtrl: AlertController,
    private authService: AuthService,
    private movimientosService: MovimientosService
  ) {}

  ngOnInit() {
    this.authService.user$.subscribe(user => {
      this.user = user;
      if (user) {
        this.tarjeta = user.tarjeta || '';
        this.monthlyLimit = user.limite_mensual || 0;
        this.loadMovimientos();
        this.startAutoRefresh();
      } else {
        this.router.navigate(['/login']);
      }
    });
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
  }

  private startAutoRefresh() {
    this.pollSub = interval(5000)
      .pipe(
        switchMap(() => this.authService.getCurrentUser()),
        tap(user => {
          this.user = user;
          this.tarjeta = user.tarjeta || '';
          this.monthlyLimit = user.limite_mensual || 0;
        }),
        switchMap(() => this.movimientosService.obtenerMovimientos()),
        tap(movs => {
          this.movimientos = movs;
          this.computeMonthlyStats();
        }),
        catchError(err => {
          console.error('Error en auto-refresh', err);
          return of([]);
        })
      )
      .subscribe();
  }

  private loadMovimientos() {
    this.movimientosService.obtenerMovimientos().then(movs => {
      this.movimientos = movs;
      this.computeMonthlyStats();
    }).catch(err => console.error('Error al cargar movimientos', err));
  }

  private computeMonthlyStats() {
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
    const movMes = this.movimientos.filter(m => new Date(m.fecha) >= inicioMes);
  
    const ingresos = movMes
      .filter(m => m.tipo === 'ingreso')
      .reduce((sum, m) => sum + +m.monto, 0);
  
    const gastos = movMes
      .filter(m => m.tipo === 'gasto')
      .reduce((sum, m) => sum + +m.monto, 0);
  
    const nuevoSaldo = ingresos - gastos;
    const nuevoLimite = this.monthlyLimit - gastos;
  
    this.ingresoMes = ingresos;
    this.gastosMes = gastos;
    this.saldo = nuevoSaldo;
    this.limitLeft = nuevoLimite;
  
    this.percentOfLimit = this.monthlyLimit > 0
      ? Math.min(Math.round((gastos / this.monthlyLimit) * 100), 100)
      : 0;
  
    this.saveFinancialData();
  
    // ✅ Solo actualizar si el saldo realmente cambió
    if (this.user && this.user.saldo !== nuevoSaldo) {
      this.authService.updateSaldo(nuevoSaldo);
    }
  }
  
  private saveFinancialData() {
    const data = {
      saldo: this.saldo,
      gastosMes: this.gastosMes,
      ingresoMes: this.ingresoMes,
      limitLeft: this.limitLeft,
    };
    localStorage.setItem('user_financial_data', JSON.stringify(data));
  }

  goTo(path: string) {
    this.router.navigate([path]);
  }

  toggleBalance() {
    this.isBalanceHidden = !this.isBalanceHidden;
  }

  toggleUserPanel() {
    this.isUserPanelExpanded = !this.isUserPanelExpanded;
  }

  conoceTuApp() {
    this.goTo('conoce-tu-app');
  }

  politicaUso() {
    this.goTo('politica-uso');
  }

  contactenos() {
    this.goTo('contactenos');
  }

  cerrarSesion() {
    this.authService.logout();
    this.router.navigate(['/home']);
  }

  getCategoriaIcono(nombreCategoria: string): string {
    const iconos: any = {
      Transporte: 'bus-outline',
      Alimentacion: 'restaurant-outline',
      Salud: 'medkit-outline',
      Educacion: 'book-outline',
      Entretenimiento: 'game-controller-outline',
      Hogar: 'home-outline',
      Otros: 'ellipsis-horizontal-outline',
    };
    return iconos[nombreCategoria] || 'pricetag-outline';
  }

  async onAddCard() {
    const alert = await this.alertCtrl.create({
      header: 'Agregar Tarjeta',
      inputs: [
        { name: 'cardNumber', type: 'text', placeholder: 'Número 16 dígitos', attributes: { maxlength: 16 } },
        { name: 'cardHolder', type: 'text', placeholder: 'Nombre del Titular' },
        { name: 'expiryDate', type: 'month', placeholder: 'Fecha de Vencimiento' },
        { name: 'cvv', type: 'password', placeholder: 'CVV', attributes: { maxlength: 3 } }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async data => {
            const rawNumber = (data.cardNumber || '').replace(/\D/g, '');
            const holder = (data.cardHolder || '').trim();
            const expiry = data.expiryDate || '';
            const cvv = (data.cvv || '').trim();

            const isValid = rawNumber.length === 16 && holder && expiry && cvv.length >= 3;
            if (!isValid) {
              this.showToast('Completa correctamente todos los campos');
              return false;
            }

            const formatted = rawNumber.match(/.{1,4}/g)!.join('-');

            try {
              // Solo guarda la tarjeta. Movimiento ya se crea en AuthService
              await this.authService.addCard(formatted);

              // Refresca datos
              const updated = await this.authService.getCurrentUser();
              this.user = updated;
              this.tarjeta = updated.tarjeta || '';
              await this.loadMovimientos();
            } catch (err) {
              console.error('Error al guardar tarjeta o crear movimiento', err);
              this.showToast('Hubo un error al guardar la tarjeta');
            }

            return true;
          }
        }
      ]
    });

    await alert.present();
  }

  async onSetLimit() {
    const alert = await this.alertCtrl.create({
      header: 'Poner Límite Mensual',
      inputs: [{ name: 'limite', type: 'number', placeholder: 'Ingresa límite' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async data => {
            const x = Number(data.limite);
            if (x > 0) {
              await this.authService.setLimit(x);
              await this.loadMovimientos();
              return true;
            } else {
              this.showToast('Ingresa un número mayor a 0');
              return false;
            }
          }
        }
      ]
    });

    await alert.present();
  }

  private async showToast(message: string) {
    const toast = await this.alertCtrl.create({
      header: 'Aviso',
      message,
      buttons: [{ text: 'OK', role: 'cancel' }],
    });
    await toast.present();
  }
}
