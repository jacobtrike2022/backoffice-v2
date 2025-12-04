import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Checkbox } from './ui/checkbox';
import {
  Search,
  User,
  Calendar,
  Briefcase,
  MapPin,
  Download,
  Share2,
  CheckCircle2,
  Clock,
  FileText,
  Award,
  AlertCircle,
  Eye,
  ChevronRight,
  Play,
  FileSignature,
  ShieldCheck,
  Building2,
  Mail,
  Phone,
  Users
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Progress } from './ui/progress';

interface ComplianceAuditProps {
  currentRole?: 'admin' | 'district-manager' | 'store-manager';
}

// Mock learner data
const mockLearners = [
  {
    id: '1',
    name: 'Jason Martinez',
    email: 'jason.martinez@trike.com',
    role: 'Customer Service Representative',
    department: 'Front of House',
    hireDate: '2024-08-15',
    location: 'Store #4523 - Downtown',
    manager: 'Sarah Johnson',
    employeeId: 'EMP-4523-102'
  },
  {
    id: '2',
    name: 'Emily Chen',
    email: 'emily.chen@trike.com',
    role: 'Store Manager',
    department: 'Management',
    hireDate: '2022-03-10',
    location: 'Store #4523 - Downtown',
    manager: 'Michael Rodriguez (District Manager)',
    employeeId: 'EMP-4523-001'
  }
];

// Mock tracks related to alcohol sales
const mockTracks = [
  {
    id: 'track-1',
    title: 'Responsible Alcohol Sales - Legal Requirements',
    album: 'Alcohol Safety Certification',
    type: 'Video',
    duration: '18 min',
    category: 'Compliance'
  },
  {
    id: 'track-2',
    title: 'Age Verification & ID Checking Procedures',
    album: 'Alcohol Safety Certification',
    type: 'Interactive',
    duration: '12 min',
    category: 'Compliance'
  },
  {
    id: 'track-3',
    title: 'Signs of Intoxication & Refusal Protocols',
    album: 'Alcohol Safety Certification',
    type: 'Video + Quiz',
    duration: '22 min',
    category: 'Compliance'
  },
  {
    id: 'track-4',
    title: 'Point of Sale System Basics',
    album: 'POS Training',
    type: 'Interactive',
    duration: '15 min',
    category: 'Operations'
  },
  {
    id: 'track-5',
    title: 'Customer Service Excellence',
    album: 'Customer Service Fundamentals',
    type: 'Article',
    duration: '8 min',
    category: 'Customer Service'
  }
];

