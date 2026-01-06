import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Zap, 
  RefreshCw, 
  Check, 
  X, 
  Send, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  AlertCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Card } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { toast } from 'sonner';
import { getServerUrl, publicAnonKey } from '../../utils/supabase/info';
import { getSupabaseClient } from '../../utils/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface VariantGenerationChatProps {
  sourceTrack: {
    id: string;
    title: string;
    type: 'video' | 'article' | 'story' | 'checkpoint';
    transcript?: string;
    content?: string;
    thumbnail_url?: string;
  };
  variantType: 'geographic' | 'company' | 'unit';
  variantContext: {
    state_code?: string;
    state_name?: string;
    org_id?: string;
    org_name?: string;
    store_id?: string;
    store_name?: string;
  };
  onGenerated: (generatedContent: string, generatedTitle: string) => void;
  onCancel: () => void;
}

type ChatState = 'CLARIFYING' | 'READY_TO_GENERATE' | 'GENERATING' | 'PREVIEW' | 'DONE';

export function VariantGenerationChat({
  sourceTrack,
  variantType,
  variantContext,
  onGenerated,
  onCancel
}: VariantGenerationChatProps) {
  const [state, setState] = useState<ChatState>('CLARIFYING');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSourcePreview, setShowSourcePreview] = useState(false);
  const [generatedData, setGeneratedData] = useState<{
    generatedTitle: string;
    generatedContent: string;
    adaptations: Array<{
      section: string;
      originalText: string;
      adaptedText: string;
      reason: string;
    }>;
  } | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Initial message
  useEffect(() => {
    if (messages.length === 0) {
      handleChat([]);
    }
  }, []);

  const handleChat = async (currentMessages: Message[]) => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || publicAnonKey;

      const response = await fetch(`${getServerUrl()}/track-relationships/variant/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sourceTrackId: sourceTrack.id,
          variantType,
          variantContext,
          messages: currentMessages
        })
      });

      if (!response.ok) throw new Error('Failed to connect to AI assistant');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      let assistantContent = '';
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;

        // Check for special marker
        if (assistantContent.includes('[READY_TO_GENERATE]')) {
          const cleanContent = assistantContent.replace('[READY_TO_GENERATE]', '').trim();
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1].content = cleanContent;
            return newMessages;
          });
          setState('READY_TO_GENERATE');
          break;
        }

        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].content = assistantContent;
          return newMessages;
        });
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      toast.error(error.message || 'Error communicating with AI');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = () => {
    if (!inputValue.trim() || isLoading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: inputValue }];
    setMessages(newMessages);
    setInputValue('');
    handleChat(newMessages);
  };

  const handleGenerate = async () => {
    setState('GENERATING');
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || publicAnonKey;

      // Extract Q&A pairs from history
      const clarificationAnswers: any[] = [];
      for (let i = 0; i < messages.length; i++) {
        if (messages[i].role === 'assistant' && messages[i+1]?.role === 'user') {
          clarificationAnswers.push({
            question: messages[i].content,
            answer: messages[i+1].content
          });
        }
      }

      const response = await fetch(`${getServerUrl()}/track-relationships/variant/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sourceTrackId: sourceTrack.id,
          variantType,
          variantContext,
          clarificationAnswers
        })
      });

      if (!response.ok) throw new Error('Failed to generate variant');

      const data = await response.json();
      setGeneratedData(data);
      setState('PREVIEW');
    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error(error.message || 'Failed to generate variant');
      setState('READY_TO_GENERATE');
    } finally {
      setIsLoading(false);
    }
  };

  const renderContextBadge = () => {
    let label = '';
    switch (variantType) {
      case 'geographic': label = `${variantContext.state_name || variantContext.state_code} Variant`; break;
      case 'company': label = `${variantContext.org_name} Variant`; break;
      case 'unit': label = `${variantContext.store_name} Variant`; break;
    }
    return <Badge variant="secondary" className="bg-orange-100 text-orange-700">{label}</Badge>;
  };

  if (state === 'PREVIEW' && generatedData) {
    return (
      <div className="flex flex-col h-full space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">AI-Generated Variant Preview</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setState('READY_TO_GENERATE')}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Regenerate
            </Button>
            <Button size="sm" onClick={() => onGenerated(generatedData.generatedContent, generatedData.generatedTitle)}>
              <Check className="w-4 h-4 mr-2" />
              Use This Content
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto border rounded-lg bg-card p-6">
          <h1 className="text-2xl font-bold mb-4">{generatedData.generatedTitle}</h1>
          <div 
            className="prose dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: generatedData.generatedContent }}
          />

          {generatedData.adaptations.length > 0 && (
            <div className="mt-8 pt-8 border-t">
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-500" />
                Adaptation Summary
              </h4>
              <div className="space-y-4">
                {generatedData.adaptations.map((a, i) => (
                  <Card key={i} className="p-4 bg-muted border-border">
                    <h5 className="font-medium text-orange-600 dark:text-orange-400">{a.section}</h5>
                    <p className="text-sm mt-1 text-muted-foreground">{a.reason}</p>
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Original</p>
                        <p className="text-sm line-through opacity-50">{a.originalText}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-orange-500">Adapted</p>
                        <p className="text-sm">{a.adaptedText}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (state === 'GENERATING') {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-orange-100 border-t-orange-500 animate-spin" />
          <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-orange-500 animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-lg font-medium">Generating Variant Content...</p>
          <p className="text-sm text-muted-foreground">Adapting specifics while preserving source quality</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[60vh] bg-card rounded-xl overflow-hidden border border-border shadow-sm">
      {/* Header */}
      <div className="p-4 bg-muted/50 border-b border-border flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {sourceTrack.thumbnail_url ? (
            <img src={sourceTrack.thumbnail_url} className="w-10 h-10 rounded object-cover border" />
          ) : (
            <div className="w-10 h-10 rounded bg-orange-100 flex items-center justify-center border">
              <MessageSquare className="w-5 h-5 text-orange-600" />
            </div>
          )}
          <div>
            <h4 className="font-medium text-sm leading-tight">{sourceTrack.title}</h4>
            <div className="flex items-center gap-2 mt-1">
              {renderContextBadge()}
              <Badge variant="outline" className="text-[10px] uppercase">{sourceTrack.type}</Badge>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-end">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs h-8"
            onClick={() => setShowSourcePreview(!showSourcePreview)}
          >
            {showSourcePreview ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
            Source Preview
          </Button>
        </div>
      </div>

      {showSourcePreview && (
        <div className="bg-muted p-4 border-b border-border text-sm max-h-40 overflow-auto">
          <p className="font-semibold mb-1 text-foreground">Source Content ({sourceTrack.type}):</p>
          <p className="text-muted-foreground italic">
            {sourceTrack.transcript || sourceTrack.content || "No source content available for preview."}
          </p>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0 p-4 bg-transparent">
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center mr-2 shrink-0 shadow-sm">
                  <Zap className="w-4 h-4 text-white" />
                </div>
              )}
              <div 
                className={`max-w-[85%] p-3 rounded-2xl shadow-sm text-sm whitespace-pre-wrap ${
                  msg.role === 'user' 
                    ? 'bg-orange-500 text-white rounded-tr-none' 
                    : 'bg-secondary border border-border rounded-tl-none text-foreground'
                }`}
              >
                {msg.content}
                {isLoading && i === messages.length - 1 && msg.role === 'assistant' && (
                  <span className="inline-flex gap-1 ml-1">
                    <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Footer / Input */}
      <div className="p-4 bg-card border-t border-border space-y-3">
        {state === 'READY_TO_GENERATE' && (
          <div className="flex flex-col gap-2 p-3 bg-muted rounded-lg border border-orange-500/30">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              I have enough information to generate the variant.
            </p>
            <div className="flex gap-2">
              <Button 
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white shadow-md transition-all hover:scale-[1.02]"
                onClick={handleGenerate}
              >
                <Zap className="w-4 h-4 mr-2" />
                Generate Variant Content
              </Button>
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setState('CLARIFYING')}
              >
                Ask More Questions
              </Button>
            </div>
          </div>
        )}

        {state !== 'READY_TO_GENERATE' && (
          <div className="flex gap-2 items-end">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your response here..."
              className="min-h-[60px] max-h-[120px] resize-none focus-visible:ring-orange-500 bg-muted border-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={isLoading}
            />
            <Button 
              size="icon" 
              className="h-[60px] w-[60px] bg-orange-500 hover:bg-orange-600 text-white shrink-0 shadow-lg"
              onClick={handleSendMessage}
              disabled={isLoading || !inputValue.trim()}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
          <div className="flex gap-3">
            <button 
              className="hover:text-orange-500 transition-colors"
              onClick={() => handleChat([...messages, { role: 'user', content: 'Actually, just go ahead and generate it now.' }])}
            >
              Skip to Generate
            </button>
            <button 
              className="hover:text-red-500 transition-colors"
              onClick={onCancel}
            >
              Cancel AI Flow
            </button>
          </div>
          <p>Powered by Trike AI • Adaptive Generation</p>
        </div>
      </div>
    </div>
  );
}

