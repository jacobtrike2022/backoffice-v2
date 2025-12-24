import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  X, 
  Send, 
  MessageSquare, 
  Sparkles,
  Loader2,
  ChevronRight,
  BookOpen
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogTitle,
  DialogPortal,
  DialogOverlay
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../ui/utils';
import { supabase, getCurrentUserOrgId } from '../../lib/supabase';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface BrainMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
}

interface BrainChatDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  track: any;
  onNavigateToTrack?: (trackId: string) => void;
  isPublicView?: boolean;
}

const BrainChatDrawer: React.FC<BrainChatDrawerProps> = ({
  isOpen,
  onOpenChange,
  track,
  onNavigateToTrack,
  isPublicView = false
}) => {
  const [messages, setMessages] = useState<BrainMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  // Reset chat when track changes
  useEffect(() => {
    setMessages([]);
    setConversationId(null);
    setInput('');
  }, [track?.id]);

  const handleSend = async (text: string = input) => {
    if (!text.trim() || !track || isLoading) return;

    const userMessage = text.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const orgId = await getCurrentUserOrgId();
      if (!orgId) throw new Error('Organization not found');

      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || publicAnonKey;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/trike-server/brain/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            'apikey': publicAnonKey
          },
          body: JSON.stringify({
            message: userMessage,
            conversationId: conversationId || undefined,
            organizationId: orgId,
            trackId: track.id
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to get response (${response.status})`);
      }

      const data = await response.json();
      
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }

      let aiContent = '';
      if (data.message?.content) aiContent = data.message.content;
      else if (typeof data.message === 'string') aiContent = data.message;
      else if (data.response) aiContent = data.response;

      if (!aiContent) throw new Error('Received empty response from AI');

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: aiContent,
        sources: data.sources || []
      }]);
    } catch (error: any) {
      console.error('Brain chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: error.message || "Sorry, I encountered an error. Please try again." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatMessage = (content: string) => {
    // 1. Handle bold: **term** -> <strong>term</strong>
    let formatted = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // 2. Handle numbered lists: 1. item -> <li>item</li>
    const lines = formatted.split('\n');
    let inList = false;
    const result: React.ReactNode[] = [];

    lines.forEach((line, i) => {
      const listMatch = line.match(/^\d+\.\s+(.*)/);
      if (listMatch) {
        if (!inList) {
          inList = true;
          result.push(<ol key={`list-start-${i}`} className="list-decimal ml-6 space-y-2 my-3" />);
        }
        // This is a simplification, in a real React component we'd push to the last element if it's an OL
        // But for this purpose, we'll just wrap the content.
        result.push(<li key={i} className="mb-1">{listMatch[1]}</li>);
      } else {
        if (inList) inList = false;
        if (line.trim()) {
          result.push(<p key={i} className="mb-3 last:mb-0" dangerouslySetInnerHTML={{ __html: line }} />);
        }
      }
    });

    // Actually, a better way to handle the mix of HTML and React for the list
    // Let's just do a simple markdown-to-html string and use dangerouslySetInnerHTML for the whole bubble
    // but with sanitized/controlled parsing.
    
    return formatted.split('\n\n').map((para, i) => {
      // Check if paragraph is a list
      if (para.match(/^\d+\.\s+/m)) {
        const listItems = para.split('\n').map((item, j) => {
          const content = item.replace(/^\d+\.\s+/, '');
          return `<li key="${j}">${content}</li>`;
        });
        return `<ol class="list-decimal ml-6 space-y-2 my-3">${listItems.join('')}</ol>`;
      }
      return `<p class="mb-3 last:mb-0">${para.replace(/\n/g, '<br />')}</p>`;
    }).join('');
  };

  const suggestedPrompts = track?.type === 'video' 
    ? ["Summarize the key points", "What are the main steps?", "When should I contact a supervisor?"]
    : ["What's the key takeaway?", "Explain this simply", "Summarize this for me"];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md"
        />
        <DialogContent 
          className="fixed top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 z-50 w-[50vw] max-w-2xl h-[70vh] bg-[#0d0d0f]/90 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-0 flex flex-col"
          style={{
            boxShadow: `
              0 0 0 1px rgba(255,255,255,0.05),
              0 0 80px -20px rgba(255,107,0,0.5),
              0 0 60px -30px rgba(255,60,0,0.4),
              0 25px 50px -12px rgba(0,0,0,0.8)
            `
          }}
        >
          {/* Animated edge glow */}
          <div 
            className="absolute -inset-[1px] rounded-3xl opacity-60 -z-10 animate-pulse"
            style={{
              background: 'linear-gradient(135deg, rgba(255,107,0,0.3) 0%, transparent 50%, rgba(255,60,0,0.2) 100%)',
              filter: 'blur(20px)',
            }}
          />

            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div className="flex items-center gap-3">
                {/* Mini lightning bolt */}
                <Zap 
                  className="w-5 h-5" 
                  style={{ color: '#FF6B00', filter: 'drop-shadow(0 0 8px rgba(255,107,0,0.6))' }}
                  fill="currentColor"
                />
                <DialogTitle className="text-lg font-semibold text-white">Company Brain</DialogTitle>
              </div>
              
              <button
                onClick={() => onOpenChange(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>

            {/* Context Pill */}
            {track && (
              <div className="px-5 pt-3 pb-2">
                <div 
                  className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium text-white"
                  style={{
                    background: 'linear-gradient(135deg, #FF6B00 0%, #FF3C00 100%)',
                    boxShadow: '0 4px 15px rgba(255,107,0,0.3)',
                  }}
                >
                  {track.title}
                </div>
              </div>
            )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4">
            {messages.length === 0 ? (
              /* Empty State */
              <div className="flex-1 flex flex-col items-center justify-center px-8 text-center h-full">
                {/* Lightning bolt with glow */}
                <div className="relative mb-6">
                  <div 
                    className="absolute inset-0 blur-xl opacity-50"
                    style={{ background: 'radial-gradient(circle, #FF6B00 0%, transparent 70%)' }}
                  />
                  <Zap 
                    className="relative w-14 h-14" 
                    style={{ 
                      color: '#FF6B00',
                      filter: 'drop-shadow(0 0 20px rgba(255,107,0,0.6))',
                    }}
                    fill="currentColor"
                  />
                </div>
                
                {/* Title */}
                <h2 className="text-xl font-semibold text-white mb-2">
                  Ask anything about this article
                </h2>
                
                {/* Subtitle */}
                <p className="text-white/50 text-sm mb-8">
                  I'll search your training content to find the answer.
                </p>
                
                {/* Suggested prompts */}
                <div className="w-full max-w-sm space-y-3">
                  {suggestedPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(prompt)}
                      className="w-full px-5 py-3.5 text-left text-white/80 text-sm bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange-500/30 rounded-2xl transition-all duration-200 hover:shadow-[0_0_20px_rgba(255,107,0,0.15)]"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-6 space-y-6">
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex flex-col",
                      msg.role === 'user' ? "items-end" : "items-start"
                    )}
                  >
                    <div
                      className={cn(
                        "p-4 md:p-5 text-[15px] leading-[1.6]",
                        msg.role === 'user' 
                          ? "bg-gradient-to-br from-[#FF6B00] to-[#FF3C00] text-white rounded-[24px_24px_4px_24px] shadow-lg shadow-orange-500/30 max-w-[85%]"
                          : "bg-white/5 border border-white/10 text-white/90 rounded-[24px_24px_24px_4px] max-w-[90%]"
                      )}
                    >
                      <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                    </div>

                    {/* Source Pills */}
                    {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-4 w-full max-w-[90%] mb-2">
                        <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-3 ml-1">
                          📚 Sources
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {msg.sources.map((source, j) => (
                            <button
                              key={j}
                              onClick={() => onNavigateToTrack?.(source.content_id || source.id)}
                              className="bg-gradient-to-br from-[#FF6B00] to-[#FF3C00] px-4 py-2 rounded-full text-[13px] font-medium text-white shadow-lg shadow-orange-500/10 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 min-h-[36px]"
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                              {source.metadata?.title || source.title || "Related Content"}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}

                {/* Thinking State */}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-start"
                  >
                    <div className="flex items-center gap-2 mb-3 ml-1">
                      <Zap className="h-4 w-4 text-[#FF6B00] fill-[#FF6B00] animate-pulse" />
                      <span className="text-[13px] text-white/60 font-medium">Searching your training content...</span>
                    </div>
                    <div className="w-full max-w-[240px] h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-gradient-to-r from-[#FF6B00] to-[#FF3C00]"
                        animate={{ 
                          x: [-240, 240],
                        }}
                        transition={{ 
                          duration: 1.5, 
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-white/5">
            <div 
              className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus-within:border-orange-500/50 focus-within:shadow-[0_0_20px_rgba(255,107,0,0.15)] transition-all duration-200"
            >
              <input
                type="text"
                placeholder="Ask a question..."
                className="flex-1 bg-transparent text-white placeholder-white/40 outline-none text-sm"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isLoading && input.trim() && handleSend()}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-orange-500/25"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
};

export default BrainChatDrawer;

