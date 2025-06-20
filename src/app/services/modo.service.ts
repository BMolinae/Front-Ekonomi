import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ModoService {
  private modoManualSubject = new BehaviorSubject<boolean>(false);
  public modoManual$ = this.modoManualSubject.asObservable();

  setModoManual(value: boolean) {
    this.modoManualSubject.next(value);
  }

  getModoManual(): boolean {
    return this.modoManualSubject.getValue();
  }
}
