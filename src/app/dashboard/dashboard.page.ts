// src/app/dashboard/dashboard.page.ts

import { Component, OnInit }       from '@angular/core';
import { AlertController, IonicModule } from '@ionic/angular';
import { CommonModule }            from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService }             from '../services/auth.service';
import { Router }                  from '@angular/router';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule],
})
export class DashboardPage implements OnInit {
  saldo           = 0;      // saldo disponible
  private initialSaldo = 0; // saldo inicial (al agregar tarjeta)
  limiteMensual   = 0;      // límite mensual fijado
  limite          = 0;      // límite disponible (actual)
  gastosMes       = 0;      // total gastos mes
  ingresoMes      = 0;      // total ingresos mes
  movimientos: any[] = [];
  isBalanceHidden = false;
  tarjeta         = '';     // tarjeta formateada

  constructor(
    private http:       HttpClient,
    private authService: AuthService,
    private router:     Router,
    private alertCtrl:  AlertController
  ) {}

  ngOnInit() {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    // 1) cargo datos de usuario
    this.authService.getCurrentUser().subscribe({
      next: user => {
        this.initialSaldo  = user.saldo;
        this.saldo         = user.saldo;
        this.limiteMensual = user.limite_mensual ?? 0;
        // si no hay límite, por ahora lo tratamos igual al saldo
        this.limite = this.limiteMensual > 0 
                      ? this.limiteMensual 
                      : this.initialSaldo;
        this.ingresoMes = this.initialSaldo;
      },
      error: err => console.error('Error al obtener datos de usuario', err)
    });

    // 2) cargo movimientos y recalculo stats
    this.loadMovimientos();
  }

  toggleBalance() {
    this.isBalanceHidden = !this.isBalanceHidden;
  }

  loadMovimientos() {
    const token   = this.authService.getToken();
    const headers = new HttpHeaders({ Authorization: `Token ${token}` });

    this.http.get<any[]>('http://localhost:8000/api/movimientos/', { headers })
      .subscribe({
        next: data => {
          this.movimientos = data;
          this.computeMonthlyStats(data);
        },
        error: err => console.error('Error al obtener movimientos', err)
      });
  }

  private computeMonthlyStats(data: any[]) {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const movMes = data.filter(m => new Date(m.fecha) >= start);

    // sumar gastos e ingresos del mes
    this.gastosMes  = movMes
      .filter(m => m.tipo === 'gasto')
      .reduce((sum, m) => sum + +m.monto, 0);

    this.ingresoMes = movMes
      .filter(m => m.tipo === 'ingreso')
      .reduce((sum, m) => sum + +m.monto, 0);

    // recalcular saldo y límite
    this.saldo  = this.initialSaldo - this.gastosMes;

    // si existe límite mensual (>0), lo uso; si no, lo trato igual al saldo inicial
    const baseLimit = this.limiteMensual > 0 
                      ? this.limiteMensual 
                      : this.initialSaldo;
    this.limite = baseLimit - this.gastosMes;
  }

  async onAddExpense() {
    const alert = await this.alertCtrl.create({
      header: 'Nuevo Gasto',
      inputs: [
        { name: 'descripcion', type: 'text',   placeholder: 'Descripción' },
        { name: 'monto',       type: 'number', placeholder: 'Monto' }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: data => {
            if (!data.descripcion?.trim() || !data.monto) {
              return false;
            }
            const token   = this.authService.getToken();
            const headers = new HttpHeaders({ Authorization: `Token ${token}` });

            this.http.post<any>(
              'http://localhost:8000/api/movimientos/',
              {
                tipo:        'gasto',
                descripcion: data.descripcion.trim(),
                monto:       Number(data.monto)
              },
              { headers }
            ).subscribe({
              next: mov => {
                this.movimientos.push(mov);
                this.computeMonthlyStats(this.movimientos);
              },
              error: err => console.error('Error al guardar gasto', err)
            });
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  async onAddCard() {
    const alert = await this.alertCtrl.create({
      header: 'Agregar Tarjeta',
      inputs: [
        { name: 'cardNumber', type: 'text',  placeholder: '16 dígitos',  attributes: { maxlength: 16 } },
        { name: 'cardName',   type: 'text',  placeholder: 'Nombre tarjeta' },
        { name: 'expiry',     type: 'month', placeholder: 'MM/AA' },
        { name: 'cvv',        type: 'password', placeholder: 'CVV', attributes: { maxlength: 3 } }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: data => {
            if (
              !data.cardNumber?.trim() ||
              !data.cardName?.trim()   ||
              !data.expiry            ||
              !data.cvv?.trim()
            ) {
              return false;
            }
            // formateo xxxx-xxxx-xxxx-xxxx
            const raw = data.cardNumber.replace(/\D/g, '').padEnd(16, '•');
            this.tarjeta = (raw.match(/.{1,4}/g) || []).join('-');

            this.authService.addCard().subscribe({
              next: res => {
                this.initialSaldo = res.saldo;
                this.saldo        = res.saldo;
                this.ingresoMes   = res.saldo;
                this.gastosMes    = 0;
                // baseLimit usa initialSaldo si no hay límiteMensual
                this.limite = (this.limiteMensual > 0 
                               ? this.limiteMensual 
                               : this.initialSaldo)
                              - this.gastosMes;
              },
              error: err => console.error('Error al agregar tarjeta', err)
            });
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

// Dentro de tu DashboardPage (dashboard.page.ts)

async onSetLimit(): Promise<void> {
  const alert = await this.alertCtrl.create({
    header: 'Poner Límite Mensual',
    inputs: [
      {
        name: 'limite',
        type: 'number',
        placeholder: 'Ingresa tu límite',
        value: '',              // siempre inicia vacío
        attributes: { min: 1 }
      }
    ],
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      {
        text: 'Guardar',
        handler: data => {
          const nuevoLimite = Number(data.limite);
          if (isNaN(nuevoLimite) || nuevoLimite <= 0) {
            return false;    // Si no es válido, no cierra el alert
          }

          // Llamamos al backend para fijar el nuevo límite
          this.authService.setLimit(nuevoLimite).subscribe({
            next: res => {
              // Guardamos el límite mensual original
              this.limiteMensual = res.limite;
              // Calculamos el límite disponible restando lo ya gastado
              this.limite = this.limiteMensual - this.gastosMes;
            },
            error: err => console.error('Error al fijar límite', err)
          });

          return true;       // Cierra el alert
        }
      }
    ]
  });

  await alert.present();
}

}
