import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Message } from './message.model';
import { environment } from '../../environments/environment';
import { HttpHeaders } from '@angular/common/http';
import { FirestoreService } from '../services/firestore.service';
import { from } from 'rxjs';






interface QnaItem {
  question: string;
  answer: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private qna: QnaItem[] = [];

  constructor(private http: HttpClient, private firestoreService: FirestoreService) {
    this.http.get<QnaItem[]>('assets/qna.json')
      .subscribe(list => this.qna = list);
  }

  sendMessage(text: string): Observable<Message> {
    const key = text.trim().toLowerCase();

    if (key.includes('saldo')) {
      return from(this.firestoreService.getUserDataOnce()).pipe(
        map((userData: any) => {
          const saldo = userData?.saldo || 0;
          const formatted = saldo.toLocaleString('es-CL', {
            style: 'currency',
            currency: 'CLP'
          });

          return {
            from: 'bot' as const,
            text: `Tu saldo disponible es ${formatted}.`,
            timestamp: new Date()
          };
        })
      );
    }

    // Resto Q&A fijo
    // 1) Buscamos coincidencia exacta
    let item = this.qna.find(q => q.question.toLowerCase() === key);
    // 2) Si no, por keyword
    if (!item) {
      const words = key.split(/\s+/);
      item = this.qna.find(q =>
        words.some(w => q.question.toLowerCase().includes(w))
      );
    }
    const answer = item
      ? item.answer
      : 'Lo siento, no entiendo tu pregunta.';

    return of({
      from: 'bot' as const,
      text: answer,
      timestamp: new Date()
    });
  };
}