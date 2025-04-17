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
  // ===== Estado principal =====
  saldo        = 0;       // balance disponible
  limite       = 0;       // límite mensual
  gastosMes    = 0;       // suma de gastos en mes actual
  ingresoMes   = 0;       // suma de ingresos en mes actual
  movimientos: any[] = []; 
  public isBalanceHidden = false;

  // <-- Nueva propiedad para mostrar la tarjeta formateada -->
  tarjeta: string = '';

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

    // 1) Cargo saldo + límite desde el endpoint /api/user/
    this.authService.getCurrentUser().subscribe({
      next: user => {
        this.saldo  = user.saldo;
        this.limite = user.limite_mensual ?? 0;
      },
      error: err => {
        console.error('Error al obtener datos de usuario', err);
      }
    });

    // 2) Cargo movimientos y computo gastos/ingresos
    this.loadMovimientos();
  }

  // ===== Mostrar / ocultar saldo =====
  toggleBalance() {
    this.isBalanceHidden = !this.isBalanceHidden;
  }

  // ===== Movimientos del mes =====
  loadMovimientos() {
    const token   = this.authService.getToken();
    const headers = new HttpHeaders({ Authorization: `Token ${token}` });

    this.http
      .get<any[]>('http://localhost:8000/api/movimientos/', { headers })
      .subscribe({
        next: data => {
          this.movimientos = data;
          this.computeMonthlyStats(data);
        },
        error: err => console.error('Error al obtener movimientos', err)
      });
  }

  private computeMonthlyStats(data: any[]) {
    const now      = new Date();
    const start    = new Date(now.getFullYear(), now.getMonth(), 1);
    const movMes   = data.filter(m => new Date(m.fecha) >= start);

    this.gastosMes  = movMes
      .filter(m => m.tipo === 'gasto')
      .reduce((sum, m) => sum + +m.monto, 0);

    this.ingresoMes = movMes
      .filter(m => m.tipo === 'ingreso')
      .reduce((sum, m) => sum + +m.monto, 0);
  }

  // ===== Agregar tarjeta (setea saldo a 500.000) =====
  async onAddCard() {
    const alert = await this.alertCtrl.create({
      header: 'Agregar Tarjeta',
      inputs: [
        {
          name: 'cardNumber',
          type: 'text',
          placeholder: 'Número de 16 dígitos',
          attributes: { maxlength: 16 }
        },
        {
          name: 'cardName',
          type: 'text',
          placeholder: 'Nombre en la tarjeta'
        },
        {
          name: 'expiry',
          type: 'month',
          placeholder: 'MM/AA'
        },
        {
          name: 'cvv',
          type: 'password',
          placeholder: 'CVV (3 dígitos)',
          attributes: { maxlength: 3 }
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: data => {
            // 1) Formatea tarjeta xxxx-xxxx-xxxx-xxxx
            const nums = (data.cardNumber || '').replace(/\D/g, '').padEnd(16, '•');
            this.tarjeta = nums.match(/.{1,4}/g)?.join('-') ?? nums;

            // 2) Llamada al backend para inicializar saldo=500000
            this.authService.addCard().subscribe({
              next: res => {
                this.saldo      = res.saldo;
                this.ingresoMes = res.saldo;  // actualiza ingreso mensual
                this.gastosMes  = 0;          // reinicia gastos
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

  // ===== Poner límite mensual =====
  async onSetLimit() {
    const alert = await this.alertCtrl.create({
      header: 'Poner Límite Mensual',
      inputs: [
        {
          name: 'limite',
          type: 'number',
          placeholder: 'Ingresa tu límite',
          attributes: { min: 1 }
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: data => {
            const x = Number(data.limite);
            if (isNaN(x) || x <= 0) return false;
            this.authService.setLimit(x).subscribe({
              next: res => {
                this.limite = res.limite;
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
