// =============================================================================
// LEGACY KNOWLEDGE BASE (MOCK DATA) - NOT USED BY CURRENT APP ROUTING
// -----------------------------------------------------------------------------
// This component was the original Knowledge Base UI built on mock data.
// It is no longer wired into `App.tsx` and is kept only as a design/reference.
//
// Current, production KB implementation:
// - Internal KB UI: `KnowledgeBaseRevamp` (used in `App.tsx`)
// - Public KB UI: `PublicKBViewer` + Supabase edge function `kb.ts`
//
// New development should extend `KnowledgeBaseRevamp` rather than this file.
// =============================================================================

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Avatar, AvatarFallback } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { 
  BookOpen,
  Search,
  ChevronRight,
  Clock,
  Tag,
  User,
  Calendar,
  History,
  ExternalLink,
  Share2,
  Edit,
  MoreVertical,
  Home,
  Shield,
  Users,
  AlertTriangle,
  Briefcase,
  Utensils,
  ChevronDown,
  Eye,
  Smartphone,
  FileText,
  Video,
  CheckCircle,
  List,
  Image as ImageIcon,
  Play,
  X,
  Plus,
  RefreshCw,
  Filter as FilterIcon
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from './ui/sheet';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface Category {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  description: string;
  articleCount: number;
  color: string;
  subcategories?: string[];
}

interface Article {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  tags: string[];
  readingTime: number;
  type: 'Required' | 'Optional' | 'Manager-Only';
  author: string;
  lastUpdated: string;
  version: string;
  viewCount: number;
  linkedAssignments: number;
  content?: string;
}

const categories: Category[] = [
  {
    id: 'operations',
    name: 'Operations',
    icon: Briefcase,
    description: 'Daily operations, workflows, and procedures',
    articleCount: 24,
    color: 'bg-blue-100 text-blue-700',
    subcategories: ['Opening Procedures', 'Closing Procedures', 'Daily Tasks', 'Inventory Management']
  },
  {
    id: 'hr',
    name: 'HR Policies',
    icon: Users,
    description: 'Human resources policies and guidelines',
    articleCount: 18,
    color: 'bg-purple-100 text-purple-700',
    subcategories: ['Onboarding', 'Time Off', 'Benefits', 'Performance Reviews']
  },
  {
    id: 'food-safety',
    name: 'Food Safety',
    icon: Utensils,
    description: 'Health, safety, and compliance standards',
    articleCount: 31,
    color: 'bg-green-100 text-green-700',
    subcategories: ['Food Handling', 'Sanitation', 'Temperature Logs', 'Allergen Management']
  },
  {
    id: 'manager-tools',
    name: 'Manager Tools',
    icon: Shield,
    description: 'Leadership resources and management guides',
    articleCount: 15,
    color: 'bg-orange-100 text-orange-700',
    subcategories: ['Coaching', 'Scheduling', 'Conflict Resolution', 'Performance Management']
  },
  {
    id: 'store-procedures',
    name: 'Store Procedures',
    icon: Home,
    description: 'Store-specific processes and standards',
    articleCount: 22,
    color: 'bg-pink-100 text-pink-700',
    subcategories: ['Customer Service', 'Cash Handling', 'Merchandising', 'Loss Prevention']
  }
];

const mockArticles: Article[] = [
  {
    id: '1',
    title: 'Opening Checklist for Store Managers',
    description: 'Complete daily opening procedures to ensure store readiness',
    category: 'operations',
    subcategory: 'Opening Procedures',
    tags: ['checklist', 'daily', 'managers'],
    readingTime: 5,
    type: 'Required',
    author: 'Sarah Johnson',
    lastUpdated: '2024-01-15',
    version: '2.3',
    viewCount: 342,
    linkedAssignments: 3,
    content: `# Opening Checklist for Store Managers

## Before Store Opens (30 minutes before)

### Safety & Security
- Disarm security system
- Turn on all lights (interior and exterior)
- Check for any overnight incidents or damages
- Verify all emergency exits are clear and functional

### Equipment & Systems
- Boot up POS systems and verify connectivity
- Check that all credit card terminals are online
- Test phone lines and communication systems
- Verify temperature logs for refrigeration units

### Store Presentation
- Unlock and open front entrance
- Ensure all displays are clean and properly merchandised
- Check restrooms for cleanliness and supplies
- Verify signage is correct and visible

## Staff Preparation
- Review shift schedule and assign stations
- Conduct brief team huddle
- Share daily goals and promotions
- Address any questions or concerns`
  },
  {
    id: '2',
    title: 'Food Temperature Safety Guidelines',
    description: 'Critical temperature monitoring and documentation procedures',
    category: 'food-safety',
    subcategory: 'Temperature Logs',
    tags: ['safety', 'compliance', 'required'],
    readingTime: 8,
    type: 'Required',
    author: 'Mike Chen',
    lastUpdated: '2024-01-10',
    version: '3.1',
    viewCount: 521,
    linkedAssignments: 5
  },
  {
    id: '3',
    title: 'New Employee Onboarding Process',
    description: 'Step-by-step guide for welcoming and training new team members',
    category: 'hr',
    subcategory: 'Onboarding',
    tags: ['onboarding', 'training', 'hr'],
    readingTime: 12,
    type: 'Manager-Only',
    author: 'Emily Davis',
    lastUpdated: '2024-01-20',
    version: '1.5',
    viewCount: 198,
    linkedAssignments: 2
  },
  {
    id: '4',
    title: 'Cash Handling Best Practices',
    description: 'Secure procedures for managing cash transactions and deposits',
    category: 'store-procedures',
    subcategory: 'Cash Handling',
    tags: ['cash', 'security', 'daily'],
    readingTime: 6,
    type: 'Required',
    author: 'James Wilson',
    lastUpdated: '2024-01-18',
    version: '2.0',
    viewCount: 445,
    linkedAssignments: 4
  },
  {
    id: '5',
    title: 'Effective Team Coaching Techniques',
    description: 'Strategies for developing and motivating your team',
    category: 'manager-tools',
    subcategory: 'Coaching',
    tags: ['leadership', 'development', 'coaching'],
    readingTime: 10,
    type: 'Manager-Only',
    author: 'Sarah Johnson',
    lastUpdated: '2024-01-12',
    version: '1.2',
    viewCount: 287,
    linkedAssignments: 1
  },
  {
    id: '6',
    title: 'Allergen Management Protocol',
    description: 'Preventing cross-contamination and managing allergen information',
    category: 'food-safety',
    subcategory: 'Allergen Management',
    tags: ['allergen', 'safety', 'compliance'],
    readingTime: 7,
    type: 'Required',
    author: 'Mike Chen',
    lastUpdated: '2024-01-22',
    version: '2.1',
    viewCount: 612,
    linkedAssignments: 6
  }
];

type ViewMode = 'home' | 'category' | 'article' | 'mobile-preview';

interface KnowledgeBaseProps {
  onNavigateToAssignment?: () => void;
  onEditArticle?: (article: Article) => void;
  currentRole?: 'admin' | 'district-manager' | 'store-manager';
}

export function KnowledgeBase({ onNavigateToAssignment, onEditArticle, currentRole = 'admin' }: KnowledgeBaseProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAssignPanel, setShowAssignPanel] = useState(false);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'Required' | 'Optional' | 'Manager-Only'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const filteredArticles = mockArticles.filter(article => {
    const matchesSearch = searchQuery === '' || 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = !selectedCategory || article.category === selectedCategory.id;
    const matchesSubcategory = !selectedSubcategory || article.subcategory === selectedSubcategory;
    const matchesCategoryFilter = selectedCategories.length === 0 || selectedCategories.includes(article.category);
    const matchesTypeFilter = selectedTypes.length === 0 || selectedTypes.includes(article.type);
    
    return matchesSearch && matchesCategory && matchesSubcategory && matchesCategoryFilter && matchesTypeFilter;
  });

  const handleCategoryClick = (category: Category) => {
    setSelectedCategory(category);
    setSelectedSubcategory(null);
    setViewMode('category');
  };

  const handleArticleClick = (article: Article) => {
    setSelectedArticle(article);
    setViewMode('article');
  };

  const handleAssignContent = () => {
    setShowAssignPanel(true);
    toast.success('Opening assignment panel...');
  };

  const handleBreadcrumbClick = (level: 'home' | 'category') => {
    if (level === 'home') {
      setViewMode('home');
      setSelectedCategory(null);
      setSelectedSubcategory(null);
      setSelectedArticle(null);
    } else if (level === 'category') {
      setViewMode('category');
      setSelectedArticle(null);
    }
  };

  const toggleCategoryFilter = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleTypeFilter = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const removeFilter = (filterType: 'category' | 'type', value: string) => {
    if (filterType === 'category') {
      setSelectedCategories(prev => prev.filter(id => id !== value));
    } else {
      setSelectedTypes(prev => prev.filter(t => t !== value));
    }
  };

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedTypes([]);
  };

  const activeFilters = [
    ...selectedCategories.map(catId => ({
      type: 'category' as const,
      value: catId,
      label: categories.find(c => c.id === catId)?.name || catId
    })),
    ...selectedTypes.map(type => ({
      type: 'type' as const,
      value: type,
      label: type
    }))
  ];

  // Render breadcrumbs
  const renderBreadcrumbs = () => {
    return (
      <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
        <button 
          onClick={() => handleBreadcrumbClick('home')}
          className="hover:text-primary transition-colors flex items-center"
        >
          <BookOpen className="h-4 w-4 mr-1" />
          Wiki
        </button>
        {selectedCategory && (
          <>
            <ChevronRight className="h-4 w-4" />
            <button
              onClick={() => handleBreadcrumbClick('category')}
              className="hover:text-primary transition-colors"
            >
              {selectedCategory.name}
            </button>
          </>
        )}
        {selectedArticle && (
          <>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">{selectedArticle.title}</span>
          </>
        )}
      </div>
    );
  };

  // Render Wiki Home View
  const renderHome = () => (
    <div className="space-y-8">
      {/* Hero Section */}
      <Card className="hero-primary text-white">
        <CardContent className="p-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-white mb-3">{t('knowledgeBase.title')}</h1>
              <p className="text-white/90 text-lg max-w-2xl">
                {t('knowledgeBase.heroSubtitle')}
              </p>
              <div className="flex items-center space-x-6 mt-6">
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-white/80" />
                  <span className="text-white/90">{mockArticles.length} {t('knowledgeBase.articlesLabel')}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <BookOpen className="h-5 w-5 text-white/80" />
                  <span className="text-white/90">{categories.length} {t('knowledgeBase.categoriesLabel')}</span>
                </div>
              </div>
            </div>
            <BookOpen className="h-20 w-20 text-white/20" />
          </div>
        </CardContent>
      </Card>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder={t('knowledgeBase.searchAcrossPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 text-lg bg-accent/50 border-2 focus:border-primary"
            />
          </div>
        </CardContent>
      </Card>

      {/* Categories Grid */}
      <div>
        <h2 className="text-foreground mb-4">{t('knowledgeBase.browseByCategory')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Card 
                key={category.id}
                className="hover:shadow-lg transition-all cursor-pointer hover:border-primary border-2"
                onClick={() => handleCategoryClick(category)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl ${category.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold mb-2">{category.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{category.description}</p>
                  <Badge variant="outline">{category.articleCount} {t('knowledgeBase.articlesLabel')}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent & Popular Articles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/20 dark:to-background border-orange-200 dark:border-orange-900/30">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-[#F74A05]" />
              <span>{t('knowledgeBase.recentlyUpdated')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockArticles
              .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
              .slice(0, 4)
              .map((article) => (
                <div
                  key={article.id}
                  onClick={() => handleArticleClick(article)}
                  className="p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors border border-transparent hover:border-primary"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm mb-1">{article.title}</p>
                      <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                        <span className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(article.lastUpdated).toLocaleDateString()}
                        </span>
                        <span className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {article.readingTime} min
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="ml-2">
                      {article.type}
                    </Badge>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-background border-amber-200 dark:border-amber-900/30">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Eye className="h-5 w-5 text-[#FF733C]" />
              <span>{t('knowledgeBase.mostViewed')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockArticles
              .sort((a, b) => b.viewCount - a.viewCount)
              .slice(0, 4)
              .map((article) => (
                <div
                  key={article.id}
                  onClick={() => handleArticleClick(article)}
                  className="p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors border border-transparent hover:border-primary"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm mb-1">{article.title}</p>
                      <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                        <span className="flex items-center">
                          <Eye className="h-3 w-3 mr-1" />
                          {article.viewCount} views
                        </span>
                        <span className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {article.readingTime} min
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="ml-2">
                      {article.type}
                    </Badge>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      {/* All Articles List with Filters */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-foreground">{t('knowledgeBase.allArticles')}</h2>
          {currentRole === 'admin' && (
            <Button 
              className="bg-brand-gradient text-white shadow-brand hover:opacity-90 border-0"
              onClick={() => onEditArticle?.(null)}
            >
              <Edit className="h-4 w-4 mr-2" />
              {t('knowledgeBase.newArticle')}
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3 mb-4">
          {/* Filter Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Add Filter Button with Popover */}
              <Popover open={showFilterMenu} onOpenChange={setShowFilterMenu}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-8 border-dashed border-primary/50 text-primary hover:bg-primary/5 hover:border-primary"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Filter
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <div className="p-3 border-b">
                    <p className="text-sm font-medium">{t('knowledgeBase.addFilter')}</p>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {/* Category Filters */}
                    <div className="p-3">
                      <p className="text-xs text-muted-foreground mb-2">{t('knowledgeBase.categoryFilter')}</p>
                      <div className="space-y-1">
                        {categories.map((category) => {
                          const Icon = category.icon;
                          return (
                            <button
                              key={category.id}
                              onClick={() => {
                                toggleCategoryFilter(category.id);
                                setShowFilterMenu(false);
                              }}
                              className="w-full flex items-center space-x-2 px-2 py-1.5 hover:bg-accent/50 rounded transition-colors text-left"
                            >
                              <Checkbox 
                                checked={selectedCategories.includes(category.id)}
                                onCheckedChange={() => toggleCategoryFilter(category.id)}
                              />
                              <div className={`p-1 rounded ${category.color}`}>
                                <Icon className="h-3 w-3" />
                              </div>
                              <span className="text-sm flex-1">{category.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <Separator />

                    {/* Type Filters */}
                    <div className="p-3">
                      <p className="text-xs text-muted-foreground mb-2">{t('knowledgeBase.typeFilter')}</p>
                      <div className="space-y-1">
                        {['Required', 'Optional', 'Manager-Only'].map((type) => (
                          <button
                            key={type}
                            onClick={() => {
                              toggleTypeFilter(type);
                              setShowFilterMenu(false);
                            }}
                            className="w-full flex items-center space-x-2 px-2 py-1.5 hover:bg-accent/50 rounded transition-colors text-left"
                          >
                            <Checkbox 
                              checked={selectedTypes.includes(type)}
                              onCheckedChange={() => toggleTypeFilter(type)}
                            />
                            <Badge
                              variant="outline"
                              className={
                                type === 'Required'
                                  ? 'bg-red-100 text-red-700 border-red-200'
                                  : type === 'Manager-Only'
                                  ? 'bg-purple-100 text-purple-700 border-purple-200'
                                  : 'bg-blue-100 text-blue-700 border-blue-200'
                              }
                            >
                              {type}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Results Count */}
              <span className="text-sm text-muted-foreground">
                {filteredArticles.length} {t('knowledgeBase.articlesLabel')}
              </span>
            </div>

            {/* Clear All Button */}
            {activeFilters.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearAllFilters} 
                className="text-muted-foreground hover:text-foreground h-8"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                {t('common.clearAll')}
              </Button>
            )}
          </div>

          {/* Active Filters */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {activeFilters.map((filter, index) => (
                <Badge 
                  key={`${filter.type}-${filter.value}-${index}`}
                  variant="secondary" 
                  className="flex items-center gap-1.5 pl-2 pr-1.5 py-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors text-xs"
                >
                  <span className="opacity-70">{filter.type === 'category' ? t('knowledgeBase.categoryFilter') : t('knowledgeBase.typeFilter')}:</span>
                  <span>{filter.label}</span>
                  <button
                    onClick={() => removeFilter(filter.type, filter.value)}
                    className="ml-0.5 hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Articles Grid */}
        <div className="grid gap-4">
          {filteredArticles.length > 0 ? (
            filteredArticles.map((article) => {
              const categoryData = categories.find(c => c.id === article.category);
              const CategoryIcon = categoryData?.icon || FileText;
              
              return (
                <Card 
                  key={article.id}
                  className="hover:shadow-lg transition-all cursor-pointer hover:border-primary border"
                  onClick={() => handleArticleClick(article)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className={`p-3 rounded-xl ${categoryData?.color || 'bg-gray-100 text-gray-700'}`}>
                          <CategoryIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="font-semibold mb-1">{article.title}</h3>
                              <p className="text-sm text-muted-foreground mb-3">{article.description}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center flex-wrap gap-4">
                            <Badge variant="outline" className="text-xs">
                              {categoryData?.name || article.category}
                            </Badge>
                            {article.subcategory && (
                              <span className="text-xs text-muted-foreground">
                                {article.subcategory}
                              </span>
                            )}
                            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              <span>{article.readingTime} min</span>
                            </div>
                            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                              <Eye className="h-4 w-4" />
                              <span>{article.viewCount} views</span>
                            </div>
                            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                              <User className="h-4 w-4" />
                              <span>{article.author}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 ml-auto">
                              {article.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  <Tag className="h-3 w-3 mr-1" />
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="ml-6 flex flex-col items-end space-y-2">
                        <Badge 
                          variant="outline"
                          className={
                            article.type === 'Required' 
                              ? 'bg-red-100 text-red-700 border-red-200'
                              : article.type === 'Manager-Only'
                              ? 'bg-purple-100 text-purple-700 border-purple-200'
                              : 'bg-blue-100 text-blue-700 border-blue-200'
                          }
                        >
                          {article.type}
                        </Badge>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">{t('knowledgeBase.noArticlesMatchingFilters')}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );

  // Render Category View
  const renderCategory = () => {
    if (!selectedCategory) return null;

    const Icon = selectedCategory.icon;
    
    return (
      <div className="space-y-6">
        {renderBreadcrumbs()}

        {/* Category Header */}
        <Card className="border-2 border-primary/20">
          <CardContent className="p-8">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className={`p-4 rounded-xl ${selectedCategory.color}`}>
                  <Icon className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-foreground mb-2">{selectedCategory.name}</h1>
                  <p className="text-muted-foreground text-lg">{selectedCategory.description}</p>
                  <div className="flex items-center space-x-4 mt-4">
                    <Badge variant="outline">{selectedCategory.articleCount} {t('knowledgeBase.articlesLabel')}</Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subcategories */}
        {selectedCategory.subcategories && (
          <div>
            <h2 className="text-foreground mb-4">{t('knowledgeBase.subcategories')}</h2>
            <div className="flex flex-wrap gap-2 mb-6">
              <Button
                variant={selectedSubcategory === null ? "default" : "outline"}
                onClick={() => setSelectedSubcategory(null)}
                className={selectedSubcategory === null ? "bg-primary text-white" : ""}
              >
                {t('knowledgeBase.allArticles')}
              </Button>
              {selectedCategory.subcategories.map((sub) => (
                <Button
                  key={sub}
                  variant={selectedSubcategory === sub ? "default" : "outline"}
                  onClick={() => setSelectedSubcategory(sub)}
                  className={selectedSubcategory === sub ? "bg-primary text-white" : ""}
                >
                  {sub}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Articles List */}
        <div>
          <h2 className="text-foreground mb-4">
            {selectedSubcategory ? `${selectedSubcategory} Articles` : 'All Articles'}
          </h2>
          <div className="grid gap-4">
            {filteredArticles.map((article) => (
              <Card 
                key={article.id}
                className="hover:shadow-lg transition-all cursor-pointer hover:border-primary border"
                onClick={() => handleArticleClick(article)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold">{article.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">{article.description}</p>
                      
                      <div className="flex items-center flex-wrap gap-4">
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>{article.readingTime} min read</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Eye className="h-4 w-4" />
                          <span>{article.viewCount} views</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <User className="h-4 w-4" />
                          <span>{article.author}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 ml-auto">
                          {article.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="ml-6 flex flex-col items-end space-y-2">
                      <Badge 
                        variant="outline"
                        className={
                          article.type === 'Required' 
                            ? 'bg-red-100 text-red-700 border-red-200'
                            : article.type === 'Manager-Only'
                            ? 'bg-purple-100 text-purple-700 border-purple-200'
                            : 'bg-blue-100 text-blue-700 border-blue-200'
                        }
                      >
                        {article.type}
                      </Badge>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Render Article View
  const renderArticle = () => {
    if (!selectedArticle) return null;

    return (
      <div className="space-y-6">
        {renderBreadcrumbs()}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Article Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Article Header */}
            <Card>
              <CardContent className="p-8">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-3">
                      <Badge 
                        variant="outline"
                        className={
                          selectedArticle.type === 'Required' 
                            ? 'bg-red-100 text-red-700 border-red-200'
                            : selectedArticle.type === 'Manager-Only'
                            ? 'bg-purple-100 text-purple-700 border-purple-200'
                            : 'bg-blue-100 text-blue-700 border-blue-200'
                        }
                      >
                        {selectedArticle.type}
                      </Badge>
                    </div>
                    <h1 className="text-foreground mb-4">{selectedArticle.title}</h1>
                    <p className="text-muted-foreground text-lg">{selectedArticle.description}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {currentRole === 'admin' && (
                        <DropdownMenuItem onClick={() => onEditArticle?.(selectedArticle)}>
                          <Edit className="h-4 w-4 mr-2" />
                          {t('knowledgeBase.editArticle')}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem>
                        <Share2 className="h-4 w-4 mr-2" />
                        {t('knowledgeBase.shareLink')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowMobilePreview(true)}>
                        <Smartphone className="h-4 w-4 mr-2" />
                        {t('knowledgeBase.mobilePreview')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Article Meta */}
                <div className="flex items-center flex-wrap gap-4 pb-6 border-b border-border">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{selectedArticle.readingTime} min read</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Eye className="h-4 w-4" />
                    <span>{selectedArticle.viewCount} views</span>
                  </div>
                  <div className="flex flex-wrap gap-2 ml-auto">
                    {selectedArticle.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Assign Button */}
                <div className="pt-6">
                  <Button 
                    className="bg-brand-gradient text-white shadow-brand hover:opacity-90 border-0 w-full"
                    onClick={handleAssignContent}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Assign This Content
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Article Body */}
            <Card>
              <CardContent className="p-8 prose prose-sm max-w-none">
                {selectedArticle.content ? (
                  <div className="space-y-6">
                    {/* Parse and render markdown-style content */}
                    {selectedArticle.content.split('\n\n').map((block, index) => {
                      if (block.startsWith('# ')) {
                        return <h1 key={index} className="text-foreground">{block.substring(2)}</h1>;
                      } else if (block.startsWith('## ')) {
                        return <h2 key={index} className="text-foreground mt-8 mb-4">{block.substring(3)}</h2>;
                      } else if (block.startsWith('### ')) {
                        return <h3 key={index} className="text-foreground mt-6 mb-3">{block.substring(4)}</h3>;
                      } else if (block.startsWith('- ')) {
                        const items = block.split('\n').filter(line => line.startsWith('- '));
                        return (
                          <ul key={index} className="space-y-2 ml-4 list-disc list-inside">
                            {items.map((item, i) => (
                              <li key={i} className="text-foreground">{item.substring(2)}</li>
                            ))}
                          </ul>
                        );
                      } else {
                        return <p key={index} className="text-foreground leading-relaxed">{block}</p>;
                      }
                    })}

                    {/* Example Media Blocks */}
                    <div className="bg-accent/50 rounded-lg p-6 border-2 border-dashed border-border">
                      <div className="flex items-center space-x-3 mb-3">
                        <Video className="h-5 w-5 text-primary" />
                        <span className="font-medium">{t('knowledgeBase.videoTutorial')}</span>
                      </div>
                      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                        <Play className="h-16 w-16 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="bg-accent/50 rounded-lg p-6 border-2 border-dashed border-border">
                      <div className="flex items-center space-x-3 mb-3">
                        <ImageIcon className="h-5 w-5 text-primary" />
                        <span className="font-medium">{t('knowledgeBase.visualReference')}</span>
                      </div>
                      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                        <ImageIcon className="h-16 w-16 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">{t('knowledgeBase.articleContentPlaceholder')}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Info Panel */}
          <div className="space-y-4">
            {/* Article Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('contentAuthoring.articleInformation')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">{t('contentAuthoring.authorLabel')}</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {selectedArticle.author.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{selectedArticle.author}</span>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label className="text-xs text-muted-foreground">{t('knowledgeBase.lastUpdated')}</Label>
                  <p className="text-sm font-medium mt-1">
                    {new Date(selectedArticle.lastUpdated).toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </p>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">{t('contentAuthoring.versionLabel')}</Label>
                  <p className="text-sm font-medium mt-1">v{selectedArticle.version}</p>
                </div>

                <Separator />

                <div>
                  <Label className="text-xs text-muted-foreground">{t('knowledgeBase.linkedAssignments')}</Label>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm font-medium">{selectedArticle.linkedAssignments} {t('knowledgeBase.playlistsLabel')}</span>
                    <Button variant="ghost" size="sm" className="h-auto p-0 text-primary">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      {t('common.viewAll')}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">{t('knowledgeBase.totalViews')}</Label>
                  <p className="text-sm font-medium mt-1">{selectedArticle.viewCount} {t('knowledgeBase.viewsLabel')}</p>
                </div>
              </CardContent>
            </Card>

            {/* Version History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center space-x-2">
                  <History className="h-4 w-4 text-primary" />
                  <span>{t('knowledgeBase.versionHistory')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-start space-x-3 p-2 rounded-lg bg-accent">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">v{selectedArticle.version} (Current)</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(selectedArticle.lastUpdated).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-2 rounded-lg">
                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">v2.2</p>
                      <p className="text-xs text-muted-foreground">Dec 10, 2023</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-2 rounded-lg">
                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">v2.1</p>
                      <p className="text-xs text-muted-foreground">Nov 22, 2023</p>
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  {t('knowledgeBase.viewAllVersions')}
                </Button>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('knowledgeBase.quickActions')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {currentRole === 'admin' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => onEditArticle?.(selectedArticle)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    {t('knowledgeBase.editArticle')}
                  </Button>
                )}
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Share2 className="h-4 w-4 mr-2" />
                  {t('knowledgeBase.shareLink')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setShowMobilePreview(true)}
                >
                  <Smartphone className="h-4 w-4 mr-2" />
                  {t('knowledgeBase.mobilePreview')}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  // Assignment Panel Content
  const renderAssignPanel = () => (
    <Sheet open={showAssignPanel} onOpenChange={setShowAssignPanel}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('knowledgeBase.assignContent')}</SheetTitle>
          <SheetDescription>
            {t('knowledgeBase.assignContentDesc', { title: selectedArticle?.title })}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Assignment Type */}
          <div>
            <Label>{t('knowledgeBase.assignmentType')}</Label>
            <Select defaultValue="playlist">
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="playlist">{t('knowledgeBase.addToPlaylist')}</SelectItem>
                <SelectItem value="direct">{t('knowledgeBase.directAssignment')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Select Playlist */}
          <div>
            <Label>{t('knowledgeBase.selectPlaylist')}</Label>
            <Select>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder={t('knowledgeBase.choosePlaylistPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="onboarding">New Employee Onboarding</SelectItem>
                <SelectItem value="safety">Safety Training</SelectItem>
                <SelectItem value="management">Management Essentials</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="link" size="sm" className="mt-2 p-0 h-auto">
              + {t('knowledgeBase.createNewPlaylist')}
            </Button>
          </div>

          <Separator />

          {/* Target Audience */}
          <div>
            <Label>{t('knowledgeBase.targetAudience')}</Label>
            <div className="space-y-3 mt-2">
              <div className="flex items-center space-x-2">
                <Checkbox id="all-stores" />
                <label htmlFor="all-stores" className="text-sm cursor-pointer">
                  {t('knowledgeBase.allStores')}
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="specific-stores" />
                <label htmlFor="specific-stores" className="text-sm cursor-pointer">
                  {t('knowledgeBase.specificStores')}
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="specific-roles" />
                <label htmlFor="specific-roles" className="text-sm cursor-pointer">
                  {t('knowledgeBase.specificRoles')}
                </label>
              </div>
            </div>
          </div>

          {/* Store Selection */}
          <Card className="bg-accent/50">
            <CardContent className="p-4">
              <Label className="text-xs text-muted-foreground">{t('knowledgeBase.selectedStores')}</Label>
              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between p-2 bg-card rounded">
                  <span className="text-sm">Downtown Store #001</span>
                  <Badge variant="outline">35 employees</Badge>
                </div>
                <div className="flex items-center justify-between p-2 bg-card rounded">
                  <span className="text-sm">Westside Store #002</span>
                  <Badge variant="outline">42 employees</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Due Date */}
          <div>
            <Label>{t('knowledgeBase.dueDateOptional')}</Label>
            <Input type="date" className="mt-2" />
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => setShowAssignPanel(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              className="flex-1 bg-brand-gradient text-white shadow-brand hover:opacity-90 border-0"
              onClick={() => {
                toast.success(t('knowledgeBase.contentAssignedSuccess'));
                setShowAssignPanel(false);
              }}
            >
              {t('knowledgeBase.assignContent')}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  // Mobile Preview Modal
  const renderMobilePreview = () => (
    <Sheet open={showMobilePreview} onOpenChange={setShowMobilePreview}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t('knowledgeBase.mobilePreview')}</SheetTitle>
          <SheetDescription>
            {t('knowledgeBase.mobilePreviewDesc')}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {/* Mobile Frame */}
          <div className="border-4 border-gray-800 rounded-3xl overflow-hidden shadow-2xl bg-white">
            {/* Mobile Header */}
            <div className="bg-gray-800 text-white p-3 flex items-center justify-between">
              <ChevronRight className="h-5 w-5 rotate-180" />
              <span className="text-sm font-medium">{t('nav.knowledgeBase')}</span>
              <MoreVertical className="h-5 w-5" />
            </div>

            {/* Mobile Content */}
            <div className="bg-white p-4 space-y-4 h-[600px] overflow-y-auto">
              <div>
                <Badge className="bg-red-100 text-red-700 text-xs mb-2">
                  {selectedArticle?.type}
                </Badge>
                <h2 className="font-bold text-lg text-gray-900 mb-2">
                  {selectedArticle?.title}
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  {selectedArticle?.description}
                </p>
                
                <div className="flex items-center space-x-4 text-xs text-gray-500 mb-4">
                  <span className="flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    {selectedArticle?.readingTime} min
                  </span>
                  <span className="flex items-center">
                    <User className="h-3 w-3 mr-1" />
                    {selectedArticle?.author}
                  </span>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  {selectedArticle?.content?.split('\n\n').slice(0, 3).map((block, index) => {
                    if (block.startsWith('# ')) {
                      return <h3 key={index} className="font-bold text-base text-gray-900 mb-2">{block.substring(2)}</h3>;
                    } else if (block.startsWith('## ')) {
                      return <h4 key={index} className="font-semibold text-sm text-gray-900 mb-2 mt-4">{block.substring(3)}</h4>;
                    } else {
                      return <p key={index} className="text-sm text-gray-700 mb-3 leading-relaxed">{block}</p>;
                    }
                  })}
                </div>
              </div>
            </div>

            {/* Mobile Footer */}
            <div className="bg-gray-100 p-4 border-t border-gray-200">
              <Button className="w-full bg-orange-600 text-white hover:bg-orange-700">
                {t('knowledgeBase.markAsComplete')}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="space-y-6">
      {viewMode === 'home' && renderHome()}
      {viewMode === 'category' && renderCategory()}
      {viewMode === 'article' && renderArticle()}
      {renderAssignPanel()}
      {renderMobilePreview()}
    </div>
  );
}