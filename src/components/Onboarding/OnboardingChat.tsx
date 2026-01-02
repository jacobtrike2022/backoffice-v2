import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Chip,
  Avatar,
  Fade,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Alert,
} from '@mui/material';
import {
  Send as SendIcon,
  Business as BusinessIcon,
  Store as StoreIcon,
  CheckCircle as CheckCircleIcon,
  AutoAwesome as SparkleIcon,
} from '@mui/icons-material';
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

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        maxWidth: 800,
        mx: 'auto',
        p: 2,
      }}
    >
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Welcome to Trike
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Let's get your training platform set up in minutes
        </Typography>
      </Box>

      {/* Messages */}
      <Paper
        elevation={0}
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          bgcolor: 'grey.50',
          borderRadius: 2,
          mb: 2,
        }}
      >
        {messages.map((msg, index) => (
          <Fade in key={index}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                mb: 2,
              }}
            >
              {msg.role === 'assistant' && (
                <Avatar
                  sx={{
                    bgcolor: 'primary.main',
                    width: 36,
                    height: 36,
                    mr: 1,
                  }}
                >
                  <SparkleIcon fontSize="small" />
                </Avatar>
              )}
              <Paper
                elevation={1}
                sx={{
                  p: 2,
                  maxWidth: '80%',
                  bgcolor: msg.role === 'user' ? 'primary.main' : 'white',
                  color: msg.role === 'user' ? 'white' : 'text.primary',
                  borderRadius: 2,
                }}
              >
                <Typography
                  variant="body1"
                  sx={{ whiteSpace: 'pre-wrap' }}
                  dangerouslySetInnerHTML={{
                    __html: msg.content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'),
                  }}
                />
              </Paper>
            </Box>
          </Fade>
        ))}

        {isLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
              <SparkleIcon fontSize="small" />
            </Avatar>
            <CircularProgress size={20} />
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Paper>

      {/* Company Card (when data is collected) */}
      {showConfirmation && collectedData.company_name && (
        <Fade in>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                {collectedData.logo_url ? (
                  <Avatar src={collectedData.logo_url} sx={{ width: 48, height: 48 }} />
                ) : (
                  <Avatar sx={{ width: 48, height: 48, bgcolor: 'primary.main' }}>
                    <BusinessIcon />
                  </Avatar>
                )}
                <Box>
                  <Typography variant="h6">{collectedData.company_name}</Typography>
                  {collectedData.industry && (
                    <Typography variant="body2" color="text.secondary">
                      {formatIndustry(collectedData.industry)}
                    </Typography>
                  )}
                </Box>
                {collectedData.store_count && collectedData.store_count > 0 && (
                  <Chip
                    icon={<StoreIcon />}
                    label={`${collectedData.store_count} locations`}
                    size="small"
                    sx={{ ml: 'auto' }}
                  />
                )}
              </Box>

              {collectedData.services && collectedData.services.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Services
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {collectedData.services.map((service) => (
                      <Chip key={service} label={formatService(service)} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Box>
              )}

              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={handleCreateDemo}
                disabled={isLoading}
                startIcon={isLoading ? <CircularProgress size={20} /> : <CheckCircleIcon />}
              >
                {isLoading ? 'Creating your account...' : 'Looks good! Create my demo'}
              </Button>
            </CardContent>
          </Card>
        </Fade>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Input */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Type your message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isLoading}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 3,
            },
          }}
        />
        <Button
          variant="contained"
          onClick={sendMessage}
          disabled={!inputValue.trim() || isLoading}
          sx={{ borderRadius: 3, minWidth: 56 }}
        >
          <SendIcon />
        </Button>
      </Box>
    </Box>
  );
};

export default OnboardingChat;
