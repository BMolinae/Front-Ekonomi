import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
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
  saldoTotal: number | null = null;
  movimientos: any[] = [];

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    this.obtenerMovimientos();
  }

  obtenerMovimientos() {
    const token = this.authService.getToken();
    const headers = { Authorization: `Token ${token}` };

    this.http.get<any[]>('http://tu-backend-django.com/api/movimientos/', { headers })
      .subscribe({
        next: data => {
          this.movimientos = data;
          this.saldoTotal = this.calcularSaldo(data);
        },
        error: err => {
          console.error('Error al obtener movimientos', err);
        }
      });
  }

  calcularSaldo(movimientos: any[]): number {
    return movimientos.reduce((total, mov) => {
      return mov.tipo === 'ingreso' ? total + mov.monto : total - mov.monto;
    }, 0);
  }
}
