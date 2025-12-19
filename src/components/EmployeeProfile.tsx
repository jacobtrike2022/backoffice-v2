import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Checkbox } from './ui/checkbox';
import { Skeleton } from './ui/skeleton';
import { TagSelectorDialog } from './TagSelectorDialog';
import * as tagCrud from '../lib/crud/tags';
import { 
  ArrowLeft,
  Mail,
  Phone,
  Building,
  Calendar,
  CalendarX,
  Award,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Clock,
  Send,
  Key,
  Edit,
  Pencil,
  Activity,
  BarChart3,
  PieChart,
  Shield,
  FileCheck,
  BookOpen,
  Target,
  Zap,
  MessageSquare,
  Bell,
  Tag as TagIcon,
  Plus,
  Hash
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  PieChart as RechartsPie, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import { toast } from 'sonner@2.0.3';
import { supabase } from '../lib/supabase';
import { useCurrentUser } from '../lib/hooks/useSupabase';
import { resetPassword } from '../lib/hooks/useAuth';
import { createNotification } from '../lib/crud/notifications';
import { getUserCertifications } from '../lib/crud/certifications';
import { ExternalLink } from 'lucide-react';
import { EditPeopleDialog } from './EditPeopleDialog';

type UserRole = 'admin' | 'administrator' | 'district-manager' | 'store-manager' | 'trike-super-admin';

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  homeStore: string;
  district: string;
  avatar?: string;
  progress: number;
  status: 'active' | 'inactive' | 'on-leave';
  completedTracks: number;
  totalTracks: number;
  lastActive: string;
  certifications: number;
  complianceScore: number;
  // Additional fields
  phone?: string;
  employeeId?: string;
  hireDate?: string;
  terminationDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface EmployeeProfileProps {
  employee: Employee;
  onBack: () => void;
  currentRole: UserRole;
}

interface ActivityItem {
  id: string;
  type: 'completion' | 'certification' | 'login' | 'assignment';
  title: string;
  description: string;
  timestamp: string;
  icon: React.ComponentType<any>;
  iconColor: string;
}

interface Certification {
  id: string;
  name: string;
  issueDate: string;
  expiryDate: string;
  status: 'active' | 'expiring-soon' | 'expired' | 'revoked';
  score?: number;
  certificateNumber?: string;
  certificateUrl?: string;
  issuedAt: string;
  expiresAt?: string;
}

export function EmployeeProfile({ employee, onBack, currentRole }: EmployeeProfileProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [showReminderDialog, setShowReminderDialog] = useState(false);
  const [reminderSMS, setReminderSMS] = useState(true);
  const [reminderPush, setReminderPush] = useState(true);
  const [reminderEmail, setReminderEmail] = useState(true);
  
  // Real data states
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [userProgress, setUserProgress] = useState<any[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  
  // Tab-specific data states
  const [overviewData, setOverviewData] = useState<any>(null);
  const [progressData, setProgressData] = useState<any[]>([]);
  const [performanceTabData, setPerformanceTabData] = useState<any>(null);
  const [activityTimeline, setActivityTimeline] = useState<any[]>([]);
  const [tabLoading, setTabLoading] = useState<Record<string, boolean>>({
    overview: false,
    progress: false,
    performance: false,
    activity: false,
    certifications: false
  });
  
  // Progress tab filters
  const [progressFilter, setProgressFilter] = useState<'all' | 'in_progress' | 'completed' | 'overdue'>('all');
  const [progressSort, setProgressSort] = useState<'progress' | 'due_date' | 'last_activity' | 'name'>('progress');
  
  // Activity tab filters
  const [activityDateRange, setActivityDateRange] = useState<'7' | '30' | '90' | 'all'>('30');
  const [activityTypeFilter, setActivityTypeFilter] = useState<'all' | 'tracks' | 'quizzes' | 'completions'>('all');

  const { user: currentUser } = useCurrentUser();

  useEffect(() => {
    if (employee.id) {
      // Reset userDetails when employee changes to prevent showing stale data
      setUserDetails(null);
      setShowEditDialog(false);
      fetchEmployeeData();
    }
  }, [employee.id]);

  // Close dialog if userDetails doesn't match current employee (prevents stale data)
  useEffect(() => {
    if (showEditDialog && userDetails && userDetails.id !== employee.id) {
      setShowEditDialog(false);
    }
  }, [showEditDialog, userDetails, employee.id]);

  const fetchEmployeeData = async () => {
    try {
      setLoading(true);

      // Fetch full user details with all fields
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', employee.id)
        .single();

      if (userError) throw userError;
      setUserDetails(userData);

      // Fetch tags
      const employeeTags = await tagCrud.getEntityTags(employee.id, 'user');
      setTags(employeeTags.map(t => t.name));

      // Fetch certifications
      try {
        const certsData = await getUserCertifications(employee.id);
        const formattedCerts: Certification[] = (certsData || []).map((cert: any) => {
          // Schema uses issued_at and expires_at
          const expiryDate = cert.expires_at;
          const issueDate = cert.issued_at;
          const now = new Date();
          const expiresAt = expiryDate ? new Date(expiryDate) : null;
          
          let status: 'active' | 'expiring-soon' | 'expired' | 'revoked' = 'active';
          if (cert.status === 'revoked') {
            status = 'revoked';
          } else if (cert.status === 'expired') {
            status = 'expired';
          } else if (expiresAt) {
            const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntilExpiry < 0) {
              status = 'expired';
            } else if (daysUntilExpiry <= 30) {
              status = 'expiring-soon';
            }
          } else {
            // If no expiration date, keep as active
            status = 'active';
          }

          return {
            id: cert.id,
            name: cert.certification?.name || 'Unknown Certification',
            issueDate: issueDate || '',
            expiryDate: expiryDate || '',
            issuedAt: issueDate || '',
            expiresAt: expiryDate || undefined,
            status,
            score: cert.score,
            certificateNumber: cert.certificate_number,
            certificateUrl: cert.certificate_url
          };
        });
        setCertifications(formattedCerts);
      } catch (certError) {
        console.error('Error fetching certifications:', certError);
      }

      // Fetch assignments for this employee
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select(`
          *,
          playlist:playlists (
            id,
            title,
            description
          )
        `)
        .eq('user_id', employee.id)
        .order('assigned_at', { ascending: false })
        .limit(10);

      if (assignmentsError) throw assignmentsError;
      setAssignments(assignmentsData || []);

      // Fetch user progress records
      const { data: progressData, error: progressError } = await supabase
        .from('user_progress')
        .select(`
          *,
          track:tracks (
            id,
            title,
            type
          )
        `)
        .eq('user_id', employee.id)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (progressError) throw progressError;
      setUserProgress(progressData || []);

      // Build activity feed from assignments and progress
      const activities: ActivityItem[] = [];

      // Add completion activities
      (progressData as any[])?.forEach((progress: any) => {
        if (progress.status === 'completed' && progress.completed_at) {
          activities.push({
            id: progress.id,
            type: 'completion',
            title: `Completed ${progress.track?.title || 'Track'}`,
            description: `Score: ${progress.score || 'N/A'}%`,
            timestamp: formatTimestamp(progress.completed_at),
            icon: CheckCircle,
            iconColor: 'text-green-600'
          });
        }
      });

      // Add assignment activities
      (assignmentsData as any[])?.forEach((assignment: any) => {
        activities.push({
          id: assignment.id,
          type: 'assignment',
          title: `Assigned ${assignment.playlist?.title || 'Playlist'}`,
          description: assignment.playlist?.description || '',
          timestamp: formatTimestamp(assignment.assigned_at),
          icon: BookOpen,
          iconColor: 'text-orange-600'
        });
      });

      // Sort by timestamp (most recent first)
      activities.sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      setActivityFeed(activities.slice(0, 10)); // Keep only 10 most recent

      // Load overview data by default
      await fetchOverviewData();

    } catch (err) {
      console.error('Error fetching employee data:', err);
      toast.error('Failed to load employee details');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Overview Tab Data
  const fetchOverviewData = async () => {
    try {
      setTabLoading(prev => ({ ...prev, overview: true }));
      
      // Get all assignments for this user
      const { data: assignments, error: assignmentsError } = await supabase
        .from('assignments')
        .select('id, playlist_id, due_date, status')
        .eq('user_id', employee.id);

      if (assignmentsError) throw assignmentsError;

      // Get all tracks from assigned playlists
      const playlistIds = [...new Set((assignments || []).map(a => a.playlist_id).filter(Boolean))];
      let assignedTracks: any[] = [];
      let trackDetails: Record<string, any> = {};
      
      if (playlistIds.length > 0) {
        const { data: playlistTracks, error: tracksError } = await supabase
          .from('playlist_tracks')
          .select(`
            track_id,
            playlist_id,
            track:tracks (
              id,
              title,
              type
            )
          `)
          .in('playlist_id', playlistIds);

        if (tracksError) throw tracksError;
        
        assignedTracks = playlistTracks || [];
        trackDetails = {};
        assignedTracks.forEach(pt => {
          if (pt.track_id && pt.track) {
            trackDetails[pt.track_id] = pt.track;
          }
        });
      }

      // Get all track completions for this user
      const trackIds = assignedTracks.map(pt => pt.track_id).filter(Boolean);
      const { data: completions, error: completionsError } = await supabase
        .from('track_completions')
        .select('track_id, status, completed_at, score, passed')
        .eq('user_id', employee.id)
        .in('track_id', trackIds.length > 0 ? trackIds : ['00000000-0000-0000-0000-000000000000']);

      if (completionsError) throw completionsError;

      // Build completion map
      const completionMap = new Map(
        completions?.map(c => [c.track_id, c]) || []
      );

      // Calculate summary metrics
      const assignedCount = assignedTracks.length;
      const completedCount = completions?.filter(c => 
        c.status === 'completed' || c.status === 'passed'
      ).length || 0;
      
      const inProgressCount = assignedTracks.filter(pt => {
        const completion = completionMap.get(pt.track_id);
        return !completion || (completion.status !== 'completed' && completion.status !== 'passed');
      }).length;
      
      // Calculate average score from checkpoint completions
      const checkpointCompletions = completions?.filter(c => {
        const track = trackDetails[c.track_id];
        return track?.type === 'checkpoint' && c.score !== null;
      }) || [];
      const avgScore = checkpointCompletions.length > 0
        ? checkpointCompletions.reduce((sum, c) => sum + (c.score || 0), 0) / checkpointCompletions.length
        : 0;

      // Get recent activity (last 10 completions)
      const recentActivity = (completions || [])
        .filter(c => c.completed_at)
        .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
        .slice(0, 10)
        .map(c => {
          const track = trackDetails[c.track_id];
          return {
            id: c.track_id,
            trackTitle: track?.title || 'Unknown Track',
            action: c.status === 'completed' || c.status === 'passed' ? 'completed' : 'updated',
            timestamp: c.completed_at,
            trackType: track?.type
          };
        });

      // Get upcoming deadlines
      const now = new Date();
      const upcomingDeadlines = (assignments || [])
        .filter(a => {
          if (!a.due_date) return false;
          const dueDate = new Date(a.due_date);
          if (dueDate <= now) return false;
          
          // Check if assignment has incomplete tracks
          const assignmentTracks = assignedTracks.filter(pt => pt.playlist_id === a.playlist_id);
          if (assignmentTracks.length === 0) return false;
          
          const hasIncompleteTracks = assignmentTracks.some(pt => {
            const completion = completionMap.get(pt.track_id);
            return !completion || (completion.status !== 'completed' && completion.status !== 'passed');
          });
          return hasIncompleteTracks;
        })
        .map(a => {
          const dueDate = new Date(a.due_date);
          const daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const assignmentTracks = assignedTracks.filter(pt => pt.playlist_id === a.playlist_id);
          return {
            id: a.id,
            trackTitle: `Assignment (${assignmentTracks.length} tracks)`,
            dueDate: a.due_date,
            daysRemaining
          };
        })
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .slice(0, 10);

      setOverviewData({
        assignedCount,
        completedCount,
        inProgressCount,
        avgScore: Math.round(avgScore),
        recentActivity,
        upcomingDeadlines
      });
    } catch (err) {
      console.error('Error fetching overview data:', err);
      toast.error('Failed to load overview data');
    } finally {
      setTabLoading(prev => ({ ...prev, overview: false }));
    }
  };

  // Fetch Progress Tab Data
  const fetchProgressData = async () => {
    try {
      setTabLoading(prev => ({ ...prev, progress: true }));
      
      // Get all assignments for this user
      const { data: assignments, error: assignmentsError } = await supabase
        .from('assignments')
        .select('id, playlist_id, due_date, status')
        .eq('user_id', employee.id);

      if (assignmentsError) throw assignmentsError;

      if (!assignments || assignments.length === 0) {
        setProgressData([]);
        return;
      }

      // Get all tracks from assigned playlists
      const playlistIds = [...new Set(assignments.map(a => a.playlist_id).filter(Boolean))];
      const { data: playlistTracks, error: tracksError } = await supabase
        .from('playlist_tracks')
        .select(`
          track_id,
          playlist_id,
          display_order,
          track:tracks (
            id,
            title,
            type,
            duration_minutes
          )
        `)
        .in('playlist_id', playlistIds);

      if (tracksError) throw tracksError;

      // Get all track completions for this user
      const trackIds = playlistTracks?.map(pt => pt.track_id).filter(Boolean) || [];
      const { data: completions, error: completionsError } = await supabase
        .from('track_completions')
        .select('track_id, status, completed_at, score, passed')
        .eq('user_id', employee.id)
        .in('track_id', trackIds);

      if (completionsError) throw completionsError;

      // Build completion map
      const completionMap = new Map(
        completions?.map(c => [c.track_id, c]) || []
      );

      // Build assignment map for due dates
      const assignmentMap = new Map(
        assignments.map(a => [a.playlist_id, a])
      );

      // Combine data: for each track, show progress based on completion
      const progressData = (playlistTracks || []).map((pt: any) => {
        const track = pt.track;
        const completion = completionMap.get(pt.track_id);
        const assignment = assignmentMap.get(pt.playlist_id);
        
        return {
          id: `${assignment?.id}-${pt.track_id}`,
          track_id: pt.track_id,
          assignment_id: assignment?.id,
          track: track,
          assignment: assignment,
          status: completion?.status || 'not_started',
          progress_percent: completion ? 100 : 0,
          completed_at: completion?.completed_at,
          score: completion?.score,
          passed: completion?.passed,
          due_date: assignment?.due_date,
          updated_at: completion?.completed_at || assignment?.created_at
        };
      });

      setProgressData(progressData);
    } catch (err) {
      console.error('Error fetching progress data:', err);
      toast.error('Failed to load progress data');
      setProgressData([]);
    } finally {
      setTabLoading(prev => ({ ...prev, progress: false }));
    }
  };

  // Fetch Performance Tab Data
  const fetchPerformanceData = async () => {
    try {
      setTabLoading(prev => ({ ...prev, performance: true }));
      
      // Get all progress with checkpoint scores
      const { data: allProgress, error: progressError } = await supabase
        .from('user_progress')
        .select(`
          *,
          track:tracks (
            id,
            title,
            type
          )
        `)
        .eq('user_id', employee.id)
        .order('completed_at', { ascending: false, nullsFirst: false }) as { data: any[] | null; error: any };

      if (progressError) throw progressError;

      // Calculate metrics
      const checkpointProgress = (allProgress || []).filter(p => p.track?.type === 'checkpoint' && p.score !== null);
      const overallAvgScore = checkpointProgress.length > 0
        ? checkpointProgress.reduce((sum, p) => sum + (p.score || 0), 0) / checkpointProgress.length
        : 0;

      // Quiz completion rate
      const assignedCheckpoints = (allProgress || []).filter(p => p.track?.type === 'checkpoint').length;
      const completedCheckpoints = checkpointProgress.filter(p => p.status === 'completed').length;
      const quizCompletionRate = assignedCheckpoints > 0
        ? (completedCheckpoints / assignedCheckpoints) * 100
        : 0;

      // Average time to complete
      const completedTracks = (allProgress || []).filter(p => 
        p.status === 'completed' && p.started_at && p.completed_at
      );
      const timeToComplete = completedTracks.length > 0
        ? completedTracks.reduce((sum, p) => {
            const start = new Date(p.started_at);
            const end = new Date(p.completed_at);
            return sum + (end.getTime() - start.getTime());
          }, 0) / completedTracks.length / (1000 * 60) // Convert to minutes
        : 0;

      // Improvement trend (compare recent vs older scores)
      const sortedCheckpoints = checkpointProgress
        .filter(p => p.completed_at)
        .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());
      
      const recentScores = sortedCheckpoints.slice(-5).map(p => p.score || 0);
      const olderScores = sortedCheckpoints.slice(0, Math.min(5, sortedCheckpoints.length - 5)).map(p => p.score || 0);
      
      const recentAvg = recentScores.length > 0 ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 0;
      const olderAvg = olderScores.length > 0 ? olderScores.reduce((a, b) => a + b, 0) / olderScores.length : 0;
      const improvementTrend = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

      // Score trend chart data
      const scoreTrendData = checkpointProgress
        .filter(p => p.completed_at)
        .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime())
        .map(p => ({
          date: new Date(p.completed_at).toISOString().split('T')[0],
          score: p.score || 0,
          trackTitle: p.track?.title || 'Unknown'
        }));

      // Recent quiz results (last 10)
      const recentQuizResults = checkpointProgress
        .filter(p => p.completed_at)
        .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
        .slice(0, 10)
        .map(p => ({
          id: p.id,
          trackName: p.track?.title || 'Unknown Track',
          dateTaken: p.completed_at,
          score: p.score || 0,
          passed: p.passed || false,
          timeSpent: p.time_spent_minutes || 0
        }));

      setPerformanceTabData({
        overallAvgScore: Math.round(overallAvgScore),
        quizCompletionRate: Math.round(quizCompletionRate),
        timeToComplete: Math.round(timeToComplete),
        improvementTrend: Math.round(improvementTrend),
        scoreTrendData,
        recentQuizResults
      });
    } catch (err) {
      console.error('Error fetching performance data:', err);
      toast.error('Failed to load performance data');
    } finally {
      setTabLoading(prev => ({ ...prev, performance: false }));
    }
  };

  // Fetch Activity Timeline Data
  const fetchActivityTimeline = async () => {
    try {
      setTabLoading(prev => ({ ...prev, activity: true }));
      
      // Get all progress events
      const { data: progressData, error: progressError } = await supabase
        .from('user_progress')
        .select(`
          *,
          track:tracks (
            id,
            title,
            type
          )
        `)
        .eq('user_id', employee.id)
        .order('created_at', { ascending: false }) as { data: any[] | null; error: any };

      if (progressError) throw progressError;

      // Get assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select(`
          *,
          playlist:playlists (
            id,
            title
          )
        `)
        .eq('user_id', employee.id)
        .order('assigned_at', { ascending: false }) as { data: any[] | null; error: any };

      if (assignmentsError) throw assignmentsError;

      // Get learning activity events (xAPI-style tracking)
      const { data: activityEvents, error: eventsError } = await supabase
        .from('activity_events')
        .select('*')
        .eq('user_id', employee.id)
        .order('timestamp', { ascending: false })
        .limit(100) as { data: any[] | null; error: any };

      if (eventsError) throw eventsError;

      // Build timeline events
      const timelineEvents: any[] = [];

      // Add track assigned events (from assignments)
      (assignmentsData || []).forEach(assignment => {
        timelineEvents.push({
          id: `assignment-${assignment.id}`,
          type: 'track_assigned',
          title: `Track Assigned: ${assignment.playlist?.title || 'Playlist'}`,
          timestamp: assignment.assigned_at,
          icon: BookOpen,
          iconColor: 'text-blue-600'
        });
      });

      // Add progress events
      (progressData || []).forEach(progress => {
        // Track started
        if (progress.started_at) {
          timelineEvents.push({
            id: `started-${progress.id}`,
            type: 'track_started',
            title: `Started: ${progress.track?.title || 'Track'}`,
            timestamp: progress.started_at,
            icon: BookOpen,
            iconColor: 'text-orange-600',
            trackType: progress.track?.type
          });
        }

        // Quiz taken (checkpoint completed)
        if (progress.track?.type === 'checkpoint' && progress.completed_at && progress.score !== null) {
          timelineEvents.push({
            id: `quiz-${progress.id}`,
            type: 'quiz_taken',
            title: `Took Quiz: ${progress.track?.title || 'Checkpoint'}`,
            description: `Score: ${progress.score}%`,
            timestamp: progress.completed_at,
            icon: FileCheck,
            iconColor: 'text-purple-600',
            score: progress.score
          });
        }

        // Track completed
        if (progress.status === 'completed' && progress.completed_at) {
          timelineEvents.push({
            id: `completed-${progress.id}`,
            type: 'track_completed',
            title: `Completed: ${progress.track?.title || 'Track'}`,
            description: progress.track?.type === 'checkpoint' ? `Score: ${progress.score || 'N/A'}%` : undefined,
            timestamp: progress.completed_at,
            icon: CheckCircle,
            iconColor: 'text-green-600',
            score: progress.score
          });
        }
      });

      // Add learning activity events from activity_events table
      (activityEvents || []).forEach(event => {
        const timestamp = event.timestamp || event.stored_at;
        if (!timestamp) return;

        if (event.verb === 'completed' || event.result_completion === true) {
          timelineEvents.push({
            id: `event-completed-${event.id}`,
            type: 'track_completed',
            title: `Completed: ${event.object_name || event.object_type || 'Content'}`,
            description: event.result_score_scaled !== null && event.result_score_scaled !== undefined
              ? `Score: ${Math.round(event.result_score_scaled)}%`
              : undefined,
            timestamp: timestamp,
            icon: CheckCircle,
            iconColor: 'text-green-600',
            score: event.result_score_scaled
          });
        } else if (event.verb === 'passed' || event.result_success === true) {
          timelineEvents.push({
            id: `event-passed-${event.id}`,
            type: 'quiz_taken',
            title: `Passed: ${event.object_name || event.object_type || 'Assessment'}`,
            description: event.result_score_scaled !== null && event.result_score_scaled !== undefined
              ? `Score: ${Math.round(event.result_score_scaled)}%`
              : undefined,
            timestamp: timestamp,
            icon: FileCheck,
            iconColor: 'text-purple-600',
            score: event.result_score_scaled
          });
        } else if (event.verb === 'watched' || event.verb === 'viewed' || event.verb === 'started') {
          timelineEvents.push({
            id: `event-started-${event.id}`,
            type: 'track_started',
            title: `${event.verb === 'watched' || event.verb === 'viewed' ? 'Viewed' : 'Started'}: ${event.object_name || event.object_type || 'Content'}`,
            timestamp: timestamp,
            icon: BookOpen,
            iconColor: 'text-orange-600'
          });
        } else if (event.verb) {
          // Other activity events
          timelineEvents.push({
            id: `event-${event.id}`,
            type: 'track_assigned',
            title: `${event.verb.charAt(0).toUpperCase() + event.verb.slice(1)}: ${event.object_name || event.object_type || 'Activity'}`,
            timestamp: timestamp,
            icon: BookOpen,
            iconColor: 'text-blue-600'
          });
        }
      });

      // Sort by timestamp (most recent first)
      timelineEvents.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setActivityTimeline(timelineEvents);
    } catch (err) {
      console.error('Error fetching activity timeline:', err);
      toast.error('Failed to load activity timeline');
    } finally {
      setTabLoading(prev => ({ ...prev, activity: false }));
    }
  };

  // Load tab data when tab changes
  useEffect(() => {
    if (!employee.id) return;

    switch (activeTab) {
      case 'overview':
        if (!overviewData) fetchOverviewData();
        break;
      case 'progress':
        if (progressData.length === 0) fetchProgressData();
        break;
      case 'performance':
        if (!performanceTabData) fetchPerformanceData();
        break;
      case 'activity':
        if (activityTimeline.length === 0) fetchActivityTimeline();
        break;
    }
  }, [activeTab, employee.id]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const handleTagsChange = async (newTags: string[], tagObjects?: any[]) => {
    setTags(newTags);
    
    if (tagObjects) {
      const tagIds = tagObjects.map(t => t.id);
      try {
        await tagCrud.assignTags(employee.id, 'user', tagIds);
        toast.success('Tags updated successfully');
      } catch (error) {
        console.error('Error updating tags:', error);
        toast.error('Failed to update tags');
      }
    }
  };

  const handleEditSuccess = () => {
    // Refresh the page to show updated data
    window.location.reload();
  };

  const handleResetPassword = async () => {
    try {
      await resetPassword(employee.email);
      toast.success('Password reset email sent', {
        description: `Reset link sent to ${employee.email}`
      });
    } catch (err: any) {
      console.error('Error resetting password:', err);
      toast.error('Failed to send password reset email', {
        description: err.message || 'Please try again later'
      });
    }
  };

  const handleSendReminder = () => {
    setShowReminderDialog(true);
  };

  const handleConfirmReminder = async () => {
    try {
      const notificationTypes: string[] = [];
      if (reminderEmail) notificationTypes.push('email');
      if (reminderSMS) notificationTypes.push('SMS');
      if (reminderPush) notificationTypes.push('push notification');

      // Create notification in database
      // Note: The notification system currently only supports in-app notifications.
      // Channel selection (email/SMS/push) is collected for UI feedback but actual
      // multi-channel delivery would require additional integration.
      await createNotification({
        user_id: employee.id,
        type: 'due-date',
        title: 'Training Reminder',
        message: `You have pending training assignments that require your attention.`,
        link_url: '/assignments'
      });

      const channelText = notificationTypes.length > 0 
        ? ` via ${notificationTypes.join(', ')}` 
        : '';
      toast.success('Reminder sent successfully', {
        description: `Training reminder sent to ${employee.name}${channelText}`
      });
      setShowReminderDialog(false);
    } catch (err: any) {
      console.error('Error sending reminder:', err);
      toast.error('Failed to send reminder', {
        description: err.message || 'Please try again later'
      });
    }
  };

  const getCertificationStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'valid':
        return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400';
      case 'expiring-soon':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'expired':
        return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400';
      case 'revoked':
        return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 90) return 'bg-green-500';
    if (progress >= 80) return 'bg-blue-500';
    if (progress >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Calculate statistics from real data
  const completedCount = userProgress.filter(p => p.status === 'completed').length;
  const inProgressCount = userProgress.filter(p => p.status === 'in_progress').length;
  const avgScore = userProgress.filter(p => p.score).reduce((acc, p) => acc + (p.score || 0), 0) / 
                   (userProgress.filter(p => p.score).length || 1);

  // Build performance data from user_progress with dynamic months
  const performanceData = (() => {
    // Get all completion dates and determine date range
    const completionDates = userProgress
      .filter(p => p.completed_at)
      .map(p => new Date(p.completed_at))
      .sort((a, b) => a.getTime() - b.getTime());

    if (completionDates.length === 0) {
      // Return last 6 months if no data
      const months: string[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(date.toLocaleDateString('en-US', { month: 'short' }));
      }
      return months.map(month => ({ month, completed: 0, score: 0 }));
    }

    const startDate = completionDates[0];
    const endDate = completionDates[completionDates.length - 1];
    
    // Generate months between start and end (or last 6 months if range is smaller)
    // Store both the display string and the actual date for accurate matching
    const now = new Date();
    const monthsToShow = Math.max(6, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    const actualMonths = Math.min(monthsToShow, 12); // Cap at 12 months
    
    interface MonthData {
      display: string;
      year: number;
      month: number;
    }
    
    const months: MonthData[] = [];
    for (let i = actualMonths - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        display: date.toLocaleDateString('en-US', { month: 'short' }),
        year: date.getFullYear(),
        month: date.getMonth()
      });
    }

    return months.map(monthData => {
      const monthProgress = userProgress.filter(p => {
        if (!p.completed_at) return false;
        const date = new Date(p.completed_at);
        // Match both month and year to avoid grouping data from different years
        return date.getMonth() === monthData.month && date.getFullYear() === monthData.year;
      });
      const completed = monthProgress.length;
      const score = monthProgress.reduce((acc, p) => acc + (p.score || 0), 0) / (completed || 1);
      return { month: monthData.display, completed, score: Math.round(score) };
    });
  })();

  // Build category distribution (simplified - using track types)
  const categoryData = (() => {
    const categories: { [key: string]: number } = {};
    userProgress.forEach(p => {
      const type = p.track?.type || 'Other';
      categories[type] = (categories[type] || 0) + 1;
    });
    
    const colors = ['#F74A05', '#FF733C', '#3B82F6', '#10b981', '#8B5CF6'];
    return Object.entries(categories).map(([name, value], index) => ({
      name,
      value,
      color: colors[index % colors.length]
    }));
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="hover:bg-accent"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to People
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h1 className="text-foreground">Employee Profile</h1>
            <p className="text-muted-foreground mt-1">
              View and manage employee information and performance
            </p>
          </div>
        </div>
        {/* Edit Button - only show for admins and district managers */}
        {((currentRole === 'admin' || currentRole === 'administrator') || currentRole === 'district-manager' || currentRole === 'trike-super-admin') && (
          <Button
            onClick={() => setShowEditDialog(true)}
            className="bg-brand-gradient hover:opacity-90 text-white shadow-brand"
          >
            <Pencil className="w-4 h-4 mr-2" />
            Edit Employee
          </Button>
        )}
      </div>

      {/* Profile Header Card */}
      <Card className="border-2 border-primary/10">
        <CardContent className="p-8">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-6">
              <Avatar className="h-24 w-24 ring-4 ring-primary/20">
                <AvatarImage src={employee.avatar} alt={employee.name} />
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-2xl">
                  {employee.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-4">
                <>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">{employee.name}</h2>
                      <p className="text-muted-foreground mt-1">{employee.role}</p>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-8 text-muted-foreground">
                        <span>{employee.email}</span>
                        {employee.phone && <span>{employee.phone}</span>}
                        <span>{employee.homeStore}</span>
                        {currentRole === 'admin' && <span>{employee.district} District</span>}
                      </div>
                      <div className="flex items-center gap-8 text-muted-foreground">
                        {employee.employeeId && <span>ID: {employee.employeeId}</span>}
                        {employee.hireDate && (
                          <span>
                            Hired {new Date(employee.hireDate).toLocaleDateString()}
                            {(() => {
                              const hireDate = new Date(employee.hireDate);
                              const now = new Date();
                              const years = Math.floor((now.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365));
                              return years > 0 ? ` (${years} ${years === 1 ? 'year' : 'years'})` : '';
                            })()}
                          </span>
                        )}
                        {employee.terminationDate && employee.status === 'inactive' && (
                          <span>Terminated {new Date(employee.terminationDate).toLocaleDateString()}</span>
                        )}
                        {employee.createdAt && (
                          <span>Created {new Date(employee.createdAt).toLocaleDateString()}</span>
                        )}
                        {employee.updatedAt && (
                          <span>Updated {new Date(employee.updatedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <Badge 
                        variant="outline" 
                        className={employee.status === 'active' 
                          ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-gray-100 text-gray-700 border-gray-200'}
                      >
                        {employee.status.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400">
                        {assignments.length} Assignments
                      </Badge>
                      {employee.lastActive && employee.lastActive !== 'Never' && (
                        <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400">
                          Last active {employee.lastActive}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Tags Section */}
                    <div className="flex items-center gap-2 mt-4 flex-wrap">
                      {tags.map((tag, index) => (
                        <Badge 
                          key={index} 
                          variant="secondary"
                          className="bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 transition-colors"
                        >
                          <TagIcon className="h-3 w-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                      {(currentRole === 'admin' || currentRole === 'district-manager') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsTagSelectorOpen(true)}
                          className="h-6 px-2 text-xs"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Manage Tags
                        </Button>
                      )}
                    </div>
                </>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col space-y-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSendReminder}
              >
                <Send className="w-4 h-4 mr-2" />
                Send Reminder
              </Button>
              {currentRole === 'admin' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResetPassword}
                >
                  <Key className="w-4 h-4 mr-2" />
                  Reset Password
                </Button>
              )}
            </div>
          </div>

          {/* Progress Stats */}
          <Separator className="my-6" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Training Progress</p>
              <div className="flex items-center space-x-3">
                <Progress 
                  value={Number(employee.progress) || 0} 
                  className="h-3 flex-1"
                  indicatorClassName={getProgressColor(Number(employee.progress) || 0)}
                />
                <span className="text-lg font-bold text-foreground">{employee.progress}%</span>
              </div>
            </div>

            <div className="text-center border-l border-border pl-6">
              <p className="text-sm text-muted-foreground mb-1">Tracks Completed</p>
              <p className="text-3xl font-bold text-foreground">{employee.completedTracks || 0}<span className="text-lg text-muted-foreground">/{employee.totalTracks || 0}</span></p>
            </div>

            <div className="text-center border-l border-border pl-6">
              <p className="text-sm text-muted-foreground mb-1">Average Score</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{Math.round(avgScore)}%</p>
            </div>

            <div className="text-center border-l border-border pl-6">
              <p className="text-sm text-muted-foreground mb-1">Active Assignments</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{assignments.filter(a => a.status !== 'completed').length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="progress">
            <Target className="w-4 h-4 mr-2" />
            Progress
          </TabsTrigger>
          <TabsTrigger value="performance">
            <TrendingUp className="w-4 h-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="w-4 h-4 mr-2" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="certifications">
            <Award className="w-4 h-4 mr-2" />
            Certifications
            {certifications.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {certifications.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {tabLoading.overview || !overviewData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-24" />
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-64" />
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              {/* Training Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Assigned Tracks</p>
                        <p className="text-3xl font-bold text-foreground">{overviewData.assignedCount}</p>
                      </div>
                      <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                        <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Completed Tracks</p>
                        <p className="text-3xl font-bold text-green-600 dark:text-green-400">{overviewData.completedCount}</p>
                      </div>
                      <div className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                        <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">In Progress</p>
                        <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{overviewData.inProgressCount}</p>
                      </div>
                      <div className="h-12 w-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                        <Clock className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Average Score</p>
                        <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{overviewData.avgScore}%</p>
                      </div>
                      <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                        <Award className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Activity className="w-5 h-5 mr-2 text-primary" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {overviewData.recentActivity.length > 0 ? (
                      <div className="space-y-4">
                        {overviewData.recentActivity.map((activity: any) => (
                          <div key={activity.id} className="flex items-start space-x-3">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              activity.action === 'completed' ? 'bg-green-100 dark:bg-green-900/30' :
                              activity.action === 'started' ? 'bg-orange-100 dark:bg-orange-900/30' :
                              'bg-blue-100 dark:bg-blue-900/30'
                            }`}>
                              {activity.action === 'completed' ? (
                                <CheckCircle className={`h-4 w-4 ${
                                  activity.action === 'completed' ? 'text-green-600 dark:text-green-400' :
                                  activity.action === 'started' ? 'text-orange-600 dark:text-orange-400' :
                                  'text-blue-600 dark:text-blue-400'
                                }`} />
                              ) : (
                                <BookOpen className={`h-4 w-4 ${
                                  activity.action === 'started' ? 'text-orange-600 dark:text-orange-400' :
                                  'text-blue-600 dark:text-blue-400'
                                }`} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">
                                {activity.action === 'completed' ? 'Completed' : activity.action === 'started' ? 'Started' : 'Updated'} {activity.trackTitle}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatTimestamp(activity.timestamp)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No recent activity</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Upcoming Deadlines */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <CalendarX className="w-5 h-5 mr-2 text-primary" />
                      Upcoming Deadlines
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {overviewData.upcomingDeadlines.length > 0 ? (
                      <div className="space-y-4">
                        {overviewData.upcomingDeadlines.map((deadline: any) => (
                          <div key={deadline.id} className="flex items-start justify-between p-3 border border-border rounded-lg">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">{deadline.trackTitle}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Due {new Date(deadline.dueDate).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge 
                              variant="outline"
                              className={
                                deadline.daysRemaining <= 7 
                                  ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400'
                                  : deadline.daysRemaining <= 14
                                  ? 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400'
                              }
                            >
                              {deadline.daysRemaining} {deadline.daysRemaining === 1 ? 'day' : 'days'} left
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <CalendarX className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No upcoming deadlines</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* Progress Tab */}
        <TabsContent value="progress" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Target className="w-5 h-5 mr-2 text-primary" />
                  Track Progress
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <select
                    value={progressFilter}
                    onChange={(e) => setProgressFilter(e.target.value as any)}
                    className="text-sm border border-border rounded-md px-3 py-1 bg-background"
                  >
                    <option value="all">All</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="overdue">Overdue</option>
                  </select>
                  <select
                    value={progressSort}
                    onChange={(e) => setProgressSort(e.target.value as any)}
                    className="text-sm border border-border rounded-md px-3 py-1 bg-background"
                  >
                    <option value="progress">Progress</option>
                    <option value="due_date">Due Date</option>
                    <option value="last_activity">Last Activity</option>
                    <option value="name">Track Name</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {tabLoading.progress ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
              ) : (() => {
                // Filter and sort progress data
                let filtered = [...progressData];
                
                // Apply filter
                if (progressFilter === 'in_progress') {
                  filtered = filtered.filter(p => p.status === 'in_progress' || (p.progress_percent > 0 && p.progress_percent < 100));
                } else if (progressFilter === 'completed') {
                  filtered = filtered.filter(p => p.status === 'completed');
                } else if (progressFilter === 'overdue') {
                  const now = new Date();
                  filtered = filtered.filter(p => {
                    const dueDate = p.assignment?.due_date;
                    return dueDate && new Date(dueDate) < now && !p.completed_at;
                  });
                }
                
                // Apply sort
                filtered.sort((a, b) => {
                  switch (progressSort) {
                    case 'progress':
                      return (b.progress_percent || 0) - (a.progress_percent || 0);
                    case 'due_date':
                      const aDue = a.assignment?.due_date ? new Date(a.assignment.due_date).getTime() : 0;
                      const bDue = b.assignment?.due_date ? new Date(b.assignment.due_date).getTime() : 0;
                      return aDue - bDue;
                    case 'last_activity':
                      return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
                    case 'name':
                      return (a.track?.title || '').localeCompare(b.track?.title || '');
                    default:
                      return 0;
                  }
                });
                
                return filtered.length > 0 ? (
                  <div className="space-y-4">
                    {filtered.map((progress) => {
                      const getTrackTypeColor = (type: string) => {
                        switch (type) {
                          case 'video': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400';
                          case 'article': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400';
                          case 'story': return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400';
                          case 'checkpoint': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400';
                          default: return 'bg-gray-100 text-gray-700 border-gray-200';
                        }
                      };
                      
                      const getStatusBadge = () => {
                        if (progress.status === 'completed') {
                          return <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400">Completed</Badge>;
                        } else if (progress.progress_percent > 0) {
                          return <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400">In Progress</Badge>;
                        } else {
                          return <Badge variant="outline">Not Started</Badge>;
                        }
                      };
                      
                      return (
                        <div key={progress.id} className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <h4 className="font-semibold text-foreground">{progress.track?.title || 'Unknown Track'}</h4>
                                {progress.track?.type && (
                                  <Badge variant="outline" className={getTrackTypeColor(progress.track.type)}>
                                    {progress.track.type}
                                  </Badge>
                                )}
                                {getStatusBadge()}
                              </div>
                              <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                                {progress.updated_at && (
                                  <span className="flex items-center">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Last activity: {formatTimestamp(progress.updated_at)}
                                  </span>
                                )}
                                {progress.assignment?.due_date && (
                                  <span className="flex items-center">
                                    <Calendar className="h-3 w-3 mr-1" />
                                    Due: {new Date(progress.assignment.due_date).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <Progress 
                              value={Number(progress.progress_percent) || 0} 
                              className="h-2 flex-1"
                              indicatorClassName={getProgressColor(Number(progress.progress_percent) || 0)}
                            />
                            <span className="text-sm font-semibold min-w-[3rem] text-right">{progress.progress_percent || 0}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No tracks found</p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          {tabLoading.performance || !performanceTabData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-24" />
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-64" />
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              {/* Performance Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Overall Avg Score</p>
                        <p className="text-3xl font-bold text-foreground">{performanceTabData.overallAvgScore}%</p>
                      </div>
                      <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                        <Award className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Quiz Completion</p>
                        <p className="text-3xl font-bold text-green-600 dark:text-green-400">{performanceTabData.quizCompletionRate}%</p>
                      </div>
                      <div className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                        <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Avg Time to Complete</p>
                        <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{performanceTabData.timeToComplete}m</p>
                      </div>
                      <div className="h-12 w-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                        <Clock className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Improvement Trend</p>
                        <p className={`text-3xl font-bold ${performanceTabData.improvementTrend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {performanceTabData.improvementTrend >= 0 ? '+' : ''}{performanceTabData.improvementTrend}%
                        </p>
                      </div>
                      <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Score Trend Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <TrendingUp className="w-5 h-5 mr-2 text-primary" />
                      Score Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {performanceTabData.scoreTrendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={performanceTabData.scoreTrendData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis 
                            dataKey="date" 
                            className="text-xs"
                            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          />
                          <YAxis className="text-xs" domain={[0, 100]} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                            labelFormatter={(value) => new Date(value).toLocaleDateString()}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="score" 
                            stroke="#F74A05" 
                            strokeWidth={3}
                            dot={{ fill: '#F74A05', r: 5 }}
                            name="Score"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No quiz data available</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Quiz Results */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <FileCheck className="w-5 h-5 mr-2 text-primary" />
                      Recent Quiz Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {performanceTabData.recentQuizResults.length > 0 ? (
                      <div className="space-y-3">
                        {performanceTabData.recentQuizResults.map((quiz: any) => (
                          <div key={quiz.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">{quiz.trackName}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(quiz.dateTaken).toLocaleDateString()} • {quiz.timeSpent}m
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge 
                                variant="outline"
                                className={
                                  quiz.passed 
                                    ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400'
                                }
                              >
                                {quiz.score}%
                              </Badge>
                              {quiz.passed ? (
                                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No quiz attempts yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-primary" />
                  Activity Timeline
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <select
                    value={activityDateRange}
                    onChange={(e) => setActivityDateRange(e.target.value as any)}
                    className="text-sm border border-border rounded-md px-3 py-1 bg-background"
                  >
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="all">All time</option>
                  </select>
                  <select
                    value={activityTypeFilter}
                    onChange={(e) => setActivityTypeFilter(e.target.value as any)}
                    className="text-sm border border-border rounded-md px-3 py-1 bg-background"
                  >
                    <option value="all">All</option>
                    <option value="tracks">Tracks</option>
                    <option value="quizzes">Quizzes</option>
                    <option value="completions">Completions</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {tabLoading.activity ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
                </div>
              ) : (() => {
                // Filter timeline events
                let filtered = [...activityTimeline];
                
                // Apply date range filter
                if (activityDateRange !== 'all') {
                  const days = parseInt(activityDateRange);
                  const cutoffDate = new Date();
                  cutoffDate.setDate(cutoffDate.getDate() - days);
                  filtered = filtered.filter(event => new Date(event.timestamp) >= cutoffDate);
                }
                
                // Apply type filter
                if (activityTypeFilter === 'tracks') {
                  filtered = filtered.filter(event => event.type === 'track_assigned' || event.type === 'track_started');
                } else if (activityTypeFilter === 'quizzes') {
                  filtered = filtered.filter(event => event.type === 'quiz_taken');
                } else if (activityTypeFilter === 'completions') {
                  filtered = filtered.filter(event => event.type === 'track_completed');
                }
                
                return filtered.length > 0 ? (
                  <div className="space-y-4">
                    {filtered.map((event, index) => (
                      <div key={event.id}>
                        <div className="flex items-start space-x-4">
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            event.iconColor.includes('green') ? 'bg-green-100 dark:bg-green-900/30' :
                            event.iconColor.includes('orange') ? 'bg-orange-100 dark:bg-orange-900/30' :
                            event.iconColor.includes('purple') ? 'bg-purple-100 dark:bg-purple-900/30' :
                            'bg-blue-100 dark:bg-blue-900/30'
                          }`}>
                            {React.createElement(event.icon, { 
                              className: `h-5 w-5 ${event.iconColor}` 
                            })}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground">{event.title}</p>
                            {event.description && (
                              <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2 flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatTimestamp(event.timestamp)}
                            </p>
                          </div>
                        </div>
                        {index < filtered.length - 1 && (
                          <Separator className="my-4" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No activity found</p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assignments Tab - Keeping for backward compatibility but can be removed */}
        <TabsContent value="assignments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <BookOpen className="w-5 h-5 mr-2 text-primary" />
                  Assignments
                </div>
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400">
                  {assignments.filter(a => a.status !== 'completed').length} Active
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
              ) : assignments.length > 0 ? (
                <div className="space-y-4">
                  {assignments.map((assignment) => (
                    <div key={assignment.id} className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">{assignment.playlist?.title || 'Untitled Playlist'}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{assignment.playlist?.description}</p>
                          <div className="flex items-center space-x-4 mt-3 text-xs text-muted-foreground">
                            <span className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              Assigned {new Date(assignment.assigned_at).toLocaleDateString()}
                            </span>
                            {assignment.due_date && (
                              <span className="flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                Due {new Date(assignment.due_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          <Badge 
                            variant="outline"
                            className={
                              assignment.status === 'completed' 
                                ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400'
                                : assignment.status === 'in_progress'
                                ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'bg-gray-100 text-gray-700 border-gray-200'
                            }
                          >
                            {assignment.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <div className="flex items-center space-x-2">
                            <Progress value={Number(assignment.progress_percent) || 0} className="h-2 w-24" />
                            <span className="text-sm font-semibold">{assignment.progress_percent || 0}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No assignments found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Certifications Tab */}
        <TabsContent value="certifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Award className="w-5 h-5 mr-2 text-primary" />
                  Certifications
                </div>
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400">
                  {certifications.filter(c => c.status === 'active').length} Active
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
              ) : certifications.length > 0 ? (
                <div className="space-y-4">
                  {certifications.map((cert) => (
                    <div key={cert.id} className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="font-semibold text-foreground">{cert.name}</h4>
                            <Badge 
                              variant="outline"
                              className={getCertificationStatusColor(cert.status)}
                            >
                              {cert.status === 'expiring-soon' ? 'Expiring Soon' : cert.status.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3">
                            {cert.issueDate && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Issued</p>
                                <p className="font-medium text-foreground">
                                  {new Date(cert.issueDate).toLocaleDateString()}
                                </p>
                              </div>
                            )}
                            {cert.expiryDate && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Expires</p>
                                <p className="font-medium text-foreground">
                                  {new Date(cert.expiryDate).toLocaleDateString()}
                                  {cert.status === 'expiring-soon' && (
                                    <span className="text-yellow-600 dark:text-yellow-400 ml-1">
                                      ({Math.ceil((new Date(cert.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days)
                                    </span>
                                  )}
                                </p>
                              </div>
                            )}
                            {cert.certificateNumber && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Certificate #</p>
                                <p className="font-medium text-foreground">{cert.certificateNumber}</p>
                              </div>
                            )}
                            {cert.score !== undefined && cert.score !== null && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Score</p>
                                <p className="font-medium text-foreground">{cert.score}%</p>
                              </div>
                            )}
                          </div>
                        </div>
                        {cert.certificateUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(cert.certificateUrl, '_blank')}
                            className="ml-4"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Certificate
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No certifications found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reminder Dialog */}
      <Dialog open={showReminderDialog} onOpenChange={setShowReminderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Training Reminder</DialogTitle>
            <DialogDescription>
              Select notification methods to remind {employee.name} about pending training
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="sms"
                checked={reminderSMS}
                onCheckedChange={(checked) => setReminderSMS(checked as boolean)}
              />
              <Label htmlFor="sms" className="flex items-center space-x-2 cursor-pointer">
                <MessageSquare className="h-4 w-4" />
                <span>Send SMS</span>
              </Label>
            </div>
            
            <div className="flex items-center space-x-3">
              <Checkbox
                id="push"
                checked={reminderPush}
                onCheckedChange={(checked) => setReminderPush(checked as boolean)}
              />
              <Label htmlFor="push" className="flex items-center space-x-2 cursor-pointer">
                <Bell className="h-4 w-4" />
                <span>Send Push Notification</span>
              </Label>
            </div>
            
            <div className="flex items-center space-x-3">
              <Checkbox
                id="email-reminder"
                checked={reminderEmail}
                onCheckedChange={(checked) => setReminderEmail(checked as boolean)}
              />
              <Label htmlFor="email-reminder" className="flex items-center space-x-2 cursor-pointer">
                <Mail className="h-4 w-4" />
                <span>Send Email</span>
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReminderDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmReminder}
              className="bg-brand-gradient hover:opacity-90 text-white"
            >
              <Send className="w-4 h-4 mr-2" />
              Send Reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag Selector Dialog */}
      <TagSelectorDialog
        isOpen={isTagSelectorOpen}
        onClose={() => setIsTagSelectorOpen(false)}
        selectedTags={tags}
        onTagsChange={handleTagsChange}
        systemCategory="people"
      />

      {/* Edit People Dialog */}
      {showEditDialog && (
        <EditPeopleDialog
          isOpen={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          user={userDetails && userDetails.id === employee.id ? userDetails : null}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}