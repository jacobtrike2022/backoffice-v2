import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Alert, AlertDescription } from '../ui/alert';
import { ScrollArea } from '../ui/scroll-area';
import {
  Send,
  Building2,
  Store,
  CheckCircle,
  Sparkles,
  Loader2,
  X,
} from 'lucide-react';
import { getServerUrl, publicAnonKey } from '../../utils/supabase/info';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

interface CollectedData {
  website?: string;
  company_name?: string;
  logo_url?: string;
  brand_colors?: { primary?: string; secondary?: string };
  industry?: string;
  services?: string[];
  operating_states?: string[];
  stores?: any[];
  store_count?: number;
  description?: string;
  contact_name?: string;
  contact_email?: string;
}

interface OnboardingChatProps {
  onComplete?: (organization: any) => void;
}

export const OnboardingChat: React.FC<OnboardingChatProps> = ({ onComplete }) => {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [collectedData, setCollectedData] = useState<CollectedData>({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Start session on mount
  useEffect(() => {
    startSession();
  }, []);

  const startSession = async () => {
    try {
      const response = await fetch(`${getServerUrl()}/onboarding/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': publicAnonKey,
        },
        body: JSON.stringify({
          referrer: document.referrer,
          utm_params: Object.fromEntries(new URLSearchParams(window.location.search)),
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSessionToken(data.session_token);
        // Add welcome message
        setMessages([
          {
            role: 'assistant',
            content: "Hi there! I'm here to help you get set up with Trike. To get started, what's your company website? I'll pull in your info automatically.",
            timestamp: new Date(),
          },
        ]);
      } else {
        throw new Error(data.error || 'Failed to start session');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || !sessionToken || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }]);
    setIsLoading(true);
    setError(null);

    // Check if this looks like a website URL
    const urlPattern = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/.*)?$/i;
    if (urlPattern.test(userMessage) && !collectedData.website) {
      // Scrape the website first
      await enrichFromWebsite(userMessage);
    } else {
      // Regular chat
      await chatWithAgent(userMessage);
    }

    setIsLoading(false);
  };

  const enrichFromWebsite = async (website: string) => {
    try {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "Let me look up your company...",
          timestamp: new Date(),
        },
      ]);

      const response = await fetch(`${getServerUrl()}/onboarding/enrich-company`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': publicAnonKey,
        },
        body: JSON.stringify({ website, session_token: sessionToken }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        setCollectedData(result.data);

        // Build response message
        let responseMsg = `I found **${result.data.company_name}**!`;

        if (result.data.industry) {
          responseMsg += ` Looks like you're in the ${formatIndustry(result.data.industry)} industry.`;
        }

        if (result.data.store_count && result.data.store_count > 0) {
          responseMsg += ` I found ${result.data.store_count} store locations.`;
        }

        if (result.data.services && result.data.services.length > 0) {
          responseMsg += `\n\nBased on your website, it looks like you offer: ${result.data.services.map(formatService).join(', ')}.`;
        }

        responseMsg += '\n\nDoes this look right? You can adjust anything that needs correcting.';

        setMessages((prev) => [
          ...prev.slice(0, -1), // Remove "Let me look up..." message
          {
            role: 'assistant',
            content: responseMsg,
            timestamp: new Date(),
          },
        ]);

        setShowConfirmation(true);
      } else {
        throw new Error(result.error || 'Failed to fetch company info');
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `I had trouble looking up that website. Could you tell me your company name instead?`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const chatWithAgent = async (message: string) => {
    try {
      const response = await fetch(`${getServerUrl()}/onboarding/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': publicAnonKey,
        },
        body: JSON.stringify({ session_token: sessionToken, message }),
      });

      const result = await response.json();

      if (result.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: result.message,
            timestamp: new Date(),
          },
        ]);

        if (result.collected_data) {
          setCollectedData(result.collected_data);
        }

        // Handle actions
        if (result.action === 'scrape_website' && result.data?.website) {
          await enrichFromWebsite(result.data.website);
        } else if (result.action === 'create_demo') {
          setShowConfirmation(true);
        }
      } else {
        throw new Error(result.error || 'Chat failed');
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "Sorry, I had a hiccup. Could you try that again?",
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleCreateDemo = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getServerUrl()}/onboarding/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': publicAnonKey,
        },
        body: JSON.stringify({ session_token: sessionToken, demo_days: 14 }),
      });

      const result = await response.json();

      if (result.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Your demo account for **${result.organization.name}** is ready! ${result.stores_imported > 0 ? `I imported ${result.stores_imported} store locations.` : ''}\n\nYour 14-day trial starts now. Let's get you logged in!`,
            timestamp: new Date(),
          },
        ]);

        if (onComplete) {
          onComplete(result.organization);
        }
      } else {
        throw new Error(result.error || 'Failed to create demo');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatIndustry = (slug: string): string => {
    const map: Record<string, string> = {
      convenience_retail: 'Convenience Retail',
      qsr: 'Quick Service Restaurant',
      grocery: 'Grocery & Supermarket',
      fuel_retail: 'Fuel Retail',
      hospitality: 'Hospitality',
    };
    return map[slug] || slug;
  };

  const formatService = (slug: string): string => {
    const map: Record<string, string> = {
      fuel: 'Fuel',
      alcohol: 'Alcohol',
      tobacco: 'Tobacco',
      vape: 'Vape/E-cigarettes',
      lottery: 'Lottery',
      food_service: 'Food Service',
      car_wash: 'Car Wash',
      atm: 'ATM',
      pharmacy: 'Pharmacy',
      money_orders: 'Money Services',
    };
    return map[slug] || slug;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderMessageContent = (content: string) => {
    // Convert **text** to bold
    return content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto p-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Welcome to Trike
        </h1>
        <p className="text-muted-foreground">
          Let's get your training platform set up in minutes
        </p>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 rounded-lg bg-muted/30 p-4 mb-4">
        <div className="space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <Avatar className="h-9 w-9 mr-2 shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Sparkles className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border shadow-sm'
                }`}
              >
                <p
                  className="text-sm whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: renderMessageContent(msg.content),
                  }}
                />
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Sparkles className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Company Card (when data is collected) */}
      {showConfirmation && collectedData.company_name && (
        <Card className="mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              {collectedData.logo_url ? (
                <Avatar className="h-12 w-12">
                  <AvatarImage src={collectedData.logo_url} alt={collectedData.company_name} />
                  <AvatarFallback>
                    <Building2 className="h-6 w-6" />
                  </AvatarFallback>
                </Avatar>
              ) : (
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Building2 className="h-6 w-6" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{collectedData.company_name}</h3>
                {collectedData.industry && (
                  <p className="text-sm text-muted-foreground">
                    {formatIndustry(collectedData.industry)}
                  </p>
                )}
              </div>
              {collectedData.store_count && collectedData.store_count > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <Store className="h-3 w-3" />
                  {collectedData.store_count} locations
                </Badge>
              )}
            </div>

            {collectedData.services && collectedData.services.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">Services</p>
                <div className="flex flex-wrap gap-1">
                  {collectedData.services.map((service) => (
                    <Badge key={service} variant="outline" className="text-xs">
                      {formatService(service)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleCreateDemo}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating your account...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Looks good! Create my demo
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription className="flex items-center justify-between">
            {error}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setError(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <Input
          placeholder="Type your message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
          disabled={isLoading}
          className="flex-1"
        />
        <Button
          onClick={sendMessage}
          disabled={!inputValue.trim() || isLoading}
          size="icon"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default OnboardingChat;
