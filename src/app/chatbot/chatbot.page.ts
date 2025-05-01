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
    ['💳 Consultar mi saldo','📉 ¿Cuánto he gastado este mes?','📈 Ajustar mi límite de gastos','➕ Agregar nueva tarjeta',],
    ['🛠️ Necesito ayuda de soporte', '🚨 Reportar un problema técnico', '🔒 Recuperar acceso a mi cuenta'],
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

    // Flujo 1: Saludos y despedida
    if (msg.includes('👋 ¡hola!') || msg.includes('hola') || msg.includes('buenas')) {
      return '¡Hola! 😃 ¿En qué puedo ayudarte hoy?';
    }
    
    if (msg.includes('¿cómo te encuentras hoy?') || msg.includes('cómo estás')) {
      return '¡Estoy muy bien, gracias por preguntar! 😊 Listo para ayudarte con tu gestión financiera. ¿En qué puedo asistirte?';
    }
    
    if (msg.includes('¡gracias por tu confianza!') || msg.includes('gracias')) {
      return this.userMood === 'positive' ? 
        '¡Me alegra haberte ayudado! 🌟 Trabajamos cada día para ofrecerte el mejor servicio. ¿Algo más en que pueda asistirte?' :
        '¡Siempre estoy aquí para ayudarte! 🙌 Tu satisfacción es nuestra prioridad.';
    }
    
    if (msg.includes('👋 ¡hasta pronto!') || msg.includes('hasta pronto') || msg.includes('chao') || msg.includes('adiós')) {
      return '¡Hasta luego! 👋 Que tengas un excelente día. Recuerda que estamos disponibles 24/7 para cualquier consulta.';
    }
    
    // Flujo 2: Consultas financieras
    if (msg.includes('💳 consultar mi saldo') || msg.includes('saldo')) {
      return `💳 Tu saldo disponible es de ${this.saldo.toLocaleString('es-CL')}. ¿Necesitas realizar alguna operación con este saldo?`;
    }
    
    if (msg.includes('📉 ¿cuánto he gastado este mes?') || msg.includes('gasto') || msg.includes('gasté') || msg.includes('cuánto he gastado')) {
      return `📉 Este mes has gastado ${this.gastosMes.toLocaleString('es-CL')}. Si quieres ver el detalle de tus gastos, puedes revisar la sección "Movimientos".`;
    }
    
    if (msg.includes('📈 ajustar mi límite de gastos') || msg.includes('límite') || msg.includes('ajustar mi límite')) {
      return `🏦 Tu límite de gastos actual es de ${this.limitLeft.toLocaleString('es-CL')}. Para ajustarlo, ve a la sección "Configuración" > "Límites de gastos" y establece el nuevo valor que desees.`;
    }
    
    if (msg.includes('➕ agregar nueva tarjeta') || msg.includes('agregar tarjeta') || msg.includes('nueva tarjeta') || msg.includes('tarjeta')) {
      return '💳 Para agregar una nueva tarjeta, sigue estos pasos: 1) Ve a la sección "Métodos de pago" 2) Pulsa en "Agregar nueva tarjeta" 3) Ingresa los datos solicitados y confirma la operación. ¿Necesitas ayuda con algo más?';
    }
    
    // Flujo 3: Soporte y resolución de problemas
    if (msg.includes('🛠️ necesito ayuda de soporte') || msg.includes('ayuda de soporte')) {
      return '🛠️ Estoy aquí para ayudarte. Puedes contactar a nuestro equipo de soporte escribiendo a soporte@ekonomi.com o llamando al 800-123-456. Nuestro horario de atención es de lunes a viernes de 9:00 a 18:00 hrs.';
    }
    
    if (msg.includes('🚨 reportar un problema técnico') || msg.includes('problema técnico') || msg.includes('reportar problema')) {
      return '🚨 Lamento que estés experimentando dificultades. Para reportar un problema técnico, por favor describe el error con el mayor detalle posible y nuestro equipo lo resolverá a la brevedad. ¿Puedes contarme qué problema estás enfrentando?';
    }
    
    if (msg.includes('🔒 recuperar acceso a mi cuenta') || msg.includes('recuperar acceso') || msg.includes('recuperar')) {
      return '🔒 Para recuperar el acceso a tu cuenta: 1) En la pantalla de inicio, selecciona "¿Olvidaste tu contraseña?" 2) Ingresa tu correo electrónico registrado 3) Recibirás un enlace para restablecer tu contraseña. Si necesitas asistencia adicional, contacta a soporte@ekonomi.com.';
    }
    
    // Otras consultas financieras
    if (msg.includes('ingreso')) {
      return `📈 Tus ingresos recientes son ${this.ingresoMes.toLocaleString('es-CL')}. ¿Te gustaría ver un desglose de tus fuentes de ingreso?`;
    }
    
    if (msg.includes('movimiento') || msg.includes('transacción')) {
      return this.formatMovimientos();
    }
    
    if (msg.includes('alertas')) {
      return '🔔 Puedes configurar alertas personalizadas en la sección "Notificaciones" de la app. Allí podrás activar avisos para: pagos próximos, gastos inusuales, depósitos recibidos y mucho más.';
    }
    
    if (msg.includes('soporte') || msg.includes('problema')) {
      return '🛠️ Puedes contactar a nuestro equipo de soporte escribiendo a soporte@ekonomi.com o a través del chat en vivo disponible de lunes a viernes de 9:00 a 18:00 hrs.';
    }

    // Si no reconoce el mensaje, pide confirmación para reiniciar
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
