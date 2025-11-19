import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { 
  Download, 
  Search, 
  Filter,
  Calendar,
  User,
  FileText,
  ChevronDown,
  Eye,
  Trash2,
  Flag,
  CheckCircle,
  XCircle,
  AlertCircle,
  Star,
  X,
  Clock,
  MoreVertical,
  FileDown,
  ChevronLeft,
  ChevronRight,
  Building
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Separator } from '../ui/separator';
import { ImageWithFallback } from '../figma/ImageWithFallback';

interface Submission {
  id: string;
  formName: string;
  submittedBy: string;
  initials: string;
  unit: string;
  dateSubmitted: string;
  status: 'Complete' | 'Incomplete';
  score?: number;
}

const mockSubmissions: Submission[] = [
  {
    id: 'SUB-001',
    formName: 'Store Daily Walk',
    submittedBy: 'Sarah Johnson',
    initials: 'SJ',
    unit: 'Store A',
    dateSubmitted: '2024-02-15 09:30 AM',
    status: 'Complete',
    score: 95
  },
  {
    id: 'SUB-002',
    formName: 'Days 1-5 OJT Checklist',
    submittedBy: 'Mike Chen',
    initials: 'MC',
    unit: 'Store B',
    dateSubmitted: '2024-02-15 10:15 AM',
    status: 'Complete',
    score: 88
  },
  {
    id: 'SUB-003',
    formName: 'Safety Audit Form',
    submittedBy: 'Alex Rodriguez',
    initials: 'AR',
    unit: 'Store C',
    dateSubmitted: '2024-02-15 11:20 AM',
    status: 'Incomplete'
  },
  {
    id: 'SUB-004',
    formName: 'Store Inspection',
    submittedBy: 'Emily Davis',
    initials: 'ED',
    unit: 'Store A',
    dateSubmitted: '2024-02-14 02:45 PM',
    status: 'Complete',
    score: 92
  },
  {
    id: 'SUB-005',
    formName: 'Night Closing Procedures',
    submittedBy: 'James Wilson',
    initials: 'JW',
    unit: 'Store D',
    dateSubmitted: '2024-02-14 11:30 PM',
    status: 'Complete',
    score: 98
  }
];

interface FormSubmissionsProps {
  currentRole?: 'admin' | 'district-manager' | 'store-manager';
}

