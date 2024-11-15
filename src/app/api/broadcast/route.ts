import { NextResponse } from 'next/server';
import type { 
  BroadcastRequest, 
  BroadcastResponse, 
  TelegramMessagePayload,
  TelegramPhotoPayload,
  TelegramAPIResponse
} from './type';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface SendResult {
  userId: string;
  success: boolean;
  error?: string;
}

export async function POST(req: Request) {
  try {
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error('Telegram bot token not configured');
    }

    const { message, imageUrl, buttons, users } = await req.json() as BroadcastRequest;

    if (!message || !users.length) {
      return NextResponse.json({
        success: false,
        error: 'Message and users are required'
      }, { status: 400 });
    }

    const results = await Promise.all(
      users.map(async (userId): Promise<SendResult> => {
        try {
          await delay(50);

          let messageData: TelegramMessagePayload | TelegramPhotoPayload;
          
          if (imageUrl) {
            messageData = {
              chat_id: userId,
              photo: imageUrl,
              caption: message,
              parse_mode: 'Markdown',
              reply_markup: buttons.length ? {
                inline_keyboard: [buttons.map(button => ({
                  text: button.text,
                  url: button.url
                }))]
              } : undefined
            } as TelegramPhotoPayload;
          } else {
            messageData = {
              chat_id: userId,
              text: message,
              parse_mode: 'Markdown',
              reply_markup: buttons.length ? {
                inline_keyboard: [buttons.map(button => ({
                  text: button.text,
                  url: button.url
                }))]
              } : undefined
            } as TelegramMessagePayload;
          }

          const endpoint = imageUrl ? 'sendPhoto' : 'sendMessage';
          const response = await fetch(`${TELEGRAM_API}/${endpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(messageData),
          });

          const data = await response.json() as TelegramAPIResponse;
          console.log(`Response from Telegram for ${userId}:`, data);

          if (!response.ok || !data.ok) {
            return {
              userId,
              success: false,
              error: data.description || `Failed to send message: ${data.error_code}`
            };
          }

          return { userId, success: true };
        } catch (error) {
          console.error(`Failed to send to ${userId}:`, error);
          return { 
            userId, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    const successful = results.filter(result => result.success);
    const failed = results.filter(result => !result.success);

    const response: BroadcastResponse = {
      success: successful.length > 0,
      message: `Successfully sent to ${successful.length} users, failed for ${failed.length} users`,
      details: {
        successful: successful.length,
        failed: failed.length,
        failedIds: failed.map(result => `${result.userId}: ${result.error}`)
      }
    };

    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Broadcast error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to broadcast message',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }, 
      { status: 500 }
    );
  }
}