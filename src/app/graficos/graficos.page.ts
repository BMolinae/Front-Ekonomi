import 'chart.js/auto';
import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ChartData, ChartOptions } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { AuthService } from '../services/auth.service';
import { collection, getDocs } from '@angular/fire/firestore';
import { Firestore } from '@angular/fire/firestore';
import { MovimientosService } from '../services/movimientos.service';


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
  public usedLimit = 0;
  public usedPercentage = 0;
  public availablePercentage = 0;
  public totalExpenses = 0;
  public currentMonth = '';
  public strokeCircumference = 251.2;
  public strokeDashOffset = 0;

  public categoriasMap: Record<string, string> = {};

  public pieData!: ChartData<'pie'>;
  public pieOpts: ChartOptions<'pie'> = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' }
    }
  };

  // Aquí van los demás charts si los usas
  public gaugeData!: ChartData<'doughnut'>;
  public gaugeOpts: ChartOptions<'doughnut'> = {
    responsive: true,
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false }
    }
  };

  public doughnutData!: ChartData<'doughnut'>;
  public doughnutOpts: ChartOptions<'doughnut'> = {
    responsive: true,
    plugins: { legend: { position: 'bottom' } }
  };

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
      x: { title: { display: true, text: 'Mes' } },
      y: { beginAtZero: true, title: { display: true, text: 'Monto (CLP)' } }
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { font: { size: 14 } }
      }
    }
  };

  constructor(
    private auth: AuthService,
    private firestore: Firestore,
    private movimientosService: MovimientosService

  ) {}

  ngOnInit() {
    this.loadData();
  }

  private async loadData() {
    try {
      const user = await this.auth.getCurrentUser();
      this.user = user;
      this.monthlyLimit = Number(user.limite_mensual) || 0;
  
      const movimientos: any[] = await this.movimientosService.obtenerMovimientos();
  
      await this.loadCategorias();
  
      this.computeLimitLeft(movimientos);
      this.buildGauge(movimientos);
      this.buildPieByCategory(movimientos);
      this.buildDoughnut(movimientos);
      this.buildLine(movimientos);
      this.buildMonthlyComparison(movimientos);
      this.updateFinancialSummary(movimientos);
    } catch (err) {
      console.error('Error al cargar datos del gráfico:', err);
    }
  }
  

  private async loadCategorias() {
    const ref = collection(this.firestore, 'Categorias');
    const snapshot = await getDocs(ref);
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data['nombre'] && data['color']) {
        this.categoriasMap[data['nombre']] = data['color'];
      }
    });
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
    const pct = this.monthlyLimit > 0 ? Math.min(spent / this.monthlyLimit * 100, 100) : 0;

    this.gaugeData = {
      labels: ['Usado', 'Restante'],
      datasets: [{
        data: [pct, 100 - pct],
        backgroundColor: ['rgba(239, 71, 111, 0.8)', 'rgba(200, 200, 200, 0.3)'],
        borderWidth: 0
      }]
    };
  }

  private buildPieByCategory(movs: any[]) {
    const start = new Date(); start.setDate(1);
    const thisMonth = movs.filter(m => new Date(m.fecha) >= start);
    const gastos = thisMonth.filter(m => m.tipo === 'gasto' && m.categoria);

    const byCat = gastos.reduce((acc: Record<string, number>, m) => {
      const cat = m.categoria;
      acc[cat] = (acc[cat] || 0) + +m.monto;
      return acc;
    }, {});

    const labels = Object.keys(byCat);
    const data = Object.values(byCat);
    const backgroundColor = labels.map(cat => this.categoriasMap[cat] || '#999');

    this.pieData = {
      labels,
      datasets: [{
        data,
        backgroundColor,
        hoverOffset: 8
      }]
    };
  }

  private buildDoughnut(movs: any[]) {
    const start = new Date(); start.setDate(1);
    const thisMonth = movs.filter(m => new Date(m.fecha) >= start);
    const gastos = thisMonth.filter(m => m.tipo === 'gasto').reduce((s, m) => s + +m.monto, 0);
    const ingresos = thisMonth.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + +m.monto, 0);

    this.doughnutData = {
      labels: ['Gastos', 'Ingresos'],
      datasets: [{
        label: 'Último mes',
        data: [gastos, ingresos],
        backgroundColor: ['rgba(239, 71, 111, 0.8)', 'rgba(66, 163, 77, 0.8)'],
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
          tension: 0.3
        },
        {
          label: 'Gastos',
          data: gastos,
          fill: false,
          borderColor: '#ff6b6b',
          backgroundColor: '#ff6b6b',
          tension: 0.3
        }
      ]
    };
  }

  private updateFinancialSummary(movs: any[]) {
    const start = new Date(); start.setDate(1);
    const thisMonth = movs.filter(m => new Date(m.fecha) >= start);
    const gastos = thisMonth.filter(m => m.tipo === 'gasto').reduce((sum, m) => sum + +m.monto, 0);

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
