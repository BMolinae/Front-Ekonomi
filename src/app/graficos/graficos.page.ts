import 'chart.js/auto';
import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ChartData, ChartOptions } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { AuthService } from '../services/auth.service';
import { MovimientosService } from '../services/movimientos.service';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Chart } from 'chart.js';

Chart.register(ChartDataLabels);


@Component({
  selector: 'app-graficos',
  standalone: true,
  imports: [
    IonicModule,
    CommonModule,
    RouterModule,
    NgChartsModule
  ],
  templateUrl: './graficos.page.html',
  styleUrls: ['./graficos.page.scss'],
})
export class GraficosPage implements OnInit {
  user: any;
  monthlyLimit = 0;
  limitLeft = 0;
  totalExpenses = 0;
  usedLimit = 0;
  usedPercentage = 0;
  availablePercentage = 0;
  currentMonth: string = '';
  limitMessage: string = '';

  pieData!: ChartData<'pie'>;
  pieOpts: ChartOptions<'pie'> = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' },
      datalabels: {
        formatter: (value: number, context) => {
          const dataset = context.chart.data.datasets[0];
          const total = dataset.data.reduce((sum: number, val: any) => sum + Number(val), 0);
          const percentage = total ? (value / total) * 100 : 0;
          return `${percentage.toFixed(1)}%`;
        },
        font: {
          weight: 'bold',
          size: 16, // Aumentamos tamaño
          family: 'Arial',
        },
        anchor: 'end',
        align: 'end',
        offset: -55
      }
    }
  };

  doughnutData!: ChartData<'doughnut'>;
  doughnutOpts: ChartOptions<'doughnut'> = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
      datalabels: {
        display: false
      }
    },
    cutout: '70%'
  };

  lineData!: ChartData<'line'>;
  lineOpts: ChartOptions<'line'> = {
    responsive: true,
    plugins: {
      legend: { position: 'top' }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Día del mes'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Monto (CLP)'
        }
      }
    }
  };

  constructor(
    private authService: AuthService,
    private movimientosService: MovimientosService
  ) {

  }

  async ngOnInit() {
    this.user = await this.authService.getCurrentUser();
    this.monthlyLimit = this.user?.limite_mensual || 0;

    // Mostrar mes actual
    const now = new Date();
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    this.currentMonth = monthNames[now.getMonth()];

    const movimientos = await this.movimientosService.obtenerMovimientos();
    this.procesarDatos(movimientos);

    // Generar mensaje del límite
    this.limitMessage = this.usedLimit >= this.monthlyLimit
      ? '¡Has alcanzado tu límite mensual!'
      : `Te queda $${this.limitLeft.toLocaleString('es-CL')} del límite mensual.`;
  }


  private procesarDatos(movimientos: any[]) {
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

    const movimientosDelMes = movimientos.filter(
      m => new Date(m.fecha) >= inicioMes
    );

    const gastosPorCategoria: Record<string, number> = {};
    const gastosPorDia: Record<number, number> = {};
    const ingresosPorDia: Record<number, number> = {};

    this.totalExpenses = 0;

    for (const m of movimientosDelMes) {
      const fecha = new Date(m.fecha);
      const dia = fecha.getDate();
      const monto = +m.monto;
      const cat = m.categoria || 'Otros';

      if (m.tipo === 'gasto') {
        gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + monto;
        gastosPorDia[dia] = (gastosPorDia[dia] || 0) + monto;
        this.totalExpenses += monto;
      } else if (m.tipo === 'ingreso') {
        ingresosPorDia[dia] = (ingresosPorDia[dia] || 0) + monto;
      }
    }

    this.usedLimit = this.totalExpenses;
    this.limitLeft = this.monthlyLimit - this.usedLimit;
    this.usedPercentage = this.monthlyLimit
      ? Math.min((this.usedLimit / this.monthlyLimit) * 100, 100)
      : 0;
    this.availablePercentage = 100 - this.usedPercentage;

    this.configurarPieChart(gastosPorCategoria);
    this.configurarDoughnutChart();
    this.configurarLineChart(gastosPorDia, ingresosPorDia);
  }


  private configurarPieChart(gastosPorCategoria: Record<string, number>) {
    const labels = [];
    const data = [];
    const backgroundColors = [];

    let totalGastos = 0;
    for (const cat in gastosPorCategoria) {
      totalGastos += gastosPorCategoria[cat];
    }

    for (const cat in gastosPorCategoria) {
      const monto = gastosPorCategoria[cat];
      labels.push(cat);
      data.push(monto);
      backgroundColors.push(this.obtenerColorCategoria(cat));
    }

    const restante = this.monthlyLimit - totalGastos;

    if (restante > 0) {
      labels.push('Disponible');
      data.push(restante);
      backgroundColors.push('#e0e0e0'); // Gris claro para lo disponible
    }

    this.pieData = {
      labels,
      datasets: [
        {
          data,
          backgroundColor: backgroundColors,
          hoverOffset: 10
        }
      ]
    };
  }

  private obtenerColorCategoria(categoria: string): string {
    const colores: Record<string, string> = {
      'Transporte': '#3498db',
      'Alimentación': '#e67e22',
      'Salud': '#e74c3c',
      'Educación': '#9b59b6',
      'Otros': '#95a5a6',
    };
    return colores[categoria] || '#f1c40f'; // Color por defecto
  }



  private configurarDoughnutChart() {
    this.doughnutData = {
      labels: ['Gastado', 'Disponible'],
      datasets: [{
        data: [this.usedLimit, this.limitLeft],
        backgroundColor: ['#e74c3c', '#2ecc71']
      }]
    };
  }

  private configurarLineChart(
    gastosPorDia: Record<number, number>,
    ingresosPorDia: Record<number, number>
  ) {
    const todosLosDias = new Set<number>([
      ...Object.keys(gastosPorDia).map(Number),
      ...Object.keys(ingresosPorDia).map(Number),
    ]);

    const dias = Array.from(todosLosDias).sort((a, b) => a - b);
    const labels = dias.map(d => `Día ${d}`);
    const dataGastos = dias.map(d => gastosPorDia[d] || 0);
    const dataIngresos = dias.map(d => ingresosPorDia[d] || 0);

    this.lineData = {
      labels,
      datasets: [
        {
          label: 'Gastos',
          data: dataGastos,
          borderColor: '#e74c3c',
          backgroundColor: 'rgba(231, 76, 60, 0.2)',
          pointStyle: 'circle',
          pointRadius: 5,
          fill: true,
          tension: 0.3,
        },
        {
          label: 'Ingresos',
          data: dataIngresos,
          borderColor: '#2ecc71',
          backgroundColor: 'rgba(46, 204, 113, 0.2)',
          pointStyle: 'circle',
          pointRadius: 5,
          fill: true,
          tension: 0.3,
        },
      ]
    };
  }
  private getColores(count: number): string[] {
    const base = ['#f39c12', '#e74c3c', '#8e44ad', '#3498db', '#2ecc71', '#1abc9c', '#e67e22', '#34495e'];
    const colores: string[] = [];
    for (let i = 0; i < count; i++) {
      colores.push(base[i % base.length]);
    }
    return colores;
  }

}
