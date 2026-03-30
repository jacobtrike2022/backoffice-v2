import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
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
  TableRow
} from '../ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion';
import {
  Loader2,
  Building2,
  Tag,
  Package,
  AlertTriangle,
  Save,
  RefreshCw
} from 'lucide-react';
import {
  getIndustries,
  getIndustryComplianceTopics,
  setIndustryComplianceTopics,
  type Industry,
  type IndustryComplianceTopic
} from '../../lib/crud/industries';
import {
  getComplianceTopics,
  type ComplianceTopic
} from '../../lib/crud/compliance';
import {
  getPrograms,
  getProgramCategories,
  getIndustryPrograms,
  setIndustryPrograms,
  type Program,
  type ProgramCategory,
  type IndustryProgram
} from '../../lib/crud/programs';

export function IndustryConfigManager() {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reference data
  const [complianceTopics, setComplianceTopics] = useState<ComplianceTopic[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programCategories, setProgramCategories] = useState<ProgramCategory[]>([]);

  // Selected industry's associations
  const [industryTopics, setIndustryTopics] = useState<IndustryComplianceTopic[]>([]);
  const [industryPrograms, setIndustryProgramsState] = useState<IndustryProgram[]>([]);

  // Editing state
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());
  const [selectedProgramIds, setSelectedProgramIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedIndustry) {
      fetchIndustryAssociations(selectedIndustry.id);
    }
  }, [selectedIndustry]);

  async function fetchInitialData() {
    setLoading(true);
    setError(null);
    try {
      const [industriesData, topicsData, programsData, categoriesData] = await Promise.all([
        getIndustries(),
        getComplianceTopics(),
        getPrograms(),
        getProgramCategories()
      ]);
      setIndustries(industriesData);
      setComplianceTopics(topicsData);
      setPrograms(programsData);
      setProgramCategories(categoriesData);

      if (industriesData.length > 0) {
        setSelectedIndustry(industriesData[0]);
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function fetchIndustryAssociations(industryId: string) {
    try {
      const [topicsData, programsData] = await Promise.all([
        getIndustryComplianceTopics(industryId),
        getIndustryPrograms(industryId)
      ]);
      setIndustryTopics(topicsData);
      setIndustryProgramsState(programsData);

      // Set selected IDs
      setSelectedTopicIds(new Set(topicsData.map(t => t.topic_id)));
      setSelectedProgramIds(new Set(programsData.map(p => p.program_id)));
      setHasChanges(false);
    } catch (err: any) {
      console.error('Error fetching industry associations:', err);
      setError(err.message || 'Failed to load industry associations');
    }
  }

  function handleTopicToggle(topicId: string, checked: boolean) {
    const newSet = new Set(selectedTopicIds);
    if (checked) {
      newSet.add(topicId);
    } else {
      newSet.delete(topicId);
    }
    setSelectedTopicIds(newSet);
    setHasChanges(true);
  }

  function handleProgramToggle(programId: string, checked: boolean) {
    const newSet = new Set(selectedProgramIds);
    if (checked) {
      newSet.add(programId);
    } else {
      newSet.delete(programId);
    }
    setSelectedProgramIds(newSet);
    setHasChanges(true);
  }

  async function handleSave() {
    if (!selectedIndustry) return;

    setSaving(true);
    setError(null);
    try {
      await Promise.all([
        setIndustryComplianceTopics(selectedIndustry.id, Array.from(selectedTopicIds)),
        setIndustryPrograms(selectedIndustry.id, Array.from(selectedProgramIds))
      ]);
      setHasChanges(false);
      // Refresh associations
      await fetchIndustryAssociations(selectedIndustry.id);
    } catch (err: any) {
      console.error('Error saving:', err);
      setError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (selectedIndustry) {
      fetchIndustryAssociations(selectedIndustry.id);
    }
  }

  // Group programs by category
  const programsByCategory = programCategories.map(category => ({
    category,
    programs: programs.filter(p => p.category_id === category.id)
  })).filter(g => g.programs.length > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Industry Configuration
              </CardTitle>
              <CardDescription>
                Configure compliance topics and programs for each industry
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={selectedIndustry?.id || ''}
                onValueChange={(value) => {
                  const industry = industries.find(i => i.id === value);
                  setSelectedIndustry(industry || null);
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {industries.map(industry => (
                    <SelectItem key={industry.id} value={industry.id}>
                      {industry.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedIndustry ? (
            <div className="space-y-6">
              {/* Industry Info */}
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{selectedIndustry.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedIndustry.description || 'No description'}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      Code: {selectedIndustry.code}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasChanges && (
                      <>
                        <Button variant="outline" size="sm" onClick={handleReset}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Reset
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={saving}>
                          {saving ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4 mr-2" />
                          )}
                          Save Changes
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <Accordion type="multiple" defaultValue={['topics', 'programs']} className="w-full">
                {/* Compliance Topics Section */}
                <AccordionItem value="topics">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-primary" />
                      <span>Compliance Topics</span>
                      <Badge variant="secondary" className="ml-2">
                        {selectedTopicIds.size} selected
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-2">
                      <p className="text-sm text-muted-foreground mb-4">
                        Select the compliance topics that typically apply to this industry
                      </p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Topic</TableHead>
                            <TableHead>Description</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {complianceTopics.map(topic => (
                            <TableRow key={topic.id}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedTopicIds.has(topic.id)}
                                  onCheckedChange={(checked) =>
                                    handleTopicToggle(topic.id, checked as boolean)
                                  }
                                />
                              </TableCell>
                              <TableCell className="font-medium">{topic.name}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {topic.description || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Programs Section */}
                <AccordionItem value="programs">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <span>Programs</span>
                      <Badge variant="secondary" className="ml-2">
                        {selectedProgramIds.size} selected
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-2">
                      <p className="text-sm text-muted-foreground mb-4">
                        Select the programs commonly used in this industry
                      </p>
                      {programsByCategory.map(({ category, programs: categoryPrograms }) => (
                        <div key={category.id} className="mb-6">
                          <h4 className="font-medium text-sm mb-2">
                            {category.name}
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {categoryPrograms.map(program => (
                              <label
                                key={program.id}
                                className={`
                                  flex items-center gap-2 p-2 rounded-md border cursor-pointer
                                  hover:bg-muted/50 transition-colors
                                  ${selectedProgramIds.has(program.id) ? 'border-primary bg-primary/5' : 'border-border'}
                                `}
                              >
                                <Checkbox
                                  checked={selectedProgramIds.has(program.id)}
                                  onCheckedChange={(checked) =>
                                    handleProgramToggle(program.id, checked as boolean)
                                  }
                                />
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">
                                    {program.name}
                                  </div>
                                  {program.vendor_name && (
                                    <div className="text-xs text-muted-foreground truncate">
                                      {program.vendor_name}
                                    </div>
                                  )}
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Save bar at bottom if changes */}
              {hasChanges && (
                <div className="flex items-center justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={handleReset}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Select an industry to configure
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