export function ComplianceAudit({ currentRole = 'admin' }: ComplianceAuditProps) {
  const [selectedLearner, setSelectedLearner] = useState<typeof mockLearners[0] | null>(null);
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLearners = mockLearners.filter(learner =>
    learner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    learner.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    learner.employeeId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleTrack = (trackId: string) => {
    if (selectedTracks.includes(trackId)) {
      setSelectedTracks(selectedTracks.filter(id => id !== trackId));
    } else {
      setSelectedTracks([...selectedTracks, trackId]);
    }
  };

  const handleGenerateReport = () => {
    if (selectedLearner && selectedTracks.length > 0) {
      setShowReport(true);
    }
  };

  const handleReset = () => {
    setSelectedLearner(null);
    setSelectedTracks([]);
    setShowReport(false);
    setSearchQuery('');
  };

  // Report view
  if (showReport && selectedLearner) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground mb-2">Compliance Audit Report</h1>
            <p className="text-muted-foreground">
              Detailed learning documentation for legal and compliance purposes
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={handleReset}>
              <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
              Back to Selection
            </Button>
            <Button variant="outline">
              <Share2 className="h-4 w-4 mr-2" />
              Share Link
            </Button>
            <Button className="bg-brand-gradient">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Report Header */}
        <Card className="border-2 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-start space-x-4">
                <div className="h-16 w-16 rounded-full bg-brand-gradient flex items-center justify-center flex-shrink-0">
                  <User className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-1">{selectedLearner.name}</h2>
                  <p className="text-sm text-muted-foreground mb-3">{selectedLearner.role}</p>
                  <div className="flex items-center space-x-2">
                    <Badge className="bg-green-100 text-green-700 border-green-200">Active Employee</Badge>
                    <Badge variant="outline">ID: {selectedLearner.employeeId}</Badge>
                  </div>
                </div>
              </div>
              <div className="text-right text-sm">
                <p className="text-muted-foreground">Report Generated</p>
                <p className="font-semibold">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                <p className="text-xs text-muted-foreground mt-1">at {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Employee Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="flex items-center space-x-2 text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4" />
                  <p className="text-xs">Hire Date</p>
                </div>
                <p className="font-semibold">{new Date(selectedLearner.hireDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                <p className="text-xs text-muted-foreground">
                  {Math.floor((new Date().getTime() - new Date(selectedLearner.hireDate).getTime()) / (1000 * 60 * 60 * 24))} days tenure
                </p>
              </div>
              <div>
                <div className="flex items-center space-x-2 text-muted-foreground mb-1">
                  <Briefcase className="h-4 w-4" />
                  <p className="text-xs">Department</p>
                </div>
                <p className="font-semibold">{selectedLearner.department}</p>
              </div>
              <div>
                <div className="flex items-center space-x-2 text-muted-foreground mb-1">
                  <MapPin className="h-4 w-4" />
                  <p className="text-xs">Location</p>
                </div>
                <p className="font-semibold">{selectedLearner.location}</p>
              </div>
              <div>
                <div className="flex items-center space-x-2 text-muted-foreground mb-1">
                  <Users className="h-4 w-4" />
                  <p className="text-xs">Direct Manager</p>
                </div>
                <p className="font-semibold">{selectedLearner.manager}</p>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex items-center space-x-2 text-muted-foreground mb-1">
                  <Mail className="h-4 w-4" />
                  <p className="text-xs">Email</p>
                </div>
                <p className="font-semibold">{selectedLearner.email}</p>
              </div>
              <div>
                <div className="flex items-center space-x-2 text-muted-foreground mb-1">
                  <Building2 className="h-4 w-4" />
                  <p className="text-xs">Company</p>
                </div>
                <p className="font-semibold">Trike Retail Corp.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Training Completion Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ShieldCheck className="h-5 w-5 mr-2 text-primary" />
              Training Completion Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-900/30">
                <p className="text-sm text-muted-foreground mb-1">Tracks Completed</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">3 / 3</p>
                <Progress value={100} className="h-2 mt-2" />
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-900/30">
                <p className="text-sm text-muted-foreground mb-1">Total Learning Time</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">52 min</p>
                <p className="text-xs text-muted-foreground mt-1">Across selected content</p>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-900/30">
                <p className="text-sm text-muted-foreground mb-1">Average Score</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">94%</p>
                <p className="text-xs text-muted-foreground mt-1">On assessments</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Track Reports */}
        <div className="space-y-6">
          {/* Track 1: Legal Requirements */}
          <Card className="border-2">
            <CardHeader className="bg-accent/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-lg bg-brand-gradient flex items-center justify-center">
                    <Play className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Track 1: Responsible Alcohol Sales - Legal Requirements</CardTitle>
                    <p className="text-sm text-muted-foreground">Album: Alcohol Safety Certification • Video • 18 min</p>
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-700 border-green-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Completed
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Activity Timeline */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center">
                  <Clock className="h-4 w-4 mr-2 text-primary" />
                  {selectedLearner.name} Activity Timeline
                </h3>
                <p className="text-xs text-muted-foreground text-center mb-2 uppercase tracking-wide">Session Started: Sep 12, 2024 at 2:26 PM</p>
                <div className="space-y-2 ml-6 border-l-2 border-border pl-4">
                  <div className="pb-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <p className="text-sm font-medium">Track Completed</p>
                      <span className="text-xs text-muted-foreground">Sep 12, 2024 at 2:47 PM</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Jason completed all content and passed checkpoint assessment</p>
                  </div>
                  <div className="pb-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <p className="text-sm font-medium">Checkpoint Assessment Submitted</p>
                      <span className="text-xs text-muted-foreground">Sep 12, 2024 at 2:45 PM</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Score: 95% (19/20 questions correct) • Passing threshold: 80%</p>
                  </div>
                  <div className="pb-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <p className="text-sm font-medium">Video Watched</p>
                      <span className="text-xs text-muted-foreground">Sep 12, 2024 at 2:27 PM</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Watched 18:32 of 18:32 (100%) • Replay count: 0</p>
                  </div>
                  <div className="pb-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="h-2 w-2 rounded-full bg-gray-400" />
                      <p className="text-sm font-medium">Track Opened</p>
                      <span className="text-xs text-muted-foreground">Sep 12, 2024 at 2:26 PM</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Initial access from Desktop (Chrome)</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2 uppercase tracking-wide">Session Ended: Sep 12, 2024 at 2:47 PM</p>
              </div>

              <Separator />

              {/* Learning Objectives */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center">
                  <FileText className="h-4 w-4 mr-2 text-primary" />
                  Content Key Facts
                </h3>
                <div className="bg-accent/30 p-4 rounded-lg space-y-2">
                  <div className="flex items-start space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Understand federal, state, and local laws governing alcohol sales</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Identify legal age requirements and acceptable forms of identification</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Recognize legal penalties for non-compliance with alcohol sales regulations</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Apply company policies for responsible alcohol sales</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Video Transcript */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center">
                  <FileText className="h-4 w-4 mr-2 text-primary" />
                  Video Content Transcript
                </h3>
                <div className="bg-muted/50 p-4 rounded-lg max-h-60 overflow-y-auto text-sm space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">[00:00 - 00:42]</p>
                    <p className="text-sm">Welcome to Responsible Alcohol Sales Training. This course covers the critical legal requirements you must understand as a team member authorized to sell alcohol products. Compliance with these regulations protects you, our company, and our customers.</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">[00:43 - 01:28]</p>
                    <p className="text-sm">Federal law prohibits the sale of alcohol to anyone under 21 years of age. The National Minimum Drinking Age Act of 1984 established this standard nationwide. Individual states may have additional restrictions, and some localities impose further requirements.</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">[01:29 - 02:15]</p>
                    <p className="text-sm">In our operating regions, you must check valid government-issued photo identification for any customer who appears to be under 40 years of age. Acceptable forms include driver's licenses, state ID cards, military IDs, and passports.</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">[02:16 - 03:45]</p>
                    <p className="text-sm">Legal penalties for selling alcohol to minors are severe. You personally can face criminal charges, fines up to $10,000, and potential jail time. Our company can lose its liquor license, face civil liability, and incur substantial financial penalties. These consequences underscore why compliance is non-negotiable.</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">[03:46 - End]</p>
                    <p className="text-sm">Our company policy is strict: when in doubt, check ID. If you have any concern about a customer's age or the validity of their identification, politely decline the sale and immediately notify your manager. Remember, it's always better to refuse a sale than to risk legal consequences.</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Checkpoint Results */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center">
                  <Award className="h-4 w-4 mr-2 text-primary" />
                  Checkpoint Assessment Results
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-900/30">
                    <div>
                      <p className="font-medium text-green-900 dark:text-green-100">Assessment Score: 95%</p>
                      <p className="text-sm text-muted-foreground">19 out of 20 questions correct</p>
                    </div>
                    <Badge className="bg-green-100 text-green-700 border-green-200">Passed</Badge>
                  </div>
                  
                  <div className="bg-accent/30 p-4 rounded-lg space-y-3 text-sm">
                    <div>
                      <p className="font-medium mb-1">Question 1: What is the minimum legal drinking age in the United States?</p>
                      <p className="text-muted-foreground mb-1">Answer: 21 years old ✓ Correct</p>
                    </div>
                    <Separator />
                    <div>
                      <p className="font-medium mb-1">Question 5: Which forms of ID are acceptable for age verification?</p>
                      <p className="text-muted-foreground mb-1">Answer: Valid driver's license, state ID, military ID, or passport ✓ Correct</p>
                    </div>
                    <Separator />
                    <div>
                      <p className="font-medium mb-1">Question 12: What is the maximum fine for selling alcohol to a minor?</p>
                      <p className="text-muted-foreground mb-1">Answer: Up to $10,000 ✓ Correct</p>
                    </div>
                    <Separator />
                    <div>
                      <p className="font-medium mb-1">Question 18: When should you check ID according to company policy?</p>
                      <p className="text-muted-foreground mb-1">Answer: For any customer appearing under 40 years of age ✓ Correct</p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Electronic Acknowledgement */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center">
                  <FileSignature className="h-4 w-4 mr-2 text-primary" />
                  Electronic Acknowledgement
                </h3>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900/30">
                  <div className="flex items-start space-x-3 mb-3">
                    <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-blue-900 dark:text-blue-100 mb-2">Learner Acknowledgement Signed</p>
                      <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                        "I acknowledge that I have completed the Responsible Alcohol Sales - Legal Requirements training. I understand the federal, state, and local laws governing alcohol sales, and I agree to comply with all policies and procedures related to age verification and responsible alcohol sales. I understand the legal consequences of non-compliance."
                      </p>
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <p className="text-muted-foreground">Digital Signature:</p>
                          <p className="font-semibold">Jason Martinez</p>
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground">Date & Time:</p>
                          <p className="font-semibold">Sep 12, 2024 at 2:47 PM PST</p>
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground">IP Address:</p>
                          <p className="font-semibold">192.168.1.45</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Track 2: Age Verification */}
          <Card className="border-2">
            <CardHeader className="bg-accent/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-lg bg-brand-gradient flex items-center justify-center">
                    <Play className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Track 2: Age Verification & ID Checking Procedures</CardTitle>
                    <p className="text-sm text-muted-foreground">Album: Alcohol Safety Certification • Interactive • 12 min</p>
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-700 border-green-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Completed
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Activity Timeline */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center">
                  <Clock className="h-4 w-4 mr-2 text-primary" />
                  {selectedLearner.name} Activity Timeline
                </h3>
                <p className="text-xs text-muted-foreground text-center mb-2 uppercase tracking-wide">Session Started: Sep 12, 2024 at 3:02 PM</p>
                <div className="space-y-2 ml-6 border-l-2 border-border pl-4">
                  <div className="pb-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <p className="text-sm font-medium">Track Completed</p>
                      <span className="text-xs text-muted-foreground">Sep 12, 2024 at 3:15 PM</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Jason completed all interactive scenarios</p>
                  </div>
                  <div className="pb-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <p className="text-sm font-medium">Interactive Scenario 3 Completed</p>
                      <span className="text-xs text-muted-foreground">Sep 12, 2024 at 3:12 PM</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Scenario: Expired ID • Correct response: Decline sale</p>
                  </div>
                  <div className="pb-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <p className="text-sm font-medium">Interactive Scenario 2 Completed</p>
                      <span className="text-xs text-muted-foreground">Sep 12, 2024 at 3:08 PM</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Scenario: Suspicious ID features • Correct response: Request manager verification</p>
                  </div>
                  <div className="pb-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <p className="text-sm font-medium">Interactive Scenario 1 Completed</p>
                      <span className="text-xs text-muted-foreground">Sep 12, 2024 at 3:04 PM</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Scenario: Valid driver's license • Correct response: Accept and complete sale</p>
                  </div>
                  <div className="pb-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="h-2 w-2 rounded-full bg-gray-400" />
                      <p className="text-sm font-medium">Track Opened</p>
                      <span className="text-xs text-muted-foreground">Sep 12, 2024 at 3:02 PM</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2 uppercase tracking-wide">Session Ended: Sep 12, 2024 at 3:15 PM</p>
              </div>

              <Separator />

              {/* Learning Objectives */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center">
                  <FileText className="h-4 w-4 mr-2 text-primary" />
                  Content Key Facts
                </h3>
                <div className="bg-accent/30 p-4 rounded-lg space-y-2">
                  <div className="flex items-start space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Properly identify valid government-issued photo identification</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Recognize common security features on driver's licenses and state IDs</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Identify signs of fake or altered identification</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Apply proper procedures when ID validity is questionable</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Interactive Scenario Results */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center">
                  <Award className="h-4 w-4 mr-2 text-primary" />
                  Interactive Scenario Performance
                </h3>
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-900/30">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-green-900 dark:text-green-100">Scenario 1: Valid Driver's License</p>
                      <Badge className="bg-green-100 text-green-700 border-green-200">Correct</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Customer presents valid driver's license, DOB shows age 24</p>
                    <p className="text-sm font-medium mt-2">Response: Accept ID and complete sale ✓</p>
                  </div>

                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-900/30">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-green-900 dark:text-green-100">Scenario 2: Suspicious ID Features</p>
                      <Badge className="bg-green-100 text-green-700 border-green-200">Correct</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Customer presents ID with peeling lamination and mismatched photo quality</p>
                    <p className="text-sm font-medium mt-2">Response: Politely request manager verification ✓</p>
                  </div>

                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-900/30">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-green-900 dark:text-green-100">Scenario 3: Expired Identification</p>
                      <Badge className="bg-green-100 text-green-700 border-green-200">Correct</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Customer presents driver's license expired 6 months ago</p>
                    <p className="text-sm font-medium mt-2">Response: Politely decline the sale, explain policy ✓</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Electronic Acknowledgement */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center">
                  <FileSignature className="h-4 w-4 mr-2 text-primary" />
                  Electronic Acknowledgement
                </h3>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900/30">
                  <div className="flex items-start space-x-3">
                    <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-blue-900 dark:text-blue-100 mb-2">Learner Acknowledgement Signed</p>
                      <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                        "I acknowledge that I have completed the Age Verification & ID Checking Procedures training. I can identify valid government-issued IDs, recognize security features and signs of alteration, and know when to decline a sale or request manager assistance."
                      </p>
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <p className="text-muted-foreground">Digital Signature:</p>
                          <p className="font-semibold">Jason Martinez</p>
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground">Date & Time:</p>
                          <p className="font-semibold">Sep 12, 2024 at 3:15 PM PST</p>
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground">IP Address:</p>
                          <p className="font-semibold">192.168.1.45</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Track 3: Signs of Intoxication */}
          <Card className="border-2">
            <CardHeader className="bg-accent/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-lg bg-brand-gradient flex items-center justify-center">
                    <Play className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Track 3: Signs of Intoxication & Refusal Protocols</CardTitle>
                    <p className="text-sm text-muted-foreground">Album: Alcohol Safety Certification • Video + Quiz • 22 min</p>
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-700 border-green-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Completed
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Activity Timeline */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center">
                  <Clock className="h-4 w-4 mr-2 text-primary" />
                  {selectedLearner.name} Activity Timeline
                </h3>
                <p className="text-xs text-muted-foreground text-center mb-2 uppercase tracking-wide">Session Started: Sep 12, 2024 at 3:24 PM</p>
                <div className="space-y-2 ml-6 border-l-2 border-border pl-4">
                  <div className="pb-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <p className="text-sm font-medium">Track Completed</p>
                      <span className="text-xs text-muted-foreground">Sep 12, 2024 at 3:48 PM</span>
                    </div>
                  </div>
                  <div className="pb-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <p className="text-sm font-medium">Checkpoint Quiz Passed</p>
                      <span className="text-xs text-muted-foreground">Sep 12, 2024 at 3:47 PM</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Score: 92% (23/25 questions) • Passing: 80%</p>
                  </div>
                  <div className="pb-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <p className="text-sm font-medium">Video Watched</p>
                      <span className="text-xs text-muted-foreground">Sep 12, 2024 at 3:25 PM</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Watched 22:14 of 22:14 (100%)</p>
                  </div>
                  <div className="pb-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="h-2 w-2 rounded-full bg-gray-400" />
                      <p className="text-sm font-medium">Track Opened</p>
                      <span className="text-xs text-muted-foreground">Sep 12, 2024 at 3:24 PM</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2 uppercase tracking-wide">Session Ended: Sep 12, 2024 at 3:48 PM</p>
              </div>

              <Separator />

              {/* Learning Objectives */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center">
                  <FileText className="h-4 w-4 mr-2 text-primary" />
                  Content Key Facts
                </h3>
                <div className="bg-accent/30 p-4 rounded-lg space-y-2">
                  <div className="flex items-start space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Identify physical and behavioral signs of intoxication</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Apply proper protocols for refusing alcohol sales to intoxicated individuals</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Communicate refusals professionally while de-escalating potential conflicts</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Document incidents according to company policy</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Quiz Results */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center">
                  <Award className="h-4 w-4 mr-2 text-primary" />
                  Assessment Results
                </h3>
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-900/30 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-green-900 dark:text-green-100">Final Score: 92%</p>
                      <p className="text-sm text-muted-foreground">23 out of 25 questions correct</p>
                    </div>
                    <Badge className="bg-green-100 text-green-700 border-green-200">Passed</Badge>
                  </div>
                </div>

                <div className="bg-accent/30 p-4 rounded-lg space-y-3 text-sm">
                  <p className="font-medium mb-2">Sample Questions & Responses:</p>
                  <div>
                    <p className="font-medium mb-1">Q: Which of the following are signs of intoxication?</p>
                    <p className="text-muted-foreground">Answer: Slurred speech, bloodshot eyes, impaired coordination, loud or aggressive behavior ✓ Correct</p>
                  </div>
                  <Separator />
                  <div>
                    <p className="font-medium mb-1">Q: What should you do if a customer becomes hostile when you refuse service?</p>
                    <p className="text-muted-foreground">Answer: Remain calm, avoid arguing, immediately notify manager for assistance ✓ Correct</p>
                  </div>
                  <Separator />
                  <div>
                    <p className="font-medium mb-1">Q: Are you legally required to serve alcohol to every customer who requests it?</p>
                    <p className="text-muted-foreground">Answer: No, I have the right and responsibility to refuse service to intoxicated individuals ✓ Correct</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Manager Sign-off / OJT Verification */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center">
                  <Users className="h-4 w-4 mr-2 text-primary" />
                  Manager OJT Verification
                </h3>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-900/30">
                  <div className="flex items-start space-x-3 mb-4">
                    <CheckCircle2 className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-purple-900 dark:text-purple-100 mb-2">On-the-Job Training Verification Completed</p>
                      <p className="text-sm text-purple-800 dark:text-purple-200 mb-3">
                        Manager observed and verified Jason's ability to recognize signs of intoxication and properly refuse alcohol sales in a real store environment.
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 p-3 rounded border">
                    <p className="text-sm font-medium mb-2">Verified Skills:</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>Correctly identified intoxication signs in role-play scenario</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>Demonstrated professional refusal communication</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>Properly documented incident on refusal log</span>
                      </div>
                    </div>
                  </div>

                  <Separator className="my-3" />

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-muted-foreground">Verified By:</p>
                      <p className="font-semibold">Sarah Johnson, Store Manager</p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground">Date & Time:</p>
                      <p className="font-semibold">Sep 13, 2024 at 10:15 AM PST</p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Electronic Acknowledgement */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center">
                  <FileSignature className="h-4 w-4 mr-2 text-primary" />
                  Electronic Acknowledgement
                </h3>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900/30">
                  <div className="flex items-start space-x-3">
                    <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-blue-900 dark:text-blue-100 mb-2">Learner Acknowledgement Signed</p>
                      <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                        "I acknowledge that I have completed the Signs of Intoxication & Refusal Protocols training. I understand how to identify intoxicated customers, refuse sales professionally, and document incidents. I commit to upholding these standards in my daily work."
                      </p>
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <p className="text-muted-foreground">Digital Signature:</p>
                          <p className="font-semibold">Jason Martinez</p>
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground">Date & Time:</p>
                          <p className="font-semibold">Sep 12, 2024 at 3:48 PM PST</p>
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground">IP Address:</p>
                          <p className="font-semibold">192.168.1.45</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Report Footer */}
        <Card className="border-2 border-primary/20">
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                This compliance audit report was generated on {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} for legal and compliance documentation purposes.
              </p>
              <p className="text-xs text-muted-foreground">
                Report ID: AUD-{selectedLearner.employeeId}-{Date.now()} • Generated by Trike Backoffice LMS • All timestamps in Pacific Standard Time
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Selection interface
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-foreground mb-2">Generate Compliance Audit</h1>
        <p className="text-muted-foreground">
          Create detailed learning documentation for legal, compliance, or HR purposes
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Learner Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="h-5 w-5 mr-2 text-primary" />
              Step 1: Select Learner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or employee ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredLearners.map((learner) => (
                <div
                  key={learner.id}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedLearner?.id === learner.id
                      ? 'border-primary bg-orange-50 dark:bg-orange-900/20'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedLearner(learner)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="h-10 w-10 rounded-full bg-brand-gradient flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold">{learner.name}</p>
                        <p className="text-sm text-muted-foreground">{learner.role}</p>
                        <p className="text-xs text-muted-foreground mt-1">{learner.email}</p>
                      </div>
                    </div>
                    {selectedLearner?.id === learner.id && (
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    )}
                  </div>
                  <Separator className="my-2" />
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Employee ID</p>
                      <p className="font-medium">{learner.employeeId}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Location</p>
                      <p className="font-medium">{learner.location}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedLearner && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-900/30">
                <p className="text-sm text-green-800 dark:text-green-200 flex items-center">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Selected: {selectedLearner.name}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Track Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2 text-primary" />
              Step 2: Select Training Content
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select one or more tracks to include in the compliance report
            </p>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {mockTracks.map((track) => (
                <div
                  key={track.id}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedTracks.includes(track.id)
                      ? 'border-primary bg-orange-50 dark:bg-orange-900/20'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => toggleTrack(track.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        checked={selectedTracks.includes(track.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{track.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {track.album} • {track.type} • {track.duration}
                        </p>
                        <Badge variant="outline" className="mt-2 text-xs">
                          {track.category}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedTracks.length > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-900/30">
                <p className="text-sm text-blue-800 dark:text-blue-200 flex items-center">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {selectedTracks.length} {selectedTracks.length === 1 ? 'track' : 'tracks'} selected
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Generate Button */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold mb-1">Ready to Generate Report</p>
              <p className="text-sm text-muted-foreground">
                {selectedLearner && selectedTracks.length > 0
                  ? `Generate compliance audit for ${selectedLearner.name} covering ${selectedTracks.length} training ${selectedTracks.length === 1 ? 'track' : 'tracks'}`
                  : 'Please select a learner and at least one track to continue'}
              </p>
            </div>
            <Button
              className="bg-brand-gradient"
              disabled={!selectedLearner || selectedTracks.length === 0}
              onClick={handleGenerateReport}
            >
              <FileText className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100 mb-2">About Compliance Audits</p>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Compliance audit reports provide granular documentation of learner activity, content objectives, transcripts, assessments, and electronic acknowledgements. These reports are designed for legal proceedings, government compliance requirements, or HR documentation for performance management and termination procedures.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
