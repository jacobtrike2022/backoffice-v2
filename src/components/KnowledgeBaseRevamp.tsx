import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Menu,
  Bell,
  User,
  ChevronRight,
  Plus,
  BookOpen,
  FileText,
  Video,
  BookMarked,
  Clock,
  Star,
  Hash,
  X,
  ChevronDown,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Eye,
  MoreHorizontal,
  CornerUpLeft,
  Check,
  Edit,
  Trash2,
  Save,
  Download,
  Bookmark,
  FileText as FileTextIcon,
  Image as ImageIcon,
  FileVideo,
  FileAudio,
  Paperclip,
  Settings,
  Info,
  MessageSquare,
  Send,
  Zap
} from 'lucide-react';
import { 
  useTracks,
  useCurrentUser 
} from '../lib/hooks/useSupabase';
import { Footer } from './Footer';
import * as crud from '../lib/crud';
import * as attachmentCrud from '../lib/crud/attachments';
import * as factsCrud from '../lib/crud/facts';
import * as brainCrud from '../lib/crud/brain';
import { TagSelectorDialog } from './TagSelectorDialog';
import type { Tag } from '../lib/crud/tags';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from './ui/dropdown-menu';
import { toast } from 'sonner@2.0.3';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "./ui/dialog";
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { cn } from './ui/utils';
import { projectId, publicAnonKey, getServerUrl } from '../utils/supabase/info';
import { QRCodeToggle } from './kb/QRCodeToggle';
import { TTSPlayer } from './content/TTSPlayer';
import { supabase, getCurrentUserOrgId } from '../lib/supabase';
import { StoryPreview } from './content-authoring/StoryPreview';
import { StoryTranscript } from './content-authoring/StoryTranscript';
import BrainChatDrawer from './BrainChat/BrainChatDrawer';
import defaultThumbnail from '../assets/default-thumbnail.jpg';

// Helper for date formatting
function formatDistanceToNow(date: Date, options?: { addSuffix?: boolean }) {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  const suffix = options?.addSuffix ? ' ago' : '';

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m${suffix}`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h${suffix}`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d${suffix}`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w${suffix}`;
  return `${Math.floor(diffInSeconds / 2592000)}mo${suffix}`;
}

// Video URL helpers
function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

function isYouTubeUrl(url: string): boolean {
  return getYouTubeVideoId(url) !== null;
}

