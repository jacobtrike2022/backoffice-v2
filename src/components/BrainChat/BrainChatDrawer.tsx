import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { X, Send, Zap } from 'lucide-react';
import { 
  Dialog, 
  DialogTitle,
  DialogPortal,
  DialogOverlay,
  DialogContentRaw
} from '../ui/dialog';
import { cn } from '../ui/utils';
import { supabase, getCurrentUserOrgId } from '../../lib/supabase';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

// =============================================================================
// TYPES
// =============================================================================

interface BrainMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
  citations?: any[];
}

interface BrainChatDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  track: any;
  onNavigateToTrack?: (trackId: string) => void;
  isPublicView?: boolean;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const LoadingDot = () => (
  <div className="flex items-center gap-3">
    <motion.div
      className="w-3 h-3 rounded-full bg-orange-500"
      style={{ boxShadow: '0 0 12px 4px rgba(255,107,0,0.5)' }}
      animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
    />
    <span className="text-sm text-white/60">Thinking...</span>
  </div>
);

const InlineCitation: React.FC<{
  index: number;
  citation: any;
  onNavigate?: (trackId: string) => void;
}> = ({ index, citation, onNavigate }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <>
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center justify-center w-4 h-4 ml-0.5 text-[10px] font-bold text-orange-400 bg-orange-500/15 hover:bg-orange-500/25 rounded-full transition-all cursor-pointer align-super"
      >
        {index}
      </button>
      {expanded && (
        <div className="block mt-2 mb-3 p-3 bg-white/5 border-l-2 border-orange-500/50 rounded-r-lg text-sm">
          <p className="text-white/70 italic mb-2">"{citation.quote}"</p>
          <button 
            onClick={() => onNavigate?.(citation.trackId)}
            className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
          >
            {citation.trackTitle} →
          </button>
        </div>
      )}
    </>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

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
        throw new Error(errorData.error || `Failed (${response.status})`);
      }

      const data = await response.json();
      
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }

      const aiContent = data.message?.content || data.message || data.response || '';
      if (!aiContent) throw new Error('Empty response');

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: aiContent,
        sources: data.sources || [],
        citations: data.citations || []
      }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: error.message || "Sorry, I encountered an error." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatMessage = (content: string) => {
    let formatted = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return formatted.split('\n\n').map((para) => {
      if (para.match(/^\d+\.\s+/m)) {
        const items = para.split('\n').map(item => 
          `<li>${item.replace(/^\d+\.\s+/, '')}</li>`
        ).join('');
        return `<ol class="list-decimal ml-5 space-y-1 my-2">${items}</ol>`;
      }
      return `<p class="mb-2 last:mb-0">${para.replace(/\n/g, '<br/>')}</p>`;
    }).join('');
  };

  const renderMessage = (content: string, citations: any[] = []) => {
    if (!citations.length) {
      return <div dangerouslySetInnerHTML={{ __html: formatMessage(content) }} />;
    }
    
    const parts = content.split(/(\[\d+\])/g);
    return (
      <div>
        {parts.map((part, i) => {
          const match = part.match(/\[(\d+)\]/);
          if (match) {
            const idx = parseInt(match[1]);
            const citation = citations.find(c => c.index === idx);
            if (citation) {
              return <InlineCitation key={i} index={idx} citation={citation} onNavigate={onNavigateToTrack} />;
            }
          }
          return part.trim() ? <span key={i} dangerouslySetInnerHTML={{ __html: formatMessage(part) }} /> : null;
        })}
      </div>
    );
  };

  const prompts = track?.type === 'video' 
    ? ["Summarize this", "Key points", "Main steps"]
    : ["Key takeaway", "Explain simply", "Summarize"];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
        
        <DialogContentRaw 
          className="fixed z-50 flex flex-col overflow-hidden"
          style={{
            /* ============================================
               SIZING - MATCH THE MOCKUP
               Desktop: 45% width, 70% height of viewport
               Mobile: 95% width, 90% height
               ============================================ */
            width: 'clamp(340px, 45vw, 700px)',
            height: 'clamp(500px, 70vh, 800px)',
            
            /* Centering */
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            
            /* Appearance */
            backgroundColor: '#0a0a0a',
            borderRadius: '24px',
            
            /* Orange glow border effect */
            boxShadow: `
              0 0 0 1px rgba(255, 107, 0, 0.3),
              0 0 40px -10px rgba(255, 107, 0, 0.4),
              0 0 80px -20px rgba(255, 107, 0, 0.2),
              0 25px 50px -12px rgba(0, 0, 0, 0.8)
            `,
          }}
        >
          <DialogTitle className="sr-only">Company Brain</DialogTitle>
          
          {/* ============================================
              HEADER - X button top right
              ============================================ */}
          <div className="absolute top-4 right-4 z-20">
            <button
              onClick={() => onOpenChange(false)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/15 transition-all"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>

          {/* ============================================
              MAIN CONTENT AREA
              ============================================ */}
          <div className="flex-1 overflow-y-auto">
            
            {messages.length === 0 ? (
              /* ========================================
                 EMPTY STATE - Matches mockup exactly
                 ======================================== */
              <div className="flex flex-col items-center justify-center h-full px-8 py-12">
                
                {/* Lightning bolt icon with glow */}
                <div 
                  className="w-40 h-40 rounded-3xl flex items-center justify-center mb-8"
                  style={{
                    background: 'linear-gradient(145deg, rgba(30,30,30,1) 0%, rgba(20,20,20,1) 100%)',
                    boxShadow: `
                      inset 0 1px 0 rgba(255,255,255,0.05),
                      0 0 60px -15px rgba(255,107,0,0.5),
                      0 10px 40px -10px rgba(0,0,0,0.5)
                    `,
                  }}
                >
                  <Zap 
                    className="w-20 h-20 text-orange-500" 
                    fill="currentColor"
                    style={{
                      filter: 'drop-shadow(0 0 20px rgba(255,107,0,0.6))',
                    }}
                  />
                </div>
                
                {/* Welcome text */}
                <h2 className="text-2xl font-semibold text-white mb-2">
                  {track?.title || "Company Brain"}
                </h2>
                <p className="text-white/50 text-base mb-10">
                  How can I help you today?
                </p>
                
                {/* Prompt chips - horizontal row */}
                <div className="flex flex-wrap justify-center gap-3 mb-6 px-4">
                  {prompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(prompt)}
                      className="px-5 py-2.5 text-sm text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-full border border-white/10 hover:border-white/20 transition-all"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* ========================================
                 MESSAGES VIEW
                 ======================================== */
              <div className="px-6 py-6 space-y-4">
                {track && (
                  <div className="flex justify-center pb-3">
                    <span className="px-4 py-1.5 text-xs text-white/40 bg-white/5 rounded-full">
                      {track.title}
                    </span>
                  </div>
                )}
                
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "flex",
                      msg.role === 'user' ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "px-4 py-3 text-sm leading-relaxed",
                        msg.role === 'user' 
                          ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-2xl rounded-br-sm max-w-[80%] shadow-lg shadow-orange-500/20"
                          : "bg-white/5 border border-white/10 text-white/85 rounded-2xl rounded-bl-sm max-w-[85%]"
                      )}
                    >
                      {msg.role === 'assistant' 
                        ? renderMessage(msg.content, msg.citations)
                        : msg.content
                      }
                    </div>
                  </motion.div>
                ))}

                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm">
                      <LoadingDot />
                    </div>
                  </motion.div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* ============================================
              INPUT AREA - Bottom of drawer
              ============================================ */}
          <div className="px-6 pb-6 pt-4">
            <div 
              className="flex items-center gap-3 rounded-2xl px-5 py-4"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <input
                type="text"
                placeholder="Ask a question..."
                className="flex-1 bg-transparent text-white text-base placeholder-white/30 outline-none"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isLoading && input.trim() && handleSend()}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-30 transition-all"
              >
                <Send className="w-5 h-5 text-white/70" />
              </button>
            </div>
          </div>
        </DialogContentRaw>
      </DialogPortal>
    </Dialog>
  );
};

export default BrainChatDrawer;
