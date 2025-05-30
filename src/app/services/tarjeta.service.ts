import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, addDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';

export interface Tarjeta {
  nombre: string;
  tipo: string;
  numero: string;
  vencimiento: string;
  codigo: string;
}

@Injectable({
  providedIn: 'root'
})
export class TarjetaService {

  constructor(private firestore: Firestore, private http: HttpClient) {}

 
  addTarjeta(tarjeta: Tarjeta) {
    const tarjetasRef = collection(this.firestore, 'tarjetas');
    return addDoc(tarjetasRef, tarjeta);
  }

  getTarjetas(): Observable<Tarjeta[]> {
    const tarjetasRef = collection(this.firestore, 'tarjetas');
    return collectionData(tarjetasRef, { idField: 'id' }) as Observable<Tarjeta[]>;
  }

    getTarjetaInfo(bin: string) {
    const url = `https://api.bincodes.com/bin/json/629e46cb9bf707878591e3d64d6dbd9b/${bin}`;
    return this.http.get(url).toPromise();
  }
}
