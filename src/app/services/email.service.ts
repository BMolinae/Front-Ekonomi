import { inject } from '@angular/core';
import { Injectable } from '@angular/core';
import { Functions } from '@angular/fire/functions';
import { httpsCallable } from 'firebase/functions';

@Injectable({ providedIn: 'root' })
export class EmailService {
    private functions = inject(Functions);
    enviarCorreo(data: {
        nombre: string;
        correo: string;
        asunto: string;
        mensaje: string;
    }) {
        const sendEmailFn = httpsCallable(this.functions, 'enviarCorreo');
        return sendEmailFn(data);
    }
}