function getVimeoVideoId(url: string): string | null {
  if (!url) return null;
  
  const patterns = [
    /vimeo\.com\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/,
    /^(\d+)$/ // Direct video ID
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

function isVimeoUrl(url: string): boolean {
  return getVimeoVideoId(url) !== null;
}

// --- Types ---

interface KnowledgeBaseProps {
  onTrackClick?: (trackId: string) => void;
  onNavigateToAssignment?: () => void;
  onEditTrack?: (track: any) => void;
  currentRole?: string;
  onCreateArticle?: () => void;
}

// --- Constants ---

const ICON_SIZE_SM = 16;
const ICON_SIZE_MD = 20;

// --- Components ---

// 1. Command Palette Modal
const CommandPalette = ({ 
  isOpen, 
  onClose, 
  onSearch,
  recentSearches = [],
  tracks = [],
  onSelectTrack
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSearch: (query: string) => void;
  recentSearches?: string[];
  tracks?: any[];
  onSelectTrack?: (track: any) => void;
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Filter tracks based on query
  const filteredTracks = useMemo(() => {
    if (!query || !tracks) return [];
    const lowerQuery = query.toLowerCase();
    return tracks.filter(track => 
      track.title?.toLowerCase().includes(lowerQuery) || 
      track.description?.toLowerCase().includes(lowerQuery)
    ).slice(0, 10); // Limit to 10 results
  }, [query, tracks]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery(''); // Reset query on close
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter') {
      if (filteredTracks.length > 0 && onSelectTrack) {
        // Select first result on Enter if available
        onSelectTrack(filteredTracks[0]);
        onClose();
      } else if (query) {
        onSearch(query);
        onClose();
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="p-0 max-w-2xl bg-white dark:bg-slate-950 border-none shadow-2xl overflow-hidden top-[20%] translate-y-0">
        <DialogTitle className="sr-only">Search Knowledge Base</DialogTitle>
        <DialogDescription className="sr-only">
           Search for articles, videos, and other resources.
        </DialogDescription>
        <div className="flex items-center border-b px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground mr-3" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search knowledge base..."
            className="flex-1 bg-transparent outline-none text-lg placeholder:text-muted-foreground/50"
          />
          <div className="flex items-center gap-1">
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              ESC
            </kbd>
          </div>
        </div>
        <div className="max-h-[400px] overflow-y-auto p-2">
           {/* Search Results */}
           {query && filteredTracks.length > 0 && (
             <div className="px-2 py-2">
               <h3 className="text-xs font-semibold text-muted-foreground mb-2 px-2">Results</h3>
               <div className="space-y-1">
                 {filteredTracks.map((track) => (
                   <div 
                     key={track.id} 
                     className="flex items-center px-3 py-3 text-sm rounded-md hover:bg-accent cursor-pointer transition-colors group"
                     onClick={() => { 
                       if (onSelectTrack) onSelectTrack(track); 
                       onClose(); 
                     }}
                   >
                     {track.type === 'video' ? (
                       <Video className="h-4 w-4 mr-3 text-purple-500" />
                     ) : (
                       <FileText className="h-4 w-4 mr-3 text-blue-500" />
                     )}
                     <div className="flex-1 min-w-0">
                       <div className="font-medium truncate text-foreground">{track.title}</div>
                       {track.description && (
                         <div className="text-xs text-muted-foreground truncate">{track.description}</div>
                       )}
                     </div>
                     <CornerUpLeft className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 ml-2" />
                   </div>
                 ))}
               </div>
             </div>
           )}

           {/* No Results Message */}
           {query && filteredTracks.length === 0 && (
             <div className="py-8 text-center text-muted-foreground">
               <p>No results found for "{query}"</p>
               <p className="text-xs mt-1">Try searching for something else.</p>
             </div>
           )}

           {/* Recent Searches Placeholder */}
           {!query && recentSearches.length > 0 && (
             <div className="mb-4 px-2">
               <h3 className="text-xs font-semibold text-muted-foreground mb-2 px-2">Recent Searches</h3>
               {recentSearches.map((search, idx) => (
                 <div 
                   key={idx} 
                   className="flex items-center px-2 py-2 text-sm rounded-md hover:bg-accent cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                   onClick={() => { onSearch(search); onClose(); }}
                 >
                   <Clock className="h-4 w-4 mr-2 opacity-70" />
                   {search}
                 </div>
               ))}
             </div>
           )}
           
           {!query && (
             <div className="px-2">
               <h3 className="text-xs font-semibold text-muted-foreground mb-2 px-2">Quick Actions</h3>
               <div className="space-y-1">
                 <div className="flex items-center px-2 py-2 text-sm rounded-md hover:bg-accent cursor-pointer group">
                   <FileText className="h-4 w-4 mr-2 text-blue-500" />
                   <span>Create New Article</span>
                   <span className="ml-auto text-xs text-muted-foreground opacity-0 group-hover:opacity-100">Admin</span>
                 </div>
                 <div className="flex items-center px-2 py-2 text-sm rounded-md hover:bg-accent cursor-pointer group">
                    <Video className="h-4 w-4 mr-2 text-purple-500" />
                    <span>Create New Video</span>
                    <span className="ml-auto text-xs text-muted-foreground opacity-0 group-hover:opacity-100">Admin</span>
                 </div>
               </div>
             </div>
           )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// 2. Article Card Component
const ArticleCard = ({ 
  track, 
  onClick, 
  isBookmarked, 
  onToggleBookmark 
}: { 
  track: any, 
  onClick: () => void,
  isBookmarked?: boolean,
  onToggleBookmark?: (trackId: string, e: React.MouseEvent) => void
}) => {
  const TypeIcon = track.type === 'video' ? Video : track.type === 'story' ? BookMarked : FileText;
  
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: "0 8px 16px rgba(0,0,0,0.08)" }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-white dark:bg-card border border-border rounded-xl p-6 cursor-pointer transition-colors duration-200 h-full flex flex-col relative group"
    >
      {/* Bookmark Button */}
      {onToggleBookmark && (
        <button
          onClick={(e) => onToggleBookmark(track.id, e)}
          className="absolute top-4 right-4 p-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-50 dark:hover:bg-slate-700 z-10"
          title={isBookmarked ? "Remove from saved" : "Save for later"}
        >
          <Bookmark 
            size={16} 
            className={cn(
              "transition-colors",
              isBookmarked 
                ? "fill-[#F64A05] text-[#F64A05]" 
                : "text-slate-400"
            )}
          />
        </button>
      )}

      <div className="flex items-start justify-between mb-4">
        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-[#F64A05]">
          <TypeIcon size={ICON_SIZE_MD} />
        </div>
        {track.category && (
          <Badge variant="secondary" className="text-xs font-normal bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200">
            {track.category.name}
          </Badge>
        )}
      </div>
      
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2 line-clamp-2 leading-tight">
        {track.title}
      </h3>
      
      <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3 mb-6 flex-grow leading-relaxed">
        {track.description || track.excerpt || "No description available."}
      </p>
      
      <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 mt-auto text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
             <Eye size={14} /> {track.view_count || 0}
          </span>
          <span className="flex items-center gap-1">
             <ThumbsUp size={14} /> {track.likes || 0}
          </span>
        </div>
        <span>Updated {formatDistanceToNow(new Date(track.updated_at), { addSuffix: true })}</span>
      </div>
    </motion.div>
  );
};

// 3. Table of Contents (Sticky)
const TableOfContents = ({ sections }: { sections: { id: string, title: string, level: number }[] }) => {
  const [activeSection, setActiveSection] = useState<string>(sections[0]?.id || '');

  useEffect(() => {
    if (sections.length > 0) {
      setActiveSection(sections[0].id);
    }
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -66%' }
    );

    sections.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [sections]);

  if (sections.length === 0) return null;

  return (
    <div className="sticky top-32 w-60 hidden xl:block pl-6 border-l border-slate-200 dark:border-slate-800">
      <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-4 uppercase tracking-wider">On This Page</h4>
      <nav className="space-y-1">
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            onClick={(e) => {
              e.preventDefault();
              const element = document.getElementById(section.id);
              if (element) {
                window.scrollTo({
                  top: element.getBoundingClientRect().top + window.pageYOffset - 100,
                  behavior: 'smooth'
                });
                setActiveSection(section.id);
              }
            }}
            className={cn(
              "block text-sm py-1 transition-colors duration-200 border-l-2 -ml-[25px] pl-5 text-left",
              activeSection === section.id
                ? "border-blue-500 text-blue-600 font-medium"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            )}
            style={{ paddingLeft: section.level > 1 ? '1rem' : undefined }}
          >
            {section.title}
          </a>
        ))}
      </nav>
    </div>
  );
};

// =============================================================================
// BRAIN HERO - Integrated AI Chat at top of Knowledge Base
// =============================================================================

interface BrainHeroProps {
  onNavigateToTrack?: (trackId: string) => void;
}

const BrainHero: React.FC<BrainHeroProps> = ({ onNavigateToTrack }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
    citations?: any[];
  }>>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const followUpInputRef = useRef<HTMLInputElement>(null);

  // Search state
  interface SearchResult {
    id: string;
    title: string;
    type: 'track' | 'kb_article';
    trackType?: 'video' | 'article' | 'story' | 'checkpoint';
    excerpt?: string;
    matchType: 'title' | 'keyword' | 'topic';
  }

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Dynamic suggested prompts from indexed content - with word count for sizing
  interface PromptWithSize {
    text: string;
    wordCount: number; // 3 or 4
  }
  const [suggestedPrompts, setSuggestedPrompts] = useState<PromptWithSize[]>([]);

  // Helper: Extract meaningful phrase from title (1-2 words that form a complete concept)
  const extractKeyWords = (title: string): string | null => {
    if (!title || title.trim().length === 0) return null;
    
    const fillers = ['the', 'a', 'an', 'and', 'or', 'for', 'to', 'in', 'on', 'of', 'with', 'how', 'what', 'is', 'are', 'at', 'by', 'from', 'as', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can'];
    const actionWords = ['understanding', 'explaining', 'learning', 'managing', 'handling', 'introduction', 'guide', 'basics'];
    
    // Split into words and filter
    const allWords = title.split(/\s+/);
    const meaningfulWords = allWords.filter(w => 
      w.length > 2 && !fillers.includes(w.toLowerCase())
    );
    
    if (meaningfulWords.length === 0) return null;
    
    // Strategy: Prefer the last 1-2 meaningful words (usually the main topic)
    // Skip action words at the start (like "Understanding", "Learning", etc.)
    
    // Find where meaningful content starts (skip leading action words)
    let startIdx = 0;
    for (let i = 0; i < allWords.length; i++) {
      const word = allWords[i].toLowerCase();
      if (!fillers.includes(word) && !actionWords.includes(word)) {
        startIdx = i;
        break;
      }
    }
    
    // Get the meaningful portion (skip action words)
    const relevantWords = allWords.slice(startIdx).filter(w => 
      w.length > 2 && !fillers.includes(w.toLowerCase()) && !actionWords.includes(w.toLowerCase())
    );
    
    if (relevantWords.length === 0) {
      // Fallback: use last meaningful word
      return meaningfulWords[meaningfulWords.length - 1] || null;
    }
    
    // Prefer last 2 words (complete phrase), fallback to last 1 word
    if (relevantWords.length >= 2) {
      const phrase = relevantWords.slice(-2).join(' ');
      if (phrase.length <= 30) {
        return phrase;
      }
    }
    
    // Single word fallback
    return relevantWords[relevantWords.length - 1] || null;
  };

  // Helper: Normalize capitalization - first word capitalized, rest lowercase (except acronyms)
  const normalizeCapitalization = (text: string): string => {
    const words = text.split(/\s+/);
    
    return words.map((word, index) => {
      // Check if word is an acronym:
      // - All uppercase letters (2+ chars): "HR", "API", "PDF"
      // - Mixed case with uppercase pattern: "C-Stores", "HR-Policy"
      // - Single uppercase letter followed by hyphen: "C-", "A-"
      const isAllUppercase = /^[A-Z]{2,}$/.test(word);
      const isMixedAcronym = /^[A-Z]+(-[A-Z]+)+$/.test(word) || /^[A-Z](-[A-Z])+$/.test(word);
      const isShortAcronym = word.length <= 4 && /^[A-Z]/.test(word) && !/[a-z]/.test(word);
      
      if (isAllUppercase || isMixedAcronym || isShortAcronym) {
        // Preserve acronym as-is
        return word;
      }
      
      if (index === 0) {
        // First word: capitalize first letter, lowercase rest
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      } else {
        // Other words: all lowercase
        return word.toLowerCase();
      }
    }).join(' ');
  };

  // Helper: Validate if prompt makes sense (not cut off mid-phrase)
  const isValidPrompt = (prompt: string): boolean => {
    const words = prompt.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 3 || words.length > 4) return false;
    
    const lastWord = words[words.length - 1]?.toLowerCase() || '';
    
    // Don't end with filler words, prepositions, or action verbs that suggest incompleteness
    const invalidEndings = ['about', 'the', 'a', 'an', 'for', 'to', 'in', 'on', 'of', 'with', 'at', 'by', 'from'];
    if (invalidEndings.includes(lastWord)) {
      return false;
    }
    
    // Don't end with words that suggest the phrase is incomplete
    // e.g., "About Understanding Workplace" - "Workplace" alone might be okay, but check context
    const secondToLast = words.length > 1 ? words[words.length - 2]?.toLowerCase() : '';
    
    // If second-to-last is an action word and last is incomplete, it's probably cut off
    const actionWords = ['understanding', 'explaining', 'learning', 'managing', 'handling'];
    if (actionWords.includes(secondToLast) && lastWord.length < 6) {
      // Likely cut off mid-phrase
      return false;
    }
    
    // Check if prompt ends with ellipsis (truncated)
    if (prompt.includes('...')) {
      return false;
    }
    
    return true;
  };

  // Helper: Create 3-4 word prompt from key words
  const createPrompt = (keyWords: string | null, templateIndex: number): PromptWithSize | null => {
    if (!keyWords) return null;
    
    const templates = [
      (kw: string) => `About ${kw}`,
      (kw: string) => `What is ${kw}`,
      (kw: string) => `Explain ${kw}`,
      (kw: string) => `Key points ${kw}`,
      (kw: string) => `Learn about ${kw}`,
    ];
    
    const template = templates[templateIndex % templates.length];
    let prompt = template(keyWords);
    const words = prompt.split(/\s+/).filter(w => w.length > 0);
    let wordCount = words.length;
    
    // Ensure 3-4 words, adjust if needed
    if (wordCount < 3) {
      // Try adding a descriptive word
      const additions = ['basics', 'guide', 'tips', 'overview'];
      const addition = additions[templateIndex % additions.length];
      prompt = `${prompt} ${addition}`;
      wordCount = prompt.split(/\s+/).length;
    } else if (wordCount > 4) {
      // Truncate if too long - but check if it makes sense
      const truncated = words.slice(0, 4).join(' ');
      // Validate the truncated version
      if (isValidPrompt(truncated)) {
        prompt = truncated;
        wordCount = 4;
      } else {
        // If truncation breaks the phrase, try shorter
        const shorter = words.slice(0, 3).join(' ');
        if (isValidPrompt(shorter)) {
          prompt = shorter;
          wordCount = 3;
        } else {
          // Can't make a valid prompt from this
          return null;
        }
      }
    }
    
    // Final validation
    if (!isValidPrompt(prompt)) {
      return null;
    }
    
    // Normalize capitalization
    const normalizedPrompt = normalizeCapitalization(prompt);
    
    return { text: normalizedPrompt, wordCount: wordCount === 3 ? 3 : 4 };
  };

  // Fetch dynamic prompts from indexed content
  useEffect(() => {
    const fetchDynamicPrompts = async () => {
      const fallbackPrompts: PromptWithSize[] = [
        { text: normalizeCapitalization("Food safety basics"), wordCount: 3 },
        { text: normalizeCapitalization("Equipment procedures guide"), wordCount: 3 },
        { text: normalizeCapitalization("Customer service tips"), wordCount: 3 },
        { text: normalizeCapitalization("Safety guidelines overview"), wordCount: 3 },
        { text: normalizeCapitalization("Getting started guide"), wordCount: 3 },
      ];

      try {
        const orgId = await getCurrentUserOrgId();
        if (!orgId) {
          setSuggestedPrompts(fallbackPrompts);
          return;
        }

        // Get tracks that have embeddings (are actually indexed)
        const { data: embeddings } = await supabase
          .from('brain_embeddings')
          .select('content_id')
          .eq('organization_id', orgId)
          .eq('content_type', 'track');

        if (!embeddings || embeddings.length === 0) {
          setSuggestedPrompts(fallbackPrompts);
          return;
        }

        // Get UNIQUE content_ids
        const uniqueTrackIds = [...new Set(embeddings.map(e => e.content_id))];

        // Fetch more tracks than needed to have alternatives if some don't work
        const { data: tracks } = await supabase
          .from('tracks')
          .select('id, title')
          .in('id', uniqueTrackIds)
          .eq('status', 'published')
          .limit(10); // Get more to have alternatives

        if (tracks && tracks.length > 0) {
          const validPrompts: PromptWithSize[] = [];
          
          // Try to create valid prompts, skipping tracks that don't work
          for (let i = 0; i < tracks.length && validPrompts.length < 5; i++) {
            const track = tracks[i];
            const keyWords = extractKeyWords(track.title || '');
            
            if (keyWords) {
              // Try different template indices to find one that works
              let prompt: PromptWithSize | null = null;
              for (let templateIdx = 0; templateIdx < 5 && !prompt; templateIdx++) {
                prompt = createPrompt(keyWords, templateIdx);
              }
              
              if (prompt) {
                validPrompts.push(prompt);
              }
            }
          }
          
          // If we have at least 3 valid prompts, use them (pad with fallbacks if needed)
          if (validPrompts.length >= 3) {
            // Fill remaining slots with fallbacks if needed
            while (validPrompts.length < 5) {
              const fallback = fallbackPrompts[validPrompts.length % fallbackPrompts.length];
              validPrompts.push(fallback);
            }
            setSuggestedPrompts(validPrompts.slice(0, 5));
          } else {
            // Not enough valid prompts, use fallbacks
            setSuggestedPrompts(fallbackPrompts);
          }
        } else {
          setSuggestedPrompts(fallbackPrompts);
        }
      } catch (error) {
        setSuggestedPrompts(fallbackPrompts);
      }
    };

    fetchDynamicPrompts();
  }, []);

  // Perform prioritized search
  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    setIsSearching(true);
    setShowSearchDropdown(true);

    try {
      const orgId = await getCurrentUserOrgId();
      if (!orgId) return;

      // 1. Title matches (highest priority)
      const { data: titleTracks } = await supabase
        .from('tracks')
        .select('id, title, type, description')
        .eq('organization_id', orgId)
        .eq('status', 'published')
        .eq('show_in_knowledge_base', true)
        .ilike('title', `%${query}%`)
        .limit(3);

      const results: SearchResult[] = (titleTracks || []).map(t => ({
        id: t.id,
        title: t.title,
        type: 'track',
        trackType: t.type as any,
        excerpt: t.description,
        matchType: 'title'
      }));

      // 2. Keyword/Tag matches
      if (results.length < 3) {
        const { data: tagTracks } = await supabase
          .from('tracks')
          .select('id, title, type, description, tags')
          .eq('organization_id', orgId)
          .eq('status', 'published')
          .eq('show_in_knowledge_base', true)
          .contains('tags', [query.toLowerCase()])
          .limit(3 - results.length);

        if (tagTracks) {
          tagTracks.forEach(t => {
            if (!results.find(r => r.id === t.id)) {
              results.push({
                id: t.id,
                title: t.title,
                type: 'track',
                trackType: t.type as any,
                excerpt: t.description,
                matchType: 'keyword'
              });
            }
          });
        }
      }

      // 3. Semantic search fallback
      if (results.length < 3) {
        try {
          const semantic = await brainCrud.searchContent({
            query,
            limit: 3,
            contentType: 'track'
          });
          
          if (semantic?.results) {
            semantic.results.forEach((r: any) => {
              if (results.length < 3 && !results.find(res => res.id === r.content_id)) {
                results.push({
                  id: r.content_id,
                  title: r.metadata?.title || 'Related Content',
                  type: 'track',
                  trackType: r.metadata?.type as any,
                  excerpt: r.chunk_text,
                  matchType: 'topic'
                });
              }
            });
          }
        } catch (e) {
          console.error("Semantic search failed:", e);
        }
      }

      setSearchResults(results.slice(0, 3));
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  // Update suggested prompts based on input inspiration
  const updateSuggestedPromptsFromInput = async (query: string) => {
    if (!query.trim() || query.length < 3) return;

    try {
      const orgId = await getCurrentUserOrgId();
      if (!orgId) return;

      // Use brain search to find relevant tracks for prompts
      const semantic = await brainCrud.searchContent({
        query,
        limit: 10,
        contentType: 'track'
      });

      if (semantic?.results && semantic.results.length > 0) {
        const uniqueTrackIds = [...new Set(semantic.results.map((r: any) => r.content_id))];
        
        const { data: tracks } = await supabase
          .from('tracks')
          .select('id, title')
          .in('id', uniqueTrackIds)
          .eq('status', 'published')
          .limit(10);

        if (tracks && tracks.length > 0) {
          const validPrompts: PromptWithSize[] = [];
          for (let i = 0; i < tracks.length && validPrompts.length < 5; i++) {
            const track = tracks[i];
            const keyWords = extractKeyWords(track.title || '');
            if (keyWords) {
              let prompt: PromptWithSize | null = null;
              for (let templateIdx = 0; templateIdx < 5 && !prompt; templateIdx++) {
                prompt = createPrompt(keyWords, templateIdx);
              }
              if (prompt) validPrompts.push(prompt);
            }
          }
          if (validPrompts.length >= 3) {
            setSuggestedPrompts(validPrompts.slice(0, 5));
          }
        }
      }
    } catch (e) {
      // Silent error for dynamic prompts
    }
  };

  // Debounced search trigger
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (input.trim()) {
      searchDebounceRef.current = setTimeout(() => {
        performSearch(input);
        updateSuggestedPromptsFromInput(input);
      }, 300);
    } else {
      setShowSearchDropdown(false);
      setSearchResults([]);
    }

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [input]);

  // Outside click handler for search dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Find the search container by a data attribute or ref
      const container = document.querySelector('[data-search-container="true"]');
      if (container && !container.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isLoading) return;

    const userMessage = text.trim();
    setInput('');
    setShowSearchDropdown(false);
    setIsExpanded(true);
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

      const aiContent = data.message?.content || data.message || '';
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: aiContent,
        citations: data.citations || []
      }]);

      // Focus the follow-up input after response
      setTimeout(() => followUpInputRef.current?.focus(), 100);
    } catch (error: any) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: error.message || "Sorry, I encountered an error." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setConversationId(null);
    setIsExpanded(false);
    setInput('');
  };

  const renderCitations = (content: string, citations: any[] = []) => {
    if (!citations.length) return <span>{content}</span>;
    
    const parts = content.split(/(\[\d+\])/g);
    return (
      <>
        {parts.map((part, i) => {
          const match = part.match(/\[(\d+)\]/);
          if (match) {
            const idx = parseInt(match[1]);
            const citation = citations.find(c => c.index === idx);
            if (citation) {
              return (
                <button
                  key={i}
                  onClick={() => onNavigateToTrack?.(citation.trackId)}
                  className="inline-flex items-center justify-center w-5 h-5 mx-0.5 text-[11px] font-bold text-orange-400 bg-orange-500/20 hover:bg-orange-500/30 rounded-full transition-all cursor-pointer align-middle"
                  title={`${citation.trackTitle}: "${citation.quote?.substring(0, 100)}..."`}
                >
                  {idx}
                </button>
              );
            }
          }
          return <span key={i}>{part}</span>;
        })}
      </>
    );
  };

  // Check if the last response indicates content wasn't found
  const lastMessage = messages[messages.length - 1];
  const isNotFoundResponse = lastMessage?.content?.toLowerCase().includes("couldn't find") || 
                             lastMessage?.content?.toLowerCase().includes("not covered") ||
                             lastMessage?.content?.toLowerCase().includes("no information");

  // Deduplicate citations by trackId
  const deduplicatedCitations = lastMessage?.citations?.length > 0
    ? Array.from(
        new Map(
          (lastMessage.citations || []).map((c: any) => [c.trackId, c])
        ).values()
      )
    : [];

  return (
    <div className="relative mb-8">
      {/* Background glow effects - boosted */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(ellipse, rgba(255,107,0,0.5) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
      </div>

      {/* Main container - frosted glass */}
      <div 
        className="relative rounded-2xl border border-white/10"
        style={{
          background: 'linear-gradient(180deg, rgba(40,40,45,0.75) 0%, rgba(25,25,28,0.85) 100%)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 0 120px -30px rgba(255,107,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.2)',
        }}
      >
        {/* Hero content area - flex column layout */}
        <div 
          className="flex flex-col items-center justify-start px-6 pt-8 pb-8"
        >
          {/* ONLY show when NO conversation */}
          {messages.length === 0 && (
            <>
              {/* Lightning Bolt - small, centered */}
              <div className="flex justify-center">
                <motion.div
                  className="relative"
                  animate={{
                    filter: [
                      'drop-shadow(0 0 6px rgba(255,107,0,0.3))',
                      'drop-shadow(0 0 20px rgba(255,107,0,0.9)) drop-shadow(0 0 40px rgba(255,107,0,0.5))',
                      'drop-shadow(0 0 6px rgba(255,107,0,0.3))',
                    ]
                  }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <motion.div
                    animate={{ 
                      scale: [1, 1.08, 1],
                      rotate: [-2, 2, -2]
                    }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Zap 
                      className="w-8 h-8"
                      style={{ 
                        color: '#FF6B00',
                        fill: '#FF6B00',
                        filter: 'drop-shadow(0 0 8px rgba(255,107,0,0.7))',
                      }}
                    />
                  </motion.div>
                  
                  {/* Glow ring */}
                  <motion.div
                    className="absolute inset-[-8px] rounded-full pointer-events-none"
                    style={{
                      background: 'radial-gradient(circle, rgba(255,107,0,0.25) 0%, transparent 70%)',
                    }}
                    animate={{ 
                      scale: [0.8, 1.4, 0.8], 
                      opacity: [0.7, 0, 0.7] 
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                  />
                </motion.div>
              </div>

              {/* Search Input Bar - full width */}
              <div 
                className="relative w-full max-w-2xl"
                style={{ marginTop: '30px' }}
                data-search-container="true"
              >
                <div className="flex items-center gap-3 pl-5 pr-4 py-3 rounded-xl border border-white/20 bg-black/50 backdrop-blur-sm transition-all focus-within:border-orange-500/40">
                  <Search className="w-5 h-5 text-white/40 flex-shrink-0" />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Ask a question about your training content..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isLoading) {
                        handleSend();
                      }
                      if (e.key === 'Escape') {
                        setShowSearchDropdown(false);
                      }
                    }}
                    onFocus={() => input.trim() && setShowSearchDropdown(true)}
                    className="flex-1 bg-transparent border-none outline-none text-white text-sm placeholder:text-white/40"
                  />
                  {input.trim() && (
                    <motion.button
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      onClick={() => handleSend()}
                      disabled={isLoading}
                      className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white transition-all disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </motion.button>
                  )}
                </div>

                {/* Search Dropdown */}
                <AnimatePresence>
                  {showSearchDropdown && input.trim() && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute z-50 left-0 right-0 mt-2 p-2 rounded-xl border border-white/10 overflow-hidden"
                      style={{
                        background: 'rgba(25, 25, 28, 0.95)',
                        backdropFilter: 'blur(16px)',
                        boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5), 0 0 20px rgba(255,107,0,0.1)'
                      }}
                    >
                      {/* Chat Option */}
                      <button
                        onClick={() => handleSend()}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors group text-left"
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 group-hover:bg-orange-500 group-hover:text-white transition-all">
                          <MessageSquare className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">Ask Company Brain</p>
                          <p className="text-xs text-white/50 truncate">"Ask about: {input}"</p>
                        </div>
                      </button>

                      {searchResults.length > 0 && (
                        <>
                          <div className="px-4 py-2 mt-2">
                            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Search Results</p>
                          </div>
                          
                          <div className="space-y-1">
                            {searchResults.map((result) => (
                              <button
                                key={result.id}
                                onClick={() => {
                                  onNavigateToTrack?.(result.id);
                                  setShowSearchDropdown(false);
                                  setInput('');
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors group text-left"
                              >
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 text-white/40 group-hover:bg-white/10 group-hover:text-white transition-all">
                                  {result.trackType === 'video' ? <FileVideo className="w-4 h-4" /> :
                                   result.trackType === 'article' ? <FileText className="w-4 h-4" /> :
                                   result.trackType === 'story' ? <Zap className="w-4 h-4 fill-current" /> :
                                   <Zap className="w-4 h-4" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-white truncate">{result.title}</p>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 font-medium">
                                      {result.matchType}
                                    </span>
                                  </div>
                                  {result.excerpt && (
                                    <p className="text-xs text-white/40 truncate">{result.excerpt}</p>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      {isSearching && searchResults.length === 0 && (
                        <div className="px-4 py-8 text-center">
                          <div className="inline-block w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mb-2" />
                          <p className="text-xs text-white/40">Searching your knowledge base...</p>
                        </div>
                      )}

                      {!isSearching && searchResults.length === 0 && input.trim() && (
                        <div className="px-4 py-4 text-center">
                          <p className="text-xs text-white/40">No matching articles found. Ask me instead!</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Suggested Prompts - auto-sizing buttons, 3 top + 2 bottom */}
              {suggestedPrompts.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full flex flex-col items-center"
                  style={{ gap: '8px', marginTop: '30px' }}
                >
                  {/* First row - 3 prompts */}
                  <div className="flex justify-center" style={{ gap: '8px' }}>
                    {suggestedPrompts.slice(0, 3).map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(prompt.text)}
                        className="py-2 text-xs font-medium text-white rounded-full transition-all hover:opacity-90 px-3"
                        style={{
                          background: 'linear-gradient(135deg, #FF6B00 0%, #E85D04 100%)',
                          opacity: 0.8,
                        }}
                        title={prompt.text}
                      >
                        {prompt.text}
                      </button>
                    ))}
                  </div>
                  {/* Second row - 2 prompts */}
                  {suggestedPrompts.length > 3 && (
                    <div className="flex justify-center" style={{ gap: '8px' }}>
                      {suggestedPrompts.slice(3, 5).map((prompt, i) => (
                        <button
                          key={i + 3}
                          onClick={() => handleSend(prompt.text)}
                          className="py-2 text-xs font-medium text-white rounded-full transition-all hover:opacity-90 px-3"
                          style={{
                            background: 'linear-gradient(135deg, #FF6B00 0%, #E85D04 100%)',
                            opacity: 0.8,
                          }}
                          title={prompt.text}
                        >
                          {prompt.text}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </>
          )}
        </div>

        {/* Expanded conversation area - includes input at bottom */}
        <AnimatePresence>
          {isExpanded && messages.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="border-t border-white/10"
            >
              {/* Messages area with max height and scroll */}
              <div className="p-6 max-h-[350px] overflow-y-auto">
                <div className="space-y-4 max-w-2xl mx-auto">
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex",
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] px-4 py-3 rounded-2xl text-[15px] leading-relaxed",
                          msg.role === 'user' 
                            ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-br-sm'
                            : 'bg-white/5 border border-white/10 text-white/90 rounded-bl-sm'
                        )}
                      >
                        {msg.role === 'assistant' 
                          ? renderCitations(msg.content, msg.citations)
                          : msg.content
                        }
                      </div>
                    </motion.div>
                  ))}

                  {/* Loading indicator */}
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start"
                    >
                      <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm">
                        <div className="flex items-center gap-2">
                          <motion.div
                            className="w-2 h-2 rounded-full bg-orange-500"
                            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          />
                          <span className="text-white/50 text-sm">Thinking...</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Source citations summary - DEDUPLICATED, hide on "not found" */}
                {messages.length > 0 && 
                 deduplicatedCitations.length > 0 && 
                 !isNotFoundResponse && (
                  <div className="mt-4 pt-4 border-t border-white/10 max-w-2xl mx-auto">
                    <p className="text-xs text-white/40 mb-2">Sources referenced:</p>
                    <div className="flex flex-wrap gap-2">
                      {deduplicatedCitations.map((citation: any) => (
                        <button
                          key={citation.trackId}
                          onClick={() => onNavigateToTrack?.(citation.trackId)}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 rounded-lg transition-all"
                        >
                          {citation.trackTitle}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Input bar - DOCKED AT BOTTOM when in conversation */}
              <div className="px-6 pb-4 pt-2 border-t border-white/5">
                <div className="max-w-2xl mx-auto">
                  <div 
                    className="relative flex items-center gap-3 pl-5 pr-4 py-3 rounded-xl border border-white/10 bg-black/40 transition-all focus-within:border-orange-500/30"
                    data-search-container="true"
                  >
                    <Search className="w-4 h-4 text-white/30 flex-shrink-0" />
                    <input
                      ref={followUpInputRef}
                      type="text"
                      placeholder="Ask a follow-up question..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isLoading) {
                          handleSend();
                        }
                        if (e.key === 'Escape') {
                          setShowSearchDropdown(false);
                        }
                      }}
                      onFocus={() => input.trim() && setShowSearchDropdown(true)}
                      className="flex-1 bg-transparent border-none outline-none text-white text-sm placeholder:text-white/30"
                    />
                    <button
                      onClick={() => handleSend()}
                      disabled={!input.trim() || isLoading}
                      className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white disabled:opacity-30 transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>

                    {/* Search Dropdown for follow-up */}
                    <AnimatePresence>
                      {showSearchDropdown && input.trim() && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute z-50 left-0 right-0 bottom-full mb-2 p-2 rounded-xl border border-white/10 overflow-hidden"
                          style={{
                            background: 'rgba(25, 25, 28, 0.95)',
                            backdropFilter: 'blur(16px)',
                            boxShadow: '0 -10px 40px -10px rgba(0,0,0,0.5), 0 0 20px rgba(255,107,0,0.1)'
                          }}
                        >
                          {/* Chat Option */}
                          <button
                            onClick={() => handleSend()}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors group text-left"
                          >
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 group-hover:bg-orange-500 group-hover:text-white transition-all">
                              <MessageSquare className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white">Ask Company Brain</p>
                              <p className="text-xs text-white/50 truncate">"Ask about: {input}"</p>
                            </div>
                          </button>

                          {searchResults.length > 0 && (
                            <>
                              <div className="px-4 py-2 mt-2">
                                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Search Results</p>
                              </div>
                              
                              <div className="space-y-1">
                                {searchResults.map((result) => (
                                  <button
                                    key={result.id}
                                    onClick={() => {
                                      onNavigateToTrack?.(result.id);
                                      setShowSearchDropdown(false);
                                      setInput('');
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors group text-left"
                                  >
                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 text-white/40 group-hover:bg-white/10 group-hover:text-white transition-all">
                                      {result.trackType === 'video' ? <FileVideo className="w-4 h-4" /> :
                                       result.trackType === 'article' ? <FileText className="w-4 h-4" /> :
                                       result.trackType === 'story' ? <Zap className="w-4 h-4 fill-current" /> :
                                       <Zap className="w-4 h-4" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-white truncate">{result.title}</p>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 font-medium">
                                          {result.matchType}
                                        </span>
                                      </div>
                                      {result.excerpt && (
                                        <p className="text-xs text-white/40 truncate">{result.excerpt}</p>
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </>
                          )}

                          {isSearching && searchResults.length === 0 && (
                            <div className="px-4 py-8 text-center">
                              <div className="inline-block w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mb-2" />
                              <p className="text-xs text-white/40">Searching your knowledge base...</p>
                            </div>
                          )}

                          {!isSearching && searchResults.length === 0 && input.trim() && (
                            <div className="px-4 py-4 text-center">
                              <p className="text-xs text-white/40">No matching articles found. Ask me instead!</p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                
                {/* Clear conversation link */}
                <div className="flex justify-center mt-3">
                  <button
                    onClick={handleClear}
                    className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
                  >
                    <X className="w-3 h-3" />
                    Clear conversation
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export function KnowledgeBaseRevamp({ onTrackClick, currentRole, onCreateArticle }: KnowledgeBaseProps) {
  const { user } = useCurrentUser();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<any | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile drawer
  
  // Facts loaded from database
  const [selectedTrackFacts, setSelectedTrackFacts] = useState<any[]>([]);
  
  // Tag Management
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);

  // Bookmarks
  const [bookmarkedTracks, setBookmarkedTracks] = useState<Set<string>>(new Set());
  const [showSavedItems, setShowSavedItems] = useState(false);
  const [savedItems, setSavedItems] = useState<any[]>([]);
  
  // Attachments
  const [attachments, setAttachments] = useState<any[]>([]);

  // KB Settings
  const [showKBSettings, setShowKBSettings] = useState(false);
  const [kbSettings, setKbSettings] = useState({ kb_allow_guest_access: true });

  // Brain Drawer State
  const [brainDrawerOpen, setBrainDrawerOpen] = useState(false);

  // Function to refetch the currently selected track
  const refetchSelectedTrack = async () => {
    if (selectedTrack?.id) {
      try {
        const tracks = await crud.getTracks({ ids: [selectedTrack.id], includeAllVersions: true });
        if (tracks && tracks.length > 0) {
          setSelectedTrack(tracks[0]);
        }
      } catch (err) {
        console.error('Failed to refetch track:', err);
      }
    }
  };

  // URL Deep Linking & State Sync
  useEffect(() => {
    // Initial load from URL
    const params = new URLSearchParams(window.location.search);
    const categoryId = params.get('category');
    const articleId = params.get('article');

    if (categoryId) {
      setSelectedCategory(categoryId);
    }

    if (articleId) {
      // We need to fetch the track specifically to ensure it loads
      // even if it's not in the initial "recent" or "category" list
      crud.getTracks({ ids: [articleId], includeAllVersions: true })
        .then((tracks) => {
          if (tracks && tracks.length > 0) {
            setSelectedTrack(tracks[0]);
          }
        })
        .catch((err) => console.error("Failed to load deep linked track:", err));
    }
  }, []);

  // Sync state updates to URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    if (selectedCategory) {
      params.set('category', selectedCategory);
    } else {
      params.delete('category');
    }

    if (selectedTrack?.id) {
      params.set('article', selectedTrack.id);
    } else {
      params.delete('article');
    }

    const queryString = params.toString();
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
    
    // Only update if changed to avoid history spam
    if (window.location.search !== `?${queryString}`) {
      window.history.pushState({}, '', newUrl);
    }
  }, [selectedCategory, selectedTrack?.id]);

  // Load facts from database when selectedTrack changes
  useEffect(() => {
    if (selectedTrack?.id) {
      const loadFacts = async () => {
        try {
          const dbFacts = await factsCrud.getFactsForTrack(selectedTrack.id);
          const facts = dbFacts.map((f: any) => ({
            title: f.title,
            fact: f.content,
            content: f.content,
            type: f.type,
            steps: f.steps || [],
            contexts: [f.context?.specificity || 'universal'],
          }));
          setSelectedTrackFacts(facts);
          console.log(`📊 Loaded ${facts.length} facts for KB view`);
        } catch (error) {
          console.warn('Could not fetch facts for KB view:', error);
          setSelectedTrackFacts([]);
        }
      };
      
      loadFacts();
    } else {
      setSelectedTrackFacts([]);
    }
  }, [selectedTrack?.id]);

  // Data Fetching (Tags)
  const [categories, setCategories] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]); // All tags for color lookup
  const [loadingCats, setLoadingCats] = useState(true);

  const fetchCategories = async () => {
    setLoadingCats(true);
    try {
      // Fetch ALL tags (without category filter) for complete color lookup
      const allTagsData = await crud.getTagHierarchy();
      
      // Flatten ALL tags for color lookup
      const flattenTags = (tags: Tag[]): Tag[] => {
        const result: Tag[] = [];
        for (const tag of tags) {
          result.push(tag);
          if (tag.children) {
            result.push(...flattenTags(tag.children));
          }
        }
        return result;
      };
      setAllTags(flattenTags(allTagsData));
      
      // Now fetch KB-specific tags for the sidebar
      const data = await crud.getTagHierarchy('knowledge-base');
      
      // Filter for "KB Category" (or "Tag Category" as alias) for the sidebar
      // We need to find the node in the hierarchy
      let kbCategoryNode = null;
      
      // Flatten one level to find the specific parent tag
      for (const sysCat of data) {
        const name = sysCat.name.toLowerCase().trim();
        // Check root
        if (name === 'kb category' || name === 'tag category') {
          kbCategoryNode = sysCat;
          break;
        }
        // Check children (which are the Parent Tags)
        if (sysCat.children) {
          const found = sysCat.children.find(c => {
            const cName = c.name.toLowerCase().trim();
            return cName === 'kb category' || cName === 'tag category';
          });
          if (found) {
             kbCategoryNode = found;
             break;
          }
        }
      }

      // If we found the specific parent, use its children as the "Collections" list
      if (kbCategoryNode && kbCategoryNode.children) {
        setCategories(kbCategoryNode.children);
      } else {
        // Fallback: show nothing or empty list if the specific category doesn't exist yet
        setCategories([]); 
      }
    } catch (e) {
      console.error("Failed to load KB categories", e);
    } finally {
      setLoadingCats(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Fetch KB settings on mount
  useEffect(() => {
    const fetchKBSettings = async () => {
      try {
        const orgId = await getCurrentUserOrgId();
        if (!orgId) return;

        const { data: org } = await supabase
          .from('organizations')
          .select('kb_allow_guest_access')
          .eq('id', orgId)
          .single();

        if (org) {
          setKbSettings({ kb_allow_guest_access: org.kb_allow_guest_access ?? true });
        }
      } catch (error) {
        console.error('Error fetching KB settings:', error);
      }
    };

    fetchKBSettings();
  }, []);

  const handleToggleGuestAccess = (checked: boolean) => {
    setKbSettings(prev => ({ ...prev, kb_allow_guest_access: checked }));
  };

  const handleSaveKBSettings = async () => {
    try {
      const orgId = await getCurrentUserOrgId();
      if (!orgId) throw new Error('Organization not found');

      const { error } = await supabase
        .from('organizations')
        .update({ kb_allow_guest_access: kbSettings.kb_allow_guest_access })
        .eq('id', orgId);

      if (error) throw error;

      toast.success('KB settings saved successfully');
      setShowKBSettings(false);
    } catch (error: any) {
      console.error('Error saving KB settings:', error);
      toast.error('Failed to save KB settings', { description: error.message });
    }
  };

  const refetchCats = fetchCategories;
  
  // Search Debounce
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Determine selected tag name for filtering
  const selectedCategoryName = useMemo(() => {
    if (!selectedCategory) return null;
    // selectedCategory is the ID. We can find the name from the fetched categories (which are now the children)
    const found = categories.find(c => c.id === selectedCategory);
    return found ? found.name : null;
  }, [selectedCategory, categories]);

  // Helper to get tag object by name from all tags
  const getTagByName = (tagName: string): Tag | undefined => {
    return allTags.find(t => t.name === tagName);
  };

  // Fetch tracks using tags filter
  const { tracks: allTracks, loading: loadingTracks, refetch: refetchCatTracks } = useTracks({ 
    status: 'published', // Only show published tracks in Knowledge Base
    search: debouncedSearch,
    tags: selectedCategoryName ? [selectedCategoryName] : undefined
  });

  // Display tracks are just the fetched tracks now
  const displayTracks = React.useMemo(() => {
    return allTracks.filter((track: any) => {
      // Check strict boolean flag (if it exists)
      if (track.show_in_knowledge_base === true) return true;

      // Check system tag in tags array
      if (track.tags && Array.isArray(track.tags) && track.tags.includes('system:show_in_knowledge_base')) return true;

      return false;
    });
  }, [allTracks]);

  // Derived State
  const recentTracks = useMemo(() => {
    // Use displayTracks as it contains the currently relevant set of normalized tracks
    return [...displayTracks]
      .sort((a: any, b: any) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())
      .slice(0, 5);
  }, [displayTracks]);

  // Process content for TOC and inject IDs
  const { processedContent, tocSections } = useMemo(() => {
    // Try content_text first (database field), then content (possible alias)
    // For stories, transcript contains JSON slide data, not HTML content - so don't use it as fallback
    const rawContent = selectedTrack?.content_text || selectedTrack?.content ||
      (selectedTrack?.type !== 'story' ? selectedTrack?.transcript : null);

    if (!rawContent) return { processedContent: '', tocSections: [] };

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawContent, 'text/html');
      const headers = doc.querySelectorAll('h2, h3');
      const sections: { id: string; title: string; level: number }[] = [];

      headers.forEach((header, index) => {
        const text = header.textContent || '';
        // Create a safe ID from the text
        const id = text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || `section-${index}`;
        
        header.id = id;
        sections.push({
          id,
          title: text,
          level: header.tagName === 'H2' ? 1 : 2
        });
      });

      return {
        processedContent: doc.body.innerHTML,
        tocSections: sections
      };
    } catch (e) {
      console.error("Error parsing content for TOC", e);
      return { processedContent: rawContent, tocSections: [] };
    }
  }, [selectedTrack?.content, selectedTrack?.content_text, selectedTrack?.transcript, selectedTrack?.type]);

  const filteredTracks = useMemo(() => {
    // Filter logic is now handled by backend via hooks
    return displayTracks;
  }, [displayTracks]);

  // Handlers
  const handleTrackSelect = async (track: any) => {
    setSelectedTrack(track);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Record view
    try {
      if (selectedCategory) {
        await crud.recordKBTrackView(track.id, selectedCategory);
        refetchCatTracks();
      }
    } catch (e) {
      console.error("Failed to record view", e);
    }
  };

  const handleBackToBrowse = () => {
    setSelectedTrack(null);
  };

  const [userFeedback, setUserFeedback] = useState<boolean | null>(null);

  // Fetch feedback state and likes count when track changes
  useEffect(() => {
    if (selectedTrack?.id) {
       setUserFeedback(null);
       
       // Fetch feedback
       crud.getUserKBFeedback(selectedTrack.id)
         .then(data => {
            if (data && data.helpful !== null) setUserFeedback(data.helpful);
         })
         .catch(e => console.error("Failed to fetch feedback", e));
       
       // Fetch likes count from KV store
       fetch(`${getServerUrl()}/kb/likes/${selectedTrack.id}`, {
         method: 'GET',
         headers: {
           'Authorization': `Bearer ${publicAnonKey}`
         }
       })
         .then(res => res.json())
         .then(data => {
           if (data.likes !== undefined) {
             setSelectedTrack(prev => ({ ...prev, likes: data.likes }));
           }
         })
         .catch(e => console.error("Failed to fetch likes", e));
    }
  }, [selectedTrack?.id]);

  // Load attachments when track is selected
  useEffect(() => {
    if (selectedTrack?.id) {
      const loadAttachments = async () => {
        try {
          const trackAttachments = await attachmentCrud.getAttachments(selectedTrack.id);
          setAttachments(trackAttachments);
        } catch (error) {
          console.error('Error loading attachments:', error);
          setAttachments([]);
        }
      };
      loadAttachments();
    } else {
      setAttachments([]);
    }
  }, [selectedTrack?.id]);

  // Reset brain state when track changes or when no track is selected
  useEffect(() => {
    if (!selectedTrack) {
      setBrainDrawerOpen(false);
    }
  }, [selectedTrack?.id]);

  const handleLike = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!selectedTrack) return;
    
    // Optimistic
    const currentLikes = selectedTrack.likes || 0;
    const newLikes = currentLikes + 1;
    setSelectedTrack({ ...selectedTrack, likes: newLikes });
    
    try {
      await crud.toggleTrackLike(selectedTrack.id);
      toast.success("Article liked!");
    } catch (e) {
      console.error("Failed to like", e);
      setSelectedTrack({ ...selectedTrack, likes: currentLikes });
    }
  };

  const handleFeedback = async (helpful: boolean) => {
    if (!selectedTrack) return;
    
    setUserFeedback(helpful);
    
    if (helpful) {
      toast.success("Glad you found this helpful!");
    } else {
      toast.success("Thanks for your feedback.");
    }

    try {
      await crud.recordKBFeedback(selectedTrack.id, helpful);
    } catch (e) {
      console.error("Feedback error", e);
      const errorMessage = e instanceof Error ? e.message : 'Failed to record feedback';
      
      // Reset feedback state on error
      setUserFeedback(null);
      toast.error(errorMessage);
    }
  };

  // PDF Download Handler
  const handleDownloadPDF = async () => {
    if (!selectedTrack) return;

    try {
      toast.success("Preparing PDF...");
      
      // Dynamic import of jsPDF
      const { default: jsPDF } = await import('jspdf');
      
      const doc = new jsPDF('p', 'pt', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 50;
      const contentWidth = pageWidth - (margin * 2);
      const footerHeight = 40;
      let yPosition = margin;

      // Helper to check if we need a new page
      const checkPageBreak = (neededSpace: number) => {
        if (yPosition + neededSpace > pageHeight - footerHeight) {
          doc.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };

      // Add header with logo color bar
      doc.setFillColor(249, 115, 22); // Orange color
      doc.rect(0, 0, pageWidth, 12, 'F');
      
      yPosition += 30;

      // Title
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      const titleLines = doc.splitTextToSize(selectedTrack.title, contentWidth);
      titleLines.forEach((line: string) => {
        doc.text(line, margin, yPosition);
        yPosition += 36;
      });
      yPosition += 5;

      // Metadata badge
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(margin, yPosition, contentWidth, 30, 3, 3, 'F');
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      
      const metadataText = `${selectedTrack.type ? selectedTrack.type.charAt(0).toUpperCase() + selectedTrack.type.slice(1) : 'Article'} • ${formatDate(selectedTrack.updated_at)}${selectedTrack.category?.name ? ' • ' + selectedTrack.category.name : ''}`;
      doc.text(metadataText, margin + 10, yPosition + 12);
      
      if (selectedTrack.created_by?.name) {
        doc.text(`Author: ${selectedTrack.created_by.name}`, margin + 10, yPosition + 24);
      }
      yPosition += 40;

      // Stats (without emojis)
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`${selectedTrack.view_count || 0} views • ${selectedTrack.likes || 0} likes`, margin, yPosition);
      yPosition += 25;

      // Separator line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(1);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 25;

      // Description box
      if (selectedTrack.description) {
        checkPageBreak(60);
        
        const descLines = doc.splitTextToSize(selectedTrack.description, contentWidth - 30);
        const descHeight = descLines.length * 16 + 30;
        
        doc.setFillColor(254, 243, 199); // Light orange
        doc.setDrawColor(251, 191, 36); // Orange border
        doc.setLineWidth(2);
        doc.roundedRect(margin, yPosition, contentWidth, descHeight, 5, 5, 'FD');
        
        yPosition += 20;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(120, 53, 15); // Dark orange text
        
        descLines.forEach((line: string) => {
          doc.text(line, margin + 15, yPosition);
          yPosition += 16;
        });
        
        yPosition += 20;
      }

      // Learning Objectives (Key Facts)
      if (selectedTrackFacts && selectedTrackFacts.length > 0) {
        checkPageBreak(40);
        yPosition += 10;
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('Key Facts', margin, yPosition);
        yPosition += 25;
        
        selectedTrackFacts.forEach((factObj: any) => {
          const obj = factObj.content || factObj.fact || factObj;
          checkPageBreak(30);
          
          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(71, 85, 105);
          
          // Bullet point
          doc.setFillColor(34, 197, 94); // Green
          doc.circle(margin + 5, yPosition - 3, 3, 'F');
          
          const objLines = doc.splitTextToSize(obj, contentWidth - 25);
          objLines.forEach((line: string, lineIndex: number) => {
            doc.text(line, margin + 18, yPosition);
            if (lineIndex < objLines.length - 1) yPosition += 14;
          });
          
          yPosition += 20;
        });
        
        yPosition += 10;
      }

      // Main Content
      if (processedContent && processedContent.trim()) {
        checkPageBreak(40);
        
        // Add content heading
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('Content', margin, yPosition);
        yPosition += 25;
        
        // Parse HTML and extract text content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = processedContent;
        
        // Process each element
        const processNode = (node: Node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.trim();
            if (text) {
              doc.setFontSize(11);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(51, 65, 85);
              const lines = doc.splitTextToSize(text, contentWidth);
              lines.forEach((line: string) => {
                checkPageBreak(16);
                doc.text(line, margin, yPosition);
                yPosition += 16;
              });
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            const tagName = element.tagName.toLowerCase();
            
            if (tagName === 'h1') {
              checkPageBreak(40);
              yPosition += 15;
              doc.setFontSize(18);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(15, 23, 42);
              const text = element.textContent?.trim() || '';
              const lines = doc.splitTextToSize(text, contentWidth);
              lines.forEach((line: string) => {
                doc.text(line, margin, yPosition);
                yPosition += 24;
              });
              yPosition += 8;
            } else if (tagName === 'h2') {
              checkPageBreak(35);
              yPosition += 12;
              doc.setFontSize(16);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(15, 23, 42);
              const text = element.textContent?.trim() || '';
              const lines = doc.splitTextToSize(text, contentWidth);
              lines.forEach((line: string) => {
                doc.text(line, margin, yPosition);
                yPosition += 22;
              });
              yPosition += 6;
            } else if (tagName === 'h3') {
              checkPageBreak(30);
              yPosition += 10;
              doc.setFontSize(14);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(15, 23, 42);
              const text = element.textContent?.trim() || '';
              const lines = doc.splitTextToSize(text, contentWidth);
              lines.forEach((line: string) => {
                doc.text(line, margin, yPosition);
                yPosition += 20;
              });
              yPosition += 5;
            } else if (tagName === 'p') {
              checkPageBreak(20);
              doc.setFontSize(11);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(51, 65, 85);
              const text = element.textContent?.trim() || '';
              if (text) {
                const lines = doc.splitTextToSize(text, contentWidth);
                lines.forEach((line: string) => {
                  checkPageBreak(16);
                  doc.text(line, margin, yPosition);
                  yPosition += 16;
                });
                yPosition += 8;
              }
            } else if (tagName === 'ul' || tagName === 'ol') {
              yPosition += 5;
              const items = element.querySelectorAll('li');
              items.forEach((li, index) => {
                checkPageBreak(20);
                doc.setFontSize(11);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(51, 65, 85);
                
                const bullet = tagName === 'ul' ? '•' : `${index + 1}.`;
                doc.text(bullet, margin + 5, yPosition);
                
                const text = li.textContent?.trim() || '';
                const lines = doc.splitTextToSize(text, contentWidth - 25);
                lines.forEach((line: string, lineIndex: number) => {
                  doc.text(line, margin + 20, yPosition);
                  if (lineIndex < lines.length - 1) {
                    yPosition += 14;
                    checkPageBreak(14);
                  }
                });
                yPosition += 18;
              });
              yPosition += 5;
            } else {
              // Process children for other elements
              element.childNodes.forEach(child => processNode(child));
            }
          }
        };
        
        tempDiv.childNodes.forEach(child => processNode(child));
      }

      // Add footer on each page
      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        
        // Footer line
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(margin, pageHeight - 35, pageWidth - margin, pageHeight - 35);
        
        // Footer text
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.setFont('helvetica', 'normal');
        
        const pageText = `Page ${i} of ${totalPages}`;
        doc.text(pageText, pageWidth / 2, pageHeight - 20, { align: 'center' });
        
        doc.text(
          `Downloaded: ${new Date().toLocaleDateString()}`,
          pageWidth - margin,
          pageHeight - 20,
          { align: 'right' }
        );
      }

      // Save the PDF
      const fileName = `${selectedTrack.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
      doc.save(fileName);
      
      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error("Failed to generate PDF. Please try again.");
    }
  };

  // Bookmark Handlers
  useEffect(() => {
    // Load bookmarks on mount
    const loadBookmarks = async () => {
      try {
        const bookmarks = await crud.getUserKBBookmarks();
        const bookmarkIds = new Set(bookmarks.map((b: any) => b.track_id));
        setBookmarkedTracks(bookmarkIds);
      } catch (e) {
        console.error("Failed to load bookmarks", e);
      }
    };
    loadBookmarks();
  }, []);

  // Load saved items when modal opens
  useEffect(() => {
    if (showSavedItems) {
      const loadSavedItems = async () => {
        try {
          const bookmarks = await crud.getUserKBBookmarks();
          setSavedItems(bookmarks);
        } catch (e) {
          console.error("Failed to load saved items", e);
          toast.error("Failed to load saved items");
        }
      };
      loadSavedItems();
    }
  }, [showSavedItems]);

  const toggleBookmark = async (trackId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    const isBookmarked = bookmarkedTracks.has(trackId);
    
    // Optimistic update
    const newBookmarks = new Set(bookmarkedTracks);
    if (isBookmarked) {
      newBookmarks.delete(trackId);
    } else {
      newBookmarks.add(trackId);
    }
    setBookmarkedTracks(newBookmarks);

    try {
      if (isBookmarked) {
        await crud.removeKBTrackBookmark(trackId);
        toast.success("Removed from saved items");
      } else {
        await crud.bookmarkKBTrack(trackId);
        toast.success("Saved for later");
      }
    } catch (error) {
      console.error("Bookmark error:", error);
      // Revert on error
      setBookmarkedTracks(bookmarkedTracks);
      toast.error("Failed to update bookmark");
    }
  };

  // Recent Searches
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('kb_recent_searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const addRecentSearch = (query: string) => {
    if (!query.trim()) return;
    const newSearches = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(newSearches);
    localStorage.setItem('kb_recent_searches', JSON.stringify(newSearches));
  };

  // Collection management handled by TagSelectorDialog

  // Keyboard Shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsCommandPaletteOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Scroll Progress
  const [scrollProgress, setScrollProgress] = useState(0);
  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollTop;
      const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scroll = `${totalScroll / windowHeight}`;
      setScrollProgress(Number(scroll));
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // --- Layout Structure ---

  return (
    <div className="min-h-screen font-sans text-slate-900 dark:text-slate-50">
      
      {/* 1. Top Toolbar / Header */}
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center text-white shadow-sm">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Knowledge Base</h1>
              <p className="text-sm text-muted-foreground">Find guides, policies, and training materials</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
             {currentRole === 'admin' && (
               <Button
                 className="hidden sm:flex bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white hover:opacity-90 transition-opacity border-0"
                 onClick={onCreateArticle}
               >
                 <Plus className="h-4 w-4 mr-2" />
                 Create Article
               </Button>
             )}
             <Button
               variant="outline"
               size="icon"
               onClick={() => setShowKBSettings(true)}
               className="hover:bg-accent"
               title="KB Settings"
             >
               <Settings className="h-4 w-4" />
             </Button>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-8">
        
        {/* 2. Sidebar (Desktop) */}
        <aside className="hidden lg:block w-64 shrink-0 sticky top-0 self-start max-h-[calc(100vh-2rem)] overflow-y-auto pb-8">
           <div className="space-y-8">
             
             {/* Collections / Categories */}
             <div>
                <div className="flex items-center justify-between mb-4 px-3">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Collections</h3>
                  {(currentRole === 'admin' || currentRole === 'trike-super-admin') && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0 hover:bg-slate-100 dark:hover:bg-slate-800"
                      onClick={() => setIsTagManagerOpen(true)}
                    >
                      <Edit className="h-3 w-3 text-slate-400" />
                    </Button>
                  )}
                </div>
               <div className="space-y-1">
                 <button
                   onClick={() => {
                     setSelectedCategory(null);
                     setSelectedTrack(null);
                   }}
                   className={cn(
                     "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors",
                     selectedCategory === null 
                       ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700" 
                       : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                   )}
                 >
                   <div className="flex items-center gap-3">
                     <BookOpen className="h-4 w-4 opacity-70" />
                     All Content
                   </div>
                   {selectedCategory === null && <ChevronRight className="h-3 w-3 opacity-50" />}
                 </button>
                 
                 {categories?.map((category: any) => (
                   <button
                     key={category.id}
                     onClick={() => {
                       setSelectedCategory(category.id);
                       setSelectedTrack(null);
                     }}
                     className={cn(
                       "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors group",
                       selectedCategory === category.id 
                         ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700" 
                         : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                     )}
                   >
                     <div className="flex items-center gap-3">
                       <Hash className="h-4 w-4 opacity-70" />
                       <span className="truncate">{category.name}</span>
                     </div>
                     <span className={cn(
                       "text-xs text-slate-400 transition-opacity",
                       selectedCategory === category.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                     )}>
                       {category.trackCount || 0}
                     </span>
                   </button>
                 ))}
               </div>
             </div>

             {/* Recent */}
             {recentTracks.length > 0 && (
               <div>
                 <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-3">Recently Viewed</h3>
                 <div className="space-y-1">
                   {recentTracks.map((track: any) => (
                     <button
                       key={track.id}
                       onClick={() => handleTrackSelect(track)}
                       className="w-full text-left px-3 py-2 rounded-md text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group truncate"
                     >
                        <div className="flex items-center gap-2 truncate">
                          <Clock className="h-3 w-3 shrink-0 opacity-50" />
                          <span className="truncate">{track.title}</span>
                        </div>
                     </button>
                   ))}
                 </div>
               </div>
             )}

             {/* Footer Links */}
             <div className="pt-4 border-t border-slate-200 dark:border-slate-800 px-3">
                <button 
                  onClick={() => setShowSavedItems(true)}
                  className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  <Bookmark className="h-4 w-4" />
                  Saved Items
                  {bookmarkedTracks.size > 0 && (
                    <Badge 
                      className="ml-auto text-xs bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white border-0"
                    >
                      {bookmarkedTracks.size}
                    </Badge>
                  )}
                </button>
             </div>

           </div>
        </aside>

        {/* 3. Main Content Area */}
        <main className="flex-1 min-w-0 pb-12">
          
          {/* Brain Hero Section - Only show when browsing (not viewing a specific track) */}
          {!selectedTrack && (
            <BrainHero 
              onNavigateToTrack={async (trackId) => {
                // Find and select the track
                try {
                  const tracks = await crud.getTracks({ ids: [trackId], includeAllVersions: true });
                  if (tracks && tracks.length > 0) {
                    handleTrackSelect(tracks[0]);
                  }
                } catch (err) {
                  console.error('Failed to navigate to track:', err);
                }
              }} 
            />
          )}

          {/* Breadcrumbs (Mobile/Tablet only or when browsing) */}
          {!selectedTrack && (
            <div className="flex items-center text-sm text-muted-foreground mb-6">
              <span 
                className="hover:text-foreground cursor-pointer"
                onClick={() => {
                  setSelectedCategory(null);
                  setSelectedTrack(null);
                }}
              >
                Knowledge Base
              </span>
              <ChevronRight className="h-4 w-4 mx-2" />
              <span className="text-foreground font-medium">
                {selectedCategory 
                  ? categories?.find((c:any) => c.id === selectedCategory)?.name 
                  : 'All Content'}
              </span>
            </div>
          )}

          {/* VIEW: Article List (Grid) */}
          {!selectedTrack && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Hero / Welcome (Removed as it duplicates page header) */}

              {/* Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {loadingTracks ? (
                   Array.from({ length: 6 }).map((_, i) => (
                     <div key={i} className="bg-white border rounded-xl p-6 h-64 flex flex-col gap-4">
                       <Skeleton className="h-10 w-10 rounded-lg" />
                       <Skeleton className="h-6 w-3/4" />
                       <Skeleton className="h-4 w-full" />
                       <Skeleton className="h-4 w-2/3" />
                       <div className="mt-auto pt-4 border-t flex justify-between">
                         <Skeleton className="h-3 w-16" />
                         <Skeleton className="h-3 w-16" />
                       </div>
                     </div>
                   ))
                ) : filteredTracks.length > 0 ? (
                  filteredTracks.map((track: any) => (
                    <ArticleCard 
                      key={track.id} 
                      track={track} 
                      onClick={() => handleTrackSelect(track)}
                      isBookmarked={bookmarkedTracks.has(track.id)}
                      onToggleBookmark={toggleBookmark}
                    />
                  ))
                ) : (
                  <div className="col-span-full py-16 text-center">
                     <div className="bg-slate-50 dark:bg-slate-900 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6">
                       <Search className="h-10 w-10 text-slate-400" />
                     </div>
                     <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                       No articles found
                     </h3>
                     <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">
                       We couldn't find anything matching "{searchQuery}". Try adjusting your search or browse categories.
                     </p>
                     {searchQuery && (
                       <Button variant="outline" onClick={() => setSearchQuery('')}>
                         Clear Search
                       </Button>
                     )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW: Single Article */}
          {selectedTrack && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto">
               {/* Article Navigation */}
               <div className="flex items-center justify-between mb-8">
                  <Button variant="ghost" className="pl-0 text-slate-500 hover:text-slate-900 hover:bg-transparent" onClick={handleBackToBrowse}>
                    <CornerUpLeft className="h-4 w-4 mr-2" />
                    Back to {selectedCategory ? categories?.find((c:any) => c.id === selectedCategory)?.name : 'Browse'}
                  </Button>
                  <div className="flex gap-2">
                    {selectedTrack && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setBrainDrawerOpen(true)}
                        className="gap-2 border-orange-200 hover:border-orange-400 hover:bg-orange-50"
                      >
                        <MessageSquare className="h-4 w-4 text-orange-500" />
                        <span className="hidden sm:inline">Ask</span>
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => toggleBookmark(selectedTrack.id, e)}
                      title={bookmarkedTracks.has(selectedTrack.id) ? "Remove from saved" : "Save for later"}
                      className="px-3"
                    >
                      <Bookmark 
                        className={cn(
                          "h-4 w-4",
                          bookmarkedTracks.has(selectedTrack.id) && "fill-current"
                        )}
                      />

                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleDownloadPDF}
                      title="Download as PDF"
                      className="px-3"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    
                    {/* QR Code Toggle - Only for admins */}
                    {(currentRole === 'trike-super-admin' || currentRole === 'admin') && (
                      <QRCodeToggle 
                        track={selectedTrack} 
                        onUpdate={() => {
                          // Refetch the track to get updated QR data
                          refetchSelectedTrack();
                        }}
                      />
                    )}
                  </div>
               </div>

               {/* Article Header */}
               <div className="mb-8">
                  <div className="flex items-center gap-3 mb-6 text-sm text-slate-500">
                     <span>{selectedTrack.type ? selectedTrack.type.charAt(0).toUpperCase() + selectedTrack.type.slice(1) : 'Article'}</span>
                     <span>•</span>
                     <span>Last updated {formatDate(selectedTrack.updated_at)}</span>
                  </div>
                  
                  <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-50 leading-tight mb-6">
                    {selectedTrack.title}
                  </h1>
                  
                  <div className="flex items-center justify-between pb-4 border-b-0">
                     <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                           <AvatarImage src={selectedTrack.created_by?.avatar_url} />
                           <AvatarFallback>{(selectedTrack.created_by?.name || 'U').charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                           <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {selectedTrack.created_by?.name || 'Unknown Author'}
                           </p>
                           <p className="text-xs text-slate-500">
                              Author
                           </p>
                        </div>
                     </div>
                     
                     <div className="flex items-center gap-4 text-slate-500 text-sm">
                        <div className="flex items-center gap-1" title="Views">
                           <Eye className="h-4 w-4" />
                           {selectedTrack.view_count || 0}
                        </div>
                        <button 
                          className="flex items-center gap-1 hover:text-[#F64A05] transition-colors" 
                          title="Like this article"
                          onClick={handleLike}
                        >
                           <ThumbsUp className="h-4 w-4" />
                           {selectedTrack.likes || 0}
                        </button>
                     </div>
              </div>
              
              {/* Tags Section - Display tags from flat array */}
              {selectedTrack.tags && Array.isArray(selectedTrack.tags) && selectedTrack.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 pb-6">
                  {selectedTrack.tags
                    .filter((tagName: string) => !tagName.startsWith('system:'))
                    .map((tagName: string, index: number) => {
                      const tag = getTagByName(tagName);
                      const tagColor = tag?.color || '#3b82f6'; // Default to blue if not found
                      
                      return (
                        <div
                          key={`${tagName}-${index}`}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm border"
                          style={{
                            backgroundColor: `${tagColor}15`,
                            borderColor: `${tagColor}40`,
                            color: tagColor
                          }}
                        >
                          <span>{tagName}</span>
                        </div>
                      );
                    })}
                </div>
              )}
              
              <div className="border-b border-slate-200 dark:border-slate-800 mb-8"></div>
           </div>

               {/* Article Content */}
               <div className="prose prose-slate dark:prose-invert max-w-none mb-16">
                  {/* Video Player (if video type) */}
                  {selectedTrack.type === 'video' && selectedTrack.content_url ? (
                    <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden my-8 shadow-lg">
                      {isYouTubeUrl(selectedTrack.content_url) ? (
                        // YouTube embed player
                        <iframe
                          className="w-full h-full"
                          src={`https://www.youtube.com/embed/${getYouTubeVideoId(selectedTrack.content_url)}?enablejsapi=1`}
                          title={selectedTrack.title}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      ) : isVimeoUrl(selectedTrack.content_url) ? (
                        // Vimeo embed player
                        <iframe
                          className="w-full h-full"
                          src={`https://player.vimeo.com/video/${getVimeoVideoId(selectedTrack.content_url)}?title=0&byline=0&portrait=0`}
                          title={selectedTrack.title}
                          frameBorder="0"
                          allow="autoplay; fullscreen; picture-in-picture"
                          allowFullScreen
                        />
                      ) : selectedTrack.content_url.match(/\.(mp4|webm|ogg)$/i) ? (
                        // Direct video file
                        <video 
                          src={selectedTrack.content_url} 
                          controls 
                          className="w-full h-full object-contain" 
                          poster={selectedTrack.thumbnail_url && selectedTrack.thumbnail_url !== '/default-thumbnail.png' ? selectedTrack.thumbnail_url : defaultThumbnail}
                        />
                      ) : selectedTrack.content_url.match(/\.(mp3|wav|ogg)$/i) ? (
                        // Audio file with visual wrapper
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-orange-800/20">
                          <img 
                            src={selectedTrack.thumbnail_url && selectedTrack.thumbnail_url !== '/default-thumbnail.png' ? selectedTrack.thumbnail_url : defaultThumbnail} 
                            alt={selectedTrack.title}
                            className="w-48 h-48 object-cover rounded-lg mb-4"
                          />
                          <audio
                            controls
                            className="w-full max-w-md"
                            src={selectedTrack.content_url}
                          >
                            Your browser does not support the audio tag.
                          </audio>
                        </div>
                      ) : (
                        // Fallback for other URL types
                        <video 
                          src={selectedTrack.content_url} 
                          controls 
                          className="w-full h-full object-contain" 
                          poster={selectedTrack.thumbnail_url && selectedTrack.thumbnail_url !== '/default-thumbnail.png' ? selectedTrack.thumbnail_url : defaultThumbnail}
                        />
                      )}
                    </div>
                  ) : null}

                  {/* Description/Excerpt */}
                  {selectedTrack.description && (
                    <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 mb-8 border-l-4 border-orange-500 pl-6 italic">
                      {selectedTrack.description}
                    </p>
                  )}

                  {/* TTS Player for Articles */}
                  {selectedTrack.type === 'article' && (
                    <TTSPlayer 
                      trackId={selectedTrack.id}
                      initialAudioUrl={undefined}
                      initialVoice="alloy"
                      showVoiceSelector={false}
                    />
                  )}

                  {/* Story Preview */}
                  {selectedTrack.type === 'story' && (() => {
                    // Parse slides from transcript field
                    let slides: any[] = [];
                    if (selectedTrack.transcript) {
                      try {
                        const storyData = typeof selectedTrack.transcript === 'string' 
                          ? JSON.parse(selectedTrack.transcript) 
                          : selectedTrack.transcript;
                        if (storyData.slides && Array.isArray(storyData.slides)) {
                          slides = storyData.slides.map((slide: any, index: number) => ({
                            id: slide.id || `slide-${index}`,
                            name: slide.name || slide.title || `Slide ${index + 1}`,
                            type: slide.type || 'image',
                            url: slide.url || '',
                            order: slide.order !== undefined ? slide.order : index,
                            duration: slide.duration
                          }));
                        }
                      } catch (e) {
                        console.error('Error parsing story slides:', e);
                      }
                    }
                    
                    return slides.length > 0 ? (
                      <div className="my-8">
                        <StoryPreview slides={slides} />
                      </div>
                    ) : null;
                  })()}

                  {/* Story Transcripts - Show for story types with transcript data */}
                  {selectedTrack.type === 'story' && selectedTrack.transcript && (
                    <div className="my-8 not-prose">
                      <StoryTranscript
                        storyData={selectedTrack.transcript}
                        trackId={selectedTrack.id}
                        projectId={projectId}
                        publicAnonKey={publicAnonKey}
                        readOnly
                      />
                    </div>
                  )}

                  {/* Main Body Content - Only show if there's actual content */}
                  {processedContent && processedContent.trim() && (
                    <div className="space-y-6 text-slate-800 dark:text-slate-200 leading-7">
                      <div 
                        className="article-content prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg prose-p:text-base prose-p:leading-7 prose-ul:list-disc prose-ol:list-decimal prose-li:text-base prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-slate-100 dark:prose-pre:bg-slate-800 prose-pre:p-4 prose-pre:rounded-lg prose-strong:font-bold"
                        dangerouslySetInnerHTML={{ __html: processedContent }} 
                      />
                    </div>
                  )}

                  {/* Key Facts (if available) - Moved to bottom */}
                  {selectedTrackFacts && selectedTrackFacts.length > 0 && (
                     <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-slate-800 dark:to-slate-900 p-8 rounded-2xl mt-12 not-prose border border-orange-200 dark:border-slate-700 shadow-sm">
                       <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold shadow-md">
                           ✓
                         </div>
                         Key Facts
                       </h3>
                       <div className="grid sm:grid-cols-2 gap-4">
                         {selectedTrackFacts.map((factObj: any, i: number) => {
                           const displayText = factObj.content || factObj.fact || factObj;
                           const isProcedure = factObj.type === 'Procedure' && factObj.steps;
                           
                           return (
                             <div key={i} className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                               <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold shadow-md">
                                 {i + 1}
                               </div>
                               <div className="flex-1 pt-0.5">
                                 <span className="text-sm leading-relaxed">{displayText}</span>
                                 {isProcedure && (
                                   <ul className="mt-3 ml-2 space-y-2 text-xs border-l-2 border-orange-300 dark:border-orange-700 pl-4">
                                     {factObj.steps.map((step: string, stepIdx: number) => (
                                       <li key={stepIdx} className="flex items-start gap-2">
                                         <span className="text-orange-600 dark:text-orange-400 font-bold">{stepIdx + 1}.</span>
                                         <span className="text-slate-600 dark:text-slate-400">{step}</span>
                                       </li>
                                     ))}
                                   </ul>
                                 )}
                               </div>
                             </div>
                           );
                         })}
                       </div>
                     </div>
                  )}

                  {/* Resources Section - Attachments */}
                  {attachments.length > 0 && (
                    <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 not-prose">
                      <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-6">
                        Resources
                      </h2>
                      <div className="space-y-3">
                        {attachments.map((attachment) => {
                          const isImage = attachment.fileType?.startsWith('image/');
                          const isVideo = attachment.fileType?.startsWith('video/');
                          const isAudio = attachment.fileType?.startsWith('audio/');
                          const isPdf = attachment.fileType === 'application/pdf';
                          
                          let icon = <FileTextIcon className="h-6 w-6 text-[#F64A05]" />;
                          if (isImage) icon = <ImageIcon className="h-6 w-6 text-[#F64A05]" />;
                          else if (isVideo) icon = <FileVideo className="h-6 w-6 text-[#F64A05]" />;
                          else if (isAudio) icon = <FileAudio className="h-6 w-6 text-[#F64A05]" />;
                          else if (isPdf) icon = <FileTextIcon className="h-6 w-6 text-[#F64A05]" />;

                          return (
                            <a
                              key={attachment.id}
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-4 px-4 py-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-slate-600 hover:bg-slate-800/70 transition-all group"
                            >
                              {/* Icon */}
                              <div className="shrink-0">
                                {icon}
                              </div>
                              
                              {/* File Info */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-300 truncate">
                                  {attachment.fileName}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {attachment.fileSize ? `${(attachment.fileSize / 1024).toFixed(1)} KB` : ''}
                                </p>
                              </div>
                              
                              {/* Download Icon */}
                              <Download className="h-4 w-4 text-slate-500 group-hover:text-slate-400 shrink-0" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
            </div>

            </div>
          )}

        </main>

        {/* 4. TOC (Desktop, Article Only) */}
        {selectedTrack && tocSections.length > 0 && (
           <TableOfContents sections={tocSections} />
        )}

      </div>

      {/* Mobile Sidebar Drawer */}
      <div className={cn(
         "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity lg:hidden",
         sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )} onClick={() => setSidebarOpen(false)} />
      
      <div className={cn(
         "fixed inset-y-0 left-0 z-50 w-80 bg-white dark:bg-slate-950 shadow-xl transition-transform duration-300 lg:hidden transform",
         sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
         <div className="p-4 flex items-center justify-between border-b">
            <span className="font-bold text-lg">Navigation</span>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
               <X className="h-5 w-5" />
            </Button>
         </div>
         <ScrollArea className="h-full p-4">
            {/* Mobile sidebar content matches desktop sidebar */}
             <div className="space-y-6">
             <div>
               <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-1">Collections</h3>
               <div className="space-y-1">
                 <button
                   onClick={() => { 
                     setSelectedCategory(null); 
                     setSelectedTrack(null);
                     setSidebarOpen(false); 
                   }}
                   className="w-full flex items-center px-3 py-3 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100"
                 >
                   <BookOpen className="h-4 w-4 mr-3" />
                   All Content
                 </button>
                 {categories?.map((category: any) => (
                   <button
                     key={category.id}
                     onClick={() => { 
                       setSelectedCategory(category.id); 
                       setSelectedTrack(null);
                       setSidebarOpen(false); 
                     }}
                     className="w-full flex items-center px-3 py-3 rounded-md text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                   >
                     <Hash className="h-4 w-4 mr-3" />
                     {category.name}
                   </button>
                 ))}
               </div>
             </div>
             </div>
         </ScrollArea>
      </div>

      {/* Command Palette */}
      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSearch={(query) => {
           setSearchQuery(query);
           addRecentSearch(query);
           setSelectedTrack(null); // Switch to list view
        }}
        recentSearches={recentSearches}
        tracks={allTracks}
        onSelectTrack={(track) => {
          handleTrackSelect(track);
          // Modal closes automatically via internal logic calling onClose
        }}
      />

      {/* Tag Management Dialog */}
      <TagSelectorDialog
        isOpen={isTagManagerOpen}
        onClose={() => {
          setIsTagManagerOpen(false);
          refetchCats();
        }}
        selectedTags={[]}
        onTagsChange={() => {}}
        systemCategory="knowledge-base"
        allowManagement={true}
        restrictToParentName="KB Category"
      />

      {/* Saved Items Dialog */}
      <Dialog open={showSavedItems} onOpenChange={setShowSavedItems}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogTitle>Saved Items</DialogTitle>
          <DialogDescription>
            Articles you've bookmarked for later reference
          </DialogDescription>
          
          <ScrollArea className="h-[60vh] pr-4">
            {savedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="bg-slate-100 dark:bg-slate-800 h-20 w-20 rounded-full flex items-center justify-center mb-6">
                  <Bookmark className="h-10 w-10 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                  No saved items yet
                </h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm">
                  Bookmark articles to save them for later. Click the bookmark icon on any article card or detail page.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedItems.map((bookmark: any) => {
                  const track = bookmark.track;
                  if (!track) return null;
                  
                  const TypeIcon = track.type === 'video' ? Video : track.type === 'story' ? BookMarked : FileText;
                  
                  return (
                    <div
                      key={bookmark.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer group relative"
                      onClick={() => {
                        handleTrackSelect(track);
                        setShowSavedItems(false);
                      }}
                    >
                      {/* Remove bookmark button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleBookmark(track.id, e);
                          // Remove from local list immediately
                          setSavedItems(prev => prev.filter(b => b.id !== bookmark.id));
                        }}
                        className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove bookmark"
                      >
                        <X className="h-4 w-4 text-slate-400" />
                      </button>

                      <div className="flex items-start gap-4">
                        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-[#F64A05] shrink-0">
                          <TypeIcon size={20} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-slate-900 dark:text-slate-100 line-clamp-2 mb-1">
                            {track.title}
                          </h4>
                          {track.description && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
                              {track.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Eye size={12} /> {track.view_count || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <ThumbsUp size={12} /> {track.likes || 0}
                            </span>
                            <span>•</span>
                            <span>Saved {formatDistanceToNow(new Date(bookmark.created_at), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {savedItems.length > 0 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
              <p className="text-sm text-slate-500">
                {savedItems.length} {savedItems.length === 1 ? 'item' : 'items'} saved
              </p>
              <Button variant="outline" onClick={() => setShowSavedItems(false)}>
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* KB Settings Dialog */}
      <Dialog open={showKBSettings} onOpenChange={setShowKBSettings}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Knowledge Base Settings</DialogTitle>
            <DialogDescription>
              Configure privacy and access settings for your KB articles
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Privacy Section */}
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-1">Article Privacy</h3>
                <p className="text-sm text-muted-foreground">
                  Control how employees access KB articles via QR codes
                </p>
              </div>

              <div className="flex items-start space-x-3 p-4 bg-accent/30 rounded-lg">
                <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm">
                  All KB articles require employee PIN authentication for activity tracking
                </p>
              </div>

              <div className="flex items-center justify-between p-4 border-2 border-border rounded-lg hover:border-primary/50 transition-colors">
                <div>
                  <Label htmlFor="guestAccess" className="font-medium">Allow Guest Access</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    If enabled, viewers can skip PIN and browse as guest (no activity tracking). If disabled, PIN is required.
                  </p>
                </div>
                <Switch
                  id="guestAccess"
                  checked={kbSettings.kb_allow_guest_access}
                  onCheckedChange={handleToggleGuestAccess}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowKBSettings(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white hover:opacity-90 border-0"
              onClick={handleSaveKBSettings}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Brain Chat Modal */}
      <BrainChatDrawer
        isOpen={brainDrawerOpen && !!selectedTrack}
        onOpenChange={setBrainDrawerOpen}
        track={selectedTrack}
        onNavigateToTrack={(id) => {
          // Find the track and select it
          const findAndSelect = async () => {
             const track = await crud.getTracks({ ids: [id] });
             if (track && track.length > 0) {
               setSelectedTrack(track[0]);
             }
          };
          findAndSelect();
        }}
      />

      <Footer />
    </div>
  );
}

// Helper functions
function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}