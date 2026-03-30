import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from './ui/drawer';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import type { ProfileDetails } from '../lib/api/onet-local';
import { CheckCircle2 } from 'lucide-react';
import { cn } from './ui/utils';

interface ProfilePreviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ProfileDetails | null;
  onSelect: () => void;
  isApplied?: boolean; // Whether this profile is already applied to the role
}

export function ProfilePreviewDrawer({
  isOpen,
  onClose,
  profile,
  onSelect,
  isApplied = false,
}: ProfilePreviewDrawerProps) {

  const { t } = useTranslation();

  const getImportanceColor = (importance: number) => {
    if (importance >= 75) return 'bg-red-100 text-red-800 border-red-300';
    if (importance >= 50) return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  };

  return (
    <Drawer 
      open={isOpen} 
      onOpenChange={() => {}} 
      direction="right"
      modal={true}
      dismissible={false}
      shouldScaleBackground={false}
    >
      <DrawerContent 
        className="flex flex-col fixed inset-y-0 right-0 w-full sm:w-[500px] max-w-[500px] h-screen z-[9999] bg-background data-[vaul-drawer-direction=right]:!w-full data-[vaul-drawer-direction=right]:!h-screen"
        data-hide-overlay
      >
        <DrawerHeader>
          {!profile ? (
            <>
              <DrawerTitle>{t('people.loadingProfile')}</DrawerTitle>
              <DrawerDescription>{t('people.loadingProfileDesc')}</DrawerDescription>
            </>
          ) : (
            <>
              <DrawerTitle className="text-xl">{profile?.title || 'No Title'}</DrawerTitle>
              <div className="space-y-1 mt-2">
                <Badge variant="outline" className="text-xs">
                  {t('people.onetCode')}: {profile?.onet_code || 'N/A'}
                </Badge>
                {profile?.job_zone && (
                  <Badge variant="outline" className="text-xs ml-2">
                    {t('people.jobZone')} {profile.job_zone}
                  </Badge>
                )}
              </div>
              {profile?.description && profile.description.length > 200 && (
                <div className="mt-2 text-sm text-muted-foreground">
                  {profile.description.substring(0, 200)}...
                </div>
              )}
            </>
          )}
        </DrawerHeader>

        {profile && (
          <>
            <div className="flex-1 px-4 overflow-y-auto min-h-0">
              <div className="space-y-6 pb-6">
                {/* Description */}
                {profile?.description && (
                  <div>
                    <h3 className="font-semibold text-sm mb-2">{t('people.whatTheyDo')}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {profile.description}
                    </p>
                  </div>
                )}

            {/* Alternative Titles */}
            {profile?.also_called && profile.also_called.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-2">{t('people.alsoKnownAs')}</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.also_called.map((title, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {title}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Tasks */}
            {profile?.tasks && profile.tasks.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-3">
                  {t('people.keyTasks')} ({profile.tasks.length})
                </h3>
                <ul className="space-y-2">
                  {profile.tasks.map((task) => (
                    <li
                      key={task.id}
                      className="text-sm text-muted-foreground flex items-start gap-2"
                    >
                      <span className="text-[#F64A05] mt-0.5">•</span>
                      <span>{task.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />

            {/* Skills */}
            {profile?.skills && profile.skills.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-3">
                  {t('people.requiredSkills')} ({profile.skills.length})
                </h3>
                <div className="space-y-2">
                  {profile.skills.map((skill) => (
                    <div
                      key={skill.id}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{skill.name}</p>
                        {skill.category && (
                          <p className="text-xs text-muted-foreground">
                            {skill.category}
                          </p>
                        )}
                      </div>
                      <Badge
                        className={cn(
                          'text-xs',
                          getImportanceColor(skill.importance)
                        )}
                      >
                        {Math.round(skill.importance)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Knowledge */}
            {profile?.knowledge && profile.knowledge.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-3">
                  {t('people.requiredKnowledge')} ({profile.knowledge.length})
                </h3>
                <div className="space-y-2">
                  {profile.knowledge.map((know) => (
                    <div
                      key={know.id}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{know.name}</p>
                        {know.category && (
                          <p className="text-xs text-muted-foreground">
                            {know.category}
                          </p>
                        )}
                      </div>
                      <Badge
                        className={cn(
                          'text-xs',
                          getImportanceColor(know.importance)
                        )}
                      >
                        {Math.round(know.importance)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
              </div>
            </div>

            <DrawerFooter>
              <Button
                className={cn(
                  "shadow-sm hover:opacity-90 border-0",
                  isApplied 
                    ? "bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white"
                    : "bg-gradient-to-r from-[#F64A05] to-[#FF733C] text-white"
                )}
                onClick={onSelect}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {isApplied ? t('people.profileApplied') : t('people.applyProfile')}
              </Button>
            <Button
              variant="outline"
              onClick={onClose}
            >
              {t('common.close')}
            </Button>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}

