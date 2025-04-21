import { Component, OnInit } from '@angular/core';
import { AlertController, MenuController, IonicModule } from '@ionic/angular';
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
  user: any = null;
  saldo = 0;
  limite = 0;
  gastosMes = 0;
  ingresoMes = 0;
  movimientos: any[] = [];
  isBalanceHidden = false;
  tarjeta: string = '';
  isUserPanelExpanded = false;
  headerHidden = false;
  private lastScrollTop = 0;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router,
    private alertCtrl: AlertController,
    private menu: MenuController
  ) {}

  ngOnInit() {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    // Obtener datos de usuario
    this.authService.user$.subscribe(user => {
      this.user = user;
    });

    this.authService.getCurrentUser().subscribe({
      next: user => {
        this.user = user;
        this.saldo = user.saldo;
        this.limite = user.limite_mensual ?? 0;
        this.tarjeta = user.tarjeta || '';
        this.loadMovimientos();
      },
      error: err => console.error('Error al obtener datos de usuario', err)
    });
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
    console.log('Sesión cerrada');
  }

  onScroll(ev: any) {
    const current = ev.detail.scrollTop;
    this.headerHidden = current > this.lastScrollTop && current > 80;
    this.lastScrollTop = current;
  }

  loadMovimientos() {

    const headers = { Authorization: `Token ${this.authService.getToken()}` };

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

    this.saldo = this.saldo - this.gastosMes;
    this.limite = this.limite - this.gastosMes;
  }

  async onAddCard() {
    const alert = await this.alertCtrl.create({
      cssClass: 'custom-alert',
      header: 'Agregar Tarjeta',
      inputs: [
        { name: 'cardNumber', type: 'text', placeholder: 'Número de 16 dígitos', attributes: { maxlength: 16 } },
        { name: 'cardName', type: 'text', placeholder: 'Nombre en la tarjeta' },
        { name: 'expiry', type: 'month', placeholder: 'MM/AA' },
        { name: 'cvv', type: 'password', placeholder: 'CVV (3 dígitos)', attributes: { maxlength: 3 } }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: data => {
            const nums = (data.cardNumber || '').replace(/\D/g, '').padEnd(16, '•');
            const formatted = nums.match(/.{1,4}/g)?.join('-') ?? nums; 
            this.authService.addCard(formatted).subscribe({
              next: res => {
                this.saldo = res.saldo;
                this.tarjeta = res.tarjeta;
                this.ingresoMes = res.saldo;
                this.gastosMes = 0;
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

  async onSetLimit() {
    const alert = await this.alertCtrl.create({
      cssClass: 'custom-alert',
      header: 'Poner Límite Mensual',
      inputs: [
        { name: 'limite', type: 'number', placeholder: 'Ingresa tu límite', attributes: { min: 1 } }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: data => {
            const x = Number(data.limite);
            if (isNaN(x) || x <= 0) return false;

            this.authService.setLimit(x).subscribe({
              next: res => { this.limite = res.limite; },
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
