import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  CheckCircle, 
  Play, 
  Star,
  Activity
} from 'lucide-react';

interface ActivityFeedProps {
  currentRole: 'admin' | 'district-manager' | 'store-manager';
  onNavigateToUnits?: (storeId?: string) => void;
}

// Mock activity data matching the premium design
const recentActivities = [
  {
    id: 1,
    learnerName: 'James Smith',
    action: 'completed',
    contentTitle: "Checking ID's",
    context: 'in Texas track',
    storeNumber: '2847',
    jobTitle: 'Sales Associate',
    timestamp: '2 minutes ago',
    initials: 'JS',
    type: 'completion',
    avatarColor: 'bg-orange-100 text-orange-700'
  },
  {
    id: 2,
    learnerName: 'Maria Rodriguez',
    action: 'started',
    contentTitle: 'Customer Service Excellence',
    context: 'in Service Training',
    storeNumber: '1523',
    jobTitle: 'Assistant Manager',
    timestamp: '5 minutes ago',
    initials: 'MR',
    type: 'start',
    avatarColor: 'bg-red-100 text-red-700'
  },
  {
    id: 3,
    learnerName: 'David Chen',
    action: 'achieved',
    contentTitle: '95% completion rate',
    context: 'in Safety Protocol',
    storeNumber: '3691',
    jobTitle: 'Store Manager',
    timestamp: '8 minutes ago',
    initials: 'DC',
    type: 'achievement',
    avatarColor: 'bg-orange-100 text-orange-700'
  },
  {
    id: 4,
    learnerName: 'Sarah Johnson',
    action: 'completed',
    contentTitle: 'Product Knowledge Quiz',
    context: 'in New Product Launch',
    storeNumber: '4215',
    jobTitle: 'Sales Associate',
    timestamp: '12 minutes ago',
    initials: 'SJ',
    type: 'completion',
    avatarColor: 'bg-red-100 text-red-700'
  }
];

export function ActivityFeed({ currentRole, onNavigateToUnits }: ActivityFeedProps) {
  const getJobTitleColor = (jobTitle: string) => {
    switch (jobTitle.toLowerCase()) {
      case 'store manager':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'assistant manager':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'sales associate':
        return 'bg-green-50 text-green-700 border-green-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'completion':
        return <CheckCircle className="h-4 w-4" />;
      case 'start':
        return <Play className="h-4 w-4" />;
      case 'achievement':
        return <Star className="h-4 w-4" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getBorderColor = (type: string) => {
    switch (type) {
      case 'completion':
        return 'border-l-green-500';
      case 'start':
        return 'border-l-blue-500';
      case 'achievement':
        return 'border-l-yellow-500';
      default:
        return 'border-l-gray-300';
    }
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Activity Feed</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Recent learner activity across your {currentRole === 'admin' ? 'organization' : currentRole === 'district-manager' ? 'district' : 'store'}
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-xs"
            onClick={() => {
              if (onNavigateToUnits) {
                onNavigateToUnits('5'); // Navigate to Store E (id '5')
              }
            }}
          >
            <Activity className="h-3.5 w-3.5 mr-1.5" />
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="space-y-0">
          {recentActivities.map((activity, index) => (
            <div 
              key={activity.id} 
              className={`flex items-start gap-3 py-4 border-l-4 pl-3 ${getBorderColor(activity.type)} ${
                index !== recentActivities.length - 1 ? 'border-b border-border/30' : ''
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {getActivityIcon(activity.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2.5 mb-1.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${activity.avatarColor}`}>
                        <span className="text-xs font-semibold">
                          {activity.initials}
                        </span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug">
                          <span className="font-semibold text-foreground">{activity.learnerName}</span>
                          {' '}
                          <span className="text-muted-foreground">{activity.action}</span>
                          {' '}
                          <span className="font-medium text-foreground">{activity.contentTitle}</span>
                          {' '}
                          <span className="text-muted-foreground">{activity.context}</span>
                        </p>
                        
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className="text-xs px-2 py-0 h-5 bg-background">
                            Store #{activity.storeNumber}
                          </Badge>
                          <Badge variant="outline" className={`text-xs px-2 py-0 h-5 ${getJobTitleColor(activity.jobTitle)}`}>
                            {activity.jobTitle}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0 text-xs text-muted-foreground">
                    {activity.timestamp}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}