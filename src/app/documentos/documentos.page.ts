import { Component, OnInit } from '@angular/core';
import { AlertController, Platform } from '@ionic/angular';
import { Chart } from 'chart.js';
import { AndroidPermissions } from '@awesome-cordova-plugins/android-permissions/ngx';
import { FileOpener } from '@awesome-cordova-plugins/file-opener/ngx';
import { PdfService } from '../services/pdf.service';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

import { Firestore, collection, collectionData } from '@angular/fire/firestore'; // ✅ Firebase modular
import { firstValueFrom } from 'rxjs'; // Para usar async/await con collectionData

@Component({
  selector: 'app-documentos',
  templateUrl: './documentos.page.html',
  styleUrls: ['./documentos.page.scss'],
  providers: [AndroidPermissions, FileOpener],
  standalone: true,
  imports: [
    IonicModule,
    CommonModule
  ]
})
export class DocumentosPage implements OnInit {
  usuario: any;
  movimientos: any[] = [];
  resumen = { saldo: 0, limite: 0, usado: 0, restante: 0 };

  charts = [
    { id: 'gauge-chart', name: 'Gráfico Velocímetro' },
    { id: 'pie-chart', name: 'Gráfico de Porcentajes' },
    { id: 'bar-chart', name: 'Gráfico de Barras' }
  ];

  constructor(
    private firestore: Firestore,
    private alertCtrl: AlertController,
    private platform: Platform,
    private androidPermissions: AndroidPermissions,
    private fileOpener: FileOpener,
    private pdfService: PdfService
  ) { }

  async ngOnInit() {
    if (this.platform.is('android')) {
      await this.checkAndroidPermissions();
    }

    const uid = /* obtener UID de usuario logueado */ 'user123';
    this.usuario = { nombre: 'Usuario Ejemplo', uid };

    const ref = collection(this.firestore, `movimientos/${uid}/registros`);
    this.movimientos = await firstValueFrom(collectionData(ref));
    
    this.calcularResumen();
    this.initChart();
  }

  private calcularResumen() {
    const usados = this.movimientos.reduce((sum, m) => sum + m.monto, 0);
    const limite = 1000;
    this.resumen = {
      saldo: limite,
      limite,
      usado: usados,
      restante: limite - usados
    };
  }

  private initChart() {
    const ctx = document.getElementById('myChart') as HTMLCanvasElement;
    new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Usado', 'Restante'],
        datasets: [{ data: [this.resumen.usado, this.resumen.restante] }]
      }
    });
  }

  private async checkAndroidPermissions() {
    try {
      const write = this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE;
      const read = this.androidPermissions.PERMISSION.READ_EXTERNAL_STORAGE;
      let perm = await this.androidPermissions.checkPermission(write);
      if (!perm.hasPermission) {
        await this.androidPermissions.requestPermission(write);
      }
      perm = await this.androidPermissions.checkPermission(read);
      if (!perm.hasPermission) {
        await this.androidPermissions.requestPermission(read);
      }
    } catch (err) {
      console.warn('Error pidiendo permisos Android', err);
    }
  }

  async generarPDF() {
    try {
      const result = await this.pdfService.generarPDF(
        this.usuario,
        this.movimientos,
        this.resumen
      );

      if (result?.filePath) {
        await this.fileOpener.open(result.filePath, 'application/pdf');
      } else {
        throw new Error('No se pudo generar el archivo PDF');
      }
    } catch (err) {
      const alert = await this.alertCtrl.create({
        header: 'Error',
        message: 'No se pudo generar o descargar el PDF: ' + err,
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  downloadCompleteReport() {
    console.log('Descargando informe completo...');
  }

  downloadReport(tipo: string) {
    console.log('Descargar reporte:', tipo);
  }
}
