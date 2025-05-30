import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

interface BinlistResponse {
  scheme: string;    // Visa, MasterCard, etc.
  type: string;      // debit, credit, etc.
  brand: string;     // Classic, Platinum, etc.
  prepaid: boolean;
  country: {
    name: string;
    alpha2: string;
    emoji: string;
  };
  bank: {
    name: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class CardValidationService {
  private baseUrl = 'https://lookup.binlist.net';

  constructor(private http: HttpClient) {}

  validateCardBin(cardNumber: string): Observable<BinlistResponse> {
    // Usamos los primeros 6 dígitos (BIN)
    const bin = cardNumber.replace(/\D/g, '').substring(0, 6);
    return this.http.get<BinlistResponse>(`${this.baseUrl}/${bin}`);
  }
}
