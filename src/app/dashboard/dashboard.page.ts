// src/app/dashboard/dashboard.page.ts

import { Component, OnInit } from '@angular/core';
import { AlertController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [IonicModule, CommonModule],
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage implements OnInit {
  user: any = null;

  /** Límite mensual original */
  public monthlyLimit = 0;
  /** Límite restante tras gastos del mes */
  public limitLeft = 0;
  /** % de límite usado */
  public percentOfLimit = 0;

  /** Total ingresado este mes */
  ingresoMes = 0;
  /** Total gastado este mes */
  gastosMes = 0;
  /** Saldo disponible (ingresoMes - gastosMes) */
  public saldo = 0;

  movimientos: any[] = [];
  isBalanceHidden = false;
  tarjeta = '';
  isUserPanelExpanded = false;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    public  router: Router,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    // Nos suscribimos para el panel de usuario
    this.authService.user$.subscribe(u => this.user = u);

    // Descargamos el perfil completo
    this.authService.getCurrentUser().subscribe({
      next: user => {
        this.user = user;
        this.monthlyLimit = user.limite_mensual ?? 0;
        this.tarjeta = user.tarjeta || '';
        // iniciamos los valores
        this.ingresoMes = 0;
        this.gastosMes = 0;
        this.limitLeft = this.monthlyLimit;
        this.percentOfLimit = 0;
        this.saldo = user.saldo; // momentáneamente el saldo real, pero luego lo recalculamos
        this.loadMovimientos();
      },
      error: err => console.error('Error al obtener perfil', err)
    });
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

  conoceTuApp()   { console.log('Navegar a Conoce tu App'); }
  politicaUso()   { console.log('Navegar a Política de uso'); }
  contactenos()   { console.log('Navegar a Contáctenos'); }
  cerrarSesion()  { this.authService.logout(); }

  private loadMovimientos() {
    const headers = { Authorization: `Token ${this.authService.getToken()}` };
    this.http.get<any[]>('http://localhost:8000/api/movimientos/', { headers })
      .subscribe({
        next: data => {
          this.movimientos = data;
          this.computeMonthlyStats();
        },
        error: err => console.error('Error al obtener movimientos', err)
      });
  }

  private computeMonthlyStats() {
    const now   = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

    const movMes = this.movimientos
      .filter(m => new Date(m.fecha) >= inicioMes);

    // sumas
    this.ingresoMes = movMes
      .filter(m => m.tipo === 'ingreso')
      .reduce((sum, m) => sum + +m.monto, 0);

    this.gastosMes = movMes
      .filter(m => m.tipo === 'gasto')
      .reduce((sum, m) => sum + +m.monto, 0);

    // 1) recalculamos de verdad el saldo disponible
    this.saldo = this.ingresoMes - this.gastosMes;

    // 2) límite restante y % de uso
    this.limitLeft = this.monthlyLimit - this.gastosMes;
    if (this.monthlyLimit > 0) {
      this.percentOfLimit = Math.min(
        Math.round((this.gastosMes / this.monthlyLimit) * 100),
        100
      );
    } else {
      this.percentOfLimit = 0;
    }
  }

  async onAddCard() {
    const alert = await this.alertCtrl.create({
      header: 'Agregar Tarjeta',
      inputs: [
        { name: 'cardNumber', type: 'text', placeholder: 'Número 16 dígitos', attributes: { maxlength: 16 } }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: data => {
            const nums = (data.cardNumber||'').replace(/\D/g,'').padEnd(16,'•');
            const formatted = nums.match(/.{1,4}/g)?.join('-') ?? nums;
            this.authService.addCard(formatted).subscribe(() => {
              // volvemos a recargar perfil y movimientos
              this.authService.getCurrentUser().subscribe(() => this.loadMovimientos());
            });
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
          handler: data => {
            const x = Number(data.limite);
            if (x > 0) {
              this.authService.setLimit(x).subscribe(() => this.loadMovimientos());
              return true;
            }
            return false;
          }
        }
      ]
    });
    await alert.present();
  }
}
