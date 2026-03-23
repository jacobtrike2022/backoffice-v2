import React, { useState, useEffect } from 'react';
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
  Users,
  Loader2
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Progress } from './ui/progress';
import {
  getAuditLearners,
  getAuditTracks,
  getAuditTrackCompletions,
  type AuditLearner,
  type AuditTrack,
  type TrackCompletionDetail
} from '../lib/crud/compliance';

interface ComplianceAuditProps {
  currentRole?: 'admin' | 'district-manager' | 'store-manager';
}

export function ComplianceAudit({ currentRole = 'admin' }: ComplianceAuditProps) {
  const [learners, setLearners] = useState<AuditLearner[]>([]);
  const [tracks, setTracks] = useState<AuditTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedLearner, setSelectedLearner] = useState<AuditLearner | null>(null);
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [trackSearchQuery, setTrackSearchQuery] = useState('');

  // Report data
  const [trackCompletions, setTrackCompletions] = useState<TrackCompletionDetail[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);

  // Fetch learners and tracks on mount
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [learnersData, tracksData] = await Promise.all([
          getAuditLearners(),
          getAuditTracks()
        ]);
        setLearners(learnersData);
        setTracks(tracksData);
      } catch (err: any) {
        console.error('Error fetching audit data:', err);
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Filter learners based on search
  const filteredLearners = learners.filter(learner =>
    learner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    learner.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    learner.employeeId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter tracks based on search
  const filteredTracks = tracks.filter(track =>
    track.title.toLowerCase().includes(trackSearchQuery.toLowerCase()) ||
    track.album.toLowerCase().includes(trackSearchQuery.toLowerCase()) ||
    track.category.toLowerCase().includes(trackSearchQuery.toLowerCase())
  );

  const toggleTrack = (trackId: string) => {
    if (selectedTracks.includes(trackId)) {
      setSelectedTracks(selectedTracks.filter(id => id !== trackId));
    } else {
      setSelectedTracks([...selectedTracks, trackId]);
    }
  };

  const handleGenerateReport = async () => {
    if (selectedLearner && selectedTracks.length > 0) {
      setLoadingReport(true);
      try {
        const completions = await getAuditTrackCompletions(selectedLearner.id, selectedTracks);
        setTrackCompletions(completions);
        setShowReport(true);
      } catch (err: any) {
        console.error('Error generating report:', err);
        setError(err.message || 'Failed to generate report');
      } finally {
        setLoadingReport(false);
      }
    }
  };

  const handleReset = () => {
    setSelectedLearner(null);
    setSelectedTracks([]);
    setShowReport(false);
    setSearchQuery('');
    setTrackSearchQuery('');
    setTrackCompletions([]);
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

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
            {(() => {
              const completedCount = trackCompletions.filter(tc => tc.status === 'completed' || tc.status === 'passed').length;
              const totalTracks = trackCompletions.length;
              const completionRate = totalTracks > 0 ? Math.round((completedCount / totalTracks) * 100) : 0;
              const totalTime = trackCompletions.reduce((sum, tc) => sum + (tc.timeSpentMinutes || 0), 0);
              const scores = trackCompletions.filter(tc => tc.score !== null).map(tc => tc.score as number);
              const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

              return (
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-900/30">
                    <p className="text-sm text-muted-foreground mb-1">Tracks Completed</p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">{completedCount} / {totalTracks}</p>
                    <Progress value={completionRate} className="h-2 mt-2" />
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-900/30">
                    <p className="text-sm text-muted-foreground mb-1">Total Learning Time</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{totalTime} min</p>
                    <p className="text-xs text-muted-foreground mt-1">Across selected content</p>
                  </div>
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-900/30">
                    <p className="text-sm text-muted-foreground mb-1">Average Score</p>
                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">{avgScore > 0 ? `${avgScore}%` : 'N/A'}</p>
                    <p className="text-xs text-muted-foreground mt-1">On assessments</p>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Detailed Track Reports */}
        <div className="space-y-6">
          {trackCompletions.map((track, index) => {
            const isCompleted = track.status === 'completed' || track.status === 'passed';
            const statusBadge = track.status === 'not_started' ? (
              <Badge variant="outline" className="text-muted-foreground">
                <Clock className="h-3 w-3 mr-1" />
                Not Started
              </Badge>
            ) : track.status === 'failed' ? (
              <Badge className="bg-red-100 text-red-700 border-red-200">
                <AlertCircle className="h-3 w-3 mr-1" />
                Failed
              </Badge>
            ) : (
              <Badge className="bg-green-100 text-green-700 border-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {track.status === 'passed' ? 'Passed' : 'Completed'}
              </Badge>
            );

            return (
              <Card key={track.trackId} className="border-2">
                <CardHeader className="bg-accent/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-lg bg-brand-gradient flex items-center justify-center">
                        <Play className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Track {index + 1}: {track.trackTitle}</CardTitle>
                        <p className="text-sm text-muted-foreground">Album: {track.album} • {track.trackType}</p>
                      </div>
                    </div>
                    {statusBadge}
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* Completion Details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-accent/30 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Status</p>
                      <p className="font-semibold capitalize">{track.status.replace('_', ' ')}</p>
                    </div>
                    <div className="p-3 bg-accent/30 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Time Spent</p>
                      <p className="font-semibold">{track.timeSpentMinutes > 0 ? `${track.timeSpentMinutes} min` : 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-accent/30 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Score</p>
                      <p className="font-semibold">{track.score !== null ? `${track.score}%` : 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-accent/30 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Attempts</p>
                      <p className="font-semibold">{track.attempts || 0}</p>
                    </div>
                  </div>

                  {isCompleted && track.completedAt && (
                    <>
                      <Separator />

                      {/* Activity Timeline */}
                      <div>
                        <h3 className="font-semibold mb-3 flex items-center">
                          <Clock className="h-4 w-4 mr-2 text-primary" />
                          {selectedLearner.name} Activity Timeline
                        </h3>
                        <div className="space-y-2 ml-6 border-l-2 border-border pl-4">
                          <div className="pb-3">
                            <div className="flex items-center space-x-2 mb-1">
                              <div className="h-2 w-2 rounded-full bg-green-500" />
                              <p className="text-sm font-medium">Track Completed</p>
                              <span className="text-xs text-muted-foreground">
                                {new Date(track.completedAt).toLocaleDateString('en-US', {
                                  month: 'short', day: 'numeric', year: 'numeric'
                                })} at {new Date(track.completedAt).toLocaleTimeString('en-US', {
                                  hour: '2-digit', minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {selectedLearner.name} completed all content
                              {track.score !== null && ` with a score of ${track.score}%`}
                            </p>
                          </div>
                          {track.score !== null && (
                            <div className="pb-3">
                              <div className="flex items-center space-x-2 mb-1">
                                <div className="h-2 w-2 rounded-full bg-blue-500" />
                                <p className="text-sm font-medium">Assessment Submitted</p>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Score: {track.score}% • {track.passed ? 'Passed' : 'Did not pass'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <Separator />

                      {/* Assessment Results (if score exists) */}
                      {track.score !== null && (
                        <div>
                          <h3 className="font-semibold mb-3 flex items-center">
                            <Award className="h-4 w-4 mr-2 text-primary" />
                            Assessment Results
                          </h3>
                          <div className={`flex items-center justify-between p-3 rounded-lg border ${
                            track.passed
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/30'
                              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/30'
                          }`}>
                            <div>
                              <p className={`font-medium ${track.passed ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>
                                Assessment Score: {track.score}%
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {track.attempts} attempt{track.attempts !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <Badge className={track.passed
                              ? 'bg-green-100 text-green-700 border-green-200'
                              : 'bg-red-100 text-red-700 border-red-200'
                            }>
                              {track.passed ? 'Passed' : 'Did Not Pass'}
                            </Badge>
                          </div>
                        </div>
                      )}

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
                                "I acknowledge that I have completed the {track.trackTitle} training and understand the content covered."
                              </p>
                              <div className="flex items-center justify-between text-xs">
                                <div>
                                  <p className="text-muted-foreground">Digital Signature:</p>
                                  <p className="font-semibold">{selectedLearner.name}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-muted-foreground">Date & Time:</p>
                                  <p className="font-semibold">
                                    {new Date(track.completedAt).toLocaleDateString('en-US', {
                                      month: 'short', day: 'numeric', year: 'numeric'
                                    })} at {new Date(track.completedAt).toLocaleTimeString('en-US', {
                                      hour: '2-digit', minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {!isCompleted && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-900/30">
                      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          {track.status === 'not_started'
                            ? 'This track has not been started by the learner.'
                            : 'This track was not successfully completed.'}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
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

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tracks by title, album, or category..."
                value={trackSearchQuery}
                onChange={(e) => setTrackSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredTracks.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No tracks found</p>
                </div>
              ) : filteredTracks.map((track) => (
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
              disabled={!selectedLearner || selectedTracks.length === 0 || loadingReport}
              onClick={handleGenerateReport}
            >
              {loadingReport ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Report
                </>
              )}
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
