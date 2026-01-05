import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Alert, AlertDescription } from '../ui/alert';
import { ScrollArea } from '../ui/scroll-area';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Send,
  Building2,
  Store,
  CheckCircle,
  Sparkles,
  Loader2,
  X,
  Globe,
  Users,
  MapPin,
  Briefcase,
  Mail,
  User,
  ArrowRight,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { getServerUrl, publicAnonKey } from '../../utils/supabase/info';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

interface Industry {
  slug: string;
  name: string;
  description?: string;
  default_services: string[];
  icon?: string;
  sort_order: number;
}

interface ServiceDefinition {
  slug: string;
  name: string;
  description?: string;
  compliance_domains: string[];
  requires_license: boolean;
  icon?: string;
  sort_order: number;
}

interface USState {
  code: string;
  name: string;
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
  employee_count?: number;
  description?: string;
  contact_name?: string;
  contact_email?: string;
  contact_role?: string;
}

interface OnboardingChatProps {
  onComplete?: (organization: any) => void;
}

type OnboardingStep =
  | 'website'       // Enter website URL
  | 'scraping'      // Loading state while scraping
  | 'confirm'       // Confirm scraped company info
  | 'industry'      // Select industry
  | 'services'      // Select services offered
  | 'locations'     // Confirm/enter location count & states
  | 'company_size'  // Number of employees
  | 'contact'       // Contact info
  | 'review'        // Final review before creating account
  | 'creating'      // Creating account
  | 'complete';     // Done!

