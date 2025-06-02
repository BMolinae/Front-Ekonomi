import { Component, OnInit } from '@angular/core';
import { saveAs } from 'file-saver';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { Chart, registerables } from 'chart.js';
import { PdfService } from '../services/pdf.service'; 
import { AuthService } from '../services/auth.service';
import { Movimiento } from '../services/movimiento.model';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { FileOpener } from '@awesome-cordova-plugins/file-opener/ngx';
import { Platform } from '@ionic/angular';


Chart.register(...registerables);

@Component({
  selector: 'app-documentos',
  standalone: true,
  imports: [
    IonicModule,
    CommonModule
  ],
  templateUrl: './documentos.page.html',
  styleUrls: ['./documentos.page.scss'],
})
export class DocumentosPage implements OnInit {
  charts = [
    { id: 'gauge', name: 'Uso del Límite' },
    { id: 'pie',   name: 'Distribución por Categorías' },
    { id: 'bar',   name: 'Comparación Mensual' },
  ];

  constructor(
    private firestore: Firestore,
    private auth: AuthService,
    private pdfService: PdfService,
    private fileOpener: FileOpener,
    private platform: Platform
  ) {}

  ngOnInit(): void {}

  async downloadReport(type: 'monthly' | 'csv' | string): Promise<void> {
    if (type === 'csv') {
      await this.generateCSV();
    } else if (type === 'monthly') {
      await this.generatePDF();
    } else if (this.charts.some(c => c.id === type)) {
      await this.generatePNG(type);
    }
  }

  async generateCSV(): Promise<void> {
    const snapshot = await getDocs(collection(this.firestore, 'users'));
    let csv = 'username,email,saldo,limite_mensual\n';
  
    snapshot.forEach(doc => {
      const d: any = doc.data();
      csv += `${d.username},${d.email},${d.saldo},${d.limite_mensual}\n`;
    });
  
    const base64data = btoa(unescape(encodeURIComponent(csv)));
    const fileName = 'ekonomi_usuarios.csv';
  
    await Filesystem.writeFile({
      path: fileName,
      data: base64data,
      directory: Directory.Documents,
      encoding: 'base64' as Encoding
    });
  
    console.log('📁 CSV guardado en:', fileName);
  
    // 📂 Abrir CSV automáticamente en Android
    if (this.platform.is('android')) {
      const uri = await Filesystem.getUri({
        directory: Directory.Documents,
        path: fileName
      });
  
      this.fileOpener.open(uri.uri, 'text/csv')
        .then(() => console.log('✅ CSV abierto correctamente'))
        .catch(err => console.error('❌ Error al abrir CSV', err));
    }
  }
  
  

  async generatePNG(type: string): Promise<void> {
  const canvas = document.getElementById(`${type}-chart`) as HTMLCanvasElement;
  if (!canvas) {
    console.error(`No se encontró el canvas para el gráfico ${type}`);
    return;
  }

  let base64data: string;

  try {
    // Método más compatible para obtener base64 del canvas
    base64data = canvas.toDataURL('image/png').split(',')[1];
  } catch (error) {
    console.error('❌ Error al convertir canvas a base64:', error);
    return;
  }

  const fileName = `ekonomi_${type}.png`;

  await Filesystem.writeFile({
    path: fileName,
    data: base64data,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
  });

  console.log('📁 PNG guardado en:', fileName);

  try {
    const uriResult = await Filesystem.getUri({
      directory: Directory.Documents,
      path: fileName
    });

    const mimeType = 'image/png';

    await this.fileOpener.open(uriResult.uri, mimeType);
    console.log('✅ PNG abierto correctamente');
  } catch (error) {
    console.error('❌ Error al abrir imagen PNG:', error);
  }
}

  
  

  private async generatePDF() {
    const user = await this.auth.getCurrentUser();
    if (!user) {
      console.error('Usuario no autenticado');
      return;
    }

    const movimientos = await this.auth.getMovimientos();
    const saldo = user.saldo || 0;
    const limite = user.limite_mensual || 0;
    const usado = movimientos
      .filter(m => m.tipo === 'gasto')
      .reduce((sum, m) => sum + +m.monto, 0);
    const restante = limite - usado;

    const resumen = { saldo, limite, usado, restante };
    this.pdfService.generarPDF(user, movimientos, resumen);
  }
}
