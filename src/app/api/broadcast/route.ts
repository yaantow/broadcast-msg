import { NextResponse } from 'next/server';
import type { 
  BroadcastRequest, 
  BroadcastResponse, 
  TelegramMessagePayload,
  TelegramPhotoPayload,
  TelegramAPIResponse,
  SendResult
} from './type';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

interface ErrorCategory {
  errorMessage: string;
  userIds: string[];
}

// Constants for rate limiting and batching
const BATCH_SIZE = 25;
const DELAY_BETWEEN_MESSAGES = 50;
const DELAY_BETWEEN_BATCHES = 2000;

const categorizeErrors = (failedIds: string[]): ErrorCategory[] => {
  const errorGroups = new Map<string, string[]>();
  
  failedIds.forEach(failure => {
    const [userId, ...errorParts] = failure.split(': ');
    const errorMessage = errorParts.join(': ');
    
    if (!errorGroups.has(errorMessage)) {
      errorGroups.set(errorMessage, []);
    }
    errorGroups.get(errorMessage)?.push(userId);
  });

  return Array.from(errorGroups.entries()).map(([errorMessage, userIds]) => ({
    errorMessage,
    userIds
  }));
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function chunk<T>(array: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, i * size + size)
  );
}

async function sendMessage(
  userId: string,
  messageData: TelegramMessagePayload | TelegramPhotoPayload,
  isPhoto: boolean
): Promise<SendResult> {
  try {
    const endpoint = isPhoto ? 'sendPhoto' : 'sendMessage';
    const response = await fetch(`${TELEGRAM_API}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messageData),
    });

    const data = await response.json() as TelegramAPIResponse;

    if (!response.ok || !data.ok) {
      return {
        userId,
        success: false,
        error: data.description || `Failed to send message: ${data.error_code}`
      };
    }

    return { userId, success: true };
  } catch (error) {
    return { 
      userId, 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function POST(req: Request) {
  const acceptsSSE = req.headers.get('accept') === 'text/event-stream';
  
  if (acceptsSSE) {
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    
    const processRequest = async () => {
      try {
        if (!TELEGRAM_BOT_TOKEN) {
          throw new Error('Telegram bot token not configured');
        }

        const { message, imageUrl, buttons, users } = await req.json() as BroadcastRequest;

        if (!message || !users.length) {
          throw new Error('Message and users are required');
        }

        const batches = chunk(users, BATCH_SIZE);
        const totalBatches = batches.length;
        
        let successful = 0;
        let failed = 0;
        const failedIds: string[] = [];
        let processedBatches = 0;

        for (const batch of batches) {
          const batchPromises = batch.map(async (userId, index) => {
            await delay(index * DELAY_BETWEEN_MESSAGES);

            const messageData = imageUrl
              ? {
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
                } as TelegramPhotoPayload
              : {
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

            const result = await sendMessage(userId, messageData, !!imageUrl);
            
            if (result.success) {
              successful++;
            } else {
              failed++;
              failedIds.push(`${userId}: ${result.error}`);
            }
          });

          // Wait for all messages in batch to complete
          await Promise.all(batchPromises);
          processedBatches++;

          // Send status update through stream
          const status = {
            successful,
            failed,
            totalProcessed: successful + failed,
            totalUsers: users.length,
            failedIds,
            processedBatches,
            totalBatches
          };

          await writer.write(encoder.encode(`data: ${JSON.stringify(status)}\n\n`));
          
          // Add delay before next batch if not the last batch
          if (processedBatches < totalBatches) {
            await delay(DELAY_BETWEEN_BATCHES);
          }
        }

        // Close the stream when done
        await writer.close();
      } catch (error) {
        console.error('Broadcasting error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        await writer.write(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`));
        await writer.close();
      }
    };

    // Start processing in background
    processRequest();

    // Return stream immediately
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } else {
    // Handle non-streaming requests
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

      const response: BroadcastResponse = {
        success: true,
        message: 'Broadcast started',
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
}