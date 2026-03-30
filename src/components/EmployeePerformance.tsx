import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { 
  Users,
  Bell,
  CheckCircle,
  Clock,
  AlertTriangle,
  Mail,
  MessageSquare,
  Smartphone,
  Send
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface Employee {
  id: number;
  name: string;
  initials: string;
  jobTitle: string;
  completion: number;
  assigned: number;
  completed: number;
  pending: number;
  overdue: number;
  status: 'completed' | 'on-track' | 'at-risk' | 'overdue';
  avatarColor: string;
}

const mockEmployees: Employee[] = [
  {
    id: 1,
    name: 'James Smith',
    initials: 'JS',
    jobTitle: 'Sales Associate',
    completion: 100,
    assigned: 5,
    completed: 5,
    pending: 0,
    overdue: 0,
    status: 'completed',
    avatarColor: 'bg-green-100 text-green-700'
  },
  {
    id: 2,
    name: 'Maria Rodriguez',
    initials: 'MR',
    jobTitle: 'Assistant Manager',
    completion: 75,
    assigned: 8,
    completed: 6,
    pending: 2,
    overdue: 0,
    status: 'on-track',
    avatarColor: 'bg-blue-100 text-blue-700'
  },
  {
    id: 3,
    name: 'David Chen',
    initials: 'DC',
    jobTitle: 'Sales Associate',
    completion: 60,
    assigned: 5,
    completed: 3,
    pending: 1,
    overdue: 1,
    status: 'at-risk',
    avatarColor: 'bg-yellow-100 text-yellow-700'
  },
  {
    id: 4,
    name: 'Sarah Johnson',
    initials: 'SJ',
    jobTitle: 'Sales Associate',
    completion: 100,
    assigned: 6,
    completed: 6,
    pending: 0,
    overdue: 0,
    status: 'completed',
    avatarColor: 'bg-green-100 text-green-700'
  },
  {
    id: 5,
    name: 'Michael Brown',
    initials: 'MB',
    jobTitle: 'Assistant Manager',
    completion: 87,
    assigned: 8,
    completed: 7,
    pending: 1,
    overdue: 0,
    status: 'on-track',
    avatarColor: 'bg-blue-100 text-blue-700'
  },
  {
    id: 6,
    name: 'Lisa Wilson',
    initials: 'LW',
    jobTitle: 'Sales Associate',
    completion: 40,
    assigned: 5,
    completed: 2,
    pending: 1,
    overdue: 2,
    status: 'overdue',
    avatarColor: 'bg-red-100 text-red-700'
  },
  {
    id: 7,
    name: 'Robert Taylor',
    initials: 'RT',
    jobTitle: 'Sales Associate',
    completion: 80,
    assigned: 5,
    completed: 4,
    pending: 1,
    overdue: 0,
    status: 'on-track',
    avatarColor: 'bg-blue-100 text-blue-700'
  },
  {
    id: 8,
    name: 'Jennifer Davis',
    initials: 'JD',
    jobTitle: 'Assistant Manager',
    completion: 25,
    assigned: 8,
    completed: 2,
    pending: 3,
    overdue: 3,
    status: 'overdue',
    avatarColor: 'bg-red-100 text-red-700'
  }
];

export function EmployeePerformance() {
  const { t } = useTranslation();
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [notificationDialog, setNotificationDialog] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSMS, setSendSMS] = useState(true);
  const [sendPush, setSendPush] = useState(true);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'on-track':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'at-risk':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'overdue':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'on-track':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'at-risk':
      case 'overdue':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const handleNotifyClick = (employee: Employee) => {
    if (employee.pending > 0 || employee.overdue > 0) {
      setSelectedEmployee(employee);
      setNotificationDialog(true);
      setSendEmail(true);
      setSendSMS(true);
      setSendPush(true);
    }
  };

  const handleSendNotification = () => {
    const channels = [];
    if (sendEmail) channels.push('Email');
    if (sendSMS) channels.push('SMS');
    if (sendPush) channels.push('Push notification');

    if (channels.length === 0) {
      toast.error('Please select at least one notification type');
      return;
    }

    toast.success(
      `Notification sent to ${selectedEmployee?.name} via ${channels.join(', ')}`,
      { duration: 3000 }
    );
    
    setNotificationDialog(false);
    setSelectedEmployee(null);
  };

  const handleCancelNotification = () => {
    setNotificationDialog(false);
    setSelectedEmployee(null);
  };

  // Calculate summary stats
  const completedCount = mockEmployees.filter(e => e.status === 'completed').length;
  const onTrackCount = mockEmployees.filter(e => e.status === 'on-track').length;
  const atRiskCount = mockEmployees.filter(e => e.status === 'at-risk').length;
  const overdueCount = mockEmployees.filter(e => e.status === 'overdue').length;

  return (
    <>
      <Card className="border-border/50 shadow-sm w-full">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                {t('people.teamPerformance')}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('people.teamPerformanceSubtitle')}
              </p>
            </div>
            
            {/* Summary Stats */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs px-2 py-0.5">
                <CheckCircle className="h-3 w-3 mr-1" />
                {completedCount} {t('people.complete')}
              </Badge>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs px-2 py-0.5">
                <Clock className="h-3 w-3 mr-1" />
                {onTrackCount} {t('people.onTrack')}
              </Badge>
              {(atRiskCount > 0 || overdueCount > 0) && (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs px-2 py-0.5">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {atRiskCount + overdueCount} {t('people.needAction')}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pb-4">
          <div className="space-y-2">
            {mockEmployees.map((employee) => (
              <div 
                key={employee.id} 
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-accent/20 rounded-lg border border-border/40 hover:border-border/60 transition-all"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${employee.avatarColor}`}>
                    <span className="text-xs font-semibold">
                      {employee.initials}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm truncate">{employee.name}</h4>
                      <Badge variant="outline" className="text-xs px-2 py-0 h-5">
                        {employee.jobTitle}
                      </Badge>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        {employee.completed} {t('people.completed')}
                      </span>
                      {employee.pending > 0 && (
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <Clock className="h-3 w-3 text-blue-600" />
                          {employee.pending} {t('people.pending')}
                        </span>
                      )}
                      {employee.overdue > 0 && (
                        <span className="flex items-center gap-1 whitespace-nowrap text-red-600 font-medium">
                          <AlertTriangle className="h-3 w-3" />
                          {employee.overdue} {t('people.overdue')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 self-start sm:self-auto">
                  <div className="flex items-center gap-2">
                    <div className="text-right min-w-[60px]">
                      <div className="flex items-center gap-1 mb-1">
                        {getStatusIcon(employee.status)}
                        <span className="text-sm font-bold">{employee.completion}%</span>
                      </div>
                      <Progress value={employee.completion} className="h-1.5 w-16" />
                    </div>
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={`h-8 w-8 p-0 ${
                      (employee.pending > 0 || employee.overdue > 0) 
                        ? 'hover:bg-primary/10 hover:text-primary' 
                        : 'opacity-30 cursor-not-allowed'
                    }`}
                    onClick={() => handleNotifyClick(employee)}
                    disabled={employee.pending === 0 && employee.overdue === 0}
                    title={
                      employee.pending === 0 && employee.overdue === 0
                        ? t('people.noPendingAssignments')
                        : t('people.sendReminderNotification')
                    }
                  >
                    <Bell className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notification Dialog */}
      <Dialog open={notificationDialog} onOpenChange={setNotificationDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              {t('people.sendReminderTo', { name: selectedEmployee?.name })}
            </DialogTitle>
            <DialogDescription>
              {t('people.chooseReminderMethod')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="text-sm font-medium text-foreground mb-2">
              {t('people.selectNotificationChannels')}
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors">
                <Checkbox 
                  id="email" 
                  checked={sendEmail}
                  onCheckedChange={(checked) => setSendEmail(checked as boolean)}
                />
                <Label 
                  htmlFor="email" 
                  className="flex items-center gap-2 cursor-pointer flex-1"
                >
                  <Mail className="h-4 w-4 text-primary" />
                  <div>
                    <div className="font-medium text-sm">{t('people.emailChannel')}</div>
                    <div className="text-xs text-muted-foreground">{t('people.emailChannelDesc')}</div>
                  </div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors">
                <Checkbox 
                  id="sms" 
                  checked={sendSMS}
                  onCheckedChange={(checked) => setSendSMS(checked as boolean)}
                />
                <Label 
                  htmlFor="sms" 
                  className="flex items-center gap-2 cursor-pointer flex-1"
                >
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <div>
                    <div className="font-medium text-sm">{t('people.smsChannel')}</div>
                    <div className="text-xs text-muted-foreground">{t('people.smsChannelDesc')}</div>
                  </div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors">
                <Checkbox 
                  id="push" 
                  checked={sendPush}
                  onCheckedChange={(checked) => setSendPush(checked as boolean)}
                />
                <Label 
                  htmlFor="push" 
                  className="flex items-center gap-2 cursor-pointer flex-1"
                >
                  <Smartphone className="h-4 w-4 text-primary" />
                  <div>
                    <div className="font-medium text-sm">{t('people.pushChannel')}</div>
                    <div className="text-xs text-muted-foreground">{t('people.pushChannelDesc')}</div>
                  </div>
                </Label>
              </div>
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleCancelNotification}
              className="flex-1 sm:flex-none"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSendNotification}
              className="flex-1 sm:flex-none"
              disabled={!sendEmail && !sendSMS && !sendPush}
            >
              <Send className="h-4 w-4 mr-2" />
              {t('people.sendReminder')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}