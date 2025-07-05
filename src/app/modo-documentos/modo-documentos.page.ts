import { Component } from '@angular/core';
import { IonicModule, AlertController, Platform, LoadingController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { Chart, registerables } from 'chart.js';
import { PdfService } from '../services/pdf.service';
import { AuthService } from '../services/auth.service';
import { ManualTransactionService } from '../services/manual-transaction.service';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { AndroidPermissions } from '@awesome-cordova-plugins/android-permissions/ngx';

Chart.register(...registerables);

@Component({
  selector: 'app-modo-documentos',
  templateUrl: './modo-documentos.page.html',
  styleUrls: ['./modo-documentos.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule],
  providers: [AndroidPermissions]
})
export class ModoDocumentosPage {
  charts = [
    { id: 'gauge', name: 'Uso del Límite' },
    { id: 'pie', name: 'Distribución por Categorías' },
    { id: 'bar', name: 'Comparación Mensual' },
  ];

  constructor(
    private firestore: Firestore,
    private auth: AuthService,
    private pdfService: PdfService,
    private platform: Platform,
    private alertController: AlertController,
    private manualTransactionService: ManualTransactionService,
    private loadingController: LoadingController,
    private androidPermissions: AndroidPermissions
  ) { }

  ngAfterViewInit() {
    this.renderExportCharts();
  }

  async renderExportCharts() {
    try {
      const user = await this.auth.getCurrentUserData();
      const movimientos: any[] = (await this.manualTransactionService.getTransactions().toPromise()) || [];

      const saldo = user.saldoManual || 0;
      const limite = user.limiteMensualManual || 0;

      const gastos = movimientos.filter(m => m.tipo === 'gasto');
      const ingresos = movimientos.filter(m => m.tipo === 'ingreso');

      const usado = user.gastoMensualActualManual
      const restante = limite - usado;

      // 🍩 Doughnut: Uso del Límite
      new Chart('gauge-chart', {
        type: 'doughnut',
        data: {
          labels: ['Usado', 'Disponible'],
          datasets: [{
            data: [usado, restante],
            backgroundColor: ['#FF6384', '#36A2EB'],
          }]
        },
        options: {
          responsive: false,
          plugins: { legend: { display: true } }
        }
      });

      // 📊 Pie: Gastos por Categoría
      const categorias: { [cat: string]: number } = {};
      gastos.forEach(g => {
        const cat = g.categoria || 'Otro';
        categorias[cat] = (categorias[cat] || 0) + +g.monto;
      });

      new Chart('pie-chart', {
        type: 'pie',
        data: {
          labels: Object.keys(categorias),
          datasets: [{
            data: Object.values(categorias),
            backgroundColor: Object.keys(categorias).map((_, i) =>
              `hsl(${i * 50}, 70%, 60%)`)
          }]
        },
        options: {
          responsive: false,
          plugins: { legend: { display: true } }
        }
      });

      // 📈 Bar: Comparación Mensual
      const meses: { [mes: string]: { ingresos: number, gastos: number } } = {};

      movimientos.forEach(mov => {
        const fecha = new Date(mov.fecha);
        const mes = fecha.toLocaleDateString('es-CL', { month: 'short' });

        if (!meses[mes]) {
          meses[mes] = { ingresos: 0, gastos: 0 };
        }

        if (mov.tipo === 'gasto') meses[mes].gastos += +mov.monto;
        else if (mov.tipo === 'ingreso') meses[mes].ingresos += +mov.monto;
      });

      const ordenMeses = Object.keys(meses);

      new Chart('bar-chart', {
        type: 'bar',
        data: {
          labels: ordenMeses,
          datasets: [
            {
              label: 'Gastos',
              data: ordenMeses.map(m => meses[m].gastos),
              backgroundColor: '#FF6384'
            },
            {
              label: 'Ingresos',
              data: ordenMeses.map(m => meses[m].ingresos),
              backgroundColor: '#36A2EB'
            }
          ]
        },
        options: {
          responsive: false,
          plugins: {
            legend: { position: 'top' }
          },
          scales: {
            y: { beginAtZero: true }
          }
        }
      });

    } catch (err) {
      console.error('Error renderizando gráficos exportables:', err);
      this.showErrorAlert('No se pudieron cargar los datos de los gráficos');
    }
  }

  async downloadCompleteReport(): Promise<void> {
    const loading = await this.loadingController.create({
      message: 'Generando reporte completo...',
    });

    try {
      await loading.present();

      if (this.platform.is('android')) {
        const hasPermission = await this.checkAndroidPermissions();
        if (!hasPermission) {
          await loading.dismiss();
          return this.showErrorAlert('Se requieren permisos de almacenamiento');
        }
      }

      const user = await this.auth.getCurrentUserData();
      if (!user) throw new Error('Usuario no autenticado');

      const movimientos = await this.auth.getMovimientos();
      const saldo = user.saldoManual || 0;
      const limite = user.limiteMensualManual || 0;
      const usado = movimientos
        .filter(m => m.tipo === 'gasto')
        .reduce((sum, m) => sum + +m.monto, 0);
      const restante = limite - usado;

      await this.pdfService.generarPDF(
        user,
        movimientos,
        { saldo, limite, usado, restante }
      );

      await loading.dismiss();
      await this.showSuccessAlert('Reporte descargado correctamente');

    } catch (error) {
      console.error('Error:', error);
      await loading.dismiss();
      this.showErrorAlert('Error al generar el reporte');
    }
  }

  private async checkAndroidPermissions(): Promise<boolean> {
    try {
      const hasPermission = await this.androidPermissions.checkPermission(
        this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE
      );

      if (!hasPermission.hasPermission) {
        const result = await this.androidPermissions.requestPermission(
          this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE
        );
        return result.hasPermission;
      }
      return true;
    } catch (error) {
      console.error('Error verificando permisos:', error);
      return false;
    }
  }

  async downloadReport(type: 'monthly' | 'csv' | string): Promise<void> {
    try {
      if (type === 'csv') {
        await this.generateCSV();
      } else if (type === 'monthly') {
        await this.generatePDF();
      } else if (this.charts.some(c => c.id === type)) {
        await this.generatePNG(type);
      }
    } catch (error) {
      console.error('Error en descarga:', error);
      this.showErrorAlert('No se pudo descargar el archivo');
    }
  }

  private async showSuccessAlert(message: string): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Éxito',
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  private async showErrorAlert(message: string): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Error',
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  async generateCSV(): Promise<void> {
    try {
      const user = await this.auth.getCurrentUserData();
      if (!user) throw new Error('Usuario no autenticado');

      const csv = `username,email,saldoManual,limiteMensualManual\n${user.username},${user.email},${user.saldoManual},${user.limiteMensualManual}\n`;

      const fileName = 'ekonomi_usuario.csv';

      if (this.platform.is('hybrid')) {
        const base64data = btoa(unescape(encodeURIComponent(csv)));
        await Filesystem.writeFile({
          path: fileName,
          data: base64data,
          directory: Directory.Documents,
          encoding: Encoding.UTF8
        });

        const uri = await Filesystem.getUri({
          directory: Directory.Documents,
          path: fileName
        });

        await FileOpener.open({
          filePath: uri.uri,
          contentType: 'text/csv'
        });
      } else {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error al generar CSV:', error);
      throw error;
    }
  }

  async generatePNG(type: string): Promise<void> {
    try {
      const canvas = document.getElementById(`${type}-chart`) as HTMLCanvasElement;
      if (!canvas) {
        throw new Error(`No se encontró el canvas para el gráfico ${type}`);
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      const fileName = `ekonomi_${type}_${new Date().getTime()}.png`;
      const dataUrl = canvas.toDataURL('image/png');

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error('Error al generar PNG:', error);
      this.showErrorAlert('No se pudo generar la imagen del gráfico');
      throw error;
    }
  }

  private async generatePDF() {
    try {
      const user = await this.auth.getCurrentUserData();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const movimientos = await this.auth.getMovimientos();
      const saldo = user.saldoManual || 0;
      const limite = user.limiteMensualManual || 0;
      const usado = movimientos
        .filter(m => m.tipo === 'gasto')
        .reduce((sum, m) => sum + +m.monto, 0);
      const restante = limite - usado;

      const resumen = { saldo, limite, usado, restante };
      await this.pdfService.generarPDF(user, movimientos, resumen);
    } catch (error) {
      console.error('Error al generar PDF:', error);
      throw error;
    }
  }
}