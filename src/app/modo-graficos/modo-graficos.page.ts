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
import { Chart } from 'chart.js';

Chart.register(ChartDataLabels);


interface CategoryDetail {
  name: string;
  amount: number;
  percentage: number;
  color: string;
}


@Component({
  selector: 'app-modo-graficos',
  standalone: true,
  imports: [
    IonicModule,
    CommonModule,
    RouterModule,
    NgChartsModule
  ],
  templateUrl: './modo-graficos.page.html',
  styleUrls: ['./modo-graficos.page.scss'],
  
})
export class ModoGraficosPage implements OnInit {
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  @ViewChild('lineChart') lineChart?: BaseChartDirective;
  @ViewChild('pieChart') pieChart?: BaseChartDirective;
  @ViewChild('doughnutChart') doughnutChart?: BaseChartDirective;


  user: any;
  monthlyLimit = 0;
  limitLeft = 0;
  totalExpenses = 0;
  usedLimit = 0;
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
        display: false // Ocultamos la leyenda porque usaremos una personalizada
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.parsed;
            
            // Si es el límite disponible, mostrar información diferente
            if (label === 'Límite disponible') {
              return `${label}: $${value.toLocaleString('es-CL')} disponible`;
            }
            
            // Para las categorías normales, calcular porcentaje basado en el límite mensual
            if (this.monthlyLimit > 0) {
              const percentage = ((value / this.monthlyLimit) * 100).toFixed(1);
              return `${label}: $${value.toLocaleString('es-CL')} (${percentage}% del límite)`;
            } else {
              // Si no hay límite, usar el total de gastos
              let total = 0;
              if (context.dataset && context.dataset.data) {
                total = context.dataset.data.reduce((sum: number, val: any) => sum + Number(val), 0) as number;
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
          
          // No mostrar porcentaje en el límite disponible si es muy grande
          if (label === 'Límite disponible') {
            const percentage = this.monthlyLimit ? (value / this.monthlyLimit) * 100 : 0;
            return percentage > 10 ? `${percentage.toFixed(1)}%` : '';
          }
          
          // Para las categorías normales
          const percentage = this.monthlyLimit ? (value / this.monthlyLimit) * 100 : 0;
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
        return `${label}: $${this.usedLimit.toLocaleString('es-CL')} (${this.usedPercentage.toFixed(1)}%)`;
      } else {
        return `${label}: $${this.limitLeft.toLocaleString('es-CL')} (${this.availablePercentage.toFixed(1)}%)`;
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
    this.user = await this.authService.getCurrentUser();
    this.monthlyLimit = this.user?.limiteMensual || 0;

    const now = new Date();
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    this.currentMonth = monthNames[now.getMonth()] + ' ' + now.getFullYear();

    await this.loadAndProcessData();
  }

  async loadAndProcessData() {
    const movimientos = await this.movimientosService.obtenerMovimientos();
    this.procesarDatos(movimientos);
    this.generateLimitMessage();


    // Forzar actualización de gráficos
    setTimeout(() => {
      if (this.doughnutChart) {
        this.doughnutChart.update();
      }
      if (this.chart) {
        this.chart.update();
      }
      if (this.pieChart) {
        this.pieChart.update();
      }
      if (this.lineChart) {
        this.lineChart.update();
      }
    }, 100);
  }

  private procesarDatos(movimientos: any[]) {
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

    const movimientosDelMes = movimientos.filter(
      m => new Date(m.fecha) >= inicioMes
    );

    const gastosPorCategoria: Record<string, number> = {};
    const gastosPorDia: Record<number, number> = {};

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
      }
    }

    this.usedLimit = this.totalExpenses;
    this.limitLeft = Math.max(0, this.monthlyLimit - this.usedLimit);
    this.usedPercentage = this.monthlyLimit
      ? Math.min((this.usedLimit / this.monthlyLimit) * 100, 100)
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
    if (this.monthlyLimit > 0) {
      // Ordenar categorías por monto (de mayor a menor)
      const sortedCategories = Object.entries(gastosPorCategoria)
        .sort(([, a], [, b]) => b - a);

      let colorIndex = 0;

      // Agregar categorías con gastos
      for (const [categoria, monto] of sortedCategories) {
        const percentage = (monto / this.monthlyLimit) * 100;
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
      if (this.limitLeft > 0) {
        const availablePercentage = (this.limitLeft / this.monthlyLimit) * 100;
        
        labels.push('Límite disponible');
        data.push(this.limitLeft);
        backgroundColors.push('#ecf0f1'); // Color gris claro

        this.categoryDetails.push({
          name: 'Límite disponible',
          amount: this.limitLeft,
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
    this.usedPercentage >= 70 ? '#f39c12' :
      '#4ecdc4';

  // Usar porcentajes en lugar de valores absolutos
  const usedPercentageForChart = Math.min(this.usedPercentage, 100);
  const availablePercentageForChart = Math.max(0, 100 - usedPercentageForChart);

  this.doughnutData = {
    labels: ['Usado', 'Disponible'],
    datasets: [{
      data: [usedPercentageForChart, availablePercentageForChart], // ← CAMBIADO
      backgroundColor: [usedColor, '#ecf0f1'],
      borderWidth: 0,
      hoverOffset: 5
    }]
  };
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
    if (this.monthlyLimit <= 0) {
      this.limitMessage = 'No has definido un límite mensual.';
    } else if (this.usedLimit >= this.monthlyLimit) {
      this.limitMessage = '¡Has alcanzado tu límite mensual!';
    } else if (this.usedPercentage >= 90) {
      this.limitMessage = '¡Cuidado! Estás cerca del límite mensual.';
    } else if (this.usedPercentage >= 70) {
      this.limitMessage = `Has usado más del ${this.usedPercentage.toFixed(0)}% de tu límite.`;
    } else {
      this.limitMessage = `Te queda $${this.limitLeft.toLocaleString('es-CL')} del límite mensual.`;
    }
  }

  async updateCharts() {
    await this.loadAndProcessData();
  }

  async onTransactionAdded() {
    await this.updateCharts();
  }
}
