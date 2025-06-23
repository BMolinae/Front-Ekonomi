export interface Message {
    from: 'user' | 'bot';
    text: string;
    timestamp: Date;
    loading?: boolean; // Indica si el mensaje está en proceso de carga
  }
  