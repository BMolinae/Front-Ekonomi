// src/app/services/card.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CardService {

  constructor(private firestore: Firestore){}
  
  private cardLimitUpdated = new BehaviorSubject<boolean>(false);
  cardLimitUpdated$ = this.cardLimitUpdated.asObservable();

  notifyLimitUpdate() {
    this.cardLimitUpdated.next(true);
  }

  resetNotification() {
    this.cardLimitUpdated.next(false);
  }

  obtenerTarjetasPorUsuario(uid: string): Observable<any[]> {
  const ref = collection(this.firestore, `users/${uid}/tarjetas`);
  return collectionData(ref, { idField: 'id' }) as Observable<any[]>;
}
}
