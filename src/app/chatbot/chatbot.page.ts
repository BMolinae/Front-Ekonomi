// src/app/chatbot/chatbot.page.ts
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { IonicModule, IonContent } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Message } from './message.model';
import { RouterModule } from '@angular/router';
import { interval, Subscription, from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Storage } from '@ionic/storage';
import { AuthService } from '../services/auth.service';
import { MovimientosService } from '../services/movimientos.service';


const GEMINI_API_KEY = 'AIzaSyDjunmOJ9Qm6P3Fr6HHmSj8oPtUiTjxj1c';
const GEMINI_MODEL = 'gemini-2.0-flash';

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
    ['consultar mi saldo', '¿cuánto he gastado este mes?', 'ver mi límite'],
  ];

  public showAllSuggestions = false;
  public quickActionLabel = 'Acciones rápidas';

  private currentStage = 0;
  suggestions: string[] = [];

  public saldo: number = 0;
  public gastosMes: number = 0;
  public ingresoMes: number = 0;
  public monthlyLimit: number = 0;
  public limitLeft: number = 0;
  public usedLimit: number = 0;
  public gasto: number = 0;
  public movimientos: any[] = [];

  private awaitingResetConfirmation = false;
  private lastActivityTime = Date.now();
  private inactivitySub?: Subscription;
  private hasAskedIfPresent = false;
  private inactivityWarnings = 0;
  private userMood: 'neutral' | 'positive' | 'negative' = 'neutral';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private authService: AuthService,
    private movimientosService: MovimientosService
  ) { }

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
    this.suggestions = this.showAllSuggestions
      ? [this.quickActionLabel, ...this.suggestionFlows[this.currentStage] || []]
      : [this.quickActionLabel];
  }

  private async loadFinancialData() {
    try {
      // Obtener datos del usuario directamente desde AuthService
      const userData = await this.authService.getCurrentUserData();

      if (userData) {
        this.monthlyLimit = userData.limiteMensual || 0;
        this.saldo = userData.saldoTarjeta || 0;
        this.gasto = userData.gastoMensualActual || 0;
      }

      // Obtener movimientos directamente
      this.movimientos = await this.movimientosService.obtenerMovimientos();

      // Calcular estadísticas (similar al Dashboard)
      const now = new Date();
      const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
      const movMes = this.movimientos.filter(m => new Date(m.fecha) >= inicioMes);

      this.gastosMes = movMes
        .filter(m => m.tipo === 'gasto')
        .reduce((sum, m) => sum + +m.monto, 0);

      this.ingresoMes = movMes
        .filter(m => m.tipo === 'ingreso')
        .reduce((sum, m) => sum + +m.monto, 0);

      this.limitLeft = this.monthlyLimit - this.gasto;
      this.usedLimit = this.gastosMes;

    } catch (error) {
      console.error('Error al cargar datos:', error);
      this.messages.push({
        from: 'bot',
        text: '⚠️ No pude obtener tus datos financieros. Intenta nuevamente.',
        timestamp: new Date()
      });
    }
  }



  onSuggestion(q: string) {
    if (q === this.quickActionLabel) {
      // Si clickean "Acciones rápidas", alternar la visibilidad
      this.showAllSuggestions = !this.showAllSuggestions;
      this.loadSuggestions();
    } else {
      // Si seleccionan una sugerencia normal
      this.chatForm.setValue({ message: q });
      this.send();
      this.showAllSuggestions = false; // Ocultar sugerencias después de seleccionar
      setTimeout(() => this.loadSuggestions(), 300); // Pequeño delay para mejor UX
    }
  }


  async send() {
    const text = this.chatForm.value.message.trim();
    if (!text) return;

    await this.loadFinancialData();

    this.messages.push({
      from: 'user',
      text,
      timestamp: new Date()
    });
    this.chatForm.reset();

    this.lastActivityTime = Date.now();
    this.hasAskedIfPresent = false;
    this.inactivityWarnings = 0;

    const botResponse = this.generateBotResponse(text);

    if (typeof botResponse === 'string') {
      setTimeout(() => {
        this.messages.push({
          from: 'bot',
          text: botResponse,
          timestamp: new Date()
        });
        this.scrollToBottom();
      }, 400);
    } else {
      // Respuesta asíncrona de Gemini
      botResponse.subscribe(response => {
        this.messages.push({
          from: 'bot',
          text: response,
          timestamp: new Date()
        });
        this.scrollToBottom();
      });
    }
  }

  private generateBotResponse(userMessage: string): string | Observable<string> {
    const msg = userMessage.toLowerCase();
    this.analyzeMood(msg);

    // Manejar preguntas predefinidas
    const predefinedResponse = this.handlePredefinedQuestions(msg);
    if (predefinedResponse) {
      return predefinedResponse;
    }

    // Si no es pregunta predefinida, usar Gemini
    return this.queryGemini(userMessage);
  }


  private handlePredefinedQuestions(msg: string): string | null {
    const lowerMsg = msg.toLowerCase().trim();

    if (lowerMsg === 'consultar mi saldo') {
      return `💳 Tu saldo disponible es de $${this.saldo.toLocaleString('es-CL')}.`;
    }

    if (lowerMsg === '¿cuánto he gastado este mes?' || lowerMsg.includes('gastado este mes')) {
      return `📉 Este mes has gastado $${this.gastosMes.toLocaleString('es-CL')} ` +
        `(${this.monthlyLimit > 0 ? Math.round((this.gastosMes / this.saldo) * 100) : 0}% de tu saldo).`;
    }

    if (lowerMsg === 'ver mi límite' || lowerMsg.includes('límite mensual')) {
      if (this.monthlyLimit <= 0) {
        return `📊 Aún no has establecido un límite mensual. Puedes configurarlo en el Dashboard.`;
      }
      return `🏦 Tu límite mensual es $${this.monthlyLimit.toLocaleString('es-CL')}. ` +
        `Has gastado $${this.gasto.toLocaleString('es-CL')} ` +
        `(te quedan $${this.limitLeft.toLocaleString('es-CL')}).`;
    }

    return null;
  }

  // Si no reconoce el mensaje, pide confirmación para reiniciar
  private queryGemini(userMessage: string): Observable<string> {
    const prompt = `Actúa como el chatbot oficial de la aplicación financiera personal "Ekonomi CB&J", en su MODO TARJETA. Tu función es responder exclusivamente dudas sobre el uso de esta app en el modo tarjeta. No respondas sobre el modo manual. Si una consulta corresponde al modo manual, sugiere cambiar de modo desde el botón “Cambiar a Modo Manual” en el panel de inicio. No inventes funciones. Sé siempre breve, claro y preciso.

### Flujo general de la app:
- login → Inicio (modo tarjeta por defecto) → Gráficos → Chatbot → Documentos
- Desde "Inicio", el usuario puede cambiar al modo manual con el botón correspondiente.
- El flujo del modo manual es: Inicio Manual → Gráficos Manuales → Chatbot Manual → Documentos Manuales

### Modo TARJETA (Automático):
- Se conecta con una tarjeta bancaria y registra ingresos y gastos automáticamente.
- Los movimientos no se ingresan manualmente.

**Paneles del Modo Tarjeta:**

1. **Inicio (Dashboard)**:
   - Saldo, límite disponible, ingresos y gastos del mes.
   - Botones: “Agregar tarjeta”, “Poner límite”, “Cambiar a Modo Manual”.
   - Lista de movimientos recientes.

2. **Gráficos**:
   - Tarjeta con info del límite restante.
   - Gráfico circular: uso del límite.
   - Gráfico de líneas: ingresos (azul) vs gastos (rojo) últimos 4 meses.
   - Gráfico de categorías de gasto.

3. **Chatbot**:
   - Aquí solo debes resolver dudas sobre el modo tarjeta.

4. **Documentos**:
   - Descargar informe mensual (PDF).
   - Exportar transacciones (CSV).
   - Descargar gráficos (PNG).

### Sidebar:
- “Conoce tu app”, “Políticas de uso”, “Contacto”, “Cerrar sesión”.

Si el usuario pregunta cómo ingresar gastos manuales u otra función del modo manual, indícale que debe cambiar de modo desde el botón correspondiente. No expliques cómo funciona el modo manual. Mantente breve, seguro y preciso.

${userMessage}`;

    return this.http.post<any>(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ]
      }
    ).pipe(
      map(response => {
        return response.candidates?.[0]?.content?.parts?.[0]?.text ||
          "Lo siento, no puedo responder ahora. Intenta más tarde.";
      })
    );
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

      if (diffSeconds > 30 && !this.hasAskedIfPresent) {
        this.hasAskedIfPresent = true;
        this.inactivityWarnings++;
        this.messages.push({
          from: 'bot',
          text: '👀 ¿Sigues ahí? Estoy disponible si necesitas ayuda.',
          timestamp: new Date()
        });
        this.scrollToBottom();
      }

      if (diffSeconds > 60 && this.inactivityWarnings === 1) {
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
