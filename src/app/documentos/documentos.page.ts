import { Component, OnInit } from '@angular/core';
import { IonicModule, AlertController, Platform } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { Chart, registerables } from 'chart.js';
import { PdfService } from '../services/pdf.service';
import { AuthService } from '../services/auth.service';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { AndroidPermissions } from '@awesome-cordova-plugins/android-permissions/ngx';

Chart.register(...registerables);

@Component({
  selector: 'app-documentos',
  standalone: true,
  imports: [IonicModule, CommonModule],
  templateUrl: './documentos.page.html',
  styleUrls: ['./documentos.page.scss'],
  providers: [AndroidPermissions] // ✅ Proveedor agregado
})
export class DocumentosPage implements OnInit {
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
    private androidPermissions: AndroidPermissions
  ) {}

  async ngOnInit() {
    if (this.platform.is('android')) {
      await this.checkAndroidPermissions();
    }
  }

  private async checkAndroidPermissions() {
    try {
      const hasPermission = await this.androidPermissions.checkPermission(
        this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE
      );

      if (!hasPermission.hasPermission) {
        const result = await this.androidPermissions.requestPermission(
          this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE
        );

        if (!result.hasPermission) {
          this.showErrorAlert('Se necesitan permisos de almacenamiento para descargar archivos');
        }
      }
    } catch (error) {
      console.error('Error al verificar permisos:', error);
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
      this.showErrorAlert('No se pudo descargar el archivo. Intenta nuevamente.');
    }
  }

  private async showErrorAlert(message: string) {
    const alert = await this.alertController.create({
      header: 'Error',
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  async generateCSV(): Promise<void> {
    try {
      const snapshot = await getDocs(collection(this.firestore, 'users'));
      let csv = 'username,email,saldo,limite_mensual\n';

      snapshot.forEach(doc => {
        const d: any = doc.data();
        csv += `${d.username},${d.email},${d.saldo},${d.limite_mensual}\n`;
      });

      const fileName = 'ekonomi_usuarios.csv';

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

      const fileName = `ekonomi_${type}_${new Date().getTime()}.png`;

      if (this.platform.is('hybrid')) {
        const base64data = canvas.toDataURL('image/png').split(',')[1];
        await Filesystem.writeFile({
          path: fileName,
          data: base64data,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });

        const uriResult = await Filesystem.getUri({
          directory: Directory.Documents,
          path: fileName
        });

        await FileOpener.open({ 
          filePath: uriResult.uri,
          contentType: 'image/png'
        });
      } else {
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = fileName;
        link.href = dataUrl;
        link.click();
      }
    } catch (error) {
      console.error('Error al generar PNG:', error);
      throw error;
    }
  }

  private async generatePDF() {
    try {
      const user = await this.auth.getCurrentUser();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const movimientos = await this.auth.getMovimientos();
      const saldo = user.saldo || 0;
      const limite = user.limite_mensual || 0;
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
