import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { X, Send, Zap, Plus, Mic } from 'lucide-react';
import { 
  Dialog, 
  DialogTitle,
  DialogPortal,
  DialogOverlay,
  DialogContentRaw
} from '../ui/dialog';
import { cn } from '../ui/utils';
import { supabase, getCurrentUserOrgId } from '../../lib/supabase';
import { publicAnonKey, getServerUrl } from '../../utils/supabase/info';

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

const LoadingDot = () => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3">
      <motion.div
        className="w-3 h-3 rounded-full bg-orange-500"
        style={{ boxShadow: '0 0 12px 4px rgba(255,107,0,0.5)' }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className="text-sm text-white/60">{t('knowledgeBase.brainThinking')}</span>
    </div>
  );
};

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

const BrainChatDrawer: React.FC<BrainChatDrawerProps> = ({
  isOpen,
  onOpenChange,
  track,
  onNavigateToTrack,
  isPublicView = false
}) => {
  const { t } = useTranslation();
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
        `${getServerUrl()}/brain/chat`,
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
        content: error.message || t('knowledgeBase.brainError')
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
    ? [t('knowledgeBase.brainPromptSummarize'), t('knowledgeBase.brainPromptKeyPoints'), t('knowledgeBase.brainPromptMainSteps')]
    : [t('knowledgeBase.brainPromptKeyTakeaway'), t('knowledgeBase.brainPromptExplain'), t('knowledgeBase.brainPromptSummarize')];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-50 bg-black/70" />
        
        <DialogContentRaw 
          style={{
            position: 'fixed',
            zIndex: 50,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '480px',
            maxWidth: '95vw',
            height: '620px',
            maxHeight: '90vh',
            backgroundColor: '#0c0c0c',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: `
              0 0 0 1px rgba(255,107,0,0.15),
              0 0 80px -20px rgba(255,107,0,0.25)
            `,
          }}
        >
          <DialogTitle className="sr-only">{t('knowledgeBase.brainTitle')}</DialogTitle>
          
          {/* Header row - settings left, X right */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 16px 0 16px',
          }}>
            {/* Settings button - left */}
            <button style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.06)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                <circle cx="12" cy="5" r="1.5" fill="currentColor"/>
                <circle cx="12" cy="19" r="1.5" fill="currentColor"/>
                <circle cx="5" cy="12" r="1.5" fill="currentColor"/>
                <circle cx="19" cy="12" r="1.5" fill="currentColor"/>
                <circle cx="7.05" cy="7.05" r="1.5" fill="currentColor"/>
                <circle cx="16.95" cy="16.95" r="1.5" fill="currentColor"/>
                <circle cx="7.05" cy="16.95" r="1.5" fill="currentColor"/>
                <circle cx="16.95" cy="7.05" r="1.5" fill="currentColor"/>
              </svg>
            </button>
            
            {/* X button - right */}
            <button 
              onClick={() => onOpenChange(false)}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X style={{ width: '20px', height: '20px', color: 'rgba(255,255,255,0.5)' }} />
            </button>
          </div>

          {/* Main content area */}
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            
            {messages.length === 0 ? (
              /* Empty state */
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 32px',
              }}>
                
                {/* Lightning bolt container */}
                <div style={{
                  width: '200px',
                  height: '140px',
                  borderRadius: '20px',
                  backgroundColor: '#1a1a1a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '24px',
                  boxShadow: '0 0 60px -15px rgba(255,107,0,0.4)',
                }}>
                  <Zap 
                    style={{
                      width: '72px',
                      height: '72px',
                      color: '#FF6B00',
                      fill: '#FF6B00',
                      filter: 'drop-shadow(0 0 20px rgba(255,107,0,0.6))',
                    }}
                  />
                </div>
                
                {/* Track title */}
                <h2 style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  color: 'white',
                  margin: '0 0 8px 0',
                  textAlign: 'center',
                }}>
                  {track?.title || t('knowledgeBase.brainTitle')}
                </h2>
                
                {/* Subtitle */}
                <p style={{
                  fontSize: '15px',
                  color: 'rgba(255,255,255,0.5)',
                  margin: '0 0 28px 0',
                  textAlign: 'center',
                }}>
                  {t('knowledgeBase.brainHelpPrompt')}
                </p>
                
                {/* Prompt chips */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  gap: '10px',
                  maxWidth: '360px',
                }}>
                  {prompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(prompt)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        fontSize: '14px',
                        color: 'rgba(255,255,255,0.7)',
                        backgroundColor: 'transparent',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '999px',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                      }}
                    >
                      <span style={{
                        width: '16px',
                        height: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        opacity: 0.6,
                      }}>
                        {i === 0 ? '◎' : i === 1 ? '✦' : '▣'}
                      </span>
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Messages */
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {track && (
                  <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '8px' }}>
                    <span style={{
                      padding: '6px 14px',
                      fontSize: '12px',
                      color: 'rgba(255,255,255,0.4)',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      borderRadius: '999px',
                    }}>
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
                    style={{
                      display: 'flex',
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        padding: '12px 16px',
                        fontSize: '15px',
                        lineHeight: 1.5,
                        maxWidth: msg.role === 'user' ? '80%' : '85%',
                        borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        ...(msg.role === 'user' ? {
                          background: 'linear-gradient(135deg, #FF6B00, #FF4500)',
                          color: 'white',
                          boxShadow: '0 4px 12px rgba(255,107,0,0.25)',
                        } : {
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: 'rgba(255,255,255,0.85)',
                        }),
                      }}
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
                    style={{ display: 'flex', justifyContent: 'flex-start' }}
                  >
                    <div style={{
                      padding: '12px 16px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '16px 16px 16px 4px',
                    }}>
                      <LoadingDot />
                    </div>
                  </motion.div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input area - bottom */}
          <div style={{ padding: '16px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '14px',
            }}>
              {/* Plus button */}
              <button style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}>
                <Plus style={{ width: '20px', height: '20px', color: 'rgba(255,255,255,0.4)' }} />
              </button>
              
              {/* Input */}
              <input
                type="text"
                placeholder={t('knowledgeBase.brainInputPlaceholder')}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isLoading && input.trim() && handleSend()}
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  fontSize: '15px',
                  color: 'white',
                }}
              />
              
              {/* Mic button */}
              <button style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}>
                <Mic style={{ width: '18px', height: '18px', color: 'rgba(255,255,255,0.4)' }} />
              </button>
              
              {/* Send/arrow button */}
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                style={{
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  cursor: input.trim() && !isLoading ? 'pointer' : 'default',
                  padding: 0,
                  opacity: input.trim() && !isLoading ? 1 : 0.3,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7"/>
                </svg>
              </button>
            </div>
          </div>
        </DialogContentRaw>
      </DialogPortal>
    </Dialog>
  );
};

export default BrainChatDrawer;
