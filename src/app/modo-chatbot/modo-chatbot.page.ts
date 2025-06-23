// src/app/modo-chatbot/modo-chatbot.page.ts
import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { IonicModule, IonContent } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Message } from '../chatbot/message.model';
import { RouterModule } from '@angular/router';
import { interval, Subscription, from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { ManualTransactionService } from '../services/manual-transaction.service';
import { HttpClient } from '@angular/common/http';

const GEMINI_API_KEY = 'AIzaSyDjunmOJ9Qm6P3Fr6HHmSj8oPtUiTjxj1c';
const GEMINI_MODEL = 'gemini-2.0-flash';

@Component({
  selector: 'app-modo-chatbot',
  standalone: true,
  imports: [
    IonicModule,
    CommonModule,
    ReactiveFormsModule,
    RouterModule
  ],
  templateUrl: './modo-chatbot.page.html',
  styleUrls: ['./modo-chatbot.page.scss'],
})
export class ModoChatbotPage implements OnInit, OnDestroy {
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
  public movimientos: any[] = [];

  private awaitingResetConfirmation = false;
  private lastActivityTime = Date.now();
  private inactivitySub?: Subscription;
  private hasAskedIfPresent = false;
  private inactivityWarnings = 0;
  private userMood: 'neutral' | 'positive' | 'negative' = 'neutral';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private manualTransactionService: ManualTransactionService,
    private http: HttpClient
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
        text: '¡Hola! 👋 Soy tu asistente financiero virtual para el modo manual. ¿En qué puedo ayudarte hoy?',
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
        this.monthlyLimit = userData.limiteMensualManual || 0;
        this.saldo = userData.saldoManual || 0;
      }

      // Obtener movimientos manuales directamente
      this.movimientos = await this.getManualMovimientos();

      // Calcular estadísticas (similar al Dashboard manual)
      const now = new Date();
      const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
      const movMes = this.movimientos.filter(m => new Date(m.fecha) >= inicioMes);

      this.gastosMes = movMes
        .filter(m => m.tipo === 'gasto')
        .reduce((sum, m) => sum + +m.monto, 0);

      this.ingresoMes = movMes
        .filter(m => m.tipo === 'ingreso')
        .reduce((sum, m) => sum + +m.monto, 0);

      this.limitLeft = this.monthlyLimit - this.gastosMes;
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

  private async getManualMovimientos(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const sub = this.manualTransactionService.getTransactions().subscribe({
        next: (transactions) => {
          const mapped = transactions.map(t => ({
            id: t.id,
            tipo: t.tipo,
            descripcion: t.descripcion,
            monto: Math.abs(t.monto),
            categoria: t.categoria || 'Otros',
            fecha: t.createdAt?.toDate?.() || t.fecha || new Date()
          }));
          sub.unsubscribe();
          resolve(mapped);
        },
        error: (err) => {
          sub.unsubscribe();
          reject(err);
        }
      });
    });
  }

  onSuggestion(q: string) {
    if (q === this.quickActionLabel) {
      this.showAllSuggestions = !this.showAllSuggestions;
      this.loadSuggestions();
    } else {
      this.chatForm.setValue({ message: q });
      this.send();
      this.showAllSuggestions = false;
      setTimeout(() => this.loadSuggestions(), 300);
    }
  }

  async send() {
    const text = this.chatForm.value.message.trim();
    if (!text) return;

    // Recargar datos antes de responder
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

    if (this.awaitingResetConfirmation) {
      this.awaitingResetConfirmation = false;
      if (lowerMsg.includes('sí') || lowerMsg.includes('si')) {
        this.resetChat();
        return '✅ Chat reiniciado. ¿En qué puedo ayudarte?';
      } else if (lowerMsg.includes('no')) {
        this.loadSuggestions();
        return '👌 Perfecto, continuamos entonces. ¿Cómo puedo ayudarte ahora?';
      } else {
        this.awaitingResetConfirmation = true;
        return '🙋 Por favor responde "sí" o "no" para continuar.';
      }
    }

    if (lowerMsg === 'consultar mi saldo') {
      return `💳 Tu saldo disponible es de $${this.saldo.toLocaleString('es-CL')}.`;
    }

    if (lowerMsg === '¿cuánto he gastado este mes?') {
      return `📉 Este mes has gastado $${this.gastosMes.toLocaleString('es-CL')} ` +
        `(${this.monthlyLimit > 0 ? Math.round((this.gastosMes / this.monthlyLimit) * 100) : 0}% de tu límite).`;
    }

    if (lowerMsg === 'ver mi límite') {
      if (this.monthlyLimit <= 0) {
        return `📊 Aún no has establecido un límite mensual. Puedes configurarlo en el Dashboard.`;
      }
      return `🏦 Tu límite mensual es $${this.monthlyLimit.toLocaleString('es-CL')}. ` +
        `Has gastado $${this.gastosMes.toLocaleString('es-CL')} ` +
        `(te quedan $${this.limitLeft.toLocaleString('es-CL')}).`;
    }

    return null;
  }

  private queryGemini(userMessage: string): Observable<string> {
    const prompt = `Actúa como el chatbot oficial de la aplicación financiera personal "Ekonomi CB&J", en su MODO MANUAL. Tu tarea es responder exclusivamente dudas sobre el uso de esta app en modo manual. No respondas sobre el modo tarjeta. Si la consulta corresponde al modo tarjeta, sugiere al usuario volver a modo automático desde el botón en la pantalla de inicio. Responde siempre de forma breve, clara y precisa.

### Flujo general de la app:
- login → Inicio (modo tarjeta por defecto) → Gráficos → Chatbot → Documentos
- Desde "Inicio", el usuario puede cambiar a modo manual.
- El flujo del modo manual es: Inicio Manual → Gráficos Manuales → Chatbot Manual → Documentos Manuales

### Modo MANUAL:
- Permite registrar gastos e ingresos de forma manual, útil para controlar pagos en efectivo o fuera del banco.

**Paneles del Modo Manual:**

1. **Inicio Manual (Dashboard)**:
   - Saldo disponible, límite, ingresos y gastos del mes.
   - Botones: “Agregar movimiento”, “Poner límite”, “Volver a modo automático”.
   - Lista de movimientos recientes.

2. **Gráficos Manuales**:
   - Tarjeta del límite restante.
   - Gráfico circular de uso del límite.
   - Gráfico de líneas con ingresos y gastos últimos 4 meses.
   - Gráfico de categorías de gasto.

3. **Chatbot Manual**:
   - Aquí solo debes resolver dudas sobre el modo manual.

4. **Documentos Manuales**:
   - Informe mensual manual (PDF), exportar CSV, gráficos en PNG.

### Sidebar:
- “Conoce tu app”, “Políticas de uso”, “Contacto”, “Cerrar sesión”.

Si el usuario pregunta sobre agregar tarjetas o cómo funciona el registro automático, sugiérele volver a modo automático. No expliques cómo funciona el modo tarjeta. Mantente concreto, enfocado y responde siempre dentro del MODO MANUAL.

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
      return '📄 No tienes transacciones manuales recientes registradas.';
    }

    let respuesta = '📄 Aquí tienes tus últimas transacciones manuales:\n\n';

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