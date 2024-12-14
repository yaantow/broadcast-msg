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

export interface SendResult {
  userId: string;
  success: boolean;
  error?: string;
}

export interface BroadcastProgress {
  successful: number;
  failed: number;
  totalProcessed: number;
  totalUsers: number;
  failedIds: string[];
  processedBatches: number;
  totalBatches: number;
}

export type { TelegramButton, BroadcastRequest, BroadcastResponse, TelegramAPIResponse };