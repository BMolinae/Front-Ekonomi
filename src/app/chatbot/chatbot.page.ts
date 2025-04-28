// src/app/chatbot/chatbot.page.ts

import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { IonicModule, IonContent } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Message } from './message.model';
import { RouterModule } from '@angular/router';
import { interval, Subscription } from 'rxjs';

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
export class ChatbotPage implements OnInit, OnDestroy {
  @ViewChild(IonContent) content!: IonContent;

  messages: Message[] = [];
  chatForm!: FormGroup;

  private suggestionFlows: string[][] = [
    ['👋 ¡Hola!', '¿Cómo te encuentras hoy? 😊', '¡Gracias por tu confianza! 🙏', '👋 ¡Hasta pronto!'],
    ['💳 Consultar mi saldo', '📄 Ver mis últimos movimientos', '📉 ¿Cuánto he gastado este mes?'],
    ['➕ Agregar nueva tarjeta', '📈 Ajustar mi límite de gastos', '🔔 Configurar alertas y notificaciones'],
    ['🛠️ Necesito ayuda de soporte', '🚨 Reportar un problema técnico', '🔒 Recuperar acceso a mi cuenta'],
    ['🔍 Revisar historial de transacciones',],
   
  ];
  
  private currentStage = 0;
  suggestions: string[] = [];

  public saldo: number = 0;
  public gastosMes: number = 0;
  public ingresoMes: number = 0;
  public limitLeft: number = 0;
  public movimientos: any[] = [];

  private awaitingResetConfirmation = false;
  private lastActivityTime = Date.now();
  private inactivitySub?: Subscription;
  private hasAskedIfPresent = false;
  private inactivityWarnings = 0;
  private userMood: 'neutral' | 'positive' | 'negative' = 'neutral';

  constructor(private fb: FormBuilder) {}

  ngOnInit() {
    this.chatForm = this.fb.group({
      message: ['', Validators.required]
    });
    this.loadSuggestions();
    this.loadFinancialData();
    this.startInactivityTimer();
    this.welcomeMessage();
  }

  ngOnDestroy() {
    this.inactivitySub?.unsubscribe();
  }

  private welcomeMessage() {
    setTimeout(() => {
      this.messages.push({
        from: 'bot',
        text: '¡Hola! 👋 Soy tu asistente financiero virtual. ¿En qué puedo ayudarte hoy?',
        timestamp: new Date()
      });
      this.scrollToBottom();
    }, 500);
  }

  private loadSuggestions() {
    this.suggestions = this.suggestionFlows[this.currentStage] || [];
  }

  private loadFinancialData() {
    const dataStr = localStorage.getItem('user_financial_data');
    const movStr = localStorage.getItem('user_movimientos');
  
    if (dataStr) {
      const data = JSON.parse(dataStr);
      this.saldo = data.saldo || 0;
      this.gastosMes = data.gastosMes || 0;
      this.ingresoMes = data.ingresoMes || 0;
      this.limitLeft = data.limitLeft || 0;
    }
  
    if (movStr) {
      const rawMovs = JSON.parse(movStr) || [];
      this.movimientos = rawMovs.map((mov: any) => ({
        ...mov,
        fecha: new Date(mov.fecha) // reconvertimos la fecha correctamente
      }));
    }
  }
  

  onSuggestion(q: string) {
    this.chatForm.setValue({ message: q });
    this.send();
    this.advanceSuggestions();
  }

  private advanceSuggestions() {
    if (this.currentStage < this.suggestionFlows.length - 1) {
      this.currentStage++;
    } else {
      this.currentStage = 0;
    }
    this.loadSuggestions();
  }

  send() {
    const text = this.chatForm.value.message.trim();
    if (!text) return;

    this.messages.push({
      from: 'user',
      text,
      timestamp: new Date()
    });
    this.chatForm.reset();

    this.lastActivityTime = Date.now();
    this.hasAskedIfPresent = false;
    this.inactivityWarnings = 0;

    setTimeout(() => {
      const botResponse = this.generateBotResponse(text);
      this.messages.push({
        from: 'bot',
        text: botResponse,
        timestamp: new Date()
      });
      this.scrollToBottom();
    }, 400);
  }

