// src/app/graficos/graficos.page.ts

import 'chart.js/auto';
import { Component, OnInit }        from '@angular/core';
import { IonicModule }               from '@ionic/angular';
import { CommonModule }              from '@angular/common';
import { HttpClient }                from '@angular/common/http';
import { RouterModule, Router, NavigationEnd }     from '@angular/router';
import { filter }                    from 'rxjs/operators';
import { ChartData, ChartOptions }   from 'chart.js';
import { NgChartsModule }            from 'ng2-charts';
import { AuthService }               from '../services/auth.service';


@Component({
  selector: 'app-graficos',
  standalone: true,
  imports: [
    IonicModule,
    CommonModule,
    NgChartsModule,
    RouterModule
  ],
  templateUrl: './graficos.page.html',
  styleUrls: ['./graficos.page.scss'],
})
export class GraficosPage implements OnInit {

  public user: any;
  /** Límite mensual del usuario */
  private monthlyLimit = 0;

  /** Saldo restante del límite */
  public limitLeft = 0;

  /** Mensaje contextual */
  public limitMessage = '';

  /** Gauge semicircular: % de límite gastado */
  public gaugeData!: ChartData<'doughnut'>;
  public gaugeOpts: ChartOptions<'doughnut'> = {
    responsive: true,
    cutout: '70%',            // grosor del anillo
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false }
    }
  };

  /** Pie Chart: Gastos por categoría */
  public pieData!: ChartData<'pie'>;
  public pieOpts: ChartOptions<'pie'> = { responsive: true, plugins: { legend: { position: 'bottom' } } };

  /** Doughnut: Gastos vs Ingresos */
  public doughnutData!: ChartData<'doughnut'>;
  public doughnutOpts: ChartOptions<'doughnut'> = { responsive: true, plugins: { legend: { position: 'bottom' } } };

  /** Line: Evolución diaria de gastos */
  public lineData!: ChartData<'line'>;
  public lineOpts: ChartOptions<'line'> = {
    responsive: true,
    scales: {
      x: { title: { display: true, text: 'Día del mes' } },
      y: { title: { display: true, text: 'Monto (CLP)' } }
    },
    plugins: { legend: { display: false } },
    elements: { line: { tension: 0.4, borderWidth: 3 }, point: { radius: 4, hoverRadius: 6 } }
  };

  private apiUrl = 'http://127.0.0.1:8000/api/movimientos/';

  constructor(
    private auth: AuthService,
    private http: HttpClient,
    private router: Router
  ) {
    this.router.events.pipe(
      filter(evt =>
        evt instanceof NavigationEnd &&
        (evt as NavigationEnd).urlAfterRedirects === '/graficos'
      )
    ).subscribe(() => this.fetchAndBuildCharts());
  }

  goTo(path: string) {
    this.router.navigate([path]);
  }

  ngOnInit() {}

  private fetchAndBuildCharts() {
    const token = this.auth.getToken()!;
    const headers = { Authorization: `Token ${token}` };
  
    // 1) recarga el perfil
    this.auth.getCurrentUser().subscribe(user => {
      // actualiza localStorage con el perfil fresquito
      localStorage.setItem('user_data', JSON.stringify(user));
      this.user = user;                // si lo necesitas en este componente
      this.monthlyLimit = Number(user.limite_mensual) || 0;
  
      // 2) luego traes los movimientos
      this.http.get<any[]>(this.apiUrl, { headers }).subscribe(
        movs => {
          this.computeLimitLeft(movs);
          /* … resto de builds … */
          this.buildGauge(movs);
          this.buildPieByCategory(movs);
          this.buildDoughnut(movs);
          this.buildLine(movs);
        },
        err => console.error('Error cargando movimientos', err)
      );
    }, err => console.error('No pude refrescar el usuario', err));
  }
  

  private computeLimitLeft(movs: any[]) {
    const start = new Date(); start.setDate(1);
    const thisMonth = movs.filter(m => new Date(m.fecha) >= start);
    const totalGasto = thisMonth.filter(m => m.tipo === 'gasto')
                                .reduce((sum, m) => sum + +m.monto, 0);
    this.limitLeft = this.monthlyLimit - totalGasto;

    if (this.limitLeft > 0) {
      this.limitMessage = `¡Genial! Te quedan $${this.limitLeft.toLocaleString()}.`;
    } else if (this.limitLeft === 0) {
      this.limitMessage = 'Cuidado, agotaste tu límite.';
    } else {
      this.limitMessage = `Has sobrepasado tu límite en $${Math.abs(this.limitLeft).toLocaleString()}.`;
    }
  }

  /** Construye el gauge semicircular */
  private buildGauge(movs: any[]) {
    const spent = this.monthlyLimit - this.limitLeft;
    const pct = this.monthlyLimit > 0
      ? Math.min(spent / this.monthlyLimit * 100, 100)
      : 0;

    this.gaugeData = {
      labels: ['Usado', 'Restante'],
      datasets: [{
        data: [pct, 100 - pct],
        backgroundColor: [
          'rgba(239, 71, 111, 0.8)',   // rojo para usado
          'rgba(200, 200, 200, 0.3)'   // gris suave para restante
        ],
        borderWidth: 0
      }]
    };
  }

  private buildPieByCategory(movs: any[]) {
    const gastos = movs.filter(m => m.tipo === 'gasto' && m.categoria_nombre);
    const byCat = gastos.reduce((acc: Record<string, number>, m) => {
      acc[m.categoria_nombre] = (acc[m.categoria_nombre] || 0) + +m.monto;
      return acc;
    }, {});

    this.pieData = {
      labels: Object.keys(byCat),
      datasets: [{
        data: Object.values(byCat),
        backgroundColor: Object.keys(byCat).map((_, i) =>
          i % 2 === 0
            ? 'rgba(239, 71, 111, 0.8)'
            : 'rgba(66, 163, 77, 0.8)'
        ),
        hoverOffset: 8
      }]
    };
  }

  private buildDoughnut(movs: any[]) {
    const start = new Date(); start.setDate(1);
    const thisMonth = movs.filter(m => new Date(m.fecha) >= start);
    const gastos = thisMonth.filter(m => m.tipo === 'gasto')
                            .reduce((s, m) => s + +m.monto, 0);
    const ingresos = thisMonth.filter(m => m.tipo === 'ingreso')
                              .reduce((s, m) => s + +m.monto, 0);

    this.doughnutData = {
      labels: ['Gastos', 'Ingresos'],
      datasets: [{
        label: 'Último mes',
        data: [gastos, ingresos],
        backgroundColor: [
          'rgba(239, 71, 111, 0.8)',
          'rgba(66, 163, 77, 0.8)'
        ],
        hoverBackgroundColor: [
          'rgba(239, 71, 111, 1)',
          'rgba(66, 163, 77, 1)'
        ],
        borderWidth: 0
      }]
    };
  }

  private buildLine(movs: any[]) {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
    const gastosPorDia = new Array<number>(daysInMonth).fill(0);

    movs.filter(m => m.tipo === 'gasto').forEach(m => {
      const d = new Date(m.fecha).getDate();
      gastosPorDia[d - 1] += +m.monto;
    });

    this.lineData = {
      labels,
      datasets: [{
        label: 'Gastos diarios',
        data: gastosPorDia,
        borderColor: 'rgba(78, 205, 196, 0.9)',
        backgroundColor: 'rgba(78, 205, 196, 0.3)',
        fill: true
      }]
    };
  }
}
