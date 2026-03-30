import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogOverlay, DialogPortal } from '../ui/dialog';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Check,
  Clock,
  Trophy,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';

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

interface CheckpointPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: Question[];
  passingScore: string;
  timeLimit: string;
  title: string;
}

export function CheckpointPreviewModal({
  isOpen,
  onClose,
  questions,
  passingScore,
  timeLimit,
  title
}: CheckpointPreviewModalProps) {
  const { t } = useTranslation();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<{ [questionId: string]: string }>({});
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [timeExpired, setTimeExpired] = useState(false);

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const progressPercentage = ((currentQuestionIndex + 1) / totalQuestions) * 100;

  // Initialize timer
  useEffect(() => {
    if (isOpen && timeLimit && parseInt(timeLimit) > 0) {
      setTimeRemaining(parseInt(timeLimit) * 60); // Convert minutes to seconds
    } else {
      setTimeRemaining(null);
    }
  }, [isOpen, timeLimit]);

  // Timer countdown
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0 || showResults) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 0) return prev;
        if (prev === 1) {
          setTimeExpired(true);
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, showResults]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Reset modal state when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentQuestionIndex(0);
      setUserAnswers({});
      setSelectedAnswer(null);
      setHasSubmitted(false);
      setShowResults(false);
      setTimeExpired(false);
    }
  }, [isOpen]);

  // Check if current question has been answered
  const currentQuestionAnswered = userAnswers[currentQuestion?.id] !== undefined;

  const handleAnswerSelect = (answerId: string) => {
    if (!hasSubmitted) {
      setSelectedAnswer(answerId);
    }
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer && currentQuestion) {
      setUserAnswers({
        ...userAnswers,
        [currentQuestion.id]: selectedAnswer
      });
      setHasSubmitted(true);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
      setHasSubmitted(false);
    } else {
      // Last question, show results
      setShowResults(true);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      const prevQuestion = questions[currentQuestionIndex - 1];
      setSelectedAnswer(userAnswers[prevQuestion.id] || null);
      setHasSubmitted(!!userAnswers[prevQuestion.id]);
    }
  };

  const handleRetake = () => {
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setSelectedAnswer(null);
    setHasSubmitted(false);
    setShowResults(false);
    setTimeExpired(false);
    if (timeLimit && parseInt(timeLimit) > 0) {
      setTimeRemaining(parseInt(timeLimit) * 60);
    }
  };

  // Calculate results
  const calculateResults = () => {
    let correctCount = 0;
    questions.forEach(question => {
      const userAnswerId = userAnswers[question.id];
      const correctAnswer = question.answers.find(a => a.isCorrect);
      if (userAnswerId === correctAnswer?.id) {
        correctCount++;
      }
    });
    const scorePercentage = (correctCount / totalQuestions) * 100;
    const passed = scorePercentage >= parseInt(passingScore);
    return { correctCount, scorePercentage, passed };
  };

  // Get feedback for current answer
  const isCorrect = () => {
    if (!hasSubmitted || !selectedAnswer) return null;
    const correctAnswer = currentQuestion.answers.find(a => a.isCorrect);
    return selectedAnswer === correctAnswer?.id;
  };

  if (!isOpen) return null;

  // Results Screen
  if (showResults) {
    const { correctCount, scorePercentage, passed } = calculateResults();
    
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogPortal>
          {/* Glass blur overlay */}
          <DialogOverlay className="backdrop-blur-md bg-black/30" />
          <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden" aria-describedby={undefined}>
            <DialogTitle className="sr-only">{t('contentAuthoring.checkpointResultsSrOnly')}</DialogTitle>
            <div className="relative min-h-[500px] flex flex-col">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-accent/50 transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>

              {/* Results content */}
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 ${
                  passed 
                    ? 'bg-green-100 dark:bg-green-900/30' 
                    : 'bg-red-100 dark:bg-red-900/30'
                }`}>
                  <Trophy className={`h-12 w-12 ${
                    passed 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`} />
                </div>

                <h2 className="text-3xl font-bold mb-2">
                  {passed ? t('contentAuthoring.checkpointPassed') : t('contentAuthoring.checkpointNotPassed')}
                </h2>

                <p className="text-muted-foreground mb-8">
                  {passed
                    ? t('contentAuthoring.greatWork')
                    : t('contentAuthoring.keepPracticing')}
                </p>

                <div className="bg-accent/30 rounded-lg p-6 mb-8 w-full max-w-md">
                  <div className="text-5xl font-bold mb-2">
                    {correctCount} / {totalQuestions}
                  </div>
                  <div className="text-2xl font-semibold mb-4">
                    {Math.round(scorePercentage)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t('contentAuthoring.passingScore', { passingScore })}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleRetake}
                    variant="outline"
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {t('contentAuthoring.retakePreview')}
                  </Button>
                  <Button
                    onClick={onClose}
                    className="hero-primary"
                  >
                    {t('contentAuthoring.closePreview')}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    );
  }

  // Quiz Screen
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogPortal>
        {/* Glass blur overlay */}
        <DialogOverlay className="backdrop-blur-md bg-black/30" />
        <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden" aria-describedby={undefined}>
          <DialogTitle className="sr-only">{t('contentAuthoring.checkpointPreviewSrOnly', { current: currentQuestionIndex + 1, total: totalQuestions })}</DialogTitle>
          <div className="relative min-h-[600px] flex flex-col">
            {/* Header with Progress Bar */}
            <div className="border-b bg-background sticky top-0 z-10">
              <div className="p-6 pb-4">
                {/* Checkpoint Title and Preview Badge */}
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="font-semibold text-foreground">{title}</h2>
                  <span className="px-2 py-0.5 rounded-md text-xs bg-gradient-to-r from-gray-400 to-gray-500 text-white">
                    {t('contentAuthoring.preview')}
                  </span>
                </div>
                
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground font-medium">
                      {currentQuestionIndex + 1} / {totalQuestions}
                    </span>
                    {timeRemaining !== null && (
                      <div className={`flex items-center gap-2 text-sm font-medium ${
                        timeExpired ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                      }`}>
                        <Clock className="h-4 w-4" />
                        {formatTime(timeRemaining)}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-accent/50 transition-colors"
                  >
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>

              {/* Time expired warning */}
              {timeExpired && (
                <div className="px-6 pb-4">
                  <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>{t('contentAuthoring.timeLimitReached')}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Question Content */}
            <div className="flex-1 p-8 overflow-y-auto">
              {/* Question */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold mb-2">
                  {currentQuestion.question}
                </h3>
              </div>

              {/* Answers */}
              <div className="space-y-3 mb-6">
                {currentQuestion.answers.map((answer) => {
                  const isSelected = selectedAnswer === answer.id;
                  const isCorrectAnswer = answer.isCorrect;
                  const showFeedback = hasSubmitted && isSelected;
                  const isUserCorrect = isCorrect();

                  return (
                    <button
                      key={answer.id}
                      onClick={() => handleAnswerSelect(answer.id)}
                      disabled={hasSubmitted}
                      className={`relative w-full text-left p-4 rounded-lg border-2 transition-all ${
                        showFeedback
                          ? isUserCorrect
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                            : 'border-red-500 bg-red-50 dark:bg-red-900/20'
                          : isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-accent/30'
                      } ${hasSubmitted ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={showFeedback && isUserCorrect ? 'font-medium' : ''}>
                          {answer.text}
                        </span>
                        {showFeedback && (
                          <div className={`flex-shrink-0 ml-3 w-6 h-6 rounded-full flex items-center justify-center ${
                            isUserCorrect 
                              ? 'bg-green-500' 
                              : 'bg-red-500'
                          }`}>
                            {isUserCorrect ? (
                              <Check className="h-4 w-4 text-white" />
                            ) : (
                              <X className="h-4 w-4 text-white" />
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Explanation (only shown after submission if it exists) */}
              {hasSubmitted && currentQuestion.explanation && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    {currentQuestion.explanation}
                  </p>
                </div>
              )}
            </div>

            {/* Footer with Navigation */}
            <div className="border-t bg-background p-6">
              <div className="flex items-center justify-between">
                {/* Previous Button */}
                <Button
                  onClick={handlePrevious}
                  disabled={currentQuestionIndex === 0}
                  variant="outline"
                  size="icon"
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white border-0 disabled:opacity-50 disabled:from-gray-300 disabled:to-gray-400"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>

                {/* Submit/Next Button */}
                <div>
                  {!hasSubmitted ? (
                    <Button
                      onClick={handleSubmitAnswer}
                      disabled={!selectedAnswer}
                      className="hero-primary min-w-[120px]"
                    >
                      {t('contentAuthoring.submitAnswer')}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleNext}
                      className="hero-primary min-w-[120px]"
                    >
                      {currentQuestionIndex === totalQuestions - 1 ? t('contentAuthoring.viewResults') : t('contentAuthoring.nextQuestion')}
                    </Button>
                  )}
                </div>

                {/* Next Button */}
                <Button
                  onClick={handleNext}
                  disabled={!hasSubmitted}
                  variant="outline"
                  size="icon"
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white border-0 disabled:opacity-50 disabled:from-gray-300 disabled:to-gray-400"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}