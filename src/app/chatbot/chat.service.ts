import { Injectable } from '@angular/core';
import { HttpClient }   from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Message }       from './message.model';
import { environment } from '../../environments/environment';
import { HttpHeaders }  from '@angular/common/http';



interface QnaItem {
  question: string;
  answer: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private qna: QnaItem[] = [];

  constructor(private http: HttpClient) {
    this.http.get<QnaItem[]>('assets/qna.json')
      .subscribe(list => this.qna = list);
  }

  sendMessage(text: string): Observable<Message> {
    const key = text.trim().toLowerCase();
  
    // Caso especial: saldo dinámico
    if (key.includes('saldo')) {
      const token = localStorage.getItem('auth_token');
      const headers = new HttpHeaders().set('Authorization', `Token ${token}`);
  
      // Llamo al CurrentUserView que ya devuelve { saldo }
      return this.http.get<{ saldo: number }>(
          `${environment.apiUrl}user/`,
          { headers }
        ).pipe(
          map(res => {
            const formatted = res.saldo.toLocaleString('es-CL', {
              style: 'currency', currency: 'CLP'
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
  }
}
