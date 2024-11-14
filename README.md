# Telegram Broadcast Dashboard

A Next.js application that enables broadcasting messages to Telegram users through a bot. This dashboard allows for both individual and bulk messaging with rich formatting options.

## Features

### Message Composition
- **Rich Text Formatting**
  - Bold text formatting
  - Italic text formatting
  - Code block formatting
  - Support for Markdown syntax

- **Media Support**
  - Image sharing via URL
  - Preview of attached media

- **Interactive Elements**
  - Up to 3 custom inline buttons
  - Configurable button text and URLs

### User Management
- **Multiple Input Methods**
  - Manual input of Telegram user IDs (comma-separated)
  - Bulk import via CSV file
  - Real-time user list preview
  - User count display

- **CSV Format Support**
  - Simple one-ID-per-line format
  - Supports both .csv and .txt files
  - Automatic filtering of empty lines

### Broadcasting
- **Efficient Message Delivery**
  - Batch processing of messages
  - Rate limiting to prevent API throttling
  - Success/failure tracking for each message
  - Detailed delivery status reporting

## Technical Stack

- **Frontend Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS with shadcn/ui components
- **Language**: TypeScript
- **Font**: Geist Font (Sans & Mono)

## Prerequisites

- Node.js 18.17 or later
- A Telegram Bot Token
- Basic knowledge of Telegram Bot API

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd telegram-broadcast-dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file in the root directory:
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Configuration

### Telegram Bot Setup
1. Create a new bot using [@BotFather](https://t.me/botfather)
2. Obtain the bot token
3. Add the token to your environment variables

### User ID Collection
Users must have interacted with your bot before you can send them messages. To get user IDs:
- Users should start a chat with your bot
- Store user IDs when they interact with your bot
- Export IDs in CSV format for bulk messaging

## Usage

### Sending Messages

1. **Add Recipients**
   - Use the "Manual Input" tab for individual or small groups
   - Use "CSV Upload" for bulk recipients
   - Verify the user count before sending

2. **Compose Message**
   - Enter your message text
   - Use formatting buttons or Markdown syntax
   - Add image URL if needed
   - Configure inline buttons if required

3. **Send Broadcast**
   - Click "Send Broadcast"
   - Monitor the status for delivery results
   - Check failed deliveries in the response

### Message Formatting

```markdown
*bold text*
_italic text_
`code block`
```

### CSV Format Example
```csv
123456789
987654321
567891234
```

## Error Handling

The application handles various error scenarios:
- Invalid user IDs
- Network failures
- API rate limits
- Undeliverable messages

Failed deliveries are logged with specific error messages for troubleshooting.

## Development

### Project Structure
```
├── app/
│   ├── api/
│   │   └── broadcast/
│   │       ├── route.ts
│   │       └── types.ts
│   ├── fonts/
│   ├── types/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── ui/
├── public/
├── .env.local
└── package.json
```

### Custom Components
The application uses shadcn/ui components:
- Card
- Button
- Textarea
- Alert
- Tabs
- Input

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/feature-name`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin feature/feature-name`
5. Submit a Pull Request

## License


## Support

For support, issues, or feature requests, please create an issue in the GitHub repository.

## Authors

[yaantow]