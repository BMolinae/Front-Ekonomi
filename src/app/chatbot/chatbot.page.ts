// src/app/chatbot/chatbot.page.ts

import { Component, OnInit, ViewChild } from '@angular/core';
import { IonicModule, IonContent } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators
} from '@angular/forms';
import { ChatService } from './chat.service';
import { Message } from './message.model';
import { RouterModule } from '@angular/router';


@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [
    IonicModule,
    CommonModule,
    ReactiveFormsModule,
    RouterModule
  ],
  templateUrl: './chatbot.page.html',
  styleUrls: ['./chatbot.page.scss'],
})
export class ChatbotPage implements OnInit {
  @ViewChild(IonContent) content!: IonContent;

  // Historial de mensajes
  messages: Message[] = [];

  // Formulario reactivo para el input
  chatForm!: FormGroup;

  // Flujo de sugerencias en etapas
  private suggestionFlows: string[][] = [
    ['hola', 'buenas', 'gracias', 'chao'],           // saludos
    ['saldo disponible', 'ver transacciones'],       // consultas de cuenta
    ['agregar tarjeta', 'poner límite'],             // acciones
    ['soporte', 'problema']                          // ayuda/soporte
  ];
  private currentStage = 0;

  // Sugerencias visibles en pantalla
  suggestions: string[] = [];

  constructor(
    private fb: FormBuilder,
    private chatService: ChatService
  ) { }

  ngOnInit() {
    // 1) Inicializar el formulario
    this.chatForm = this.fb.group({
      message: ['', Validators.required]
    });

    // 2) Cargar la primera etapa de sugerencias
    this.loadSuggestions();
  }

  /** Carga la lista de sugerencias de la etapa actual */
  private loadSuggestions() {
    this.suggestions = this.suggestionFlows[this.currentStage] || [];
  }

  /**
   * Manejador al tocar una sugerencia:
   *  - fija el valor en el form
   *  - envía el mensaje
   *  - avanza al siguiente conjunto de sugerencias
   */
  onSuggestion(q: string) {
    this.chatForm.setValue({ message: q });
    this.send();
    this.advanceSuggestions();
  }

  /** Avanza la etapa de sugerencias o las oculta si ya no hay más */
  private advanceSuggestions() {
    if (this.currentStage < this.suggestionFlows.length - 1) {
      this.currentStage++;
      this.loadSuggestions();
    } else {
      this.suggestions = [];
    }
  }

  /** Envía el mensaje del usuario y obtiene la respuesta del bot */
  send() {
    const text = this.chatForm.value.message.trim();
    if (!text) return;

    // 1) Insertar mensaje de usuario
    this.messages.push({
      from: 'user',
      text,
      timestamp: new Date()
    });
    this.chatForm.reset();

    // 2) Obtener y mostrar mensaje de bot
    this.chatService.sendMessage(text)
      .subscribe(botMsg => {
        this.messages.push(botMsg);
        // Scroll al final
        setTimeout(() => this.content.scrollToBottom(300), 50);
      });
  }
}