  private generateBotResponse(userMessage: string): string {
    const msg = userMessage.toLowerCase();
    this.analyzeMood(msg);

    if (this.awaitingResetConfirmation) {
      this.awaitingResetConfirmation = false;

      if (msg.includes('sí') || msg.includes('si')) {
        this.resetChat();
        return '✅ Chat reiniciado. ¿En qué puedo ayudarte?';
      } else if (msg.includes('no')) {
        this.loadSuggestions();
        return '👌 Perfecto, continuamos entonces. ¿Cómo puedo ayudarte ahora?';
      } else {
        this.awaitingResetConfirmation = true;
        return '🙋 Por favor responde "sí" o "no" para continuar.';
      }
    }

    if (msg.includes('hola') || msg.includes('buenas') || msg.includes('cómo estás')) {
      return '¡Hola! 😃 ¿En qué puedo ayudarte hoy?';
    }
    if (msg.includes('gracias')) {
      return this.userMood === 'positive' ? 
        '¡Me alegra haberte ayudado! 🌟 ¿Algo más en que pueda asistirte?' :
        '¡Siempre estoy aquí para ayudarte! 🙌';
    }
    if (msg.includes('chao') || msg.includes('adiós')) {
      return '¡Hasta luego! 👋 Espero verte pronto.';
    }
    if (msg.includes('saldo')) {
      return `💳 Tu saldo disponible es de $${this.saldo.toLocaleString('es-CL')}.`;
    }
    if (msg.includes('gasto') || msg.includes('gasté')) {
      return `📉 Este mes has gastado $${this.gastosMes.toLocaleString('es-CL')}.`;
    }
    if (msg.includes('ingreso')) {
      return `📈 Tus ingresos recientes son $${this.ingresoMes.toLocaleString('es-CL')}.`;
    }
    if (msg.includes('movimiento') || msg.includes('transacción')) {
      return this.formatMovimientos();
    }
    if (msg.includes('tarjeta')) {
      return '💳 Para agregar una tarjeta, accede a la sección "Inicio" de la app.';
    }
    if (msg.includes('límite')) {
      return `🏦 Tu límite restante es de $${this.limitLeft.toLocaleString('es-CL')}.`;
    }
    if (msg.includes('alertas')) {
      return '🔔 Puedes configurar alertas en la sección "Notificaciones" de la app.';
    }
    if (msg.includes('soporte') || msg.includes('problema')) {
      return '🛠️ Puedes contactar a nuestro equipo de soporte escribiendo a soporte@ekonomi.com.';
    }
    if (msg.includes('recuperar')) {
      return '🔒 Puedes recuperar tu cuenta desde la pantalla de inicio de sesión, opción "¿Olvidaste tu contraseña?"';
    }

    this.awaitingResetConfirmation = true;
    return '🤔 No entendí muy bien tu mensaje... ¿Deseas reiniciar el chat para empezar de nuevo? (Sí / No)';
  }

  private analyzeMood(msg: string) {
    if (msg.includes('genial') || msg.includes('excelente') || msg.includes('gracias') || msg.includes('perfecto')) {
      this.userMood = 'positive';
    } else if (msg.includes('malo') || msg.includes('pésimo') || msg.includes('problema')) {
      this.userMood = 'negative';
    } else {
      this.userMood = 'neutral';
    }
  }

  private formatMovimientos(): string {
    if (!this.movimientos.length) {
      return '📄 No tienes transacciones recientes registradas.';
    }
  
    let respuesta = '📄 Aquí tienes tus últimas transacciones:\n\n';
  
    this.movimientos
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, 5)
      .forEach(mov => {
        const fecha = new Date(mov.fecha).toLocaleDateString('es-CL');
        const montoFormateado = `$${Math.abs(mov.monto).toLocaleString('es-CL')}`;
        const tipo = mov.monto >= 0 ? '💰 Ingreso' : '💸 Gasto';
  
        respuesta += `- ${tipo}: ${mov.descripcion} (${fecha}) por ${montoFormateado}\n`;
      });
  
    respuesta += '\n¿Quieres ver más movimientos o filtrar por categoría? 📚';
    return respuesta;
  }
  

  private scrollToBottom() {
    setTimeout(() => this.content.scrollToBottom(300), 100);
  }

  private resetChat() {
    this.messages = [];
    this.currentStage = 0;
    this.loadSuggestions();
    this.lastActivityTime = Date.now();
    this.inactivityWarnings = 0;
    this.welcomeMessage();
  }

  private startInactivityTimer() {
    this.inactivitySub = interval(5_000).subscribe(() => {
      const now = Date.now();
      const diffSeconds = (now - this.lastActivityTime) / 1000;

      if (diffSeconds > 15 && !this.hasAskedIfPresent) {
        this.hasAskedIfPresent = true;
        this.inactivityWarnings++;
        this.messages.push({
          from: 'bot',
          text: '👀 ¿Sigues ahí? Estoy disponible si necesitas ayuda.',
          timestamp: new Date()
        });
        this.scrollToBottom();
      }

      if (diffSeconds > 30 && this.inactivityWarnings === 1) {
        this.inactivityWarnings++;
        this.messages.push({
          from: 'bot',
          text: '⏳ Parece que estás ocupado. Estaré esperando si quieres continuar más tarde.',
          timestamp: new Date()
        });
        this.scrollToBottom();
      }
    });
  }
}