export const OnboardingChat: React.FC<OnboardingChatProps> = ({ onComplete }) => {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [collectedData, setCollectedData] = useState<CollectedData>({});
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Options from database
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [services, setServices] = useState<ServiceDefinition[]>([]);
  const [states, setStates] = useState<USState[]>([]);

  // Current step in the flow
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('website');

  // Form state for each step
  const [selectedIndustry, setSelectedIndustry] = useState<string>('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [locationCount, setLocationCount] = useState<string>('');
  const [employeeCount, setEmployeeCount] = useState<string>('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactRole, setContactRole] = useState('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStep]);

  // Start session and fetch options on mount
  useEffect(() => {
    startSession();
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const response = await fetch(`${getServerUrl()}/onboarding/options`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      const data = await response.json();
      if (data.industries) setIndustries(data.industries);
      if (data.services) setServices(data.services);
      if (data.states) setStates(data.states);
    } catch (err) {
      console.error('Failed to fetch options:', err);
    }
  };

  const startSession = async () => {
    try {
      const response = await fetch(`${getServerUrl()}/onboarding/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          referrer: document.referrer,
          utm_params: Object.fromEntries(new URLSearchParams(window.location.search)),
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSessionToken(data.session_token);
        setMessages([
          {
            role: 'assistant',
            content: "Hi there! I'm here to help you get set up with Trike. Let's start by pulling in your company info.",
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

  const enrichFromWebsite = async (website: string) => {
    if (!sessionToken) return;

    setCurrentStep('scraping');
    setIsLoading(true);
    setError(null);

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: website, timestamp: new Date() },
      { role: 'assistant', content: "Let me look up your company...", timestamp: new Date() },
    ]);

    try {
      const response = await fetch(`${getServerUrl()}/onboarding/enrich-company`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ website, session_token: sessionToken }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        const data = result.data;
        setCollectedData(data);

        // Pre-populate form fields from scraped data
        if (data.industry) {
          setSelectedIndustry(data.industry);
          // Pre-select default services for the industry
          const industry = industries.find(i => i.slug === data.industry);
          if (industry?.default_services) {
            setSelectedServices(data.services || industry.default_services);
          }
        }
        if (data.services) setSelectedServices(data.services);
        if (data.operating_states) setSelectedStates(data.operating_states);
        if (data.store_count) setLocationCount(String(data.store_count));

        // Build response message
        let responseMsg = `I found **${data.company_name}**!`;

        if (data.industry) {
          const industryName = industries.find(i => i.slug === data.industry)?.name || data.industry;
          responseMsg += ` Looks like you're in the ${industryName} industry.`;
        }

        if (data.store_count && data.store_count > 0) {
          responseMsg += ` I found ${data.store_count} store locations.`;
        }

        responseMsg += '\n\nDoes this look right?';

        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: responseMsg, timestamp: new Date() },
        ]);

        setCurrentStep('confirm');
      } else {
        throw new Error(result.error || 'Failed to fetch company info');
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: 'assistant',
          content: "I had trouble looking up that website. Let's enter your company details manually.",
          timestamp: new Date(),
        },
      ]);
      setCurrentStep('industry');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWebsiteSubmit = () => {
    if (!inputValue.trim()) return;

    let url = inputValue.trim();
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    setInputValue('');
    enrichFromWebsite(url);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (currentStep === 'website') {
        handleWebsiteSubmit();
      }
    }
  };

  const handleConfirmCompany = (confirmed: boolean) => {
    if (confirmed) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: "Yes, that's correct!", timestamp: new Date() },
        { role: 'assistant', content: "Let's confirm your industry and services.", timestamp: new Date() },
      ]);
      setCurrentStep('industry');
    } else {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: "That's not quite right.", timestamp: new Date() },
        { role: 'assistant', content: "No problem! Let's enter your details manually.", timestamp: new Date() },
      ]);
      setCurrentStep('industry');
    }
  };

  const handleIndustrySelect = (industrySlug: string) => {
    setSelectedIndustry(industrySlug);
    const industry = industries.find(i => i.slug === industrySlug);
    if (industry?.default_services) {
      // Merge with any existing selections
      const merged = [...new Set([...selectedServices, ...industry.default_services])];
      setSelectedServices(merged);
    }
  };

  const handleServiceToggle = (serviceSlug: string) => {
    setSelectedServices(prev =>
      prev.includes(serviceSlug)
        ? prev.filter(s => s !== serviceSlug)
        : [...prev, serviceSlug]
    );
  };

  const handleStateToggle = (stateCode: string) => {
    setSelectedStates(prev =>
      prev.includes(stateCode)
        ? prev.filter(s => s !== stateCode)
        : [...prev, stateCode]
    );
  };

  const handleNextStep = () => {
    switch (currentStep) {
      case 'industry':
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: "Now let's confirm what services you offer.", timestamp: new Date() },
        ]);
        setCurrentStep('services');
        break;
      case 'services':
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: "Where do you operate?", timestamp: new Date() },
        ]);
        setCurrentStep('locations');
        break;
      case 'locations':
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: "Almost there! How many employees do you have?", timestamp: new Date() },
        ]);
        setCurrentStep('company_size');
        break;
      case 'company_size':
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: "Finally, let's get your contact info to set up your account.", timestamp: new Date() },
        ]);
        setCurrentStep('contact');
        break;
      case 'contact':
        setCurrentStep('review');
        break;
    }
  };

  const handleBackStep = () => {
    switch (currentStep) {
      case 'services':
        setCurrentStep('industry');
        break;
      case 'locations':
        setCurrentStep('services');
        break;
      case 'company_size':
        setCurrentStep('locations');
        break;
      case 'contact':
        setCurrentStep('company_size');
        break;
      case 'review':
        setCurrentStep('contact');
        break;
    }
  };

  const handleCreateAccount = async () => {
    if (!sessionToken) return;

    setCurrentStep('creating');
    setIsLoading(true);
    setError(null);

    // First update the session with all collected data
    const finalData: CollectedData = {
      ...collectedData,
      industry: selectedIndustry,
      services: selectedServices,
      operating_states: selectedStates,
      store_count: locationCount ? parseInt(locationCount) : undefined,
      employee_count: employeeCount ? parseInt(employeeCount) : undefined,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_role: contactRole,
    };

    try {
      // Update session data
      await fetch(`${getServerUrl()}/onboarding/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          session_token: sessionToken,
          data: finalData,
        }),
      });

      // Complete onboarding
      const response = await fetch(`${getServerUrl()}/onboarding/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ session_token: sessionToken, demo_days: 14 }),
      });

      const result = await response.json();

      if (result.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Your account for **${result.organization?.name || collectedData.company_name}** is ready! Your 14-day trial starts now.`,
            timestamp: new Date(),
          },
        ]);
        setCurrentStep('complete');

        if (onComplete) {
          onComplete(result.organization);
        }
      } else {
        throw new Error(result.error || 'Failed to create account');
      }
    } catch (err: any) {
      setError(err.message);
      setCurrentStep('review');
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessageContent = (content: string) => {
    return content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  };

  const getIndustryName = (slug: string) => {
    return industries.find(i => i.slug === slug)?.name || slug;
  };

  const getServiceName = (slug: string) => {
    return services.find(s => s.slug === slug)?.name || slug;
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'industry':
        return !!selectedIndustry;
      case 'services':
        return selectedServices.length > 0;
      case 'locations':
        return selectedStates.length > 0;
      case 'company_size':
        return !!employeeCount;
      case 'contact':
        return !!contactName && !!contactEmail && !!contactRole;
      default:
        return true;
    }
  };

  // Step indicator
  const steps = [
    { key: 'website', label: 'Website' },
    { key: 'industry', label: 'Industry' },
    { key: 'services', label: 'Services' },
    { key: 'locations', label: 'Locations' },
    { key: 'company_size', label: 'Team Size' },
    { key: 'contact', label: 'Contact' },
  ];

  const currentStepIndex = steps.findIndex(s =>
    s.key === currentStep ||
    (currentStep === 'confirm' && s.key === 'website') ||
    (currentStep === 'scraping' && s.key === 'website') ||
    (currentStep === 'review' && s.key === 'contact') ||
    (currentStep === 'creating' && s.key === 'contact') ||
    (currentStep === 'complete' && s.key === 'contact')
  );

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto p-4">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Welcome to Trike
        </h1>
        <p className="text-muted-foreground">
          Let's get your training platform set up in minutes
        </p>
      </div>

      {/* Step Indicator */}
      {currentStep !== 'complete' && (
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-1">
            {steps.map((step, index) => (
              <React.Fragment key={step.key}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                    index < currentStepIndex
                      ? 'bg-primary text-primary-foreground'
                      : index === currentStepIndex
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {index < currentStepIndex ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-8 h-0.5 ${index < currentStepIndex ? 'bg-primary' : 'bg-muted'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 rounded-lg bg-muted/30 p-4 mb-4 min-h-[120px]">
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

          {isLoading && currentStep === 'scraping' && (
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

      {/* Step Content */}
      <div className="space-y-4">
        {/* Website Input */}
        {currentStep === 'website' && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <Label className="text-base font-medium">What's your company website?</Label>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="www.yourcompany.com"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  onClick={handleWebsiteSubmit}
                  disabled={!inputValue.trim() || isLoading}
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                We'll automatically pull in your company info
              </p>
            </CardContent>
          </Card>
        )}

        {/* Confirm Scraped Data */}
        {currentStep === 'confirm' && collectedData.company_name && (
          <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                      {getIndustryName(collectedData.industry)}
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

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleConfirmCompany(false)}
                >
                  <X className="mr-2 h-4 w-4" />
                  Not quite right
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => handleConfirmCompany(true)}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Looks good!
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Industry Selection */}
        {currentStep === 'industry' && (
          <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                What industry are you in?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-2">
                {industries.map((industry) => (
                  <Button
                    key={industry.slug}
                    variant={selectedIndustry === industry.slug ? 'default' : 'outline'}
                    className="justify-start h-auto py-3"
                    onClick={() => handleIndustrySelect(industry.slug)}
                  >
                    <div className="text-left">
                      <div className="font-medium">{industry.name}</div>
                      {industry.description && (
                        <div className="text-xs opacity-70">{industry.description}</div>
                      )}
                    </div>
                  </Button>
                ))}
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={handleBackStep} disabled>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleNextStep} disabled={!canProceed()}>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Services Selection */}
        {currentStep === 'services' && (
          <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Store className="h-5 w-5" />
                What services do you offer?
              </CardTitle>
              <CardDescription>Select all that apply</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {services.map((service) => (
                  <div
                    key={service.slug}
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedServices.includes(service.slug)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => handleServiceToggle(service.slug)}
                  >
                    <Checkbox
                      checked={selectedServices.includes(service.slug)}
                      onCheckedChange={() => handleServiceToggle(service.slug)}
                    />
                    <Label className="cursor-pointer flex-1">{service.name}</Label>
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={handleBackStep}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleNextStep} disabled={!canProceed()}>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Locations & States */}
        {currentStep === 'locations' && (
          <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Where do you operate?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Location count - only show if we didn't find any */}
              {(!collectedData.store_count || collectedData.store_count === 0) && (
                <div className="space-y-2">
                  <Label>How many locations do you have?</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 25"
                    value={locationCount}
                    onChange={(e) => setLocationCount(e.target.value)}
                    min="1"
                  />
                </div>
              )}

              {/* Show found location count */}
              {collectedData.store_count && collectedData.store_count > 0 && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">We found {collectedData.store_count} locations</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="ml-auto h-auto p-0"
                    onClick={() => {
                      setCollectedData(prev => ({ ...prev, store_count: 0 }));
                    }}
                  >
                    Edit
                  </Button>
                </div>
              )}

              {/* States selection */}
              <div className="space-y-2">
                <Label>Select states of operation</Label>
                <ScrollArea className="h-48 rounded-md border p-2">
                  <div className="grid grid-cols-3 gap-1">
                    {states.map((state) => (
                      <div
                        key={state.code}
                        className={`flex items-center gap-1.5 p-1.5 rounded text-sm cursor-pointer transition-colors ${
                          selectedStates.includes(state.code)
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => handleStateToggle(state.code)}
                      >
                        <Checkbox
                          checked={selectedStates.includes(state.code)}
                          onCheckedChange={() => handleStateToggle(state.code)}
                          className={selectedStates.includes(state.code) ? 'border-primary-foreground' : ''}
                        />
                        <span>{state.code}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                {selectedStates.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedStates.length} state{selectedStates.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={handleBackStep}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleNextStep} disabled={!canProceed()}>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Company Size */}
        {currentStep === 'company_size' && (
          <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Number of Active Employees
              </CardTitle>
              <CardDescription>How many people work across all your locations?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="number"
                  placeholder="e.g., 150"
                  value={employeeCount}
                  onChange={(e) => setEmployeeCount(e.target.value)}
                  min="1"
                  className="text-lg h-12"
                />
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={handleBackStep}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleNextStep} disabled={!canProceed()}>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Info */}
        {currentStep === 'contact' && (
          <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Your Contact Information
              </CardTitle>
              <CardDescription>We'll use this to set up your admin account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contact-role">Your Role</Label>
                <Select value={contactRole} onValueChange={setContactRole}>
                  <SelectTrigger id="contact-role">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner / CEO</SelectItem>
                    <SelectItem value="operations">Operations Manager</SelectItem>
                    <SelectItem value="training">Training Manager</SelectItem>
                    <SelectItem value="hr">HR Manager</SelectItem>
                    <SelectItem value="district">District Manager</SelectItem>
                    <SelectItem value="it">IT Manager</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-name">Full Name</Label>
                <Input
                  id="contact-name"
                  placeholder="John Smith"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-email">Work Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  placeholder="john@yourcompany.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={handleBackStep}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleNextStep} disabled={!canProceed()}>
                  Review
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Review & Create */}
        {currentStep === 'review' && (
          <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Review Your Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Company Info */}
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                {collectedData.logo_url ? (
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={collectedData.logo_url} alt={collectedData.company_name} />
                    <AvatarFallback><Building2 className="h-5 w-5" /></AvatarFallback>
                  </Avatar>
                ) : (
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Building2 className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                )}
                <div>
                  <div className="font-semibold">{collectedData.company_name || 'Your Company'}</div>
                  <div className="text-sm text-muted-foreground">{getIndustryName(selectedIndustry)}</div>
                </div>
              </div>

              {/* Summary Grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-2 bg-muted/50 rounded">
                  <div className="text-muted-foreground">Services</div>
                  <div className="font-medium">{selectedServices.length} selected</div>
                </div>
                <div className="p-2 bg-muted/50 rounded">
                  <div className="text-muted-foreground">Locations</div>
                  <div className="font-medium">
                    {collectedData.store_count || locationCount || '—'}
                  </div>
                </div>
                <div className="p-2 bg-muted/50 rounded">
                  <div className="text-muted-foreground">States</div>
                  <div className="font-medium">{selectedStates.length} selected</div>
                </div>
                <div className="p-2 bg-muted/50 rounded">
                  <div className="text-muted-foreground">Employees</div>
                  <div className="font-medium">{employeeCount}</div>
                </div>
              </div>

              {/* Contact */}
              <div className="p-3 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Account Admin</div>
                <div className="font-medium">{contactName}</div>
                <div className="text-sm text-muted-foreground">{contactEmail}</div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={handleBackStep}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  size="lg"
                  onClick={handleCreateAccount}
                  disabled={isLoading}
                  className="gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Create my {collectedData.company_name || ''} account
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Creating State */}
        {currentStep === 'creating' && (
          <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 py-8">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="text-center">
                  <h3 className="font-semibold text-lg">Creating Your Account</h3>
                  <p className="text-muted-foreground">Setting up your training platform...</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Complete State */}
        {currentStep === 'complete' && (
          <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300 border-primary">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-primary" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-xl">Welcome to Trike!</h3>
                  <p className="text-muted-foreground mt-1">
                    Your 14-day trial has started. Check your email for login instructions.
                  </p>
                </div>
                <Button size="lg" className="mt-4">
                  <Mail className="mr-2 h-4 w-4" />
                  Open Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default OnboardingChat;