export function FormSubmissions({ currentRole = 'admin' }: FormSubmissionsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedForm, setSelectedForm] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedSubmissions, setSelectedSubmissions] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [viewingSubmission, setViewingSubmission] = useState<Submission | null>(null);
  const [showDetailView, setShowDetailView] = useState(false);
  const [flaggedSubmissions, setFlaggedSubmissions] = useState<string[]>([]);
  const [currentSubmissionIndex, setCurrentSubmissionIndex] = useState(0);

  const handleViewSubmission = (submission: Submission) => {
    const index = filteredSubmissions.findIndex(s => s.id === submission.id);
    setCurrentSubmissionIndex(index);
    setViewingSubmission(submission);
    setShowDetailView(true);
  };

  const handleBackToList = () => {
    setShowDetailView(false);
    setViewingSubmission(null);
  };

  const toggleFlag = () => {
    if (!viewingSubmission) return;
    
    setFlaggedSubmissions(prev => 
      prev.includes(viewingSubmission.id)
        ? prev.filter(id => id !== viewingSubmission.id)
        : [...prev, viewingSubmission.id]
    );
  };

  const handlePreviousSubmission = () => {
    if (currentSubmissionIndex > 0) {
      const newIndex = currentSubmissionIndex - 1;
      setCurrentSubmissionIndex(newIndex);
      setViewingSubmission(filteredSubmissions[newIndex]);
    }
  };

  const handleNextSubmission = () => {
    if (currentSubmissionIndex < filteredSubmissions.length - 1) {
      const newIndex = currentSubmissionIndex + 1;
      setCurrentSubmissionIndex(newIndex);
      setViewingSubmission(filteredSubmissions[newIndex]);
    }
  };

  const getFormData = (formName: string) => {
    switch (formName) {
      case 'Store Daily Walk':
        return [
          { question: 'Store entrance clean and welcoming?', type: 'yesno', answer: 'Yes' },
          { question: 'All product displays properly stocked and faced?', type: 'yesno', answer: 'Yes' },
          { question: 'Upload photo of store entrance', type: 'image', answer: 'https://images.unsplash.com/photo-1681120176460-f8fcead4dde0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb252ZW5pZW5jZSUyMHN0b3JlJTIwaW50ZXJpb3IlMjBjbGVhbnxlbnwxfHx8fDE3NjM0OTU2Mjh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral' },
          { question: 'Restroom conditions', type: 'multiple', answer: 'Clean and fully stocked' },
          { question: 'Rate overall store cleanliness (1-5)', type: 'rating', answer: 4 },
          { question: 'Additional observations or concerns', type: 'textarea', answer: 'Store looks excellent overall. Team is keeping up with midday rush very well. Minor scuff marks noticed near entrance - scheduled for cleaning tonight.' },
          { question: 'Cold beverage coolers at proper temperature?', type: 'yesno', answer: 'Yes' },
          { question: 'Time walk completed', type: 'time', answer: '09:30 AM' }
        ];
      
      case 'Days 1-5 OJT Checklist':
        return [
          { question: 'Employee Name', type: 'text', answer: 'Jennifer Martinez' },
          { question: 'Training Start Date', type: 'date', answer: '02/11/2024' },
          { question: 'Skills Covered (select all that apply)', type: 'checkboxes', answer: ['Register Operations', 'Cash Handling', 'Customer Service', 'Store Opening Procedures'] },
          { question: 'Register training completed successfully?', type: 'yesno', answer: 'Yes' },
          { question: 'Rate trainee\'s grasp of POS system (1-5)', type: 'rating', answer: 4 },
          { question: 'Trainer comments and feedback', type: 'textarea', answer: 'Jennifer is doing excellent work and picking up concepts quickly. She handled her first customer transaction with confidence. Ready to move to more advanced topics tomorrow.' },
          { question: 'Trainee demonstrated proper cash handling procedures?', type: 'yesno', answer: 'Yes' },
          { question: 'Areas requiring additional practice', type: 'textarea', answer: 'None at this time. Will monitor lottery ticket sales procedures in coming days.' },
          { question: 'Trainer Signature', type: 'signature', answer: 'https://images.unsplash.com/photo-1676312389476-fe01e238b422?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYW5kd3JpdHRlbiUyMHNpZ25hdHVyZXxlbnwxfHx8fDE3NjM0OTU2Mjl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral' }
        ];
      
      case 'Safety Audit Form':
        return [
          { question: 'Audit Date', type: 'date', answer: '02/15/2024' },
          { question: 'Fire extinguishers inspected and accessible?', type: 'yesno', answer: 'Yes' },
          { question: 'Upload photo of fire safety equipment', type: 'image', answer: 'https://images.unsplash.com/photo-1709229334707-5b5669e5b5da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdG9yZSUyMHNhZmV0eSUyMGVxdWlwbWVudHxlbnwxfHx8fDE3NjM0OTU2Mjl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral' },
          { question: 'Emergency exit signs illuminated?', type: 'yesno', answer: 'Yes' },
          { question: 'First aid kit fully stocked?', type: 'yesno', answer: 'Yes' },
          { question: 'Select all safety concerns observed', type: 'checkboxes', answer: ['None - all clear'] },
          { question: 'Floor condition (select one)', type: 'multiple', answer: 'Clean, dry, no hazards' },
          { question: 'Rate overall safety compliance (1-5)', type: 'rating', answer: 5 },
          { question: 'Safety concerns or corrective actions needed', type: 'textarea', answer: 'No safety concerns identified. All equipment in good working order and properly maintained. Excellent compliance across the board.' }
        ];
      
      case 'Store Inspection':
        return [
          { question: 'Inspection Date', type: 'date', answer: '02/14/2024' },
          { question: 'Product expiration dates checked?', type: 'yesno', answer: 'Yes' },
          { question: 'Upload photo of refrigeration units', type: 'image', answer: 'https://images.unsplash.com/photo-1760463921697-6ab2c0caca20?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZXRhaWwlMjBzdG9yZSUyMHJlZnJpZ2VyYXRvciUyMGRpc3BsYXl8ZW58MXx8fHwxNzYzNDk1NjI5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral' },
          { question: 'Temperature logs up to date?', type: 'yesno', answer: 'Yes' },
          { question: 'Signage and pricing accuracy', type: 'multiple', answer: 'All accurate' },
          { question: 'Rate merchandising presentation (1-5)', type: 'rating', answer: 4 },
          { question: 'Equipment issues (select all that apply)', type: 'checkboxes', answer: ['None'] },
          { question: 'Inspector notes and recommendations', type: 'textarea', answer: 'Store is well-maintained and meets all operational standards. Suggest rotating seasonal merchandise to front displays for better visibility. Minor price tag update needed in beverage aisle - team will address today.' },
          { question: 'Overall store condition', type: 'multiple', answer: 'Excellent' }
        ];
      
      case 'Night Closing Procedures':
        return [
          { question: 'Closing Date', type: 'date', answer: '02/14/2024' },
          { question: 'All registers balanced and closed out?', type: 'yesno', answer: 'Yes' },
          { question: 'Cash drop completed and verified?', type: 'yesno', answer: 'Yes' },
          { question: 'Closing tasks completed (select all)', type: 'checkboxes', answer: ['Floor swept/mopped', 'Trash removed', 'Coolers restocked', 'Doors/windows locked', 'Alarm activated', 'Lights off'] },
          { question: 'Store secured and alarm set?', type: 'yesno', answer: 'Yes' },
          { question: 'Closing Time', type: 'time', answer: '11:30 PM' },
          { question: 'Issues or incidents to report', type: 'textarea', answer: 'None. Clean close tonight. All procedures followed correctly.' },
          { question: 'Rate completion of closing checklist (1-5)', type: 'rating', answer: 5 },
          { question: 'Manager Signature', type: 'signature', answer: 'https://images.unsplash.com/photo-1676312389476-fe01e238b422?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYW5kd3JpdHRlbiUyMHNpZ25hdHVyZXxlbnwxfHx8fDE3NjM0OTU2Mjl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral' }
        ];
      
      default:
        return [
          { question: 'Sample question 1', type: 'text', answer: 'Sample answer' },
          { question: 'Sample question 2', type: 'yesno', answer: 'Yes' }
        ];
    }
  };

  const renderAnswer = (field: any) => {
    switch (field.type) {
      case 'yesno':
        return (
          <Badge className={field.answer === 'Yes' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-0'}>
            {field.answer}
          </Badge>
        );
      
      case 'text':
      case 'date':
      case 'time':
        return <p className="text-sm font-medium">{field.answer}</p>;
      
      case 'textarea':
        return <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">{field.answer}</p>;
      
      case 'rating':
        return (
          <div className="flex items-center space-x-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <div
                key={star}
                className={`h-6 w-6 rounded-full flex items-center justify-center text-sm font-semibold ${
                  star <= field.answer
                    ? 'bg-brand-gradient text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {star}
              </div>
            ))}
          </div>
        );
      
      case 'multiple':
        return (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0">
            {field.answer}
          </Badge>
        );
      
      case 'checkboxes':
        return (
          <div className="flex flex-wrap gap-2">
            {field.answer.map((item: string, idx: number) => (
              <Badge key={idx} variant="outline">
                <CheckCircle className="h-3 w-3 mr-1" />
                {item}
              </Badge>
            ))}
          </div>
        );
      
      case 'image':
        return (
          <div className="mt-2">
            <ImageWithFallback 
              src={field.answer} 
              alt="Submission photo"
              className="rounded-lg border max-w-full h-auto max-h-64 object-cover"
            />
          </div>
        );
      
      case 'signature':
        return (
          <div className="mt-2">
          <div className="border-2 border-dashed rounded-lg p-4 bg-muted/20 inline-block">
            <ImageWithFallback 
              src={field.answer} 
              alt="Signature"
              className="h-16 w-auto grayscale"
            />
          </div>
        </div>
        );
      
      default:
        return <p className="text-sm">{field.answer}</p>;
    }
  };

  const filteredSubmissions = mockSubmissions.filter(submission => {
    const matchesSearch = searchQuery === '' || 
      submission.submittedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submission.formName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submission.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesForm = selectedForm === 'all' || submission.formName === selectedForm;
    const matchesStatus = filterStatus === 'all' || submission.status.toLowerCase() === filterStatus;
    
    return matchesSearch && matchesForm && matchesStatus;
  });

  const toggleSelection = (id: string) => {
    setSelectedSubmissions(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedSubmissions.length === filteredSubmissions.length) {
      setSelectedSubmissions([]);
    } else {
      setSelectedSubmissions(filteredSubmissions.map(s => s.id));
    }
  };

  return (
    <div className="space-y-6">
      {showDetailView && viewingSubmission ? (
        // Full Page Detail View
        <div className="space-y-6">
          {/* Back Button Header */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handleBackToList}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Submissions
            </Button>
            <div className="flex items-center space-x-2">
              <Button 
                variant={flaggedSubmissions.includes(viewingSubmission.id) ? "default" : "outline"}
                onClick={toggleFlag}
                className={flaggedSubmissions.includes(viewingSubmission.id) ? "bg-orange-600 hover:bg-orange-700 text-white" : ""}
              >
                <Flag className={`h-4 w-4 mr-2 ${flaggedSubmissions.includes(viewingSubmission.id) ? "fill-current" : ""}`} />
                {flaggedSubmissions.includes(viewingSubmission.id) ? "Flagged" : "Flag for Review"}
              </Button>
              <Button className="bg-brand-gradient text-white shadow-brand hover:opacity-90">
                <FileDown className="h-4 w-4 mr-2" />
                Export as PDF
              </Button>
            </div>
          </div>

          {/* Submission Header */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">{viewingSubmission.formName}</CardTitle>
                  <p className="text-muted-foreground mt-1">{viewingSubmission.id}</p>
                </div>
                {viewingSubmission.status === 'Complete' ? (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Complete
                  </Badge>
                ) : (
                  <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-0">
                    <Clock className="h-4 w-4 mr-1" />
                    Incomplete
                  </Badge>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* Submission Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Submitted By</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {viewingSubmission.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{viewingSubmission.submittedBy}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Unit/Location</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Building className="h-5 w-5 text-muted-foreground" />
                  <p className="font-medium">{viewingSubmission.unit}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Date Submitted</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <p className="font-medium">{viewingSubmission.dateSubmitted}</p>
                </div>
              </CardContent>
            </Card>

            {viewingSubmission.score && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Overall Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-3xl font-bold text-primary">{viewingSubmission.score}%</div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-brand-gradient h-2 rounded-full transition-all"
                        style={{ width: `${viewingSubmission.score}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Form Responses */}
          <Card>
            <CardHeader>
              <CardTitle>Form Responses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {getFormData(viewingSubmission.formName).map((field, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <Separator />}
                  <div>
                    <p className="font-medium mb-3">{field.question}</p>
                    {renderAnswer(field)}
                  </div>
                </React.Fragment>
              ))}
            </CardContent>
          </Card>

          {/* Navigation Footer */}
          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={handlePreviousSubmission}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous Submission
            </Button>
            <span className="text-sm text-muted-foreground">
              Submission {currentSubmissionIndex + 1} of {filteredSubmissions.length}
            </span>
            <Button variant="outline" onClick={handleNextSubmission}>
              Next Submission
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      ) : (
        // Submissions List View
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Form Submissions</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Review, export, and manage all form submission data
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-brand-gradient text-white shadow-brand hover:opacity-90">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Download className="h-4 w-4 mr-2" />
                  Export All as CSV
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Download className="h-4 w-4 mr-2" />
                  Export Filtered as CSV
                </DropdownMenuItem>
                {selectedSubmissions.length > 0 && (
                  <DropdownMenuItem>
                    <Download className="h-4 w-4 mr-2" />
                    Export Selected ({selectedSubmissions.length})
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Toolbar */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Search */}
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search submissions by ID, form, or employee..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Form Filter */}
                  <Select value={selectedForm} onValueChange={setSelectedForm}>
                    <SelectTrigger className="w-full lg:w-[220px]">
                      <SelectValue placeholder="All Forms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Forms</SelectItem>
                      <SelectItem value="Store Daily Walk">Store Daily Walk</SelectItem>
                      <SelectItem value="Days 1-5 OJT Checklist">Days 1-5 OJT Checklist</SelectItem>
                      <SelectItem value="Safety Audit Form">Safety Audit Form</SelectItem>
                      <SelectItem value="Store Inspection">Store Inspection</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Status Filter */}
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-full lg:w-[160px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="complete">Complete</SelectItem>
                      <SelectItem value="incomplete">Incomplete</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* More Filters Toggle */}
                  <Button
                    variant="outline"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    {showFilters ? 'Hide' : 'More'} Filters
                  </Button>
                </div>

                {/* Advanced Filters */}
                {showFilters && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Unit</label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="All units" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Units</SelectItem>
                            <SelectItem value="store-a">Store A</SelectItem>
                            <SelectItem value="store-b">Store B</SelectItem>
                            <SelectItem value="store-c">Store C</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Date Range</label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Last 30 days" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7">Last 7 days</SelectItem>
                            <SelectItem value="30">Last 30 days</SelectItem>
                            <SelectItem value="90">Last 90 days</SelectItem>
                            <SelectItem value="custom">Custom range</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Score Range</label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="All scores" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Scores</SelectItem>
                            <SelectItem value="90-100">90-100%</SelectItem>
                            <SelectItem value="80-89">80-89%</SelectItem>
                            <SelectItem value="70-79">70-79%</SelectItem>
                            <SelectItem value="below-70">Below 70%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Results Info and Bulk Actions */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filteredSubmissions.length} {filteredSubmissions.length === 1 ? 'submission' : 'submissions'}
              {selectedSubmissions.length > 0 && ` (${selectedSubmissions.length} selected)`}
            </p>

            {selectedSubmissions.length > 0 && (
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm">
                  <Download className="h-3 w-3 mr-2" />
                  Download PDFs
                </Button>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                  <Trash2 className="h-3 w-3 mr-2" />
                  Delete Selected
                </Button>
              </div>
            )}
          </div>

          {/* Submissions Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedSubmissions.length === filteredSubmissions.length && filteredSubmissions.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Submission ID</TableHead>
                  <TableHead>Form Name</TableHead>
                  <TableHead>Submitted By</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Date Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubmissions.map((submission) => (
                  <TableRow 
                    key={submission.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleViewSubmission(submission)}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedSubmissions.includes(submission.id)}
                        onCheckedChange={() => toggleSelection(submission.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{submission.id}</TableCell>
                    <TableCell>{submission.formName}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                            {submission.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span>{submission.submittedBy}</span>
                      </div>
                    </TableCell>
                    <TableCell>{submission.unit}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{submission.dateSubmitted}</TableCell>
                    <TableCell>
                      {submission.status === 'Complete' ? (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Complete
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-0">
                          <Clock className="h-3 w-3 mr-1" />
                          Incomplete
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {submission.score ? (
                        <span className="font-semibold">{submission.score}%</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewSubmission(submission)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <FileDown className="h-4 w-4 mr-2" />
                            Download PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Flag className="h-4 w-4 mr-2" />
                            Flag for Review
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}