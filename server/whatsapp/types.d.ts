declare module 'qrcode-terminal' {
  function generate(text: string, options?: { small: boolean }): void;
  export = generate;
}

declare module 'whatsapp-web.js' {
  export class Client {
    constructor(options?: any);
    initialize(): Promise<void>;
    destroy(): Promise<void>;
    sendMessage(to: string, message: string): Promise<any>;
    on(event: string, callback: (data: any) => void): void;
  }
  
  export class LocalAuth {
    constructor(options?: any);
  }
  
  export class MessageMedia {
    constructor(mimetype: string, data: string, filename?: string);
  }
} 