'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/theme-toggle"


interface TelegramButton {
  text: string;
  url: string;
}

interface TelegramUser {
  uid: string;
}

export default function BroadcastPage() {
  const [users, setUsers] = useState<TelegramUser[]>([]);
  const [manualUserIds, setManualUserIds] = useState('');
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Rich message state
  const [messageText, setMessageText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [buttons, setButtons] = useState<TelegramButton[]>([]);
  const [newButton, setNewButton] = useState<TelegramButton>({ text: '', url: '' });

  const addButton = () => {
    if (buttons.length >= 3) {
      setStatus('Maximum 3 buttons allowed');
      return;
    }
    if (!newButton.text || !newButton.url) {
      setStatus('Please fill both button text and URL');
      return;
    }
    setButtons([...buttons, newButton]);
    setNewButton({ text: '', url: '' });
  };

  const removeButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const formatText = (action: 'bold' | 'italic' | 'code') => {
    const textarea = document.querySelector('textarea');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = messageText.substring(start, end);
    
    const formats: Record<'bold' | 'italic' | 'code', { open: string; close: string }> = {
      bold: { open: '*', close: '*' },
      italic: { open: '_', close: '_' },
      code: { open: '`', close: '`' }
    };

    const { open, close } = formats[action];
    const newText = messageText.substring(0, start) + 
                   open + selectedText + close + 
                   messageText.substring(end);
    
    setMessageText(newText);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      const parsedUsers = lines
        .filter(line => line.trim())
        .map(line => ({ uid: line.trim() }));
      setUsers(parsedUsers);
      setStatus(`Loaded ${parsedUsers.length} users from CSV`);
    };
    reader.readAsText(file);
  };

  const handleManualInput = () => {
    if (!manualUserIds.trim()) {
      setStatus('Please enter at least one user ID');
      return;
    }

    const userIdList = manualUserIds
      .split(',')
      .map(id => id.trim())
      .filter(id => id);

    setUsers(userIdList.map(uid => ({ uid })));
    setStatus(`Added ${userIdList.length} users manually`);
  };

  const handleBroadcast = async () => {
    if (!messageText.trim() || users.length === 0) {
      setStatus('Please provide a message and add users');
      return;
    }

    setIsLoading(true);
    setStatus('Broadcasting messages...');

    try {
      const response = await fetch('/api/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageText,
          imageUrl,
          buttons,
          users: users.map(user => user.uid),
        }),
      });

      const responseData = await response.json();
      console.log('Broadcast Response:', responseData);

      if (!response.ok) {
        throw new Error(responseData.error || 'Broadcast failed');
      }
      
      // Update status message with success and failure counts
      const statusMessage = responseData.message;
      setStatus(statusMessage);

      // Only clear form if there were successful sends
      if (responseData.details.successful > 0) {
        setMessageText('');
        setImageUrl('');
        setButtons([]);
      }

      // If there are failures, show them in a more detailed way
      if (responseData.details.failed > 0) {
        console.log('Failed sends:', responseData.details.failedIds);
        setStatus(prev => `${prev}\n\nFailed IDs: ${responseData.details.failedIds.join(', ')}`);
      }

    } catch (error) {
      console.error('Broadcast error:', error);
      setStatus(error instanceof Error ? error.message : 'Failed to broadcast message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearUsers = () => {
    setUsers([]);
    setManualUserIds('');
    setStatus('User list cleared');
  };

  return (
<div className="min-h-screen bg-background">
  
  <div className="container mx-auto p-4">
  <ThemeToggle />
    <Card className="bg-card text-card-foreground">
        <CardHeader>
          <CardTitle>Telegram Broadcast</CardTitle>
          
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Tabs defaultValue="manual" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual">Manual Input</TabsTrigger>
                <TabsTrigger value="csv">CSV Upload</TabsTrigger>
              </TabsList>
              
              <TabsContent value="manual">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Enter User IDs (comma-separated)
                    </label>
                    <Textarea
                      value={manualUserIds}
                      onChange={(e) => setManualUserIds(e.target.value)}
                      placeholder="Enter user IDs separated by commas (e.g., 123456789, 987654321)"
                      className="w-full"
                    />
                    <Button 
                      onClick={handleManualInput}
                      className="mt-2"
                    >
                      Add Users
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="csv">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {"Upload Users CSV (keep it in one column with no header)"}
                  </label>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100"
                  />
                </div>
              </TabsContent>
            </Tabs>

            {users.length > 0 && (
              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">
                    Current Users: {users.length}
                  </span>
                  <Button 
                    variant="destructive" 
                    onClick={clearUsers}
                    size="sm"
                  >
                    Clear Users
                  </Button>
                </div>
                <div className="max-h-32 overflow-y-auto bg-gray-50 p-2 rounded-md">
                  <div className="text-sm text-gray-600">
                    {users.map((user, index) => (
                      <div key={index}>{user.uid}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4 mt-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Message Formatting
                </label>
                <div className="space-x-2 mb-2">
                  <Button 
                    variant="outline" 
                    onClick={() => formatText('bold')}
                    size="sm"
                  >
                    Bold
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => formatText('italic')}
                    size="sm"
                  >
                    Italic
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => formatText('code')}
                    size="sm"
                  >
                    Code
                  </Button>
                </div>
                <Textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Enter your message here... Use * for bold, _ for italic, ` for code"
                  rows={4}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Image URL (optional)
                </label>
                <Input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Enter image URL"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Add Buttons ({3 - buttons.length} remaining)
                </label>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder="Button Text"
                    value={newButton.text}
                    onChange={(e) => setNewButton({...newButton, text: e.target.value})}
                  />
                  <Input
                    placeholder="Button URL"
                    value={newButton.url}
                    onChange={(e) => setNewButton({...newButton, url: e.target.value})}
                  />
                  <Button 
                    onClick={addButton}
                    disabled={buttons.length >= 3}
                  >
                    Add
                  </Button>
                </div>

                {buttons.map((button, index) => (
                  <div key={index} className="flex items-center gap-2 mb-2">
                    <div className="flex-1 p-2 bg-gray-50 rounded">
                      {button.text} → {button.url}
                    </div>
                    <Button 
                      variant="destructive"
                      size="sm"
                      onClick={() => removeButton(index)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={handleBroadcast}
              disabled={isLoading || !messageText.trim() || users.length === 0}
              className="w-full"
            >
              {isLoading ? 'Broadcasting...' : 'Send Broadcast'}
            </Button>

            {status && (
              <Alert className={`whitespace-pre-wrap ${
                status.includes('Failed') ? 'bg-red-50' : 
                status.includes('Successfully') ? 'bg-green-50' : ''
              }`}>
                <AlertDescription>
                  {status.split('\n').map((line, index) => (
                    <div key={index} className={
                      line.includes('Failed IDs:') ? 'text-red-600 mt-2' : ''
                    }>
                      {line}
                    </div>
                  ))}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
    </div>
  );
}