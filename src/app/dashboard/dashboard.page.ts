// src/app/dashboard/dashboard.page.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { AlertController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { Router, RouterModule } from '@angular/router';
import { interval, switchMap, tap, catchError, of, Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule],
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage implements OnInit, OnDestroy {
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

  /** Subscripción del refresco */
  private pollSub?: Subscription;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    public router: Router,
    private alertCtrl: AlertController
  ) {}

  /* ------------------------- CICLO DE VIDA ------------------------- */
  ngOnInit() {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    this.authService.user$.subscribe(u => (this.user = u));

    this.authService.getCurrentUser().subscribe({
      next: user => {
        this.user = user;
        this.monthlyLimit = user.limite_mensual ?? 0;
        this.tarjeta = user.tarjeta || '';
        this.ingresoMes = 0;
        this.gastosMes = 0;
        this.limitLeft = this.monthlyLimit;
        this.percentOfLimit = 0;
        this.saldo = user.saldo;
        this.loadMovimientos();
        this.startAutoRefresh();
      },
      error: err => console.error('Error al obtener perfil', err),
    });
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
  }

  /* ------------------------- AUTO‑REFRESH ------------------------- */
  private startAutoRefresh() {
    this.pollSub = interval(5_000)
      .pipe(
        switchMap(() => this.authService.getCurrentUser()),
        tap(user => {
          this.user = user;
          this.monthlyLimit = user.limite_mensual ?? 0;
          this.tarjeta = user.tarjeta || '';
          this.saldo = user.saldo;
        }),
        switchMap(() => this.fetchMovimientos())
      )
      .subscribe();
  }

  /** Encapsula la petición HTTP y recalcula estadísticas */
  private fetchMovimientos() {
    const headers = { Authorization: `Token ${this.authService.getToken()}` };
    return this.http.get<any[]>('http://localhost:8000/api/movimientos/', { headers }).pipe(
      tap(data => {
        this.movimientos = data;
        this.computeMonthlyStats();
      }),
      catchError(err => {
        console.error('Error al obtener movimientos', err);
        return of([]);
      })
    );
  }

  private loadMovimientos() {
    this.fetchMovimientos().subscribe();
  }

  /* ------------------------- ACCIONES DE UI ------------------------- */
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
  }

  /* ------------------------- CÁLCULO DE ESTADÍSTICAS ------------------------- */
  private computeMonthlyStats() {
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

    const movMes = this.movimientos.filter(m => new Date(m.fecha) >= inicioMes);

    this.ingresoMes = movMes
      .filter(m => m.tipo === 'ingreso')
      .reduce((sum, m) => sum + +m.monto, 0);

    this.gastosMes = movMes
      .filter(m => m.tipo === 'gasto')
      .reduce((sum, m) => sum + +m.monto, 0);

    this.saldo = this.ingresoMes - this.gastosMes;
    this.limitLeft = this.monthlyLimit - this.gastosMes;

    this.percentOfLimit = this.monthlyLimit > 0
      ? Math.min(Math.round((this.gastosMes / this.monthlyLimit) * 100), 100)
      : 0;
  }

  /* ------------------------- DIÁLOGOS ------------------------- */
  async onAddCard() {
    const alert = await this.alertCtrl.create({
      header: 'Agregar Tarjeta',
      inputs: [
        {
          name: 'cardNumber',
          type: 'text',
          placeholder: 'Número 16 dígitos',
          attributes: { maxlength: 16 }
        },
        {
          name: 'cardHolder',
          type: 'text',
          placeholder: 'Nombre del Titular',
          value: ''
        },
        {
          name: 'expiryDate',
          type: 'month',
          placeholder: 'Fecha de Vencimiento (MM/AA)',
          value: ''
        },
        {
          name: 'cvv',
          type: 'password',
          placeholder: 'CVV',
          attributes: { maxlength: 4 },
          value: ''
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: data => {
            /* -------- VALIDACIÓN BÁSICA -------- */
            const rawNumber = (data.cardNumber || '').replace(/\D/g, '');
            const holder = (data.cardHolder || '').trim();
            const expiry = data.expiryDate || '';
            const cvv = (data.cvv || '').trim();

            const isValid =
              rawNumber.length === 16 &&
              holder.length > 0 &&
              expiry.length > 0 &&
              cvv.length >= 3 && cvv.length <= 4;

            if (!isValid) {
              /* Cancelamos el cierre y mostramos un aviso */
              this.showToast('Completa correctamente todos los campos');
              return false; // <‑‑ impide que se cierre el alert
            }

            /* Si todo OK, formateamos y enviamos */
            const formatted = rawNumber.match(/.{1,4}/g)!.join('-');

            this.authService.addCard(formatted).subscribe({
              next: () => {
                /* refrescamos datos tras grabar */
                this.authService.getCurrentUser().subscribe(user => {
                  this.user = user;
                  this.tarjeta = user.tarjeta || '';
                });
              },
              error: err => console.error('Error al guardar tarjeta', err)
            });

            return true; // cierra el alert
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
            this.showToast('Ingresa un número mayor a 0');
            return false;
          }
        }
      ]
    });
    await alert.present();
  }
}
