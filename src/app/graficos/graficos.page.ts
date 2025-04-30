import 'chart.js/auto';
import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ChartData, ChartOptions } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { AuthService } from '../services/auth.service';



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
  public monthlyLimit = 0;
  public limitLeft = 0;
  public limitMessage = '';

  public gaugeData!: ChartData<'doughnut'>;
  public gaugeOpts: ChartOptions<'doughnut'> = {
    responsive: true,
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false }
    }
  };

  public pieData!: ChartData<'pie'>;
  public pieOpts: ChartOptions<'pie'> = { responsive: true, plugins: { legend: { position: 'bottom' } } };

  public doughnutData!: ChartData<'doughnut'>;
  public doughnutOpts: ChartOptions<'doughnut'> = { responsive: true, plugins: { legend: { position: 'bottom' } } };

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

  public barData!: ChartData<'line'>;
  public barOpts: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        title: { display: true, text: 'Mes' },
        ticks: { font: { size: 14 }, maxRotation: 0, minRotation: 0 }
      },
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Monto (CLP)' },
        ticks: { font: { size: 14 } }
      }
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { font: { size: 14 } }
      }
    }
  };
  
  

  private apiUrl = 'http://127.0.0.1:8000/api/movimientos/';

  public currentMonth = '';
  public usedLimit = 0;
  public usedPercentage = 0;
  public availablePercentage = 0;
  public totalExpenses = 0;

  public categoryData: { name: string; percent: number; amount: number; color: string; }[] = [];
  public strokeCircumference = 251.2;
  public strokeDashOffset = 0;

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

    this.auth.getCurrentUser().subscribe(user => {
      localStorage.setItem('user_data', JSON.stringify(user));
      this.user = user;
      this.monthlyLimit = Number(user.limite_mensual) || 0;

      this.http.get<any[]>(this.apiUrl, { headers }).subscribe(
        movs => {
          this.computeLimitLeft(movs);
          this.buildGauge(movs);
          this.buildPieByCategory(movs);
          this.buildDoughnut(movs);
          this.buildLine(movs);
          this.buildMonthlyComparison(movs);
          this.updateFinancialSummary(movs);
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
          'rgba(239, 71, 111, 0.8)',
          'rgba(200, 200, 200, 0.3)'
        ],
        borderWidth: 0
      }]
    };
  }

  private buildPieByCategory(movs: any[]) {
    const start = new Date(); start.setDate(1);
    const thisMonth = movs.filter(m => new Date(m.fecha) >= start);

    const gastos = thisMonth.filter(m => m.tipo === 'gasto' && m.categoria_nombre);
    const byCat = gastos.reduce((acc: Record<string, number>, m) => {
      acc[m.categoria_nombre] = (acc[m.categoria_nombre] || 0) + +m.monto;
      return acc;
    }, {});

    const categoryColors: Record<string, string> = {
      Transporte: '#2196f3',
      Comida: '#ff9800',
      Extras: '#9c27b0'
    };

    const labels = Object.keys(byCat);
    const data = Object.values(byCat);
    const backgroundColor = labels.map(cat => categoryColors[cat] || '#607d8b');

    this.pieData = {
      labels,
      datasets: [{
        data,
        backgroundColor,
        hoverOffset: 8
      }]
    };

    const totalGastos = data.reduce((sum, val) => sum + val, 0);
    this.categoryData = labels.map((cat, idx) => ({
      name: cat,
      amount: data[idx],
      percent: totalGastos ? Math.round((data[idx] / totalGastos) * 100) : 0,
      color: backgroundColor[idx]
    }));
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

  private buildMonthlyComparison(movs: any[]) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
  
    const months = [...Array(4)].map((_, i) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 3 + i);
      return {
        label: d.toLocaleString('default', { month: 'long' }),
        month: d.getMonth(),
        year: d.getFullYear()
      };
    });
  
    const ingresos = Array(4).fill(0);
    const gastos = Array(4).fill(0);
  
    movs.forEach(m => {
      const fecha = new Date(m.fecha);
      months.forEach((month, idx) => {
        if (fecha.getMonth() === month.month && fecha.getFullYear() === month.year) {
          if (m.tipo === 'ingreso') ingresos[idx] += +m.monto;
          if (m.tipo === 'gasto') gastos[idx] += +m.monto;
        }
      });
    });
  
    const labels = months.map(m => m.label[0].toUpperCase() + m.label.slice(1));
  
    this.barData = {
      labels,
      datasets: [
        {
          label: 'Ingresos',
          data: ingresos,
          fill: false,
          borderColor: '#4ecdc4',
          backgroundColor: '#4ecdc4',
          tension: 0.3,
          pointRadius: 5,
          pointHoverRadius: 7
        },
        {
          label: 'Gastos',
          data: gastos,
          fill: false,
          borderColor: '#ff6b6b',
          backgroundColor: '#ff6b6b',
          tension: 0.3,
          pointRadius: 5,
          pointHoverRadius: 7
        }
      ]
    };
  }
  
  
  
  

  private updateFinancialSummary(movs: any[]) {
    const start = new Date(); start.setDate(1);

    const thisMonth = movs.filter(m => new Date(m.fecha) >= start);
    const gastos = thisMonth.filter(m => m.tipo === 'gasto').reduce((sum, m) => sum + +m.monto, 0);
    const ingresos = thisMonth.filter(m => m.tipo === 'ingreso').reduce((sum, m) => sum + +m.monto, 0);

    this.usedLimit = gastos;
    this.totalExpenses = gastos;

    this.usedPercentage = this.monthlyLimit > 0 ? Math.round((this.usedLimit / this.monthlyLimit) * 100) : 0;
    this.availablePercentage = 100 - this.usedPercentage;

    this.strokeDashOffset = this.strokeCircumference * (1 - (this.usedPercentage / 100));

    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const now = new Date();
    this.currentMonth = `${meses[now.getMonth()]} ${now.getFullYear()}`;
  }
}
