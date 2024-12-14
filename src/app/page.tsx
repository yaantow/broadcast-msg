'use client';
import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/theme-toggle"
import { Progress } from "@/components/ui/progress"
import { Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react"

interface TelegramButton {
  text: string;
  url: string;
}

interface TelegramUser {
  uid: string;
}

interface BroadcastProgress {
  successful: number;
  failed: number;
  totalProcessed: number;
  totalUsers: number;
  failedIds: string[];
  processedBatches: number;
  totalBatches: number;
}

interface ErrorCategory {
  errorMessage: string;  // The actual error message
  userIds: string[];    // List of users with this error
}

const categorizeErrors = (failedIds: string[]): ErrorCategory[] => {
  const errorGroups = new Map<string, string[]>();
  
  failedIds.forEach(failure => {
    // Split the failure string into userId and error message
    const [userId, ...errorParts] = failure.split(': ');
    const errorMessage = errorParts.join(': '); // Rejoin in case error message contained colons
    
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


export default function BroadcastPage() {
  const [users, setUsers] = useState<TelegramUser[]>([]);
  const [manualUserIds, setManualUserIds] = useState('');
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<BroadcastProgress | null>(null);
  
  // Rich message state
  const [messageText, setMessageText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [buttons, setButtons] = useState<TelegramButton[]>([]);
  const [newButton, setNewButton] = useState<TelegramButton>({ text: '', url: '' });
  const [failedUsers, setFailedUsers] = useState<string[]>([]);

  // Error handing
  const [errorCategories, setErrorCategories] = useState<ErrorCategory[]>([]);


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

  const handleBroadcast = async (retryCategory?: ErrorCategory | false) => {
    if (!messageText.trim() || (users.length === 0 && !retryCategory)) {
      setStatus('Please provide a message and add users');
      return;
    }
  
    setIsLoading(true);
    setProgress(null);
    setStatus('Broadcasting messages...');
  
    try {
      const targetUsers = retryCategory ? retryCategory.userIds : users.map(user => user.uid);
  
      const response = await fetch('/api/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          message: messageText,
          imageUrl,
          buttons,
          users: targetUsers,
        }),
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      if (reader) {
        try {
          let lastEventTime = Date.now();
          const TIMEOUT = 10000; // 10 seconds timeout
  
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              console.log("Stream complete");
              break;
            }
  
            // Update last event time
            lastEventTime = Date.now();
            
            const text = new TextDecoder().decode(value);
            const events = text.split('\n\n');
            
            for (const event of events) {
              if (event.startsWith('data: ')) {
                const data = JSON.parse(event.slice(6)) as BroadcastProgress;
                setProgress(data);
                
                const percentComplete = Math.round((data.totalProcessed / data.totalUsers) * 100);
                setStatus(`Progress: ${percentComplete}% (${data.totalProcessed}/${data.totalUsers})`);
                
                if (data.failedIds.length > 0) {
                  setFailedUsers(data.failedIds);
                  setErrorCategories(categorizeErrors(data.failedIds));
                }
  
                // If we've processed all users, break the loop
                if (data.totalProcessed === data.totalUsers) {
                  console.log("All users processed");
                  return;
                }
              }
            }
  
            // Check for timeout
            if (Date.now() - lastEventTime > TIMEOUT) {
              console.log("Stream timeout");
              throw new Error('Stream timeout - no updates received for 10 seconds');
            }
          }
        } catch (error) {
          console.error("Stream reading error:", error);
          throw error;
        } finally {
          reader.releaseLock();
        }
      }
  
      if (!failedUsers.length) {
        setMessageText('');
        setImageUrl('');
        setButtons([]);
      }
  
    } catch (error) {
      console.error('Broadcast error:', error);
      setStatus(error instanceof Error ? error.message : 'Failed to broadcast message. Please try again.');
    } finally {
      // Always ensure loading state is reset
      setIsLoading(false);
      console.log("Broadcast complete - loading state reset");
    }
  };
  
  const clearUsers = () => {
    setUsers([]);
    setManualUserIds('');
    setFailedUsers([]);
    setStatus('User list cleared');
    setProgress(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4">
        <ThemeToggle />
        <Card>
          <CardHeader>
            <CardTitle>Telegram Broadcast</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Progress Section */}
            {progress && (
              <div className="mb-6 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Progress</span>
                  <span>{Math.round((progress.totalProcessed / progress.totalUsers) * 100)}%</span>
                </div>
                <Progress 
                  value={(progress.totalProcessed / progress.totalUsers) * 100} 
                />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="text-green-500 h-4 w-4" />
                    <span>Successful: {progress.successful}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="text-red-500 h-4 w-4" />
                    <span>Failed: {progress.failed}</span>
                  </div>
                </div>
                {progress.failed > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Failed Deliveries</AlertTitle>
                    <AlertDescription>
                      <div className="mt-2 max-h-32 overflow-y-auto text-sm">
                        {progress.failedIds.map((id, index) => (
                          <div key={index} className="py-1">{id}</div>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Existing form content */}
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

            <div className="space-y-2">
                <Button
                  onClick={() => handleBroadcast(false)}
                  disabled={isLoading || !messageText.trim() || users.length === 0}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Broadcasting...
                    </>
                  ) : (
                    'Send Broadcast'
                  )}
                </Button>
                {errorCategories.length > 0 && (
                  <div className="space-y-4 mt-4">
                    <div className="text-sm font-medium">Failed Messages by Error Type:</div>
                    {errorCategories.map((category, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">
                            {category.userIds.length} {category.userIds.length === 1 ? 'user' : 'users'}
                          </div>
                          <Button
                            onClick={() => handleBroadcast(category)}
                            variant="outline"
                            size="sm"
                            disabled={isLoading}
                          >
                            Retry ({category.userIds.length})
                          </Button>
                        </div>
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Error Type</AlertTitle>
                          <AlertDescription>
                            <p className="mb-2">{category.errorMessage}</p>
                            <div className="mt-2 max-h-24 overflow-y-auto text-sm">
                              <div className="font-medium mb-1">Affected Users:</div>
                              {category.userIds.map((userId, idx) => (
                                <div key={idx} className="py-1">{userId}</div>
                              ))}
                            </div>
                          </AlertDescription>
                        </Alert>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status Messages */}
              {status && (
                <Alert className={`whitespace-pre-wrap ${
                  status.includes('Failed') ? 'bg-red-50' : 
                  status.includes('Successfully') ? 'bg-green-50' : ''
                }`}>
                  <AlertDescription>
                    {status}
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