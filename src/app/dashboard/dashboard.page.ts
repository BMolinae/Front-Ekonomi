import { Component, OnInit } from '@angular/core';
import { AlertController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule],
})
export class DashboardPage implements OnInit {
  saldo = 0;
  private initialSaldo = 0;
  limiteMensual = 0;
  limite = 0;
  gastosMes = 0;
  ingresoMes = 0;
  movimientos: any[] = [];
  isBalanceHidden = false;
  tarjeta = '';
  isUserPanelExpanded = false;

  username = ''; // Mostrar nombre

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    const user = this.authService.getUserFromStorage();
    this.username = user?.first_name || user?.username || 'Usuario';

    this.authService.getCurrentUser().subscribe({
      next: user => {
        this.initialSaldo = user.saldo;
        this.saldo = user.saldo;
        this.limiteMensual = user.limite_mensual ?? 0;
        this.limite = this.limiteMensual > 0
          ? this.limiteMensual
          : this.initialSaldo;
        this.ingresoMes = this.initialSaldo;
      },
      error: err => console.error('Error al obtener datos de usuario', err)
    });

    this.loadMovimientos();
  }

  toggleBalance() {
    this.isBalanceHidden = !this.isBalanceHidden;
  }

  toggleUserPanel() {
    this.isUserPanelExpanded = !this.isUserPanelExpanded;
  }

  conoceTuApp() {
    console.log('Navegar a Conoce tu App');
  }

  politicaUso() {
    console.log('Navegar a Política de uso');
  }

  contactenos() {
    console.log('Navegar a Contáctenos');
  }

  cerrarSesion() {
    this.authService.logout();
  }

  loadMovimientos() {
    const token = this.authService.getToken();
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
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const movMes = data.filter(m => new Date(m.fecha) >= start);

    this.gastosMes = movMes
      .filter(m => m.tipo === 'gasto')
      .reduce((sum, m) => sum + +m.monto, 0);

    this.ingresoMes = movMes
      .filter(m => m.tipo === 'ingreso')
      .reduce((sum, m) => sum + +m.monto, 0);

    this.saldo = this.initialSaldo - this.gastosMes;

    const baseLimit = this.limiteMensual > 0
      ? this.limiteMensual
      : this.initialSaldo;
    this.limite = baseLimit - this.gastosMes;
  }

  async onAddExpense() {
    const alert = await this.alertCtrl.create({
      header: 'Nuevo Gasto',
      inputs: [
        { name: 'descripcion', type: 'text', placeholder: 'Descripción' },
        { name: 'monto', type: 'number', placeholder: 'Monto' }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: data => {
            if (!data.descripcion?.trim() || !data.monto) {
              return false;
            }
            const token = this.authService.getToken();
            const headers = new HttpHeaders({ Authorization: `Token ${token}` });

            this.http.post<any>(
              'http://localhost:8000/api/movimientos/',
              {
                tipo: 'gasto',
                descripcion: data.descripcion.trim(),
                monto: Number(data.monto)
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
        { name: 'cardNumber', type: 'text', placeholder: '16 dígitos', attributes: { maxlength: 16 } },
        { name: 'cardName', type: 'text', placeholder: 'Nombre tarjeta' },
        { name: 'expiry', type: 'month', placeholder: 'MM/AA' },
        { name: 'cvv', type: 'password', placeholder: 'CVV', attributes: { maxlength: 3 } }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: data => {
            if (
              !data.cardNumber?.trim() ||
              !data.cardName?.trim() ||
              !data.expiry ||
              !data.cvv?.trim()
            ) {
              return false;
            }
            const raw = data.cardNumber.replace(/\D/g, '').padEnd(16, '•');
            this.tarjeta = (raw.match(/.{1,4}/g) || []).join('-');

            this.authService.addCard().subscribe({
              next: res => {
                this.initialSaldo = res.saldo;
                this.saldo = res.saldo;
                this.ingresoMes = res.saldo;
                this.gastosMes = 0;
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

  async onSetLimit(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Poner Límite Mensual',
      inputs: [
        {
          name: 'limite',
          type: 'number',
          placeholder: 'Ingresa tu límite',
          value: '',
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
              return false;
            }

            this.authService.setLimit(nuevoLimite).subscribe({
              next: res => {
                this.limiteMensual = res.limite;
                this.limite = this.limiteMensual - this.gastosMes;
              },
              error: err => console.error('Error al fijar límite', err)
            });

            return true;
          }
        }
      ]
    });

    await alert.present();
  }
}
