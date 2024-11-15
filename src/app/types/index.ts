export interface TelegramButton {
    text: string;
    url: string;
  }
  
  export interface TelegramUser {
    uid: string;
  }
  
  export interface BroadcastRequest {
    message: string;
    imageUrl?: string;
    buttons: TelegramButton[];
    users: string[];
  }
  
  export interface TelegramAPIResponse {
    ok: boolean;
    result?: any;
    description?: string;
    error_code?: number;
  }
  
  export interface BroadcastResponse {
    success: boolean;
    message: string;
    details?: {
      successful: number;
      failed: number;
      failedIds: string[];
      processedBatches?: number;  
      totalProcessed?: number;    
    };
    error?: string;
  }