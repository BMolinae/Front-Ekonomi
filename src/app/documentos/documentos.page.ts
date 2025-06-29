// src/app/documentos/documentos.page.ts

import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';  // Mantenido de la versión original
import { AlertController, Platform } from '@ionic/angular';         // Mantenido
import { Chart } from 'chart.js';                                   // Mantenido
import { AndroidPermissions } from '@awesome-cordova-plugins/android-permissions/ngx';  // Agregado para Android 14
import { FileOpener } from '@awesome-cordova-plugins/file-opener/ngx';                // Agregado para abrir PDF
import { PdfService } from '../services/pdf.service';               // Mantenido
import { IonicModule } from '@ionic/angular'; // ✅ Agregar esto
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-documentos',
  templateUrl: './documentos.page.html',
  styleUrls: ['./documentos.page.scss'],
  providers: [AndroidPermissions, FileOpener],
  standalone: true, // ✅ Asegúrate de que esté esto
  imports: [
    IonicModule,     // ✅ Necesario para reconocer <ion-*>
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
    private firestore: AngularFirestore,
    private alertCtrl: AlertController,
    private platform: Platform,
    private androidPermissions: AndroidPermissions,
    private fileOpener: FileOpener,
    private pdfService: PdfService
  ) { }

  downloadCompleteReport() {
    console.log('Descargando informe completo...');
    // lógica para generar informe completo en PDF
  }

  downloadReport(tipo: string) {
    console.log('Descargar reporte:', tipo);
    // lógica para generar PDF, CSV o imagen según tipo
  }


  async ngOnInit() {
    // Solicitar permisos en Android 14 antes de cualquier acceso a almacenamiento
    if (this.platform.is('android')) {
      await this.checkAndroidPermissions();
    }

    // Carga de usuario y movimientos (mismo flujo que antes)
    const uid = /* obtener UID de usuario logueado */ 'user123';
    this.usuario = { nombre: 'Usuario Ejemplo', uid };

    this.firestore
      .collection(`movimientos/${uid}/registros`)
      .valueChanges()
      .subscribe((docs: any[]) => {
        this.movimientos = docs;
        this.calcularResumen();           // Mantenido
        this.initChart();                 // Mantenido
      });
  }

  private calcularResumen() {
    // Lógica original de cálculo de resumen
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
    // Creación del gráfico con Chart.js (mantenido)
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
      // Generación y guardado del PDF delegado al servicio
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

      // Abrir automáticamente el PDF en Android
    } catch (err) {
      // Mismo manejo de errores que la versión original
      const alert = await this.alertCtrl.create({
        header: 'Error',
        message: 'No se pudo generar o descargar el PDF: ' + err,
        buttons: ['OK']
      });
      await alert.present();
    }
  }




}
