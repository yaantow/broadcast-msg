// app/api/broadcast/types.ts
import type { 
    TelegramButton, 
    BroadcastRequest, 
    BroadcastResponse, 
    TelegramAPIResponse 
  } from '@/app/types';
  
  export interface TelegramMessagePayload {
    chat_id: string;
    text: string;
    parse_mode: 'Markdown' | 'HTML';
    reply_markup?: {
      inline_keyboard: Array<Array<{
        text: string;
        url: string;
      }>>;
    };
  }
  
  export interface TelegramPhotoPayload extends Omit<TelegramMessagePayload, 'text'> {
    photo: string;
    caption: string;
  }
  
  export type SendMessageResult = {
    userId: string;
    success: boolean;
    error?: string;
  };
  
  // Change this line to use export type
  export type { TelegramButton, BroadcastRequest, BroadcastResponse, TelegramAPIResponse };