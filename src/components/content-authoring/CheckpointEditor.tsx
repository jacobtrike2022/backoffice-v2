import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { 
  ArrowLeft, 
  Save, 
  Eye,
  Send,
  X,
  Plus,
  CheckCircle,
  GripVertical,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface Answer {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface Question {
  id: string;
  question: string;
  answers: Answer[];
  explanation?: string;
}

interface CheckpointEditorProps {
  onClose: () => void;
  onSave: (content: any, publish: boolean) => void;
  onPublishAndAssign: (content: any) => void;
  initialData?: any;
}

export function CheckpointEditor({ onClose, onSave, onPublishAndAssign, initialData }: CheckpointEditorProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState('');
  const [passingScore, setPassingScore] = useState('70');
  const [timeLimit, setTimeLimit] = useState('');
  const [questions, setQuestions] = useState<Question[]>([
    {
      id: '1',
      question: '',
      answers: [
        { id: 'a1', text: '', isCorrect: false },
        { id: 'a2', text: '', isCorrect: false }
      ]
    }
  ]);
  const [showPreview, setShowPreview] = useState(false);

  const addQuestion = () => {
    const newQuestion: Question = {
      id: Date.now().toString(),
      question: '',
      answers: [
        { id: `${Date.now()}-a1`, text: '', isCorrect: false },
        { id: `${Date.now()}-a2`, text: '', isCorrect: false }
      ],
      explanation: ''
    };
    setQuestions([...questions, newQuestion]);
  };

  const removeQuestion = (questionId: string) => {
    if (questions.length === 1) {
      toast.error('Checkpoint must have at least one question');
      return;
    }
    setQuestions(questions.filter(q => q.id !== questionId));
  };

  const updateQuestion = (questionId: string, field: string, value: any) => {
    setQuestions(questions.map(q => 
      q.id === questionId ? { ...q, [field]: value } : q
    ));
  };

  const addAnswer = (questionId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          answers: [
            ...q.answers,
            { id: `${Date.now()}-a${q.answers.length + 1}`, text: '', isCorrect: false }
          ]
        };
      }
      return q;
    }));
  };

  const removeAnswer = (questionId: string, answerId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        if (q.answers.length <= 2) {
          toast.error('Question must have at least 2 answers');
          return q;
        }
        return {
          ...q,
          answers: q.answers.filter(a => a.id !== answerId)
        };
      }
      return q;
    }));
  };

  const updateAnswer = (questionId: string, answerId: string, text: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          answers: q.answers.map(a => 
            a.id === answerId ? { ...a, text } : a
          )
        };
      }
      return q;
    }));
  };

  const setCorrectAnswer = (questionId: string, answerId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          answers: q.answers.map(a => ({
            ...a,
            isCorrect: a.id === answerId
          }))
        };
      }
      return q;
    }));
  };

  const handleSaveDraft = () => {
    const checkpointData = {
      title,
      description,
      passingScore: parseInt(passingScore),
      timeLimit,
      questions
    };
    onSave(checkpointData, false);
    toast.success('Checkpoint saved as draft');
  };

  const validateCheckpoint = () => {
    if (!title.trim()) {
      toast.error('Please add a title');
      return false;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) {
        toast.error(`Question ${i + 1} is empty`);
        return false;
      }

      const hasCorrectAnswer = q.answers.some(a => a.isCorrect);
      if (!hasCorrectAnswer) {
        toast.error(`Question ${i + 1} must have a correct answer selected`);
        return false;
      }

      const emptyAnswers = q.answers.filter(a => !a.text.trim());
      if (emptyAnswers.length > 0) {
        toast.error(`Question ${i + 1} has empty answer options`);
        return false;
      }
    }

    return true;
  };

  const handlePublishAndAssign = () => {
    if (!validateCheckpoint()) return;

    const checkpointData = {
      title,
      description,
      passingScore: parseInt(passingScore),
      timeLimit,
      questions,
      type: 'checkpoint'
    };
    onPublishAndAssign(checkpointData);
    toast.success('Checkpoint published! Redirecting to assignment...');
  };

  if (showPreview) {
    return (
      <div className="space-y-6">
        {/* Preview Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={() => setShowPreview(false)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Editor
            </Button>
            <h1 className="text-foreground">Checkpoint Preview</h1>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={handleSaveDraft}>
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button className="bg-brand-gradient text-white shadow-brand" onClick={handlePublishAndAssign}>
              <Send className="h-4 w-4 mr-2" />
              Publish & Assign
            </Button>
          </div>
        </div>

        {/* Preview Content */}
        <Card className="max-w-4xl mx-auto">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">{title || 'Untitled Checkpoint'}</CardTitle>
                {description && (
                  <p className="text-muted-foreground mt-2">{description}</p>
                )}
              </div>
              <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400">
                {questions.length} Questions
              </Badge>
            </div>
            <div className="flex items-center space-x-4 mt-4 text-sm text-muted-foreground">
              <span>Passing Score: {passingScore}%</span>
              {timeLimit && <span>• Time Limit: {timeLimit} minutes</span>}
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="space-y-8">
              {questions.map((question, qIndex) => (
                <div key={question.id} className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <Badge variant="outline" className="mt-1 bg-primary/10 text-primary border-primary/20">
                      Q{qIndex + 1}
                    </Badge>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{question.question || `Question ${qIndex + 1}`}</p>
                      
                      <div className="mt-4 space-y-2">
                        {question.answers.map((answer, aIndex) => (
                          <div 
                            key={answer.id}
                            className={`p-3 rounded-lg border-2 transition-colors ${
                              answer.isCorrect 
                                ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                                : 'border-border bg-accent/30'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                                answer.isCorrect 
                                  ? 'border-green-500 bg-green-500' 
                                  : 'border-border'
                              }`}>
                                {answer.isCorrect && (
                                  <CheckCircle className="h-4 w-4 text-white" />
                                )}
                              </div>
                              <span className={answer.isCorrect ? 'font-medium text-green-700 dark:text-green-300' : 'text-foreground'}>
                                {answer.text || `Option ${aIndex + 1}`}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {question.explanation && (
                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded">
                          <p className="text-sm text-blue-900 dark:text-blue-100">
                            <span className="font-semibold">Explanation: </span>
                            {question.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  {qIndex < questions.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-foreground">Checkpoint Editor</h1>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => setShowPreview(true)}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button variant="outline" onClick={handleSaveDraft}>
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button className="bg-brand-gradient text-white shadow-brand" onClick={handlePublishAndAssign}>
            <Send className="h-4 w-4 mr-2" />
            Publish & Assign
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Checkpoint Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title */}
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter checkpoint title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-2"
                />
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter checkpoint description or instructions..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-2"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Passing Score */}
                <div>
                  <Label htmlFor="passingScore">Passing Score (%)</Label>
                  <Input
                    id="passingScore"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="70"
                    value={passingScore}
                    onChange={(e) => setPassingScore(e.target.value)}
                    className="mt-2"
                  />
                </div>

                {/* Time Limit */}
                <div>
                  <Label htmlFor="timeLimit">Time Limit (minutes)</Label>
                  <Input
                    id="timeLimit"
                    type="number"
                    placeholder="Optional"
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(e.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Questions */}
          <div className="space-y-4">
            {questions.map((question, qIndex) => (
              <Card key={question.id} className="border-2 border-primary/10">
                <CardHeader className="bg-accent/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                      <CardTitle className="text-lg">Question {qIndex + 1}</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeQuestion(question.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  {/* Question Text */}
                  <div>
                    <Label>Question Text *</Label>
                    <Input
                      placeholder="Enter your question..."
                      value={question.question}
                      onChange={(e) => updateQuestion(question.id, 'question', e.target.value)}
                      className="mt-2"
                    />
                  </div>

                  {/* Answers */}
                  <div>
                    <Label className="mb-3 block">Answer Options *</Label>
                    <RadioGroup 
                      value={question.answers.find(a => a.isCorrect)?.id || ''}
                      onValueChange={(value) => setCorrectAnswer(question.id, value)}
                    >
                      <div className="space-y-3">
                        {question.answers.map((answer, aIndex) => (
                          <div key={answer.id} className="flex items-center space-x-2">
                            <RadioGroupItem value={answer.id} id={answer.id} />
                            <Input
                              placeholder={`Option ${aIndex + 1}...`}
                              value={answer.text}
                              onChange={(e) => updateAnswer(question.id, answer.id, e.target.value)}
                              className={`flex-1 ${answer.isCorrect ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}`}
                            />
                            {question.answers.length > 2 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeAnswer(question.id, answer.id)}
                                className="flex-shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                    <p className="text-xs text-muted-foreground mt-2">
                      Select the radio button to mark the correct answer
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addAnswer(question.id)}
                      className="mt-3"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Answer Option
                    </Button>
                  </div>

                  {/* Explanation */}
                  <div>
                    <Label>Explanation (Optional)</Label>
                    <Textarea
                      placeholder="Explain why this is the correct answer..."
                      value={question.explanation || ''}
                      onChange={(e) => updateQuestion(question.id, 'explanation', e.target.value)}
                      className="mt-2"
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Add Question Button */}
            <Button
              variant="outline"
              onClick={addQuestion}
              className="w-full border-2 border-dashed border-primary/50 hover:bg-primary/5 hover:border-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Question
            </Button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Checkpoint Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Total Questions</p>
                <p className="text-2xl font-bold text-foreground">{questions.length}</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground">Passing Score</p>
                <p className="font-medium text-foreground">{passingScore}%</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-medium text-foreground">Draft</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground">Content Type</p>
                <p className="font-medium text-foreground">Checkpoint (Quiz)</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="text-sm text-blue-900 dark:text-blue-100">Quick Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-blue-800 dark:text-blue-200">
              <p>• Each question must have at least 2 answer options</p>
              <p>• Mark the correct answer using the radio button</p>
              <p>• Add explanations to help learners understand</p>
              <p>• Drag questions to reorder them</p>
              <p>• Preview before publishing</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Publishing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => {
                  if (validateCheckpoint()) {
                    onSave({ title, description, passingScore, timeLimit, questions }, true);
                    toast.success('Checkpoint published!');
                  }
                }}
              >
                Publish Now
              </Button>
              <Button 
                size="sm" 
                className="w-full bg-brand-gradient text-white shadow-brand"
                onClick={handlePublishAndAssign}
              >
                Publish & Assign to Users
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
