import 'chart.js/auto';
import { Component, OnInit, ViewChild } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ChartData, ChartOptions } from 'chart.js';
import { NgChartsModule, BaseChartDirective } from 'ng2-charts';
import { AuthService } from '../services/auth.service';
import { MovimientosService } from '../services/movimientos.service';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Chart, ChartEvent } from 'chart.js';

Chart.register(ChartDataLabels);

interface CategoryDetail {
  name: string;
  amount: number;
  percentage: number;
  color: string;
}

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
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  @ViewChild('doughnutChart', { static: false }) doughnutChartRef!: BaseChartDirective;
  @ViewChild('pieChart', { static: false }) pieChartRef!: BaseChartDirective;
  @ViewChild('lineChart', { static: false }) lineChartRef!: BaseChartDirective;


  user: any;
  monthlyLimit = {
    tarjeta: 0,
    manual: 0,
    total: 0
  };
  limitLeft = {
    tarjeta: 0,
    manual: 0,
    total: 0
  };
  usedLimit = {
    tarjeta: 0,
    manual: 0,
    total: 0
  };

  private chartsReady = {
    doughnut: false,
    pie: false,
    line: false
  };
  totalExpenses = 0;
  usedPercentage = 0;
  availablePercentage = 0;
  currentMonth: string = '';
  limitMessage: string = '';
  categoryDetails: CategoryDetail[] = [];

  // Colores predefinidos para las categorías
  private readonly categoryColors: Record<string, string> = {
    'Transporte': '#3498db',        // Azul
    'Alimentación': '#e67e22',      // Naranja
    'Salud': '#e74c3c',             // Rojo
    'Educación': '#9b59b6',         // Morado
    'Entretenimiento': '#f1c40f',   // Amarillo
    'Servicios': '#1abc9c',         // Turquesa
    'Compras': '#34495e',           // Gris Azulado Oscuro
    'Vivienda': '#2ecc71',          // Verde Esmeralda
    'Ropa': '#d35400',              // Naranja Oscuro
    'Regalos': '#c0392b',           // Rojo Oscuro
    'Otros': '#95a5a6',             // Gris Claro
  };

  // Colores de respaldo para categorías no predefinidas
  private readonly fallbackColors: string[] = [
    '#8e44ad', '#16a085', '#f39c12', '#d35400', '#c0392b',
    '#2980b9', '#27ae60', '#f1c40f', '#e67e22', '#e74c3c'
  ];

  // Datos para gráfico de pie (gastos por categoría)
  pieData!: ChartData<'pie'>;
  pieOpts: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.parsed;
            const saldoTarjeta = this.user?.saldoTarjeta || 0;

            if (label === 'Límite disponible') {
              return `${label}: $${value.toLocaleString('es-CL')} disponible`;
            }

            if (saldoTarjeta > 0) {
              const percentage = ((value / saldoTarjeta) * 100).toFixed(1);
              return `${label}: $${value.toLocaleString('es-CL')} (${percentage}% del saldo)`;
            } else {
              let total = 0;
              if (context.dataset?.data) {
                total = context.dataset.data.reduce((sum: number, val: any) => sum + Number(val), 0);
              }
              const percentage = total ? ((value / total) * 100).toFixed(1) : '0';
              return `${label}: $${value.toLocaleString('es-CL')} (${percentage}%)`;
            }
          }
        }
      },
      datalabels: {
        formatter: (value: number, context) => {
          const label = context.chart.data.labels?.[context.dataIndex] as string;
          const saldoTarjeta = this.user?.saldoTarjeta || 0;
          const percentage = saldoTarjeta ? (value / saldoTarjeta) * 100 : 0;

          if (label === 'Límite disponible') {
            return percentage > 10 ? `${percentage.toFixed(1)}%` : '';
          }

          return percentage > 5 ? `${percentage.toFixed(1)}%` : '';
        },
        font: {
          weight: 'bold',
          size: 12,
          family: 'Flexo, Segoe UI, sans-serif',
        },
        color: (context) => {
          const label = context.chart.data.labels?.[context.dataIndex] as string;
          return label === 'Límite disponible' ? '#666' : '#fff';
        },
        anchor: 'center',
        align: 'center'
      }
    }
  };


  // Datos para gráfico doughnut (uso del límite)
  doughnutData!: ChartData<'doughnut'>;
  doughnutOpts: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            // Mostrar los valores reales en el tooltip
            if (label === 'Usado') {
              return `${label}: $${this.usedLimit.tarjeta.toLocaleString('es-CL')} (${this.usedPercentage.toFixed(1)}%)`;
            } else {
              return `${label}: $${this.limitLeft.tarjeta.toLocaleString('es-CL')} (${this.availablePercentage.toFixed(1)}%)`;
            }
          }
        }
      },
      datalabels: {
        display: false
      }
    },
    cutout: '70%'
  };

  // Datos para gráfico de línea (comparación mensual)
  lineData!: ChartData<'line'>;
  lineOpts: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index'
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        callbacks: {
          title: (context) => {
            return context[0].label;
          },
          label: (context) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: $${value.toLocaleString('es-CL')}`;
          }
        }
      },
      datalabels: {
        display: false
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
          lineWidth: 1
        },
        ticks: {
          color: '#666',
          font: {
            size: 12
          }
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
          lineWidth: 1
        },
        ticks: {
          color: '#666',
          font: {
            size: 12
          },
          callback: function (value) {
            return '$' + Number(value).toLocaleString('es-CL');
          }
        }
      }
    },
    elements: {
      point: {
        radius: 4,
        hoverRadius: 8
      },
      line: {
        borderWidth: 3
      }
    }
  };

  // Datos para gráfico de gastos diarios
  dailyExpensesData!: ChartData<'bar'>;
  dailyExpensesOpts: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            return `Gastos: $${value.toLocaleString('es-CL')}`;
          }
        }
      },
      datalabels: {
        display: false
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: '#666',
          font: {
            size: 11
          }
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          color: '#666',
          font: {
            size: 11
          },
          callback: function (value) {
            return '$' + Number(value).toLocaleString('es-CL');
          }
        }
      }
    }
  };

  constructor(
    private authService: AuthService,
    private movimientosService: MovimientosService
  ) { }

  async ngOnInit() {
    this.user = await this.authService.getCurrentUserData();
    // Solo usar límite de tarjeta
    this.monthlyLimit.tarjeta = this.user?.limiteMensual || 0;
    this.monthlyLimit.total = this.monthlyLimit.tarjeta;

    const now = new Date();
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    this.currentMonth = monthNames[now.getMonth()] + ' ' + now.getFullYear();

    await this.loadAndProcessData();
  }

  chartClicked({ event, active }: { event?: ChartEvent, active?: {}[] }): void {
    console.log('Chart clicked:', event, active);
    // Aquí puedes agregar lógica para manejar el click
  }

  chartHovered({ event, active }: { event?: ChartEvent, active?: {}[] }): void {
    console.log('Chart hovered:', event, active);
    // Aquí puedes agregar lógica para manejar el hover
  }

  async loadAndProcessData() {
    try {
      const movimientos = await this.movimientosService.obtenerMovimientos();
      this.procesarDatos(movimientos);
      this.generateLimitMessage();

      // Esperar a que los gráficos estén listos antes de actualizar
      setTimeout(() => {
        this.updateCharts();
      }, 300);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    }
  }

  private updateCharts() {
    if (this.doughnutChartRef && this.doughnutChartRef.chart) {
      this.doughnutChartRef.chart.update();
      this.chartsReady.doughnut = true;
    }

    if (this.pieChartRef && this.pieChartRef.chart) {
      this.pieChartRef.chart.update();
      this.chartsReady.pie = true;
    }

    if (this.lineChartRef && this.lineChartRef.chart) {
      this.lineChartRef.chart.update();
      this.chartsReady.line = true;
    }
  }

  private procesarDatos(movimientos: any[]) {
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

    // Filtrar solo movimientos del mes actual y de tipo gasto con modo tarjeta
    const movimientosDelMes = movimientos.filter(m => {
      const fechaMovimiento = new Date(m.fecha);
      return fechaMovimiento >= inicioMes &&
        m.tipo === 'gasto' &&
        m.modo === 'tarjeta';
    });

    const gastosPorCategoria: Record<string, number> = {};
    const gastosPorDia: Record<number, number> = {};

    // Usar gastoMensualActual en lugar de calcular los gastos
    this.totalExpenses = this.user?.gastoMensualActual || 0;

    // Calcular gastos por categoría
    for (const m of movimientosDelMes) {
      const fecha = new Date(m.fecha);
      const dia = fecha.getDate();
      const monto = +m.monto;
      const cat = m.categoria || m.categoria_nombre || 'Otros';

      gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + monto;
      gastosPorDia[dia] = (gastosPorDia[dia] || 0) + monto;
    }

    // Actualizar límites (solo tarjeta)
    this.usedLimit.tarjeta = this.totalExpenses;
    this.limitLeft.tarjeta = Math.max(0, this.monthlyLimit.tarjeta - this.usedLimit.tarjeta);

    // Calcular porcentajes basados en el límite de tarjeta
    this.usedPercentage = this.monthlyLimit.tarjeta
      ? Math.min((this.usedLimit.tarjeta / this.monthlyLimit.tarjeta) * 100, 100)
      : 0;
    this.availablePercentage = Math.max(0, 100 - this.usedPercentage);

    this.configurarPieChart(gastosPorCategoria);
    this.configurarDoughnutChart();
    this.configurarLineChart(movimientos);
    this.configurarDailyExpensesChart(gastosPorDia);
  }

  private configurarPieChart(gastosPorCategoria: Record<string, number>) {
    const labels: string[] = [];
    const data: number[] = [];
    const backgroundColors: string[] = [];

    this.categoryDetails = [];

    // Verificar si hay límite mensual definido
    if (this.monthlyLimit.tarjeta > 0) {
      // Ordenar categorías por monto (de mayor a menor)
      const sortedCategories = Object.entries(gastosPorCategoria)
        .sort(([, a], [, b]) => b - a);

      let colorIndex = 0;

      // Agregar categorías con gastos
      for (const [categoria, monto] of sortedCategories) {
        const percentage = (monto / this.monthlyLimit.tarjeta) * 100;
        const color = this.obtenerColorCategoria(categoria, colorIndex);

        labels.push(categoria);
        data.push(monto);
        backgroundColors.push(color);

        this.categoryDetails.push({
          name: categoria,
          amount: monto,
          percentage: Math.round(percentage),
          color: color
        });

        colorIndex++;
      }

      // Agregar la porción no utilizada del límite si existe
      if (this.limitLeft.tarjeta > 0) {
        const availablePercentage = (this.limitLeft.total / this.monthlyLimit.tarjeta) * 100;

        labels.push('Límite disponible');
        data.push(this.limitLeft.tarjeta);
        backgroundColors.push('#ecf0f1'); // Color gris claro

        this.categoryDetails.push({
          name: 'Límite disponible',
          amount: this.limitLeft.tarjeta,
          percentage: Math.round(availablePercentage),
          color: '#ecf0f1'
        });
      }
    } else {
      // Si no hay límite mensual, mostrar solo las categorías (comportamiento original)
      const sortedCategories = Object.entries(gastosPorCategoria)
        .sort(([, a], [, b]) => b - a);

      let colorIndex = 0;

      for (const [categoria, monto] of sortedCategories) {
        const percentage = this.totalExpenses > 0 ? ((monto / this.totalExpenses) * 100) : 0;
        const color = this.obtenerColorCategoria(categoria, colorIndex);

        labels.push(categoria);
        data.push(monto);
        backgroundColors.push(color);

        this.categoryDetails.push({
          name: categoria,
          amount: monto,
          percentage: Math.round(percentage),
          color: color
        });

        colorIndex++;
      }
    }

    this.pieData = {
      labels,
      datasets: [{
        data,
        backgroundColor: backgroundColors,
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 8,
        hoverBorderWidth: 3,
        hoverBorderColor: '#eee'
      }]
    };

    console.log('Pie Chart Data:', this.pieData);
    console.log('Category Details:', this.categoryDetails);
  }

  private configurarDoughnutChart() {
    const usedColor = this.usedPercentage >= 90 ? '#e74c3c' :
      this.usedPercentage >= 70 ? '#f39c12' : '#4ecdc4';

    this.doughnutData = {
      labels: ['Gastado', 'Disponible'],
      datasets: [{
        data: [this.usedPercentage, this.availablePercentage],
        backgroundColor: [usedColor, '#ecf0f1'],
        borderWidth: 0,
        hoverOffset: 5
      }]
    };

    // Solo actualizar si el gráfico ya está inicializado
    if (this.chartsReady.doughnut && this.doughnutChartRef?.chart) {
      this.doughnutChartRef.chart.update();
    }
  }

  private configurarLineChart(movimientos: any[]) {
    const now = new Date();
    const meses: { nombre: string; ingresos: number; gastos: number; esMesActual: boolean }[] = [];

    for (let i = 3; i >= 0; i--) {
      const fecha = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const inicioMes = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
      const finMes = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);

      const movimientosDelMes = movimientos.filter(m => {
        const fechaMovimiento = new Date(m.fecha);
        return fechaMovimiento >= inicioMes && fechaMovimiento <= finMes;
      });

      let ingresos = 0;
      let gastos = 0;

      movimientosDelMes.forEach(m => {
        const monto = +m.monto;
        if (m.tipo === 'ingreso') {
          ingresos += monto;
        } else if (m.tipo === 'gasto') {
          gastos += monto;
        }
      });

      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
        'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

      meses.push({
        nombre: monthNames[fecha.getMonth()],
        ingresos,
        gastos,
        esMesActual: i === 0
      });
    }

    const labels = meses.map(m => m.nombre);
    const dataIngresos = meses.map(m => m.ingresos);
    const dataGastos = meses.map(m => m.gastos);

    this.lineData = {
      labels,
      datasets: [
        {
          label: 'Ingresos',
          data: dataIngresos,
          borderColor: '#4ecdc4',
          backgroundColor: 'rgba(78, 205, 196, 0.1)',
          pointBackgroundColor: '#4ecdc4',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: (context) => meses[context.dataIndex]?.esMesActual ? 8 : 5,
          pointHoverRadius: (context) => meses[context.dataIndex]?.esMesActual ? 10 : 7,
          borderWidth: (context) => meses[context.dataIndex]?.esMesActual ? 4 : 2.5,
          fill: true,
          tension: 0.4
        },
        {
          label: 'Gastos',
          data: dataGastos,
          borderColor: '#ff6b6b',
          backgroundColor: 'rgba(255, 107, 107, 0.1)',
          pointBackgroundColor: '#ff6b6b',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: (context) => meses[context.dataIndex]?.esMesActual ? 8 : 5,
          pointHoverRadius: (context) => meses[context.dataIndex]?.esMesActual ? 10 : 7,
          borderWidth: (context) => meses[context.dataIndex]?.esMesActual ? 4 : 2.5,
          fill: true,
          tension: 0.4
        }
      ]
    };
  }

  private configurarDailyExpensesChart(gastosPorDia: Record<number, number>) {
    const now = new Date();
    const diasDelMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const labels: string[] = [];
    const data: number[] = [];

    for (let dia = 1; dia <= diasDelMes; dia++) {
      labels.push(dia.toString());
      data.push(gastosPorDia[dia] || 0);
    }

    this.dailyExpensesData = {
      labels,
      datasets: [{
        label: 'Gastos Diarios',
        data,
        backgroundColor: '#4ecdc4',
        borderColor: '#45b7b8',
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
        barThickness: 'flex',
        maxBarThickness: 12
      }]
    };
  }

  private obtenerColorCategoria(categoria: string, index: number = 0): string {
    // Primero buscar en colores predefinidos
    if (this.categoryColors[categoria]) {
      return this.categoryColors[categoria];
    }

    // Si no existe, usar colores de respaldo
    if (index < this.fallbackColors.length) {
      return this.fallbackColors[index];
    }

    // Como último recurso, generar color dinámico
    return this.generateDynamicColor(categoria);
  }

  private generateDynamicColor(categoryName: string): string {
    let hash = 0;
    for (let i = 0; i < categoryName.length; i++) {
      hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = Math.abs(hash) % 360;
    const saturation = 70 + (Math.abs(hash) % 20);
    const lightness = 45 + (Math.abs(hash) % 10);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  private generateLimitMessage() {
    if (this.monthlyLimit.total <= 0) {
      this.limitMessage = 'No has definido un límite mensual.';
      return;
    }
    const totalUsedPercentage = this.usedPercentage;
    const tarjetaUsedPercentage = this.monthlyLimit.tarjeta > 0
      ? (this.usedLimit.tarjeta / this.monthlyLimit.tarjeta) * 100
      : 0;

    if (totalUsedPercentage >= 100) {
      this.limitMessage = '¡Has alcanzado tu límite mensual total!';
    } else if (tarjetaUsedPercentage >= 100) {
      this.limitMessage = '¡Has alcanzado el límite de tu tarjeta!';
    } else if (totalUsedPercentage >= 90) {
      this.limitMessage = '¡Cuidado! Estás cerca del límite mensual total.';
    } else if (tarjetaUsedPercentage >= 90) {
      this.limitMessage = '¡Cuidado! Estás cerca del límite de tu tarjeta.';
    } else if (totalUsedPercentage >= 70) {
      this.limitMessage = `Has usado más del ${totalUsedPercentage.toFixed(0)}% de tu límite total.`;
    } else {
      const leftText = [];
      if (this.monthlyLimit.tarjeta > 0) {
        leftText.push(`$${this.limitLeft.tarjeta.toLocaleString('es-CL')} en tarjeta`);
      }
      if (this.monthlyLimit.manual > 0) {
        leftText.push(`$${this.limitLeft.manual.toLocaleString('es-CL')} manual`);
      }
      this.limitMessage = `Te queda ${leftText.join(' y ')} del límite mensual.`;
    }
  }

}