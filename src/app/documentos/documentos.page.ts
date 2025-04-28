
import { Component, OnInit }           from '@angular/core';
import { HttpClient, HttpHeaders }     from '@angular/common/http';
import { saveAs }                      from 'file-saver';
import { AuthService }                 from '../services/auth.service';
import { IonicModule }                 from '@ionic/angular';
import { CommonModule }                from '@angular/common';
import { environment }                 from '../../environments/environment';

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
    { id: 'pie',   name: 'Gastos por Categoría' },
    { id: 'line',  name: 'Evolución de Gastos' },
    // puedes añadir más si lo necesitas
  ];

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {}

  ngOnInit(): void {}

  downloadReport(type: 'monthly' | 'csv' | string): void {
    const token = this.auth.getToken();
    if (!token) {
      console.error('No hay token de autenticación');
      return;
    }

    const headers = new HttpHeaders().set('Authorization', `Token ${token}`);
    // Construimos la URL apuntando al backend (puerto 8000)
    const url = `${environment.apiUrl}documents/${type}/`;

    this.http.get(url, {
      headers,
      responseType: 'blob'
    }).subscribe({
      next: blob => {
        // Determinamos la extensión según el tipo
        let ext = 'pdf';
        if (type === 'csv') ext = 'csv';
        else if (this.charts.some(c => c.id === type)) ext = 'png';

        // Descargamos el fichero
        saveAs(blob, `ekonomi_${type}.${ext}`);
      },
      error: err => {
        console.error(`Error descargando ${type}`, err);
      }
    });
  }
}
